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
import { CreateModuleDto } from './dto/create-module.dto';
import { ListModulesDto } from './dto/list-modules.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModulesService } from './modules.service';

@ApiTags('Modules')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize modules table and seed default modules' })
  @ApiResponse({
    status: 200,
    description: 'Modules module initialized',
    schema: {
      example: {
        success: true,
        message: 'Module module initialized successfully.',
        data: { tableCreated: true, modulesSeeded: 12, skippedModules: 0 },
      },
    },
  })
  setup() {
    return this.modulesService.setup();
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new module' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['module_name', 'publish_status'],
      properties: {
        module_name: {
          type: 'string',
          maxLength: 255,
          example: 'Products',
          description: 'Unique module name',
        },
        alias: {
          type: 'string',
          maxLength: 100,
          example: 'products',
          description: 'Unique alias / short key (optional)',
        },
        publish_status: {
          type: 'boolean',
          example: true,
          description: 'Active (true) / Inactive (false)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Module created successfully',
    schema: {
      example: {
        success: true,
        message: 'Module created successfully.',
        data: { id: 'uuid', module_name: 'Products', alias: 'products', publish_status: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    schema: {
      example: {
        success: false,
        message: 'Validation Failed',
        errors: { module_name: ['Module name is required.'] },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate module name',
    schema: { example: { success: false, message: 'Module name already exists.' } },
  })
  create(@Body() dto: CreateModuleDto) {
    return this.modulesService.create(dto);
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List modules with pagination, search, filter, and sort' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'dashboard', description: 'Search by module name, alias, or ID' })
  @ApiQuery({ name: 'publish_status', required: false, example: true, description: 'Filter by publish status' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['module_name', 'created_at', 'updated_at'], example: 'created_at' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], example: 'DESC' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of modules',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            module_name: 'Dashboard',
            publish_status: true,
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, limit: 10, total: 12 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() query: ListModulesDto) {
    return this.modulesService.findAll(query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':identifier')
  @ApiOperation({ summary: 'Get a module by ID, alias, or module name' })
  @ApiParam({ name: 'identifier', description: 'Module UUID, alias, or exact module name' })
  @ApiResponse({
    status: 200,
    description: 'Module details',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          module_name: 'Dashboard',
          alias: 'dashboard',
          publish_status: true,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Module not found',
    schema: { example: { success: false, message: 'Module not found.' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('identifier') identifier: string) {
    return this.modulesService.findOne(identifier);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a module' })
  @ApiParam({ name: 'id', description: 'Module UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        module_name: {
          type: 'string',
          maxLength: 255,
          example: 'Products Updated',
          description: 'Module name',
        },
        alias: {
          type: 'string',
          maxLength: 100,
          example: 'products-updated',
          description: 'Unique alias / short key',
        },
        publish_status: {
          type: 'boolean',
          example: false,
          description: 'Active (true) / Inactive (false)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Module updated successfully',
    schema: { example: { success: true, message: 'Module updated successfully.' } },
  })
  @ApiResponse({
    status: 404,
    description: 'Module not found',
    schema: { example: { success: false, message: 'Module not found.' } },
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate module name',
    schema: { example: { success: false, message: 'Module name already exists.' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
    return this.modulesService.update(id, dto);
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a module' })
  @ApiParam({ name: 'id', description: 'Module UUID' })
  @ApiResponse({
    status: 200,
    description: 'Module soft-deleted successfully',
    schema: { example: { success: true, message: 'Module deleted successfully.' } },
  })
  @ApiResponse({
    status: 404,
    description: 'Module not found or already deleted',
    schema: { example: { success: false, message: 'Module not found.' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id') id: string) {
    return this.modulesService.remove(id);
  }
}
