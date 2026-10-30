import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StudentsSharedModule } from '../../shared/students/students-shared.module.js';
import { GraduationSharedModule } from '../../shared/graduation/graduation-shared.module.js';
import { GRADUATION_QUEUE } from '../../shared/graduation/graduation.constants.js';
import { GraduationController } from './graduation.controller.js';
import { GraduationBatchesController } from './graduation-batches.controller.js';
import { GraduationService } from './graduation.service.js';
import { GraduationBatchesService } from './graduation-batches.service.js';
import { GraduationRosterReader } from './graduation-roster.reader.js';
import { GraduationBatchRunner } from './graduation-batch.runner.js';
import { GraduationResultChangeScanner } from './graduation-result-change.scanner.js';
import { GraduationReauditRunner } from './graduation-reaudit.runner.js';
import { GraduationReauditService } from './graduation-reaudit.service.js';
import { GraduationExportService } from './graduation-export.service.js';
import { GraduationOptionsService } from './graduation-options.service.js';
import { GraduationScheduler } from './graduation.scheduler.js';
import { GraduationProcessor } from './graduation.processor.js';
import {
  GRADUATION_JOB_HANDLERS,
  type GraduationJobHandlers,
} from './graduation-jobs.constants.js';

@Module({
  imports: [
    GraduationSharedModule,
    StudentsSharedModule,
    BullModule.registerQueue({ name: GRADUATION_QUEUE }),
  ],
  controllers: [GraduationController, GraduationBatchesController],
  providers: [
    GraduationService,
    GraduationBatchesService,
    GraduationRosterReader,
    GraduationBatchRunner,
    GraduationResultChangeScanner,
    GraduationReauditRunner,
    GraduationReauditService,
    GraduationExportService,
    GraduationOptionsService,
    GraduationScheduler,
    GraduationProcessor,
    {
      provide: GRADUATION_JOB_HANDLERS,
      inject: [GraduationResultChangeScanner, GraduationReauditRunner],
      useFactory: (
        scanner: GraduationResultChangeScanner,
        runner: GraduationReauditRunner,
      ) =>
        ({
          scanChanges: async () => {
            await scanner.scan();
          },
          runReaudit: (taskId: string) => runner.run(taskId),
          recoverReaudits: async () => {
            await runner.recover();
          },
        }) satisfies GraduationJobHandlers,
    },
  ],
})
export class GraduationModule {}
