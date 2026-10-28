import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import type { Env } from '../../shared/config/env.validation.js';
import { CoursesSharedModule } from '../../shared/courses/courses-shared.module.js';
import { BYTES_PER_MB } from '../../shared/files/attachment-types.js';
import { FilesModule } from '../../shared/files/files.module.js';
import { ClosService } from './clos.service.js';
import { GradeFormulaService } from './grade-formula.service.js';
import { SyllabiController } from './syllabi.controller.js';
import { SyllabiService } from './syllabi.service.js';
import { SyllabusAttachmentsService } from './syllabus-attachments.service.js';
import { WeeklyContentsService } from './weekly-contents.service.js';

@Module({
  imports: [
    CoursesSharedModule,
    FilesModule,
    // The size limit is an env value, so it cannot sit in the decorator. Multer keeps the file in memory by default.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        limits: {
          fileSize:
            config.get('ATTACHMENT_MAX_MB', { infer: true }) * BYTES_PER_MB,
          files: 1,
        },
      }),
    }),
  ],
  controllers: [SyllabiController],
  providers: [
    SyllabiService,
    WeeklyContentsService,
    ClosService,
    GradeFormulaService,
    SyllabusAttachmentsService,
  ],
})
export class SyllabiModule {}
