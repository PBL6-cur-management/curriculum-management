import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DdutApiModule } from './features/ddut-api/ddut-api.module.js';
import { DDUT_API_KEY_SCHEME } from './features/ddut-api/ddut-api.controller.js';
import { INTEGRATION } from './shared/integration-access/integration.constants.js';
import { AllExceptionsFilter } from './shared/filter/all-exceptions.filter.js';
import { validationExceptionFactory } from './shared/exception/validation-exception.factory.js';
import type { Env } from './shared/config/env.validation.js';
import { SessionStoreService } from './shared/session/session-store.service.js';
import {
  SESSION_COOKIE_NAME,
  TRUSTED_PROXY_HOPS,
} from './shared/session/session.constants.js';

// A syllabus section with a table can exceed Express's 100 KB JSON default.
const JSON_BODY_LIMIT = '1mb';

export const API_PREFIX = 'api';
// The frontend generates its types from `${API_DOCS_PATH}-json`.
export const API_DOCS_PATH = `${API_PREFIX}/docs`;

// Shared by main.ts and the e2e tests so both serve the same routes.
export function configureApp(app: NestExpressApplication): void {
  const config: ConfigService<Env, true> = app.get(ConfigService);
  if (config.get('NODE_ENV', { infer: true }) === 'production')
    app.set('trust proxy', TRUSTED_PROXY_HOPS);
  const sessions = app.get(SessionStoreService).handler;
  // The dDUT API (F-21) authenticates by key only: no browser session is read, renewed or created under /api/v1.
  app.use((request: Request, response: Response, next: NextFunction) =>
    isDdutPath(request.path) ? next() : sessions(request, response, next),
  );
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const document = new DocumentBuilder()
    .setTitle('Quản lý Chương trình đào tạo')
    .setVersion('0.1')
    .addCookieAuth(SESSION_COOKIE_NAME)
    .build();
  SwaggerModule.setup(API_DOCS_PATH, app, () =>
    SwaggerModule.createDocument(app, document),
  );
  SwaggerModule.setup(DDUT_DOCS_PATH, app, () => createDdutDocument(app));
}

export const DDUT_PREFIX = `/${API_PREFIX}/v1`;
export const DDUT_DOCS_PATH = `${API_PREFIX}/v1/docs`;

// Exact segment match: /api/v1 and below, never /api/v10.
export function isDdutPath(path: string): boolean {
  return path === DDUT_PREFIX || path.startsWith(`${DDUT_PREFIX}/`);
}

// The published contract dDUT builds against: only the six v1 resources, key-authenticated.
export function createDdutDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('API dDUT — Chương trình đào tạo (chỉ đọc)')
    .setDescription(
      'Sáu tài nguyên chỉ đọc cho máy chủ tin cậy của dDUT. Gửi khóa trong header X-Api-Key; không dùng cookie. Giới hạn số lần gọi mỗi phút theo từng khóa (429 kèm Retry-After). Mọi lời gọi được ghi nhận.',
    )
    .setVersion(INTEGRATION.OPENAPI_VERSION)
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
      DDUT_API_KEY_SCHEME,
    )
    .build();
  return SwaggerModule.createDocument(app, config, {
    include: [DdutApiModule],
  });
}
