// Runs the solver off the main thread: hints (the best next move from where you are) and making the daily puzzle.
import { Rng, makePuzzle, solve, type Puzzle, type State, type Yard } from './puzzle';

self.onmessage = (e: MessageEvent) => {
  const m = e.data as { id: number; kind: 'hint'; state: State; target: number[]; yard: Yard } | { id: number; kind: 'make'; yard: Yard; wagons: number; target: number; seed: number; par: [number, number] };
  if (m.kind === 'hint') {
    const sol = solve(m.state, m.target, m.yard);
    (self as any).postMessage({ id: m.id, moves: sol });
  } else {
    const rng = new Rng(m.seed);
    let best: Puzzle | null = null;
    for (let i = 0; i < 12; i++) {
      const p = makePuzzle(m.yard, m.wagons, m.target, rng); if (!p) continue;
      if (!best || (p.par >= m.par[0] && p.par <= m.par[1])) best = p;
      if (p.par >= m.par[0] && p.par <= m.par[1]) break;
    }
    (self as any).postMessage({ id: m.id, puzzle: best });
  }
};
