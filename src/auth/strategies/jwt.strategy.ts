import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseService } from '../../supabase/supabase.service';

export interface AdminJwtPayload {
  sub: string;
  username?: string;
  email: string;
  role_id?: string;
  type?: 'm2m';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly supabase: SupabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: AdminJwtPayload) {
    if (payload.type === 'm2m') {
      return { id: 'm2m', email: 'app@system', publish_status: true };
    }

    const { data: user } = await this.supabase.db
      .from('users')
      .select('id, username, name, email, phone_number, role_id, publish_status, is_active')
      .eq('id', payload.sub)
      .is('deleted_at', null)
      .single();

    if (!user) throw new UnauthorizedException('Invalid token.');
    if (!user.publish_status || !user.is_active) throw new UnauthorizedException('Account is inactive.');

    return user;
  }
}
