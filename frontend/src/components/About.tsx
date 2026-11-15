import { useEffect, useRef, useState } from "react";
import { getRegions } from "../api";
import type { Region } from "../types";
// Names, order and affiliations as set in minazaki-ui. Roles follow the project brief (Frontend / Backend / ML).
// TODO: replace each "from" placeholder with the real details if they change.
const MEMBERS: { name: string; role: string; from: string; photo: string; linkedin?: string }[] = [
  // Frontend (A to Z by first name), then Backend, then Machine learning. On desktop each team fills its own row.
  { name: "Alkhaidir Radjail", photo: "alkhaidir-radjail.jpg", linkedin: "alkhaidir-radjail-96b550431", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student" },
  { name: "Sean Chester Dy", photo: "sean-dy.jpg", linkedin: "sean-chester-dy-6994b5380", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student" },
  { name: "Yllakhem M. Aleria", photo: "yllakhem-aleria.jpg", linkedin: "yllakhem-aleria-130493440", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student" },
  { name: "Joemar Bayabas", photo: "joemar-bayabas.jpg", linkedin: "joemarbayabas", role: "Backend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student" },
  { name: "Ram Rohen Arcenas", photo: "ram-rohen-arcenas.jpg", linkedin: "ram-arcenas-165261431", role: "Backend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student" },
  { name: "Hans Xavier A. Lao", photo: "hans-xavier-lao.jpg", linkedin: "hans-xavier-lao-b23b313a1", role: "Machine learning", from: "University of The Philippines Manila, 2nd Year CS Student" },
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
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => () => { void audio.current?.close(); }, []);
  const playSound = async () => {
    let context: AudioContext;
    try {
      context = audio.current ??= new AudioContext();
      if (context.state !== "running") await context.resume();
    } catch { return; }
    if (context.state !== "running") return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(760, start);
    oscillator.frequency.exponentialRampToValueAtTime(480, start + .055);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.035, start + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, start + .075);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(start); oscillator.stop(start + .08);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  };
  return (
    <div className="page page-fill about-page">
      <section className="intro">
        <p className="eyebrow">// ABOUT US</p>
        <h2>THE TEAM BEHIND BURNADETTE</h2>
        <p className="lead">
          We are team Burnadette, taking part in the 2026 NASA Space Apps Challenge on the challenge
          &ldquo;Harmonization of MODIS and VIIRS Hot Spots&rdquo;. Our goal is to give emergency responders,
          firefighters, land managers and scientists one consistent picture of when and where burning has happened.
        </p>
      </section>

      <section className="cards members">
        {MEMBERS.map((m) => (
          <article key={m.name} className="panel member" tabIndex={0} aria-label={m.name} onPointerEnter={event => { if (event.pointerType === "mouse") playSound(); }} onFocus={playSound}>
            <div className="member-profile-row">
              <img className="avatar member-photo" src={`${import.meta.env.BASE_URL}team/${m.photo}`} alt={`${m.name} portrait`} width="96" height="96" loading="lazy" decoding="async" />
              {m.linkedin && <a className="member-linkedin" href={`https://www.linkedin.com/in/${m.linkedin}/`} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on LinkedIn (opens in a new tab)`}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96C2 21.32 2.69 22 3.55 22h16.9c.86 0 1.55-.68 1.55-1.52V3.52C22 2.68 21.31 2 20.45 2ZM7.93 18.75H4.98V9.2h2.95v9.55ZM6.45 7.9a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.3 10.85H15.8V14.1c0-1.1-.02-2.52-1.54-2.52-1.54 0-1.78 1.2-1.78 2.44v4.73H9.53V9.2h2.83v1.3h.04c.4-.75 1.36-1.54 2.79-1.54 2.98 0 3.56 1.96 3.56 4.5v5.29Z"/></svg>
                <span className="member-linkedin-tooltip">linkedin.com/in/{m.linkedin}</span>
              </a>}
            </div>
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
      </section>
    </div>
  );
}
