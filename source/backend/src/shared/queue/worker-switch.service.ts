import { WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService } from '@nestjs/core';
import type { Env } from '../config/env.validation.js';

/**
 * Stops every BullMQ worker of this process when QUEUE_WORKERS_ENABLED=false.
 * The web-only API instances behind the load balancer still enqueue jobs; the single
 * worker instance (VM1) processes them, so the "concurrency: 1" processors stay single.
 */
@Injectable()
export class WorkerSwitchService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkerSwitchService.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('QUEUE_WORKERS_ENABLED', { infer: true }) !== 'false') return;
    const hosts = this.discovery
      .getProviders()
      .map((wrapper) => wrapper.instance as unknown)
      .filter((instance): instance is WorkerHost => instance instanceof WorkerHost);
    await Promise.all(hosts.map((host) => host.worker.close()));
    this.logger.log(`queue workers disabled on this instance (${hosts.length} closed)`);
  }
}
