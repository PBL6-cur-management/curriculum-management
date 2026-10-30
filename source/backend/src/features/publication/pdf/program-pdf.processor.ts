import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { FileStorageService } from '../../../shared/files/file-storage.service.js';
import { PDF_JOB, PDF_QUEUE } from '../publication.constants.js';
import { PdfRendererService } from './pdf-renderer.service.js';
import { pdfPath, type PdfJobData } from './program-pdf-exports.service.js';
import { programPdfHtml } from './program-pdf.template.js';

// One render at a time: Chromium is the heaviest thing the server runs.
@Processor(PDF_QUEUE, { concurrency: 1 })
export class ProgramPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(ProgramPdfProcessor.name);

  constructor(
    private readonly renderer: PdfRendererService,
    private readonly files: FileStorageService,
  ) {
    super();
  }

  async process(job: Job<PdfJobData>): Promise<{ bytes: number }> {
    if (job.name !== PDF_JOB) return { bytes: 0 };
    try {
      const pdf = await this.renderer.render(programPdfHtml(job.data.snapshot));
      const path = pdfPath(job.data.exportId);
      // A retry after a crash may find the previous attempt's file.
      await this.files.remove(path);
      await this.files.remove(`${path}.part`);
      await this.files.write(path, pdf);
      return { bytes: pdf.byteLength };
    } catch (error) {
      this.logger.error(`PDF ${job.data.exportId} failed: ${String(error)}`);
      throw error;
    }
  }
}
