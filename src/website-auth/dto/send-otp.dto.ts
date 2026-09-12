import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export type OtpChannel = 'email' | 'whatsapp';

export class SendOtpDto {
  @ApiProperty({ enum: ['email', 'whatsapp'], example: 'email', description: 'Where to send the OTP' })
  @IsNotEmpty({ message: 'Channel is required.' })
  @IsIn(['email', 'whatsapp'], { message: 'Channel must be either "email" or "whatsapp".' })
  channel: OtpChannel;

  @ApiPropertyOptional({ example: 'john@example.com', description: 'Required when channel is "email"' })
  @ValidateIf((o) => o.channel === 'email')
  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Invalid email address.' })
  email?: string;

  @ApiPropertyOptional({ example: '+971501234567', description: 'Required when channel is "whatsapp" — include country code' })
  @ValidateIf((o) => o.channel === 'whatsapp')
  @IsNotEmpty({ message: 'Phone number is required.' })
  @IsString()
  phone_number?: string;
}
