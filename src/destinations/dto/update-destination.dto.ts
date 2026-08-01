import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const toUuid   = ({ value }: { value: any }) => value === '' || value === null ? undefined : value;
const toNumber = ({ value }: { value: any }) => value === '' || value === null ? undefined : value;
const toBool   = ({ value }: { value: any }) => {
  if (value === 'true'  || value === true)  return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class UpdateDestinationDto {
  @ApiPropertyOptional({ example: 'uuid-of-country' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'country_id must be a valid UUID.' })
  country_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-city' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'city_id must be a valid UUID.' })
  city_id?: string;

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

  @ApiPropertyOptional({ example: 'uuid-of-category' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'category_id must be a valid UUID.' })
  category_id?: string;

  @ApiPropertyOptional({ example: 'Burj Khalifa' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'burj-khalifa' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 'Burj Khalifa' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  short_name?: string;

  @ApiPropertyOptional({ example: 'The tallest building in the world.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  short_description?: string;

  @ApiPropertyOptional({ example: 'Updated description...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '1 Sheikh Mohammed bin Rashid Blvd, Dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 25.197197 })
  @Transform(toNumber)
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude must be a number.' })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 55.274376 })
  @Transform(toNumber)
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'longitude must be a number.' })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=Burj+Khalifa' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  map_url?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  opening_time?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  closing_time?: string;

  @ApiPropertyOptional({ example: 149.00 })
  @Transform(toNumber)
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'ticket_price must be a number.' })
  @Min(0)
  ticket_price?: number;

  @ApiPropertyOptional({ example: 'AED' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ example: '2-3 hours' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  duration?: string;

  @ApiPropertyOptional({ example: '+971 4 888 8888' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contact_number?: string;

  @ApiPropertyOptional({ example: 'info@burjkhalifa.ae' })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address.' })
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'https://www.burjkhalifa.ae' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ example: 0, description: 'Sort priority — lower number appears first' })
  @IsOptional()
  @Transform(toNumber)
  @Type(() => Number)
  @IsInt({ message: 'priority must be an integer.' })
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  publish_status?: boolean;
}
