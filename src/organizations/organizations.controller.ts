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
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListOrganizationsDto } from './dto/list-organizations.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

function groupFiles(files: any): Record<string, Express.Multer.File[]> {
  if (!Array.isArray(files)) return files ?? {};
  return (files as Express.Multer.File[]).reduce((acc, f) => {
    if (!acc[f.fieldname]) acc[f.fieldname] = [];
    acc[f.fieldname].push(f);
    return acc;
  }, {} as Record<string, Express.Multer.File[]>);
}

@ApiTags('Organizations')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create organizations table and indexes (run once on setup)' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Organizations table migrated successfully.' } } })
  setup() {
    return this.organizationsService.setup();
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  @Get('dropdown')
  @ApiOperation({ summary: 'Organizations dropdown — id and name of all active organizations' })
  @ApiResponse({ status: 200, schema: { example: { success: true, data: [{ id: 'uuid', name: 'Acme Corp' }] } } })
  dropdown() {
    return this.organizationsService.dropdown();
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new organization with optional logo, thumbnail, banner, and gallery images' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        module_id:   { type: 'string', format: 'uuid', example: 'uuid-of-module' },
        name:        { type: 'string', example: 'Acme Corp' },
        slug:        { type: 'string', example: 'acme-corp', description: 'Auto-generated from name if omitted' },
        email:       { type: 'string', format: 'email', example: 'info@acme.com' },
        phone:       { type: 'string', example: '+971501234567' },
        website:     { type: 'string', example: 'https://acme.com' },
        description: { type: 'string', example: 'A leading technology company.' },
        address:     { type: 'string', example: '123 Main Street, Downtown' },
        country_id:  { type: 'string', format: 'uuid', example: 'uuid-of-country' },
        city_id:     { type: 'string', format: 'uuid', example: 'uuid-of-city' },
        language_id: { type: 'string', format: 'uuid', example: 'uuid-of-language' },
        logo:        { type: 'string', format: 'binary', description: 'Logo image (jpg, png, webp)' },
        thumbnail:   { type: 'string', format: 'binary', description: 'Thumbnail image' },
        banner:      { type: 'string', format: 'binary', description: 'Banner image' },
        gallery:     { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Gallery images (multiple)' },
        is_featured: { type: 'boolean', example: false },
        status:      { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Module, country, city, or language not found' })
  @ApiResponse({ status: 409, description: 'Slug or email already exists' })
  create(@Body() dto: CreateOrganizationDto, @UploadedFiles() files: any) {
    return this.organizationsService.create(dto, groupFiles(files));
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List organizations with pagination, search, filters, and sort' })
  @ApiQuery({ name: 'page',        required: false, example: 1 })
  @ApiQuery({ name: 'limit',       required: false, example: 10 })
  @ApiQuery({ name: 'search',      required: false, example: 'acme', description: 'Search by name, slug, email, phone, or address' })
  @ApiQuery({ name: 'module_id',   required: false, description: 'Filter by module UUID' })
  @ApiQuery({ name: 'country_id',  required: false, description: 'Filter by country UUID' })
  @ApiQuery({ name: 'city_id',     required: false, description: 'Filter by city UUID' })
  @ApiQuery({ name: 'language_id', required: false, description: 'Filter by language UUID' })
  @ApiQuery({ name: 'status',      required: false, example: true })
  @ApiQuery({ name: 'is_featured', required: false, example: false })
  @ApiQuery({ name: 'sortBy',      required: false, enum: ['name', 'email', 'created_at', 'updated_at'] })
  @ApiQuery({ name: 'sortOrder',   required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of organizations with related data' })
  findAll(@Query() query: ListOrganizationsDto) {
    return this.organizationsService.findAll(query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID — includes module, country, city, language, and parsed gallery' })
  @ApiParam({ name: 'id', description: 'Organization UUID' })
  @ApiResponse({ status: 200, description: 'Organization details' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update an organization — new gallery images are appended, not replaced',
    description: 'To remove specific gallery images use DELETE /api/organizations/:id/gallery. Logo, thumbnail, and banner are replaced when new files are provided.',
  })
  @ApiParam({ name: 'id', description: 'Organization UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        module_id:   { type: 'string', format: 'uuid' },
        name:        { type: 'string', example: 'Acme Corp Updated' },
        slug:        { type: 'string', example: 'acme-corp-updated' },
        email:       { type: 'string', format: 'email' },
        phone:       { type: 'string' },
        website:     { type: 'string' },
        description: { type: 'string' },
        address:     { type: 'string' },
        country_id:  { type: 'string', format: 'uuid' },
        city_id:     { type: 'string', format: 'uuid' },
        language_id: { type: 'string', format: 'uuid' },
        logo:        { type: 'string', format: 'binary' },
        thumbnail:   { type: 'string', format: 'binary' },
        banner:      { type: 'string', format: 'binary' },
        gallery:     { type: 'array', items: { type: 'string', format: 'binary' }, description: 'New images to append to gallery' },
        is_featured: { type: 'boolean' },
        status:      { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Organization updated successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({ status: 409, description: 'Slug or email already exists' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto, @UploadedFiles() files: any) {
    return this.organizationsService.update(id, dto, groupFiles(files));
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete an organization' })
  @ApiParam({ name: 'id', description: 'Organization UUID' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Organization deleted successfully.' } } })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(id);
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  @Post(':id/gallery')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add images to organization gallery' })
  @ApiParam({ name: 'id', description: 'Organization UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['gallery'],
      properties: {
        gallery: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Images to add to gallery' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Gallery images added — returns updated gallery array' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  addGallery(@Param('id') id: string, @UploadedFiles() files: any) {
    const grouped = groupFiles(files);
    const galleryFiles: Express.Multer.File[] = grouped?.gallery ?? [];
    return this.organizationsService.addGalleryImages(id, galleryFiles);
  }

  // ─── Gallery: Remove Image ────────────────────────────────────────────────────

  @Delete(':id/gallery')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Remove a specific image from organization gallery by URL' })
  @ApiParam({ name: 'id', description: 'Organization UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image_url'],
      properties: {
        image_url: { type: 'string', example: 'https://...supabase.co/storage/v1/object/public/bucket/org-gallery/image.jpg' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Image removed — returns updated gallery array' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  removeGalleryImage(
    @Param('id') id: string,
    @Body('image_url') imageUrl: string,
  ) {
    if (!imageUrl) throw new BadRequestException('image_url is required.');
    return this.organizationsService.removeGalleryImage(id, imageUrl);
  }
}
