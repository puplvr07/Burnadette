// Names, order and profile placeholders as set in minazaki-ui. Roles follow the project brief (Frontend / Backend / ML).
// TODO: replace each "from" and "bio" placeholder with the real details.
// No photos: Space Apps rules forbid likenesses of anyone under 18, and initials avoid the question.
const MEMBERS: { name: string; role: string; from: string; bio: string }[] = [
  // Frontend (A to Z by first name), then Backend, then Machine learning. On desktop each team fills its own row.
  { name: "Alkhaidir Radjail", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student", bio: "A sentence about this person." },
  { name: "Sean Chester Dy", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student", bio: "A sentence about this person." },
  { name: "Yllakhem M. Aleria", role: "Frontend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student", bio: "A sentence about this person." },
  { name: "Joemar Bayabas", role: "Backend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student", bio: "A sentence about this person." },
  { name: "Ram Rohen Arcenas", role: "Backend", from: "Pamantasan ng Lungsod ng Maynila, 2nd Year CS Student", bio: "A sentence about this person." },
  { name: "Hans Xavier A. Lao", role: "Machine learning", from: "University of The Philippines Manila, 2nd Year CS Student", bio: "A sentence about this person." },
];

// Space Apps asks teams to credit all borrowed data, code, images and tools.
const CREDITS: { what: string; detail: string }[] = [
  {
    what: "Fire data",
    // TODO (harmonization lead): replace with the exact NASA products, versions, links and citations used.
    detail: "Active fire hotspot detections from NASA's MODIS and VIIRS instruments, harmonized by the team. Exact products and citations will be listed here.",
  },
  { what: "Map", detail: "Leaflet (BSD 2-Clause). Satellite imagery and labels from Esri World Imagery and World Boundaries and Places (Esri, Maxar, Earthstar Geographics, and the GIS User Community)." },
  { what: "Globe textures", detail: "Earth and Moon textures from the three.js example assets (github.com/mrdoob/three.js)." },
  { what: "Colors", detail: "Calendar color ramp: ColorBrewer \u201cOrRd\u201d by Cynthia Brewer, chosen to stay readable for color-blind users." },
  { what: "Fonts", detail: "Cormorant Garamond, Space Grotesk, IBM Plex Mono and Literata from Google Fonts (SIL Open Font License)." },
  { what: "Software", detail: "React, TypeScript and Vite." },
];

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
            {m.bio && <p>{m.bio}</p>}
          </article>
        ))}
      </section>

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
