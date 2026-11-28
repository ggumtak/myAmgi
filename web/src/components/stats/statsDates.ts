/**
 * The calendar date Anki currently counts as "today" (day offset 0), as local midnight.
 * Anki's day starts at the rollover hour, so between 00:00 and the rollover hour it is
 * still the previous day.
 */
export function ankiToday(now: Date, rolloverHour: number): Date {
  const hour = Number.isFinite(rolloverHour) ? Math.max(0, Math.min(23, rolloverHour)) : 0;
  const shifted = new Date(now.getTime());
  shifted.setHours(shifted.getHours() - hour);
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}
