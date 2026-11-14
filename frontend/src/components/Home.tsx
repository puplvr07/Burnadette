import { FireBackdrop } from "./Fire";

export default function Home() {
  return (
    <div className="page page-fill">
      <FireBackdrop />
      <section className="hero-split">
        <div className="hero-text">
          <p className="kicker">NASA FIRE DATA, 2000 TO NOW</p>
          <h1 className="display">What does a year of <em>fire</em> look like?</h1>
          <span className="rule" />
          <p className="hero-sub">
            Burnadette turns two decades of NASA satellite fire detections into one calendar you can read at a glance.
          </p>
          <a className="cta" href="#calendar">Open the calendar</a>
        </div>
        <div className="planet-wrap" aria-hidden="true">
          <div className="system"><div className="earth" /><div className="orbit"><div className="moon" /></div></div>
        </div>
      </section>

      <section className="intro">
        <p className="eyebrow">// about the project</p>
        <h2>Fire has a season. We make it visible.</h2>
        <p className="lead">
          Satellites have watched Earth burn since 2000, but the raw detections are scattered across
          instruments and file formats. Burnadette puts weekly fire activity for any area you pick on a
          single scale, so you can spot the burning season, a quiet year, or an unusual one.
        </p>
      </section>

      <section className="cards">
        <article className="panel feature">
          <h3>Pick any area</h3>
          <p>Choose a pilot region or draw your own box on the map.</p>
        </article>
        <article className="panel feature">
          <h3>Two satellites, one scale</h3>
          <p>MODIS and VIIRS are harmonized so the two records can be compared. You can also view each on its own.</p>
        </article>
        <article className="panel feature">
          <h3>See what is unusual</h3>
          <p>Switch from raw activity to how unusual a week is, and see known data gaps marked on the calendar.</p>
        </article>
      </section>
    </div>
  );
}
