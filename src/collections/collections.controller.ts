import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BearerAuthGuard } from '../auth/guards/bearer-auth.guard';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { ListCollectionsDto } from './dto/list-collections.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

function groupFiles(files: any): Record<string, Express.Multer.File[]> {
  if (!Array.isArray(files)) return files ?? {};
  return (files as Express.Multer.File[]).reduce((acc, f) => {
    if (!acc[f.fieldname]) acc[f.fieldname] = [];
    acc[f.fieldname].push(f);
    return acc;
  }, {} as Record<string, Express.Multer.File[]>);
}

@ApiTags('Collections')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create collections and collection_items tables with indexes (safe to re-run)' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Collections tables migrated successfully.' } } })
  setup() {
    return this.collectionsService.setup();
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  @Get('dropdown')
  @ApiOperation({ summary: 'Lightweight dropdown — id, name, slug, thumbnail, icon, color (published only, ordered by sort_order)' })
  @ApiResponse({ status: 200, schema: { example: { success: true, data: [{ id: 'uuid', name: 'Top Destinations', slug: 'top-destinations', thumbnail: null, icon: null, color: '#0369a1' }] } } })
  dropdown() {
    return this.collectionsService.dropdown();
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new collection with optional thumbnail, banner, gallery images, and icon' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'featured', 'publish_status'],
      properties: {
        name:              { type: 'string', example: 'Top Destinations in Dubai' },
        slug:              { type: 'string', example: 'top-destinations-dubai', description: 'Auto-generated from name if omitted' },
        short_description: { type: 'string', example: 'A curated list of top destinations in Dubai.' },
        description:       { type: 'string', example: 'Detailed description of the collection...' },
        color:             { type: 'string', example: '#0369a1', description: 'Theme color hex code' },
        featured:          { type: 'boolean', example: false },
        sort_order:        { type: 'integer', example: 0, description: 'Display order — lower number appears first (default 0)' },
        publish_status:    { type: 'boolean', example: true },
        thumbnail:         { type: 'string', format: 'binary', description: 'Thumbnail image (jpg, png, webp)' },
        banner:            { type: 'string', format: 'binary', description: 'Banner image (jpg, png, webp)' },
        icon:              { type: 'string', format: 'binary', description: 'Icon image (jpg, png, webp, svg)' },
        images:            { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Gallery images (multiple)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Collection created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  create(@Body() dto: CreateCollectionDto, @UploadedFiles() files: any) {
    return this.collectionsService.create(dto, groupFiles(files));
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List collections with pagination, search, filters, and sort. Includes total_items count per collection.' })
  @ApiQuery({ name: 'page',           required: false, example: 1 })
  @ApiQuery({ name: 'limit',          required: false, example: 10 })
  @ApiQuery({ name: 'search',         required: false, example: 'dubai', description: 'Search by name, slug, or short_description' })
  @ApiQuery({ name: 'featured',       required: false, example: false })
  @ApiQuery({ name: 'publish_status', required: false, example: true })
  @ApiQuery({ name: 'sortBy',         required: false, enum: ['name', 'sort_order', 'created_at', 'updated_at'] })
  @ApiQuery({ name: 'sortOrder',      required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of collections with total_items count' })
  findAll(@Query() query: ListCollectionsDto) {
    return this.collectionsService.findAll(query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get collection by ID — full detail with parsed gallery and all collection items' })
  @ApiParam({ name: 'id', description: 'Collection UUID' })
  @ApiResponse({ status: 200, description: 'Collection detail with items array' })
  @ApiResponse({ status: 404, description: 'Collection not found' })
  findOne(@Param('id') id: string) {
    return this.collectionsService.findOne(id);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a collection — new gallery images are appended, not replaced',
    description: 'Use DELETE /api/collections/:id/gallery to remove specific gallery images. Thumbnail, banner, and icon are replaced when new files are provided.',
  })
  @ApiParam({ name: 'id', description: 'Collection UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name:              { type: 'string', example: 'Top Destinations in Dubai Updated' },
        slug:              { type: 'string', example: 'top-destinations-dubai-updated' },
        short_description: { type: 'string' },
        description:       { type: 'string' },
        color:             { type: 'string', example: '#0369a1' },
        featured:          { type: 'boolean' },
        sort_order:        { type: 'integer', example: 0 },
        publish_status:    { type: 'boolean' },
        thumbnail:         { type: 'string', format: 'binary', description: 'Replaces existing thumbnail' },
        banner:            { type: 'string', format: 'binary', description: 'Replaces existing banner' },
        icon:              { type: 'string', format: 'binary', description: 'Replaces existing icon' },
        images:            { type: 'array', items: { type: 'string', format: 'binary' }, description: 'New images appended to gallery' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Collection updated successfully' })
  @ApiResponse({ status: 404, description: 'Collection not found' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto, @UploadedFiles() files: any) {
    return this.collectionsService.update(id, dto, groupFiles(files));
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a collection (collection_items are cascade-deleted)' })
  @ApiParam({ name: 'id', description: 'Collection UUID' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Collection deleted successfully.' } } })
  @ApiResponse({ status: 404, description: 'Collection not found' })
  remove(@Param('id') id: string) {
    return this.collectionsService.remove(id);
  }

}
