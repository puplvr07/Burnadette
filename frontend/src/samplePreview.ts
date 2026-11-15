import type { WeekRow } from "./types";
let pending: Promise<WeekRow[]> | undefined;
// Local fixture only: this demonstration never calls /calendar or selects a region.
export function loadSamplePreview(): Promise<WeekRow[]> {
  return pending ??= fetch(`${import.meta.env.BASE_URL}sample-preview.json`).then(async response => {
    if (!response.ok) throw new Error("Local sample fixture unavailable.");
    const rows: { week_start: string; value: number }[] = await response.json();
    if (!Array.isArray(rows) || !rows.length || rows.some(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.week_start) || !Number.isFinite(row.value))) throw new Error("Local sample has no valid weekly observations.");
    return rows.map(({week_start,value})=>({week_start,value,anomaly:null,active_cells:0,uncertainty_low:null,uncertainty_high:null,low_sensitivity_share:0,flags:[]}));
  }).catch(error=>{pending=undefined;throw error;});
}
