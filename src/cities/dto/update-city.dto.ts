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

export class UpdateCityDto {
  @ApiPropertyOptional({ example: 'uuid-of-country' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'country_id must be a valid UUID.' })
  country_id?: string;

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

  @ApiPropertyOptional({ example: 'Dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 'DXB' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  short_name?: string;

  @ApiPropertyOptional({ example: 'DXB' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: 'Updated description.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
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
