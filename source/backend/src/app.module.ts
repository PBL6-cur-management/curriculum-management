import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './features/health/health.module.js';
import { validateEnv } from './shared/config/env.validation.js';
import { PrismaModule } from './shared/prisma/prisma.module.js';
import { QueueModule } from './shared/queue/queue.module.js';
import { SessionModule } from './shared/session/session.module.js';
import { PasswordModule } from './shared/password/password.module.js';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticatedGuard } from './shared/auth/authenticated.guard.js';
import { CsrfGuard } from './shared/auth/csrf.guard.js';
import { AuthModule } from './features/auth/auth.module.js';
import { AuthzModule } from './shared/authz/authz.module.js';
import { PermissionGuard } from './shared/authz/permission.guard.js';
import { UsersModule } from './features/users/users.module.js';
import { PermissionsModule } from './features/permissions/permissions.module.js';
import { OrgUnitsModule } from './features/org-units/org-units.module.js';
import { SubjectGroupsModule } from './features/subject-groups/subject-groups.module.js';
import { CoursesModule } from './features/courses/courses.module.js';
import { CourseRelationsModule } from './features/course-relations/course-relations.module.js';
import { EquivalenceGroupsModule } from './features/equivalence-groups/equivalence-groups.module.js';
import { ProgramsModule } from './features/programs/programs.module.js';
import { ConsistencyModule } from './features/consistency/consistency.module.js';
import { CurriculumModule } from './features/curriculum/curriculum.module.js';
import { OutcomesModule } from './features/outcomes/outcomes.module.js';
import { SyllabiModule } from './features/syllabi/syllabi.module.js';
import { ChangeRequestsModule } from './features/change-requests/change-requests.module.js';
import { NotificationsModule } from './features/notifications/notifications.module.js';
import { ReleasesModule } from './features/releases/releases.module.js';
import { SemestersModule } from './features/semesters/semesters.module.js';
import { ImportsModule } from './features/imports/imports.module.js';
import { StudentsModule } from './features/students/students.module.js';
import { RegistrationEligibilityModule } from './features/registration-eligibility/registration-eligibility.module.js';
import { GraduationModule } from './features/graduation/graduation.module.js';
import { SchoolSyncModule } from './features/school-db-sync/school-sync.module.js';
import { DdutApiModule } from './features/ddut-api/ddut-api.module.js';
import { IntegrationClientsModule } from './features/integration-clients/integration-clients.module.js';
import { PublicationModule } from './features/publication/publication.module.js';
import { ReportsModule } from './features/reports/reports.module.js';
import { StudentPortalModule } from './features/student-portal/student-portal.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    QueueModule,
    SessionModule,
    PasswordModule,
    HealthModule,
    AuthModule,
    AuthzModule,
    UsersModule,
    PermissionsModule,
    OrgUnitsModule,
    SubjectGroupsModule,
    CoursesModule,
    CourseRelationsModule,
    EquivalenceGroupsModule,
    ProgramsModule,
    CurriculumModule,
    ConsistencyModule,
    OutcomesModule,
    SyllabiModule,
    ChangeRequestsModule,
    NotificationsModule,
    SemestersModule,
    ReleasesModule,
    ImportsModule,
    StudentsModule,
    RegistrationEligibilityModule,
    GraduationModule,
    SchoolSyncModule,
    StudentPortalModule,
    IntegrationClientsModule,
    DdutApiModule,
    ReportsModule,
    PublicationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthenticatedGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
