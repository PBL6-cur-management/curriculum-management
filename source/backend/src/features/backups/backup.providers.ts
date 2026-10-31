import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../shared/config/env.validation.js';
import { backupConfig } from '../../shared/backups/backup-config.js';
import { BackupEngine } from '../../shared/backups/backup-engine.js';
import {
  NativePostgresTools,
  type PostgresTools,
} from '../../shared/backups/postgres-tools.js';

export const BACKUP_QUEUE = 'database-backups';
export const BACKUP_JOB = 'reconcile-daily-backup';
export const BACKUP_CONFIG = Symbol('BACKUP_CONFIG');
export const POSTGRES_TOOLS = Symbol('POSTGRES_TOOLS');

export const BACKUP_PROVIDERS: Provider[] = [
  {
    provide: BACKUP_CONFIG,
    inject: [ConfigService],
    useFactory: (config: ConfigService<Env, true>) => backupConfig(config),
  },
  {
    provide: POSTGRES_TOOLS,
    inject: [BACKUP_CONFIG],
    useFactory: (config: ReturnType<typeof backupConfig>): PostgresTools =>
      new NativePostgresTools(config.pgDumpPath, config.pgRestorePath),
  },
  {
    provide: BackupEngine,
    inject: [BACKUP_CONFIG, POSTGRES_TOOLS],
    useFactory: (
      config: ReturnType<typeof backupConfig>,
      tools: PostgresTools,
    ) => new BackupEngine(config, tools),
  },
];
