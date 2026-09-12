import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Length } from 'class-validator';
import { SendOtpDto } from './send-otp.dto';

export class VerifyOtpDto extends SendOtpDto {
  @ApiProperty({ example: '123456', description: '6-digit code sent to the selected channel' })
  @IsNotEmpty({ message: 'OTP is required.' })
  @Length(6, 6, { message: 'OTP must be 6 digits.' })
  otp: string;
}
