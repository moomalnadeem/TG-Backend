import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
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

export class CreateAttractionDto {
  @ApiProperty({ example: 'uuid-of-country', description: 'Country UUID' })
  @Transform(toUuid)
  @IsNotEmpty({ message: 'country_id is required.' })
  @IsUUID('all', { message: 'country_id must be a valid UUID.' })
  country_id: string;

  @ApiProperty({ example: 'uuid-of-city', description: 'City UUID' })
  @Transform(toUuid)
  @IsNotEmpty({ message: 'city_id is required.' })
  @IsUUID('all', { message: 'city_id must be a valid UUID.' })
  city_id: string;

  @ApiProperty({ example: 'uuid-of-destination', description: 'Destination UUID' })
  @Transform(toUuid)
  @IsNotEmpty({ message: 'destination_id is required.' })
  @IsUUID('all', { message: 'destination_id must be a valid UUID.' })
  destination_id: string;

  @ApiProperty({ example: 'uuid-of-module', description: 'Module UUID' })
  @Transform(toUuid)
  @IsNotEmpty({ message: 'module_id is required.' })
  @IsUUID('all', { message: 'module_id must be a valid UUID.' })
  module_id: string;

  @ApiPropertyOptional({ example: 'uuid-of-collection', description: 'Collection UUID' })
  @Transform(toUuid)
  @IsOptional()
  @IsUUID('all', { message: 'collection_id must be a valid UUID.' })
  collection_id?: string;

  @ApiProperty({ example: 'Burj Khalifa' })
  @IsNotEmpty({ message: 'name is required.' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'burj-khalifa', description: 'Auto-generated from name if omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 'Burj', description: 'Short display name' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  short_name?: string;

  @ApiPropertyOptional({ example: 'Observation Tower', description: 'Museum, Park, Beach, Heritage, etc.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  attraction_type?: string;

  @ApiPropertyOptional({ example: 'The tallest building in the world.' })
  @IsOptional()
  @IsString()
  short_description?: string;

  @ApiPropertyOptional({ example: 'Detailed description of the attraction...' })
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

  @ApiProperty({ example: true, description: 'Publish status' })
  @Transform(toBool)
  @IsBoolean({ message: 'publish_status must be a boolean.' })
  publish_status: boolean;
}
