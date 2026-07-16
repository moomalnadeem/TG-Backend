import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ListUsersDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'john', description: 'Search by username, name, email, role name, or module name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'uuid-of-role', description: 'Filter by role ID' })
  @IsOptional()
  @IsUUID()
  role_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-module', description: 'Filter by module type ID' })
  @IsOptional()
  @IsUUID()
  module_type_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-seo', description: 'Filter by SEO profile ID' })
  @IsOptional()
  @IsUUID()
  seo_id?: string;

  @ApiPropertyOptional({ example: true, description: 'Filter by publish status' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  publish_status?: boolean;

  @ApiPropertyOptional({
    example: 'created_at',
    enum: ['username', 'name', 'email', 'created_at', 'updated_at'],
    default: 'created_at',
  })
  @IsOptional()
  @IsIn(['username', 'name', 'email', 'created_at', 'updated_at'])
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ example: 'DESC', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
