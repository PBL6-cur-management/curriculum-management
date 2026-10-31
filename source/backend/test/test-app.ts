import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { configureApp } from '../src/app.setup.js';
import type { AppLogger } from '../src/shared/logging/app-logger.js';

// Pass a logger only to assert on the request log (logging.e2e-spec.ts); other specs run without one.
export async function createTestApp(
  logger?: AppLogger,
): Promise<NestExpressApplication> {
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, logger);
  await app.init();
  return app;
}
