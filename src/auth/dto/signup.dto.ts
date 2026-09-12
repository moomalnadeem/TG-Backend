import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsNotEmpty({ message: 'Name is required.' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Invalid email address.' })
  email: string;

  @ApiProperty({ example: 'Password123', minLength: 6 })
  @IsNotEmpty({ message: 'Password is required.' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  password: string;

  @ApiProperty({ example: 'Password123' })
  @IsNotEmpty({ message: 'Confirm password is required.' })
  @IsString()
  confirm_password: string;

  @ApiProperty({ example: 'uuid-of-role', description: 'Role UUID — determines user permissions' })
  @IsNotEmpty({ message: 'Role is required.' })
  @IsUUID('all', { message: 'role_id must be a valid UUID.' })
  role_id: string;

  @ApiPropertyOptional({ example: 'johndoe', description: 'Unique username (max 100 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({ example: '+971501234567', description: 'Unique phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone_number?: string;
}
