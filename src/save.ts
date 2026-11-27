// Your progress, kept on the device.
export interface Profile {
  coins: number;
  stars: Record<string, number>;      // best stars per level ("c1-3")
  best: Record<string, number>;       // fewest moves per level
  chests: string[];                   // chapters whose completion chest you've opened
  owned: string[];                    // liveries and themes you own
  loco: string; theme: string;
  daily: { last: string; streak: number; best: number; done: Record<string, number> };
  rushBest: number;
  sound: boolean;
  tut: number;                        // how far through the first-puzzle tips you are
  solved: number; perfect: number;
}
const KEY = 'yardmaster.v1';
const fresh = (): Profile => ({ coins: 60, stars: {}, best: {}, chests: [], owned: ['works', 'meadow'], loco: 'works', theme: 'meadow',
  daily: { last: '', streak: 0, best: 0, done: {} }, rushBest: 0, sound: true, tut: 0, solved: 0, perfect: 0 });

export const profile: Profile = (() => {
  try { const d = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return d ? { ...fresh(), ...d, daily: { ...fresh().daily, ...(d.daily ?? {}) } } : fresh(); } catch { return fresh(); }
})();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* storage unavailable */ } }
export const totalStars = () => Object.values(profile.stars).reduce((a, b) => a + b, 0);
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return today(d); };
