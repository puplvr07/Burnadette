import { useRef, useState } from "react";
import { usingFakeData } from "../api";

const VIEWS = [["map", "Map"], ["heatmap", "Heatmap"], ["calendar", "Calendar"]] as const;
export default function ExploreDock({page}:{page:string}) {
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const closing=useRef(false);
  return <div className={`explore-dock${open?" is-open":""}`}
    onPointerEnter={event=>{if(event.pointerType==="mouse")setOpen(true);}}
    onPointerLeave={event=>{if(event.pointerType==="mouse"&&!event.currentTarget.contains(document.activeElement))setOpen(false);}}
    onFocusCapture={event=>{if(!closing.current&&event.target.matches(":focus-visible"))setOpen(true);}}
    onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}}
    onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();closing.current=true;setOpen(false);trigger.current?.focus();queueMicrotask(()=>{closing.current=false;});}}}>
    <div className="explore-dock-bottom"><button ref={trigger} type="button" className="explore-dock-trigger" aria-expanded={open} aria-controls="explore-dock-links"
      onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(event.key==="ArrowUp"){event.preventDefault();setOpen(true);}}}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
      <span>Views <span aria-hidden="true">·</span> {VIEWS.find(([route])=>route===page)?.[1]}</span><span aria-hidden="true">{open?"⌄":"⌃"}</span>
    </button>{page === "map" && usingFakeData && <span className="map-sample-badge">SAMPLE DATA · Random values</span>}</div>
    <nav id="explore-dock-links" className="explore-dock-links" aria-label="Explore views" {...(!open?{inert:""}:{})}>
      {VIEWS.map(([route,label])=><a key={route} href={`#${route}`} aria-current={page===route?"page":undefined}>{label}</a>)}
    </nav>
  </div>;
}
