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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Migrate users table — adds user management columns and creates storage bucket' })
  @ApiResponse({ status: 200, description: 'Migration complete' })
  setup() {
    return this.usersService.setup();
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ]))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['username', 'name', 'email', 'role_id', 'module_type_id', 'publish_status'],
      properties: {
        username:       { type: 'string', maxLength: 100, example: 'johndoe' },
        name:           { type: 'string', example: 'John Doe' },
        email:          { type: 'string', format: 'email', example: 'john@example.com' },
        role_id:        { type: 'string', format: 'uuid', example: 'uuid-of-role' },
        module_type_id: { type: 'string', format: 'uuid', example: 'uuid-of-module' },
        description:    { type: 'string', maxLength: 5000, example: 'A short bio.', nullable: true },
        publish_status: { type: 'boolean', example: true },
        image:          { type: 'string', format: 'binary', description: 'Profile image (jpg, jpeg, png, webp)' },
        banner:         { type: 'string', format: 'binary', description: 'Banner image (jpg, jpeg, png, webp)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Role or module not found' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  create(
    @Body() dto: CreateUserDto,
    @UploadedFiles() files: { image?: Express.Multer.File[]; banner?: Express.Multer.File[] },
  ) {
    return this.usersService.create(dto, files);
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List users with pagination, search, filter, and sort' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'john', description: 'Search by username, name, email, role name, module name' })
  @ApiQuery({ name: 'role_id', required: false, description: 'Filter by role UUID' })
  @ApiQuery({ name: 'module_type_id', required: false, description: 'Filter by module type UUID' })
  @ApiQuery({ name: 'publish_status', required: false, example: true })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['username', 'name', 'email', 'created_at', 'updated_at'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Paginated list of users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() query: ListUsersDto) {
    return this.usersService.findAll(query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User details with role, module type, and SEO data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  @Put(':id')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ]))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username:       { type: 'string', maxLength: 100, example: 'johndoe_v2' },
        name:           { type: 'string', example: 'John Doe Updated' },
        email:          { type: 'string', format: 'email', example: 'john.updated@example.com' },
        role_id:        { type: 'string', format: 'uuid' },
        module_type_id: { type: 'string', format: 'uuid' },
        description:    { type: 'string', maxLength: 5000 },
        publish_status: { type: 'boolean' },
        image:          { type: 'string', format: 'binary', description: 'Replace profile image' },
        banner:         { type: 'string', format: 'binary', description: 'Replace banner image' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @UploadedFiles() files: { image?: Express.Multer.File[]; banner?: Express.Multer.File[] },
  ) {
    return this.usersService.update(id, dto, files);
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found or already deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
