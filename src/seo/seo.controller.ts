import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BearerAuthGuard } from '../auth/guards/bearer-auth.guard';
import { SeoService } from './seo.service';

@ApiTags('SEO')
@ApiBearerAuth('bearer')
@UseGuards(BearerAuthGuard)
@Controller('api/seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create SEO table' })
  @ApiResponse({ status: 200, description: 'SEO table ready' })
  setup() {
    return this.seoService.setup();
  }

  @Get('dropdown')
  @ApiOperation({ summary: 'SEO dropdown — returns id and seo_title for all active, non-deleted SEO profiles' })
  @ApiResponse({
    status: 200,
    schema: { example: { success: true, data: [{ id: 'uuid', seo_title: 'Home Page SEO' }] } },
  })
  dropdown() {
    return this.seoService.dropdown();
  }
}
