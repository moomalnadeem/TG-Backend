import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebsiteAuthService } from './website-auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Website Auth')
@Controller('api/website-auth')
export class WebsiteAuthController {
  constructor(private readonly websiteAuthService: WebsiteAuthService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Migrate the users table (adds verified_at columns, makes email optional) and the OTP table' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'users table and OTP table migrated successfully.' } } })
  setup() {
    return this.websiteAuthService.setup();
  }

  // ─── Send OTP ────────────────────────────────────────────────────────────────

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a login OTP via email (ZeptoMail) or WhatsApp' })
  @ApiResponse({
    status: 200,
    schema: { example: { success: true, message: 'OTP sent to your email.', data: { expires_in: 300 } } },
  })
  @ApiResponse({ status: 400, description: 'Validation error — email or phone_number missing for the chosen channel' })
  @ApiResponse({ status: 429, description: 'OTP already sent recently — wait before requesting another' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.websiteAuthService.sendOtp(dto);
  }

  // ─── Verify OTP & Login ──────────────────────────────────────────────────────

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify the OTP and log in',
    description:
      'Creates the account (Tourist role) on first login. Returns the same token shape as /api/auth/login, ' +
      'so the tokens work directly with /api/auth/profile, /api/auth/refresh-token, and /api/auth/logout.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        message: 'Login successful.',
        data: {
          user: { id: 'uuid', username: null, name: null, email: 'john@example.com', phone_number: null, publish_status: true, is_active: true, role: { id: 'uuid', name: 'Tourist' } },
          access_token: 'eyJhbGci...',
          refresh_token: 'eyJhbGci...',
          expires_in: 3600,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or already-used OTP' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.websiteAuthService.verifyOtp(dto);
  }
}
