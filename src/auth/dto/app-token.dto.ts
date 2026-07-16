import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AppTokenDto {
  @ApiProperty({ example: 'tg_m2m_9f3a2c1e8b4d6f7a0e5c3b2d1a9f8e7c', description: 'APP_SECRET from server .env' })
  @IsNotEmpty()
  @IsString()
  app_secret: string;
}
