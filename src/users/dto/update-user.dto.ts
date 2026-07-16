import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'johndoe_updated' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Username must not exceed 100 characters.' })
  username?: string;

  @ApiPropertyOptional({ example: 'John Doe Updated' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'john.updated@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address.' })
  email?: string;

  @ApiPropertyOptional({ example: 'uuid-of-role' })
  @IsOptional()
  @IsUUID('all', { message: 'role_id must be a valid UUID.' })
  role_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-module' })
  @IsOptional()
  @IsUUID('all', { message: 'module_type_id must be a valid UUID.' })
  module_type_id?: string;

  @ApiPropertyOptional({ example: 'Updated bio.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters.' })
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'Publish status must be a boolean.' })
  publish_status?: boolean;
}
