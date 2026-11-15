// Keyboard typing for the month and year pickers. Digits typed within TYPING_WINDOW_MS of each other form one entry.
// Month: "9" or "09" -> September; "1" -> January until a second digit makes it 10, 11 or 12.
// Year: "2017" -> 2017; "17" -> 2017 (a two-digit year means 20xx). "20" and "19" wait for more digits.
export const TYPING_WINDOW_MS = 1000;
export interface TypingState { buffer: string; at: number }
export const emptyTyping: TypingState = { buffer: "", at: 0 };

const next = (state: TypingState, digit: string, now: number, maxLength: number) => {
  const fresh = now - state.at > TYPING_WINDOW_MS || state.buffer.length >= maxLength;
  return { buffer: (fresh ? "" : state.buffer) + digit, at: now };
};

export function typeMonth(state: TypingState, digit: string, now: number): { state: TypingState; month?: number } {
  let s = next(state, digit, now, 2);
  let n = Number(s.buffer);
  if (s.buffer.length === 2 && (n < 1 || n > 12)) { s = { buffer: digit, at: now }; n = Number(digit); } // "13" restarts as "3"
  return { state: s, month: n >= 1 && n <= 12 ? n : undefined };
}

export function typeYear(state: TypingState, digit: string, now: number, minYear: number, maxYear: number): { state: TypingState; year?: number } {
  const s = next(state, digit, now, 4);
  const b = s.buffer, n = Number(b);
  const inRange = (y: number) => y >= minYear && y <= maxYear;
  if (b.length === 4) return { state: s, year: inRange(n) ? n : undefined };
  if (b.length === 2 && b !== "19" && b !== "20" && inRange(2000 + n)) return { state: s, year: 2000 + n };
  return { state: s };
}
