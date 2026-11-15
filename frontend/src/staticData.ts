// Reads the ML export in public/data/ and builds the same responses as the API.
// Port of ml_export_reader.py (area_series + area_anomaly). See docs/ML_FE_BE_integration.md, section 4.4.
import type { Bbox, CalendarResponse, Calibration, Meta, Region, Source, WeekRow } from "./types";

const BASE = `${import.meta.env.BASE_URL}data`;
export const VIIRS_START = "2012-01-16"; // first Monday-week containing 20 Jan 2012
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GAP_LABELS: Record<string, string> = { terra_only: "Terra-only period", aqua_outage: "Aqua outage", snpp_outage: "S-NPP VIIRS outage" };

interface RawRegion {
  slug: string; name: string; n_cells: number; first_week: string; last_week: string; years: [number, number];
  bbox: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
  calibration?: Calibration;
}
interface RawMeta { known_gaps: { id: string; start: string; end: string; note: string }[]; caveats: string[] }
interface Cal {
  week_start: string[]; cells_total: number;
  modis_active_cells: (number | null)[]; viirs_active_cells: (number | null)[];
  harmonized_cells: (number | null)[]; harmonized_low: (number | null)[]; harmonized_high: (number | null)[];
  anomaly_region: (number | null)[]; anomaly_modis_only: (number | null)[]; anomaly_viirs_only: (number | null)[];
  source: (string | null)[]; flags: string[][];
}
interface YearWeek { modis?: number[] | null; viirs?: number[] | null; harmonized_default?: number | null; harmonized?: [number, number][] }
interface Loaded { info: RawRegion; cells: [number, number][]; cal: Cal }

const jsonCache = new Map<string, Promise<unknown>>();
function fetchJson<T>(path: string): Promise<T> {
  let p = jsonCache.get(path);
  if (!p) {
    p = fetch(`${BASE}/${path}`).then((r) => {
      if (!r.ok) throw new Error(`Data file missing (${r.status}): data/${path}`);
      return r.json();
    });
    p.catch(() => jsonCache.delete(path));
    jsonCache.set(path, p);
  }
  return p as Promise<T>;
}

const rawRegions = () => fetchJson<{ regions: RawRegion[] }>("regions.json").then((d) => d.regions);
const toBbox = (b: RawRegion["bbox"]): Bbox => [b.min_lon, b.min_lat, b.max_lon, b.max_lat];

export async function staticRegions(): Promise<Region[]> {
  return (await rawRegions()).map((r) => ({ id: r.slug, name: r.name, bbox: toBbox(r.bbox), n_cells: r.n_cells, calibration: r.calibration }));
}

export async function staticMeta(): Promise<Meta> {
  const [regions, m] = await Promise.all([rawRegions(), fetchJson<RawMeta>("meta.json")]);
  return {
    date_start: regions.map((r) => r.first_week).sort()[0],
    date_end: regions.map((r) => r.last_week).sort().slice(-1)[0],
    viirs_start: VIIRS_START,
    gaps: m.known_gaps.map((g) => ({ label: GAP_LABELS[g.id] ?? g.id, start: g.start, end: g.end })),
    notes: m.caveats,
  };
}

const regionCache = new Map<string, Promise<Loaded>>();
function loadRegion(info: RawRegion): Promise<Loaded> {
  let p = regionCache.get(info.slug);
  if (!p) {
    p = Promise.all([
      fetchJson<{ cells: [number, number][] }>(`${info.slug}/cells.json`),
      fetchJson<Cal>(`${info.slug}/calendar.json`),
    ]).then(([c, cal]) => ({ info, cells: c.cells, cal }));
    p.catch(() => regionCache.delete(info.slug));
    regionCache.set(info.slug, p);
  }
  return p;
}

const weeksCache = new Map<string, Promise<Map<string, YearWeek>>>();
function loadWeeks(info: RawRegion): Promise<Map<string, YearWeek>> {
  let p = weeksCache.get(info.slug);
  if (!p) {
    const years: number[] = [];
    for (let y = info.years[0]; y <= info.years[1]; y++) years.push(y);
    p = Promise.all(years.map((y) => fetchJson<{ weeks: Record<string, YearWeek> }>(`${info.slug}/${y}.json`)))
      .then((files) => {
        const all = new Map<string, YearWeek>();
        for (const f of files) for (const [k, v] of Object.entries(f.weeks)) all.set(k, v);
        return all;
      });
    p.catch(() => weeksCache.delete(info.slug));
    weeksCache.set(info.slug, p);
  }
  return p;
}

interface Row { week: string; value: number | null; active: number | null; low: number | null; high: number | null; source: string | null; flags: string[] }

// One row per week of the region's calendar (area_series in the reference reader).
function areaRows(region: Loaded, mask: Uint8Array, n: number, source: Source, weeks: Map<string, YearWeek> | null): Row[] {
  const cal = region.cal;
  const whole = n === region.cells.length;
  return cal.week_start.map((wk, k): Row => {
    const row: Row = { week: wk, value: null, active: null, low: null, high: null, source: cal.source?.[k] ?? null, flags: cal.flags?.[k] ?? [] };
    if (n === 0) return row;
    if (whole || !weeks) {
      // The whole region: the calendar file already holds the exact totals.
      if (source === "modis" || source === "viirs") {
        const c = (source === "modis" ? cal.modis_active_cells : cal.viirs_active_cells)[k];
        if (c != null) Object.assign(row, { value: c / n, active: c });
      } else {
        const h = cal.harmonized_cells[k];
        if (h != null) Object.assign(row, { value: h / n, active: h, low: (cal.harmonized_low[k] ?? h) / n, high: (cal.harmonized_high[k] ?? h) / n });
      }
      return row;
    }
    const entry = weeks.get(wk);
    if (!entry) return row;
    if (source === "modis" || source === "viirs") {
      const list = entry[source];
      if (list != null) {
        let count = 0;
        for (const i of list) count += mask[i];
        Object.assign(row, { value: count / n, active: count, low: count / n, high: count / n });
      }
    } else {
      const def = entry.harmonized_default;
      if (def != null) {
        let total = n * def;
        for (const [i, v] of entry.harmonized ?? []) if (mask[i]) total += v - def;
        total = Math.max(total, 0);
        row.value = total / n; row.active = total;
        const reg = cal.harmonized_cells[k], lo = cal.harmonized_low[k], hi = cal.harmonized_high[k];
        if (row.source === "viirs" || !reg || lo == null || hi == null) { row.low = row.value; row.high = row.value; }
        else { row.low = (row.value * lo) / reg; row.high = (row.value * hi) / reg; }
      }
    }
    return row;
  });
}

const dayOfYear = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
};

// Percentile 0-100 of a centered 3-week mean vs all weeks within 21 days of the same time of year (area_anomaly).
function areaAnomaly(rows: Row[], smooth = 3, windowDays = 21, minRef = 20): (number | null)[] {
  const vals = rows.map((r) => r.value);
  const half = Math.floor(smooth / 2);
  const sm = vals.map((_, t) => {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, t - half); j <= Math.min(vals.length - 1, t + half); j++) if (vals[j] != null) { sum += vals[j]!; cnt++; }
    return cnt ? sum / cnt : null;
  });
  const doy = rows.map((r) => dayOfYear(r.week));
  const buckets = new Map<number, number[]>();
  sm.forEach((v, i) => { if (v != null) (buckets.get(doy[i]) ?? buckets.set(doy[i], []).get(doy[i])!).push(v); });
  const near = new Map<number, number[]>();
  for (const d of new Set(doy)) {
    near.set(d, [...buckets.keys()].filter((u) => Math.min(Math.abs(d - u), 365 - Math.abs(d - u)) <= windowDays));
  }
  return sm.map((x, t) => {
    if (x == null) return null;
    let less = 0, eq = 0, n = 0;
    for (const u of near.get(doy[t])!) for (const v of buckets.get(u)!) { n++; if (v < x) less++; else if (v === x) eq++; }
    return n >= minRef ? (100 * (less + 0.5 * eq)) / n : null;
  });
}

const seriesCache = new Map<string, Promise<{ rows: Row[]; anomaly: (number | null)[] }>>();
const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
const r1 = (x: number) => Math.round(x * 10) / 10;

export async function staticCalendar(bbox: Bbox, start: string, end: string, source: Source, regionId?: string): Promise<CalendarResponse> {
  const infos = await rawRegions();
  const namedInfo = regionId ? infos.find((info) => info.slug === regionId) : undefined;
  // A named region does not depend on downloads for unrelated regions.
  const loaded = await Promise.all((namedInfo ? [namedInfo] : infos).map(loadRegion));
  const [west, south, east, north] = bbox;
  const select = (reg: Loaded) => {
    const mask = new Uint8Array(reg.cells.length);
    let n = 0;
    reg.cells.forEach(([lat, lon], i) => { if (lat >= south && lat <= north && lon >= west && lon <= east) { mask[i] = 1; n++; } });
    return { mask, n };
  };
  // A named region wins. Otherwise use the region holding most of the drawn cells
  // (Philippines and Indonesia boxes overlap, so values are never mixed across regions).
  let pick = regionId ? loaded.find((r) => r.info.slug === regionId) : undefined;
  let sel = pick ? select(pick) : { mask: new Uint8Array(0), n: 0 };
  if (!pick) {
    for (const reg of loaded) {
      const s = select(reg);
      if (s.n > sel.n || (s.n === sel.n && s.n > 0 && pick && reg.cells.length < pick.cells.length)) { pick = reg; sel = s; }
    }
  }
  if (!pick || sel.n === 0) return { bbox, source, cells_in_area: 0, weeks: [] };

  const region = pick;
  const key = `${region.info.slug}|${bbox.join(",")}|${source}`;
  let series = seriesCache.get(key);
  if (!series) {
    const whole = sel.n === region.cells.length;
    series = (whole ? Promise.resolve(null) : loadWeeks(region.info)).then((weeks) => {
      const rows = areaRows(region, sel.mask, sel.n, source, weeks);
      const cal = region.cal;
      const anomaly = whole
        ? (source === "modis" ? cal.anomaly_modis_only : source === "viirs" ? cal.anomaly_viirs_only : cal.anomaly_region)
        : areaAnomaly(rows);
      return { rows, anomaly };
    });
    series.catch(() => seriesCache.delete(key));
    seriesCache.set(key, series);
  }
  const { rows, anomaly } = await series;
  const lowMonths = new Set(region.info.calibration?.low_sensitivity_months ?? []);
  const out: WeekRow[] = [];
  rows.forEach((r, i) => {
    if (r.week < start || r.week > end) return;
    const flags = new Set(r.flags);
    if (r.value == null) flags.add("source_unavailable");
    const estimated = r.source !== "viirs";
    const harm = source === "harmonized";
    out.push({
      week_start: r.week,
      value: r.value == null ? null : r5(r.value),
      active_cells: r.active == null ? null : harm && estimated ? r1(r.active) : Math.round(r.active * 100) / 100,
      valid_cells: r.value == null ? 0 : sel.n,
      anomaly: anomaly[i] == null ? null : r1(anomaly[i]!),
      uncertainty_low: harm && r.low != null ? r5(r.low) : null,
      uncertainty_high: harm && r.high != null ? r5(r.high) : null,
      low_sensitivity_share: harm ? (r.value != null && estimated && lowMonths.has(MONTHS[+r.week.slice(5, 7) - 1]) ? 1 : 0) : null,
      flags: [...flags].sort(),
      harmonized_source: harm ? r.source : undefined,
    });
  });
  return { bbox, source, cells_in_area: sel.n, weeks: out, region: region.info.slug };
}
