// Shapes follow the API spec in the team guide (section 6). Keep in sync with the API.
export type Bbox = [number, number, number, number]; // minLon, minLat, maxLon, maxLat
export type Source = "harmonized" | "modis" | "viirs";
export type Metric = "activity" | "anomaly";
export interface Calibration {
  validated?: boolean;
  low_sensitivity_months?: string[]; // "Jan".."Dec"
  validation?: { bias_pct_calibrated?: number; bias_pct_raw_modis?: number; r_calibrated?: number };
}
export interface Region { id: string; name: string; bbox: Bbox; n_cells?: number; calibration?: Calibration }
export interface GapPeriod { label: string; start: string; end: string }
export interface Meta {
  date_start: string;
  date_end: string;
  viirs_start: string; // before this date there is no VIIRS measurement
  gaps: GapPeriod[];
  notes: string[];
  is_fake?: boolean;
}
export interface WeekRow {
  week_start: string;
  value: number | null; // null = no data for this source/week
  active_cells: number | null; // fractional for estimated harmonized weeks
  valid_cells?: number;
  anomaly: number | null;
  uncertainty_low: number | null;
  uncertainty_high: number | null;
  low_sensitivity_share: number | null; // null = not applicable (MODIS / VIIRS views)
  flags: string[];
  harmonized_source?: string | null; // viirs | modis_scaled | modis_fill
}
export interface CalendarResponse {
  bbox: Bbox;
  source: Source;
  cells_in_area: number;
  weeks: WeekRow[];
  region?: string; // id of the region the numbers came from
}
