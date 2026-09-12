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
import { CountriesService } from './countries.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { ListCountriesDto } from './dto/list-countries.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

function groupFiles(files: any): Record<string, Express.Multer.File[]> {
  if (!Array.isArray(files)) return files ?? {};
  return (files as Express.Multer.File[]).reduce((acc, f) => {
    if (!acc[f.fieldname]) acc[f.fieldname] = [];
    acc[f.fieldname].push(f);
    return acc;
  }, {} as Record<string, Express.Multer.File[]>);
}

@ApiTags('Countries')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create countries table and indexes (run once on setup)' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Countries table migrated successfully.' } } })
  setup() {
    return this.countriesService.setup();
  }

  // ─── Seed ────────────────────────────────────────────────────────────────────

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed all 195 countries with standard data — safe to re-run (skips existing iso2 codes)' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Seeded 195 countries successfully.', data: { inserted: 195, skipped: 0 } } } })
  seed() {
    return this.countriesService.seed();
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  @Get('dropdown')
  @ApiOperation({ summary: 'Countries dropdown — id, name, iso2, and flag of all published countries' })
  @ApiResponse({ status: 200, schema: { example: { success: true, data: [{ id: 'uuid', name: 'United Arab Emirates', iso2: 'AE', flag_image: null }] } } })
  dropdown() {
    return this.countriesService.dropdown();
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new country with optional flag, thumbnail, banner, and gallery images' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        module_id:      { type: 'string', format: 'uuid', example: 'uuid-of-module' },
        language_id:    { type: 'string', format: 'uuid', example: 'uuid-of-language' },
        seo_id:         { type: 'string', format: 'uuid', example: 'uuid-of-seo' },
        name:           { type: 'string', example: 'United Arab Emirates' },
        iso2:           { type: 'string', example: 'AE', description: 'ISO 3166-1 alpha-2' },
        iso3:           { type: 'string', example: 'ARE', description: 'ISO 3166-1 alpha-3' },
        phone_code:     { type: 'string', example: '+971' },
        currency:       { type: 'string', example: 'UAE Dirham' },
        currency_code:  { type: 'string', example: 'AED' },
        capital:        { type: 'string', example: 'Abu Dhabi' },
        continent:      { type: 'string', example: 'Asia' },
        nationality:    { type: 'string', example: 'Emirati' },
        timezone:       { type: 'string', example: 'Asia/Dubai' },
        description:    { type: 'string', example: 'A country in the Middle East.' },
        publish_status: { type: 'boolean', example: true },
        flag_image:     { type: 'string', format: 'binary', description: 'Flag image (jpg, png, webp)' },
        thumbnail:      { type: 'string', format: 'binary', description: 'Thumbnail image' },
        banner:         { type: 'string', format: 'binary', description: 'Banner image' },
        images:         { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Gallery images (multiple)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Country created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Module or language not found' })
  create(@Body() dto: CreateCountryDto, @UploadedFiles() files: any) {
    return this.countriesService.create(dto, groupFiles(files));
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List countries with pagination, search, filters, and sort' })
  @ApiQuery({ name: 'page',           required: false, example: 1 })
  @ApiQuery({ name: 'limit',          required: false, example: 10 })
  @ApiQuery({ name: 'search',         required: false, example: 'emirates', description: 'Search by name, iso2, iso3, capital, or nationality' })
  @ApiQuery({ name: 'module_id',      required: false, description: 'Filter by module UUID' })
  @ApiQuery({ name: 'language_id',    required: false, description: 'Filter by language UUID' })
  @ApiQuery({ name: 'continent',      required: false, example: 'Asia', description: 'Filter by continent (partial match)' })
  @ApiQuery({ name: 'publish_status', required: false, example: true })
  @ApiQuery({ name: 'sortBy',         required: false, enum: ['name', 'iso2', 'continent', 'created_at', 'updated_at'] })
  @ApiQuery({ name: 'sortOrder',      required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of countries with related data' })
  findAll(@Query() query: ListCountriesDto) {
    return this.countriesService.findAll(query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get country by ID — includes module, language, and parsed gallery' })
  @ApiParam({ name: 'id', description: 'Country UUID' })
  @ApiResponse({ status: 200, description: 'Country details' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  findOne(@Param('id') id: string) {
    return this.countriesService.findOne(id);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a country — new gallery images are appended, not replaced',
    description: 'To remove specific gallery images use DELETE /api/countries/:id/gallery. Flag, thumbnail, and banner are replaced when new files are provided.',
  })
  @ApiParam({ name: 'id', description: 'Country UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        module_id:      { type: 'string', format: 'uuid' },
        language_id:    { type: 'string', format: 'uuid' },
        seo_id:         { type: 'string', format: 'uuid' },
        name:           { type: 'string', example: 'United Arab Emirates' },
        iso2:           { type: 'string', example: 'AE' },
        iso3:           { type: 'string', example: 'ARE' },
        phone_code:     { type: 'string', example: '+971' },
        currency:       { type: 'string', example: 'UAE Dirham' },
        currency_code:  { type: 'string', example: 'AED' },
        capital:        { type: 'string', example: 'Abu Dhabi' },
        continent:      { type: 'string', example: 'Asia' },
        nationality:    { type: 'string', example: 'Emirati' },
        timezone:       { type: 'string', example: 'Asia/Dubai' },
        description:    { type: 'string' },
        publish_status: { type: 'boolean' },
        flag_image:     { type: 'string', format: 'binary' },
        thumbnail:      { type: 'string', format: 'binary' },
        banner:         { type: 'string', format: 'binary' },
        images:         { type: 'array', items: { type: 'string', format: 'binary' }, description: 'New images to append to gallery' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Country updated successfully' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  update(@Param('id') id: string, @Body() dto: UpdateCountryDto, @UploadedFiles() files: any) {
    return this.countriesService.update(id, dto, groupFiles(files));
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a country' })
  @ApiParam({ name: 'id', description: 'Country UUID' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Country deleted successfully.' } } })
  @ApiResponse({ status: 404, description: 'Country not found' })
  remove(@Param('id') id: string) {
    return this.countriesService.remove(id);
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  @Post(':id/gallery')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add images to country gallery' })
  @ApiParam({ name: 'id', description: 'Country UUID' })
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
  @ApiResponse({ status: 404, description: 'Country not found' })
  addGallery(@Param('id') id: string, @UploadedFiles() files: any) {
    const grouped = groupFiles(files);
    const imageFiles: Express.Multer.File[] = grouped?.images ?? [];
    return this.countriesService.addGalleryImages(id, imageFiles);
  }

  // ─── Gallery: Remove Image ────────────────────────────────────────────────────

  @Delete(':id/gallery')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Remove a specific image from country gallery by URL' })
  @ApiParam({ name: 'id', description: 'Country UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image_url'],
      properties: {
        image_url: { type: 'string', example: 'https://...supabase.co/storage/v1/object/public/bucket/country-images/image.jpg' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Image removed — returns updated images array' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  removeGalleryImage(
    @Param('id') id: string,
    @Body('image_url') imageUrl: string,
  ) {
    if (!imageUrl) throw new BadRequestException('image_url is required.');
    return this.countriesService.removeGalleryImage(id, imageUrl);
  }
}
