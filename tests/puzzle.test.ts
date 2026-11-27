import { describe, expect, it } from 'vitest';
import { apply, legalMoves, makePuzzle, pushed, Rng, solve, solved, takeRange, type State, type Yard } from '../src/puzzle';
import { CHAPTERS, LEVELS_PER_CHAPTER, starsFor } from '../src/chapters';
import LEVELS from '../src/levels.json';

const yard: Yard = { caps: [5, 3, 3], lead: 3 };

describe('moves', () => {
  it('pushing a train into a siding puts it at the points end, and pulling takes from there', () => {
    const st: State = { s: [[1, 2], [3], []], t: [4, 5] };   // 4 is next to the loco, 5 is at the front
    expect(pushed(st, 0)).toEqual([1, 2, 5, 4]);
    const n = apply(st, { siding: 0, take: 3 }, yard)!;
    expect(n.s[0]).toEqual([1]);
    expect(n.t).toEqual([4, 5, 2]);                           // nearest the loco first
    // dropping the whole train
    expect(apply(st, { siding: 2, take: 0 }, yard)!.s[2]).toEqual([5, 4]);
  });
  it('respects the headshunt and the siding lengths', () => {
    const st: State = { s: [[1, 2, 3, 4], [5, 6, 7], []], t: [8] };
    expect(takeRange(st, yard, 1)).toEqual([1, 3]);           // B is full: whatever goes in, one has to come out
    expect(apply(st, { siding: 1, take: 0 }, yard)).toBeNull();
    expect(apply(st, { siding: 0, take: 4 }, yard)).toBeNull(); // the headshunt takes three
    expect(legalMoves(st, yard).every(m => apply(st, m, yard))).toBe(true);
  });
});

describe('solver', () => {
  it('finds the shortest solution, and the moves really solve it', () => {
    const p = makePuzzle({ caps: [4, 3, 2], lead: 2 }, 5, 4, new Rng(3))!;
    const sol = solve(p.start, p.target, p.yard)!;
    expect(sol.length).toBe(p.par);
    let st = p.start; for (const m of sol) st = apply(st, m, p.yard)!;
    expect(solved(st, p.target)).toBe(true);
  });
  it('stars: three at par, fewer when over', () => {
    expect(starsFor(8, 8)).toBe(3); expect(starsFor(10, 8)).toBe(2); expect(starsFor(20, 8)).toBe(1);
  });
});

describe('levels', () => {
  const levels = LEVELS as unknown as Record<string, { start: State; target: number[]; par: number; yard: Yard }[]>;
  it('every chapter has its levels, and pars climb', () => {
    for (const c of CHAPTERS) {
      const l = levels[c.id]; expect(l.length).toBe(LEVELS_PER_CHAPTER);
      expect(l[l.length - 1].par).toBeGreaterThanOrEqual(l[0].par);
    }
  });
  it('the small yards solve in exactly par moves', () => {
    for (const id of ['c1', 'c2']) for (const p of levels[id]) expect(solve(p.start, p.target, p.yard)!.length).toBe(p.par);
  });
});
