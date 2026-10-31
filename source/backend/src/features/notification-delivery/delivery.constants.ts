export const EMAIL_QUEUE = 'notification-email';
export const EMAIL_PUMP_JOB = 'pump';
// The pump looks for committed PENDING deliveries this often; a lost job only delays email, never loses it.
export const EMAIL_PUMP_EVERY_MS = 30_000;
export const EMAIL_BATCH = 20;
// A delivery claimed this long ago and never finished was cut off mid-send: it may or may not have gone.
export const SENDING_STALE_MS = 10 * 60_000;

export const MAINTENANCE_QUEUE = 'approval-maintenance';
export const MAINTENANCE_JOB = 'daily';
// Just after midnight in Viet Nam, after the release activation job (00:05).
export const MAINTENANCE_CRON = '10 0 * * *';
