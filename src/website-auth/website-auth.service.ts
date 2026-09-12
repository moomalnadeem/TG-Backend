import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ZeptoMailService } from './providers/zeptomail.service';
import { WhatsAppService } from './providers/whatsapp.service';

const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

// OTP login authenticates into the same `users`/`roles` tables the admin panel
// uses — these two statements just widen `users` for accounts that never set a
// password or email (WhatsApp-only signups) and add verification timestamps.
const SETUP_SQL = `
  ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

  CREATE TABLE IF NOT EXISTS website_otps (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel      VARCHAR(10) NOT NULL,
    identifier   VARCHAR(255) NOT NULL,
    otp_hash     VARCHAR(255) NOT NULL,
    attempts     INT         NOT NULL DEFAULT 0,
    expires_at   TIMESTAMPTZ NOT NULL,
    consumed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_website_otps_lookup ON website_otps(channel, identifier, created_at DESC);

  SELECT pg_notify('pgrst', 'reload schema');
`;

const USER_SELECT_FIELDS =
  'id, username, name, email, phone_number, role_id, publish_status, is_active, refresh_token';

@Injectable()
export class WebsiteAuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly zeptoMail: ZeptoMailService,
    private readonly whatsApp: WhatsAppService,
  ) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  async setup(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: SETUP_SQL }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Migration failed: ${body}`);
    }

    return { success: true, message: 'users table and OTP table migrated successfully.' };
  }

  // ─── Send OTP ────────────────────────────────────────────────────────────────

  async sendOtp(dto: SendOtpDto): Promise<{ success: boolean; message: string; data: { expires_in: number } }> {
    const identifier = this.normalizeIdentifier(dto);

    const { data: lastOtp } = await this.supabase.db
      .from('website_otps')
      .select('created_at')
      .eq('channel', dto.channel)
      .eq('identifier', identifier)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastOtp) {
      const secondsSinceLast = (Date.now() - new Date(lastOtp.created_at).getTime()) / 1000;
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
        throw new HttpException(
          {
            success: false,
            message: `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another OTP.`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const otp = randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES ?? '5', 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const { data: inserted, error } = await this.supabase.db
      .from('website_otps')
      .insert({
        channel: dto.channel,
        identifier,
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    try {
      if (dto.channel === 'email') {
        await this.zeptoMail.sendOtpEmail(identifier, otp);
      } else {
        await this.whatsApp.sendOtp(identifier, otp);
      }
    } catch (err) {
      // Don't leave a row behind that would rate-limit a retry the user never received.
      await this.supabase.db.from('website_otps').delete().eq('id', inserted.id);
      throw err;
    }

    return {
      success: true,
      message: dto.channel === 'email' ? 'OTP sent to your email.' : 'OTP sent to your WhatsApp number.',
      data: { expires_in: expiryMinutes * 60 },
    };
  }

  // ─── Verify OTP & Login ──────────────────────────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto) {
    const identifier = this.normalizeIdentifier(dto);

    const { data: otpRow } = await this.supabase.db
      .from('website_otps')
      .select('id, otp_hash, attempts, expires_at, consumed_at')
      .eq('channel', dto.channel)
      .eq('identifier', identifier)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow) {
      throw new UnauthorizedException('OTP not found or already used. Please request a new one.');
    }
    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      throw new UnauthorizedException('OTP expired. Please request a new one.');
    }
    if (otpRow.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many incorrect attempts. Please request a new OTP.');
    }

    const valid = await bcrypt.compare(dto.otp, otpRow.otp_hash);
    if (!valid) {
      await this.supabase.db
        .from('website_otps')
        .update({ attempts: otpRow.attempts + 1 })
        .eq('id', otpRow.id);
      throw new UnauthorizedException('Invalid OTP.');
    }

    await this.supabase.db
      .from('website_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', otpRow.id);

    const user = await this.findOrCreateUser(dto.channel, identifier);

    if (!user.publish_status || !user.is_active) {
      throw new UnauthorizedException('Account is inactive.');
    }

    const { access_token, refresh_token, expires_in } = await this.issueTokens(user);
    const role = await this.getRole(user.role_id);

    const { refresh_token: _rt, role_id: _roleId, ...safeUser } = user;

    return {
      success: true,
      message: 'Login successful.',
      data: { user: { ...safeUser, role }, access_token, refresh_token, expires_in },
    };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  // Mirrors AuthService.logout — OTP and password logins share the same
  // refresh_token column, so both flows end the same way.
  async logout(userId: string) {
    await this.supabase.db
      .from('users')
      .update({ refresh_token: null })
      .eq('id', userId);

    return { success: true, message: 'Logout successful.' };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private normalizeIdentifier(dto: SendOtpDto): string {
    return dto.channel === 'email'
      ? dto.email!.trim().toLowerCase()
      : dto.phone_number!.trim();
  }

  private async findOrCreateUser(channel: 'email' | 'whatsapp', identifier: string) {
    const column = channel === 'email' ? 'email' : 'phone_number';
    const verifiedColumn = channel === 'email' ? 'email_verified_at' : 'phone_verified_at';

    const { data: existing } = await this.supabase.db
      .from('users')
      .select(USER_SELECT_FIELDS)
      .eq(column, identifier)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      await this.supabase.db
        .from('users')
        .update({ [verifiedColumn]: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      return existing;
    }

    const defaultRoleId = await this.getDefaultRoleId();
    const insertData: Record<string, any> = {
      [column]: identifier,
      [verifiedColumn]: new Date().toISOString(),
      role_id: defaultRoleId,
      publish_status: true,
      is_active: true,
    };

    const { data: created, error } = await this.supabase.db
      .from('users')
      .insert(insertData)
      .select(USER_SELECT_FIELDS)
      .single();

    if (error) throw new Error(error.message);
    return created;
  }

  // Website signups all land in the shared "Tourist" role — same roles table admin users use.
  private async getDefaultRoleId(): Promise<string | null> {
    const { data } = await this.supabase.db
      .from('roles')
      .select('id')
      .eq('slug', 'tourist')
      .is('deleted_at', null)
      .maybeSingle();
    return data?.id ?? null;
  }

  private async getRole(roleId: string | null | undefined): Promise<{ id: string; name: string } | null> {
    if (!roleId) return null;
    const { data } = await this.supabase.db
      .from('roles')
      .select('id, name')
      .eq('id', roleId)
      .maybeSingle();
    return data ?? null;
  }

  // Mirrors AuthService.issueTokens — same claim shape, so tokens from OTP login
  // work interchangeably with /api/auth/profile, /refresh-token, and /logout.
  private async issueTokens(user: { id: string; username?: string; email?: string; role_id?: string }) {
    const accessExpiresIn = (process.env.JWT_EXPIRES_IN ?? '1h') as any;
    const refreshExpiresIn = (process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d') as any;

    const access_token = this.jwtService.sign(
      { sub: user.id, username: user.username, email: user.email, role_id: user.role_id },
      { secret: process.env.JWT_SECRET, expiresIn: accessExpiresIn },
    );

    const refresh_token = this.jwtService.sign(
      { sub: user.id },
      { secret: process.env.REFRESH_TOKEN_SECRET, expiresIn: refreshExpiresIn },
    );

    const hashedRefresh = await bcrypt.hash(refresh_token, 10);

    await this.supabase.db
      .from('users')
      .update({ refresh_token: hashedRefresh, last_login: new Date().toISOString() })
      .eq('id', user.id);

    return {
      access_token,
      refresh_token,
      expires_in: this.parseExpiresInSeconds(accessExpiresIn),
    };
  }

  private parseExpiresInSeconds(expiresIn: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn ?? '1h');
    if (!match) return 3600;
    const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(match[1], 10) * (units[match[2]] ?? 3600);
  }
}
