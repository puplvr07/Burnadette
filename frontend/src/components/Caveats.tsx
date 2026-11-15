import { CAVEATS } from "../caveats";

export default function Caveats({ children }: { children?: import("react").ReactNode }) {
  return (
    <details className="caveats">
      <summary>How to read & data limits</summary>
      <p>Activity: fraction of selected 0.5° (~55 km) grid cells with fire activity. Weeks start Monday; each observation covers seven days. Weeks spanning months appear in both; faded dates are outside the month or coverage. Harmonized values may be estimated.</p>
      <p>Use arrow keys to explore the Heatmap and Home/End to move within a year. Month labels are approximate. Bar heights use the displayed month’s maximum; colors use the overview scale.</p>
      {children}
      <ul>{CAVEATS.map((c) => <li key={c}>{c}</li>)}</ul>
    </details>
  );
}
