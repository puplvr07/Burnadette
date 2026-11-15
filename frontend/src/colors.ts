// Sequential activity palette: higher values become brighter, not hotter in temperature.
const RAMP = ["#302b29", "#523326", "#754125", "#9d4e22", "#c86020", "#e67b20", "#f5a62a", "#f9cd64", "#ffe6aa"];
export const rampColors = RAMP;
export function colorFor(t: number): string {
  const x=Math.min(1,Math.max(0,t))*(RAMP.length-1);
  return RAMP[Math.round(x)];
}
