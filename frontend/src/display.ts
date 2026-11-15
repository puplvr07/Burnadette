import type { WeekRow } from "./types";

// Wording from the integration guide, section 5.1.
export const provenanceLabel = (source?: string | null) =>
  source === "viirs" ? "Observed by VIIRS"
  : source === "modis_scaled" ? "Estimated from MODIS"
  : source === "modis_fill" ? "Estimated from MODIS (VIIRS unavailable)"
  : source ?? "Not supplied";

// Whole squares when observed, one decimal when the value is an estimate.
export const activeSquaresText = (w: WeekRow) =>
  w.active_cells == null ? "Not supplied"
  : Number.isInteger(w.active_cells) ? String(w.active_cells)
  : `about ${w.active_cells.toFixed(1)}`;

export const sensitivityText = (share: number | null) =>
  share == null || !Number.isFinite(share) ? "Not supplied" : `${(share * 100).toFixed(1)}%`;
