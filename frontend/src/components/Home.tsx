import { FireBackdrop } from "./Fire";

export default function Home() {
  return (
    <div className="page page-fill home-page">
      <FireBackdrop />
      <section className="home-hero">
      <div className="hero-split">
        <div className="hero-text">
          <p className="kicker">NASA FIRE DATA, 2000 TO NOW</p>
          <h1 className="display"><span className="hero-title-line">What does a year</span> <span className="hero-title-line">of <em>fire</em> look like?</span></h1>
          <p className="hero-sub">
            Burnadette turns two decades of NASA satellite fire detections into one calendar you can read at a glance.
          </p>
          <a className="cta home-explore-cta" href="#map">Explore <span className="cta-arrow" aria-hidden="true">→</span></a>
        </div>
        <div className="planet-wrap" aria-hidden="true">
          <div className="system" aria-hidden="true"><div className="earth" /><div className="orbit"><div className="moon" /></div></div>
        </div>
      </div>
      </section>

      <section className="intro">
        <p className="eyebrow">// about the project</p>
        <h2>Fire has a season. We make it visible.</h2>
        <p className="lead">
          Satellites have tracked fire hotspots for more than two decades, but the record is split between
          two instruments, MODIS and VIIRS, whose data can&rsquo;t be compared directly. Burnadette joins them
          into one consistent weekly record for any area you pick, so you can see which months burn most,
          which years were unusual, and how this year compares with past ones.
        </p>
        <p className="lead audience">Built for early warning and emergency responders, firefighters, land managers and scientists.</p>
      </section>

      <section className="cards">
        <article className="panel feature">
          <h3>Pick any area</h3>
          <p>Choose a pilot region, draw a rectangle or polygon on the map, or set a point and radius.</p>
        </article>
        <article className="panel feature">
          <h3>Two satellites, one scale</h3>
          <p>MODIS and VIIRS are harmonized so the two records can be compared. You can also view each on its own.</p>
        </article>
        <article className="panel feature">
          <h3>See what is unusual</h3>
          <p>Switch from raw activity to how unusual a week is, and see known data gaps marked on the calendar.</p>
        </article>
        <article className="panel feature">
          <h3>Compare and download</h3>
          <p>Compare a year with the multi-year average, find the most unusual weeks, and download the data and charts.</p>
        </article>
      </section>
    </div>
  );
}
