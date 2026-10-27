import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CurriculumSharedModule } from '../../shared/curriculum/curriculum-shared.module.js';
import { ProgramsSharedModule } from '../../shared/programs/programs-shared.module.js';
import { ReleasesSharedModule } from '../../shared/releases/releases-shared.module.js';
import { CorrectionsController } from './corrections.controller.js';
import { CorrectionsService } from './corrections.service.js';
import { ReleaseActivationProcessor } from './release-activation.processor.js';
import {
  RELEASE_ACTIVATION_QUEUE,
  ReleaseActivationScheduler,
} from './release-activation.scheduler.js';
import { ReleasesController } from './releases.controller.js';
import { ReleasesService } from './releases.service.js';
import { VersionHistoryController } from './version-history.controller.js';
import { VersionHistoryReader } from './version-history.reader.js';
import { VersionComparisonController } from './version-comparison.controller.js';
import { VersionComparisonService } from './version-comparison.service.js';
import { CohortVersionsController } from './cohort-versions.controller.js';
import { CohortVersionsService } from './cohort-versions.service.js';

@Module({
  imports: [
    ReleasesSharedModule,
    CurriculumSharedModule,
    ProgramsSharedModule,
    BullModule.registerQueue({ name: RELEASE_ACTIVATION_QUEUE }),
  ],
  controllers: [
    ReleasesController,
    VersionHistoryController,
    CorrectionsController,
    VersionComparisonController,
    CohortVersionsController,
  ],
  providers: [
    ReleasesService,
    CorrectionsService,
    VersionHistoryReader,
    VersionComparisonService,
    CohortVersionsService,
    ReleaseActivationScheduler,
    ReleaseActivationProcessor,
  ],
})
export class ReleasesModule {}
