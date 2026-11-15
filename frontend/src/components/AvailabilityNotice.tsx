import type { Meta, Metric, Source, WeekRow } from "../types";
import { availabilitySummary } from "../availability";
import { formatCalendarDate } from "../calendarModel";

interface Props { meta: Meta; source: Source; metric: Metric; start: string; end: string; weeks: WeekRow[]; loading: boolean; error: string; sample: boolean; onRetry?: () => void }

export default function AvailabilityNotice({ meta, source, metric, start, end, weeks, loading, error, sample, onRetry }: Props) {
  const info = availabilitySummary(meta, source, metric, start, end, weeks);
  const name = source === "harmonized" ? "Harmonized" : source.toUpperCase();
  const metricName = metric === "activity" ? "activity" : "anomaly";
  const label = !info.validDates ? "Choose valid dates" : loading ? "Checking selected records" : error ? "Request failed" : !info.overlaps ? "Outside source coverage" : info.partial ? "Partly outside source coverage" : !info.records ? "No records returned" : !info.observed ? "Metric values unavailable" : "Records returned";
  const warning = !info.validDates || !!error || !info.overlaps || info.partial || (!loading && (!info.records || !info.observed));

  return (
    <details className={`availability-notice${warning ? " availability-warning" : ""}`}>
      <summary><span className="availability-heading">Data availability</span><span className="availability-status">{label}</span><span className="availability-expand">Details</span></summary>
      <div className="availability-content">
        <p><strong>{name} dates reported by {sample ? "sample " : ""}metadata:</strong> {formatCalendarDate(info.available.start)} – {formatCalendarDate(info.available.end)}.</p>
        {sample && <p className="availability-sample">These dates, flags and counts describe the development fixture. They are not verified NASA coverage or findings.</p>}
        {!info.validDates ? <p>Complete the From and To filters, with the start on or before the end.</p>
          : loading ? <p>Waiting for the selected data request. No conclusions about burning can be drawn from this loading state.</p>
          : error ? <div><p>The request did not complete successfully. This is not a zero-activity result.</p>{onRetry && <button className="availability-retry" type="button" onClick={onRetry}>Retry request</button>}</div>
          : !info.overlaps ? <p>The selected dates do not overlap this source's reported coverage. Change the dates or source; unavailable coverage must not be read as no burning.</p>
          : <>
            {info.partial && <p className="availability-attention">Part of the selected period is outside the source's reported coverage. Values for that part are not evidence of zero burning.</p>}
            {!info.records ? <p>No weekly records were returned for this area and date range. This does not establish that no fires occurred.</p>
              : <>
                <dl className="availability-counts"><div><dt>Weekly rows returned</dt><dd>{info.records}</dd></div><div><dt>Numeric {metricName} values</dt><dd>{info.observed}</dd></div><div><dt>Unavailable {metricName} values</dt><dd>{info.unavailable}</dd></div><div><dt>Recorded zeros</dt><dd>{info.zeros}</dd></div></dl>
                <p>A recorded zero is an explicit numeric value. An unavailable value belongs to a returned record without a usable metric; a missing record is a different state. None of these alone proves complete observation coverage.</p>
              </>}
          </>}
        {info.validDates && <div className="availability-gaps"><strong>Known gaps listed for these dates</strong>{info.gaps.length ? <><ul>{info.gaps.map((gap) => <li key={`${gap.label}-${gap.start}`}>{gap.label}: {formatCalendarDate(gap.start)} – {formatCalendarDate(gap.end)}</li>)}</ul><p>An individual instrument gap does not imply that every source is missing.</p></> : <p>No overlapping gaps are listed in the supplied metadata. This does not guarantee uninterrupted or cloud-free observations.</p>}</div>}
        <p className="availability-footnote">Only returned records and supplied metadata are summarized. Missing weeks, cloud cover and undocumented outages are not inferred.</p>
      </div>
    </details>
  );
}
