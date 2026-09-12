import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export const ITEM_TYPES = [
  'destination', 'attraction', 'tour', 'hotel', 'restaurant', 'event', 'package',
] as const;

export type ItemType = typeof ITEM_TYPES[number];

export class CollectionItemDto {
  @ApiProperty({ example: 'destination', enum: ITEM_TYPES })
  @IsIn(ITEM_TYPES, { message: 'item_type must be one of: destination, attraction, tour, hotel, restaurant, event, package' })
  item_type: string;

  @ApiProperty({ example: 'uuid-of-the-item' })
  @IsUUID('all', { message: 'item_id must be a valid UUID.' })
  item_id: string;

  @ApiProperty({ example: 0, required: false, description: 'Display order within the collection (default 0)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class AddItemsDto {
  @ApiProperty({ type: [CollectionItemDto], description: 'Items to add to the collection. Duplicate entries (same item_type + item_id) update the sort_order.' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionItemDto)
  items: CollectionItemDto[];
}
