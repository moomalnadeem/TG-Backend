import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseService } from '../../supabase/supabase.service';

export interface JwtPayload {
  sub: string;
  email: string;
  type?: 'm2m';
}

@Injectable()
export class BearerStrategy extends PassportStrategy(Strategy, 'bearer') {
  constructor(private readonly supabase: SupabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => {
          const auth: string = req?.headers?.authorization ?? '';
          if (auth && !auth.startsWith('Bearer ')) return auth;
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type === 'm2m') {
      return { id: 'm2m', email: 'app@system', publish_status: true };
    }

    const { data: user } = await this.supabase.db
      .from('users')
      .select('id, username, name, email, role_id, publish_status, is_active')
      .eq('id', payload.sub)
      .is('deleted_at', null)
      .single();

    if (!user) throw new UnauthorizedException('Invalid token.');
    if (!user.publish_status || !user.is_active) throw new UnauthorizedException('Account is inactive.');

    return user;
  }
}
