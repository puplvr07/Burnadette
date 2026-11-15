import { useEffect, useMemo, useRef, useState } from "react";
import type { Bbox, Meta, Source, WeekRow } from "../types";
import { usingFakeData } from "../api";
import {
  COLS, MONTHS, compareToAverage, downloadCsv, downloadSvgPng, hasCoverageFlag, monthAverages,
  monthCol, peakWeek, precise, seasonal, topAnomalies, yearOf, yearSeries, yearStats,
} from "../analytics";
import type { ExportText } from "../analytics";

interface Props { weeks: WeekRow[]; meta: Meta; bbox: Bbox; start: string; end: string; source: Source }

const SOURCE_LABEL: Record<Source, string> = { harmonized: "Harmonized", modis: "MODIS only", viirs: "VIIRS only" };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MAX_YEARS = 5; // more lines than this become hard to tell apart
const fmt = (v: number, d = 2) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d));
const signed = (p: number, d = 0) => (Math.abs(p) < 0.5 / 10 ** d ? `${(0).toFixed(d)}%` : `${p > 0 ? "+" : "\u2212"}${Math.abs(p).toFixed(d)}%`);
// Each compared year keeps a color slot (c-yr0 ... c-yr4); colors are set per theme in CSS.
const colorClass = (i: number) => `c-yr${i}`;

export default function Analytics({ weeks, meta, bbox, start, end, source }: Props) {
  const years = useMemo(() => yearStats(weeks), [weeks]);
  const withData = years.filter((y) => y.weeks > 0);
  const [storedPicked, setPicked] = useState<number[]>([]);
  // Props can change before the selection-sync effect runs. Never render
  // a comparison for a year that disappeared from the new response.
  const picked = useMemo(() => {
    const keep = storedPicked.filter((year) => withData.some((stat) => stat.year === year));
    return keep.length ? keep : withData.length ? [withData[withData.length - 1].year] : [];
  }, [storedPicked, years]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  // Charts are drawn at the panel's real pixel width, so their text stays readable on phones.
  const wrap = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(800);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [withData.length > 0]); // the wrapper only exists once there is data to chart

  // Keep chosen years that still have data; otherwise start with the latest year.
  useEffect(() => {
    setPicked((p) => {
      const keep = p.filter((y) => withData.some((s) => s.year === y));
      return keep.length ? keep : withData.length ? [withData[withData.length - 1].year] : [];
    });
  }, [weeks]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (y: number) => setPicked((p) => (p.includes(y) ? (p.length > 1 ? p.filter((x) => x !== y) : p) : p.length >= MAX_YEARS ? p : [...p, y]));

  const season = useMemo(() => seasonal(weeks, picked), [weeks, picked]);
  const compared = useMemo(() => picked.map((year, i) => {
    const series = yearSeries(weeks, year);
    return { year, i, series, stat: years.find((s) => s.year === year)!, cmp: compareToAverage(series, season), peak: peakWeek(series) };
  }), [weeks, years, picked, season]);
  const months = useMemo(() => monthAverages(weeks), [weeks]);
  const unusual = topAnomalies(weeks, picked);
  const complete = withData.filter((y) => !y.partial);
  const busiest = complete.length ? complete.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const quietest = complete.length ? complete.reduce((a, b) => (b.total < a.total ? b : a)) : null;
  const peakM = months.reduce<number>((best, v, i) => (v != null && (months[best] == null || v > months[best]!) ? i : best), 0);
  // With several years, the fourth card shows whichever differs most from the average.
  const lead = compared.filter((c) => c.cmp).sort((a, b) => Math.abs(b.cmp!.pct) - Math.abs(a.cmp!.pct))[0];
  const yearList = [...picked].sort((a, b) => a - b).join(", ");

  const fake = usingFakeData ? "SAMPLE_" : "";
  const base = `${fake}burnadette_${source}_${start}_${end}`;
  const caption = `Burnadette | area W,S,E,N ${bbox.join(", ")} | ${start} to ${end} | ${SOURCE_LABEL[source]}${usingFakeData ? " | SAMPLE DATA, random values" : ""}`;
  const inGap = (w: WeekRow) => hasCoverageFlag(w) || meta.gaps.some((g) => w.week_start <= g.end && w.week_start >= addDays(g.start, -6));
  const yearTag = [...picked].sort((a, b) => a - b).join("-");

  const run = async (label: string, fn: () => void | Promise<void>) => {
    setErr(""); setBusy(label);
    try { await fn(); } catch (e) { setErr(`Download failed: ${(e as Error).message}`); } finally { setBusy(""); }
  };
  const png = (id: string, name: string, text: ExportText) => run(name, () => {
    const el = document.getElementById(id) as SVGSVGElement | null;
    if (!el) throw new Error("chart not on screen");
    return downloadSvgPng(el, `${base}_${name}.png`, text);
  });

  // ---------- figures written under the downloaded images ----------
  const seasonText = (): ExportText => {
    const others = weeks.filter((w) => !picked.includes(yearOf(w)));
    const avgMonths = monthAverages(others);
    const col = (s: string, n: number) => s.padEnd(n);
    const lines = [
      `Weekly activity (${SOURCE_LABEL[source]}) for ${yearList}, against the average of ${season.years} other year${season.years === 1 ? "" : "s"}.`,
      "Typical range = 10th to 90th percentile of those other years for each week of the year.",
      "",
      col("Year", 8) + col("Weeks", 8) + col("Total activity", 17) + col("Average, same weeks", 21) + col("Difference", 12) + col("Peak week", 13) + col("Peak value", 12) + "Mean anomaly",
      ...compared.map((c) => {
        const avgSame = c.series.reduce((a, w, i) => (w?.value != null && season.avg[i] != null ? a + season.avg[i]! : a), 0);
        return col(String(c.year), 8) + col(String(c.stat.weeks), 8) + col(precise(c.stat.total, 4), 17) + col(precise(avgSame, 4), 21)
          + col(c.cmp ? signed(c.cmp.pct, 2) : "n/a", 12) + col(c.peak?.week_start ?? "n/a", 13) + col(precise(c.peak?.value, 4) || "n/a", 12)
          + (c.stat.meanAnomaly != null ? `${precise(c.stat.meanAnomaly, 2)}/100` : "n/a");
      }),
      "",
      "Monthly mean of weekly activity",
      col("", 10) + MONTHS.map((m) => m.padStart(8)).join(""),
      col("Average", 10) + avgMonths.map((v) => (precise(v, 3) || "-").padStart(8)).join(""),
      ...compared.map((c) => col(String(c.year), 10) + monthAverages(weeks.filter((w) => yearOf(w) === c.year)).map((v) => (precise(v, 3) || "-").padStart(8)).join("")),
    ];
    return { title: `Season profile: ${yearList} vs multi-year average`, lines, caption };
  };
  const yearText = (): ExportText => {
    const fullAvg = complete.length ? complete.reduce((a, b) => a + b.total, 0) / complete.length : null;
    const col = (s: string, n: number) => s.padEnd(n);
    return {
      title: "Total activity by year",
      caption,
      lines: [
        `Sum of weekly activity per year (${SOURCE_LABEL[source]}). Partial years lack one or more expected Monday-start observations, so their totals are not comparable.`,
        `Full-year average total: ${fullAvg != null ? precise(fullAvg, 4) : "n/a"} (${complete.length} full year${complete.length === 1 ? "" : "s"})`,
        "",
        col("Year", 8) + col("Weeks", 8) + col("Total activity", 17) + col("Mean weekly", 14) + col("Max weekly", 13) + col("Mean anomaly", 15) + col("vs full-year avg", 18) + "Note",
        ...years.map((s) => col(String(s.year), 8) + col(String(s.weeks), 8) + col(precise(s.total, 4), 17) + col(precise(s.mean, 4), 14)
          + col(precise(s.max, 4), 13) + col(s.meanAnomaly != null ? `${precise(s.meanAnomaly, 2)}/100` : "n/a", 15)
          + col(fullAvg && s.weeks && !s.partial ? signed(((s.total - fullAvg) / fullAvg) * 100, 2) : "n/a", 18)
          + [s.partial ? "partial year" : "", picked.includes(s.year) ? "selected" : ""].filter(Boolean).join(", ")),
      ],
    };
  };

  if (!withData.length) {
    return <p className="empty">No activity values for this source and date range, so there is nothing to compare.</p>;
  }

  const available = withData.filter((y) => !picked.includes(y.year));

  return (
    <div className="analytics" ref={wrap}>
      <div className="stat-grid">
        <Stat label="Busiest full year" value={busiest ? String(busiest.year) : "\u2014"} note={busiest ? `total activity ${fmt(busiest.total)}` : "needs a full year of data"} />
        <Stat label="Quietest full year" value={quietest ? String(quietest.year) : "\u2014"} note={quietest ? `total activity ${fmt(quietest.total)}` : "needs a full year of data"} />
        <Stat label="Peak month" value={months[peakM] != null ? MONTH_NAMES[peakM] : "\u2014"} note="highest average weekly activity" />
        <Stat label={picked.length > 1 ? "Biggest difference from average" : `${picked[0] ?? ""} vs average`}
          tone={lead?.cmp && Math.abs(lead.cmp.pct) >= 0.5 ? (lead.cmp.pct > 0 ? "up" : "down") : undefined}
          value={lead?.cmp ? signed(lead.cmp.pct) : "\u2014"}
          note={lead?.cmp ? `${picked.length > 1 ? `${lead.year}, ` : ""}over ${lead.cmp.weeks} weeks, against ${season.years} other year${season.years === 1 ? "" : "s"}` : "not enough data to compare"} />
      </div>

      <div className="chart-head">
        <h3>Season profile</h3>
        <div className="year-picker" role="group" aria-label="Years to compare">
          {picked.map((y, i) => (
            <span key={y} className={`year-chip ${colorClass(i)}`}>
              <i aria-hidden="true" />{y}
              {picked.length > 1 && <button type="button" aria-label={`Remove ${y}`} title={`Remove ${y}`} onClick={() => toggle(y)}>×</button>}
            </span>
          ))}
          <label className="inline-label">
            <span className="sr-only">Add a year to compare</span>
            <select value="" disabled={picked.length >= MAX_YEARS || !available.length} onChange={(e) => e.target.value && toggle(+e.target.value)}>
              <option value="">{picked.length >= MAX_YEARS ? `Up to ${MAX_YEARS} years` : "+ Add year"}</option>
              {available.map((y) => <option key={y.year} value={y.year}>{y.year}{y.partial ? " (partial)" : ""}</option>)}
            </select>
          </label>
        </div>
      </div>
      <p className="small">
        Weekly activity in {yearList} against the average of the other years. The shaded band is the typical range (10th to 90th percentile).
        {" "}Compare up to {MAX_YEARS} years: add them here or select bars below.
      </p>
      <div className="chart-transition" key={yearTag || "empty"}>
        <SeasonChart W={cw} season={season} compared={compared} showBand={source === "harmonized" && picked.length === 1} />
      </div>
      <div className="chart-legend">
        {compared.map((c) => <span key={c.year} className={`key ${colorClass(c.i)}`}><i className="lg-yr" /> {c.year}</span>)}
        {source === "harmonized" && picked.length === 1 && <span className="key"><i className="lg-selband" /> {picked[0]} uncertainty band</span>}
        <span className="key"><i className="lg-avg" /> multi-year average</span>
        <span className="key"><i className="lg-band" /> typical range</span>
      </div>
      {picked.length > 1 && (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead><tr><th scope="col">Year</th><th scope="col">Total activity</th><th scope="col">vs average</th><th scope="col">Peak week</th></tr></thead>
            <tbody>
              {compared.map((c) => (
                <tr key={c.year}>
                  <th scope="row"><span className={`year-dot ${colorClass(c.i)}`} aria-hidden="true" />{c.year}{c.stat.partial ? " (partial)" : ""}</th>
                  <td>{fmt(c.stat.total)}</td>
                  <td>{c.cmp ? signed(c.cmp.pct) : "\u2014"}</td>
                  <td>{c.peak ? `${c.peak.week_start} (${fmt(c.peak.value!)})` : "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="chart-head"><h3>Activity by year</h3></div>
      <p className="small">Sum of weekly active-cell fractions, not a count of fires. Select bars to compare years. Hatched bars cover partial years and are not directly comparable.</p>
      <YearChart W={cw} years={years} picked={picked} onToggle={toggle} />

      <div className="analytics-bottom-grid">
      <section className="analytics-unusual" aria-labelledby="unusual-heading">
      <div className="chart-head"><h3 id="unusual-heading">Most unusual weeks in {yearList}</h3></div>
      {unusual.length ? (
        <ol className="unusual">
          {unusual.map((w) => (
            <li key={w.week_start}>
              <strong>Week of {w.week_start}</strong>
              <span>{w.anomaly!.toFixed(0)}/100 unusual</span>
              <span>activity {w.value == null ? "no data" : fmt(w.value)}</span>
              {inGap(w) && <span className="warn">satellite gap</span>}
            </li>
          ))}
        </ol>
      ) : <p className="small">No anomaly values for {yearList}.</p>}
      </section>
      <section className="analytics-download" aria-labelledby="download-heading">
      <div className="chart-head"><h3 id="download-heading">Download</h3></div>
      <p className="small">Exports use the area, dates, source and years selected above. Downloads include exact figures{usingFakeData ? ". File names start with SAMPLE_ while sample data is in use." : "."}</p>
      <div className="downloads">
        <button type="button" disabled={!!busy} onClick={() => run("weekly", () => downloadCsv(`${base}_weekly.csv`, weeklyRows(weeks, bbox, inGap)))}>Weekly data (CSV)</button>
        <button type="button" disabled={!!busy} onClick={() => run("yearly", () => downloadCsv(`${base}_yearly.csv`, yearlyRows(years, picked)))}>Yearly summary (CSV)</button>
        <button type="button" disabled={!!busy} onClick={() => run("season-csv", () => downloadCsv(`${base}_season_${yearTag}.csv`, seasonRows(season, compared)))}>Season comparison (CSV)</button>
        <button type="button" disabled={!!busy} onClick={() => png("season-svg", `season_${yearTag}`, seasonText())}>Season profile (PNG)</button>
        <button type="button" disabled={!!busy} onClick={() => png("years-svg", "by_year", yearText())}>By year (PNG)</button>
      </div>
      {busy && <p className="small" aria-live="polite">Preparing download...</p>}
      {err && <p className="error" role="alert">{err}</p>}
      </section>
      </div>
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "up" | "down" }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-note">{note}</span>
    </div>
  );
}

// ---------- charts ----------

const L = 46, R = 12, T = 12;
interface Compared { year: number; i: number; series: (WeekRow | undefined)[]; stat: YearStat; cmp: { pct: number; weeks: number } | null; peak: WeekRow | undefined }

// Path through the non-null points, breaking the line at gaps.
function linePath(vals: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  let d = "", pen = false;
  vals.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) { pen = false; return; }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}
// Closed shapes between lo and hi for each unbroken run of points.
function bandPaths(lo: (number | null)[], hi: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  const out: string[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length > 1) {
      const top = run.map((i) => `${x(i).toFixed(1)},${y(hi[i]!).toFixed(1)}`);
      const bot = [...run].reverse().map((i) => `${x(i).toFixed(1)},${y(lo[i]!).toFixed(1)}`);
      out.push(`M${top.join("L")}L${bot.join("L")}Z`);
    }
    run = [];
  };
  lo.forEach((v, i) => (v != null && Number.isFinite(v) && hi[i] != null && Number.isFinite(hi[i]) ? run.push(i) : flush()));
  flush();
  return out;
}
function ticks(max: number) {
  const step = Math.pow(10, Math.floor(Math.log10(max / 4 || 1)));
  const s = [1, 2, 5, 10].map((m) => m * step).find((v) => max / v <= 5) ?? step * 10;
  return Array.from({ length: Math.floor(max / s) + 1 }, (_, i) => i * s);
}

function SeasonChart({ W, season, compared, showBand }: { W: number; season: Season; compared: Compared[]; showBand: boolean }) {
  const H = W < 500 ? 200 : 240, B = 26;
  const monthStep = W < 480 ? 2 : 1; // every other month label on narrow screens
  const vals = compared.map((c) => c.series.map((w) => w?.value ?? null));
  const band = showBand ? compared[0] : undefined;
  const bandLo = band?.series.map((w) => w?.uncertainty_low ?? null) ?? [];
  const bandHi = band?.series.map((w) => w?.uncertainty_high ?? null) ?? [];
  const max = Math.max(1e-6, ...[...season.hi, ...vals.flat(), ...bandHi].filter((v): v is number => v != null && Number.isFinite(v))) * 1.12;
  const x = (i: number) => L + (i * (W - L - R)) / (COLS - 1);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  return (
    <svg id="season-svg" className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Weekly activity in ${compared.map((c) => c.year).join(", ")} compared with the multi-year average`}>
      {ticks(max).map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">{t.toFixed(t < 1 && t > 0 ? 1 : 0)}</text>
        </g>
      ))}
      {MONTHS.map((m, i) => i % monthStep === 0 && <text key={m} x={x(monthCol(i))} y={H - 8} className="chart-axis">{m}</text>)}
      {bandPaths(season.lo, season.hi, x, y).map((d, i) => <path key={`b${i}`} d={d} className="avg-band" />)}
      {bandPaths(bandLo, bandHi, x, y).map((d, i) => <path key={`s${i}`} d={d} className="sel-band" />)}
      <path d={linePath(season.avg, x, y)} className="avg-line" />
      {compared.map((c, k) => <path key={c.year} d={linePath(vals[k], x, y)} className={`yr-line ${colorClass(c.i)}`} />)}
      {/* Exact peaks: hidden on screen, shown in the downloaded image. Dots mark each peak; the labels are
          stacked in the top-left corner (where activity is low) so they never overlap, and double as a legend. */}
      <g className="export-only">
        {compared.map((c) => c.peak?.value != null && (
          <circle key={c.year} cx={x(c.series.indexOf(c.peak))} cy={y(c.peak.value)} r={3.5} className={`yr-dot ${colorClass(c.i)}`} />
        ))}
        {compared.map((c, k) => (
          <text key={c.year} x={L + 10} y={T + 12 + k * 15} className={`chart-axis yr-label value-halo ${colorClass(c.i)}`}>
            {`\u2014 ${c.year}${c.peak?.value != null ? `  peak ${precise(c.peak.value, 3)} (week of ${c.peak.week_start})` : "  no data"}`}
          </text>
        ))}
        <text x={L + 10} y={T + 12 + compared.length * 15} className="chart-axis value-halo">- - multi-year average</text>
      </g>
    </svg>
  );
}

function YearChart({ W, years, picked, onToggle }: { W: number; years: YearStat[]; picked: number[]; onToggle: (y: number) => void }) {
  const H = W < 500 ? 180 : 210, B = 28;
  const max = Math.max(1e-6, ...years.map((y) => y.total)) * 1.08;
  const full = years.filter((y) => !y.partial && y.weeks > 0);
  const avg = full.length ? full.reduce((a, b) => a + b.total, 0) / full.length : null;
  const slot = (W - L - R) / years.length;
  const bw = Math.max(4, slot * 0.7);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const short = slot < 36; // two-digit year labels when bars are narrow
  const every = Math.max(1, Math.ceil((short ? 26 : 38) / slot));
  const pickedIdx = years.map((s, i) => (picked.includes(s.year) ? i : -1)).filter((i) => i >= 0);
  // Ordinary labels next to a selected year's label are hidden so they don't overlap.
  const nearPicked = (i: number) => pickedIdx.some((p) => p !== i && Math.abs(i - p) < every);
  // Exact totals (export only) turn sideways when bars are too narrow for the number.
  const vertical = slot < 48;
  return (
    <svg id="years-svg" className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Total activity per year; select a year to compare">
      <defs>
        <pattern id="partial-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#ffa63d22" /><line x1="0" y1="0" x2="0" y2="6" stroke="#ffa63d" strokeWidth="2" />
        </pattern>
      </defs>
      {ticks(max).map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">{t >= 100 ? t.toFixed(0) : t.toString()}</text>
        </g>
      ))}
      {years.map((s, i) => {
        const cx = L + slot * i + slot / 2;
        const k = picked.indexOf(s.year);
        const color = k >= 0 ? ` ${colorClass(k)}` : "";
        const cls = s.partial ? "bar bar-partial" : k >= 0 ? `bar bar-pick${color}` : "bar";
        const top = y(s.total), height = Math.max(0, y(0) - top);
        return (
          <g key={s.year} className={`bar-hit${color}`} role="button" tabIndex={s.weeks > 0 ? 0 : -1}
            aria-label={`${s.year}: total ${precise(s.total)} over ${s.weeks} weeks${s.partial ? ", partial year" : ""}`}
            aria-pressed={k >= 0} aria-disabled={s.weeks === 0}
            onKeyDown={(event) => { if (s.weeks > 0 && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onToggle(s.year); } }}
            onClick={() => s.weeks > 0 && onToggle(s.year)}>
            <title>{`${s.year}: total ${s.total.toFixed(1)} over ${s.weeks} weeks${s.partial ? " (partial year)" : ""}. ${k >= 0 ? "Click to remove" : "Click to compare"}.`}</title>
            <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill="transparent" />
            <rect x={cx - bw / 2} y={top} width={bw} height={height} rx={2} className={cls} fill={s.partial ? "url(#partial-hatch)" : undefined} />
            {k >= 0 && s.partial && <rect x={cx - bw / 2} y={top} width={bw} height={height} rx={2} className="bar-outline" />}
            {((i % every === 0 && !nearPicked(i)) || k >= 0) && (
              <text x={cx} y={H - 10} textAnchor="middle" className={`chart-axis${k >= 0 ? " yr-label chart-axis-pick" : ""}`}>
                {short ? `'${String(s.year).slice(2)}` : s.year}
              </text>
            )}
            {/* Exact total: hidden on screen, shown in the downloaded image. Sideways labels sit inside tall bars
                (reading upward from near the top) and above short ones; a halo keeps them readable on any bar color. */}
            {s.weeks > 0 && (() => {
              const label = precise(s.total, 2);
              if (!vertical) return <text className="export-only chart-axis value-halo" textAnchor="middle" x={cx} y={height > 30 && top - T < 14 ? top + 13 : top - 4}>{label}</text>;
              const inside = height > 48;
              const ay = inside ? top + 6 : top - 4;
              return <text className="export-only chart-axis value-halo" textAnchor={inside ? "end" : "start"} x={cx + 4} y={ay} transform={`rotate(-90 ${cx + 4} ${ay})`}>{label}</text>;
            })()}
          </g>
        );
      })}
      {avg != null && (
        <g>
          <line x1={L} x2={W - R} y1={y(avg)} y2={y(avg)} className="avg-line" />
          <text x={W - R} y={y(avg) - 5} textAnchor="end" className="chart-axis">full-year average</text>
        </g>
      )}
    </svg>
  );
}

// ---------- CSV rows (full precision) ----------

function weeklyRows(weeks: WeekRow[], bbox: Bbox, inGap: (w: WeekRow) => boolean): unknown[][] {
  return [
    ["week_start", "value", "uncertainty_low", "uncertainty_high", "anomaly", "active_cells", "low_sensitivity_share", "harmonized_source", "flags", "known_gap", "area_bbox"],
    ...weeks.map((w) => [w.week_start, precise(w.value), precise(w.uncertainty_low), precise(w.uncertainty_high), precise(w.anomaly), w.active_cells,
      precise(w.low_sensitivity_share), w.harmonized_source ?? "", w.flags.join(";"), inGap(w) ? 1 : 0, bbox.join(",")]),
  ];
}
function yearlyRows(years: YearStat[], picked: number[]): unknown[][] {
  const full = years.filter((y) => !y.partial && y.weeks > 0);
  const avg = full.length ? full.reduce((a, b) => a + b.total, 0) / full.length : null;
  return [
    ["year", "weeks_with_data", "total_activity", "mean_weekly_activity", "max_weekly_activity", "mean_anomaly", "vs_full_year_average_pct", "partial_year", "selected"],
    ...years.map((y) => [y.year, y.weeks, precise(y.total), precise(y.mean), precise(y.max), precise(y.meanAnomaly),
      avg && y.weeks && !y.partial ? precise(((y.total - avg) / avg) * 100, 4) : "", y.partial ? 1 : 0, picked.includes(y.year) ? 1 : 0]),
  ];
}
// One row per week of the year: the multi-year average and range, then each compared year.
function seasonRows(season: Season, compared: Compared[]): unknown[][] {
  return [
    ["week_of_year", "approx_month", "average_other_years", "p10_other_years", "p90_other_years",
      ...compared.flatMap((c) => [`${c.year}_week_start`, `${c.year}_value`, `${c.year}_uncertainty_low`, `${c.year}_uncertainty_high`])],
    ...Array.from({ length: COLS }, (_, i) => [
      i + 1, MONTHS[Math.min(11, Math.floor((i * 7) / 30.44))], precise(season.avg[i]), precise(season.lo[i]), precise(season.hi[i]),
      ...compared.flatMap((c) => {
        const w = c.series[i];
        return [w?.week_start ?? "", precise(w?.value), precise(w?.uncertainty_low), precise(w?.uncertainty_high)];
      }),
    ]),
  ];
}

function addDays(iso: string, n: number) {
  return new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
}

type Season = ReturnType<typeof seasonal>;
type YearStat = ReturnType<typeof yearStats>[number];
