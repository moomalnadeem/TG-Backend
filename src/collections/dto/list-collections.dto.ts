import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const SORT_FIELDS = ['name', 'sort_order', 'created_at', 'updated_at'] as const;
const SORT_ORDERS = ['ASC', 'DESC'] as const;

export class ListCollectionsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?:  number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 10;

  @IsOptional() @IsString() search?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  publish_status?: boolean;

  @IsOptional() @IsIn(SORT_FIELDS) sortBy?:    string = 'sort_order';
  @IsOptional() @IsIn(SORT_ORDERS) sortOrder?: string = 'ASC';
}
