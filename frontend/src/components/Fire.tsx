// Page-wide decorative backdrop: a faint warm glow and rising embers.
// Fixed behind all content and hidden from screen readers.

// [left %, delay s, duration s, sway px]. Negative delays start each ember
// partway up the screen, so they are spread out from the first frame.
const EMBERS: [number, number, number, number][] = [
  [3, -2, 14, 18], [8, -9, 18, -14], [13, -5, 16, 22], [18, -13, 20, -10], [23, -1, 15, 16], [28, -7, 19, -20],
  [33, -11, 17, 12], [38, -3, 21, -16], [43, -15, 18, 20], [48, -6, 14, -12], [53, -10, 20, 14], [58, -2, 16, -18],
  [63, -14, 19, 10], [68, -4, 15, -22], [73, -8, 21, 16], [78, -12, 17, -10], [83, -1, 18, 20], [88, -16, 20, -14],
  [93, -6, 16, 12], [97, -10, 19, -16], [11, -17, 22, 10], [46, -19, 22, -12], [71, -18, 23, 14], [91, -20, 22, -8],
];

export function FireBackdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="embers">
        {EMBERS.map(([left, delay, dur, sway], i) => (
          <i key={i} style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${dur}s`, ["--sway" as string]: `${sway}px` }} />
        ))}
      </div>
    </div>
  );
}