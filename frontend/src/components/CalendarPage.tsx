import { useEffect, useState } from "react";
import { getCalendar, getMeta, getRegions, usingFakeData } from "../api";
import type { Bbox, CalendarResponse, Meta, Metric, Region, Source } from "../types";
import MapPicker from "./MapPicker";
import Heatmap from "./Heatmap";
import Caveats from "./Caveats";
import { Embers } from "./Fire";

export default function CalendarPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [regionId, setRegionId] = useState("");
  const [source, setSource] = useState<Source>("harmonized");
  const [metric, setMetric] = useState<Metric>("activity");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getMeta(), getRegions()])
      .then(([m, r]) => {
        setMeta(m); setRegions(r);
        setStart(m.date_start); setEnd(m.date_end);
        if (r[0]) { setBbox(r[0].bbox); setRegionId(r[0].id); }
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    if (!bbox || !start || !end) return;
    let stale = false;
    setLoading(true); setError("");
    getCalendar(bbox, start, end, source)
      .then((d) => !stale && setData(d))
      .catch((e) => !stale && setError(String(e.message ?? e)))
      .finally(() => !stale && setLoading(false));
    return () => { stale = true; };
  }, [bbox, start, end, source]);

  const pickRegion = (id: string) => {
    setRegionId(id);
    const r = regions.find((x) => x.id === id);
    if (r) setBbox(r.bbox);
  };

  return (
    <div className="page page-wide page-fire">
      <div className="lava" aria-hidden="true" />
      <Embers />
      <header className="hero">
        <div className="terminal-dots"><i className="dot red" /><i className="dot yellow" /><i className="dot green" /></div>
        <h1>Burning Activity Calendar<span className="cursor" /></h1>
        <p>Weekly fire activity from 2000 to now, MODIS and VIIRS on one scale.</p>
      </header>
      {usingFakeData && <div className="fake-banner" role="alert">FAKE DEMO DATA: random values, they mean nothing.</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <div className="layout">
        <section className="panel">
          <h2 className="step"><span className="step-num">1</span>Choose an area</h2>
          <label>Pilot region
            <select value={regionId} onChange={(e) => pickRegion(e.target.value)}>
              <option value="">Custom box</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          {bbox && <MapPicker bbox={bbox} onChange={(b) => { setBbox(b); setRegionId(""); }} />}
          {bbox && <p className="small">Bounding box: {bbox.map((n) => n.toFixed(2)).join(", ")} (W, S, E, N){data && ` | ${data.cells_in_area} cells`}</p>}
        </section>

        <section className="panel panel-fire">
          <h2 className="step"><span className="step-num">2</span>Read the calendar</h2>
          <div className="controls">
            <fieldset><legend>Source</legend>
              <Seg value={source} onChange={setSource} options={[["harmonized", "Harmonized"], ["modis", "MODIS only"], ["viirs", "VIIRS only"]]} />
            </fieldset>
            <fieldset><legend>Metric</legend>
              <Seg value={metric} onChange={setMetric} options={[["activity", "Activity"], ["anomaly", "How unusual"]]} />
            </fieldset>
            <label>From <input type="date" value={start} min={meta?.date_start} max={end} onChange={(e) => setStart(e.target.value)} /></label>
            <label>To <input type="date" value={end} min={start} max={meta?.date_end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          {loading && <p className="loading" aria-live="polite">Loading...</p>}
          {meta && data && <div className={loading ? "dim" : ""}><Heatmap weeks={data.weeks} metric={metric} meta={meta} start={start} end={end} /></div>}
          {meta && meta.gaps.length > 0 && (
            <p className="small">Known gaps: {meta.gaps.map((g) => `${g.label} (${g.start} to ${g.end})`).join("; ")}</p>
          )}
        </section>
      </div>
      <Caveats />
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}
