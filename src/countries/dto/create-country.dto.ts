import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCountryDto {
  @ApiPropertyOptional({ example: 'uuid-of-module', description: 'Module UUID' })
  @IsOptional()
  @IsUUID('all', { message: 'module_id must be a valid UUID.' })
  module_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-language', description: 'Language UUID' })
  @IsOptional()
  @IsUUID('all', { message: 'language_id must be a valid UUID.' })
  language_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-seo', description: 'SEO record UUID' })
  @IsOptional()
  @IsUUID('all', { message: 'seo_id must be a valid UUID.' })
  seo_id?: string;

  @IsNotEmpty({ message: 'name is required.' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'AE', description: 'ISO 3166-1 alpha-2 code' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  iso2?: string;

  @ApiPropertyOptional({ example: 'ARE', description: 'ISO 3166-1 alpha-3 code' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  iso3?: string;

  @ApiPropertyOptional({ example: '+971', description: 'International phone dial code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  phone_code?: string;

  @ApiPropertyOptional({ example: 'UAE Dirham', description: 'Currency name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  currency?: string;

  @ApiPropertyOptional({ example: 'AED', description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string;

  @ApiPropertyOptional({ example: 'Abu Dhabi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  capital?: string;

  @ApiPropertyOptional({ example: 'Asia' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  continent?: string;

  @ApiPropertyOptional({ example: 'Emirati' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @ApiPropertyOptional({ example: 'Asia/Dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({ example: 'A short description of the country.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, description: 'Publish status' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  publish_status?: boolean;
}
