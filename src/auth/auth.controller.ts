import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AppTokenDto } from './dto/app-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Signup ──────────────────────────────────────────────────────────────────

  @Post('signup')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'User Signup — register with role, auto-login returns tokens' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email', 'password', 'confirm_password', 'role_id'],
      properties: {
        name:             { type: 'string', example: 'John Doe' },
        email:            { type: 'string', format: 'email', example: 'john@example.com' },
        password:         { type: 'string', example: 'Password123', minLength: 6 },
        confirm_password: { type: 'string', example: 'Password123' },
        role_id:          { type: 'string', format: 'uuid', example: 'uuid-of-role', description: 'Role assigned to this user' },
        username:         { type: 'string', example: 'johndoe', description: 'Optional — unique username' },
        phone_number:     { type: 'string', example: '+971501234567', description: 'Optional — unique phone number' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        success: true,
        message: 'Account created successfully.',
        data: {
          user: { id: 'uuid', name: 'John Doe', email: 'john@example.com', role: { id: 'uuid', name: 'Tourist' } },
          access_token: 'eyJhbGci...',
          refresh_token: 'eyJhbGci...',
          expires_in: 3600,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Passwords do not match or validation error' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 409, description: 'Email, username, or phone number already in use' })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Admin Login — accepts username, email address, or phone number + password' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['login', 'password'],
      properties: {
        login:    { type: 'string', example: 'admin', description: 'Username, email, or phone number' },
        password: { type: 'string', example: 'Password123' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        message: 'Login successful.',
        data: {
          user: { id: 'uuid', username: 'admin', name: 'System Administrator', email: 'admin@example.com', role_id: 'uuid' },
          access_token: 'eyJhbGci...',
          refresh_token: 'eyJhbGci...',
          expires_in: 3600,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account inactive' })
  login(@Body() dto: LoginDto) {
    return this.authService.adminLogin(dto);
  }

  // ─── Refresh Token ───────────────────────────────────────────────────────────

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Refresh access token — rotates the refresh token on each call' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refresh_token'],
      properties: {
        refresh_token: { type: 'string', description: 'Refresh token received at login' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        message: 'Token refreshed successfully.',
        data: { access_token: 'eyJhbGci...', refresh_token: 'eyJhbGci...', expires_in: 3600 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto);
  }

  // ─── Profile ─────────────────────────────────────────────────────────────────

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get logged-in admin profile' })
  @ApiResponse({ status: 200, description: 'Admin user profile with role' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Logout — clears stored refresh token, ending the session' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Logout successful.' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  logout(@Req() req: any) {
    return this.authService.logout(req.user.id);
  }

  // ─── Change Password ─────────────────────────────────────────────────────────

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Change password — requires current password for verification' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['current_password', 'new_password', 'confirm_password'],
      properties: {
        current_password:  { type: 'string', example: 'OldPassword123' },
        new_password:      { type: 'string', example: 'NewPassword456', minLength: 6 },
        confirm_password:  { type: 'string', example: 'NewPassword456' },
      },
    },
  })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Password changed successfully.' } } })
  @ApiResponse({ status: 400, description: 'Passwords do not match' })
  @ApiResponse({ status: 401, description: 'Unauthorized or wrong current password' })
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto);
  }

  // ─── Forgot Password ─────────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Forgot Password — future-ready; returns generic response regardless of account existence' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['login'],
      properties: {
        login: { type: 'string', example: 'admin@example.com', description: 'Email address or phone number' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        message: 'If this account exists, password reset instructions have been sent.',
      },
    },
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // ─── M2M App Token ───────────────────────────────────────────────────────────

  @Post('app-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Machine-to-Machine token — get a JWT using APP_SECRET (no user login required)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['app_secret'],
      properties: {
        app_secret: { type: 'string', example: 'your-app-secret' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    schema: { example: { success: true, data: { access_token: 'eyJhbGci...', token_type: 'Bearer', expires_in: '1h' } } },
  })
  @ApiResponse({ status: 401, description: 'Invalid app secret' })
  appToken(@Body() dto: AppTokenDto) {
    return this.authService.appToken(dto);
  }
}
