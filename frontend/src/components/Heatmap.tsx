import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { activeSquaresText, provenanceLabel, sensitivityText } from "../display";
import type { Bbox, Meta, Metric, Source, WeekRow } from "../types";
import { colorFor } from "../colors";
import { formatCalendarDate, formatCalendarValue } from "../calendarModel";
import { heatmapLayout, heatmapScale } from "../heatmapModel";
import type { HeatmapSlot } from "../heatmapModel";

interface Props { regionLabel?: string; bbox?: Bbox; source?: Source; weeks: WeekRow[]; metric: Metric; meta: Meta; start: string; end: string; loading?: boolean; error?: string; onRetry?: () => void }
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_COLUMNS = [0, 4, 8, 12, 17, 21, 25, 30, 34, 39, 43, 47];
const isSelectable = (slot: HeatmapSlot) => slot.kind === "record" || slot.kind === "missing";
const rangeText = (slot: HeatmapSlot) => `${formatCalendarDate(slot.start)} – ${formatCalendarDate(slot.end)}`;

export default function Heatmap({ regionLabel = "Selected analysis region", bbox, weeks, metric, meta, start, end, source = "harmonized", loading = false, error = "", onRetry }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [fitAll, setFitAll] = useState(true);
  const workspace = useRef<HTMLDivElement>(null);
  const expandTrigger = useRef<HTMLButtonElement>(null);
  const closeTrigger = useRef<HTMLButtonElement>(null);
  const normalScroll = useRef({left:0,top:0});
  const restoreScroll = useRef(false);
  const closeExpanded = () => {
    setExpanded(false);
    if (document.fullscreenElement && document.fullscreenElement === workspace.current) void document.exitFullscreen().catch(() => {});
  };
  const openExpanded = () => {
    if(scroller.current) normalScroll.current={left:scroller.current.scrollLeft,top:scroller.current.scrollTop};
    restoreScroll.current=true;
    setExpanded(true);
    setDetailsOpen(false); setLegendOpen(false); setFitAll(true);
    // A viewport-filling fallback also works where the Fullscreen API is unavailable.
    if (workspace.current?.requestFullscreen) void workspace.current.requestFullscreen().catch(() => {});
  };
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeTrigger.current?.focus();
    const onFullscreenChange = () => { if (!document.fullscreenElement) setExpanded(false); };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      expandTrigger.current?.focus();
    };
  }, [expanded]);
  const [picked, setPicked] = useState("");
  const [hovered, setHovered] = useState("");
  const [focused, setFocused] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(expanded || !restoreScroll.current)return;
    const frame=requestAnimationFrame(()=>{
      scroller.current?.scrollTo(normalScroll.current);
      restoreScroll.current=false;
    });
    return ()=>cancelAnimationFrame(frame);
  },[expanded]);
  const [scroll, setScroll] = useState({ pos: 0, max: 0 });
  const prefix = useId();
  const layout = useMemo(() => heatmapLayout(weeks, start, end, meta, source), [weeks, start, end, meta, source]);
  const scale = useMemo(() => heatmapScale(weeks, metric), [weeks, metric]);
  const slots = layout.rows.flat();
  const available = slots.filter(isSelectable);
  const latest = [...available].reverse().find(slot=>{const value=metric==="activity"?slot.record?.value:slot.record?.anomaly;return value!=null&&Number.isFinite(value);}) ?? [...available].reverse().find(slot=>slot.record) ?? available[0];
  const selected = available.find((slot) => slot.key === picked) ?? latest;
  const monthSlots=available.filter(slot=>slot.start.slice(0,7)===selected?.start.slice(0,7));
  const monthMaximum=Math.max(...monthSlots.map(slot=>(metric==="activity"?slot.record?.value:slot.record?.anomaly)??0),0);
  const shown = available.find((slot) => slot.key === hovered) ?? selected;
  const focusKey = available.some((slot) => slot.key === focused) ? focused : selected?.key;
  const metricName = metric === "anomaly" ? "Anomaly percentile" : "Activity";
  const sourceName = source === "harmonized" ? "Harmonized" : source.toUpperCase();
  const syncScroll = () => {
    const el = scroller.current;
    if (el) setScroll({ pos: el.scrollLeft, max: Math.max(0, el.scrollWidth - el.clientWidth) });
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    syncScroll();
    const observer = new ResizeObserver(syncScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, error, layout.years.length, weeks.length, expanded, fitAll]);
  useEffect(() => setHovered(""), [weeks, metric]);
  const gaps = (slot: HeatmapSlot) => meta.gaps.filter((gap) => slot.start <= gap.end && slot.end >= gap.start).map((gap) => gap.label);
  const valueFor = (slot: HeatmapSlot) => slot.record ? metric === "activity" ? slot.record.value : slot.record.anomaly : null;
  const stateFor = (slot: HeatmapSlot) => {
    if (slot.kind !== "record") return slot.kind;
    const value = valueFor(slot);
    return value == null || !Number.isFinite(value) ? "unavailable" : value === 0 ? "zero" : "observed";
  };
  const describe = (slot: HeatmapSlot) => {
    const state = stateFor(slot);
    if (state === "no-week") return "No Monday starts in this final calendar-year position";
    if (state === "outside") return "Outside selected dates or reported source coverage";
    if (state === "missing") return "No weekly record returned; activity is unknown";
    if (state === "unavailable") return `${metricName} unavailable in returned record`;
    return `${metricName}: ${formatCalendarValue(valueFor(slot))}${metric === "anomaly" ? " / 100" : ""}`;
  };
  const moveFocus = (slot: HeatmapSlot, key: string) => {
    const rowIndex = layout.years.indexOf(slot.year);
    let target: HeatmapSlot | undefined;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const offset = key === "ArrowLeft" ? -1 : 1;
      const row = layout.rows[rowIndex];
      for (let col = slot.col + offset; col >= 0 && col < 53; col += offset) if (isSelectable(row[col])) { target = row[col]; break; }
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      const offset = key === "ArrowUp" ? -1 : 1;
      for (let i = rowIndex + offset; i >= 0 && i < layout.rows.length; i += offset) if (isSelectable(layout.rows[i][slot.col])) { target = layout.rows[i][slot.col]; break; }
    } else if (key === "Home" || key === "End") {
      const row = layout.rows[rowIndex].filter(isSelectable);
      target = key === "Home" ? row[0] : row[row.length - 1];
    }
    if (target) {
      setFocused(target.key); setPicked(target.key); setHovered("");
      const el = document.getElementById(`${prefix}-${target.year}-${target.col}`);
      el?.focus(); el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const legend = (          <section className="heatmap-scale" id={`${prefix}-legend`} hidden={expanded && !legendOpen} aria-label="Heatmap legend">
            {expanded && <button type="button" className="heatmap-panel-close heatmap-expand-button" aria-label="Close legend" onClick={() => setLegendOpen(false)}>×</button>}
            <div className="heatmap-scale-heading"><strong>{metricName} scale</strong>{scale.values.length && scale.maximum > 0 ? <div className="calendar-legend-ramp"><span>0</span><span className="ramp">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ background: colorFor(i / 8) }} />)}</span><span>{formatCalendarValue(scale.maximum)}{metric === "anomaly" ? " / 100" : ""}</span></div> : <span className="small">{scale.values.length ? "Recorded values are zero" : "No numeric values returned"}</span>}</div>
            <p>{metric === "anomaly" ? "Fixed 0–100 percentile scale, not a probability of future fire." : `Activity colors saturate at the returned data's 98th-percentile value. ${scale.clipped} ${scale.clipped === 1 ? "value is" : "values are"} above this endpoint; the exact values remain available in week details. The scale changes with filters. Units are not supplied by the API contract.`}</p>
            <div className="heatmap-keys"><span><i className="calendar-value-swatch zero" />Recorded zero</span><span><i className="calendar-value-swatch unavailable" />Unavailable value</span><span><i className="calendar-value-swatch absent" />No record returned</span><span><i className="heatmap-key-gap" />Known gap</span><span><i className="k-dot" />Low sensitivity ≥30%</span><span>Faint cells: outside dates/coverage, or no week starts here.</span></div>
          </section>);

  if (loading) return <div className="calendar-state" role="status"><h3>Loading weekly observations…</h3><p>Your filters and selected week are preserved while the request completes.</p></div>;
  if (error) return <div className="calendar-state calendar-request-error" role="alert"><h3>Could not load observations</h3><p>{error}</p><p>A request error is not a zero-activity result.</p>{onRetry && <button type="button" className="view-calendar-btn" onClick={onRetry}>Retry request</button>}</div>;

  return (
    <div ref={workspace} className={`refined-heatmap${expanded ? `${fitAll ? " heatmap-expanded heatmap-fit-all" : " heatmap-expanded"}` : ""}`}
      role={expanded ? "dialog" : undefined} aria-modal={expanded ? true : undefined} aria-label={expanded ? "Full-screen heatmap" : undefined}
      onKeyDown={(event) => {
        if (!expanded) return;
        if (event.key === "Escape") { event.preventDefault(); closeExpanded(); }
        if (event.key === "Tab") {
          const controls = Array.from(workspace.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]') ?? []).filter((el) => el.tabIndex >= 0 && !el.closest("[hidden]"));
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="heatmap-expand-bar">
        <span>{expanded ? "Full-screen heatmap · Escape to exit" : "Explore the weekly overview"}</span>
        {expanded ? <button ref={closeTrigger} type="button" className="heatmap-expand-button" onClick={closeExpanded} aria-label="Exit full-screen heatmap" title="Exit full screen (Escape)"><span aria-hidden="true">×</span> Exit full screen</button>
          : <button ref={expandTrigger} type="button" className="heatmap-expand-button" onClick={openExpanded} aria-label="Expand heatmap to full screen" title="Expand heatmap to full screen"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg> Full screen</button>}
      </div>
      {expanded && <div className="heatmap-fullscreen-toolbar">
        <span>{selected ? rangeText(selected) : "No week selected"} · {sourceName} · {metricName}</span>
        <div>
          <button type="button" className="heatmap-expand-button" aria-pressed={fitAll} onClick={() => setFitAll((value) => !value)}>{fitAll ? "Larger cells" : "Fit entire heatmap"}</button>
          <button type="button" className="heatmap-expand-button" aria-expanded={detailsOpen} aria-controls={`${prefix}-details`} onClick={() => { setDetailsOpen((value) => !value); setLegendOpen(false); }}>Week details</button>
          <button type="button" className="heatmap-expand-button" aria-expanded={legendOpen} aria-controls={`${prefix}-legend`} onClick={() => { setLegendOpen((value) => !value); setDetailsOpen(false); }}>Legend</button>
        </div>
      </div>}
      {!weeks.length && <p className="availability-inline" role="status">No weekly records returned for this area and date range. This does not establish zero burning activity.</p>}
      {!!weeks.length && !scale.values.length && <p className="availability-inline" role="status">Weekly records were returned, but {metric === "activity" ? "activity" : "anomaly"} values are unavailable. Missing values are not zero.</p>}
      {!!scale.values.length && scale.values.every((value) => value === 0) && <p className="availability-inline" role="status">Available {metric === "activity" ? "activity" : "anomaly"} values are all recorded as zero ({scale.values.length} numeric {scale.values.length === 1 ? "record" : "records"}).{scale.values.length < weeks.length ? ` ${weeks.length - scale.values.length} other ${weeks.length - scale.values.length === 1 ? "value is" : "values are"} unavailable.` : ""} A recorded zero does not prove no burning occurred.</p>}
      {expanded&&legend}
      <div className="heatmap-workspace">
        <aside className="heatmap-context-sidebar">
          <section className="region-context-card"><p className="eyebrow">SELECTED REGION</p><h3>{regionLabel}</h3>
            {bbox&&<><svg className="bbox-overview" viewBox="0 0 200 110" role="img" aria-label="Bounding-box overview, not a map of detections"><path d="M0 27.5h200M0 55h200M0 82.5h200M50 0v110M100 0v110M150 0v110" stroke="currentColor" opacity=".15"/><rect x={(bbox[0]+180)/360*200} y={(90-bbox[3])/180*110} width={Math.max((bbox[2]-bbox[0])/360*200,2)} height={Math.max((bbox[3]-bbox[1])/180*110,2)} fill="none" stroke="var(--teal)" strokeWidth="2"/></svg><p className="small">{bbox.map(n=>n.toFixed(2)).join(", ")}<br/>West · south · east · north</p></>}
            <a className="outline-action" href="#map">Edit on Map ↗</a>
          </section>
          <section className="reading-guide"><p className="eyebrow">HOW TO READ THIS</p>{!expanded&&legend}<p className="small">Known instrument gaps are metadata warnings. A record may still contain observations from another source. Lower activity is not proof of no fire.</p></section>
        </aside>
        <div className="heatmap-visual">
          <div className="heatmap-chart-heading"><div><h3>Year × Week</h3><p>Select a week to inspect its month below.</p></div><span>{sourceName} · {metricName}</span></div>
          <div className="heat-scroll heatmap-matrix-scroll" ref={scroller} onScroll={syncScroll} role="region" tabIndex={0} aria-label="Scrollable weekly heatmap">
            <div className="heatmap-matrix" role="table" aria-label="Burning activity by calendar year and weekly position" aria-colcount={54} aria-rowcount={layout.years.length + 1}>
              <div className="heatmap-grid-head" role="row"><div className="heatmap-year" role="columnheader">Year</div>{MONTHS.map((month, i) => <div className="heatmap-month-label" role="columnheader" key={month} style={{ gridColumn: `${MONTH_COLUMNS[i] + 2} / span ${i === 11 ? 6 : MONTH_COLUMNS[i + 1] - MONTH_COLUMNS[i]}` }}>{month}</div>)}</div>
              {layout.rows.map((row, index) => <Fragment key={layout.years[index]}>
                {source === "harmonized" && layout.years[index] === 2012 && index > 0 && <div className="heatmap-era" role="presentation"><span>From 20 Jan 2012 values are observed by VIIRS. Earlier rows are estimated from MODIS.</span></div>}
                <div className="heatmap-grid-row" role="row">
                <div className="heatmap-year" role="rowheader">{layout.years[index]}</div>
                {row.map((slot) => {
                  const state = stateFor(slot), value = valueFor(slot);
                  const numeric = value != null && Number.isFinite(value) && slot.kind === "record";
                  return <div className="heatmap-slot" role="cell" key={slot.col}>
                    <button type="button" id={`${prefix}-${slot.year}-${slot.col}`} className={`heatmap-week state-${state}${selected?.key === slot.key && isSelectable(slot) ? " is-selected" : ""}${hovered === slot.key ? " is-preview" : ""}${gaps(slot).length ? " has-gap" : ""}`}
                      disabled={!isSelectable(slot)} tabIndex={slot.key === focusKey && isSelectable(slot) ? 0 : -1} aria-pressed={selected?.key === slot.key && isSelectable(slot)}
                      title={`${rangeText(slot)} · ${describe(slot)}`} aria-label={`${rangeText(slot)}. ${describe(slot)}${gaps(slot).length ? ". Known instrument gap" : ""}`} aria-controls={`${prefix}-details`}
                      style={numeric && value !== 0 ? { backgroundColor: colorFor(value / (scale.maximum || 1)) } : undefined}
                      onClick={() => { setPicked(slot.key); setFocused(slot.key); setHovered(""); }}
                      onFocus={() => { setPicked(slot.key); setFocused(slot.key); setHovered(""); }}
                      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(slot.key); }} onPointerLeave={() => setHovered("")}
                      onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) { event.preventDefault(); moveFocus(slot, event.key); } }}>
                      {slot.record && (slot.record.low_sensitivity_share ?? 0) >= .3 && <span className="heatmap-sensitivity-dot" aria-hidden="true" />}
                    </button>
                  </div>;
                })}
              </div>
              </Fragment>)}
            </div>
          </div>
          {scroll.max > 0 && <input type="range" className="heat-slider" min={0} max={scroll.max} step={1} value={Math.min(scroll.pos, scroll.max)} aria-label="Scroll the heatmap sideways" onChange={(event) => { if (scroller.current) { scroller.current.scrollLeft = +event.target.value; syncScroll(); } }} />}
          <p className="heatmap-reading-note">Week columns group Monday start dates within each calendar year. Month labels are approximate guides. Year labels stay visible as you scroll. Use arrow keys to inspect weeks; Home/End move within a year.</p>

        </div>
        {selected&&<section className="heatmap-month-detail" aria-label="Selected month weekly observations"><div className="month-detail-heading"><div><p className="eyebrow">MONTH DETAIL</p><h3>{new Date(`${selected.start.slice(0,7)}-01T00:00:00Z`).toLocaleDateString(undefined,{month:"long",year:"numeric",timeZone:"UTC"})}</h3></div><span className="small">Weekly start dates · {metricName}</span></div><div className="month-week-bars">{monthSlots.map(slot=>{
          const value=valueFor(slot),numeric=value!=null&&Number.isFinite(value);return <button type="button" key={slot.key} aria-pressed={selected.key===slot.key} onClick={()=>{setPicked(slot.key);setFocused(slot.key);setHovered("");}} title={`${rangeText(slot)} · ${describe(slot)}`}><span className={`month-observation-bar state-${stateFor(slot)}`} style={numeric?{height:Math.max(3,value/(monthMaximum||1)*100),background:value===0?undefined:colorFor(value/(scale.maximum||1))}:undefined}/><strong>{numeric?formatCalendarValue(value):slot.record?"Unavailable":"No record"}</strong><span>{formatCalendarDate(slot.start)}</span>{gaps(slot).length>0&&<small>Instrument gap</small>}</button>;
        })}</div><p className="small">Bar heights use this month's maximum; colors use the overview legend. Each observation covers seven days from its start date. Missing records are not zero.</p></section>}
        <aside className="heatmap-detail" id={`${prefix}-details`} aria-label="Selected week details" aria-live="polite" hidden={expanded && !detailsOpen}>
          {expanded && <button type="button" className="heatmap-panel-close heatmap-expand-button" aria-label="Close week details" onClick={() => setDetailsOpen(false)}>×</button>}
          <p className="small initial-week-note">{!picked ? "Initially showing the latest available numeric week, or latest returned record when values are unavailable." : "Your selected week"}</p>
          <p className="eyebrow">{hovered && shown?.key !== selected?.key ? "HOVER PREVIEW" : "SELECTED WEEK"}</p>
          {shown ? <>
            <h4>{rangeText(shown)}</h4>
            <p className="heatmap-detail-status">{describe(shown)}</p>
            {shown.record ? <>
              <div className="heatmap-primary-values"><div><span>Activity</span><strong>{formatCalendarValue(shown.record.value)}</strong></div><div><span>Anomaly</span><strong>{formatCalendarValue(shown.record.anomaly)}{shown.record.anomaly != null && Number.isFinite(shown.record.anomaly) ? <small> /100</small> : null}</strong></div></div>
              <dl className="heatmap-detail-fields"><div><dt>Source view</dt><dd>{sourceName}</dd></div><div><dt>Observation provenance</dt><dd>{source !== "harmonized" ? sourceName : provenanceLabel(shown.record.harmonized_source)}</dd></div><div><dt>Uncertainty range</dt><dd>{shown.record.uncertainty_low != null && shown.record.uncertainty_high != null ? `${formatCalendarValue(shown.record.uncertainty_low)} – ${formatCalendarValue(shown.record.uncertainty_high)}` : "Not supplied"}</dd></div><div><dt>Low-sensitivity share</dt><dd>{sensitivityText(shown.record.low_sensitivity_share)}</dd></div><div><dt>Active squares</dt><dd>{activeSquaresText(shown.record)}</dd></div></dl>
              {shown.record.value === 0 && <p className="calendar-detail-warning">A recorded zero does not prove no burning occurred.</p>}
            </> : <p>No weekly record was returned. Activity, anomaly and uncertainty are unknown, not zero.</p>}
            <div className="heatmap-detail-notes"><strong>Flags & observation notes</strong>{shown.record?.flags.length || gaps(shown).length ? <ul>{[...new Set([...(shown.record?.flags ?? []), ...gaps(shown)])].map((flag) => <li key={flag}>{flag}</li>)}</ul> : <p>No flags supplied. This does not guarantee complete observation coverage.</p>}{(shown.record?.low_sensitivity_share ?? 0) > 0 && <p>Low-sensitivity cells are present. Review the uncertainty and data limitations.</p>}</div>
          </> : <p>No selectable weeks in the requested date range. Check the source and dates above.</p>}
        </aside>
      </div>
    </div>
  );
}
