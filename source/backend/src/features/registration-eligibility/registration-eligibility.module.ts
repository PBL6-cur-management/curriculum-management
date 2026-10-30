import { Module } from '@nestjs/common';
import { RegistrationEligibilitySharedModule } from '../../shared/registration-eligibility/registration-eligibility-shared.module.js';
import { EligibilityStudentsController } from './eligibility-students.controller.js';
import { EligibilityStudentsService } from './eligibility-students.service.js';
import { RegistrationEligibilityController } from './registration-eligibility.controller.js';

@Module({
  imports: [RegistrationEligibilitySharedModule],
  controllers: [
    RegistrationEligibilityController,
    EligibilityStudentsController,
  ],
  providers: [EligibilityStudentsService],
})
export class RegistrationEligibilityModule {}
