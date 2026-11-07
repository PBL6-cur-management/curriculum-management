import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import type { Env } from '../config/env.validation.js';
import { WorkerSwitchService } from './worker-switch.service.js';

@Module({
  imports: [
    DiscoveryModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: {
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
          db: config.get('REDIS_DB', { infer: true }),
        },
        prefix: config.get('BULLMQ_PREFIX', { infer: true }),
      }),
    }),
  ],
  providers: [WorkerSwitchService],
})
export class QueueModule {}
