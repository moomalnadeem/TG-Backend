import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Email address or phone number associated with the account',
  })
  @IsNotEmpty({ message: 'Login is required.' })
  @IsString()
  login: string;
}
