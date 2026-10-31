import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ApprovalMaintenanceService } from './approval-maintenance.service.js';
import { EMAIL_QUEUE, MAINTENANCE_QUEUE } from './delivery.constants.js';
import { EmailPumpService } from './email-pump.service.js';

// One pump at a time keeps "claim, then send once" simple to reason about.
@Processor(EMAIL_QUEUE, { concurrency: 1 })
export class EmailPumpProcessor extends WorkerHost {
  constructor(private readonly pump: EmailPumpService) {
    super();
  }

  process(_job: Job): Promise<unknown> {
    return this.pump.pump();
  }
}

@Processor(MAINTENANCE_QUEUE, { concurrency: 1 })
export class ApprovalMaintenanceProcessor extends WorkerHost {
  constructor(private readonly maintenance: ApprovalMaintenanceService) {
    super();
  }

  process(_job: Job): Promise<unknown> {
    return this.maintenance.run();
  }
}
