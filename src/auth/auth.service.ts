import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SupabaseService } from '../supabase/supabase.service';
import { AppTokenDto } from './dto/app-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── Signup ──────────────────────────────────────────────────────────────────

  async signup(dto: SignupDto) {
    if (dto.password !== dto.confirm_password) {
      throw new BadRequestException('Password and confirm password do not match.');
    }

    // Check role exists
    const { data: role } = await this.supabase.db
      .from('roles')
      .select('id, name')
      .eq('id', dto.role_id)
      .is('deleted_at', null)
      .single();
    if (!role) throw new NotFoundException('Role not found.');

    // Check email uniqueness
    const { data: emailExists } = await this.supabase.db
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .is('deleted_at', null)
      .maybeSingle();
    if (emailExists) throw new ConflictException('Email already in use.');

    // Check username uniqueness
    if (dto.username) {
      const { data: usernameExists } = await this.supabase.db
        .from('users')
        .select('id')
        .eq('username', dto.username)
        .is('deleted_at', null)
        .maybeSingle();
      if (usernameExists) throw new ConflictException('Username already in use.');
    }

    // Check phone uniqueness
    if (dto.phone_number) {
      const { data: phoneExists } = await this.supabase.db
        .from('users')
        .select('id')
        .eq('phone_number', dto.phone_number)
        .is('deleted_at', null)
        .maybeSingle();
      if (phoneExists) throw new ConflictException('Phone number already in use.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const insertData: Record<string, any> = {
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role_id: dto.role_id,
      publish_status: true,
      is_active: true,
    };
    if (dto.username) insertData.username = dto.username;
    if (dto.phone_number) insertData.phone_number = dto.phone_number;

    const { data: user, error } = await this.supabase.db
      .from('users')
      .insert(insertData)
      .select('id, username, name, email, phone_number, role_id')
      .single();

    if (error) throw new Error(error.message);

    const { access_token, refresh_token, expires_in } = await this.issueTokens(user);

    return {
      success: true,
      message: 'Account created successfully.',
      data: {
        user: { ...user, role },
        access_token,
        refresh_token,
        expires_in,
      },
    };
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async adminLogin(dto: LoginDto) {
    const login = dto.login.trim();

    const { data: user } = await this.supabase.db
      .from('users')
      .select('id, username, name, email, phone_number, role_id, publish_status, password')
      .or(`username.eq.${login},email.eq.${login},phone_number.eq.${login}`)
      .is('deleted_at', null)
      .maybeSingle();

    if (!user) {
      throw new UnauthorizedException('Invalid username, email, phone number or password.');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password ?? '');
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid username, email, phone number or password.');
    }

    if (!user.publish_status) {
      throw new UnauthorizedException('Account is inactive.');
    }

    const { access_token, refresh_token, expires_in } = await this.issueTokens(user);

    const { password: _pwd, ...safeUser } = user;

    return {
      success: true,
      message: 'Login successful.',
      data: { user: safeUser, access_token, refresh_token, expires_in },
    };
  }

  // ─── Refresh Token ───────────────────────────────────────────────────────────

  async refreshAccessToken(dto: RefreshTokenDto) {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(dto.refresh_token, {
        secret: process.env.REFRESH_TOKEN_SECRET,
      });
    } catch (err: any) {
      const msg =
        err?.name === 'TokenExpiredError' ? 'Refresh token expired.' : 'Invalid refresh token.';
      throw new UnauthorizedException(msg);
    }

    const { data: user } = await this.supabase.db
      .from('users')
      .select('id, username, name, email, role_id, publish_status, refresh_token')
      .eq('id', payload.sub)
      .is('deleted_at', null)
      .single();

    if (!user || !user.publish_status) {
      throw new UnauthorizedException('Account is inactive or not found.');
    }

    if (!user.refresh_token) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    const valid = await bcrypt.compare(dto.refresh_token, user.refresh_token);
    if (!valid) throw new UnauthorizedException('Invalid refresh token.');

    const tokens = await this.issueTokens(user);

    return {
      success: true,
      message: 'Token refreshed successfully.',
      data: tokens,
    };
  }

  // ─── Profile ─────────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, username, name, email, phone_number, role_id, publish_status')
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('User not found.');

    let role: { id: any; name: any } | null = null;
    if (data.role_id) {
      const { data: roleData } = await this.supabase.db
        .from('roles')
        .select('id, name')
        .eq('id', data.role_id)
        .single();
      role = roleData ?? null;
    }

    return { success: true, data: { ...data, role } };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string) {
    await this.supabase.db
      .from('users')
      .update({ refresh_token: null })
      .eq('id', userId);

    return { success: true, message: 'Logout successful.' };
  }

  // ─── Change Password ─────────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.new_password !== dto.confirm_password) {
      throw new BadRequestException('New password and confirm password do not match.');
    }

    const { data: user } = await this.supabase.db
      .from('users')
      .select('password')
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (!user) throw new NotFoundException('User not found.');

    const valid = await bcrypt.compare(dto.current_password, user.password ?? '');
    if (!valid) throw new UnauthorizedException('Current password is incorrect.');

    const hashed = await bcrypt.hash(dto.new_password, 10);

    await this.supabase.db
      .from('users')
      .update({ password: hashed, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return { success: true, message: 'Password changed successfully.' };
  }

  // ─── Forgot Password (Future-Ready) ──────────────────────────────────────────

  async forgotPassword(_dto: ForgotPasswordDto) {
    return {
      success: true,
      message: 'If this account exists, password reset instructions have been sent.',
    };
  }

  // ─── M2M App Token ───────────────────────────────────────────────────────────

  async appToken(dto: AppTokenDto) {
    if (!process.env.APP_SECRET || dto.app_secret !== process.env.APP_SECRET) {
      throw new UnauthorizedException('Invalid app secret.');
    }

    const expiresIn = (process.env.APP_TOKEN_EXPIRES_IN ?? '1h') as any;
    const access_token = this.jwtService.sign(
      { sub: 'm2m', email: 'app@system', type: 'm2m' },
      { secret: process.env.JWT_SECRET, expiresIn },
    );

    return {
      success: true,
      data: {
        access_token,
        token_type: 'Bearer',
        expires_in: expiresIn,
      },
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async issueTokens(user: {
    id: string;
    username?: string;
    email: string;
    role_id?: string;
  }) {
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
      .update({
        refresh_token: hashedRefresh,
        last_login: new Date().toISOString(),
      })
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
