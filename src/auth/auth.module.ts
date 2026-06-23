import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BearerAuthGuard } from './guards/bearer-auth.guard';
import { BearerStrategy } from './strategies/bearer.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, BearerStrategy, BearerAuthGuard],
  exports: [BearerAuthGuard, JwtModule],
})
export class AuthModule {}
