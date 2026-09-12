import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const SORT_FIELDS = ['name', 'attraction_type', 'ticket_price', 'featured', 'publish_status', 'created_at', 'updated_at'];

export class ListAttractionsDto {
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('all')
  country_id?: string;

  @IsOptional()
  @IsUUID('all')
  city_id?: string;

  @IsOptional()
  @IsUUID('all')
  destination_id?: string;

  @IsOptional()
  @IsUUID('all')
  module_id?: string;

  @IsOptional()
  @IsUUID('all')
  collection_id?: string;

  @IsOptional()
  @IsString()
  attraction_type?: string;

  @Transform(({ value }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @Transform(({ value }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  publish_status?: boolean;

  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortBy?: string = 'created_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
