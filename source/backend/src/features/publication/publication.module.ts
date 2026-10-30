import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CurriculumSharedModule } from '../../shared/curriculum/curriculum-shared.module.js';
import { FilesModule } from '../../shared/files/files.module.js';
import { OutcomesSharedModule } from '../../shared/outcomes/outcomes-shared.module.js';
import { PdfRendererService } from './pdf/pdf-renderer.service.js';
import { ProgramPdfExportsService } from './pdf/program-pdf-exports.service.js';
import { ProgramPdfProcessor } from './pdf/program-pdf.processor.js';
import { ProgramHealthService } from './program-health.service.js';
import { PDF_QUEUE } from './publication.constants.js';
import { PublicationController } from './publication.controller.js';
import { PublicationSourceReader } from './publication-source.reader.js';
import { VersionTimelineReader } from './version-timeline.reader.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: PDF_QUEUE }),
    CurriculumSharedModule,
    OutcomesSharedModule,
    FilesModule,
  ],
  controllers: [PublicationController],
  providers: [
    PublicationSourceReader,
    VersionTimelineReader,
    ProgramHealthService,
    ProgramPdfExportsService,
    PdfRendererService,
    ProgramPdfProcessor,
  ],
})
export class PublicationModule {}
