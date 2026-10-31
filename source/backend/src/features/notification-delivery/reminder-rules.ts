// F-25 D9: the first reminder goes the day a request has waited MORE than maxDays (US-116 "quá"),
// then every repeatDays. After downtime only the latest due cycle is sent, never a backlog.
export function reminderCycle(
  daysWaiting: number,
  maxDays: number,
  repeatDays: number,
): number | null {
  if (daysWaiting <= maxDays) return null;
  return Math.floor((daysWaiting - maxDays - 1) / repeatDays);
}
