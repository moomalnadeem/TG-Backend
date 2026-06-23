import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseService } from '../../supabase/supabase.service';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class BearerStrategy extends PassportStrategy(Strategy, 'bearer') {
  constructor(private readonly supabase: SupabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload) {
    const { data: user, error } = await this.supabase.db
      .from('users')
      .select('id, email, first_name, last_name, is_active')
      .eq('id', payload.sub)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('Invalid token');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }

    return user;
  }
}
