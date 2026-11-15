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
  return (
    <div className="page page-fill">
      <section className="intro">
        <p className="eyebrow">// about us</p>
        <h2>The team behind Burnadette</h2>
        <p className="lead">
          We are a team taking part in the NASA Space Challenge. [Add a short line on who you are, where you
          are based, and why you picked fire data.]
        </p>
      </section>

      <section className="cards members">
        {MEMBERS.map((m) => (
          <article key={m.name} className="panel member" tabIndex={0} aria-label={m.name}>
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
