import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
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

export class UpdateCollectionDto {
  @ApiPropertyOptional({ example: 'Top Destinations in Dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'top-destinations-dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 'A curated list of top destinations in Dubai.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  short_description?: string;

  @ApiPropertyOptional({ example: 'Updated description...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#0369a1', description: 'Theme color hex code' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(toNumber)
  @Type(() => Number)
  @IsInt({ message: 'sort_order must be an integer.' })
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  publish_status?: boolean;
}
