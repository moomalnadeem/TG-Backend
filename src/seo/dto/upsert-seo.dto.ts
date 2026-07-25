import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SITEMAP_FREQUENCIES } from './create-seo.dto';

export class UpsertSeoDto {
  @ApiProperty({ example: 'Dubai Tours - Best Sightseeing Packages', maxLength: 255 })
  @IsNotEmpty({ message: 'Title is required.' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Explore Dubai with our top-rated tour packages...' })
  @IsNotEmpty({ message: 'Description is required.' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'dubai, tours, travel', description: 'Comma-separated keywords' })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiPropertyOptional({ example: 'https://example.com/tours/dubai' })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'canonical_url must be a valid URL.' })
  canonical_url?: string;

  @ApiPropertyOptional({ example: 0.8, description: 'Sitemap priority between 0.0 and 1.0' })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseFloat(value) : undefined))
  @Min(0, { message: 'sitemap_priority must be at least 0.0.' })
  @Max(1, { message: 'sitemap_priority must not exceed 1.0.' })
  sitemap_priority?: number;

  @ApiProperty({ example: 'weekly', enum: SITEMAP_FREQUENCIES })
  @IsNotEmpty({ message: 'Sitemap frequency is required.' })
  @IsIn(SITEMAP_FREQUENCIES, { message: `sitemap_frequency must be one of: ${SITEMAP_FREQUENCIES.join(', ')}.` })
  sitemap_frequency: string;

  @ApiProperty({ example: 'uuid-of-module', description: 'Module UUID' })
  @IsNotEmpty({ message: 'Module is required.' })
  @IsUUID('all', { message: 'module_id must be a valid UUID.' })
  module_id: string;

  @ApiPropertyOptional({ example: false, description: 'Enable NoIndex / NoFollow for bots' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  disable_for_bots?: boolean;

  @ApiProperty({ example: true, description: 'Active (true) / Inactive (false)' })
  @IsNotEmpty({ message: 'Publish status is required.' })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'publish_status must be a boolean.' })
  publish_status: boolean;
}
