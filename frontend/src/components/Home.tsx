import { useEffect, useRef, useState } from "react";
import InstrumentOrbit from "./InstrumentOrbit";
import type { Instrument } from "./InstrumentOrbit";
import HomeCalendarPreview from "./HomeCalendarPreview";
import { loadSamplePreview } from "../samplePreview";
import { colorFor } from "../colors";
const INFO = {
  modis: { name:"MODIS", full:"Moderate Resolution Imaging Spectroradiometer", hosts:"Terra · Aqua", resolution:"1 km product", text:"MODIS instruments aboard NASA’s Terra and Aqua satellites observe thermal anomalies and active fires. Their 1 km active-fire product contributes to the weekly record presented in Burnadette. Consult each week’s provenance for the source actually used; this illustration does not establish project coverage or calibration.", url:"https://firms.modaps.eosdis.nasa.gov/content/active_fire/" },
  viirs: { name:"VIIRS", full:"Visible Infrared Imaging Radiometer Suite", hosts:"Suomi NPP · NOAA-20 · NOAA-21", resolution:"375 m product", text:"VIIRS instruments aboard Suomi NPP, NOAA-20 and NOAA-21 provide active-fire observations, including a 375 m product. Burnadette presents the supplied weekly observations alongside source and uncertainty information. A smaller product pixel does not guarantee detection of every fire; missing observations are not zero activity.", url:"https://viirsland.gsfc.nasa.gov/Products/NASA/FireESDR.html" }
};
export default function Home() {
  const [showBackToTop,setShowBackToTop]=useState(false);
  const homeHeading=useRef<HTMLHeadingElement>(null);
  const sampleSection=useRef<HTMLDivElement>(null);
  const [sampleValues,setSampleValues]=useState<number[]>([]);
  useEffect(()=>{
    let cancelled=false;
    loadSamplePreview().then(rows=>{
      if (!cancelled) setSampleValues(rows.slice(-20).map(row=>row.value ?? 0));
    }).catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    const update=()=>setShowBackToTop(window.scrollY > 600);
    update();
    window.addEventListener("scroll",update,{passive:true});
    return ()=>window.removeEventListener("scroll",update);
  },[]);
  const [active,setActive]=useState<Instrument|null>(null);
  const [transition,setTransition]=useState<"leaving"|"returning"|null>(null);
  const heading=useRef<HTMLHeadingElement>(null), initiator=useRef<HTMLElement|null>(null);
  const scroll=useRef(0), timer=useRef<ReturnType<typeof setTimeout>|null>(null), busy=useRef(false);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  const change=(kind:Instrument|null)=>{
    if(busy.current)return;
    busy.current=true;
    if(!active){initiator.current=document.activeElement as HTMLElement;scroll.current=window.scrollY;}
    setTransition("leaving");
    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    timer.current=setTimeout(()=>{
      setActive(kind);setTransition("returning");
      requestAnimationFrame(()=>{
        if(kind){window.scrollTo({top:0,behavior:"instant"});heading.current?.focus({preventScroll:true});}
        else{initiator.current?.focus({preventScroll:true});window.scrollTo({top:scroll.current,behavior:"instant"});}
      });
      timer.current=setTimeout(()=>{setTransition(null);busy.current=false;},reduced?0:550);
    },reduced?0:280);
  };
  const select=(kind:Instrument)=>change(kind);
  const close=()=>change(null);
  return <div className={`page home-page redesign-home hero-expanded${transition?` home-${transition}`:""}`} onKeyDown={event=>{if(event.key==="Escape"){if(active)close();}}}>
    <div className="home-overview" hidden={active!==null} {...(active!==null || transition==="leaving" ? {inert:""} : {})}>
    <section className="redesign-hero">
      <div className="redesign-hero-copy">
          <p className="eyebrow">NASA FIRE DATA · TWO INSTRUMENTS · ONE WEEKLY VIEW</p>
          <h1 ref={homeHeading} tabIndex={-1}>What does a year of <em>fire</em> look like?</h1>
          <p className="redesign-lead">Explore weekly fire patterns across years, with sources, uncertainty and gaps in view.</p>
          <div className="hero-actions"><a className="primary-action" href="#calendar">Explore weekly patterns →</a></div>
          {sampleValues.length > 0 && <button type="button" className="hero-sample-link" onClick={()=>sampleSection.current?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"})}>
            <span className="hero-sample-copy"><strong>See a weekly calendar</strong><small>LOCAL SAMPLE · NOT SATELLITE FINDINGS</small></span>
            <span className="hero-sample-grid" aria-hidden="true">{sampleValues.map((value,index)=><i key={index} style={{background:colorFor(value/(Math.max(...sampleValues)||1))}} />)}</span>
            <span className="hero-sample-arrow" aria-hidden="true">↓</span>
          </button>}
      </div>
      <InstrumentOrbit active={active} onSelect={select}/>
    </section>
    <div ref={sampleSection} className="home-demonstration"><HomeCalendarPreview/></div>
    <section className="harmonization-story" aria-labelledby="instrument-story-heading">
      <p className="eyebrow">THE INSTRUMENTS BEHIND THE RECORD</p>
      <h2 id="instrument-story-heading">MODIS and VIIRS.<br/>Understand the observations.</h2>
      <div>
        <p>MODIS and VIIRS observe active fires from different satellites. Explore each instrument to learn more.</p>
        <div className="instrument-inline-actions"><button type="button" className="outline-action" onClick={()=>select("modis")}>About MODIS →</button><button type="button" className="outline-action" onClick={()=>select("viirs")}>About VIIRS →</button></div>
        <p>Compare seasons and years alongside source, uncertainty and gaps. These observations do not predict future fires.</p>
        <a className="text-action" href="#map">Choose an analysis region →</a>
      </div>
    </section>
    </div>
    {showBackToTop && !active && <button type="button" className="home-back-to-top" aria-label="Back to top" title="Back to top" onClick={()=>{
      homeHeading.current?.focus({preventScroll:true});
      window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
    }}><span aria-hidden="true">↑</span></button>}
    {active&&<section className="instrument-view" aria-labelledby="instrument-title" {...(transition==="leaving" ? {inert:""} : {})}>
      <div className="instrument-copy" key={active}>
        <button type="button" className="text-action" onClick={close}>← Back to overview</button>
        <p className="eyebrow">INSTRUMENT {active==="modis"?"1":"2"} OF 2</p>
        <h1 id="instrument-title" ref={heading} tabIndex={-1}>{INFO[active].name}</h1>
        <p className="instrument-full-name">{INFO[active].full}</p>
        <p className="redesign-lead">{INFO[active].text}</p>
        <dl className="instrument-facts"><div><dt>Host satellites</dt><dd>{INFO[active].hosts}</dd></div><div><dt>Active-fire product resolution</dt><dd>{INFO[active].resolution}</dd></div></dl>
        <div className="hero-actions"><a href={INFO[active].url} target="_blank" rel="noreferrer" className="outline-action">NASA reference ↗</a><button type="button" className="primary-action" onClick={()=>select(active==="modis"?"viirs":"modis")}>Next: {active==="modis"?"VIIRS":"MODIS"} →</button></div>
      </div>
      <figure className={`instrument-model model-${active}`} key={`model-${active}`}>
        <div className="instrument-model-orbit"><img className="instrument-photo" src={active === "modis" ? "/modis-instrument-nasa.jpg" : "/viirs-instrument-noaa.jpg"} alt={active === "modis" ? "MODIS instrument in a laboratory" : "VIIRS instrument for JPSS-2 before integration"} /></div>
        <figcaption>{active === "modis" ? <>MODIS instrument · <a href="https://atmosphere-imager.gsfc.nasa.gov/links/modis-instrument" target="_blank" rel="noreferrer">NASA</a></> : <>JPSS-2 VIIRS instrument · <a href="https://www.nesdis.noaa.gov/imagery/media-stills-animation/jpss/mission-satellite/viirs-gallery" target="_blank" rel="noreferrer">NOAA</a></>}</figcaption>
      </figure>
    </section>}
  </div>;
}
