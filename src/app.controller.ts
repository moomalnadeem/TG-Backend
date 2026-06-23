import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/db')
  @ApiOperation({ summary: 'Check database connection status' })
  @ApiResponse({
    status: 200,
    description: 'Returns database connection status',
    schema: {
      example: {
        connected: true,
        status: 'ok',
        message: 'Database connection is healthy',
        timestamp: '2026-06-23T14:00:00.000Z',
      },
    },
  })
  checkDbConnection() {
    return this.appService.checkDbConnection();
  }
}
