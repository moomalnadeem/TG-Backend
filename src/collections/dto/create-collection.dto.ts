import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const toNumber = ({ value }: { value: any }) =>
  value === '' || value === null ? undefined : value;

const toBool = ({ value }: { value: any }) => {
  if (value === 'true'  || value === true)  return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class CreateCollectionDto {
  @ApiProperty({ example: 'Top Destinations in Dubai' })
  @IsNotEmpty({ message: 'name is required.' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'top-destinations-dubai', description: 'Auto-generated from name if omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 'A curated list of top destinations in Dubai.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  short_description?: string;

  @ApiPropertyOptional({ example: 'Detailed description of the collection...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#0369a1', description: 'Theme color hex code' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiProperty({ example: false, description: 'Featured collection' })
  @Transform(toBool)
  @IsBoolean({ message: 'featured must be a boolean.' })
  featured: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Display order — lower number appears first (default 0)' })
  @IsOptional()
  @Transform(toNumber)
  @Type(() => Number)
  @IsInt({ message: 'sort_order must be an integer.' })
  @Min(0)
  sort_order?: number;

  @ApiProperty({ example: true, description: 'Publish status' })
  @Transform(toBool)
  @IsBoolean({ message: 'publish_status must be a boolean.' })
  publish_status: boolean;
}
