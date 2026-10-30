import { Module } from '@nestjs/common';
import { ChangeRequestStatisticsService } from './change-request-statistics.service.js';
import { ReportSourceReader } from './report-source.reader.js';
import { ReportWorkbooksService } from './report-workbooks.service.js';
import { ReportsController } from './reports.controller.js';

@Module({
  controllers: [ReportsController],
  providers: [
    ReportSourceReader,
    ReportWorkbooksService,
    ChangeRequestStatisticsService,
  ],
})
export class ReportsModule {}
