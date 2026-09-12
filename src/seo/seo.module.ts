import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  controllers: [SeoController, ItemsController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
