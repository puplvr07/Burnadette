// TODO: replace the placeholder team details below with the real ones.
const MEMBERS = [
  { name: "Member One", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
  { name: "Member Two", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
  { name: "Member Three", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
  { name: "Member Four", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
  { name: "Member Five", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
  { name: "Member Six", role: "Role", from: "Hometown, Country", bio: "A sentence about this person." },
];

export default function About() {
  return (
    <div className="page">
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
          <article key={m.name} className="panel member">
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
