import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SITEMAP_FREQUENCIES } from './create-seo.dto';

export class UpdateSeoDto {
  @ApiPropertyOptional({ example: 'Dubai Tours - Updated Title' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated meta description...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'dubai, tours, updated' })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiPropertyOptional({ example: 'https://example.com/tours/dubai' })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'canonical_url must be a valid URL.' })
  canonical_url?: string;

  @ApiPropertyOptional({ example: 0.9 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseFloat(value) : undefined))
  @Min(0)
  @Max(1)
  sitemap_priority?: number;

  @ApiPropertyOptional({ example: 'daily', enum: SITEMAP_FREQUENCIES })
  @IsOptional()
  @IsIn(SITEMAP_FREQUENCIES, { message: `sitemap_frequency must be one of: ${SITEMAP_FREQUENCIES.join(', ')}.` })
  sitemap_frequency?: string;

  @ApiPropertyOptional({ example: 'uuid-of-module' })
  @IsOptional()
  @IsUUID('all', { message: 'module_id must be a valid UUID.' })
  module_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-item' })
  @IsOptional()
  @IsUUID('all', { message: 'item_id must be a valid UUID.' })
  item_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  disable_for_bots?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  publish_status?: boolean;
}
