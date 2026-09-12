import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateModuleDto {
  @ApiPropertyOptional({ example: 'Products Updated', description: 'Module name (max 255 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Module name must not exceed 255 characters.' })
  module_name?: string;

  @ApiPropertyOptional({ example: 'products-updated', description: 'Unique alias / short key (max 100 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Alias must not exceed 100 characters.' })
  alias?: string;

  @ApiPropertyOptional({ example: true, description: 'Active (true) / Inactive (false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'Publish status must be a boolean.' })
  publish_status?: boolean;
}
