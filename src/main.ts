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
      { type: 'apiKey', in: 'header', name: 'Authorization', description: 'Paste your JWT access token (no Bearer prefix needed)' },
      'bearer',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'Paste your API key (starts with tg_...)' },
      'api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customJsStr: `
      (function () {
        const _fetch = window.fetch;
        window.fetch = async function (input, init) {
          const response = await _fetch(input, init);
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          if (url.includes('/auth/login') && response.status === 200) {
            response.clone().json().then(function (data) {
              if (data && data.accessToken && window.ui) {
                window.ui.preauthorizeApiKey('bearer', data.accessToken);
              }
            }).catch(function () {});
          }
          return response;
        };
      })();
    `,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
