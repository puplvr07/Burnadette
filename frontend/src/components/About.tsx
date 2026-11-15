import { useEffect, useState } from "react";
import { getRegions } from "../api";
import type { Region } from "../types";
// Names, order and affiliations as set in minazaki-ui. Roles follow the project brief (Frontend / Backend / ML).
// TODO: replace each "from" placeholder with the real details if they change.
// No photos: Space Apps rules forbid likenesses of anyone under 18, and initials avoid the question.
const MEMBERS: { name: string; role: string; from: string }[] = [
  // Frontend (A to Z by first name), then Backend, then Machine learning. On desktop each team fills its own row.
  { name: "Alkhaidir Radjail", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student" },
  { name: "Sean Chester Dy", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student" },
  { name: "Yllakhem M. Aleria", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student" },
  { name: "Joemar Bayabas", role: "Backend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student" },
  { name: "Ram Rohen Arcenas", role: "Backend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student" },
  { name: "Hans Xavier A. Lao", role: "Machine learning", from: "University of The Philippines Manila, 2nd Year CS Student" },
];

// Space Apps asks teams to credit all borrowed data, code, images and tools.
const CREDITS: { what: string; detail: string }[] = [
  {
    what: "Fire data",
    detail: "Active fire detections from NASA's Fire Information for Resource Management System (FIRMS), part of NASA LANCE and ESDIS: MODIS Collection 6.1 and VIIRS S-NPP 375 m, standard (science-quality) archive, downloaded per country. Harmonized by the team. See the NASA acknowledgement at earthdata.nasa.gov/data/tools/firms.",
  },
  { what: "Map", detail: "Leaflet (BSD 2-Clause). Satellite imagery and labels from Esri World Imagery and World Boundaries and Places (Esri, Maxar, Earthstar Geographics, and the GIS User Community)." },
  { what: "Globe textures", detail: "Earth and Moon textures from the three.js example assets (github.com/mrdoob/three.js)." },
  { what: "Colors", detail: "Calendar color ramp: ColorBrewer \u201cOrRd\u201d by Cynthia Brewer, chosen to stay readable for color-blind users." },
  { what: "Fonts", detail: "Cormorant Garamond, Space Grotesk, IBM Plex Mono and Literata from Google Fonts (SIL Open Font License)." },
  { what: "Software", detail: "React, TypeScript and Vite." },
];

const pct = (x: number) => `${x > 0 ? "+" : ""}${x.toFixed(1)}%`;

// Leave-one-year-out validation per region, read from the ML export (regions.json).
function Validation() {
  const [regions, setRegions] = useState<Region[]>([]);
  useEffect(() => { getRegions().then(setRegions).catch(() => setRegions([])); }, []);
  const rows = regions.filter((r) => r.calibration?.validation?.bias_pct_raw_modis != null && r.calibration.validation.bias_pct_calibrated != null);
  if (!rows.length) return null;
  return (
    <section className="panel validation">
      <h3>How well does the harmonizing work?</h3>
      <p>Tested on years the method had not seen, the harmonized series matched VIIRS&rsquo;s regional totals within about 1%, where raw MODIS undercounted by 20&ndash;70%.</p>
      <div className="table-scroll" role="region" aria-label="Validation by region" tabIndex={0}>
        <table>
          <thead><tr><th scope="col">Region</th><th scope="col">Raw MODIS bias</th><th scope="col">Harmonized bias</th><th scope="col">Low-sensitivity months</th></tr></thead>
          <tbody>
            {[...rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => {
              const v = r.calibration!.validation!, low = r.calibration!.low_sensitivity_months ?? [];
              return <tr key={r.id}><th scope="row">{r.name}</th><td>{pct(v.bias_pct_raw_modis!)}</td><td>{pct(v.bias_pct_calibrated!)}</td><td>{low.length === 12 ? "All 12" : low.length ? low.join(", ") : "None"}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="small">Bias is the average difference from VIIRS across the 14 years that both instruments cover (2012&ndash;2025). These figures describe whole-region weekly totals. Small drawn areas are not validated.</p>
    </section>
  );
}

export default function About() {
  return (
    <div className="page page-fill">
      <section className="intro">
        <p className="eyebrow">// about us</p>
        <h2>The team behind Burnadette</h2>
        <p className="lead">
          We are team Burnadette, taking part in the 2026 NASA Space Apps Challenge on the challenge
          &ldquo;Harmonization of MODIS and VIIRS Hot Spots&rdquo;. Our goal is to give emergency responders,
          firefighters, land managers and scientists one consistent picture of when and where burning has happened.
        </p>
      </section>

      <section className="cards members">
        {MEMBERS.map((m) => (
          <article key={m.name} className="panel member" tabIndex={0} aria-label={m.name}>
            <div className="avatar" aria-hidden="true">{m.name.charAt(0)}</div>
            <h3>{m.name}</h3>
            {m.role && <span className="chip">{m.role}</span>}
            {m.from && <p className="small">{m.from}</p>}
          </article>
        ))}
      </section>

      <Validation />
      <section className="panel credits">
        <h3>Credits and data sources</h3>
        <dl>
          {CREDITS.map((c) => <div key={c.what}><dt>{c.what}</dt><dd>{c.detail}</dd></div>)}
        </dl>
        <h3>AI assistance</h3>
        <p>
          Parts of this website&rsquo;s code, layout and styling were written with help from an AI coding assistant
          (Kiro), working from the team&rsquo;s own plan and design requests. The project idea, the data method and
          the plan are the team&rsquo;s own.
        </p>
      </section>
    </div>
  );
}
