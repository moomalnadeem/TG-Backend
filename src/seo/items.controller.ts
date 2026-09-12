import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BearerAuthGuard } from '../auth/guards/bearer-auth.guard';
import { SeoService } from './seo.service';

@ApiTags('SEO')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/items')
export class ItemsController {
  constructor(private readonly seoService: SeoService) {}

  @Get('dropdown')
  @ApiOperation({
    summary: 'Dynamic Item Dropdown — returns items for the selected module (used in SEO create/edit forms)',
    description: 'Queries the correct table based on the selected module\'s alias. E.g. module "Users" → users table, "Tours" → tours table.',
  })
  @ApiQuery({
    name: 'moduleId',
    required: true,
    description: 'UUID of the selected module — from GET /api/modules/dropdown',
    example: 'uuid-of-module',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: [
          { id: 'uuid', name: 'John Doe' },
          { id: 'uuid', name: 'Jane Smith' },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Module not found' })
  dropdown(@Query('moduleId') moduleId: string) {
    return this.seoService.itemsDropdown(moduleId);
  }
}
