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
import { DIRECTIONS } from './dto/create-language.dto';
import { CreateLanguageDto } from './dto/create-language.dto';
import { ListLanguagesDto } from './dto/list-languages.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { LanguagesService } from './languages.service';

@ApiTags('Languages')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize languages table and seed default languages (English, Arabic)' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        message: 'Language module initialized successfully.',
        data: { tableCreated: true, languagesSeeded: 2, skippedLanguages: 0 },
      },
    },
  })
  setup() {
    return this.languagesService.setup();
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new language' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['module_id', 'name', 'code', 'native_name', 'locale', 'direction'],
      properties: {
        module_id:   { type: 'string', format: 'uuid', example: 'uuid-of-module' },
        name:        { type: 'string', example: 'French' },
        code:        { type: 'string', example: 'fr', description: 'ISO 639-1 code' },
        native_name: { type: 'string', example: 'Français' },
        locale:      { type: 'string', example: 'fr-FR' },
        direction:   { type: 'string', enum: [...DIRECTIONS], example: 'LTR' },
        flag:        { type: 'string', example: 'https://example.com/flags/fr.png', description: 'Flag image URL (optional)' },
        is_default:  { type: 'boolean', example: false },
        status:      { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 201, schema: { example: { success: true, message: 'Language created successfully.' } } })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  @ApiResponse({ status: 409, description: 'Language already exists' })
  create(@Body() dto: CreateLanguageDto) {
    return this.languagesService.create(dto);
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List languages with pagination, search, filters, and sort' })
  @ApiQuery({ name: 'page',       required: false, example: 1 })
  @ApiQuery({ name: 'limit',      required: false, example: 10 })
  @ApiQuery({ name: 'search',     required: false, example: 'english', description: 'Search by name, code, native name, or locale' })
  @ApiQuery({ name: 'status',     required: false, example: true })
  @ApiQuery({ name: 'direction',  required: false, enum: [...DIRECTIONS] })
  @ApiQuery({ name: 'is_default', required: false, example: false })
  @ApiQuery({ name: 'module_id',  required: false, description: 'Filter by module UUID' })
  @ApiQuery({ name: 'sortBy',     required: false, enum: ['name', 'code', 'direction', 'status', 'created_at'] })
  @ApiQuery({ name: 'order',      required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: [
          { id: 'uuid', module_id: 'uuid', name: 'English', code: 'en', locale: 'en-US', direction: 'LTR', is_default: true, status: true, module: { id: 'uuid', name: 'Module Name' } },
        ],
        pagination: { page: 1, limit: 10, total: 2 },
      },
    },
  })
  findAll(@Query() query: ListLanguagesDto) {
    return this.languagesService.findAll(query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a language by ID' })
  @ApiParam({ name: 'id', description: 'Language UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid', module_id: 'uuid', name: 'English', code: 'en', native_name: 'English',
          locale: 'en-US', direction: 'LTR', flag: null, is_default: true, status: true,
          module: { id: 'uuid', name: 'Module Name' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Language not found' })
  findOne(@Param('id') id: string) {
    return this.languagesService.findOne(id);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a language' })
  @ApiParam({ name: 'id', description: 'Language UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        module_id:   { type: 'string', format: 'uuid' },
        name:        { type: 'string', example: 'French' },
        code:        { type: 'string', example: 'fr' },
        native_name: { type: 'string', example: 'Français' },
        locale:      { type: 'string', example: 'fr-FR' },
        direction:   { type: 'string', enum: [...DIRECTIONS] },
        flag:        { type: 'string', example: 'https://example.com/flags/fr.png' },
        is_default:  { type: 'boolean', example: false },
        status:      { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Language updated successfully.' } } })
  @ApiResponse({ status: 404, description: 'Language or module not found' })
  @ApiResponse({ status: 409, description: 'Language name or code already exists' })
  update(@Param('id') id: string, @Body() dto: UpdateLanguageDto) {
    return this.languagesService.update(id, dto);
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a language' })
  @ApiParam({ name: 'id', description: 'Language UUID' })
  @ApiResponse({ status: 200, schema: { example: { success: true, message: 'Language deleted successfully.' } } })
  @ApiResponse({ status: 404, description: 'Language not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete default language or language assigned to translations' })
  remove(@Param('id') id: string) {
    return this.languagesService.remove(id);
  }
}
