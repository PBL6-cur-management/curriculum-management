import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../shared/config/env.validation.js';
import { ReleasesSharedModule } from '../../shared/releases/releases-shared.module.js';
import { SchoolSnapshotApplier } from './school-snapshot.applier.js';
import { SchoolSyncCipher } from './school-sync.cipher.js';
import { SCHOOL_SYNC_QUEUE } from './school-sync.constants.js';
import { SchoolSyncController } from './school-sync.controller.js';
import { SchoolSyncProcessor } from './school-sync.processor.js';
import { SchoolSyncRunner } from './school-sync.runner.js';
import { SchoolSyncService } from './school-sync.service.js';
import {
  MssqlSchoolSourceReader,
  SchoolSourceReader,
} from './school-source.reader.js';

@Module({
  imports: [
    ReleasesSharedModule,
    BullModule.registerQueue({ name: SCHOOL_SYNC_QUEUE }),
  ],
  controllers: [SchoolSyncController],
  providers: [
    SchoolSyncService,
    SchoolSyncRunner,
    SchoolSnapshotApplier,
    SchoolSyncProcessor,
    { provide: SchoolSourceReader, useClass: MssqlSchoolSourceReader },
    {
      provide: SchoolSyncCipher,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SchoolSyncCipher(config.get('SCHOOL_SYNC_ENCRYPTION_KEY', { infer: true })),
    },
  ],
})
export class SchoolSyncModule {}
