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
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesDto } from './dto/list-roles.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('Admin — Roles')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize roles table and seed default roles' })
  @ApiResponse({ status: 200, description: 'Role module initialized' })
  setup() {
    return this.rolesService.setup();
  }

  @Get('dropdown')
  @ApiOperation({ summary: 'Roles dropdown — returns id and name for all active, non-deleted roles' })
  @ApiResponse({
    status: 200,
    schema: { example: { success: true, data: [{ id: 'uuid', name: 'Admin' }] } },
  })
  dropdown() {
    return this.rolesService.dropdown();
  }

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new role' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'slug'],
      properties: {
        name:        { type: 'string', example: 'Marketing' },
        slug:        { type: 'string', example: 'marketing', description: 'Lowercase letters, numbers, hyphens only' },
        description: { type: 'string', example: 'Marketing Team' },
        module_id:   { type: 'string', format: 'uuid', example: 'uuid-of-module', description: 'Module this role belongs to (optional)' },
        status:      { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  @ApiResponse({ status: 409, description: 'Role already exists' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all roles with pagination, search, filter, sort' })
  @ApiQuery({ name: 'page',      required: false, example: 1 })
  @ApiQuery({ name: 'limit',     required: false, example: 10 })
  @ApiQuery({ name: 'search',    required: false, example: 'admin', description: 'Search by name or slug' })
  @ApiQuery({ name: 'status',    required: false, example: true })
  @ApiQuery({ name: 'module_id', required: false, description: 'Filter by module UUID' })
  @ApiQuery({ name: 'sortBy',    required: false, enum: ['name', 'slug', 'status', 'created_at'] })
  @ApiQuery({ name: 'order',     required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of roles' })
  findAll(@Query() query: ListRolesDto) {
    return this.rolesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role details including module_id' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a role' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name:        { type: 'string', example: 'Senior Marketing' },
        slug:        { type: 'string', example: 'senior-marketing' },
        description: { type: 'string', example: 'Updated description' },
        module_id:   { type: 'string', format: 'uuid', example: 'uuid-of-module', description: 'Module this role belongs to' },
        status:      { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'Role or module not found' })
  @ApiResponse({ status: 409, description: 'Role name or slug already exists' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a role' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
