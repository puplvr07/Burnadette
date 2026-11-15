import type { Meta, Metric, Source, WeekRow } from "./types";

export function sourceDateRange(meta: Meta, source: Source) {
  return { start: source === "viirs" && meta.viirs_start > meta.date_start ? meta.viirs_start : meta.date_start, end: meta.date_end };
}

export function availabilitySummary(meta: Meta, source: Source, metric: Metric, start: string, end: string, weeks: WeekRow[]) {
  const available = sourceDateRange(meta, source);
  const validDates = !!start && !!end && start <= end;
  const overlaps = validDates && start <= available.end && end >= available.start;
  const partial = overlaps && (start < available.start || end > available.end);
  const values = weeks.map((week) => metric === "activity" ? week.value : week.anomaly);
  const observed = values.filter((value): value is number => value != null && Number.isFinite(value));
  return {
    available, validDates, overlaps, partial,
    records: weeks.length, observed: observed.length, unavailable: values.length - observed.length,
    zeros: observed.filter((value) => value === 0).length,
    gaps: meta.gaps.filter((gap) => validDates && gap.start <= end && gap.end >= start),
  };
}
