import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const result: Record<string, string[]> = {};
        errors.forEach((error) => {
          result[error.property] = Object.values(error.constraints ?? {});
        });
        return new BadRequestException({
          success: false,
          message: 'Validation Failed',
          errors: result,
        });
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TG Backend API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'Authorization', description: 'Enter: Bearer YOUR_TOKEN' },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customJsStr: `
      (function () {
        const AUTH_URLS = ['/api/auth/login', '/api/auth/app-token', '/api/auth/refresh-token'];

        function applyToken(token, refreshToken) {
          if (!window.ui) return;
          window.ui.preauthorizeApiKey('bearer', 'Bearer ' + token);
          sessionStorage.setItem('tg_access_token', token);
          if (refreshToken) sessionStorage.setItem('tg_refresh_token', refreshToken);
        }

        const _fetch = window.fetch;
        window.fetch = async function (input, init) {
          const response = await _fetch(input, init);
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          const isAuthUrl = AUTH_URLS.some(function (u) { return url.includes(u); });
          if (isAuthUrl && response.status === 200) {
            response.clone().json().then(function (body) {
              const d = body && body.data;
              const token = d && (d.access_token || d.accessToken);
              const refresh = d && (d.refresh_token || d.refreshToken);
              if (token) applyToken(token, refresh);
            }).catch(function () {});
          }
          return response;
        };

        window.addEventListener('load', function () {
          const token = sessionStorage.getItem('tg_access_token');
          if (token) {
            var interval = setInterval(function () {
              if (window.ui) { clearInterval(interval); applyToken(token, null); }
            }, 300);
          }
        });
      })();
    `,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
