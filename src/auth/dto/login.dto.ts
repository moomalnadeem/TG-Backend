import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin',
    description: 'Username, email address, or phone number',
  })
  @IsNotEmpty({ message: 'Login is required.' })
  @IsString()
  login: string;

  @ApiProperty({ example: 'Password123' })
  @IsNotEmpty({ message: 'Password is required.' })
  @IsString()
  password: string;
}
