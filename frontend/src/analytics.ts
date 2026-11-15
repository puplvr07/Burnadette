// Summaries computed in the browser from the /calendar weeks, plus CSV and PNG export.
// Nothing here calls the API, so it works the same with fake and real data.
import type { WeekRow } from "./types";

export const COLS = 53; // week columns in a calendar year (some years have a 53rd Monday)
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const doy = (iso: string) => Math.floor((Date.parse(iso) - Date.UTC(+iso.slice(0, 4), 0, 0)) / 86400000);
export const colOf = (iso: string) => Math.min(COLS - 1, Math.floor((doy(iso) - 1) / 7));
export const monthCol = (m: number) => Math.floor((m * 365.25) / 12 / 7);
export const yearOf = (w: WeekRow) => +w.week_start.slice(0, 4);

// Weekly flags that mean reduced satellite coverage (team guide, section 4).
const LOW_COVERAGE = new Set(["aqua_outage", "snpp_outage", "terra_only"]);
export const hasCoverageFlag = (w: WeekRow) => w.flags.some((f) => LOW_COVERAGE.has(f));

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
const nums = (xs: (number | null)[]) => xs.filter((v): v is number => v != null && Number.isFinite(v));

export interface YearStat {
  year: number;
  weeks: number; // weeks with a value
  total: number; // sum of weekly activity
  mean: number;
  max: number;
  meanAnomaly: number | null;
  partial: boolean; // one or more expected Monday-start records are missing
}

export function yearStats(weeks: WeekRow[]): YearStat[] {
  const by = new Map<number, WeekRow[]>();
  for (const w of weeks) (by.get(yearOf(w)) ?? by.set(yearOf(w), []).get(yearOf(w))!).push(w);
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([year, rs]) => {
    const vals = nums(rs.map((r) => r.value));
    const an = nums(rs.map((r) => r.anomaly));
    const total = vals.reduce((a, b) => a + b, 0);
    const dates = new Set(rs.filter((row) => row.value != null && Number.isFinite(row.value)).map((row) => row.week_start));
    const firstMonday = new Date(Date.UTC(year, 0, 1));
    firstMonday.setUTCDate(firstMonday.getUTCDate() + (8 - firstMonday.getUTCDay()) % 7);
    let partial = dates.size !== vals.length;
    for (let day = firstMonday; day.getUTCFullYear() === year; day = new Date(day.getTime() + 7 * 86400000)) {
      if (!dates.has(day.toISOString().slice(0, 10))) partial = true;
    }
    return {
      year, weeks: vals.length, total,
      mean: vals.length ? total / vals.length : 0,
      max: vals.length ? Math.max(...vals) : 0,
      meanAnomaly: an.length ? mean(an) : null,
      partial,
    };
  });
}

export interface Season { avg: (number | null)[]; lo: (number | null)[]; hi: (number | null)[]; years: number }

// Multi-year profile per week column, leaving out the years being compared so they are measured against the rest.
export function seasonal(weeks: WeekRow[], exclude: number[]): Season {
  const cols: number[][] = Array.from({ length: COLS }, () => []);
  const ys = new Set<number>();
  for (const w of weeks) {
    if (w.value == null || exclude.includes(yearOf(w))) continue;
    cols[colOf(w.week_start)].push(w.value);
    ys.add(yearOf(w));
  }
  const sorted = cols.map((c) => [...c].sort((a, b) => a - b));
  return {
    avg: sorted.map((c) => (c.length ? mean(c) : null)),
    lo: sorted.map((c) => (c.length ? pct(c, 0.1) : null)),
    hi: sorted.map((c) => (c.length ? pct(c, 0.9) : null)),
    years: ys.size,
  };
}

export function yearSeries(weeks: WeekRow[], year: number): (WeekRow | undefined)[] {
  const out: (WeekRow | undefined)[] = Array(COLS).fill(undefined);
  for (const w of weeks) if (yearOf(w) === year) out[colOf(w.week_start)] = w;
  return out;
}

// Selected year against the average, over only the weeks the selected year has
// (so a part-finished current year is compared fairly).
export function compareToAverage(series: (WeekRow | undefined)[], season: Season) {
  let a = 0, b = 0, n = 0;
  series.forEach((w, i) => {
    const avg = season.avg[i];
    if (w?.value != null && avg != null) { a += w.value; b += avg; n++; }
  });
  return n && b > 0 ? { pct: ((a - b) / b) * 100, weeks: n } : null;
}

export function monthAverages(weeks: WeekRow[]): (number | null)[] {
  const m: number[][] = Array.from({ length: 12 }, () => []);
  for (const w of weeks) if (w.value != null) m[+w.week_start.slice(5, 7) - 1].push(w.value);
  return m.map((xs) => (xs.length ? mean(xs) : null));
}

export function topAnomalies(weeks: WeekRow[], years: number[], n = 5): WeekRow[] {
  return weeks.filter((w) => years.includes(yearOf(w)) && w.anomaly != null)
    .sort((a, b) => b.anomaly! - a.anomaly!).slice(0, n);
}

// Highest-activity week in a year's series.
export const peakWeek = (series: (WeekRow | undefined)[]) =>
  series.reduce<WeekRow | undefined>((best, w) => (w?.value != null && (best?.value == null || w.value > best.value) ? w : best), undefined);

// Full precision for exports, without floating-point noise (0.30000000000000004 -> 0.3).
export const precise = (v: number | null | undefined, d = 6) => (v == null || !Number.isFinite(v) ? "" : String(+v.toFixed(d)));

// ---------- export ----------

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";

export function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const downloadCsv = (name: string, rows: unknown[][]) => download(name, new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));

// The charts are styled with CSS classes, which a standalone image can't see,
// so copy the computed styles onto each element before rendering.
const STYLE_PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "opacity",
  "font-size", "font-family", "font-weight", "text-anchor", "dominant-baseline", "paint-order", "stroke-linejoin"];
function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src);
  dst.setAttribute("style", STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
  for (let i = 0; i < src.children.length; i++) inlineStyles(src.children[i], dst.children[i]);
}

// Text added around the chart in the downloaded image only.
export interface ExportText { title: string; lines: string[]; caption: string }

// Greedy word wrap for canvas text; keeps a line's leading spaces so table rows stay aligned.
function wrapLine(g: CanvasRenderingContext2D, line: string, max: number): string[] {
  if (g.measureText(line).width <= max) return [line];
  const out: string[] = [];
  let cur = "";
  for (const word of line.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && g.measureText(next).width > max) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

// Renders a chart to PNG with a title above and exact figures below.
// Elements with class "export-only" (exact value labels) are hidden on screen by CSS;
// the standalone image has no stylesheet, so they appear only in the download.
export function downloadSvgPng(svg: SVGSVGElement, name: string, text: ExportText, scale = 2): Promise<void> {
  const vb = svg.viewBox.baseVal;
  const w = vb?.width || svg.clientWidth, h = vb?.height || svg.clientHeight;
  if (!(w > 0 && h > 0)) return Promise.reject(new Error("The chart is not visible yet."));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.removeAttribute("class");
  const light = document.documentElement.dataset.theme === "light";
  const bg = light ? "#ffffff" : "#0d1426", fg = light ? "#152345" : "#e8eefc", sub = light ? "#4f5e78" : "#e8eefcaa";
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
      const pad = 24, titleH = 34, lineH = 17, body = "12px monospace";
      const W = Math.max(w, 960); // wide enough for the figure tables, even when exported from a phone
      const cw = Math.min(W, w * 1.6), ch = h * (cw / w); // the chart is vector, so scaling up stays sharp
      const meas = document.createElement("canvas").getContext("2d");
      if (!meas) throw new Error("Image export is unavailable in this browser.");
      meas.font = body;
      const lines = text.lines.flatMap((l) => (l === "" ? [""] : wrapLine(meas, l, W)));
      const captions = wrapLine(meas, text.caption, W);
      const H = pad + titleH + ch + 20 + lines.length * lineH + captions.length * lineH + 30 + pad;
      const c = document.createElement("canvas");
      c.width = (W + pad * 2) * scale;
      c.height = H * scale;
      const g = c.getContext("2d");
      if (!g) throw new Error("Image export is unavailable in this browser.");
      g.scale(scale, scale);
      g.fillStyle = bg;
      g.fillRect(0, 0, W + pad * 2, H);
      g.fillStyle = fg;
      g.font = "bold 17px sans-serif";
      g.fillText(text.title, pad, pad + 18);
      g.drawImage(img, pad + (W - cw) / 2, pad + titleH, cw, ch);
      let y = pad + titleH + ch + 20 + 12;
      g.font = body;
      for (const l of lines) { g.fillText(l, pad, y); y += lineH; }
      g.fillStyle = sub;
      g.font = "11px monospace";
      for (const caption of captions) { g.fillText(caption, pad, y + 14); y += lineH; }
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? (download(name, b), resolve()) : reject(new Error("PNG export failed"))), "image/png");
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not render the image")); };
    img.src = url;
  });
}
