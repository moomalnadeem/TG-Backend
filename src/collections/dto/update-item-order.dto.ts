import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class ItemOrderDto {
  @ApiProperty({ example: 'uuid-of-collection-item', description: 'collection_items row ID (not the item_id)' })
  @IsUUID('all', { message: 'id must be a valid UUID.' })
  id: string;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order: number;
}

export class UpdateItemOrderDto {
  @ApiProperty({ type: [ItemOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemOrderDto)
  items: ItemOrderDto[];
}
