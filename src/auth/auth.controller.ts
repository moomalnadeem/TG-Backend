import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AppTokenDto } from './dto/app-token.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login — returns access token + refresh token' })
  @ApiResponse({ status: 200, description: 'Returns token pair' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh tokens — old refresh token is invalidated, new pair issued' })
  @ApiResponse({ status: 200, description: 'Returns new token pair' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout — invalidates the refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Post('app-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Machine-to-Machine token — get a JWT using APP_SECRET (no user login required)',
    description: 'Use this from your Next.js server to obtain a JWT for calling protected APIs. Re-call when the token expires.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a short-lived access token',
    schema: {
      example: {
        accessToken: 'eyJhbGci...',
        tokenType: 'Bearer',
        expiresIn: '1h',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid app secret' })
  appToken(@Body() dto: AppTokenDto) {
    return this.authService.appToken(dto);
  }
}
