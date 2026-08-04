import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const toUuid   = ({ value }: { value: any }) => (value === '' || value === null ? undefined : value);
const toNumber = ({ value }: { value: any }) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = Number(value);
  return isNaN(n) ? value : n;
};
const toBool = ({ value }: { value: any }) => {
  if (value === 'true'  || value === true)  return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class UpdateAttractionDto {
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

  @ApiPropertyOptional({ example: 'uuid-of-destination' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'destination_id must be a valid UUID.' })
  destination_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-module' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'module_id must be a valid UUID.' })
  module_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-collection' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'collection_id must be a valid UUID.' })
  collection_id?: string;

  @ApiPropertyOptional({ example: 'Burj Khalifa Updated' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'burj-khalifa-updated' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 'Burj' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  short_name?: string;

  @ApiPropertyOptional({ example: 'Observation Tower' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  attraction_type?: string;

  @ApiPropertyOptional({ example: 'Updated summary.' })
  @IsOptional()
  @IsString()
  short_description?: string;

  @ApiPropertyOptional({ example: 'Updated detailed description.' })
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
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 55.274376 })
  @Transform(toNumber)
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=Burj+Khalifa' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  google_map_url?: string;

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
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
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

  @ApiPropertyOptional({ example: false })
  @Transform(toBool)
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ example: true })
  @Transform(toBool)
  @IsOptional()
  @IsBoolean()
  publish_status?: boolean;
}
