import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ example: 'Products', description: 'Unique module name (max 255 chars)' })
  @IsNotEmpty({ message: 'Module name is required.' })
  @IsString()
  @MaxLength(255, { message: 'Module name must not exceed 255 characters.' })
  module_name: string;

  @ApiPropertyOptional({ example: 'products', description: 'Unique alias / short key (max 100 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Alias must not exceed 100 characters.' })
  alias?: string;

  @ApiProperty({ example: true, description: 'Active (true) / Inactive (false)' })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsNotEmpty({ message: 'Publish status is required.' })
  @IsBoolean({ message: 'Publish status must be a boolean.' })
  publish_status: boolean;
}
