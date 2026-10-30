import { Module } from '@nestjs/common';
import { RegistrationEligibilitySharedModule } from '../../shared/registration-eligibility/registration-eligibility-shared.module.js';
import { IntegrationInterceptor } from '../../shared/integration-access/integration.interceptor.js';
import { StudentsSharedModule } from '../../shared/students/students-shared.module.js';
import { GraduationModule } from '../graduation/graduation.module.js';
import { StudentPortalModule } from '../student-portal/student-portal.module.js';
import { DdutApiController } from './ddut-api.controller.js';
import { DdutApiService } from './ddut-api.service.js';

@Module({
  imports: [
    StudentsSharedModule,
    RegistrationEligibilitySharedModule,
    GraduationModule,
    StudentPortalModule,
  ],
  controllers: [DdutApiController],
  providers: [DdutApiService, IntegrationInterceptor],
})
export class DdutApiModule {}
