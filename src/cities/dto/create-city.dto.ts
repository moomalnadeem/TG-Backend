import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const toUuid = ({ value }: { value: any }) =>
  value === '' || value === null ? undefined : value;

export class CreateCityDto {
  @ApiProperty({ example: 'uuid-of-country', description: 'Country UUID' })
  @Transform(toUuid)
  @IsNotEmpty({ message: 'country_id is required.' })
  @IsUUID('all', { message: 'country_id must be a valid UUID.' })
  country_id: string;

  @ApiProperty({ example: 'uuid-of-module', description: 'Module UUID' })
  @Transform(toUuid)
  @IsNotEmpty({ message: 'module_id is required.' })
  @IsUUID('all', { message: 'module_id must be a valid UUID.' })
  module_id: string;

  @ApiPropertyOptional({ example: 'uuid-of-language', description: 'Language UUID' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'language_id must be a valid UUID.' })
  language_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-seo', description: 'SEO record UUID' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'seo_id must be a valid UUID.' })
  seo_id?: string;

  @ApiProperty({ example: 'Dubai' })
  @IsNotEmpty({ message: 'name is required.' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'dubai', description: 'Auto-generated from name if omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 'DXB', description: 'Short name or abbreviation' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  short_name?: string;

  @ApiPropertyOptional({ example: 'DXB', description: 'City code' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: 'A vibrant city in the UAE.', description: 'Max 5000 characters' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ example: true, description: 'Publish status' })
  @Transform(({ value }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'publish_status must be a boolean.' })
  publish_status: boolean;
}
