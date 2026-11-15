import { useEffect, useRef, useState, type RefObject } from "react";
export type Instrument = "modis" | "viirs";
export function SatelliteIcon({kind}:{kind:Instrument}) {
  return <svg viewBox="0 0 180 110" width="108" height="66" aria-hidden="true">
    {kind==="modis"?<g transform="rotate(-12 90 55)">
      <path d="M8 12h94v29H8Z" fill="#414f9c" stroke="#b2bbed" strokeWidth="2"/>
      <path d="M26 12v29m19-29v29m19-29v29m19-29v29M8 26h94" stroke="#8290ca"/>
      <path d="M72 41l19 25m7-25l12 25" stroke="#d9d3c5" strokeWidth="3"/>
      <path d="M42 65h104v32H42Z" fill="#b78a30" stroke="#e3d7b4" strokeWidth="2"/>
      <path d="M49 71h41v20H49Zm49 0h39v20H98Z" fill="#333e70"/>
      <path d="M60 71v20m15-20v20m36-20v20m14-20v20" stroke="#6d7bae"/>
      <path d="M140 63l12-36h11v42" fill="#cc9b36" stroke="#dfc17c" strokeWidth="2"/>
      <circle cx="160" cy="24" r="10" fill="#302d28" stroke="#a29b90" strokeWidth="2"/>
      <rect x="98" y="54" width="21" height="14" rx="2" fill="#ded8ca"/><circle cx="109" cy="59" r="5" fill="#24252c"/>
    </g>:<g transform="rotate(10 90 55)">
      <path d="M6 36h63v38H6Zm105 0h63v38h-63Z" fill="#bacbec" stroke="#e6e9ee" strokeWidth="2"/>
      <path d="M21 36v38m16-38v38m16-38v38m74-38v38m16-38v38m16-38v38M6 55h63m42 0h63" stroke="#7487b4" strokeWidth="2"/>
      <rect x="69" y="27" width="42" height="56" rx="5" fill="#c79a36" stroke="#eee9da" strokeWidth="5"/>
      <circle cx="90" cy="56" r="14" fill="#252323" stroke="#856020" strokeWidth="4"/>
      <path d="M98 27V13m-8 70l10 16m-7 0h19" stroke="#dad5ca" strokeWidth="3"/>
      <circle cx="98" cy="10" r="6" fill="#e4ded0"/>
    </g>}
  </svg>;
}
export default function InstrumentOrbit({active,onSelect,onExpand,expandRef}:{active:Instrument|null;onSelect:(kind:Instrument)=>void;onExpand?:()=>void;expandRef?:RefObject<HTMLButtonElement>}) {
  const stage = useRef<HTMLDivElement>(null);
  const [greeting,setGreeting]=useState<Instrument|null>(null);
  useEffect(()=>{
    const container = stage.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>(".satellite-button"));
    const earth = container.querySelector<HTMLElement>(".instrument-earth");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Separate upper and lower paths keep both instrument buttons visible.
    // Their vertical ranges never overlap, including their labels.
    let frame = 0, last = 0, elapsed = 0;
    let geometry = {width:0,height:0,itemWidth:0,itemHeight:0};
    const measure = () => {
      geometry = {width:container.clientWidth,height:container.clientHeight,
        itemWidth:Math.max(...items.map(item=>item.offsetWidth)),
        itemHeight:Math.max(...items.map(item=>item.offsetHeight))};
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    items.forEach(item=>observer.observe(item));
    measure();
    const step = (time:number) => {
      const dt = last ? Math.min((time-last)/1000,.05) : 0;
      last = time;
      const paused = active || container.closest("[hidden]") ||
        items.some(item=>item.matches(":hover, :focus-visible"));
      if (!reduced.matches && !paused) elapsed += dt;
      const theta = -Math.PI/4 + elapsed * Math.PI*2/100;
      const angles = reduced.matches ? [-Math.PI/3,Math.PI/3] :
        [theta,theta+Math.PI+.18*Math.sin(2*theta)];
      const {width,height,itemWidth,itemHeight} = geometry;
      const rx = Math.max(0,(width-itemWidth-24)/2);
      const laneTravel = Math.max(0,(height-2*itemHeight-24)/2);
      items.forEach((item,i)=>{
        const angle = angles[i];
        const x = (width-itemWidth)/2 + rx*Math.cos(angle);
        const y = i === 0 ? 8 + laneTravel*(1+Math.sin(angle))/2 :
          height-itemHeight-8-laneTravel*(1+Math.sin(angle))/2;
        item.style.transform = `translate(${x}px, ${y}px)`;
        item.style.zIndex = "4";
        item.style.opacity = "1";
      });
      // Keep the globe rotating while pointer or keyboard focus pauses targets.
      if(earth) earth.style.setProperty("--earth-orbit-period","100s");
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();};
  },[active]);
  return <div ref={stage} className={`instrument-stage${active?" is-paused":""}`} role="group" aria-label="Conceptual Earth and satellite illustration. Dark-mode city lights are a NASA 2016 composite; fire markers are decorative.">
    <div className="instrument-earth" aria-hidden="true" />
    {greeting && <div className="satellite-message" role="status">{greeting === "modis" ? "Hi there! I’m MODIS." : "Hello, Earth! I’m VIIRS."}</div>}
    {onExpand&&<button ref={expandRef} className="earth-card-open" onClick={onExpand} aria-label="Expand Earth overview" title="Expand Earth overview"/>}
    {(["modis","viirs"] as const).map(kind=><button type="button" key={kind} className={`satellite-button floating-satellite upright-${kind}`} aria-label={`Learn about ${kind.toUpperCase()}`} aria-pressed={active===kind} onPointerEnter={event=>{if(event.pointerType==="mouse")setGreeting(kind);}} onPointerLeave={event=>{if(event.currentTarget!==document.activeElement)setGreeting(null);}} onFocus={()=>setGreeting(kind)} onBlur={()=>setGreeting(null)} onClick={()=>onSelect(kind)}><span className="satellite-greeting" aria-hidden="true">{kind==="modis"?"Hi there!":"Hello, Earth!"}</span><SatelliteIcon kind={kind}/><span>{kind.toUpperCase()}</span><small>Explore instrument</small></button>)}

  </div>;
}
