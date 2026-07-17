import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Access token is required.');
    }

    return super.canActivate(context);
  }

  handleRequest<TUser>(err: any, user: TUser, info: any): TUser {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') throw new UnauthorizedException('Token expired.');
      if (info?.name === 'JsonWebTokenError') throw new UnauthorizedException('Invalid token.');
      throw new UnauthorizedException('Unauthorized.');
    }
    return user;
  }
}
