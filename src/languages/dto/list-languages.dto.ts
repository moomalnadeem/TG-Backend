import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { DIRECTIONS } from './create-language.dto';

export class ListLanguagesDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'english', description: 'Search by name, code, locale, or native name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({ example: 'LTR', enum: DIRECTIONS })
  @IsOptional()
  @IsIn(DIRECTIONS)
  direction?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({ example: 'uuid-of-module', description: 'Filter by module UUID' })
  @IsOptional()
  @IsUUID('all')
  module_id?: string;

  @ApiPropertyOptional({ example: 'name', enum: ['name', 'code', 'direction', 'status', 'created_at'] })
  @IsOptional()
  @IsIn(['name', 'code', 'direction', 'status', 'created_at'])
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ example: 'ASC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';
}
