import { useEffect, useRef, useState } from "react";
import { getRegions } from "../api";
import type { Region } from "../types";
import "./About.css";
// Names, order and affiliations as set in minazaki-ui. Roles follow the project brief (Frontend / Backend / ML).
// TODO: replace each "from" placeholder with the real details if they change.
const MEMBERS: { name: string; role: string; from: string; photo: string; linkedin: string; github: string }[] = [
  // Frontend (A to Z by first name), then Backend, then Machine learning. On desktop each team fills its own row.
  { name: "Alkhaidir Radjail", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student", photo: "alkhaidir-radjail.jpg", linkedin: "alkhaidir-radjail-96b550431", github: "Minazaki12" },
  { name: "Sean Chester Dy", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student", photo: "sean-dy.jpg", linkedin: "sean-chester-dy-6994b5380", github: "puplvr07" },
  { name: "Yllakhem M. Aleria", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student", photo: "yllakhem-aleria.jpg", linkedin: "yllakhem-aleria-130493440", github: "Kim-154" },
  { name: "Joemar Bayabas", role: "Backend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student", photo: "joemar-bayabas.jpg", linkedin: "joemarbayabas", github: "jombr-dev" },
  { name: "Ram Rohen Arcenas", role: "Backend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student", photo: "ram-arcenas.jpg", linkedin: "ram-arcenas-165261431", github: "Inzhane-rms" },
  { name: "Hans Xavier A. Lao", role: "Machine learning", from: "University of The Philippines Manila, 2nd Year CS Student", photo: "hans-xavier-lao.jpg", linkedin: "hans-xavier-lao-b23b313a1", github: "Hanxavl" },
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
          We are team GraviTEH Not Found, taking part in the 2026 NASA Space Apps Challenge on the challenge
          &ldquo;Harmonization of MODIS and VIIRS Hot Spots&rdquo;. Our goal is to give emergency responders,
          firefighters, land managers and scientists one consistent picture of when and where burning has happened.
        </p>
      </section>

      <section className="cards members">
        {MEMBERS.map((m) => (
          <article key={m.name} className="panel member" tabIndex={0} aria-label={m.name} onPointerEnter={event => { if (event.pointerType === "mouse") playSound(); }} onFocus={playSound}>
            <img className="member-photo" src={`${import.meta.env.BASE_URL}team/${m.photo}`} alt={`Portrait of ${m.name}`} width={112} height={112} loading="lazy" decoding="async" />
            <h3>{m.name}</h3>
            {m.role && <span className="chip">{m.role}</span>}
            {m.from && <p className="small">{m.from}</p>}
            <div className="member-socials">
            <a className="member-social" href={`https://www.linkedin.com/in/${m.linkedin}/`} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on LinkedIn: linkedin.com/in/${m.linkedin} (opens in a new tab)`} title={`linkedin.com/in/${m.linkedin}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span className="member-social-tooltip" aria-hidden="true">linkedin.com/in/{m.linkedin}</span>
            </a>
            <a className="member-social" href={`https://github.com/${m.github}`} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on GitHub: @${m.github} (opens in a new tab)`} title={`github.com/${m.github}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                <path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.467-1.334-5.467-5.93 0-1.31.467-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.52 11.52 0 0 1 3-.405c1.02.005 2.045.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              <span className="member-social-tooltip" aria-hidden="true">github.com/{m.github}</span>
            </a>
            </div>
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
