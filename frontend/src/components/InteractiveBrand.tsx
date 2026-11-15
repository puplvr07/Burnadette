import { useEffect, useRef, useState } from 'react';
export default function InteractiveBrand(){
 const [fire,setFire]=useState(false), timer=useRef<ReturnType<typeof setTimeout>>();
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const ignite=()=>{clearTimeout(timer.current);setFire(false);requestAnimationFrame(()=>{setFire(true);timer.current=setTimeout(()=>setFire(false),1300);});};
 return <div className={`interactive-brand${fire?' is-burning':''}`}>
  <span className="brand-flames" aria-hidden="true"><svg viewBox="0 0 180 60" preserveAspectRatio="none"><path d="M2 58C10 40 14 43 17 31c7 7 8 11 9 15 4-18 15-18 17-37 13 12 10 22 13 26 9-12 14-13 17-26 11 8 13 19 12 30 7-8 11-9 14-22 13 9 11 21 15 26 5-8 11-8 13-22 10 11 9 21 10 26 8-10 14-5 16-19 9 10 11 21 9 30Z" fill="#ff9e31"/><path d="M10 58c9-12 13-9 17-20 8 8 6 13 9 15 8-10 15-9 16-20 11 8 11 19 14 22 8-7 13-7 15-18 10 6 11 14 12 18 5-8 13-7 17-18 10 8 10 17 12 19 7-8 17-6 21-15 8 6 8 12 8 17Z" fill="#ffe0a0"/></svg></span>
  <a className="site-title home-brand" href="#home" onDoubleClick={event=>{event.preventDefault();ignite();}}>Burnadette</a>
  <button className="brand-spark" type="button" aria-label="Play decorative fire animation" title="Play decorative fire animation" onClick={ignite}><span aria-hidden="true">✦</span></button>
 </div>;
}
