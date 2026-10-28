import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { StudentsSharedModule } from '../../shared/students/students-shared.module.js';
import { EnrollmentReconciliationProcessor } from './enrollment-reconciliation.processor.js';
import {
  EnrollmentReconciliationScheduler,
  STUDENT_ENROLLMENT_QUEUE,
} from './enrollment-reconciliation.scheduler.js';
import { StudentEnrollmentsService } from './student-enrollments.service.js';
import { StudentsController } from './students.controller.js';
import { StudentsReadService } from './students-read.service.js';

@Module({
  imports: [
    StudentsSharedModule,
    BullModule.registerQueue({ name: STUDENT_ENROLLMENT_QUEUE }),
  ],
  controllers: [StudentsController],
  providers: [
    StudentsReadService,
    StudentEnrollmentsService,
    EnrollmentReconciliationScheduler,
    EnrollmentReconciliationProcessor,
  ],
})
export class StudentsModule {}
