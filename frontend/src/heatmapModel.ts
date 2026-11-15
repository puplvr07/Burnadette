import type { Meta, Metric, Source, WeekRow } from "./types";
import { addCalendarDays } from "./calendarModel";
import { sourceDateRange } from "./availability";

export interface HeatmapSlot { key: string; year: number; col: number; start: string; end: string; kind: "record" | "missing" | "outside" | "no-week"; record?: WeekRow }
export function heatmapLayout(weeks: WeekRow[], start: string, end: string, meta: Meta, source: Source) {
  const first = Math.max(+start.slice(0, 4), +meta.date_start.slice(0, 4));
  const last = Math.min(+end.slice(0, 4), +meta.date_end.slice(0, 4));
  const years = Number.isFinite(first) && Number.isFinite(last) && last >= first ? Array.from({ length: last - first + 1 }, (_, i) => first + i) : [];
  const records = new Map(weeks.map((week) => [week.week_start, week]));
  const available = sourceDateRange(meta, source);
  const rows = years.map((year) => {
    const jan = `${year}-01-01`;
    const weekday = new Date(`${jan}T00:00:00Z`).getUTCDay();
    const offset = (8 - weekday) % 7;
    return Array.from({ length: 53 }, (_, col): HeatmapSlot => {
      const date = addCalendarDays(jan, offset + col * 7);
      const record = records.get(date);
      const noWeek = +date.slice(0, 4) !== year;
      const outside = date < start || date > end || date < available.start || date > available.end;
      return { key: date, year, col, start: date, end: addCalendarDays(date, 6), kind: noWeek ? "no-week" : record && date >= start && date <= end ? "record" : outside ? "outside" : "missing", record: noWeek ? undefined : record };
    });
  });
  return { years, rows };
}

export function heatmapScale(weeks: WeekRow[], metric: Metric) {
  const values = weeks.map((week) => metric === "activity" ? week.value : week.anomaly).filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  const maximum = metric === "anomaly" ? 100 : values.length ? values[Math.floor(values.length * .98)] : 0;
  return { values, maximum, clipped: metric === "activity" ? values.filter((v) => v > maximum).length : 0 };
}
