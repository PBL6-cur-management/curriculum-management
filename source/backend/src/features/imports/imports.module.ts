import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CoursesSharedModule } from '../../shared/courses/courses-shared.module.js';
import { ReleasesSharedModule } from '../../shared/releases/releases-shared.module.js';
import { StudentsSharedModule } from '../../shared/students/students-shared.module.js';
import { CurriculumExportController } from './curriculum-export.controller.js';
import { CurriculumExportService } from './curriculum-export.service.js';
import { IMPORT_QUEUE } from './import.constants.js';
import { ImportsController } from './imports.controller.js';
import { ImportsProcessor } from './imports.processor.js';
import { ImportsReader } from './imports.reader.js';
import { ImportsService } from './imports.service.js';
import { StudentCredentialsService } from './student-credentials.service.js';

@Module({
  imports: [
    CoursesSharedModule,
    ReleasesSharedModule,
    StudentsSharedModule,
    BullModule.registerQueue({ name: IMPORT_QUEUE }),
  ],
  controllers: [ImportsController, CurriculumExportController],
  providers: [
    ImportsService,
    ImportsReader,
    ImportsProcessor,
    CurriculumExportService,
    StudentCredentialsService,
  ],
})
export class ImportsModule {}
