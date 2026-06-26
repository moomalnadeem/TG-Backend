import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class BearerAuthGuard extends AuthGuard('bearer') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Access token is required');
    }

    return super.canActivate(context);
  }

  handleRequest<TUser>(err: any, user: TUser, info: any): TUser {
    if (err || !user) {
      const message = this.resolveErrorMessage(info);
      throw new UnauthorizedException(message);
    }
    return user;
  }

  private resolveErrorMessage(info: any): string {
    if (!info) return 'Unauthorized';
    if (info.name === 'TokenExpiredError') return 'Token expired';
    if (info.name === 'JsonWebTokenError') return 'Invalid token';
    return 'Unauthorized';
  }
}
