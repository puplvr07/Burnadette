// Creates public/fake_cell_week.csv in the agreed cell_week schema (port of the team's Python script).
// Values are random and mean nothing. Never show fake data in the final demo.
import { writeFileSync, mkdirSync } from "node:fs";

let s = 42;
const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const normal = (m, sd) => m + sd * Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const r = (x, d) => Number(x.toFixed(d));

const cells = [];
for (let lat = 10.25; lat < 14.0; lat += 0.5) for (let lon = 120.25; lon < 123.0; lon += 0.5) cells.push([lat, lon]);

const DAY = 86400000;
const weeks = [];
for (let t = Date.UTC(2000, 10, 6); t <= Date.UTC(2025, 11, 29); t += 7 * DAY) weeks.push(new Date(t));

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
}

const header = "cell_id,lat,lon,week_start,year,week_of_year,modis_active,viirs_active,modis_n,viirs_n,modis_frp,viirs_frp,harmonized_value,harmonized_source,anomaly,low_sensitivity,uncertainty_low,uncertainty_high,flags";
const out = [header];
cells.forEach(([lat, lon], i) => {
  const base = 0.2 + rand() * 0.8;
  for (const w of weeks) {
    const doy = Math.floor((w - Date.UTC(w.getUTCFullYear(), 0, 0)) / DAY);
    const season = 1 + Math.sin(((doy - 60) / 365) * 2 * Math.PI);
    const v = Math.max(0, normal(base * season, 0.5));
    const active = v > 0.8 ? 1 : 0;
    const viirs = w.getUTCFullYear() >= 2012;
    const iso = w.toISOString().slice(0, 10);
    let flags = "";
    if (iso >= "2020-08-16" && iso <= "2020-09-02") flags = "aqua_outage";
    if (iso >= "2022-07-27" && iso <= "2022-08-10") flags = "snpp_outage";
    out.push([
      `c${String(i).padStart(3, "0")}`, lat, lon, iso, w.getUTCFullYear(), isoWeek(w),
      active, viirs ? active : 0,
      Math.floor(v * 3), viirs ? Math.floor(v * 12) : 0,
      r(v * 20, 1), viirs ? r(v * 8, 1) : 0,
      r(v, 3), viirs ? "viirs" : "modis_scaled",
      r(Math.min(100, Math.max(0, normal(50, 25))), 1),
      rand() < 0.1 ? 1 : 0, r(Math.max(0, v - 0.3), 3), r(v + 0.3, 3), flags,
    ].join(","));
  }
});
mkdirSync("public", { recursive: true });
writeFileSync("public/fake_cell_week.csv", out.join("\n") + "\n");
console.log(`fake_cell_week.csv: ${out.length - 1} rows`);
