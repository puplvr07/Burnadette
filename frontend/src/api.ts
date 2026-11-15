// API layer. Three data modes:
//   api    : VITE_API_URL is set, so the real backend is called (adds ?region= when a region is known).
//   static : default. Reads the ML export in public/data/ and computes the same numbers in the browser.
//   fake   : VITE_USE_FAKE=1. Random values from public/fake_cell_week.csv, for UI work only.
import type { Bbox, CalendarResponse, Meta, Region, Source, WeekRow } from "./types";
import { staticCalendar, staticMeta, staticRegions } from "./staticData";
const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
export const dataMode: "api" | "static" | "fake" = API ? "api" : import.meta.env.VITE_USE_FAKE === "1" ? "fake" : "static";
export const usingFakeData = dataMode === "fake";
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}
export const getMeta = (): Promise<Meta> => (API ? getJson("/meta") : usingFakeData ? Promise.resolve(FAKE_META) : staticMeta());
export const getRegions = (): Promise<Region[]> => (API ? getJson("/regions") : usingFakeData ? Promise.resolve(FAKE_REGIONS) : staticRegions());
export async function getCalendar(bbox: Bbox, start: string, end: string, source: Source, regionId?: string): Promise<CalendarResponse> {
  if (API) return getJson(`/calendar?bbox=${bbox.join(",")}&start=${start}&end=${end}&source=${source}${regionId ? `&region=${encodeURIComponent(regionId)}` : ""}`);
  if (usingFakeData) return fakeCalendar(bbox, start, end, source);
  return staticCalendar(bbox, start, end, source, regionId);
}// ---------- fake data below ----------
const FAKE_REGIONS: Region[] = [
  { id: "ph-all", name: "Placeholder: Philippines (whole grid)", bbox: [120, 10, 123, 14] },
  { id: "ph-north", name: "Placeholder: northern half", bbox: [120, 12, 123, 14] },
  { id: "ph-south", name: "Placeholder: southern half", bbox: [120, 10, 123, 12] },
];
const FAKE_META: Meta = {
  date_start: "2000-11-06",
  date_end: "2025-12-29",
  viirs_start: "2012-01-01",
  gaps: [
    { label: "Aqua outage", start: "2020-08-16", end: "2020-09-02" },
    { label: "S-NPP VIIRS outage", start: "2022-07-27", end: "2022-08-10" },
  ],
  notes: ["FAKE DATA: random values for UI development only."],
  is_fake: true,
};

interface Row {
  cell: string; lat: number; lon: number; week: string;
  modisActive: number; viirsActive: number; modisN: number; viirsN: number;
  value: number; src: string; anomaly: number; lowSens: number; ulo: number; uhi: number; flags: string;
}
let cache: Promise<Row[]> | null = null;

function loadCsv(): Promise<Row[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}fake_cell_week.csv`).then(async (res) => {
    if (!res.ok) throw new Error("fake_cell_week.csv missing. Run: npm run fake-data");
    const lines = (await res.text()).trim().split("\n");
    return lines.slice(1).map((l) => {
      const c = l.split(",");
      return {
        cell: c[0], lat: +c[1], lon: +c[2], week: c[3],
        modisActive: +c[6], viirsActive: +c[7], modisN: +c[8], viirsN: +c[9],
        value: +c[12], src: c[13], anomaly: +c[14], lowSens: +c[15], ulo: +c[16], uhi: +c[17], flags: c[18] ?? "",
      };
    });
  }).catch((error) => { cache = null; throw error; });
  return cache;
}

async function fakeCalendar(bbox: Bbox, start: string, end: string, source: Source): Promise<CalendarResponse> {
  const rows = await loadCsv();
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const byWeek = new Map<string, Row[]>();
  const cells = new Set<string>();
  for (const r of rows) {
    if (r.lon < minLon || r.lon > maxLon || r.lat < minLat || r.lat > maxLat) continue;
    cells.add(r.cell);
    if (r.week < start || r.week > end) continue;
    (byWeek.get(r.week) ?? byWeek.set(r.week, []).get(r.week)!).push(r);
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const round = (x: number) => Math.round(x * 1000) / 1000;
  const weeks: WeekRow[] = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, rs]) => {
      const flags = [...new Set(rs.flatMap((r) => r.flags.split(";").filter(Boolean)))];
      const noViirs = source === "viirs" && week < FAKE_META.viirs_start;
      const pick = (r: Row) => (source === "modis" ? r.modisN : source === "viirs" ? r.viirsN : r.value);
      return {
        week_start: week,
        value: noViirs ? null : round(avg(rs.map(pick))), // average across cells (suggested rule)
        active_cells: rs.filter((r) => (source === "modis" ? r.modisActive : source === "viirs" ? r.viirsActive : r.modisActive || r.viirsActive)).length,
        anomaly: round(avg(rs.map((r) => r.anomaly))), // average; open decision vs max
        uncertainty_low: source === "harmonized" ? round(avg(rs.map((r) => r.ulo))) : null,
        uncertainty_high: source === "harmonized" ? round(avg(rs.map((r) => r.uhi))) : null,
        low_sensitivity_share: round(rs.filter((r) => r.lowSens).length / rs.length),
        flags,
        harmonized_source: rs[0].src,
      };
    });
  await new Promise((r) => setTimeout(r, 150)); // let the loading state show
  return { bbox, source, cells_in_area: cells.size, weeks };
}
