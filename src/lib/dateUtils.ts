import {
  differenceInMinutes,
  differenceInWeeks,
  format,
  formatDistanceStrict,
  startOfDay,
  endOfDay,
  isWithinInterval,
} from 'date-fns';

export function ageInWeeks(dob: string): number {
  return differenceInWeeks(new Date(), new Date(dob));
}

export function ageLabel(dob: string): string {
  const weeks = ageInWeeks(dob);
  if (weeks < 16) return `${weeks} week${weeks === 1 ? '' : 's'}`;
  const months = Math.floor(weeks / 4.33);
  return `${months} month${months === 1 ? '' : 's'}`;
}

export function minutesSince(ts: string | Date): number {
  return differenceInMinutes(new Date(), new Date(ts));
}

export function minutesBetween(start: string | Date, end: string | Date): number {
  return differenceInMinutes(new Date(end), new Date(start));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDurationLive(startTs: string | Date): string {
  const mins = minutesSince(startTs);
  return formatDuration(mins);
}

export function formatTime(ts: string | Date): string {
  return format(new Date(ts), 'h:mma').toLowerCase();
}

export function formatTimeRange(start: string | Date, end: string | Date | null): string {
  const s = formatTime(start);
  if (!end) return `${s} – now`;
  return `${s} – ${formatTime(end)}`;
}

export function formatDateHeading(date: Date): string {
  return format(date, 'EEEE, MMMM d');
}

export function isTodayDate(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function calendarDayOf(ts: string | Date): string {
  return format(new Date(ts), 'yyyy-MM-dd');
}

export function currentHour(): number {
  return new Date().getHours();
}
