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

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize modules table and seed default modules' })
  @ApiResponse({ status: 200, description: 'Modules module initialized' })
  setup() {
    return this.modulesService.setup();
  }

  @Get('dropdown')
  @ApiOperation({ summary: 'Modules dropdown — returns id and module_name for all active, non-deleted modules' })
  @ApiResponse({
    status: 200,
    schema: { example: { success: true, data: [{ id: 'uuid', module_name: 'Dashboard' }] } },
  })
  dropdown() {
    return this.modulesService.dropdown();
  }

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new module' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['module_name', 'publish_status'],
      properties: {
        module_name:    { type: 'string', maxLength: 255, example: 'Products' },
        alias:          { type: 'string', maxLength: 100, example: 'products' },
        publish_status: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Module created successfully' })
  @ApiResponse({ status: 409, description: 'Duplicate module name or alias' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateModuleDto) {
    return this.modulesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List modules with pagination, search, filter, and sort' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'dashboard', description: 'Search by module name, alias, or ID' })
  @ApiQuery({ name: 'publish_status', required: false, example: true })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['module_name', 'created_at', 'updated_at'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of modules' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() query: ListModulesDto) {
    return this.modulesService.findAll(query);
  }

  @Get(':identifier')
  @ApiOperation({ summary: 'Get a module by ID, alias, or module name' })
  @ApiParam({ name: 'identifier', description: 'Module UUID, alias, or exact module name' })
  @ApiResponse({ status: 200, description: 'Module details' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('identifier') identifier: string) {
    return this.modulesService.findOne(identifier);
  }

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a module' })
  @ApiParam({ name: 'id', description: 'Module UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        module_name:    { type: 'string', maxLength: 255 },
        alias:          { type: 'string', maxLength: 100 },
        publish_status: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Module updated successfully' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  @ApiResponse({ status: 409, description: 'Duplicate module name or alias' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
    return this.modulesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a module' })
  @ApiParam({ name: 'id', description: 'Module UUID' })
  @ApiResponse({ status: 200, description: 'Module deleted successfully' })
  @ApiResponse({ status: 404, description: 'Module not found or already deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id') id: string) {
    return this.modulesService.remove(id);
  }
}
