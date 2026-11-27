// Pre-generates the campaign puzzles (run with `npm run levels`): for each level, searches random yards until the
// solver's par matches the level's place on its chapter's difficulty ramp. Writes src/levels.json.
import { writeFileSync } from 'node:fs';
import { CHAPTERS, LEVELS_PER_CHAPTER } from '../src/chapters';
import { Rng, makePuzzle, Puzzle } from '../src/puzzle';

const out: Record<string, Puzzle[]> = {};
for (const [ci, ch] of CHAPTERS.entries()) {
  const list: Puzzle[] = [], seen = new Set<string>();
  for (let li = 0; li < LEVELS_PER_CHAPTER; li++) {
    const intro = ch.intro && li < ch.intro.levels ? ch.intro : null;
    const span = intro ? intro.par : ch.par, n = intro ? intro.levels : LEVELS_PER_CHAPTER - (ch.intro?.levels ?? 0), k = intro ? li : li - (ch.intro?.levels ?? 0);
    const want = Math.round(span[0] + (span[1] - span[0]) * (n > 1 ? k / (n - 1) : 0));
    const rng = new Rng(1000 * (ci + 1) + li * 97 + 13);
    let best: Puzzle | null = null;
    for (let tries = 0; tries < 400; tries++) {
      const p = makePuzzle(ch.yard, intro ? intro.wagons : ch.wagons, intro ? intro.target : ch.target, rng);
      if (!p) continue;
      const key = JSON.stringify([p.start, p.target]); if (seen.has(key)) continue;
      if (!best || Math.abs(p.par - want) < Math.abs(best.par - want)) best = p;
      if (p.par === want) break;
    }
    seen.add(JSON.stringify([best!.start, best!.target]));
    list.push(best!);
    console.log(`${ch.name} ${li + 1}: par ${best!.par} (wanted ${want})`);
  }
  out[ch.id] = list;
}
writeFileSync(new URL('../src/levels.json', import.meta.url), JSON.stringify(out));
