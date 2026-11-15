import type { WeekRow } from "./types";
let pending: Promise<WeekRow[]> | undefined;
// Local fixture only: this demonstration never calls /calendar or selects a region.
export function loadSamplePreview(): Promise<WeekRow[]> {
  return pending ??= fetch(`${import.meta.env.BASE_URL}fake_cell_week.csv`).then(async response => {
    if (!response.ok) throw new Error("Local sample fixture unavailable.");
    const groups = new Map<string, number[]>();
    for (const line of (await response.text()).trim().split("\n").slice(1)) {
      const columns=line.split(","), date=columns[3], value=Number(columns[12]);
      if (date && Number.isFinite(value)) (groups.get(date) ?? groups.set(date,[]).get(date)!).push(value);
    }
    if (!groups.size) throw new Error("Local sample fixture has no weekly observations.");
    return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([week_start, values])=>({week_start,value:values.reduce((a,b)=>a+b,0)/values.length,anomaly:null,active_cells:0,uncertainty_low:null,uncertainty_high:null,low_sensitivity_share:0,flags:[]}));
  }).catch(error=>{pending=undefined;throw error;});
}
