import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const SORT_FIELDS = ['name', 'slug', 'created_at', 'updated_at'] as const;
const SORT_ORDERS = ['ASC', 'DESC'] as const;

export class ListCitiesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?:  number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 10;

  @IsOptional() @IsString() search?: string;

  @IsOptional() @IsUUID('all') country_id?:  string;
  @IsOptional() @IsUUID('all') module_id?:   string;
  @IsOptional() @IsUUID('all') language_id?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  publish_status?: boolean;

  @IsOptional() @IsIn(SORT_FIELDS) sortBy?:    string = 'created_at';
  @IsOptional() @IsIn(SORT_ORDERS) sortOrder?: string = 'DESC';
}
