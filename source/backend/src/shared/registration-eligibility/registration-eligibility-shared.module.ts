import { Module } from '@nestjs/common';
import { StudentsSharedModule } from '../students/students-shared.module.js';
import { RegistrationEligibilityReader } from './registration-eligibility.reader.js';

@Module({
  imports: [StudentsSharedModule],
  providers: [RegistrationEligibilityReader],
  exports: [RegistrationEligibilityReader],
})
export class RegistrationEligibilitySharedModule {}
