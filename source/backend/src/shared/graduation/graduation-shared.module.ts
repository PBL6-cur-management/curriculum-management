import { Module } from '@nestjs/common';
import { StudentsSharedModule } from '../students/students-shared.module.js';
import { GraduationInputReader } from './graduation-input.reader.js';
import { GraduationEvaluator } from './graduation-evaluator.js';
import { GraduationAuditWriter } from './graduation-audit.writer.js';
import { GraduationNotificationsWriter } from './graduation-notifications.writer.js';

@Module({
  imports: [StudentsSharedModule],
  providers: [
    GraduationInputReader,
    GraduationEvaluator,
    GraduationAuditWriter,
    GraduationNotificationsWriter,
  ],
  exports: [
    GraduationEvaluator,
    GraduationAuditWriter,
    GraduationNotificationsWriter,
  ],
})
export class GraduationSharedModule {}
