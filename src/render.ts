// Drawing the yard: three sidings fanning up from the points, the headshunt below, wagons and the loco seen from
// above. Positions are worked out along each track's centre line, so trains glide smoothly round the curves.
import type { State, Yard } from './puzzle';
import { THEMES, LIVERIES } from './cosmetics';
import { SPRITE_SCALE, rock, shade, sprite, tree, type CargoKind } from './art';

export const W = 58;              // one vehicle's length, along the track (in yard units)
const FOUL = 30;                  // keep this far back from the points
const END = 10;                   // ...and this far from the buffer stops
export interface Pt { x: number; y: number; a: number }

class Path {
  pts: [number, number][]; cum: number[] = []; len = 0;
  constructor(pts: [number, number][]) {
    this.pts = pts;
    for (let i = 0; i < pts.length; i++) { if (i) this.len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); this.cum.push(this.len); }
  }
  at(d: number): Pt {
    d = Math.max(0, Math.min(this.len, d));
    let i = 1; while (i < this.pts.length - 1 && this.cum[i] < d) i++;
    const [x0, y0] = this.pts[i - 1], [x1, y1] = this.pts[i], seg = this.cum[i] - this.cum[i - 1] || 1, f = (d - this.cum[i - 1]) / seg;
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, a: Math.atan2(y1 - y0, x1 - x0) };
  }
}
// a smooth curve through control points (quadratic corners), sampled densely
function curve(ctrl: [number, number][]): [number, number][] {
  const out: [number, number][] = [ctrl[0]];
  for (let i = 1; i < ctrl.length - 1; i++) {
    const [ax, ay] = ctrl[i - 1], [bx, by] = ctrl[i], [cx, cy] = ctrl[i + 1];
    const p0: [number, number] = [(ax + bx) / 2, (ay + by) / 2], p2: [number, number] = [(bx + cx) / 2, (by + cy) / 2];
    if (i === 1) out.push(p0);
    for (let t = 0.1; t <= 1.001; t += 0.1) { const u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * bx + t * t * p2[0], u * u * p0[1] + 2 * u * t * by + t * t * p2[1]]); }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

export interface Layout { paths: [Path, Path, Path]; lead: Path; P: { x: number; y: number }; w: number; h: number }
// the yard's shape for its siding lengths: A straight up from the points, B and C curving off left and right
export function layout(yard: Yard): Layout {
  // B and C curve away first, then run straight: every wagon slot is on the straight, clear of the points
  const CURVE = 190, px = 200, A = yard.caps[0] * W + END + FOUL + 20, straight = (c: number) => c * W + END + 6;
  const top = 40, py = top + Math.max(A, CURVE + straight(yard.caps[1]), CURVE + straight(yard.caps[2])), lead = (yard.lead + 1) * W + FOUL + 30;
  const P = { x: px, y: py };
  const side = (dx: number, cap: number) => {
    const pts = curve([[px, py], [px, py - 40], [px + dx, py - 120], [px + dx, py - CURVE]]);
    return new Path([...pts, [px + dx, py - CURVE - straight(cap)]]);
  };
  const paths: [Path, Path, Path] = [new Path([[px, py], [px, py - A]]), side(-95, yard.caps[1]), side(95, yard.caps[2])];
  return { paths, lead: new Path([[px, py], [px, py + lead]]), P, w: 400, h: py + lead + 20 };
}

// where things sit: siding slot j counts from the buffer end; the train hangs below the points
export const sidingD = (L: Layout, i: number, j: number) => L.paths[i].len - END - (j + 0.5) * W;
export const leadD = (k: number) => FOUL + (k + 0.5) * W;   // k = 0 nearest the points
export function routeAt(L: Layout, i: number, u: number): Pt {
  if (u >= 0) return L.paths[i].at(u);
  const p = L.lead.at(-u); return { x: p.x, y: p.y, a: p.a + Math.PI };
}

// --- the scene ---
export interface Vis { id: number; route: number; u: number }   // id -1 = the loco
export interface Scene { L: Layout; yard: Yard; vis: Map<number, Vis> }

// everything at rest for a state (loco in the headshunt)
export function restScene(L: Layout, yard: Yard, st: State): Map<number, Vis> {
  const vis = new Map<number, Vis>();
  for (let i = 0; i < 3; i++) st.s[i].forEach((w, j) => vis.set(w, { id: w, route: i, u: sidingD(L, i, j) }));
  const n = st.t.length;
  st.t.forEach((w, m) => vis.set(w, { id: w, route: 0, u: -leadD(n - 1 - m) }));
  vis.set(-1, { id: -1, route: 0, u: -leadD(n) });
  void yard;
  return vis;
}

// The eight wagons: each a different kind of car (and colour), so every one is easy to tell apart.
export const WAGONS: { name: string; art: string; cargo: CargoKind | null; col: string; seed: number }[] = [
  { name: 'Box car', art: 'box', cargo: null, col: '#b23a2c', seed: 11 },
  { name: 'Tank car', art: 'tank', cargo: null, col: '#d9dee3', seed: 12 },
  { name: 'Grain hopper', art: 'grain', cargo: null, col: '#d8b54a', seed: 13 },
  { name: 'Lumber flat', art: 'lumber', cargo: 'timber', col: '#888', seed: 14 },
  { name: 'Log car', art: 'logs', cargo: 'logs', col: '#888', seed: 15 },
  { name: 'Container flat', art: 'container', cargo: 'containers', col: '#2471a3', seed: 16 },
  { name: 'Gravel gondola', art: 'gondola', cargo: 'gravel', col: '#3f6b46', seed: 17 },
  { name: 'Coach', art: 'coach', cargo: null, col: '#7a2e2e', seed: 19 },
];
const CAR_LEN = 42, CAR_K = (W - 3) / CAR_LEN;   // painted length, and the scale to fit a slot
export const wagonSprite = (id: number) => { const w = WAGONS[id % WAGONS.length]; return sprite(w.art, CAR_LEN, w.seed, w.cargo, undefined, w.col); };
export const locoSprite = (livery: string) => { const lv = LIVERIES.find(l => l.id === livery) ?? LIVERIES[0]; return sprite('shunter', CAR_LEN, 7, null, { c1: lv.body, c2: lv.trim }); };
const CAR_WIDE = 1.6;   // drawn a little wider than scale: chunkier, easier to read on a phone
function blit(g: CanvasRenderingContext2D, img: HTMLCanvasElement, alpha: number) {
  const w = img.width / SPRITE_SCALE * CAR_K, h = img.height / SPRITE_SCALE * CAR_K * CAR_WIDE;
  // a soft shadow under the car, then the car
  g.globalAlpha = alpha * 0.35; g.fillStyle = '#000'; g.beginPath(); g.roundRect(-CAR_LEN * CAR_K / 2 + 3, -8 * CAR_K * CAR_WIDE + 4, CAR_LEN * CAR_K, 16 * CAR_K * CAR_WIDE, 6); g.fill();
  g.globalAlpha = alpha; g.drawImage(img, -w / 2, -h / 2, w, h); g.globalAlpha = 1;
}
// a wagon from above, pointing along +x, centred on the origin
export function drawWagon(g: CanvasRenderingContext2D, id: number, alpha = 1) { blit(g, wagonSprite(id), alpha); }
// the shunter, pointing along +x
export function drawLoco(g: CanvasRenderingContext2D, livery: string) { blit(g, locoSprite(livery), 1); }
// a picture of a wagon, for the target strip and the cards (a data URL, cached)
const pics = new Map<string, string>();
export function wagonPic(id: number | 'loco', livery = 'works') {
  const key = `${id}|${livery}`; let u = pics.get(key); if (u) return u;
  const img = id === 'loco' ? locoSprite(livery) : wagonSprite(id), c = document.createElement('canvas');
  c.width = img.width; c.height = img.height * 0.72; c.getContext('2d')!.drawImage(img, 0, -img.height * 0.14);
  u = c.toDataURL(); pics.set(key, u); return u;
}

// the ground and track, drawn once per yard/theme/size into a canvas
// x0 and w: the strip of the world to draw (wider than the yard on wide screens, so scenery fills it)
export function drawBackground(L: Layout, themeId: string, scale: number, dpr: number, x0 = 0, w = L.w): HTMLCanvasElement {
  const th = THEMES.find(t => t.id === themeId) ?? THEMES[0];
  const cv = document.createElement('canvas'); cv.width = Math.ceil(w * scale * dpr); cv.height = Math.ceil(L.h * scale * dpr);
  const g = cv.getContext('2d')!; g.scale(scale * dpr, scale * dpr); g.translate(-x0, 0);
  g.fillStyle = th.ground; g.fillRect(x0, 0, w, L.h);
  const RX = () => x0 + rnd() * w;
  // the ground: broad soft patches, then speckles and tufts of grass
  let seed = 12345; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = RX(), y = rnd() * L.h, r = 50 + rnd() * 90, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rnd() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 1400; i++) { g.fillStyle = rnd() < 0.5 ? th.speck1 : th.speck2; const x = RX(), y = rnd() * L.h, r = 0.5 + rnd() * 1.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  for (let i = 0; i < 160; i++) { const x = RX(), y = rnd() * L.h; g.strokeStyle = th.speck1; g.lineWidth = 1; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(x + k * 1.5, y); g.lineTo(x + k * 2.5, y - 4); } g.stroke(); }
  if (th.id === 'meadow') for (let i = 0; i < 60; i++) { const x = RX(), y = rnd() * L.h; g.fillStyle = ['#fff', '#ffe066', '#ff9ec7', '#c9a7ff'][i % 4]; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  const all = [...L.paths, L.lead];
  const near = (x: number, y: number, d: number) => all.some(p => p.pts.some(([px, py]) => Math.hypot(px - x, py - y) < d)) || all.some(p => { for (let k = 0; k < p.len; k += 10) { const q = p.at(k); if (Math.hypot(q.x - x, q.y - y) < d) return true; } return false; });
  const taken: [number, number, number][] = [];
  const free = (x: number, y: number, r: number) => !near(x, y, r + 52) && !taken.some(([tx, ty, tr]) => Math.hypot(tx - x, ty - y) < tr + r) && x > x0 + r && x < x0 + w - r && y > r && y < L.h - r;
  // the yard bed: a broad apron of cinders under the whole layout, fading into the grass at its edges
  const bedStroke = (wd: number, col: string) => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'round'; g.lineJoin = 'round'; for (const p of all) { g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); } };
  bedStroke(104, 'rgba(0,0,0,.06)'); bedStroke(96, th.bed + '66'); bedStroke(86, th.bed);
  // cinder and gravel grit on the bed
  for (const p of all) for (let d = 0; d < p.len; d += 2.2) {
    const q = p.at(d), off = (rnd() - 0.5) * 84, x = q.x - Math.sin(q.a) * off, y = q.y + Math.cos(q.a) * off;
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.12)'; g.fillRect(x, y, 1.2 + rnd(), 1.2 + rnd());
  }
  // tufts of grass creeping in at the edges
  for (const p of all) for (let d = 0; d < p.len; d += 14) for (const side of [-1, 1]) {
    if (rnd() < 0.45) continue;
    const q = p.at(d), off = side * (36 + rnd() * 8), x = q.x - Math.sin(q.a) * off, y = q.y + Math.cos(q.a) * off;
    if (near(x, y, 30)) continue;
    g.strokeStyle = th.speck1; g.lineWidth = 1.2; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(x + k * 1.6, y + 1); g.lineTo(x + k * 2.6, y - 4); } g.stroke();
  }
  // floodlight masts at the corners of the yard (their light shows at night)
  for (const [dx, dy] of [[-64, -30], [64, -30], [-48, 140]]) {
    const x = L.P.x + dx, y = L.P.y + dy;
    if (th.id === 'night') { const gl = g.createRadialGradient(x, y, 0, x, y, 120); gl.addColorStop(0, 'rgba(255,220,150,.32)'); gl.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = gl; g.fillRect(x - 120, y - 120, 240, 240); }
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x + 9, y + 9, 9, 3, 0.6, 0, 7); g.fill();
    g.fillStyle = '#4a4f57'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
    g.fillStyle = '#2f3339'; g.fillRect(x - 7, y - 3, 14, 6); g.fillStyle = '#fff2c4'; g.fillRect(x - 6, y - 2, 5, 4); g.fillRect(x + 1, y - 2, 5, 4);
  }
  // trees, bushes and rocks wherever there's room
  for (let i = 0; i < Math.round(240 * w / L.w); i++) {
    const x = RX(), y = rnd() * L.h, r = 8 + rnd() * 11;
    if (!free(x, y, r)) continue;
    taken.push([x, y, r]);
    if (rnd() < 0.12) rock(g, x, y, r * 0.45, rnd() * 3);
    else tree(g, x, y, r, th.tree[i % th.tree.length], th.id === 'snow' || (th.id !== 'meadow' && rnd() < 0.4), th.id === 'snow', i);
  }
  // track: ballast shoulders with stones, wooden sleepers with tie plates, rails with a polished top
  const stroke = (p: Path, wd: number, col: string) => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'butt'; g.lineJoin = 'round'; g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
  for (const p of all) stroke(p, 42, th.ballastEdge);
  for (const p of all) stroke(p, 36, th.ballast);
  for (const p of all) for (let d = 0; d < p.len; d += 1.6) {
    const q = p.at(d), off = (rnd() - 0.5) * 34, x = q.x - Math.sin(q.a) * off, y = q.y + Math.cos(q.a) * off;
    g.fillStyle = ['rgba(0,0,0,.18)', 'rgba(255,255,255,.22)', 'rgba(0,0,0,.08)'][Math.floor(rnd() * 3)]; g.beginPath(); g.arc(x, y, 0.7 + rnd() * 0.9, 0, 7); g.fill();
  }
  const sleeperCol = (k: number) => shade(th.sleeper, ((k * 37) % 11) - 5);
  for (const p of all) {
    const n = Math.floor(p.len / 8);
    for (let k = 0; k <= n; k++) {
      const q = p.at(k * 8); g.save(); g.translate(q.x, q.y); g.rotate(q.a);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-1.6, -14, 4.8, 29);
      g.fillStyle = sleeperCol(k); g.fillRect(-2.4, -15, 4.8, 30);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-2.4, -15, 1.2, 30);
      g.fillStyle = '#3d3a38'; g.fillRect(-2.6, -10.5, 5.2, 5); g.fillRect(-2.6, 5.5, 5.2, 5);   // tie plates under the rails
      g.restore();
    }
  }
  const rail = (p: Path, off: number, wd: number, col: string, dy = 0) => {
    g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'butt'; g.beginPath();
    p.pts.forEach(([x, y], i) => { const q = p.at(p.cum[i]), nx = -Math.sin(q.a) * off, ny = Math.cos(q.a) * off; i ? g.lineTo(x + nx + dy, y + ny + dy) : g.moveTo(x + nx + dy, y + ny + dy); }); g.stroke();
  };
  for (const p of all) for (const off of [-8, 8]) { rail(p, off, 3.4, 'rgba(0,0,0,.35)', 0.9); rail(p, off, 3, th.rail); rail(p, off - 0.5, 1, 'rgba(235,240,245,.75)'); }
  // the points: a check rail and the frog where the routes divide, and the point lever beside them
  { const x = L.P.x, y = L.P.y - 52; g.fillStyle = '#3d3a38'; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x - 4, y + 10); g.lineTo(x + 4, y + 10); g.closePath(); g.fill(); }
  { const x = L.P.x + 30, y = L.P.y - 6;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 2, y + 2, 14, 10); g.fillStyle = '#6b4a32'; g.fillRect(x, y, 14, 10); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, y, 14, 2);
    g.strokeStyle = '#2b2b2b'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 7, y + 5); g.lineTo(x + 3, y - 9); g.stroke();
    g.fillStyle = '#d6412f'; g.beginPath(); g.arc(x + 3, y - 10, 2.6, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 2.3, y - 10.6, 0.9, 0, 7); g.fill(); }
  // buffer stops: a timber frame, two sprung buffers, a red and white beam and a lamp
  for (const p of L.paths) {
    const q = p.at(p.len); g.save(); g.translate(q.x, q.y); g.rotate(q.a);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(1, -18, 12, 38);
    g.fillStyle = '#4e3826'; g.fillRect(2, -18, 10, 36); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(2, -18, 10, 2);
    g.fillStyle = '#d63a2a'; g.fillRect(-1, -15, 5, 30); g.fillStyle = '#fff'; for (const yy of [-9, 3]) g.fillRect(-1, yy, 5, 6);
    g.fillStyle = '#2b2b2b'; for (const yy of [-8, 8]) { g.fillRect(-5, yy - 2.5, 5, 5); g.fillStyle = '#9aa1a8'; g.beginPath(); g.arc(-5, yy, 3, 0, 7); g.fill(); g.fillStyle = '#2b2b2b'; }
    g.fillStyle = '#ff4433'; g.beginPath(); g.arc(8, 0, 2.6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,90,70,.35)'; g.beginPath(); g.arc(8, 0, 6, 0, 7); g.fill();
    g.restore();
  }
  // siding names on little painted boards beside the buffers
  g.font = 'bold 13px system-ui, -apple-system, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['A', 'B', 'C'].forEach((ch, i) => {
    const q = L.paths[i].at(L.paths[i].len), x = q.x + (i === 1 ? -28 : 28), y = q.y + 4;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.roundRect(x - 9 + 2, y - 9 + 2, 18, 18, 4); g.fill();
    g.fillStyle = '#1f3a5f'; g.beginPath(); g.roundRect(x - 9, y - 9, 18, 18, 4); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.roundRect(x - 7.5, y - 7.5, 15, 15, 3); g.stroke();
    g.fillStyle = '#fff'; g.fillText(ch, x, y + 0.5);
  });
  return cv;
}
