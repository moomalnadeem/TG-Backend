import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .single();

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const { error } = await this.supabase.db.from('users').insert({
      first_name: dto.firstName,
      last_name: dto.lastName,
      email: dto.email,
      password: hashedPassword,
      is_active: true,
    });

    if (error) throw new Error(error.message);

    return { success: true, message: 'User registered successfully' };
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const { data: user } = await this.supabase.db
      .from('users')
      .select('id, email, password, is_active')
      .eq('email', dto.email)
      .single();

    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid email or password');

    if (!user.is_active) throw new UnauthorizedException('Account is inactive');

    return this.issueTokenPair(user.id, user.email);
  }

  async refresh(dto: RefreshTokenDto): Promise<TokenPair> {
    // 1. Verify signature and expiry
    let payload: { sub: string; email: string; jti: string };
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.REFRESH_TOKEN_SECRET,
      });
    } catch (err: any) {
      const message = err?.name === 'TokenExpiredError' ? 'Refresh token expired' : 'Invalid refresh token';
      throw new UnauthorizedException(message);
    }

    // 2. Check JTI exists in DB (one-time use)
    const { data: storedToken } = await this.supabase.db
      .from('refresh_tokens')
      .select('id, user_id, expires_at')
      .eq('jti', payload.jti)
      .single();

    if (!storedToken) {
      // Token reuse detected — could be stolen; invalidate all sessions for safety
      await this.supabase.db.from('refresh_tokens').delete().eq('user_id', payload.sub);
      throw new UnauthorizedException('Refresh token already used or revoked');
    }

    // 3. Delete old token (rotation — old token is now dead)
    await this.supabase.db.from('refresh_tokens').delete().eq('jti', payload.jti);

    // 4. Confirm user is still active
    const { data: user } = await this.supabase.db
      .from('users')
      .select('id, email, is_active')
      .eq('id', payload.sub)
      .single();

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }

    // 5. Issue a brand new token pair
    return this.issueTokenPair(user.id, user.email);
  }

  async logout(dto: RefreshTokenDto): Promise<{ success: boolean; message: string }> {
    try {
      const payload: { jti: string } = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.REFRESH_TOKEN_SECRET,
        ignoreExpiration: true,
      });
      await this.supabase.db.from('refresh_tokens').delete().eq('jti', payload.jti);
    } catch {
      // Ignore invalid tokens on logout — just return success
    }

    return { success: true, message: 'Logged out successfully' };
  }

  private async issueTokenPair(userId: string, email: string): Promise<TokenPair> {
    const jti = randomUUID();
    const accessExpiresIn = process.env.JWT_EXPIRES_IN ?? '1h';
    const refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d';

    const accessToken = this.jwtService.sign(
      { sub: userId, email },
      { secret: process.env.JWT_SECRET, expiresIn: accessExpiresIn as any },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, email, jti },
      { secret: process.env.REFRESH_TOKEN_SECRET, expiresIn: refreshExpiresIn as any },
    );

    // Persist JTI so we can validate and rotate it later
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.supabase.db.from('refresh_tokens').insert({
      jti,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
    });

    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: accessExpiresIn };
  }
}
