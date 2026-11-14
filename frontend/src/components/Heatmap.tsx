import { useMemo, useState } from "react";
import type { Meta, Metric, WeekRow } from "../types";
import { colorFor } from "../colors";

interface Props { weeks: WeekRow[]; metric: Metric; meta: Meta; start: string; end: string }

const CELL = 14, GAP = 2, LEFT = 74, TOP = 22, COLS = 53;
const STEP = CELL + GAP;
const doy = (iso: string) => Math.floor((Date.parse(iso) - Date.UTC(+iso.slice(0, 4), 0, 0)) / 86400000);
const colOf = (iso: string) => Math.min(COLS - 1, Math.floor((doy(iso) - 1) / 7));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Heatmap({ weeks, metric, meta, start, end }: Props) {
  const [hover, setHover] = useState<WeekRow | null>(null);

  const { years, byKey, max } = useMemo(() => {
    const byKey = new Map<string, WeekRow>();
    const ys = new Set<number>();
    let vals: number[] = [];
    for (const w of weeks) {
      const y = +w.week_start.slice(0, 4);
      ys.add(y);
      byKey.set(`${y}-${colOf(w.week_start)}`, w);
      if (w.value != null) vals.push(w.value);
    }
    vals.sort((a, b) => a - b);
    // 98th percentile so a single spike does not wash out the rest
    const max = vals.length ? Math.max(vals[Math.floor(vals.length * 0.98)] ?? 0, 1e-6) : 1;
    return { years: [...ys].sort((a, b) => a - b), byKey, max };
  }, [weeks]);

  const allZero = weeks.length > 0 && weeks.every((w) => (w.value ?? 0) === 0);
  const inGap = (w: WeekRow) => meta.gaps.some((g) => w.week_start <= g.end && addDays(w.week_start, 6) >= g.start);
  const width = LEFT + COLS * STEP - GAP;
  const height = TOP + years.length * STEP - GAP;

  if (!weeks.length) return <p className="empty">No data in this area and date range.</p>;

  return (
    <div>
      {allZero && <p className="empty">No fire detected in this area and period.</p>}
      <div className="heat-scroll">
        <svg className="heat-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMin meet" role="img" aria-label="Calendar heatmap of burning activity, years down, weeks across">
          <defs>
            <pattern id="nodata" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="#eee" /><line x1="0" y1="0" x2="0" y2="4" stroke="#aaa" strokeWidth="1.5" />
            </pattern>
          </defs>
          {MONTHS.map((m, i) => (
            <text key={m} x={LEFT + Math.floor((i * 365.25) / 12 / 7) * STEP} y={14} className="axis">{m}</text>
          ))}
          {years.map((y, row) => {
            const scaled = `${y}-12-31` < meta.viirs_start;
            return (
              <g key={y}>
                <text x={LEFT - 6} y={TOP + row * STEP + CELL - 3} textAnchor="end" className="axis">{y}</text>
                {scaled && <text x={4} y={TOP + row * STEP + CELL - 3} className="axis scaled">scaled</text>}
                {Array.from({ length: COLS }, (_, col) => {
                  const w = byKey.get(`${y}-${col}`);
                  // Empty slot (outside the date range, or no 53rd week this year):
                  // a faint cell keeps the grid a full rectangle.
                  if (!w) return <rect key={col} x={LEFT + col * STEP} y={TOP + row * STEP} width={CELL} height={CELL} rx={2} className="cell-empty" />;
                  const v = metric === "anomaly" ? w.anomaly : w.value;
                  const t = v == null ? null : metric === "anomaly" ? v / 100 : v / max;
                  const x = LEFT + col * STEP, yy = TOP + row * STEP;
                  return (
                    <g key={col} onPointerEnter={() => setHover(w)} onPointerDown={() => setHover(w)} onPointerLeave={() => setHover(null)}>
                      <rect x={x} y={yy} width={CELL} height={CELL} rx={2} fill={t == null ? "url(#nodata)" : colorFor(t)} stroke="#0004" />
                      {hover === w && <rect x={x - 1} y={yy - 1} width={CELL + 2} height={CELL + 2} rx={3} fill="none" stroke="#fff" strokeWidth={1.5} pointerEvents="none" />}
                      {inGap(w) && <rect x={x + 1} y={yy + 1} width={CELL - 2} height={CELL - 2} fill="none" stroke="#1f5fff" strokeWidth={2} />}
                      {w.low_sensitivity_share >= 0.3 && metric === "activity" && w.value != null && (
                        <circle cx={x + CELL - 3.5} cy={yy + 3.5} r={2.2} fill="#fff" stroke="#000" strokeWidth={0.8} />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="legend">
        <span>{metric === "anomaly" ? "Usual (0)" : "Quiet"}</span>
        <span className="ramp">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ background: colorFor(i / 8) }} />)}</span>
        <span>{metric === "anomaly" ? "Very unusual (100)" : "Intense"}</span>
        <span className="key"><i className="k-gap" /> known gap</span>
        <span className="key"><i className="k-dot" /> low-confidence share high</span>
        <span className="key"><i className="k-nodata" /> no data</span>
        <span className="key"><i className="k-empty" /> no week (outside range, or year has no 53rd week)</span>
        <span className="key">"scaled" rows: MODIS scaled to VIIRS</span>
      </div>

      <div className="tip" aria-live="polite">
        {hover ? <Tip w={hover} metric={metric} range={`${start} to ${end}`} gap={inGap(hover)} /> : "Hover or tap a week for details."}
      </div>
    </div>
  );
}

function addDays(iso: string, n: number) {
  return new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
}

function Tip({ w, metric, gap }: { w: WeekRow; metric: Metric; range: string; gap: boolean }) {
  const src = w.harmonized_source === "modis_scaled" ? "MODIS scaled to VIIRS" : w.harmonized_source === "viirs" ? "measured by VIIRS" : w.harmonized_source;
  return (
    <>
      <strong>Week of {w.week_start}</strong>{" "}
      {w.value == null ? "No data for this source." : <>Activity {w.value.toFixed(2)}
        {w.uncertainty_low != null && <> (range {w.uncertainty_low.toFixed(2)} to {w.uncertainty_high!.toFixed(2)})</>}</>}
      {" "}| Anomaly {w.anomaly?.toFixed(0) ?? "n/a"}/100 | {w.active_cells} active cell{w.active_cells === 1 ? "" : "s"}
      {w.low_sensitivity_share > 0 && <> | {Math.round(w.low_sensitivity_share * 100)}% low-sensitivity cells</>}
      {src && metric !== undefined && <> | {src}</>}
      {w.flags.length > 0 && <> | flags: {w.flags.join(", ")}</>}
      {gap && <> | known satellite gap</>}
    </>
  );
}
