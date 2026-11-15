import { useEffect, useState } from "react";
import { loadSamplePreview } from "../samplePreview";
import type { WeekRow } from "../types";
import { colorFor } from "../colors";
import { addCalendarDays, formatCalendarDate, formatCalendarValue } from "../calendarModel";
export default function HomeCalendarPreview() {
  const [weeks,setWeeks]=useState<WeekRow[]>([]), [picked,setPicked]=useState("");
  const [error,setError]=useState(""), [attempt,setAttempt]=useState(0);
  useEffect(()=>{let stale=false;setError("");loadSamplePreview().then(rows=>{if(!stale)setWeeks(rows);}).catch(()=>{if(!stale)setError("The local sample is unavailable. You can still choose an area on Map.");});return()=>{stale=true;};},[attempt]);
  const selected=weeks.find(w=>w.week_start===picked)??weeks[weeks.length-1];
  const lastYear=weeks.length?+weeks[weeks.length-1].week_start.slice(0,4):0;
  const years=Array.from({length:Math.min(8,new Set(weeks.map(w=>w.week_start.slice(0,4))).size)},(_,i)=>lastYear-7+i).filter(y=>weeks.some(w=>w.week_start.startsWith(String(y))));
  const max=Math.max(...weeks.map(w=>w.value??0),0);
  const month=selected?.week_start.slice(0,7);
  const monthWeeks=weeks.filter(w=>w.week_start.slice(0,7)===month);
  return <section className="sample-calendar" aria-label="Local sample calendar demonstration">
    <div className="sample-calendar-heading"><div><p className="eyebrow">READ THE PATTERN</p><h2>A calendar, not a wall of detections.</h2></div><span className="sample-tag">LOCAL SAMPLE · NOT SATELLITE FINDINGS</span></div>
    <p className="sample-intro">One row per year. One cell per week. Select a week to inspect its month. This demonstration averages the existing random fixture; it does not select an analysis region.</p>
    {error?<p role="status">{error} <button type="button" onClick={()=>setAttempt(n=>n+1)}>Retry sample</button></p>:!weeks.length?<p role="status">Loading local sample…</p>:<>
      <div className="sample-matrix-scroll"><div className="sample-matrix"><div className="sample-months"><span>Year</span><span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span><span>Dec</span></div>{years.map(year=><div className="sample-year" key={year}><span>{year}</span><div>{weeks.filter(w=>w.week_start.startsWith(String(year))).map(week=><button type="button" key={week.week_start} data-week={week.week_start} tabIndex={selected?.week_start===week.week_start?0:-1} title={`${formatCalendarDate(week.week_start)} · ${formatCalendarValue(week.value)}`} aria-label={`Sample week ${formatCalendarDate(week.week_start)}, activity ${formatCalendarValue(week.value)}`} aria-pressed={selected?.week_start===week.week_start} style={{background:colorFor((week.value??0)/(max||1))}} onClick={()=>setPicked(week.week_start)} onKeyDown={event=>{
        const offset=event.key==="ArrowRight"?1:event.key==="ArrowLeft"?-1:event.key==="ArrowDown"?52:event.key==="ArrowUp"?-52:0;
        if(!offset)return;
        event.preventDefault();const index=weeks.indexOf(week),next=weeks[Math.max(0,Math.min(weeks.length-1,index+offset))];
        if(next&&years.includes(+next.week_start.slice(0,4))){setPicked(next.week_start);event.currentTarget.closest('.sample-matrix')?.querySelector<HTMLButtonElement>(`button[data-week="${next.week_start}"]`)?.focus();}
      }} />)}</div></div>)}</div></div>
      <div className="sample-month-detail"><div><p className="eyebrow">WEEKLY MONTH DETAIL</p><h3>{new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined,{month:"long",year:"numeric",timeZone:"UTC"})}</h3><p>Brighter cells indicate higher sample activity. Units are not defined by the data contract.</p></div><div className="sample-week-list">{monthWeeks.map(week=><button type="button" key={week.week_start} aria-pressed={selected?.week_start===week.week_start} onClick={()=>setPicked(week.week_start)}><span>{formatCalendarDate(week.week_start)} – {formatCalendarDate(addCalendarDays(week.week_start,6))}</span><strong>{formatCalendarValue(week.value)}</strong></button>)}</div></div>
    </>}
  </section>;
}
