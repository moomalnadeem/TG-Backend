import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ListOrganizationsDto {
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

  @ApiPropertyOptional({ example: 'acme', description: 'Search by name, slug, email, phone, or address' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'uuid-of-module' })
  @IsOptional()
  @IsUUID('all')
  module_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-country' })
  @IsOptional()
  @IsUUID('all')
  country_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-city' })
  @IsOptional()
  @IsUUID('all')
  city_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-language' })
  @IsOptional()
  @IsUUID('all')
  language_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional({ example: 'name', enum: ['name', 'email', 'created_at', 'updated_at'] })
  @IsOptional()
  @IsIn(['name', 'email', 'created_at', 'updated_at'])
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ example: 'ASC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
