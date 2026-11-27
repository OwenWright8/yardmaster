import './style.css';
import LEVELS from './levels.json';
import { CHAPTERS, LEVELS_PER_CHAPTER, starsFor } from './chapters';
import { apply, clone, pushed, solve, solved, takeRange, type Move, type Puzzle, type State } from './puzzle';
import { W, drawBackground, drawLoco, drawWagon, layout, leadD, restScene, routeAt, sidingD, wagonPic, WAGONS, type Layout, type Vis } from './render';
import { LIVERIES, THEMES } from './cosmetics';
import { profile, save, today, totalStars, yesterday } from './save';
import { buzz, setMuted, sfx, unlockAudio } from './sound';

const levels = LEVELS as unknown as Record<string, Puzzle[]>;
const $ = <T extends HTMLElement = HTMLElement>(s: string, el: ParentNode = document) => el.querySelector(s) as T;
const app = $('#app');
const coinsHtml = (n: number) => `<span class="coin">🪙</span>${n.toLocaleString('en-US')}`;
const HINT_COST = 25;
setMuted(!profile.sound);
addEventListener('pointerdown', unlockAudio, { capture: true });

// --- the solver, off the main thread ---
const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
let reqId = 0; const pending = new Map<number, (d: any) => void>();
worker.onmessage = e => { pending.get(e.data.id)?.(e.data); pending.delete(e.data.id); };
const ask = <T,>(msg: object) => new Promise<T>(res => { const id = ++reqId; pending.set(id, res); worker.postMessage({ ...msg, id }); });

// ======================= screens =======================
type Screen = 'home' | 'map' | 'play' | 'shop';
let current: Screen = 'home', play: Play | null = null;
function show(s: Screen) {
  current = s; if (s !== 'play') { play?.destroy(); play = null; }
  app.className = `screen-${s}`;
  if (s === 'home') home(); else if (s === 'map') map(); else if (s === 'shop') shop();
}

function topbar(title: string, back: Screen | null) {
  return `<header class="bar">${back ? `<button class="icon" data-go="${back}" aria-label="Back">‹</button>` : '<span></span>'}<h1>${title}</h1><div class="wallet">${coinsHtml(profile.coins)}</div></header>`;
}
app.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
  if (b) { sfx.tap(); show(b.dataset.go as Screen); }
});

function home() {
  const streakAlive = profile.daily.last === today() || profile.daily.last === yesterday();
  const dailyDone = profile.daily.last === today();
  app.innerHTML = `
    <div class="home">
      <div class="wallet top">${coinsHtml(profile.coins)}</div>
      <div class="logo"><canvas class="logo-cv" width="300" height="120"></canvas><h1>Yardmaster</h1><p>The shunting puzzle</p></div>
      <div class="menu">
        <button class="big primary" data-act="play"><b>Play</b><small>${totalStars()} ★ · ${CHAPTERS.filter(c => totalStars() >= c.unlock).length} of ${CHAPTERS.length} yards open</small></button>
        <button class="big" data-act="daily"><b>Daily Puzzle ${dailyDone ? '✓' : ''}</b><small>${streakAlive && profile.daily.streak ? `🔥 ${profile.daily.streak}-day streak` : 'A new puzzle every day'}</small></button>
        <button class="big" data-act="rush"><b>Rush</b><small>3 minutes, as many as you can · best ${profile.rushBest}</small></button>
        <button class="big" data-act="shop"><b>Shop</b><small>Liveries and yards</small></button>
      </div>
      <button class="sound" data-act="sound">${profile.sound ? '🔊' : '🔇'}</button>
    </div>`;
  // a train rolling across the title, on its own little track
  const cv = $<HTMLCanvasElement>('.logo-cv'), dpr = Math.min(3, devicePixelRatio || 1); cv.width = 340 * dpr; cv.height = 110 * dpr;
  const g = cv.getContext('2d')!, cars = [5, 0, 3, 1, 6, 2], t0 = performance.now();
  const roll = (t: number) => {
    if (!cv.isConnected) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, 340, 110);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 62, 340, 26); g.fillStyle = '#8a7f6e'; g.fillRect(0, 64, 340, 22);
    g.fillStyle = '#5e4632'; for (let x = 0; x < 340; x += 9) g.fillRect(x, 64, 4, 22);
    g.fillStyle = '#5c636b'; g.fillRect(0, 68, 340, 2.4); g.fillRect(0, 80, 340, 2.4);
    const K = 1.35, span = (cars.length + 1) * W * K, x0 = ((t - t0) / 1000 * 60) % (340 + span) - span;
    g.save(); g.translate(x0 + span, 75); g.scale(K, K); drawLoco(g, profile.loco); g.restore();
    cars.forEach((c, i) => { g.save(); g.translate(x0 + span - (i + 1) * W * K, 75); g.scale(K, K); drawWagon(g, c); g.restore(); });
    requestAnimationFrame(roll);
  };
  requestAnimationFrame(roll);
  app.querySelector('.menu')!.addEventListener('click', onHome);
  $('[data-act=sound]').onclick = () => { profile.sound = !profile.sound; setMuted(!profile.sound); save(); home(); };
}
function onHome(e: Event) {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act; if (!a) return;
  sfx.tap();
  if (a === 'play') show('map');
  if (a === 'shop') show('shop');
  if (a === 'daily') startDaily();
  if (a === 'rush') startRush();
}

let openChapter = 0;
function map() {
  const stars = totalStars();
  // open the latest chapter you can play by default
  const cards = CHAPTERS.map((c, i) => {
    const open = stars >= c.unlock, got = [...Array(LEVELS_PER_CHAPTER).keys()].reduce((a, l) => a + (profile.stars[`${c.id}-${l}`] ?? 0), 0);
    return `<button class="chapter${open ? '' : ' locked'}${i === openChapter ? ' on' : ''}" data-ch="${i}">
      <b>${i + 1}. ${c.name}</b><small>${open ? c.blurb : `🔒 ${c.unlock - stars} more ★ to open`}</small><span class="cstars">${got}/${LEVELS_PER_CHAPTER * 3} ★</span><span class="cbar"><u style="width:${(got / (LEVELS_PER_CHAPTER * 3)) * 100}%"></u></span></button>`;
  }).join('');
  const ch = CHAPTERS[openChapter], chOpen = stars >= ch.unlock;
  const grid = [...Array(LEVELS_PER_CHAPTER).keys()].map(l => {
    const key = `${ch.id}-${l}`, st = profile.stars[key] ?? 0, open = chOpen && (l === 0 || (profile.stars[`${ch.id}-${l - 1}`] ?? 0) > 0);
    return `<button class="lvl${open ? '' : ' locked'}${st ? ' done' : ''}" data-lvl="${l}" ${open ? '' : 'disabled'}><b>${open ? l + 1 : '🔒'}</b><span>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span></button>`;
  }).join('');
  app.innerHTML = `${topbar('Yards', 'home')}<div class="map"><div class="chapters">${cards}</div>
    <div class="levels"><h2>${ch.name}</h2><p>${ch.yard.caps.join(' · ')} wagon sidings · headshunt takes ${ch.yard.lead}</p><div class="grid">${grid}</div></div></div>`;
  app.querySelector('.map')!.addEventListener('click', e => {
    const t = e.target as HTMLElement, c = t.closest<HTMLElement>('[data-ch]'), l = t.closest<HTMLElement>('[data-lvl]');
    if (c) { sfx.tap(); openChapter = Number(c.dataset.ch); map(); }
    if (l && !l.hasAttribute('disabled')) { sfx.tap(); startLevel(openChapter, Number(l.dataset.lvl)); }
  });
}

let shopTab: 'loco' | 'theme' = 'loco';
function shop() {
  const items = shopTab === 'loco' ? LIVERIES : THEMES;
  const equipped = shopTab === 'loco' ? profile.loco : profile.theme;
  const cards = items.map(it => {
    const own = profile.owned.includes(it.id), on = equipped === it.id;
    const swatch = shopTab === 'loco' ? `<canvas class="sw" data-loco="${it.id}" width="140" height="70"></canvas>` : `<span class="swt" style="background:${(it as typeof THEMES[0]).ground}"><i style="background:${(it as typeof THEMES[0]).ballast}"></i><em style="background:${(it as typeof THEMES[0]).tree[0]}"></em></span>`;
    return `<div class="item${on ? ' on' : ''}">${swatch}<b>${it.name}</b>
      ${on ? '<span class="tag">Equipped</span>' : own ? `<button data-equip="${it.id}">Use</button>` : `<button class="buy" data-buy="${it.id}" ${profile.coins < it.price ? 'disabled' : ''}>${coinsHtml(it.price)}</button>`}</div>`;
  }).join('');
  app.innerHTML = `${topbar('Shop', 'home')}<div class="shop"><div class="tabs"><button class="${shopTab === 'loco' ? 'on' : ''}" data-tab="loco">Liveries</button><button class="${shopTab === 'theme' ? 'on' : ''}" data-tab="theme">Yards</button></div><div class="items">${cards}</div>
    <p class="note">Earn coins by solving puzzles: more for three stars, for perfect runs, the daily puzzle and Rush.</p></div>`;
  app.querySelectorAll<HTMLCanvasElement>('canvas[data-loco]').forEach(cv => { const g = cv.getContext('2d')!; g.scale(2, 2); g.translate(35, 17); drawLoco(g, cv.dataset.loco!); });
  app.querySelector('.shop')!.addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!t) return;
    if (t.dataset.tab) { shopTab = t.dataset.tab as 'loco' | 'theme'; sfx.tap(); shop(); }
    if (t.dataset.equip) { if (shopTab === 'loco') profile.loco = t.dataset.equip; else profile.theme = t.dataset.equip; save(); sfx.tap(); shop(); }
    if (t.dataset.buy) {
      const it = items.find(x => x.id === t.dataset.buy)!; if (profile.coins < it.price) return;
      profile.coins -= it.price; profile.owned.push(it.id); if (shopTab === 'loco') profile.loco = it.id; else profile.theme = it.id;
      save(); sfx.coins(); buzz('medium'); shop();
    }
  });
}

// ======================= starting a puzzle =======================
function startLevel(ci: number, li: number) {
  const ch = CHAPTERS[ci], p = levels[ch.id][li];
  play = new Play(p, { kind: 'level', key: `${ch.id}-${li}`, title: `${ch.name} · ${li + 1}`, ci, li });
}
async function startDaily() {
  const d = today(), seed = [...d].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  app.className = 'screen-play'; app.innerHTML = '<div class="loading"><div class="spinner"></div><p>Setting up today\'s yard…</p></div>';
  const r = await ask<{ puzzle: Puzzle }>({ kind: 'make', yard: { caps: [5, 3, 3], lead: 3 }, wagons: 8, target: 5, seed, par: [8, 12] });
  if (current === 'play' || app.className === 'screen-play') play = new Play(r.puzzle, { kind: 'daily', key: `daily-${d}`, title: `Daily · ${d.slice(5).replace('-', '/')}` });
}
function startRush() { play = new Play(null, { kind: 'rush', key: 'rush', title: 'Rush' }); }

// ======================= the puzzle screen =======================
interface Mode { kind: 'level' | 'daily' | 'rush'; key: string; title: string; ci?: number; li?: number }
interface Anim { ids: number[]; route: number; from: number[]; to: number[]; t: number; dur: number; done: () => void }

class Play {
  p!: Puzzle; st!: State; L!: Layout; vis = new Map<number, Vis>();
  history: State[] = []; moves = 0; undos = 0; hints = 0;
  phase: 'idle' | 'enter' | 'inside' | 'exit' | 'won' = 'idle';
  inside = -1; insideList: number[] = [];
  bgX0 = 0; bgW = 400;
  anim: Anim | null = null; raf = 0; cv!: HTMLCanvasElement; bg: HTMLCanvasElement | null = null; scale = 1; ox = 0; oy = 0; dpr = 1;
  hint: Move | null = null; msg = ''; msgT = 0; shake = 0; glowT = 0;
  puffs: { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; col: string }[] = [];
  // rush
  rushLeft = 180; rushScore = 0; rushLast = 0;
  constructor(p: Puzzle | null, public mode: Mode) {
    app.className = 'screen-play';
    app.innerHTML = `
      ${topbar(mode.title, mode.kind === 'level' ? 'map' : 'home')}
      <div class="hud"><div class="goal"><span><b>On A</b><small>from buffers</small></span><div class="target"></div></div>
        <div class="stats"><span class="moves"></span><span class="par"></span>${mode.kind === 'rush' ? '<span class="timer"></span><span class="score"></span>' : ''}</div></div>
      <div class="stage"><canvas class="yard"></canvas><div class="tip hidden"></div></div>
      <div class="controls"><div class="tools">
        <button data-c="undo" title="Undo">↶<small>Undo</small></button>
        <button data-c="restart" title="Start again">⟲<small>Restart</small></button>
        <button data-c="hint" title="Show the best next move">💡<small>${HINT_COST} 🪙</small></button></div>
        <div class="takes hidden"></div></div>`;
    this.cv = $<HTMLCanvasElement>('.yard');
    this.cv.addEventListener('pointerdown', e => this.tap(e));
    $('.controls').addEventListener('click', e => this.control(e));
    addEventListener('resize', this.onResize);
    if (p) this.load(p); else this.nextRush();
    const loop = (t: number) => { this.frame(t); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  destroy() { cancelAnimationFrame(this.raf); removeEventListener('resize', this.onResize); }
  onResize = () => { this.fit(); };

  load(p: Puzzle) {
    this.p = p; this.st = clone(p.start); this.L = layout(p.yard); this.history = []; this.moves = 0; this.undos = 0; this.hints = 0;
    this.phase = 'idle'; this.inside = -1; this.hint = null; this.anim = null;
    this.vis = restScene(this.L, p.yard, this.st);
    $('.target').innerHTML = p.target.map((w, i) => `<img src="${wagonPic(w)}" alt="${WAGONS[w].name}" title="${i + 1}. ${WAGONS[w].name}">`).join('');
    this.fit(); this.updateHud();
    this.tip(this.mode.key === 'c1-0' && profile.tut < 2 ? 'Goal: get the wagons shown at the top onto siding A, in that order from the buffers (the dashed ghosts show where). Tap a siding to drive the loco in.' : '');
  }
  async nextRush() {
    const sizes = [{ caps: [3, 2, 2], lead: 2, n: 4, t: 3 }, { caps: [4, 3, 2], lead: 2, n: 5, t: 4 }] as const;
    const s = sizes[this.rushScore < 3 ? 0 : 1];
    const r = await ask<{ puzzle: Puzzle }>({ kind: 'make', yard: { caps: s.caps, lead: s.lead }, wagons: s.n, target: s.t, seed: (Date.now() & 0xffffff) + this.rushScore, par: [3, 8] });
    if (r.puzzle) this.load(r.puzzle);
  }

  fit() {
    const stage = $('.stage'), r = stage.getBoundingClientRect(); this.dpr = Math.min(3, devicePixelRatio || 1);
    this.cv.width = Math.round(r.width * this.dpr); this.cv.height = Math.round(r.height * this.dpr);
    this.cv.style.width = `${r.width}px`; this.cv.style.height = `${r.height}px`;
    if (!this.L) return;
    this.scale = Math.min(r.width / this.L.w, r.height / this.L.h);
    this.ox = (r.width - this.L.w * this.scale) / 2; this.oy = (r.height - this.L.h * this.scale) / 2;
    // the scenery fills the whole stage, not just the yard's own width
    this.bgX0 = -this.ox / this.scale; this.bgW = r.width / this.scale;
    this.bg = drawBackground(this.L, profile.theme, this.scale, this.dpr, this.bgX0, this.bgW);
  }

  // ---- input ----
  world(e: PointerEvent) { const r = this.cv.getBoundingClientRect(); return { x: (e.clientX - r.left - this.ox) / this.scale, y: (e.clientY - r.top - this.oy) / this.scale }; }
  sidingAt(x: number, y: number): number {
    let best = -1, bd = 34;
    this.L.paths.forEach((p, i) => { for (const [px, py] of p.pts) { const d = Math.hypot(px - x, py - y); if (d < bd && py < this.L.P.y - 20) { bd = d; best = i; } } });
    for (let i = 0; i < 3; i++) { const p = this.L.paths[i]; for (let d = 40; d < p.len; d += 8) { const q = p.at(d); const dd = Math.hypot(q.x - x, q.y - y); if (dd < bd) { bd = dd; best = i; } } }
    return best;
  }
  vehicleAt(x: number, y: number): number | null {
    let best: number | null = null, bd = 26;
    for (const v of this.vis.values()) { const q = routeAt(this.L, v.route, v.u), d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = v.id; } }
    return best;
  }
  tap(e: PointerEvent) {
    if (this.phase === 'enter' || this.phase === 'exit' || this.phase === 'won') return;
    const { x, y } = this.world(e), hit = this.vehicleAt(x, y);
    if (this.phase === 'idle') {
      const vi = hit != null && hit >= 0 ? this.vis.get(hit)! : null;
      const inSiding = vi && vi.u > 0 && this.st.s[vi.route].includes(hit!) ? vi.route : -1;
      const siding = inSiding >= 0 ? inSiding : this.sidingAt(x, y);
      if (siding < 0) return;
      this.enter(siding, inSiding >= 0 ? hit! : null);
    } else if (this.phase === 'inside') {
      if (hit === -1) { this.exit(takeRange(this.st, this.p.yard, this.inside)[0]); return; }   // tap the loco: leave what you can
      const j = hit != null ? this.insideList.indexOf(hit) : -1;
      if (j >= 0) this.exit(this.insideList.length - j);
      else { const s = this.sidingAt(x, y); if (s >= 0 && s !== this.inside) this.say('Choose what to pull out first.'); }
    }
  }
  control(e: Event) {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
    if (b.dataset.take != null) { this.exit(Number(b.dataset.take)); return; }
    if (this.phase !== 'idle') return;
    const c = b.dataset.c;
    if (c === 'undo' && this.history.length) { this.st = this.history.pop()!; this.moves--; this.undos++; this.vis = restScene(this.L, this.p.yard, this.st); this.hint = null; sfx.uncouple(); this.updateHud(); }
    if (c === 'restart') { this.load(this.p); sfx.tap(); }
    if (c === 'hint') this.getHint();
  }
  async getHint() {
    if (profile.coins < HINT_COST) { this.say(`Hints cost ${HINT_COST} 🪙 — solve puzzles to earn more.`); sfx.error(); return; }
    this.say('Thinking…');
    const r = await ask<{ moves: Move[] | null }>({ kind: 'hint', state: this.st, target: this.p.target, yard: this.p.yard });
    if (!r.moves?.length) { this.say('No way forward from here — try Undo or Restart.'); return; }
    profile.coins -= HINT_COST; this.hints++; save(); this.updateHud();
    this.hint = r.moves[0];
    const m = this.hint;
    this.say(`Hint: into siding ${'ABC'[m.siding]}, then come out with ${m.take === 0 ? 'no wagons' : `${m.take} wagon${m.take > 1 ? 's' : ''}`}. (${r.moves.length} move${r.moves.length > 1 ? 's' : ''} to go)`, 5);
  }

  // ---- moves ----
  enter(i: number, upTo: number | null) {
    this.phase = 'enter'; this.inside = i; this.insideList = pushed(this.st, i);
    const n = this.insideList.length, ids = [-1, ...this.st.t];
    const from = ids.map(id => this.uOn(id, i));
    const to = ids.map(id => (id === -1 ? sidingD(this.L, i, n - 1) - W : sidingD(this.L, i, this.insideList.indexOf(id))));
    if (!this.st.t.length && n === 0) to[0] = sidingD(this.L, i, 0) + W * 0.5;   // light engine into an empty siding: run in to the buffers
    sfx.move(); buzz('light');
    this.run(ids, i, from, to, () => {
      if (this.st.s[i].length || this.st.t.length) { sfx.clank(); buzz('medium'); this.dust(); }
      this.phase = 'inside';
      if (upTo != null) {
        const j = this.insideList.indexOf(upTo), k = n - j, [lo, hi] = takeRange(this.st, this.p.yard, i);
        if (k >= lo && k <= hi) { this.exit(k); return; }
      }
      if (this.mode.key === 'c1-0' && profile.tut < 2) { profile.tut = 1; this.tip('Now pull out: tap a wagon (it comes out with everything between it and the loco), or use the buttons below.'); }
      this.updateHud();
    });
  }
  exit(k: number) {
    if (this.phase !== 'inside') return;
    const i = this.inside, [lo, hi] = takeRange(this.st, this.p.yard, i);
    if (k < lo || k > hi) {
      this.shake = 0.35; sfx.error(); buzz('heavy');
      this.say(k > hi ? `The headshunt only has room for ${this.p.yard.lead} wagon${this.p.yard.lead > 1 ? 's' : ''}.` : `Siding ${'ABC'[i]} only holds ${this.p.yard.caps[i]} — take at least ${lo}.`);
      return;
    }
    const before = clone(this.st), after = apply(this.st, { siding: i as 0 | 1 | 2, take: k }, this.p.yard)!;
    const n = this.insideList.length, moving = this.insideList.slice(n - k).reverse();   // nearest the loco first
    const ids = [-1, ...moving];
    const from = ids.map(id => this.vis.get(id)!.u);
    const to = ids.map(id => (id === -1 ? -leadD(k) : -leadD(k - 1 - moving.indexOf(id))));
    this.phase = 'exit'; this.insideList = [];
    if (k < n) { sfx.uncouple(); buzz('light'); }
    sfx.move();
    if (this.hint && this.hint.siding === i && this.hint.take === k) this.hint = null; else this.hint = null;
    this.history.push(before); this.st = after; this.moves++;
    this.run(ids, i, from, to, () => {
      this.vis = restScene(this.L, this.p.yard, this.st); this.phase = 'idle'; this.inside = -1; this.updateHud();
      if (this.mode.key === 'c1-0' && profile.tut < 2) { profile.tut = 2; save(); this.tip(''); }
      if (solved(this.st, this.p.target)) this.win();
    });
  }
  // a vehicle's position along route i (the loco and its train come from the headshunt)
  uOn(id: number, i: number) { const v = this.vis.get(id)!; return v.u < 0 ? v.u : v.route === i ? v.u : -leadD(0); }
  run(ids: number[], route: number, from: number[], to: number[], done: () => void) {
    const dist = Math.max(...ids.map((_, k) => Math.abs(to[k] - from[k])));
    ids.forEach((id, k) => this.vis.set(id, { id, route, u: from[k] }));
    this.anim = { ids, route, from, to, t: 0, dur: Math.min(1.1, 0.25 + dist / 520), done };
  }

  // a puff of dust where the loco couples up
  dust() {
    const v = this.vis.get(-1)!, q = routeAt(this.L, v.route, v.u), ax = Math.cos(q.a), ay = Math.sin(q.a);
    for (let k = 0; k < 10; k++) { const a = Math.random() * 6.28, sp = 8 + Math.random() * 18; this.puffs.push({ x: q.x + ax * W * 0.5, y: q.y + ay * W * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 3, life: 0, max: 0.6 + Math.random() * 0.4, col: '170,150,120' }); }
  }
  win() {
    this.phase = 'won'; this.tip('');
    const stars = starsFor(this.moves, this.p.par), perfect = stars === 3 && this.undos === 0 && this.hints === 0;
    let coins = 0; const lines: string[] = [];
    if (this.mode.kind === 'rush') {
      this.rushScore++; const bonus = stars === 3 ? 15 : stars === 2 ? 8 : 4; this.rushLeft += bonus;
      this.say(`Solved! +${bonus}s`, 1.2); sfx.win(); buzz('heavy');
      setTimeout(() => { if (this.rushLeft > 0 && play === this) this.nextRush(); }, 900);
      this.updateHud(); return;
    }
    if (this.mode.kind === 'level') {
      const prev = profile.stars[this.mode.key] ?? 0;
      if (!prev) { coins += 10 + stars * 10; lines.push(`First clear +${10 + stars * 10}`); }
      else if (stars > prev) { coins += (stars - prev) * 10; lines.push(`New best stars +${(stars - prev) * 10}`); }
      profile.stars[this.mode.key] = Math.max(prev, stars);
      profile.best[this.mode.key] = Math.min(profile.best[this.mode.key] ?? 999, this.moves);
      // finishing a whole chapter opens its chest
      const ch = CHAPTERS[this.mode.ci!];
      if (!profile.chests.includes(ch.id) && [...Array(LEVELS_PER_CHAPTER).keys()].every(l => profile.stars[`${ch.id}-${l}`])) {
        profile.chests.push(ch.id); coins += 150; lines.push(`🎁 ${ch.name} complete! +150`);
      }
    } else {
      const d = today();
      if (!profile.daily.done[d]) {
        profile.daily.streak = profile.daily.last === yesterday() ? profile.daily.streak + 1 : 1;
        profile.daily.last = d; profile.daily.best = Math.max(profile.daily.best, profile.daily.streak);
        const bonus = Math.min(100, 10 * (profile.daily.streak - 1));
        coins += 60 + bonus; lines.push(`Daily puzzle +60`); if (bonus) lines.push(`🔥 ${profile.daily.streak}-day streak +${bonus}`);
      }
      profile.daily.done[d] = Math.max(profile.daily.done[d] ?? 0, stars);
    }
    if (perfect) { coins += 15; lines.push('Perfect: no undo, no hints +15'); profile.perfect++; }
    profile.solved++; profile.coins += coins; save();
    sfx.win(); buzz('heavy');
    const next = this.mode.kind === 'level' && this.mode.li! + 1 < LEVELS_PER_CHAPTER;
    const modal = document.createElement('div'); modal.className = 'modal';
    modal.innerHTML = `<div class="card win"><div class="confetti">${Array.from({ length: 26 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      <h2>${stars === 3 ? 'Brilliant!' : stars === 2 ? 'Nicely done!' : 'Solved!'}</h2>
      <div class="madeup">${this.p.target.map(w => `<img src="${wagonPic(w)}" alt="">`).join('')}<img class="eng" src="${wagonPic('loco', profile.loco)}" alt=""></div>
      <div class="bigstars">${[0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}" style="--d:${i * 0.25}s">★</span>`).join('')}</div>
      <p class="mv">${this.moves} moves · par ${this.p.par}${stars < 3 ? ` <small>(three stars at ${this.p.par})</small>` : ''}</p>
      ${coins ? `<div class="earn">${lines.map(l => `<div>${l}</div>`).join('')}<b>${coinsHtml(coins)}</b></div>` : ''}
      <div class="btns">${next ? '<button class="primary" data-w="next">Next ›</button>' : ''}<button data-w="retry">Retry</button><button data-w="back">${this.mode.kind === 'level' ? 'Map' : 'Home'}</button></div></div>`;
    app.appendChild(modal);
    [0, 1, 2].forEach(i => { if (i < stars) setTimeout(() => { sfx.star(i); buzz('light'); }, 350 + i * 250); });
    if (coins) setTimeout(() => sfx.coins(), 1200);
    modal.addEventListener('click', e => {
      const w = (e.target as HTMLElement).closest<HTMLElement>('[data-w]')?.dataset.w; if (!w) return;
      sfx.tap(); modal.remove();
      if (w === 'next') startLevel(this.mode.ci!, this.mode.li! + 1);
      if (w === 'retry') this.load(this.p);
      if (w === 'back') show(this.mode.kind === 'level' ? 'map' : 'home');
    });
  }
  rushOver() {
    this.phase = 'won';
    const coins = this.rushScore * 8, best = this.rushScore > profile.rushBest;
    if (best) profile.rushBest = this.rushScore;
    profile.coins += coins; save(); sfx.win();
    const modal = document.createElement('div'); modal.className = 'modal';
    modal.innerHTML = `<div class="card win"><h2>Time!</h2><p class="rush">${this.rushScore} yard${this.rushScore === 1 ? '' : 's'} sorted</p>${best ? '<p class="newbest">🏆 New best!</p>' : `<p class="mv">Best: ${profile.rushBest}</p>`}
      ${coins ? `<div class="earn"><b>${coinsHtml(coins)}</b></div>` : ''}<div class="btns"><button class="primary" data-w="again">Again</button><button data-w="home">Home</button></div></div>`;
    app.appendChild(modal);
    modal.addEventListener('click', e => { const w = (e.target as HTMLElement).closest<HTMLElement>('[data-w]')?.dataset.w; if (!w) return; modal.remove(); if (w === 'again') startRush(); else show('home'); });
  }

  // ---- the HUD ----
  updateHud() {
    const st = starsFor(this.moves, this.p.par);
    $('.moves').innerHTML = `Moves <b>${this.moves}</b>`;
    $('.par').innerHTML = this.mode.kind === 'rush' ? '' : `Par <b>${this.p.par}</b> <span class="live">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`;
    if (this.mode.kind === 'rush') $('.score').innerHTML = `Solved <b>${this.rushScore}</b>`;
    $('.wallet').innerHTML = coinsHtml(profile.coins);
    const takes = $('.takes'), tools = $('.tools');
    if (this.phase === 'inside') {
      const [lo, hi] = takeRange(this.st, this.p.yard, this.inside), n = this.insideList.length;
      const btn = (k: number) => `<button data-take="${k}" class="${this.hint && this.hint.siding === this.inside && this.hint.take === k ? 'hinted' : ''}" ${k < lo || k > hi ? 'disabled' : ''}>${k === 0 ? 'Leave all' : `Take ${k}`}</button>`;
      takes.innerHTML = `<span>Pull out with:</span>${[...Array(Math.min(n, this.p.yard.lead) + 1).keys()].map(btn).join('')}`;
      takes.classList.remove('hidden'); tools.classList.add('hidden');
    } else { takes.classList.add('hidden'); tools.classList.remove('hidden'); }
    const hintB = $<HTMLButtonElement>('[data-c=hint]'); hintB.disabled = this.phase !== 'idle';
    $<HTMLButtonElement>('[data-c=undo]').disabled = !this.history.length || this.phase !== 'idle';
  }
  tip(text: string) { const t = $('.tip'); t.textContent = text; t.classList.toggle('hidden', !text); }
  say(text: string, secs = 2.2) { this.msg = text; this.msgT = secs; }

  // ---- drawing ----
  frame(t: number) {
    const dt = Math.min(0.05, (t - (this.rushLast || t)) / 1000); this.rushLast = t;
    if (!this.p) return;
    if (this.mode.kind === 'rush' && this.phase !== 'won') {
      this.rushLeft -= dt;
      const el = $('.timer'); if (el) { el.innerHTML = `⏱ <b>${Math.max(0, Math.ceil(this.rushLeft))}</b>s`; el.classList.toggle('low', this.rushLeft < 20); }
      if (this.rushLeft <= 0) this.rushOver();
    }
    if (this.anim) {
      const a = this.anim; a.t += dt / a.dur; const e = a.t >= 1 ? 1 : a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
      a.ids.forEach((id, k) => { this.vis.get(id)!.u = a.from[k] + (a.to[k] - a.from[k]) * e; });
      if (a.t >= 1) { this.anim = null; a.done(); }
    }
    this.msgT -= dt; this.shake = Math.max(0, this.shake - dt); this.glowT += dt;
    const g = this.cv.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height);
    const sx = this.shake ? Math.sin(this.shake * 60) * 6 * this.shake : 0;
    g.setTransform(this.dpr, 0, 0, this.dpr, (this.ox + sx) * this.dpr, this.oy * this.dpr);
    if (this.bg) g.drawImage(this.bg, this.bgX0 * this.scale, 0, this.bgW * this.scale, this.L.h * this.scale);
    g.scale(this.scale, this.scale);
    // siding A's target: ghosts of the wagons that belong there, and a glow under the ones already in place
    const A = this.st.s[0];
    let good = 0; while (good < A.length && good < this.p.target.length && A[good] === this.p.target[good]) good++;
    this.p.target.forEach((w, j) => {
      const q = this.L.paths[0].at(sidingD(this.L, 0, j));
      g.save(); g.translate(q.x, q.y); g.rotate(q.a);
      if (j < good && this.phase === 'idle') { g.fillStyle = `rgba(120,255,140,${0.35 + 0.15 * Math.sin(this.glowT * 3)})`; g.beginPath(); g.roundRect(-W / 2, -19, W, 38, 10); g.fill(); }
      else { g.setLineDash([5, 4]); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.roundRect(-W / 2 + 2, -17, W - 4, 34, 8); g.stroke(); g.setLineDash([]); drawWagon(g, w, 0.28); }
      g.restore();
    });
    // a hint arrow over the siding to go to
    if (this.hint && this.phase === 'idle') {
      const p = this.L.paths[this.hint.siding], q = p.at(p.len * 0.55), bob = Math.sin(this.glowT * 5) * 6;
      g.save(); g.translate(q.x + (this.hint.siding === 1 ? -44 : 44), q.y + bob); g.fillStyle = '#ffd166'; g.strokeStyle = '#6b4a0c'; g.lineWidth = 2.5;
      g.rotate(this.hint.siding === 1 ? Math.PI / 2 : -Math.PI / 2);
      g.beginPath(); g.moveTo(0, 16); g.lineTo(-13, -2); g.lineTo(-6, -2); g.lineTo(-6, -16); g.lineTo(6, -16); g.lineTo(6, -2); g.lineTo(13, -2); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    // exhaust from the loco while it's working
    if (this.anim && this.anim.ids.includes(-1) && Math.random() < 0.6) {
      const v = this.vis.get(-1)!, q = routeAt(this.L, v.route, v.u);
      this.puffs.push({ x: q.x + Math.cos(q.a) * 6, y: q.y + Math.sin(q.a) * 6, vx: (Math.random() - 0.5) * 8, vy: -6 - Math.random() * 8, r: 3, life: 0, max: 1.4 + Math.random() * 0.8, col: '90,90,95' });
    }
    this.puffs = this.puffs.filter(p => (p.life += dt) < p.max);
    // the trains
    for (const v of this.vis.values()) {
      const q = routeAt(this.L, v.route, v.u);
      g.save(); g.translate(q.x, q.y); g.rotate(q.a - Math.PI);   // vehicles face the points
      if (v.id === -1) drawLoco(g, profile.loco); else drawWagon(g, v.id);
      g.restore();
    }
    for (const p of this.puffs) { const k = p.life / p.max; p.x += p.vx * dt; p.y += p.vy * dt; g.fillStyle = `rgba(${p.col},${0.45 * (1 - k)})`; g.beginPath(); g.arc(p.x, p.y, p.r + k * 10, 0, 7); g.fill(); }
    // the siding we're in: a highlight along it
    if (this.phase === 'inside') {
      const p = this.L.paths[this.inside];
      g.strokeStyle = `rgba(255,209,102,${0.5 + 0.3 * Math.sin(this.glowT * 6)})`; g.lineWidth = 4; g.setLineDash([10, 8]); g.lineDashOffset = -this.glowT * 30;
      g.beginPath(); p.pts.forEach(([x, y], k) => (k ? g.lineTo(x + 24, y) : g.moveTo(x + 24, y))); g.stroke(); g.setLineDash([]);
    }
    // messages
    if (this.msgT > 0) {
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const w = this.cv.width / this.dpr, text = this.msg; g.font = '600 15px system-ui, -apple-system, sans-serif';
      const tw = Math.min(w - 24, g.measureText(text).width + 28), lines = wrap(g, text, tw - 28);
      const h = 18 * lines.length + 16, x = (w - tw) / 2, y = 10;
      g.globalAlpha = Math.min(1, this.msgT * 3); g.fillStyle = 'rgba(25,22,30,.88)'; g.beginPath(); g.roundRect(x, y, tw, h, 12); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'top'; lines.forEach((l, k) => g.fillText(l, w / 2, y + 9 + k * 18)); g.globalAlpha = 1;
    }
  }
}
function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(' '), out: string[] = []; let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}

// a handle for automated tests
(window as any).__ym = { get play() { return play; }, solve, profile, show };

show('home');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
