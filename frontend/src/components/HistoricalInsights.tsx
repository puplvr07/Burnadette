import { useMemo } from 'react';
import type { Meta, Source, WeekRow } from '../types';
import { completeYears } from '../historicalModel';

type Props={weeks:WeekRow[];start:string;end:string;source:Source;region:string;meta:Meta;sample:boolean;loading:boolean;error:string};
const value=(n:number)=>new Intl.NumberFormat(undefined,{maximumFractionDigits:3}).format(n);
export default function HistoricalInsights({weeks,start,end,source,region,meta,sample,loading,error}:Props){
 const stats=useMemo(()=>completeYears(weeks,start,end,meta.gaps),[weeks,start,end,meta.gaps]);
 const comparable=stats.length>=3, latest=stats[stats.length-1], baseline=comparable?stats.slice(0,-1).reduce((sum,row)=>sum+row.mean,0)/(stats.length-1):null;
 const max=Math.max(0,...stats.map(row=>row.mean));
 return <section className="historical-insights" aria-labelledby="insight-heading">
  <div><p className="eyebrow">HISTORICAL COMPARISON</p><h2 id="insight-heading">Activity across complete years</h2><p>{region} · {start} to {end} · {source.toUpperCase()} {sample?'· SAMPLE DATA (random values)':''}</p></div>
  {loading?<p role="status">Loading observations…</p>:error?<p role="alert">Historical comparison is unavailable because the request failed.</p>:!weeks.length?<p>No weekly records were returned. This is not zero activity.</p>:<>
   <p>Reported active cells in the latest returned week: {[...weeks].sort((a,b)=>b.week_start.localeCompare(a.week_start))[0]?.active_cells ?? 'Not supplied'}. This is not a count of fires or detections.</p>
   {comparable&&latest&&baseline!==null?<>
    <p><strong>{latest.year}: {value(latest.mean)}</strong> · Baseline: {value(baseline)} · Difference: {value(latest.mean-baseline)}. Activity units are not specified by the API.</p>
    <p>Each yearly mean averages all 52 or 53 weekly activity values. The baseline is the equal-weight mean of {stats.slice(0,-1).map(row=>row.year).join(', ')}. Only complete years with a numeric record for every weekly start are included; years overlapping known instrument gaps are excluded. This is a frontend calculation, not the supplied anomaly field.</p>
    <div className="insight-bars" role="list" aria-label="Mean activity for complete years">{stats.map(row=><div role="listitem" className="insight-row" key={row.year}><span>{row.year}</span><span className="insight-track" aria-hidden="true"><span style={{width:`${max>0?Math.max(0,row.mean/max*100):0}%`}}/></span><strong>{value(row.mean)}</strong></div>)}</div>
   </>:<p>A comparison requires at least three complete years of numeric weekly values without known instrument-gap warnings. Select a longer date range if available; missing records are not treated as zero.</p>}
   <p>Source and coverage can affect comparisons. Uncertainty and flags for individual weeks remain available in the Heatmap and Calendar. A quiet or missing week does not prove no fire occurred.</p>
  </>}
 </section>;
}
