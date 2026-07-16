import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'johndoe', description: 'Unique username (max 100 chars)' })
  @IsNotEmpty({ message: 'Username is required.' })
  @IsString()
  @MaxLength(100, { message: 'Username must not exceed 100 characters.' })
  username: string;

  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsNotEmpty({ message: 'Name is required.' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Invalid email address.' })
  email: string;

  @ApiProperty({ example: 'uuid-of-role', description: 'Role ID (UUID)' })
  @IsNotEmpty({ message: 'Role is required.' })
  @IsUUID('all', { message: 'role_id must be a valid UUID.' })
  role_id: string;

  @ApiProperty({ example: 'uuid-of-module', description: 'Module Type ID (UUID)' })
  @IsNotEmpty({ message: 'Module type is required.' })
  @IsUUID('all', { message: 'module_type_id must be a valid UUID.' })
  module_type_id: string;

  @ApiPropertyOptional({ example: 'uuid-of-seo', description: 'SEO Profile ID (UUID)' })
  @IsOptional()
  @IsUUID('all', { message: 'seo_id must be a valid UUID.' })
  seo_id?: string;

  @ApiPropertyOptional({ example: 'A short bio about this user.', description: 'Max 5000 chars' })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters.' })
  description?: string;

  @ApiProperty({ example: true, description: 'Active (true) / Inactive (false)' })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsNotEmpty({ message: 'Publish status is required.' })
  @IsBoolean({ message: 'Publish status must be a boolean.' })
  publish_status: boolean;
}
