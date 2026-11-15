import { useEffect, useRef } from "react";
// TODO: replace the placeholder team details below with the real ones.
const MEMBERS = [
  { name: "Joemar Bayabas", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
  { name: "Hans Xavier A. Lao", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
  { name: "Sean Chester Dy", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
  { name: "Alkhaidir Radjail", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
  { name: "Ram Rohen Arcenas", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
  { name: "Yllakhem M. Aleria", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
];

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
          We are a team taking part in the NASA Space Challenge. [Add a short line on who you are, where you
          are based, and why you picked fire data.]
        </p>
      </section>

      <section className="cards members">
        {MEMBERS.map((m) => (
          <article key={m.name} className="panel member" tabIndex={0} aria-label={m.name} onPointerEnter={event => { if (event.pointerType === "mouse") playSound(); }} onFocus={playSound}>
            <div className="avatar" aria-hidden="true">{m.name.charAt(0)}</div>
            <h3>{m.name}</h3>
            <span className="chip">{m.role}</span>
            <p className="small">{m.from}</p>
            <p>{m.bio}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
