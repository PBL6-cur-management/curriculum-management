import { WorkerHost } from '@nestjs/bullmq';
import { describe, expect, it, vi } from 'vitest';
import { WorkerSwitchService } from './worker-switch.service.js';

class FakeProcessor extends WorkerHost {
  readonly close = vi.fn(async () => undefined);
  override get worker() {
    return { close: this.close } as never;
  }
  async process(): Promise<void> {}
}

function build(enabled: 'true' | 'false', instances: unknown[]) {
  const discovery = { getProviders: () => instances.map((instance) => ({ instance })) };
  const config = { get: () => enabled };
  return new WorkerSwitchService(discovery as never, config as never);
}

describe('WorkerSwitchService', () => {
  it('keeps the workers running by default', async () => {
    const processor = new FakeProcessor();
    await build('true', [processor, {}]).onApplicationBootstrap();
    expect(processor.close).not.toHaveBeenCalled();
  });

  it('closes every worker when QUEUE_WORKERS_ENABLED=false', async () => {
    const a = new FakeProcessor();
    const b = new FakeProcessor();
    await build('false', [a, { notAWorker: true }, null, b]).onApplicationBootstrap();
    expect(a.close).toHaveBeenCalledOnce();
    expect(b.close).toHaveBeenCalledOnce();
  });
});
