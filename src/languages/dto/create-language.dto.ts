import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const DIRECTIONS = ['LTR', 'RTL'] as const;

export class CreateLanguageDto {
  @ApiProperty({ example: 'uuid-of-module', description: 'Module UUID' })
  @IsNotEmpty({ message: 'module_id is required.' })
  @IsUUID('all', { message: 'module_id must be a valid UUID.' })
  module_id: string;

  @ApiProperty({ example: 'French' })
  @IsNotEmpty({ message: 'name is required.' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'fr', description: 'ISO 639-1 language code' })
  @IsNotEmpty({ message: 'code is required.' })
  @IsString()
  @MaxLength(10)
  code: string;

  @ApiProperty({ example: 'Français', description: 'Name in native language' })
  @IsNotEmpty({ message: 'native_name is required.' })
  @IsString()
  @MaxLength(100)
  native_name: string;

  @ApiProperty({ example: 'fr-FR', description: 'Locale code' })
  @IsNotEmpty({ message: 'locale is required.' })
  @IsString()
  @MaxLength(20)
  locale: string;

  @ApiProperty({ example: 'LTR', enum: DIRECTIONS })
  @IsNotEmpty({ message: 'direction is required.' })
  @IsIn(DIRECTIONS, { message: 'direction must be LTR or RTL.' })
  direction: string;

  @ApiPropertyOptional({ example: 'https://example.com/flags/fr.png', description: 'Flag image URL' })
  @IsOptional()
  @IsString()
  flag?: string;

  @ApiPropertyOptional({ example: false, description: 'Mark as default language' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  is_default?: boolean;

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
