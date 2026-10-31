import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../../shared/config/env.validation.js';
import { safeError } from '../../shared/logging/app-logger.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { DependencyStatus, HealthDto, HealthStatus } from './health.dto.js';

const REDIS_PROBE_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.redis = new Redis({
      host: config.get('REDIS_HOST', { infer: true }),
      port: config.get('REDIS_PORT', { infer: true }),
      db: config.get('REDIS_DB', { infer: true }),
      commandTimeout: REDIS_PROBE_TIMEOUT_MS,
    });
    this.redis.on('error', (error: Error) =>
      // The raw message can name the host; the code (ECONNREFUSED, ...) is enough to act on.
      this.logger.warn(
        `health.redis_error errorType=${safeError(error).errorType} errorCode=${safeError(error).errorCode ?? 'none'}`,
      ),
    );
  }

  async check(): Promise<HealthDto> {
    const [database, redis] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(() => this.redis.ping()),
    ]);
    const allUp =
      database === DependencyStatus.Up && redis === DependencyStatus.Up;
    return {
      status: allUp ? HealthStatus.Ok : HealthStatus.Error,
      database,
      redis,
    };
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}

async function probe(call: () => Promise<unknown>): Promise<DependencyStatus> {
  try {
    await call();
    return DependencyStatus.Up;
  } catch {
    return DependencyStatus.Down;
  }
}
