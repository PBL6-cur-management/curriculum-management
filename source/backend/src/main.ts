import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './app.setup.js';
import type { Env } from './shared/config/env.validation.js';
import { createAppLogger } from './shared/logging/app-logger.js';

// F-27 BE-02: in production, JSON lines on stdout from the first line on (Docker rotates them). In development the
// readable Nest console stays. The app module loads inside the try block, so a malformed environment ends in a
// sanitized log record and exit code 1, not a config dump.
const json = process.env.NODE_ENV === 'production';
const logger = createAppLogger({ level: process.env.LOG_LEVEL });
try {
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    ...(json ? { logger } : {}),
    abortOnError: false,
  });
  configureApp(app, json ? logger : undefined);
  app.enableShutdownHooks();
  const config: ConfigService<Env, true> = app.get(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
} catch (error) {
  // Matched by name: importing env.validation here would load it before reflect-metadata.
  if (error instanceof Error && error.name === 'EnvValidationError') {
    logger.event('fatal', 'bootstrap.invalid_environment', {
      properties: (error as Error & { properties: string[] }).properties,
    });
  } else {
    logger.error(error, 'Bootstrap');
  }
  process.exitCode = 1;
}
