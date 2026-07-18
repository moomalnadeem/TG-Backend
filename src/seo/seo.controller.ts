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
import { SITEMAP_FREQUENCIES } from './dto/create-seo.dto';
import { CreateSeoDto } from './dto/create-seo.dto';
import { ListSeoDto } from './dto/list-seo.dto';
import { UpdateSeoDto } from './dto/update-seo.dto';
import { SeoService } from './seo.service';

@ApiTags('SEO')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Migrate SEO table — adds all columns and indexes' })
  @ApiResponse({ status: 200, description: 'SEO table migrated successfully' })
  setup() {
    return this.seoService.setup();
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create an SEO record' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'description', 'sitemap_frequency', 'module_id', 'item_id', 'publish_status'],
      properties: {
        title:             { type: 'string', maxLength: 255, example: 'Dubai Tours - Best Packages' },
        description:       { type: 'string', example: 'Explore Dubai with our top-rated tour packages...' },
        keywords:          { type: 'string', example: 'dubai, tours, travel', description: 'Comma-separated keywords' },
        canonical_url:     { type: 'string', example: 'https://example.com/tours/dubai' },
        sitemap_priority:  { type: 'number', example: 0.8, description: 'Value between 0.0 and 1.0' },
        sitemap_frequency: { type: 'string', enum: [...SITEMAP_FREQUENCIES], example: 'weekly' },
        module_id:         { type: 'string', format: 'uuid', example: 'uuid-of-module', description: 'From GET /api/modules/dropdown' },
        item_id:           { type: 'string', format: 'uuid', example: 'uuid-of-item', description: 'From GET /api/items/dropdown?moduleId=...' },
        disable_for_bots:  { type: 'boolean', example: false, description: 'Enable NoIndex/NoFollow' },
        publish_status:    { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'SEO record created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Module or item not found' })
  @ApiResponse({ status: 409, description: 'SEO record already exists for this module and item' })
  create(@Body() dto: CreateSeoDto) {
    return this.seoService.create(dto);
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List SEO records with pagination, search, filter, and sort' })
  @ApiQuery({ name: 'page',           required: false, example: 1 })
  @ApiQuery({ name: 'limit',          required: false, example: 10 })
  @ApiQuery({ name: 'search',         required: false, example: 'dubai', description: 'Search by title, description, or keywords' })
  @ApiQuery({ name: 'module_id',      required: false, description: 'Filter by module UUID' })
  @ApiQuery({ name: 'publish_status', required: false, example: true })
  @ApiQuery({ name: 'sortBy',         required: false, enum: ['title', 'created_at', 'updated_at'] })
  @ApiQuery({ name: 'sortOrder',      required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of SEO records with module and item data' })
  findAll(@Query() query: ListSeoDto) {
    return this.seoService.findAll(query);
  }

  // ─── Get by item_id ──────────────────────────────────────────────────────────

  @Get('item/:item_id')
  @ApiOperation({ summary: 'Get SEO record by item_id' })
  @ApiParam({ name: 'item_id', description: 'Item UUID (Tour, Blog, User, etc.)' })
  @ApiQuery({ name: 'module_id', required: false, description: 'Optional — filter by module UUID when the item appears in multiple modules' })
  @ApiResponse({ status: 200, description: 'SEO record with module and item details' })
  @ApiResponse({ status: 404, description: 'No SEO record found for this item' })
  findByItem(
    @Param('item_id')   itemId:    string,
    @Query('module_id') moduleId?: string,
  ) {
    return this.seoService.findByItem(itemId, moduleId);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get SEO record by SEO ID or Item ID',
    description: 'Accepts either a SEO record UUID or an Item UUID. Tries to match by seo_id first — if not found, falls back to item_id.',
  })
  @ApiParam({
    name: 'id',
    description: 'SEO record UUID **or** Item UUID (Tour, Blog, User, etc.)',
    example: 'uuid-of-seo-or-item',
  })
  @ApiResponse({ status: 200, description: 'SEO record with module and item details' })
  @ApiResponse({ status: 404, description: 'SEO record not found by seo_id or item_id' })
  findOne(@Param('id') id: string) {
    return this.seoService.findOne(id);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update an SEO record' })
  @ApiParam({ name: 'id', description: 'SEO record UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title:             { type: 'string', maxLength: 255 },
        description:       { type: 'string' },
        keywords:          { type: 'string' },
        canonical_url:     { type: 'string' },
        sitemap_priority:  { type: 'number', description: '0.0 – 1.0' },
        sitemap_frequency: { type: 'string', enum: [...SITEMAP_FREQUENCIES] },
        module_id:         { type: 'string', format: 'uuid' },
        item_id:           { type: 'string', format: 'uuid' },
        disable_for_bots:  { type: 'boolean' },
        publish_status:    { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'SEO record updated successfully' })
  @ApiResponse({ status: 404, description: 'SEO record not found' })
  @ApiResponse({ status: 409, description: 'SEO record already exists for this module and item' })
  update(@Param('id') id: string, @Body() dto: UpdateSeoDto) {
    return this.seoService.update(id, dto);
  }

  // ─── Update by Item (with SEO ID ownership check) ────────────────────────────

  @Put('item/:item_id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update SEO by item_id — verifies the seo_id belongs to this item and module',
    description: 'Pass seo_id + module_id as query params. The API validates that the SEO record with that ID is actually linked to the given item and module before updating.',
  })
  @ApiParam({ name: 'item_id', description: 'Item UUID whose SEO you want to update' })
  @ApiQuery({ name: 'seo_id',    required: true,  description: 'SEO record UUID — must match the SEO linked to this item' })
  @ApiQuery({ name: 'module_id', required: true,  description: 'Module UUID this item belongs to' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title:             { type: 'string' },
        description:       { type: 'string' },
        keywords:          { type: 'string' },
        canonical_url:     { type: 'string' },
        sitemap_priority:  { type: 'number', description: '0.0 – 1.0' },
        sitemap_frequency: { type: 'string', enum: [...SITEMAP_FREQUENCIES] },
        disable_for_bots:  { type: 'boolean' },
        publish_status:    { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'SEO updated successfully' })
  @ApiResponse({ status: 404, description: 'SEO record not found or seo_id does not belong to this item' })
  updateByItem(
    @Param('item_id')    itemId:   string,
    @Query('seo_id')     seoId:    string,
    @Query('module_id')  moduleId: string,
    @Body() dto: UpdateSeoDto,
  ) {
    if (!seoId)    throw new BadRequestException('seo_id query param is required.');
    if (!moduleId) throw new BadRequestException('module_id query param is required.');
    return this.seoService.updateByItem(seoId, itemId, moduleId, dto);
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete an SEO record' })
  @ApiParam({ name: 'id', description: 'SEO record UUID' })
  @ApiResponse({ status: 200, description: 'SEO record deleted successfully' })
  @ApiResponse({ status: 404, description: 'SEO record not found or already deleted' })
  remove(@Param('id') id: string) {
    return this.seoService.remove(id);
  }
}
