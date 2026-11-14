import type { Meta, Source, WeekRow } from "./types";

const DAY = 86400000;
export const addCalendarDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export const shiftCalendarMonth = (month: string, delta: number) => {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
};
export const formatCalendarDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const formatCalendarValue = (value: number | null) => value == null || !Number.isFinite(value) ? "Unavailable" : value !== 0 && Math.abs(value) < .001 ? value.toExponential(2) : value.toLocaleString("en", { maximumFractionDigits: 3 });

export function calendarCoverage(start: string, end: string, meta: Meta, source: Source) {
  const starts = [start, meta.date_start, ...(source === "viirs" ? [meta.viirs_start] : [])].sort();
  const first = starts[starts.length - 1];
  const last = [end, meta.date_end].sort()[0];
  return { start: first, end: last, valid: !!start && !!end && first <= last };
}

export interface CalendarWeek {
  start: string;
  end: string;
  days: string[];
  inRange: boolean;
  observation?: WeekRow;
}

export function monthWeeks(month: string, start: string, end: string, observations: WeekRow[]): CalendarWeek[] {
  const first = `${month}-01`, next = `${shiftCalendarMonth(month, 1)}-01`;
  const weekday = new Date(`${first}T00:00:00Z`).getUTCDay();
  let monday = addCalendarDays(first, -(weekday + 6) % 7);
  const byStart = new Map(observations.map((week) => [week.week_start, week]));
  const rows: CalendarWeek[] = [];
  while (monday < next) {
    const sunday = addCalendarDays(monday, 6);
    rows.push({ start: monday, end: sunday, days: Array.from({ length: 7 }, (_, i) => addCalendarDays(monday, i)), inRange: monday <= end && sunday >= start, observation: byStart.get(monday) });
    monday = addCalendarDays(monday, 7);
  }
  return rows;
}

export function weekMetricState(row: CalendarWeek, metric: "activity" | "anomaly") {
  if (!row.inRange) return "outside";
  if (!row.observation) return "absent";
  const value = metric === "activity" ? row.observation.value : row.observation.anomaly;
  if (value == null || !Number.isFinite(value)) return "unavailable";
  return value === 0 ? "zero" : "observed";
}
