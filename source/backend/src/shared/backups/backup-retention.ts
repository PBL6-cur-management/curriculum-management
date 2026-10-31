import { BACKUP_POLICY } from './backup.constants.js';
import type { BackupStore } from './backup-store.js';

// BE-05, run under the operation lock after a set was published or reused. Keeps the newest 30 complete pairs;
// failed attempts never count and never push a good set out. Each step is recorded first, so reconcile can
// finish an expiry a crash interrupted.
export async function applyRetention(
  store: BackupStore,
  keep: number = BACKUP_POLICY.RETENTION_COUNT,
): Promise<string[]> {
  const published = new Set(await store.listSetIds());
  const good = (await store.listRuns())
    .filter((run) => run.status === 'SUCCEEDED' && published.has(run.id))
    .sort((a, b) =>
      a.completedAt === b.completedAt
        ? b.id.localeCompare(a.id)
        : (b.completedAt ?? '').localeCompare(a.completedAt ?? ''),
    );
  const expired: string[] = [];
  for (const run of good.slice(keep)) {
    await store.readManifest(run.id);
    const marked = { ...run, retentionIntent: run.id };
    await store.writeRun(marked);
    const trash = await store.moveToTrash(run.id);
    await store.writeRun({
      ...marked,
      status: 'EXPIRED',
      retentionIntent: null,
    });
    await store.removeOwned(trash, 'trash');
    expired.push(run.id);
  }
  return expired;
}
