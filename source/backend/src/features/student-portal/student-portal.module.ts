import { Module } from '@nestjs/common';
import { FilesModule } from '../../shared/files/files.module.js';
import { RegistrationEligibilitySharedModule } from '../../shared/registration-eligibility/registration-eligibility-shared.module.js';
import { StudentsSharedModule } from '../../shared/students/students-shared.module.js';
import { StudentPortalController } from './student-portal.controller.js';
import { StudentPortalService } from './student-portal.service.js';

@Module({
  imports: [
    StudentsSharedModule,
    RegistrationEligibilitySharedModule,
    FilesModule,
  ],
  controllers: [StudentPortalController],
  providers: [StudentPortalService],
  exports: [StudentPortalService],
})
export class StudentPortalModule {}
