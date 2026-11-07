import { ProgramVersionStatus } from '../../generated/prisma/client.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { todayDate } from '../../shared/time/today.js';

// Vietnam observes no daylight saving, so a fixed offset is exact for Asia/Ho_Chi_Minh.
const APP_UTC_OFFSET = '+07:00';

export const RELEASED_STATUSES = [
  ProgramVersionStatus.PENDING,
  ProgramVersionStatus.ACTIVE,
  ProgramVersionStatus.HISTORICAL,
] as const;

export function isReleased(status: ProgramVersionStatus): boolean {
  return (RELEASED_STATUSES as readonly ProgramVersionStatus[]).includes(
    status,
  );
}

// signedDate is a DATE column (UTC midnight of the calendar day); publishedAt is an instant, read in the app zone.
export function releaseYearOf(
  signedDate: Date | null,
  publishedAt: Date | null,
): number | null {
  if (signedDate) {
    return signedDate.getUTCFullYear();
  }
  if (publishedAt) {
    return todayDate(publishedAt).getUTCFullYear();
  }
  return null;
}

export function releaseYearWhere(
  year: number,
): Prisma.ProgramVersionWhereInput {
  const signed = {
    gte: new Date(`${year}-01-01T00:00:00.000Z`),
    lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
  };
  const published = {
    gte: new Date(`${year}-01-01T00:00:00${APP_UTC_OFFSET}`),
    lt: new Date(`${year + 1}-01-01T00:00:00${APP_UTC_OFFSET}`),
  };
  return {
    OR: [{ signedDate: signed }, { signedDate: null, publishedAt: published }],
  };
}
