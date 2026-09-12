import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AttractionsController } from './attractions.controller';
import { AttractionsService } from './attractions.service';

@Module({
  imports: [SupabaseModule],
  controllers: [AttractionsController],
  providers: [AttractionsService],
  exports: [AttractionsService],
})
export class AttractionsModule {}
