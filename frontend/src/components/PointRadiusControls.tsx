import { useEffect, useState } from "react";
import { MAX_RADIUS_KM, MIN_RADIUS_KM, radiusBounds } from "../pointRadius";
import type { RadiusSelection } from "../pointRadius";

interface Props { value: RadiusSelection; onChange: (value: RadiusSelection) => void; onValidationChange: (error: string) => void }

export default function PointRadiusControls({ value, onChange, onValidationChange }: Props) {
  const [fields, setFields] = useState({ lat: String(value.lat), lon: String(value.lon), radiusKm: String(value.radiusKm) });
  const [error, setError] = useState("");
  useEffect(() => {
    setFields({ lat: String(value.lat), lon: String(value.lon), radiusKm: String(value.radiusKm) });
    setError(""); onValidationChange("");
  }, [value.lat, value.lon, value.radiusKm, onValidationChange]);

  const edit = (field: keyof RadiusSelection, text: string) => {
    const next = { ...fields, [field]: text };
    setFields(next);
    const candidate = { lat: Number(next.lat), lon: Number(next.lon), radiusKm: Number(next.radiusKm) };
    const validation = Object.values(next).some((v) => !v.trim()) ? "Complete the center coordinates and radius." : radiusBounds(candidate).error ?? "";
    setError(validation); onValidationChange(validation);
    if (!validation) onChange(candidate);
  };

  return (
    <fieldset className="point-radius-controls">
      <legend>Point & Radius</legend>
      <p className="small">Drag the center marker, or edit the coordinates below. Radius is the distance from the center to the edge, not the diameter.</p>
      <div className="point-coordinate-fields">
        <label>Latitude<input type="number" step="any" min={-85.0511} max={85.0511} value={fields.lat} onChange={(e) => edit("lat", e.target.value)} aria-describedby="point-radius-error" /></label>
        <label>Longitude<input type="number" step="any" min={-180} max={180} value={fields.lon} onChange={(e) => edit("lon", e.target.value)} aria-describedby="point-radius-error" /></label>
      </div>
      <label>Radius (km)<input type="number" min={MIN_RADIUS_KM} max={MAX_RADIUS_KM} step="any" value={fields.radiusKm} onChange={(e) => edit("radiusKm", e.target.value)} aria-invalid={!!error} aria-describedby="point-radius-help point-radius-error" /></label>
      <input type="range" aria-label="Radius in kilometers" aria-valuetext={`${value.radiusKm} kilometers radius`} min={MIN_RADIUS_KM} max={MAX_RADIUS_KM} step={0.1} value={value.radiusKm} onChange={(e) => edit("radiusKm", e.target.value)} />
      <p className="small" id="point-radius-help">UI range: {MIN_RADIUS_KM}–{MAX_RADIUS_KM} km. Diameter: {(value.radiusKm * 2).toFixed(2)} km. This does not increase data resolution; a small selection may contain no data cells.</p>
      <p className="point-radius-error" id="point-radius-error" role="status">{error}</p>
      <p className="point-radius-note">Results cover the circle's bounding box, including the corners outside the circle. Exact circular filtering is not supported by the current API.</p>
    </fieldset>
  );
}
