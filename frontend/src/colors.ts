// Light = quiet, dark = intense, so empty weeks read as pale.
const RAMP = ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#b30000", "#7f0000"];
export const rampColors = RAMP;

export function colorFor(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  return RAMP[Math.round(x)];
}
