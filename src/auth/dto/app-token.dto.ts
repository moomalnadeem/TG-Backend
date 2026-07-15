import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AppTokenDto {
  @ApiProperty({ example: 'tg_my_strong_app_secret', description: 'Server-side app secret from APP_SECRET env var' })
  @IsNotEmpty()
  @IsString()
  app_secret: string;
}
