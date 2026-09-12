import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const toUuid = ({ value }: { value: any }) =>
  value === '' || value === null ? undefined : value;

export class UpdateCountryDto {
  @ApiPropertyOptional({ example: 'uuid-of-module' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'module_id must be a valid UUID.' })
  module_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-language' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'language_id must be a valid UUID.' })
  language_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-seo' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'seo_id must be a valid UUID.' })
  seo_id?: string;

  @ApiPropertyOptional({ example: 'United Arab Emirates' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'AE' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  iso2?: string;

  @ApiPropertyOptional({ example: 'ARE' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  iso3?: string;

  @ApiPropertyOptional({ example: '+971' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  phone_code?: string;

  @ApiPropertyOptional({ example: 'UAE Dirham' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  currency?: string;

  @ApiPropertyOptional({ example: 'AED' })
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

  @ApiPropertyOptional({ example: 'Updated description.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  publish_status?: boolean;
}
