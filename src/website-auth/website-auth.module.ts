import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WebsiteAuthController } from './website-auth.controller';
import { WebsiteAuthService } from './website-auth.service';
import { ZeptoMailService } from './providers/zeptomail.service';
import { WhatsAppService } from './providers/whatsapp.service';

@Module({
  imports: [AuthModule],
  controllers: [WebsiteAuthController],
  providers: [WebsiteAuthService, ZeptoMailService, WhatsAppService],
})
export class WebsiteAuthModule {}
