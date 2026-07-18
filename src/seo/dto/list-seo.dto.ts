import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ListSeoDto {
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

  @ApiPropertyOptional({ example: 'dubai', description: 'Search by title, description, or keywords' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'uuid-of-module', description: 'Filter by module UUID' })
  @IsOptional()
  @IsUUID()
  module_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  publish_status?: boolean;

  @ApiPropertyOptional({ example: 'title', enum: ['title', 'created_at', 'updated_at'], default: 'created_at' })
  @IsOptional()
  @IsIn(['title', 'created_at', 'updated_at'])
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ example: 'DESC', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
