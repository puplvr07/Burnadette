import { useEffect, useRef, useState } from "react";
import { getCalendar, getMeta, getRegions, usingFakeData } from "../api";
import type { Bbox, CalendarResponse, Meta, Metric, Region, Source } from "../types";
import MapPicker from "./MapPicker";
import PointRadiusControls from "./PointRadiusControls";
import { radiusBounds } from "../pointRadius";
import type { RadiusSelection } from "../pointRadius";
import RegionSearch from "./RegionSearch";
import Heatmap from "./Heatmap";
import MonthCalendar from "./MonthCalendar";
import Caveats from "./Caveats";
import AvailabilityNotice from "./AvailabilityNotice";
import Analytics from "./Analytics";
import { sourceDateRange } from "../availability";
import { FireBackdrop } from "./Fire";

interface Props { view: "map" | "heatmap" | "calendar"; hidden: boolean }
interface Selection { radius?: RadiusSelection; bbox: Bbox; regionId: string; source: Source; metric: Metric; start: string; end: string }

export default function CalendarPage({ view, hidden }: Props) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<Selection | null>(null);
  const [areaCleared, setAreaCleared] = useState(true);
  const [radiusEditorKey, setRadiusEditorKey] = useState(0);
  const [pointInputError, setPointInputError] = useState("");
  const [pointFeedback, setPointFeedback] = useState("");
  const [searchDismiss, setSearchDismiss] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [caveatsOpen, setCaveatsOpen] = useState(false);
  const [resultView, setResultView] = useState<"heatmap" | "calendar">("heatmap");
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const toolsHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let stale = false;
    Promise.all([getMeta(), getRegions()]).then(([m, r]) => {
      if (stale) return;
      setMeta(m); setRegions(r);
      // Metadata supplies viewport defaults only. A region is not selected or queried until Apply.
      const initial: Selection = { bbox: r[0]?.bbox ?? [116, 4, 127, 21], regionId: "", source: "harmonized", metric: "activity", start: m.date_start, end: m.date_end };
      setDraft(initial);
    }).catch((e) => { if (!stale) setError(String(e.message ?? e)); });
    return () => { stale = true; };
  }, []);

  const bbox = selection?.bbox;
  const start = selection?.start;
  const end = selection?.end;
  const source = selection?.source;
  useEffect(() => {
    if (!bbox || !start || !end || !source) return;
    let stale = false;
    setLoading(true); setError(""); setData(null);
    getCalendar(bbox, start, end, source)
      .then((d) => { if (!stale) setData(d); })
      .catch((e) => { if (!stale) setError(String(e.message ?? e)); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [bbox, start, end, source, retryVersion]);

  useEffect(() => {
    if (toolsOpen && view === "map" && !hidden) toolsHeading.current?.focus();
  }, [toolsOpen, view, hidden]);

  const regionName = (s: Selection | null) => !s ? "Choose an area" : s.radius ? `Point ${s.radius.lat.toFixed(4)}, ${s.radius.lon.toFixed(4)} · ${s.radius.radiusKm} km radius` : regions.find((r) => r.id === s.regionId)?.name ?? "Custom area";
  const updateRadius = (point: RadiusSelection) => {
    const bounds = radiusBounds(point);
    if (bounds.error) { setPointFeedback(bounds.error); setToolsOpen(true); setCaveatsOpen(false); return false; }
    setAreaCleared(false);
    setDraft((d) => d ? { ...d, bbox: bounds.bbox!, regionId: "", radius: point } : d);
    setPointInputError(""); setPointFeedback("");
    setToolsOpen(true); setCaveatsOpen(false); setSearchDismiss((n) => n + 1);
    return true;
  };
  const closeTools = () => { setToolsOpen(false); document.getElementById("map-tools-toggle")?.focus(); };
  const validDraft = !!(!areaCleared && !pointInputError && draft && meta && draft.start && draft.end && draft.start <= draft.end && draft.start >= meta.date_start && draft.end <= meta.date_end);
  const applySelection = () => {
    if (!validDraft || !draft) return;
    setSelection({ ...draft });
    setToolsOpen(false);
    window.location.hash = resultView;
  };

  return (
    <div className={`page page-wide explore-page${view === "map" ? " immersive-map-page" : view === "heatmap" ? " heatmap-view" : ""}`} hidden={hidden}>
      {view !== "map" && <FireBackdrop />}
      <div className="results-intro" hidden={view === "map"}>
        <header className="hero">
          <p className="eyebrow">BURNING ACTIVITY EXPLORER</p>
          <h1>{view === "heatmap" ? "The bigger picture" : "One month, week by week"}</h1>
          <p>{view === "heatmap" ? "Compare weekly burning patterns across years." : "Inspect weekly observations in a selected month."}</p>
        </header>
        {usingFakeData && <div className="fake-banner" role="status">SAMPLE DATA · Random development values, not satellite findings.</div>}
        <div className="selection-summary">
          <span><strong>Selected area:</strong> {regionName(selection)}</span>
          {selection && <><span><strong>Source:</strong> {selection.source === "harmonized" ? "Harmonized" : selection.source.toUpperCase()}</span><span><strong>Metric:</strong> {selection.metric === "activity" ? "Activity" : "Anomaly percentile"}</span></>}
          <span><strong>Date range:</strong> {start && end ? `${start} to ${end}` : "Loading dates…"}</span>
          <a className="change-area-link" href="#map">Change area on Map</a>
          {selection?.radius && <span className="selection-radius-note">Results use the circle's bounding box, not an exact circular filter.</span>}
        </div>
        {selection && meta && <FilterControls value={selection} meta={meta} onChange={(patch) => { const next = { ...selection, ...patch }; setSelection(next); setDraft(next); setPointInputError(""); setRadiusEditorKey((n) => n + 1); }} />}
      </div>
      {view === "calendar" && selection && meta && <AvailabilityNotice meta={meta} source={selection.source} metric={selection.metric} start={selection.start} end={selection.end} weeks={data?.weeks ?? []} loading={loading || (!data && !error)} error={error} sample={usingFakeData || !!meta.is_fake} onRetry={() => setRetryVersion((v) => v + 1)} />}
      {error && (view === "map" || !meta || !selection) && <div className={`error${view === "map" ? " map-error" : ""}`} role="alert">{error}</div>}

      <section className={`immersive-map${toolsOpen ? " settings-open" : ""}`} aria-label="Map" hidden={view !== "map"}>
        {draft ? <MapPicker selectionCleared={areaCleared} onClearSelection={() => {
          setAreaCleared(true); setSelection(null); setData(null); setLoading(false); setError("");
          setDraft(d => d ? {...d, regionId: "", radius: undefined} : d);
          setPointInputError(""); setPointFeedback(""); setRadiusEditorKey(n=>n+1); setToolsOpen(false);
        }} onOpenSettings={() => {setToolsOpen(true);setCaveatsOpen(false);setSearchDismiss(n=>n+1);}} bbox={draft.bbox} settingsOpen={toolsOpen} radiusSelection={draft.radius ?? null} onRadiusSelect={updateRadius} onChange={(b) => {
          setAreaCleared(false);
          setDraft((d) => d ? { ...d, bbox: b, regionId: "", radius: undefined } : d);
          setPointInputError(""); setPointFeedback("");
          setToolsOpen(true); setCaveatsOpen(false); setSearchDismiss((n) => n + 1);
        }} onBrowse={() => { setToolsOpen(false); setSearchDismiss((n) => n + 1); }} /> : <p className="map-loading" role="status">{error ? "Map data could not be loaded." : "Preparing the map…"}</p>}

        <div className="map-discovery">
          <RegionSearch regions={regions} dismissSignal={searchDismiss} onSearchStart={() => { setToolsOpen(false); setCaveatsOpen(false); }} onSelect={(region) => {
            setAreaCleared(false);
            setDraft((d) => d ? { ...d, regionId: region.id, bbox: region.bbox, radius: undefined } : d);
            setPointInputError(""); setPointFeedback("");
            setToolsOpen(true); setCaveatsOpen(false); setSearchDismiss((n) => n + 1);
          }} />
        </div>
        <div className="map-bottom-bar">
          {usingFakeData && <span className="map-sample-badge">SAMPLE DATA · Random values</span>}
          <button type="button" aria-expanded={caveatsOpen} aria-controls="map-caveats" onClick={() => { setCaveatsOpen((open) => !open); setToolsOpen(false); setSearchDismiss((n) => n + 1); }}>Data limitations</button>
        </div>
        <aside className="map-settings" id="map-settings" aria-labelledby="map-settings-heading" hidden={!toolsOpen}
          onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); closeTools(); } }}>
          <div className="map-settings-header">
            <div><p className="eyebrow">YOUR SELECTION</p><h2 ref={toolsHeading} tabIndex={-1} id="map-settings-heading">Region & dates</h2></div>
            <button type="button" className="close-map-tools map-icon-button" aria-label="Close settings panel" title="Close settings" onClick={closeTools}><span className="close-symbol" aria-hidden="true">×</span></button>
          </div>
          <p className="small">Changes here are drafts until you open the results.</p>
          <label>Pilot region
            <select value={draft?.regionId ?? ""} onChange={(e) => {
              const r = regions.find((item) => item.id === e.target.value);
              if (r) { setAreaCleared(false); setDraft((d) => d ? { ...d, regionId: r.id, bbox: r.bbox, radius: undefined } : d); setPointInputError(""); setPointFeedback(""); }
            }}>
              <option value="" disabled>Custom map selection</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          {draft?.radius && <PointRadiusControls key={radiusEditorKey} value={draft.radius} onChange={updateRadius} onValidationChange={setPointInputError} />}
          {pointFeedback && <p className="point-radius-error" role="status">{pointFeedback}</p>}
          {areaCleared && <p className="availability-inline" role="status">No region selected. Draw an area or choose a pilot region before applying.</p>}
          {draft && !areaCleared && <p className="small selection-coordinates">{draft.bbox.map((n) => n.toFixed(2)).join(", ")}<br/>West, south, east, north. Queries cover the bounding box, including for circles and polygons.</p>}
          {draft && meta && <FilterControls value={draft} meta={meta} onChange={(patch) => setDraft((d) => d ? { ...d, ...patch } : d)} />}
          <label>Open results in
            <select value={resultView} onChange={(e) => setResultView(e.target.value as "heatmap" | "calendar")}>
              <option value="heatmap">Heatmap · Compare years</option>
              <option value="calendar">Calendar · Explore a month</option>
            </select>
          </label>
          {draft && !validDraft && <p className="small" role="status">{areaCleared ? "Choose an analysis region first." : pointInputError || "Choose valid dates within the available coverage."}</p>}
          <button className="apply-map-selection" type="button" disabled={!validDraft} onClick={applySelection}>Apply & view {resultView === "heatmap" ? "Heatmap" : "Calendar"} →</button>
          {selection && <button type="button" className="reset-map-draft" onClick={() => { setAreaCleared(false); setDraft(selection); setPointInputError(""); setPointFeedback(""); setRadiusEditorKey((n) => n + 1); }}>Reset to applied selection</button>}
        </aside>
        <aside className="map-caveats" id="map-caveats" hidden={!caveatsOpen}>
          <button type="button" className="close-map-tools map-icon-button" aria-label="Close data limitations" title="Close data limitations" onClick={() => setCaveatsOpen(false)}><span className="close-symbol" aria-hidden="true">×</span></button>
          <Caveats />
        </aside>
      </section>

      {areaCleared && !selection && view !== "map" && <div className="calendar-state" role="status"><h3>No analysis region selected</h3><p>Choose a region on the map and apply it to see results.</p><a className="view-calendar-btn" href="#map">Choose a region on Map</a></div>}
      <section className="panel panel-fire explore-panel" aria-label="Heatmap" hidden={view !== "heatmap"}>
        {meta && selection && <Heatmap weeks={data?.weeks ?? []} source={selection.source} metric={selection.metric} meta={meta} start={selection.start} end={selection.end} loading={loading || (!data && !error)} error={error} onRetry={() => setRetryVersion((v) => v + 1)} />}
        {meta && meta.gaps.length > 0 && <p className="small">Known gaps: {meta.gaps.map((g) => `${g.label} (${g.start} to ${g.end})`).join("; ")}</p>}
      </section>
      {meta && selection && data && !loading && !error && (
        <section className="panel explore-panel compare-panel" aria-label="Compare and download" hidden={view !== "heatmap"}>
          <h2>Compare and download</h2>
          <Analytics weeks={data.weeks} meta={meta} bbox={selection.bbox} start={selection.start} end={selection.end} source={selection.source} />
        </section>
      )}
      {view === "heatmap" && selection && meta && <AvailabilityNotice meta={meta} source={selection.source} metric={selection.metric} start={selection.start} end={selection.end} weeks={data?.weeks ?? []} loading={loading || (!data && !error)} error={error} sample={usingFakeData || !!meta.is_fake} onRetry={() => setRetryVersion((v) => v + 1)} />}
      <section className="panel explore-panel" aria-label="Calendar" hidden={view !== "calendar"}>
        {meta && selection && <MonthCalendar weeks={data?.weeks ?? []} start={selection.start} end={selection.end} metric={selection.metric} source={selection.source} meta={meta} loading={loading || (!data && !error)} error={error} onRetry={() => setRetryVersion((v) => v + 1)} />}
        <a className="view-calendar-btn" href="#heatmap">Compare years in Heatmap</a>
      </section>
      <div hidden={view === "map"}><Caveats /></div>
    </div>
  );
}

function FilterControls({ value, meta, onChange }: { value: Selection; meta: Meta; onChange: (patch: Partial<Selection>) => void }) {
  const available = sourceDateRange(meta, value.source);
  return (
    <div className="controls shared-controls" role="group" aria-label="Data filters">
      <fieldset><legend>Source</legend><Seg variant="source" value={value.source} onChange={(source) => onChange({ source })} options={[["harmonized", "Harmonized", "Processed series"], ["modis", "MODIS", "MODIS observations"], ["viirs", "VIIRS", "VIIRS observations"]]} /></fieldset>
      <fieldset><legend>Metric</legend><Seg value={value.metric} onChange={(metric) => onChange({ metric })} options={[["activity", "Activity"], ["anomaly", "How unusual"]]} /></fieldset>
      <label>From<input type="date" value={value.start} min={available.start} max={value.end < available.end ? value.end : available.end} onChange={(e) => onChange({ start: e.target.value })} /></label>
      <label>To<input type="date" value={value.end} min={value.start > available.start ? value.start : available.start} max={available.end} onChange={(e) => onChange({ end: e.target.value })} /></label>
      <p className="coverage-filter-hint">{meta.is_fake ? "Sample metadata" : "Metadata"} coverage for {value.source === "harmonized" ? "harmonized activity" : value.source.toUpperCase()}: {available.start} to {available.end}. Changing source can change available dates.</p>
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options, variant }: { value: T; onChange: (v: T) => void; options: [T, string, string?][]; variant?: "source" }) {
  const [combinationRun, setCombinationRun] = useState(0);
  return <div className={`seg${variant === "source" ? " source-seg" : ""}`}>{options.map(([v, label, subtitle]) => <button key={v} type="button" data-source={variant === "source" ? v : undefined} aria-pressed={value === v}
    title={variant === "source" ? `${label}: ${subtitle}. ${v === "harmonized" ? "MODIS and VIIRS observations combined into a harmonized series. This illustration is not live processing. " : ""}Highlight indicates selection, not confidence.` : undefined}
    onClick={() => {
      if (variant === "source" && v === "harmonized" && value !== v) setCombinationRun((run) => run + 1);
      onChange(v);
    }}><span>{label}</span>{subtitle && <small>{subtitle}</small>}
    {variant === "source" && <span className="source-combination-space" aria-hidden="true">{v === "harmonized" && <span key={combinationRun} className={`source-combination${value === v ? " is-combined" : ""}${value === v && combinationRun > 0 ? " play-combination" : ""}`}>
      <span className="combination-inputs"><span>MODIS</span><span>+</span><span>VIIRS</span></span>
      <span className="combination-result">Harmonized</span>
      <span className="combination-static">MODIS + VIIRS → Harmonized</span>
    </span>}</span>}
  </button>)}</div>;
}
