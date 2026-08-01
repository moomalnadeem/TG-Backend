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
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';
import { ListCitiesDto } from './dto/list-cities.dto';
import { UpdateCityDto } from './dto/update-city.dto';

function groupFiles(files: any): Record<string, Express.Multer.File[]> {
  if (!Array.isArray(files)) return files ?? {};
  return (files as Express.Multer.File[]).reduce((acc, f) => {
    if (!acc[f.fieldname]) acc[f.fieldname] = [];
    acc[f.fieldname].push(f);
    return acc;
  }, {} as Record<string, Express.Multer.File[]>);
}

@ApiTags('Cities')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create cities table and indexes (safe to re-run)' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Cities table migrated successfully.' } } })
  setup() {
    return this.citiesService.setup();
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  @Get('dropdown')
  @ApiOperation({ summary: 'Cities dropdown — id, name, slug, country_id of all published cities' })
  @ApiQuery({ name: 'country_id', required: false, description: 'Filter dropdown by country UUID' })
  @ApiResponse({ status: 200, schema: { example: { success: true, data: [{ id: 'uuid', name: 'Dubai', slug: 'dubai', country_id: 'uuid' }] } } })
  dropdown(@Query('country_id') country_id?: string) {
    return this.citiesService.dropdown(country_id);
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new city / emirate with optional flag, thumbnail, banner, and gallery images' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['country_id', 'module_id', 'name', 'publish_status'],
      properties: {
        country_id:     { type: 'string', format: 'uuid', example: 'uuid-of-country' },
        module_id:      { type: 'string', format: 'uuid', example: 'uuid-of-module' },
        language_id:    { type: 'string', format: 'uuid', example: 'uuid-of-language' },
        seo_id:         { type: 'string', format: 'uuid', example: 'uuid-of-seo' },
        name:           { type: 'string', example: 'Dubai' },
        slug:           { type: 'string', example: 'dubai', description: 'Auto-generated from name if omitted' },
        short_name:     { type: 'string', example: 'DXB' },
        code:           { type: 'string', example: 'DXB' },
        description:    { type: 'string', example: 'The most populous city in the UAE.' },
        publish_status: { type: 'boolean', example: true },
        flag_image:     { type: 'string', format: 'binary', description: 'Flag image (jpg, png, webp, svg)' },
        thumbnail:      { type: 'string', format: 'binary', description: 'Thumbnail image (jpg, png, webp)' },
        banner:         { type: 'string', format: 'binary', description: 'Banner image (jpg, png, webp)' },
        images:         { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Gallery images (multiple)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'City created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Country, module, or language not found' })
  @ApiResponse({ status: 409, description: 'Slug or city name in this country already exists' })
  create(@Body() dto: CreateCityDto, @UploadedFiles() files: any) {
    return this.citiesService.create(dto, groupFiles(files));
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List cities with pagination, search, filters, and sort' })
  @ApiQuery({ name: 'page',           required: false, example: 1 })
  @ApiQuery({ name: 'limit',          required: false, example: 10 })
  @ApiQuery({ name: 'search',         required: false, example: 'dubai', description: 'Search by name, slug, short_name, or code' })
  @ApiQuery({ name: 'country_id',     required: false, description: 'Filter by country UUID' })
  @ApiQuery({ name: 'module_id',      required: false, description: 'Filter by module UUID' })
  @ApiQuery({ name: 'language_id',    required: false, description: 'Filter by language UUID' })
  @ApiQuery({ name: 'publish_status', required: false, example: true })
  @ApiQuery({ name: 'sortBy',         required: false, enum: ['name', 'slug', 'created_at', 'updated_at'] })
  @ApiQuery({ name: 'sortOrder',      required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of cities with country, module, and language' })
  findAll(@Query() query: ListCitiesDto) {
    return this.citiesService.findAll(query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get city by ID — includes country, module, language, and parsed gallery' })
  @ApiParam({ name: 'id', description: 'City UUID' })
  @ApiResponse({ status: 200, description: 'City details' })
  @ApiResponse({ status: 404, description: 'City not found' })
  findOne(@Param('id') id: string) {
    return this.citiesService.findOne(id);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a city — new gallery images are appended, not replaced',
    description: 'To remove specific gallery images use DELETE /api/cities/:id/gallery. Flag, thumbnail, and banner are replaced when new files are provided.',
  })
  @ApiParam({ name: 'id', description: 'City UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        country_id:     { type: 'string', format: 'uuid' },
        module_id:      { type: 'string', format: 'uuid' },
        language_id:    { type: 'string', format: 'uuid' },
        seo_id:         { type: 'string', format: 'uuid' },
        name:           { type: 'string', example: 'Dubai' },
        slug:           { type: 'string', example: 'dubai' },
        short_name:     { type: 'string', example: 'DXB' },
        code:           { type: 'string', example: 'DXB' },
        description:    { type: 'string' },
        publish_status: { type: 'boolean' },
        flag_image:     { type: 'string', format: 'binary' },
        thumbnail:      { type: 'string', format: 'binary' },
        banner:         { type: 'string', format: 'binary' },
        images:         { type: 'array', items: { type: 'string', format: 'binary' }, description: 'New images to append to gallery' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'City updated successfully' })
  @ApiResponse({ status: 404, description: 'City not found' })
  @ApiResponse({ status: 409, description: 'Slug or city name in this country already exists' })
  update(@Param('id') id: string, @Body() dto: UpdateCityDto, @UploadedFiles() files: any) {
    return this.citiesService.update(id, dto, groupFiles(files));
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a city' })
  @ApiParam({ name: 'id', description: 'City UUID' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'City deleted successfully.' } } })
  @ApiResponse({ status: 404, description: 'City not found' })
  remove(@Param('id') id: string) {
    return this.citiesService.remove(id);
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  @Post(':id/gallery')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add images to city gallery' })
  @ApiParam({ name: 'id', description: 'City UUID' })
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
  @ApiResponse({ status: 404, description: 'City not found' })
  addGallery(@Param('id') id: string, @UploadedFiles() files: any) {
    const grouped    = groupFiles(files);
    const imageFiles = grouped?.images ?? [];
    return this.citiesService.addGalleryImages(id, imageFiles);
  }

  // ─── Gallery: Remove Image ────────────────────────────────────────────────────

  @Delete(':id/gallery')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Remove a specific image from city gallery by URL' })
  @ApiParam({ name: 'id', description: 'City UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image_url'],
      properties: {
        image_url: { type: 'string', example: 'https://...supabase.co/storage/v1/object/public/bucket/city-images/image.jpg' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Image removed — returns updated images array' })
  @ApiResponse({ status: 404, description: 'City not found' })
  removeGalleryImage(
    @Param('id') id: string,
    @Body('image_url') imageUrl: string,
  ) {
    if (!imageUrl) throw new BadRequestException('image_url is required.');
    return this.citiesService.removeGalleryImage(id, imageUrl);
  }
}
