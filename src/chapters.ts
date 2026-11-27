// The campaign: five chapters, each a different yard, twelve puzzles each, getting harder as you go.
import type { Yard } from './puzzle';

export interface Chapter {
  id: string; name: string; blurb: string; theme: string;
  yard: Yard; wagons: number; target: number;
  par: [number, number];      // the par of the first and last puzzle (the ones between ramp up)
  intro?: { levels: number; wagons: number; target: number; par: [number, number] };   // a gentler start
  unlock: number;             // stars needed to open it
}

export const CHAPTERS: Chapter[] = [
  { id: 'c1', name: 'First Steps', blurb: 'A little yard to learn the ropes.', theme: 'meadow',
    yard: { caps: [3, 2, 2], lead: 2 }, wagons: 4, target: 3, par: [3, 7], intro: { levels: 4, wagons: 3, target: 2, par: [1, 3] }, unlock: 0 },
  { id: 'c2', name: 'Branch Line', blurb: 'More wagons, longer sidings.', theme: 'meadow',
    yard: { caps: [4, 3, 2], lead: 2 }, wagons: 5, target: 4, par: [5, 11], unlock: 18 },
  { id: 'c3', name: 'The Inglenook', blurb: 'The classic: eight wagons, five to make up.', theme: 'autumn',
    yard: { caps: [5, 3, 3], lead: 3 }, wagons: 8, target: 5, par: [8, 14], unlock: 45 },
  { id: 'c4', name: 'Tight Squeeze', blurb: 'The headshunt only takes two.', theme: 'snow',
    yard: { caps: [5, 3, 3], lead: 2 }, wagons: 7, target: 5, par: [10, 18], unlock: 75 },
  { id: 'c5', name: 'Yardmaster', blurb: 'The hardest the classic yard can get.', theme: 'night',
    yard: { caps: [5, 3, 3], lead: 3 }, wagons: 8, target: 5, par: [12, 16], unlock: 105 },
];
export const LEVELS_PER_CHAPTER = 12;

// stars for a finished puzzle: three for par or better
export const starsFor = (moves: number, par: number) => (moves <= par ? 3 : moves <= par + Math.max(2, Math.round(par * 0.35)) ? 2 : 1);
