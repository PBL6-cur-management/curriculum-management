import { Module } from '@nestjs/common';
import { ReleasesSharedModule } from '../releases/releases-shared.module.js';
import { AcademicResultsReader } from './academic-results.reader.js';
import { EnrollmentReconciler } from './enrollment-reconciler.js';
import { StudentAccountProvisioner } from './student-account.provisioner.js';
import { StudentAppliedVersionReader } from './student-applied-version.reader.js';

@Module({
  imports: [ReleasesSharedModule],
  providers: [
    StudentAppliedVersionReader,
    AcademicResultsReader,
    EnrollmentReconciler,
    StudentAccountProvisioner,
  ],
  exports: [
    StudentAppliedVersionReader,
    AcademicResultsReader,
    EnrollmentReconciler,
    StudentAccountProvisioner,
  ],
})
export class StudentsSharedModule {}
