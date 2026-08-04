import {
  BadRequestException,
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
import { AttractionsService } from './attractions.service';
import { CreateAttractionDto } from './dto/create-attraction.dto';
import { ListAttractionsDto } from './dto/list-attractions.dto';
import { UpdateAttractionDto } from './dto/update-attraction.dto';

function groupFiles(files: any): Record<string, Express.Multer.File[]> {
  if (!Array.isArray(files)) return files ?? {};
  return (files as Express.Multer.File[]).reduce((acc, f) => {
    if (!acc[f.fieldname]) acc[f.fieldname] = [];
    acc[f.fieldname].push(f);
    return acc;
  }, {} as Record<string, Express.Multer.File[]>);
}

@ApiTags('Attractions')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/attractions')
export class AttractionsController {
  constructor(private readonly attractionsService: AttractionsService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create attractions table with indexes (safe to re-run)' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Attractions table migrated successfully.' } } })
  setup() {
    return this.attractionsService.setup();
  }

  // ─── Seed ────────────────────────────────────────────────────────────────────

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Seed 15 real Dubai attractions across 5 destinations (safe to re-run — skips existing)',
    description: 'Requires UAE country and Dubai city to already exist. Also seeds 5 Dubai destinations (Downtown Dubai, Deira, Jumeirah, Dubai Marina, Palm Jumeirah) if missing.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        message: 'Dubai attractions seed completed. 15 inserted, 0 skipped (already exist or error).',
        inserted: 15,
        skipped: 0,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'UAE country, Dubai city, or modules not found' })
  seed() {
    return this.attractionsService.seed();
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  @Get('dropdown')
  @ApiOperation({ summary: 'Lightweight dropdown — id, name, slug, attraction_type (published only, ordered by name)' })
  @ApiQuery({ name: 'country_id',    required: false, description: 'Filter by country UUID' })
  @ApiQuery({ name: 'city_id',       required: false, description: 'Filter by city UUID' })
  @ApiQuery({ name: 'destination_id', required: false, description: 'Filter by destination UUID' })
  @ApiResponse({ status: 200, schema: { example: { success: true, data: [{ id: 'uuid', name: 'Burj Khalifa', slug: 'burj-khalifa', attraction_type: 'Observation Tower' }] } } })
  dropdown(
    @Query('country_id')    country_id?: string,
    @Query('city_id')       city_id?: string,
    @Query('destination_id') destination_id?: string,
  ) {
    return this.attractionsService.dropdown(country_id, city_id, destination_id);
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new attraction with optional thumbnail, banner, and gallery images' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['country_id', 'city_id', 'destination_id', 'module_id', 'name', 'publish_status'],
      properties: {
        country_id:       { type: 'string', format: 'uuid', example: 'uuid-of-country' },
        city_id:          { type: 'string', format: 'uuid', example: 'uuid-of-city' },
        destination_id:   { type: 'string', format: 'uuid', example: 'uuid-of-destination' },
        module_id:        { type: 'string', format: 'uuid', example: 'uuid-of-module' },
        collection_id:    { type: 'string', format: 'uuid', example: 'uuid-of-collection' },
        name:             { type: 'string', example: 'Burj Khalifa' },
        slug:             { type: 'string', example: 'burj-khalifa', description: 'Auto-generated from name if omitted' },
        short_name:       { type: 'string', example: 'Burj' },
        attraction_type:  { type: 'string', example: 'Observation Tower', description: 'Museum, Park, Beach, Heritage, etc.' },
        short_description: { type: 'string', example: 'The tallest building in the world.' },
        description:      { type: 'string', example: 'Detailed description...' },
        address:          { type: 'string', example: '1 Sheikh Mohammed bin Rashid Blvd, Dubai' },
        latitude:         { type: 'number', example: 25.197197 },
        longitude:        { type: 'number', example: 55.274376 },
        google_map_url:   { type: 'string', example: 'https://maps.google.com/?q=Burj+Khalifa' },
        opening_time:     { type: 'string', example: '09:00' },
        closing_time:     { type: 'string', example: '22:00' },
        ticket_price:     { type: 'number', example: 149.00 },
        currency:         { type: 'string', example: 'AED' },
        duration:         { type: 'string', example: '2-3 hours' },
        contact_number:   { type: 'string', example: '+971 4 888 8888' },
        email:            { type: 'string', example: 'info@burjkhalifa.ae' },
        featured:         { type: 'boolean', example: false },
        publish_status:   { type: 'boolean', example: true },
        thumbnail:        { type: 'string', format: 'binary', description: 'Thumbnail image (jpg, png, webp)' },
        banner:           { type: 'string', format: 'binary', description: 'Banner image (jpg, png, webp)' },
        images:           { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Gallery images (multiple)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Attraction created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Country, city, destination, or module not found' })
  @ApiResponse({ status: 409, description: 'Slug or attraction name in this destination already exists' })
  create(@Body() dto: CreateAttractionDto, @UploadedFiles() files: any) {
    return this.attractionsService.create(dto, groupFiles(files));
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List attractions with pagination, search, filters, and sort' })
  @ApiQuery({ name: 'page',           required: false, example: 1 })
  @ApiQuery({ name: 'limit',          required: false, example: 10 })
  @ApiQuery({ name: 'search',         required: false, example: 'burj', description: 'Search by name, slug, attraction_type, address, or short_description' })
  @ApiQuery({ name: 'country_id',     required: false, description: 'Filter by country UUID' })
  @ApiQuery({ name: 'city_id',        required: false, description: 'Filter by city UUID' })
  @ApiQuery({ name: 'destination_id', required: false, description: 'Filter by destination UUID' })
  @ApiQuery({ name: 'module_id',      required: false, description: 'Filter by module UUID' })
  @ApiQuery({ name: 'collection_id',  required: false, description: 'Filter by collection UUID' })
  @ApiQuery({ name: 'attraction_type', required: false, example: 'Museum', description: 'Filter by attraction type (partial match)' })
  @ApiQuery({ name: 'featured',       required: false, example: false })
  @ApiQuery({ name: 'publish_status', required: false, example: true })
  @ApiQuery({ name: 'sortBy',         required: false, enum: ['name', 'attraction_type', 'ticket_price', 'featured', 'publish_status', 'created_at', 'updated_at'] })
  @ApiQuery({ name: 'sortOrder',      required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of attractions with relations' })
  findAll(@Query() query: ListAttractionsDto) {
    return this.attractionsService.findAll(query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get attraction by ID — full detail with parsed gallery and relations' })
  @ApiParam({ name: 'id', description: 'Attraction UUID' })
  @ApiResponse({ status: 200, description: 'Attraction detail' })
  @ApiResponse({ status: 404, description: 'Attraction not found' })
  findOne(@Param('id') id: string) {
    return this.attractionsService.findOne(id);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update an attraction — new gallery images are appended, not replaced',
    description: 'Use DELETE /api/attractions/:id/gallery to remove specific gallery images. Thumbnail and banner are replaced when new files are provided.',
  })
  @ApiParam({ name: 'id', description: 'Attraction UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        country_id:       { type: 'string', format: 'uuid' },
        city_id:          { type: 'string', format: 'uuid' },
        destination_id:   { type: 'string', format: 'uuid' },
        module_id:        { type: 'string', format: 'uuid' },
        collection_id:    { type: 'string', format: 'uuid' },
        name:             { type: 'string', example: 'Burj Khalifa Updated' },
        slug:             { type: 'string', example: 'burj-khalifa-updated' },
        short_name:       { type: 'string', example: 'Burj' },
        attraction_type:  { type: 'string', example: 'Observation Tower' },
        short_description: { type: 'string' },
        description:      { type: 'string' },
        address:          { type: 'string' },
        latitude:         { type: 'number' },
        longitude:        { type: 'number' },
        google_map_url:   { type: 'string' },
        opening_time:     { type: 'string', example: '09:00' },
        closing_time:     { type: 'string', example: '22:00' },
        ticket_price:     { type: 'number' },
        currency:         { type: 'string', example: 'AED' },
        duration:         { type: 'string' },
        contact_number:   { type: 'string' },
        email:            { type: 'string' },
        featured:         { type: 'boolean' },
        publish_status:   { type: 'boolean' },
        thumbnail:        { type: 'string', format: 'binary', description: 'Replaces existing thumbnail' },
        banner:           { type: 'string', format: 'binary', description: 'Replaces existing banner' },
        images:           { type: 'array', items: { type: 'string', format: 'binary' }, description: 'New images appended to gallery' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Attraction updated successfully' })
  @ApiResponse({ status: 404, description: 'Attraction not found' })
  @ApiResponse({ status: 409, description: 'Slug or attraction name in this destination already exists' })
  update(@Param('id') id: string, @Body() dto: UpdateAttractionDto, @UploadedFiles() files: any) {
    return this.attractionsService.update(id, dto, groupFiles(files));
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete an attraction' })
  @ApiParam({ name: 'id', description: 'Attraction UUID' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Attraction deleted successfully.' } } })
  @ApiResponse({ status: 404, description: 'Attraction not found' })
  remove(@Param('id') id: string) {
    return this.attractionsService.remove(id);
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  @Post(':id/gallery')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add images to attraction gallery' })
  @ApiParam({ name: 'id', description: 'Attraction UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['images'],
      properties: {
        images: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Images to add to gallery' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Gallery images added — returns updated images array' })
  @ApiResponse({ status: 404, description: 'Attraction not found' })
  addGallery(@Param('id') id: string, @UploadedFiles() files: any) {
    const grouped    = groupFiles(files);
    const imageFiles = grouped?.images ?? [];
    return this.attractionsService.addGalleryImages(id, imageFiles);
  }

  // ─── Gallery: Remove Image ────────────────────────────────────────────────────

  @Delete(':id/gallery')
  @ApiOperation({ summary: 'Remove a specific image from attraction gallery by URL' })
  @ApiParam({ name: 'id', description: 'Attraction UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image_url'],
      properties: {
        image_url: { type: 'string', example: 'https://...supabase.co/storage/v1/object/public/bucket/attn-images/image.jpg' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Image removed — returns updated images array' })
  @ApiResponse({ status: 404, description: 'Attraction not found' })
  removeGalleryImage(
    @Param('id') id: string,
    @Body('image_url') imageUrl: string,
  ) {
    if (!imageUrl) throw new BadRequestException('image_url is required.');
    return this.attractionsService.removeGalleryImage(id, imageUrl);
  }
}
