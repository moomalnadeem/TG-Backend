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
import { DestinationsService } from './destinations.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { ListDestinationsDto } from './dto/list-destinations.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

function groupFiles(files: any): Record<string, Express.Multer.File[]> {
  if (!Array.isArray(files)) return files ?? {};
  return (files as Express.Multer.File[]).reduce((acc, f) => {
    if (!acc[f.fieldname]) acc[f.fieldname] = [];
    acc[f.fieldname].push(f);
    return acc;
  }, {} as Record<string, Express.Multer.File[]>);
}

@ApiTags('Destinations')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/destinations')
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create destinations table and indexes (safe to re-run)' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Destinations table migrated successfully.' } } })
  setup() {
    return this.destinationsService.setup();
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  @Get('dropdown')
  @ApiOperation({ summary: 'Destinations dropdown — id, name, slug. Filter by country_id and/or city_id.' })
  @ApiQuery({ name: 'country_id', required: false, description: 'Filter by country UUID' })
  @ApiQuery({ name: 'city_id',    required: false, description: 'Filter by city UUID' })
  @ApiResponse({ status: 200, schema: { example: { success: true, data: [{ id: 'uuid', name: 'Burj Khalifa', slug: 'burj-khalifa', country_id: 'uuid', city_id: 'uuid' }] } } })
  dropdown(
    @Query('country_id') country_id?: string,
    @Query('city_id')    city_id?: string,
  ) {
    return this.destinationsService.dropdown(country_id, city_id);
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new destination with optional flag, thumbnail, banner, and gallery images' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['country_id', 'city_id', 'module_id', 'name', 'featured', 'publish_status'],
      properties: {
        country_id:        { type: 'string', format: 'uuid', example: 'uuid-of-country' },
        city_id:           { type: 'string', format: 'uuid', example: 'uuid-of-city', description: 'Must belong to the selected country' },
        module_id:         { type: 'string', format: 'uuid', example: 'uuid-of-module' },
        language_id:       { type: 'string', format: 'uuid', example: 'uuid-of-language' },
        seo_id:            { type: 'string', format: 'uuid', example: 'uuid-of-seo' },
        category_id:       { type: 'string', format: 'uuid', example: 'uuid-of-category' },
        name:              { type: 'string', example: 'Burj Khalifa' },
        slug:              { type: 'string', example: 'burj-khalifa', description: 'Auto-generated from name if omitted' },
        short_name:        { type: 'string', example: 'Burj Khalifa' },
        short_description: { type: 'string', example: 'The tallest building in the world.' },
        description:       { type: 'string', example: 'Full description...' },
        address:           { type: 'string', example: '1 Sheikh Mohammed bin Rashid Blvd, Dubai' },
        latitude:          { type: 'number', example: 25.197197, description: '-90 to 90' },
        longitude:         { type: 'number', example: 55.274376, description: '-180 to 180' },
        map_url:           { type: 'string', example: 'https://maps.google.com/?q=Burj+Khalifa' },
        opening_time:      { type: 'string', example: '09:00', description: 'HH:MM format' },
        closing_time:      { type: 'string', example: '22:00', description: 'HH:MM format' },
        ticket_price:      { type: 'number', example: 149.00 },
        currency:          { type: 'string', example: 'AED' },
        duration:          { type: 'string', example: '2-3 hours' },
        contact_number:    { type: 'string', example: '+971 4 888 8888' },
        email:             { type: 'string', format: 'email', example: 'info@burjkhalifa.ae' },
        website:           { type: 'string', example: 'https://www.burjkhalifa.ae' },
        featured:          { type: 'boolean', example: false },
        publish_status:    { type: 'boolean', example: true },
        flag_image:        { type: 'string', format: 'binary', description: 'Flag image (jpg, png, webp, svg)' },
        thumbnail:         { type: 'string', format: 'binary', description: 'Thumbnail (jpg, png, webp)' },
        banner:            { type: 'string', format: 'binary', description: 'Banner (jpg, png, webp)' },
        images:            { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Gallery images (multiple)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Destination created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Country, city, module, or language not found; or city does not belong to country' })
  @ApiResponse({ status: 409, description: 'Slug or destination name in this city already exists' })
  create(@Body() dto: CreateDestinationDto, @UploadedFiles() files: any) {
    return this.destinationsService.create(dto, groupFiles(files));
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List destinations with pagination, search, filters, and sort' })
  @ApiQuery({ name: 'page',           required: false, example: 1 })
  @ApiQuery({ name: 'limit',          required: false, example: 10 })
  @ApiQuery({ name: 'search',         required: false, example: 'burj', description: 'Search by name, slug, short_name, or address' })
  @ApiQuery({ name: 'country_id',     required: false, description: 'Filter by country UUID' })
  @ApiQuery({ name: 'city_id',        required: false, description: 'Filter by city UUID' })
  @ApiQuery({ name: 'module_id',      required: false, description: 'Filter by module UUID' })
  @ApiQuery({ name: 'language_id',    required: false, description: 'Filter by language UUID' })
  @ApiQuery({ name: 'category_id',    required: false, description: 'Filter by category UUID' })
  @ApiQuery({ name: 'featured',       required: false, example: false })
  @ApiQuery({ name: 'publish_status', required: false, example: true })
  @ApiQuery({ name: 'sortBy',         required: false, enum: ['name', 'slug', 'ticket_price', 'created_at', 'updated_at'] })
  @ApiQuery({ name: 'sortOrder',      required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of destinations with country, city, module, language, category' })
  findAll(@Query() query: ListDestinationsDto) {
    return this.destinationsService.findAll(query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get destination by ID — full detail with all relations and parsed gallery' })
  @ApiParam({ name: 'id', description: 'Destination UUID' })
  @ApiResponse({ status: 200, description: 'Destination detail' })
  @ApiResponse({ status: 404, description: 'Destination not found' })
  findOne(@Param('id') id: string) {
    return this.destinationsService.findOne(id);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a destination — new gallery images are appended, not replaced',
    description: 'Use DELETE /api/destinations/:id/gallery to remove specific images. Flag, thumbnail, and banner are replaced when new files are provided.',
  })
  @ApiParam({ name: 'id', description: 'Destination UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        country_id:        { type: 'string', format: 'uuid' },
        city_id:           { type: 'string', format: 'uuid' },
        module_id:         { type: 'string', format: 'uuid' },
        language_id:       { type: 'string', format: 'uuid' },
        seo_id:            { type: 'string', format: 'uuid' },
        category_id:       { type: 'string', format: 'uuid' },
        name:              { type: 'string', example: 'Burj Khalifa Updated' },
        slug:              { type: 'string', example: 'burj-khalifa-updated' },
        short_name:        { type: 'string' },
        short_description: { type: 'string' },
        description:       { type: 'string' },
        address:           { type: 'string' },
        latitude:          { type: 'number' },
        longitude:         { type: 'number' },
        map_url:           { type: 'string' },
        opening_time:      { type: 'string', example: '09:00' },
        closing_time:      { type: 'string', example: '22:00' },
        ticket_price:      { type: 'number' },
        currency:          { type: 'string' },
        duration:          { type: 'string' },
        contact_number:    { type: 'string' },
        email:             { type: 'string', format: 'email' },
        website:           { type: 'string' },
        featured:          { type: 'boolean' },
        publish_status:    { type: 'boolean' },
        flag_image:        { type: 'string', format: 'binary' },
        thumbnail:         { type: 'string', format: 'binary' },
        banner:            { type: 'string', format: 'binary' },
        images:            { type: 'array', items: { type: 'string', format: 'binary' }, description: 'New images to append to gallery' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Destination updated successfully' })
  @ApiResponse({ status: 404, description: 'Destination not found' })
  @ApiResponse({ status: 409, description: 'Slug or destination name in this city already exists' })
  update(@Param('id') id: string, @Body() dto: UpdateDestinationDto, @UploadedFiles() files: any) {
    return this.destinationsService.update(id, dto, groupFiles(files));
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a destination' })
  @ApiParam({ name: 'id', description: 'Destination UUID' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Destination deleted successfully.' } } })
  @ApiResponse({ status: 404, description: 'Destination not found' })
  remove(@Param('id') id: string) {
    return this.destinationsService.remove(id);
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  @Post(':id/gallery')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add images to destination gallery' })
  @ApiParam({ name: 'id', description: 'Destination UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['images'],
      properties: {
        images: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Images to add' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Gallery images added — returns updated images array' })
  @ApiResponse({ status: 404, description: 'Destination not found' })
  addGallery(@Param('id') id: string, @UploadedFiles() files: any) {
    const grouped    = groupFiles(files);
    const imageFiles = grouped?.images ?? [];
    return this.destinationsService.addGalleryImages(id, imageFiles);
  }

  // ─── Gallery: Remove Image ────────────────────────────────────────────────────

  @Delete(':id/gallery')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Remove a specific image from destination gallery by URL' })
  @ApiParam({ name: 'id', description: 'Destination UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image_url'],
      properties: {
        image_url: { type: 'string', example: 'https://...supabase.co/storage/v1/object/public/bucket/dest-images/image.jpg' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Image removed — returns updated images array' })
  @ApiResponse({ status: 404, description: 'Destination not found' })
  removeGalleryImage(
    @Param('id') id: string,
    @Body('image_url') imageUrl: string,
  ) {
    if (!imageUrl) throw new BadRequestException('image_url is required.');
    return this.destinationsService.removeGalleryImage(id, imageUrl);
  }
}
