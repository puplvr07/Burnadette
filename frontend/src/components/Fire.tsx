// Decorative rising embers, hidden from screen readers.

// Fixed positions so embers do not jump around between renders.
const EMBERS = [
  [6, 0, 7], [14, 2.5, 9], [23, 1, 8], [31, 4, 10], [40, 0.5, 7.5], [48, 3, 9.5],
  [57, 1.5, 8], [65, 5, 11], [73, 2, 8.5], [81, 0, 9], [89, 3.5, 7], [95, 1, 10],
];

export function Embers() {
  return (
    <div className="embers" aria-hidden="true">
      {EMBERS.map(([left, delay, dur], i) => (
        <i key={i} style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />
      ))}
    </div>
  );
}
