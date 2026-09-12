import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'uuid-of-module' })
  @IsOptional()
  @IsUUID('all', { message: 'module_id must be a valid UUID.' })
  module_id?: string;

  @ApiPropertyOptional({ example: 'Acme Corp Updated' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'acme-corp-updated' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 'info@acme.com' })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address.' })
  email?: string;

  @ApiPropertyOptional({ example: '+971501234567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'website must be a valid URL.' })
  website?: string;

  @ApiPropertyOptional({ example: 'Updated description.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '456 New Street' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'uuid-of-country' })
  @IsOptional()
  @IsUUID('all', { message: 'country_id must be a valid UUID.' })
  country_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-city' })
  @IsOptional()
  @IsUUID('all', { message: 'city_id must be a valid UUID.' })
  city_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-language' })
  @IsOptional()
  @IsUUID('all', { message: 'language_id must be a valid UUID.' })
  language_id?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  status?: boolean;
}
