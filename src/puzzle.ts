// The shunting puzzle (the "Inglenook sidings"): three dead-end sidings fanning out from one set of points, and a
// short headshunt where the loco stands. Wagons can only be moved by the loco, and the headshunt only has room for
// a few of them at a time — that's the whole puzzle. The goal: make up the target train, in order, on siding A.
//
// One move = one trip: the loco takes the wagons it's coupled to into a siding, couples to whatever is there, and
// pulls back out with however many wagons it chooses (counting from the points end), leaving the rest behind.

export interface Yard { caps: [number, number, number]; lead: number }   // siding capacities (A, B, C) and the headshunt's
export interface State { s: [number[], number[], number[]]; t: number[] }
// s[i]: the wagons on siding i, from the buffer end (index 0) out to the points end (last)
// t:    the wagons coupled to the loco, from the loco outwards (last = nearest the points)
export interface Move { siding: 0 | 1 | 2; take: number }
export interface Puzzle { yard: Yard; start: State; target: number[]; par: number; wagons: number }

export const clone = (st: State): State => ({ s: [st.s[0].slice(), st.s[1].slice(), st.s[2].slice()], t: st.t.slice() });

// what a siding looks like with the loco's train pushed into it (before it pulls anything back out)
export function pushed(st: State, siding: number) { return [...st.s[siding], ...st.t.slice().reverse()]; }

// the range of wagons the loco can come back out with from a siding
export function takeRange(st: State, yard: Yard, siding: number): [number, number] {
  const all = pushed(st, siding).length;
  const min = Math.max(0, all - yard.caps[siding]);   // anything that won't fit has to come back out
  const max = Math.min(yard.lead, all);
  return [min, max];
}

export function apply(st: State, m: Move, yard: Yard): State | null {
  const [min, max] = takeRange(st, yard, m.siding);
  if (m.take < min || m.take > max) return null;
  const all = pushed(st, m.siding), n = clone(st);
  n.s[m.siding] = all.slice(0, all.length - m.take);
  n.t = all.slice(all.length - m.take).reverse();
  return n;
}

export const solved = (st: State, target: number[]) => st.s[0].length === target.length && st.s[0].every((w, i) => w === target[i]);

// --- the solver: breadth-first over states, with wagons outside the target treated as identical ---
function keyOf(st: State, code: Map<number, string>) {
  const c = (a: number[]) => a.map(w => code.get(w) ?? 'x').join('');
  return `${c(st.s[0])}|${c(st.s[1])}|${c(st.s[2])}|${c(st.t)}`;
}
function codes(target: number[]) { return new Map(target.map((w, i) => [w, String.fromCharCode(97 + i)])); }

export function legalMoves(st: State, yard: Yard): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < 3; i++) { const [lo, hi] = takeRange(st, yard, i); for (let k = lo; k <= hi; k++) out.push({ siding: i as 0 | 1 | 2, take: k }); }
  return out;
}

// the fewest moves to solve from here (and the moves), or null if it can't be done within `limit` states
export function solve(start: State, target: number[], yard: Yard, limit = 400000): Move[] | null {
  if (solved(start, target)) return [];
  const code = codes(target);
  const seen = new Map<string, { prev: string | null; move: Move | null }>();
  const k0 = keyOf(start, code);
  seen.set(k0, { prev: null, move: null });
  let frontier: State[] = [start];
  while (frontier.length && seen.size < limit) {
    const next: State[] = [];
    for (const st of frontier) {
      const kst = keyOf(st, code);
      for (const m of legalMoves(st, yard)) {
        const n = apply(st, m, yard)!;
        const k = keyOf(n, code);
        if (seen.has(k)) continue;
        seen.set(k, { prev: kst, move: m });
        if (solved(n, target)) {
          const path: Move[] = [];
          for (let cur: string | null = k; cur; ) { const e: { prev: string | null; move: Move | null } = seen.get(cur)!; if (!e.move) break; path.unshift(e.move); cur = e.prev; }
          return path;
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

// --- making puzzles ---
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 1; }
  next() { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s / 4294967296; }
  int(a: number, b: number) { return a + Math.floor(this.next() * (b - a + 1)); }
  shuffle<T>(a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
}

// a random starting yard and target; the par is the solver's answer
export function makePuzzle(yard: Yard, wagons: number, targetLen: number, rng: Rng): Puzzle | null {
  const ids = rng.shuffle([...Array(wagons).keys()]);
  const s: [number[], number[], number[]] = [[], [], []];
  // deal the wagons into the sidings, leaving room to work
  const room = yard.caps.map(c => c) as number[];
  for (const w of ids) {
    const options = [0, 1, 2].filter(i => s[i].length < room[i]);
    if (!options.length) return null;
    s[options[rng.int(0, options.length - 1)]].push(w);
  }
  const target = rng.shuffle(ids.slice()).slice(0, targetLen);
  const start: State = { s, t: [] };
  if (solved(start, target)) return null;
  const sol = solve(start, target, yard);
  if (!sol) return null;
  return { yard, start, target, par: sol.length, wagons };
}
