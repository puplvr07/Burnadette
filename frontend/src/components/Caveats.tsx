import { CAVEATS } from "../caveats";

export default function Caveats() {
  return (
    <details className="caveats" open>
      <summary>How far to trust this (caveats)</summary>
      <ul>{CAVEATS.map((c) => <li key={c}>{c}</li>)}</ul>
    </details>
  );
}
