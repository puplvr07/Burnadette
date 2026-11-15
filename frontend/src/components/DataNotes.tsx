import type { CalendarResponse, Region, Source } from "../types";

const SMALL_AREA = 10; // squares; a guess from the integration guide, tune as needed
interface Props { data: CalendarResponse; source: Source; region?: Region }

// Warnings from the integration guide, section 5.2.
export default function DataNotes({ data, source, region }: Props) {
  const notes: { key: string; strong: string; text: string }[] = [];
  const area = `${data.cells_in_area} square${data.cells_in_area === 1 ? "" : "s"}`;
  if (data.cells_in_area === 0) notes.push({ key: "empty", strong: "No squares in this area.", text: "The selection holds no data squares. Draw it over a region with data, or choose a pilot region." });
  if (source !== "harmonized") notes.push({ key: "raw", strong: "Not comparable across 2012.", text: "MODIS and VIIRS counts come from different instruments. Use Harmonized to compare years before and after January 2012." });
  if (source === "harmonized" && data.weeks.some((w) => (w.low_sensitivity_share ?? 0) > 0)) {
    notes.push({ key: "low", strong: "Low confidence.", text: "In this area the older instrument sees few of the fires the newer one sees, so values in the flagged weeks are rough estimates." });
  }
  if (data.cells_in_area > 0 && data.cells_in_area < SMALL_AREA) notes.push({ key: "small", strong: "Small area.", text: `Only ${area} selected. Estimates are most reliable for whole regions.` });
  if (region?.id === "belgium") notes.push({ key: "be", strong: "Belgium is an example of the method's limits.", text: "Belgium has small fires that the older instrument barely sees." });
  if (region && (!region.calibration || region.calibration.validated === false)) notes.push({ key: "val", strong: "Not validated.", text: "This region's estimates have not been checked against VIIRS." });
  if (data.cells_in_area > 0) notes.push({ key: "border", strong: "Regions follow national borders.", text: "Fires in neighbouring countries are not included, so squares along a border can look quieter than they are. Squares outside the country, or at sea, count as \"no fire\"." });
  if (!notes.length) return null;
  return (
    <details className="data-notes panel">
      <summary>Data notes: {notes.map((n) => n.strong.replace(/\.$/, "")).join(" · ")}</summary>
      <ul>{notes.map((n) => <li key={n.key}><strong>{n.strong}</strong> {n.text}</li>)}</ul>
    </details>
  );
}
