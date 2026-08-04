import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const API_MODULES = [
  { name: 'Authentication', tag: 'Authentication',  path: 'auth',      color: '#4f46e5', icon: '🔐' },
  { name: 'Roles',          tag: 'Admin — Roles',   path: 'roles',     color: '#0891b2', icon: '🎭' },
  { name: 'Modules',        tag: 'Modules',         path: 'modules',   color: '#059669', icon: '📦' },
  { name: 'Users',          tag: 'Users',           path: 'users',     color: '#dc2626', icon: '👥' },
  { name: 'SEO',            tag: 'SEO',             path: 'seo',       color: '#d97706', icon: '🔍' },
  { name: 'Languages',      tag: 'Languages',       path: 'languages',     color: '#7c3aed', icon: '🌐' },
  { name: 'Organizations', tag: 'Organizations',   path: 'organizations', color: '#0f766e', icon: '🏢' },
  { name: 'Countries',     tag: 'Countries',       path: 'countries',     color: '#b45309', icon: '🌍' },
  { name: 'Cities',        tag: 'Cities',          path: 'cities',        color: '#6d28d9', icon: '🏙️' },
  { name: 'Destinations',  tag: 'Destinations',    path: 'destinations',  color: '#0369a1', icon: '📍' },
  { name: 'Collections',  tag: 'Collections',     path: 'collections',   color: '#be185d', icon: '🗂️' },
  { name: 'Attractions',  tag: 'Attractions',     path: 'attractions',   color: '#ea580c', icon: '🎡' },
];

function filterDocByTag(document: OpenAPIObject, tag: string): OpenAPIObject {
  const filteredPaths: Record<string, any> = {};
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    const methods: Record<string, any> = {};
    for (const [method, op] of Object.entries(pathItem as Record<string, any>)) {
      if (Array.isArray((op as any).tags) && (op as any).tags.includes(tag)) {
        methods[method] = op;
      }
    }
    if (Object.keys(methods).length) filteredPaths[path] = methods;
  }
  return { ...document, paths: filteredPaths };
}

function landingHtml(): string {
  const cards = API_MODULES.map(m => `
    <a class="card" href="/docs/${m.path}" style="--c:${m.color}">
      <span class="icon">${m.icon}</span>
      <span class="name">${m.name}</span>
      <span class="desc">View ${m.name} endpoints →</span>
    </a>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>TG Backend — API Docs</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;min-height:100vh}
    .header{background:#0f172a;color:#fff;padding:52px 24px;text-align:center}
    .header h1{font-size:2rem;font-weight:700;letter-spacing:-.5px}
    .header p{margin-top:10px;color:#94a3b8;font-size:1rem}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px;max-width:880px;margin:44px auto 0;padding:0 24px}
    .card{display:flex;flex-direction:column;gap:8px;padding:26px 22px;background:#fff;border-radius:12px;border-left:4px solid var(--c);text-decoration:none;color:#1e293b;box-shadow:0 1px 4px rgba(0,0,0,.08);transition:transform .15s,box-shadow .15s}
    .card:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,.1)}
    .icon{font-size:2rem}
    .name{font-size:1.05rem;font-weight:600}
    .desc{font-size:.8rem;color:#64748b}
    .footer{text-align:center;padding:32px 0 52px}
    .all{display:inline-block;padding:12px 36px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:500;font-size:.95rem;transition:background .15s}
    .all:hover{background:#1e293b}
  </style>
</head>
<body>
  <div class="header">
    <h1>TG Backend API</h1>
    <p>Select a module to explore its endpoints</p>
  </div>
  <div class="grid">${cards}</div>
  <div class="footer"><a class="all" href="/docs/all">View All APIs</a></div>
</body>
</html>`;
}

const AUTO_TOKEN_JS = `
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
`;

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

  const fullDocument = SwaggerModule.createDocument(app, swaggerConfig);

  const moduleSwaggerOptions = {
    swaggerOptions: { persistAuthorization: true },
    customJsStr: AUTO_TOKEN_JS,
  };

  // ─── Landing page at /docs ─────────────────────────────────────────────────
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/docs', (_req: any, res: any) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(landingHtml());
  });

  // ─── Full Swagger at /docs/all ─────────────────────────────────────────────
  SwaggerModule.setup('docs/all', app, fullDocument, moduleSwaggerOptions);

  // ─── Per-module Swagger UIs ────────────────────────────────────────────────
  for (const mod of API_MODULES) {
    const filteredDoc = filterDocByTag(fullDocument, mod.tag);
    SwaggerModule.setup(`docs/${mod.path}`, app, filteredDoc, {
      ...moduleSwaggerOptions,
      customSiteTitle: `${mod.name} — TG API`,
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
