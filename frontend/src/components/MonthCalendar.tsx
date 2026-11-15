import { useRef, useState } from "react";
import { emptyTyping, typeMonth, typeYear } from "../typedDate";
import type { TypingState } from "../typedDate";
import { activeSquaresText, provenanceLabel, sensitivityText } from "../display";
import type { Meta, Metric, Source, WeekRow } from "../types";
import { colorFor } from "../colors";
import { calendarCoverage, formatCalendarDate, formatCalendarValue, monthWeeks, shiftCalendarMonth, weekMetricState } from "../calendarModel";
import type { CalendarWeek } from "../calendarModel";

interface Props { weeks: WeekRow[]; start: string; end: string; metric: Metric; source: Source; meta: Meta; loading?: boolean; error?: string; onRetry?: () => void }
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const sourceTitle = (source: Source) => source === "modis" ? "MODIS" : source === "viirs" ? "VIIRS" : "Harmonized";
const provenance = provenanceLabel;

export default function MonthCalendar({ weeks, start, end, metric, source, meta, loading = false, error = "", onRetry }: Props) {
  const [requestedMonth, setRequestedMonth] = useState("");
  const monthTyping = useRef<TypingState>(emptyTyping);
  const yearTyping = useRef<TypingState>(emptyTyping);
  const [picked, setPicked] = useState("");
  if (!start || !end || start > end) return <div className="calendar-state" role="status"><h3>Choose a valid date range</h3><p>Complete the From and To filters above, with the start date on or before the end date.</p></div>;
  const coverage = calendarCoverage(start, end, meta, source);
  if (!coverage.valid) return <div className="calendar-state" role="status"><h3>No source coverage in this date range</h3><p>The selected dates do not overlap the available {sourceTitle(source)} coverage. Change the source or date filters above.</p></div>;
  const minMonth = coverage.start.slice(0, 7), maxMonth = coverage.end.slice(0, 7);
  const month = !requestedMonth || requestedMonth < minMonth ? minMonth : requestedMonth > maxMonth ? maxMonth : requestedMonth;
  const [year, monthIndex] = month.split("-").map(Number);
  const years = Array.from({ length: +maxMonth.slice(0, 4) - +minMonth.slice(0, 4) + 1 }, (_, i) => +minMonth.slice(0, 4) + i);
  const rows = monthWeeks(month, coverage.start, coverage.end, weeks);
  const inRange = rows.filter((row) => row.inRange);
  const recorded = inRange.filter((row) => row.observation);
  const selected = inRange.find((row) => row.start === picked) ?? recorded[0] ?? inRange[0];
  const observation = selected?.observation;
  const metricLabel = metric === "anomaly" ? "Anomaly percentile" : "Activity";
  const numericValues = weeks.map((w) => metric === "anomaly" ? w.anomaly : w.value).filter((v): v is number => v != null && Number.isFinite(v));
  const maximum = metric === "anomaly" ? 100 : Math.max(0, ...numericValues);
  const selectMonth = (candidate: string) => setRequestedMonth(candidate < minMonth ? minMonth : candidate > maxMonth ? maxMonth : candidate);
  const gapLabels = (row: CalendarWeek) => meta.gaps.filter((gap) => row.start <= gap.end && row.end >= gap.start).map((gap) => gap.label);
  const metricValue = (w: WeekRow) => metric === "anomaly" ? w.anomaly : w.value;
  const rowStatus = (row: CalendarWeek) => {
    const state = weekMetricState(row, metric);
    if (state === "outside") return "Outside selected coverage";
    if (state === "absent") return "No record returned";
    if (state === "unavailable") return `${metric === "anomaly" ? "Anomaly" : "Activity"} unavailable`;
    if (state === "zero" && metric === "activity") return "Zero recorded activity";
    return metric === "anomaly" ? "Percentile · 0–100" : "Weekly activity value";
  };
  const rangeText = (row: CalendarWeek) => `${formatCalendarDate(row.start)} – ${formatCalendarDate(row.end)}`;

  return (
    <div className="monthly-calendar structured-calendar">
      <header className="calendar-month-header">
        <div><p className="eyebrow">WEEKLY OBSERVATIONS</p><h3 id="calendar-month-heading">{MONTHS[monthIndex - 1]} {year}</h3><p>One row is one week. Dates are calendar guides, not daily measurements.</p></div>
        <div className="calendar-month-controls" role="group" aria-label="Calendar month navigation">
          <button type="button" className="calendar-arrow" title="Previous month" aria-label="Previous month" disabled={month <= minMonth} onClick={() => selectMonth(shiftCalendarMonth(month, -1))}>‹</button>
          <label title="Type a number to jump, for example 09 for September">Month<select aria-label="Calendar month" value={monthIndex} onKeyDown={(e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || !/^\d$/.test(e.key)) return;
  e.preventDefault();
  const r = typeMonth(monthTyping.current, e.key, e.timeStamp); monthTyping.current = r.state;
  if (r.month) selectMonth(`${year}-${String(r.month).padStart(2, "0")}`);
}} onChange={(e) => selectMonth(`${year}-${e.target.value.padStart(2, "0")}`)}>
            {MONTHS.map((name, i) => { const candidate = `${year}-${String(i + 1).padStart(2, "0")}`; return <option key={name} value={i + 1} disabled={candidate < minMonth || candidate > maxMonth}>{name}</option>; })}
          </select></label>
          <label title="Type a year to jump, for example 2017 or 17">Year<select aria-label="Calendar year" value={year} onKeyDown={(e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || !/^\d$/.test(e.key)) return;
  e.preventDefault();
  const r = typeYear(yearTyping.current, e.key, e.timeStamp, years[0], years[years.length - 1]); yearTyping.current = r.state;
  if (r.year) selectMonth(`${r.year}-${String(monthIndex).padStart(2, "0")}`);
}} onChange={(e) => selectMonth(`${e.target.value}-${String(monthIndex).padStart(2, "0")}`)}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
          <button type="button" className="calendar-arrow" title="Next month" aria-label="Next month" disabled={month >= maxMonth} onClick={() => selectMonth(shiftCalendarMonth(month, 1))}>›</button>
        </div>
      </header>
      <div className="calendar-context"><span>{sourceTitle(source)}</span><span>{metricLabel}</span><span>{formatCalendarDate(coverage.start)} – {formatCalendarDate(coverage.end)}</span></div>

      {loading ? <div className="calendar-state" role="status"><h4>Loading weekly observations…</h4><p>Your month selection is preserved while the request completes.</p></div>
        : error ? <div className="calendar-state calendar-request-error" role="alert"><h4>Could not load observations</h4><p>This is a request error, not a zero-activity result.</p><p>{error}</p>{onRetry && <button type="button" className="view-calendar-btn" onClick={onRetry}>Retry request</button>}</div>
        : <>
          {!recorded.length && <div className="calendar-state calendar-empty-month" role="status"><strong>No weekly records returned for this month.</strong><p>This does not establish zero burning activity. Check the area, source and date filters.</p></div>}
          <div className="calendar-workspace">
            <div className="calendar-planner" aria-labelledby="calendar-month-heading">
              <div className="calendar-column-headings" aria-hidden="true"><div className="calendar-day-dates">{DAYS.map((day) => <span key={day}>{day}</span>)}</div><span>{metricLabel}</span></div>
              <ol className="calendar-week-rows" aria-label="Weekly observations in the displayed month">
                {rows.map((row) => {
                  const state = weekMetricState(row, metric);
                  const value = row.observation ? metricValue(row.observation) : null;
                  const validValue = value != null && Number.isFinite(value);
                  const gap = gapLabels(row);
                  return <li key={row.start}>
                    <button type="button" className={`calendar-week-row state-${state}`} disabled={!row.inRange} aria-pressed={selected?.start === row.start}
                      aria-controls="calendar-week-detail" aria-label={`${rangeText(row)}. ${rowStatus(row)}${validValue ? `: ${formatCalendarValue(value)}` : ""}${gap.length ? ". Known observation gap" : ""}`} onClick={() => setPicked(row.start)}>
                      <span className="calendar-week-range">{rangeText(row)}</span>
                      <span className="calendar-day-dates">{row.days.map((date) => <time key={date} dateTime={date} title={formatCalendarDate(date)} className={`${date.slice(0, 7) !== month ? "adjacent-month " : ""}${date < coverage.start || date > coverage.end ? "outside-filter" : ""}`}>
                        <span>{Number(date.slice(8))}</span>{date.slice(0, 7) !== month && <small>{MONTHS[+date.slice(5, 7) - 1].slice(0, 3)}</small>}
                      </time>)}</span>
                      <span className="calendar-week-measure"><span className="calendar-measure-main">
                        <i className={`calendar-value-swatch ${state}`} style={validValue && row.inRange ? { backgroundColor: colorFor(value / (maximum || 1)) } : undefined} aria-hidden="true" />
                        <strong>{!row.inRange ? "—" : state === "absent" ? "No record" : formatCalendarValue(value)}</strong>
                      </span><span>{rowStatus(row)}</span></span>
                      {row.inRange && (gap.length > 0 || row.observation?.flags.length || (row.observation?.low_sensitivity_share ?? 0) > 0) ? <span className="calendar-week-flags">
                        {gap.length > 0 && <span>Observation gap</span>}
                        {(row.observation?.low_sensitivity_share ?? 0) > 0 && <span>Sensitivity warning</span>}
                        {!!row.observation?.flags.length && <span>Data flags</span>}
                      </span> : null}
                    </button>
                  </li>;
                })}
              </ol>
              <p className="calendar-boundary-note">Weeks run Monday–Sunday. A week crossing a month boundary appears in both months as the same weekly record; values are not split or summed into daily values. Faded dates are outside this month or the selected coverage.</p>
            </div>
            <aside className="calendar-week-detail" id="calendar-week-detail" aria-label="Selected week details" aria-live="polite">
              <p className="eyebrow">SELECTED WEEK</p>
              {selected && <><h4>{rangeText(selected)}</h4><p className="calendar-detail-status">{rowStatus(selected)}</p>
                {observation ? <>
                  <dl className="calendar-detail-values">
                    <div className="calendar-primary-metric"><dt>Activity</dt><dd>{formatCalendarValue(observation.value)}</dd></div>
                    <div className="calendar-primary-metric"><dt>Anomaly percentile</dt><dd>{formatCalendarValue(observation.anomaly)}{observation.anomaly != null && Number.isFinite(observation.anomaly) ? " / 100" : ""}</dd></div>
                    <div><dt>Source view</dt><dd>{sourceTitle(source)}</dd></div>
                    <div><dt>Observation provenance</dt><dd>{source === "harmonized" ? provenance(observation.harmonized_source) : sourceTitle(source)}</dd></div>
                    <div><dt>Active squares</dt><dd>{activeSquaresText(observation)}</dd></div>
                    <div><dt>Uncertainty range</dt><dd>{observation.uncertainty_low != null && observation.uncertainty_high != null ? `${formatCalendarValue(observation.uncertainty_low)} – ${formatCalendarValue(observation.uncertainty_high)}` : "Not supplied"}</dd></div>
                    <div><dt>Low-sensitivity share</dt><dd>{sensitivityText(observation.low_sensitivity_share)}</dd></div>
                  </dl>
                  {(selected.start < coverage.start || selected.end > coverage.end) && <p className="calendar-detail-warning">This week partly extends outside the selected coverage. The displayed value is the returned whole-week observation.</p>}
                  <div className="calendar-observation-notes"><strong>Observation notes</strong>
                    <ul>{[...new Set([...observation.flags, ...gapLabels(selected)])].map((note) => <li key={note}>{note}</li>)}</ul>
                    {!observation.flags.length && !gapLabels(selected).length && <p>No flags supplied. This does not guarantee complete observation coverage.</p>}
                    {(observation.low_sensitivity_share ?? 0) > 0 && <p>Some cells have low sensitivity. Review the uncertainty and data limitations.</p>}
                  </div>
                  {observation.value === 0 && <p className="calendar-detail-warning">A reported zero does not prove no burning occurred. Observation coverage and known gaps still matter.</p>}
                </> : <><p>No observation was returned for this week. Its activity and anomaly are unknown, not zero.</p>{gapLabels(selected).length > 0 && <div className="calendar-observation-notes"><strong>Known gaps overlapping this week</strong><ul>{gapLabels(selected).map((gap) => <li key={gap}>{gap}</li>)}</ul></div>}</>}
              </>}
            </aside>
          </div>
          <section className="calendar-legend" aria-label="Calendar legend">
            <div><strong>{metricLabel} color scale</strong>{!numericValues.length ? <p>No numeric metric values were returned for these filters.</p> : maximum === 0 ? <p><i className="calendar-value-swatch zero" /> All returned activity values are zero.</p> : <div className="calendar-legend-ramp"><span>0</span><span className="ramp">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ background: colorFor(i / 8) }} />)}</span><span>{formatCalendarValue(maximum)}{metric === "anomaly" ? "th percentile" : ""}</span></div>}
              <p>{metric === "anomaly" ? "Fixed 0–100 percentile scale. An anomaly is not the probability of a future fire; the baseline is defined by the data team." : "Dark ash means lower activity; brighter gold means higher activity. Scale uses the maximum returned value for the current area, source and date range, and can change when filters change. Activity units are not supplied by the API contract."}</p></div>
            <div className="calendar-state-keys"><span><i className="calendar-value-swatch zero" />Zero = a recorded value of 0</span><span><i className="calendar-value-swatch unavailable" />Unavailable = a returned record with no metric value</span><span><i className="calendar-value-swatch absent" />No record = no weekly row returned</span><span>Badges identify gaps, sensitivity warnings and flags independently of color.</span></div>
          </section>
        </>}
    </div>
  );
}
