import { Module } from '@nestjs/common';
import { ChangeRequestsSharedModule } from '../change-requests/change-requests-shared.module.js';
import { SyllabusPublisher } from './syllabus.publisher.js';
import { VersionActivator } from './version.activator.js';
import { VersionPublisher } from './version.publisher.js';
import { AppliedProgramVersionReader } from './applied-program-version.reader.js';

// F-15's release core: final approval, initial release, correction and the activation job all promote versions through it.
@Module({
  imports: [ChangeRequestsSharedModule],
  providers: [
    SyllabusPublisher,
    VersionPublisher,
    VersionActivator,
    AppliedProgramVersionReader,
  ],
  exports: [
    SyllabusPublisher,
    VersionPublisher,
    VersionActivator,
    AppliedProgramVersionReader,
  ],
})
export class ReleasesSharedModule {}
