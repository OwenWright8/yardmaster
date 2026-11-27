// Rolling stock and small scenery drawn from above, in the style of the re-spot Train face. Each car is painted once
// onto its own little canvas (front = +x) and cached.
// (Ported from the Branch Line game.)
export type CargoKind = 'grain' | 'logs' | 'timber' | 'gravel' | 'flour' | 'goods' | 'fuel' | 'containers' | 'rubble' | 'ore';
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; }
  next() { this.s = (this.s * 16807) % 2147483647; return (this.s - 1) / 2147483646; }
  range(a: number, b: number) { return a + this.next() * (b - a); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  chance(p: number) { return this.next() < p; }
}

export const W = 16, HW = 8;
type G = CanvasRenderingContext2D;

export const rp = (g: G, x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
};
export const dot = (g: G, x: number, y: number, r: number, col: string) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
export const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v + k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
// a soft top-lit sheen across a car body: light along the north edge, shadow along the south
const sheen = (g: G, y0: number, y1: number) => {
  const s = g.createLinearGradient(0, y0, 0, y1);
  s.addColorStop(0, 'rgba(255,255,255,.30)'); s.addColorStop(0.4, 'rgba(255,255,255,.04)'); s.addColorStop(0.75, 'rgba(0,0,0,.06)'); s.addColorStop(1, 'rgba(0,0,0,.32)');
  return s;
};
const ribs = (g: G, L: number, step: number, a: number) => {
  g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = 0.7; g.beginPath();
  for (let x = -L / 2 + step; x < L / 2 - 1; x += step) { g.moveTo(x, -HW + 0.5); g.lineTo(x, HW - 0.5); }
  g.stroke();
};
const deck = (g: G, L: number) => {
  g.fillStyle = '#4a3a2e'; rp(g, -L / 2, -HW + 1, L, W - 2, 1); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 0.5; g.beginPath();
  for (let x = -L / 2 + 3; x < L / 2; x += 3) { g.moveTo(x, -HW + 1); g.lineTo(x, HW - 1); } g.stroke();
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-L / 2, -HW + 1, L, 1);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-L / 2, HW - 2, L, 1);
};
// two bogies with wheels, drawn under the body so they peek out at the ends and in the gaps
const bogies = (g: G, L: number) => {
  for (const bx of [-L / 2 + 7, L / 2 - 7]) {
    g.fillStyle = '#1e1f22'; rp(g, bx - 5, -HW - 0.5, 10, W + 1, 1.5); g.fill();
    g.fillStyle = '#3a3d42';
    for (const wx of [bx - 2.8, bx + 2.8]) { g.fillRect(wx - 1, -HW - 1, 2, 2.6); g.fillRect(wx - 1, HW - 1.6, 2, 2.6); }
  }
  // couplers
  g.fillStyle = '#2a2a2a'; g.fillRect(-L / 2 - 2.5, -1.2, 3, 2.4); g.fillRect(L / 2 - 0.5, -1.2, 3, 2.4);
};
// a thin dark edge round the body so cars read clearly against any ground
const outline = (g: G, x: number, y: number, w: number, h: number, r: number) => { g.strokeStyle = 'rgba(20,16,12,.55)'; g.lineWidth = 0.8; rp(g, x, y, w, h, r); g.stroke(); };
const handrails = (g: G, x0: number, x1: number, col = 'rgba(255,255,255,.55)') => {
  g.strokeStyle = col; g.lineWidth = 0.6; g.beginPath();
  g.moveTo(x0, -HW + 1.2); g.lineTo(x1, -HW + 1.2); g.moveTo(x0, HW - 1.2); g.lineTo(x1, HW - 1.2); g.stroke();
};
const glass = (g: G, x: number, y: number, w: number, h: number) => {
  g.fillStyle = '#9fd3ef'; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x, y, w, h * 0.35);
};

export interface PaintOpts { rng: Rng; cargo: CargoKind | null; c1: string; c2: string; col: string }

const BOX_COLS = ['#8e3b2b', '#6d4c41', '#1f5d8c', '#2f6b3a', '#c9a227', '#7a2e2e', '#455a64', '#b5651d'];
const CONT_COLS = ['#c0392b', '#2471a3', '#1e8449', '#d68910', '#7d3c98', '#e5e7e9', '#5d6d7e'];

export const PAINTERS: Record<string, (g: G, L: number, o: PaintOpts) => void> = {
  shunter: (g, L, o) => {   // switcher: short hood, tall cab at the rear, walkways all round
    bogies(g, L);
    g.fillStyle = '#2b2b2b'; rp(g, -L / 2, -HW, L, W, 2); g.fill();
    // frame and walkway
    g.fillStyle = shade(o.c1, -10); rp(g, -L / 2 + 1, -HW + 0.8, L - 2, W - 1.6, 1.5); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = -L / 2 + 4; x < L / 2 - 2; x += 2.4) g.fillRect(x, -HW + 1.2, 0.8, 1.4), g.fillRect(x, HW - 2.6, 0.8, 1.4);
    // hood, rounded, with a radiator grille at the nose and a louvred engine bay
    g.fillStyle = o.c1; rp(g, -L / 2 + 13, -5, L - 16, 10, 3); g.fill();
    g.fillStyle = sheen(g, -5, 5); rp(g, -L / 2 + 13, -5, L - 16, 10, 3); g.fill();
    g.fillStyle = 'rgba(0,0,0,.22)'; for (let x = -L / 2 + 17; x < L / 2 - 10; x += 2.2) g.fillRect(x, -3.6, 0.9, 7.2);
    g.fillStyle = '#2c2f33'; rp(g, L / 2 - 7.5, -3.6, 3.2, 7.2, 1); g.fill();
    g.fillStyle = '#9aa0a6'; for (let y = -3; y < 3.3; y += 1.3) g.fillRect(L / 2 - 7.2, y, 2.6, 0.5);
    // exhaust stack and fan
    dot(g, -L / 2 + 20, 0, 2.6, '#1b1b1b'); dot(g, -L / 2 + 20, 0, 1.6, '#3b3f44');
    dot(g, L / 2 - 14, 0, 2.2, '#1b1b1b'); g.strokeStyle = '#555a60'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(L / 2 - 16, 0); g.lineTo(L / 2 - 12, 0); g.moveTo(L / 2 - 14, -2); g.lineTo(L / 2 - 14, 2); g.stroke();
    // cab: tall box with a roof vent, windows all round
    g.fillStyle = shade(o.c1, -55); rp(g, -L / 2 + 2, -7, 12, 14, 2); g.fill();
    g.fillStyle = o.c1; rp(g, -L / 2 + 2.6, -6.3, 10.8, 12.6, 1.6); g.fill();
    g.fillStyle = sheen(g, -6.3, 6.3); rp(g, -L / 2 + 2.6, -6.3, 10.8, 12.6, 1.6); g.fill();
    glass(g, -L / 2 + 4, -6, 8, 1.6); glass(g, -L / 2 + 4, 4.4, 8, 1.6);
    glass(g, -L / 2 + 12.4, -4.5, 1.4, 9); glass(g, -L / 2 + 2.6, -4.5, 1.2, 9);
    g.fillStyle = 'rgba(255,255,255,.25)'; rp(g, -L / 2 + 5.5, -2.2, 5, 4.4, 1); g.fill();
    // hazard stripes on the ends
    for (const ex of [L / 2 - 2.6, -L / 2 + 0.2]) {
      g.fillStyle = '#f4d03f'; g.fillRect(ex, -HW + 1, 2.4, W - 2);
      g.fillStyle = '#1b1b1b'; for (let y = -HW + 2; y < HW - 1; y += 3.2) g.fillRect(ex, y, 2.4, 1.4);
    }
    handrails(g, -L / 2 + 14, L / 2 - 3, 'rgba(255,255,255,.45)');
    dot(g, L / 2 - 1, 0, 1.6, '#fff4c2'); dot(g, -L / 2 + 1, 0, 1.2, '#fff4c2');
    outline(g, -L / 2, -HW, L, W, 2);
  },
  steam: (g, L, o) => {   // a 2-6-0: cowcatcher, boiler with stack and domes, cab at the back
    g.fillStyle = '#5c6067'; g.beginPath(); g.moveTo(L / 2 + 5, 0); g.lineTo(L / 2 - 1, -7); g.lineTo(L / 2 - 1, 7); g.closePath(); g.fill();
    g.fillStyle = o.c2; rp(g, -L / 2, -HW, L - 1, W, 2); g.fill();
    const bo = g.createLinearGradient(0, -6, 0, 6);
    bo.addColorStop(0, '#2b2e34'); bo.addColorStop(0.3, '#8b9199'); bo.addColorStop(0.55, '#26282d'); bo.addColorStop(1, '#0d0e10');
    g.fillStyle = bo; rp(g, -L / 2 + 11, -6, L - 12, 12, 6); g.fill();
    dot(g, L / 2 - 9, 0, 3.4, '#3a3a3a'); dot(g, L / 2 - 9, 0, 2.2, '#050505');
    dot(g, L / 2 - 19, 0, 2.8, '#c9a43a'); dot(g, L / 2 - 19.6, -0.8, 1, '#f3d97a');
    dot(g, L / 2 - 27, 0, 3, '#30333a');
    g.fillStyle = '#17181c'; rp(g, -L / 2, -HW - 0.5, 12, W + 1, 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-L / 2 + 1, -HW + 0.5, 10, 2);
    dot(g, L / 2 - 1.5, 0, 1.6, '#fff4c2');
  },
  tender: (g, L, o) => {   // coal tender
    g.fillStyle = '#1d1e22'; rp(g, -L / 2, -HW, L, W, 2); g.fill();
    g.fillStyle = '#0b0b0c'; rp(g, -L / 2 + 9, -6, L - 11, 12, 3); g.fill();
    for (let i = 0; i < 26; i++) dot(g, o.rng.range(-L / 2 + 10, L / 2 - 3), o.rng.range(-5, 5), o.rng.range(0.8, 1.6), o.rng.pick(['#2a2a2c', '#3b3b3e', '#1a1a1c']));
    dot(g, -L / 2 + 4.5, 0, 2.6, '#2e2f34');
  },
  diesel: (g, L, o) => {   // road diesel: long hood, cab near the front
    bogies(g, L);
    g.fillStyle = o.c1; rp(g, -L / 2, -HW, L, W, 3); g.fill();
    g.fillStyle = sheen(g, -HW, HW); rp(g, -L / 2, -HW, L, W, 3); g.fill();
    g.fillStyle = o.c2; g.fillRect(-L / 2 + 2, -HW + 0.5, L - 4, 1.6); g.fillRect(-L / 2 + 2, HW - 2.1, L - 4, 1.6);
    g.fillStyle = 'rgba(0,0,0,.22)'; rp(g, -L / 2 + 3, -5, L - 18, 10, 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = -L / 2 + 5; x < L / 2 - 16; x += 2.2) g.fillRect(x, -3.8, 0.8, 7.6);
    [-L / 2 + 9, -L / 2 + 19].forEach(fx => {
      dot(g, fx, 0, 3.6, '#2c2f33'); dot(g, fx, 0, 2.8, '#44484e');
      g.strokeStyle = '#7d8289'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(fx - 3, 0); g.lineTo(fx + 3, 0); g.moveTo(fx, -3); g.lineTo(fx, 3); g.moveTo(fx - 2.1, -2.1); g.lineTo(fx + 2.1, 2.1); g.moveTo(fx + 2.1, -2.1); g.lineTo(fx - 2.1, 2.1); g.stroke();
    });
    g.fillStyle = '#222'; rp(g, -L / 2 + 28, -1.8, 5, 3.6, 1); g.fill();
    // cab with windscreen and side windows
    g.fillStyle = shade(o.c1, -35); rp(g, L / 2 - 16, -7.2, 12, 14.4, 2); g.fill();
    glass(g, L / 2 - 14, -6.6, 8, 1.6); glass(g, L / 2 - 14, 5, 8, 1.6);
    glass(g, L / 2 - 5, -5, 1.6, 10);
    g.fillStyle = 'rgba(255,255,255,.2)'; rp(g, L / 2 - 13, -2.5, 6, 5, 1); g.fill();
    // nose
    g.fillStyle = shade(o.c1, 10); rp(g, L / 2 - 4.5, -6, 4.5, 12, 2); g.fill();
    g.fillStyle = o.c2; g.fillRect(L / 2 - 3.5, -6, 1, 12);
    handrails(g, -L / 2 + 3, L / 2 - 17);
    dot(g, L / 2 - 0.8, -2, 1.3, '#fff4c2'); dot(g, L / 2 - 0.8, 2, 1.3, '#fff4c2');
    outline(g, -L / 2, -HW, L, W, 3);
  },
  coach: (g, L, o) => {   // a passenger coach from above: a rounded roof with vents, a strip of windows along each side
    bogies(g, L);
    const body = o.rng.pick(['#7a2e2e', '#2f5d3a', '#24476b', '#8c5a1e']);
    g.fillStyle = '#efe6d2'; rp(g, -L / 2, -HW, L, W, 3); g.fill();                        // cream sides
    g.fillStyle = '#2b3a45'; for (const y of [-HW + 0.6, HW - 2.4]) for (let x = -L / 2 + 4; x < L / 2 - 6; x += 5) g.fillRect(x, y, 3.6, 1.8);   // windows
    g.fillStyle = body; rp(g, -L / 2 + 0.8, -HW + 2.6, L - 1.6, W - 5.2, 3); g.fill();        // the roof
    g.fillStyle = sheen(g, -HW + 2.6, HW - 2.6); rp(g, -L / 2 + 0.8, -HW + 2.6, L - 1.6, W - 5.2, 3); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-L / 2 + 3, -1.6, L - 6, 0.8);
    g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = -L / 2 + 8; x < L / 2 - 6; x += 9) { g.beginPath(); g.arc(x, 0.6, 1.1, 0, 7); g.fill(); }   // roof vents
    g.fillStyle = '#3b3530'; g.fillRect(-L / 2 - 0.5, -3, 1.6, 6); g.fillRect(L / 2 - 1.1, -3, 1.6, 6);                                      // gangways
  },
  box: (g, L, o) => {
    bogies(g, L);
    g.fillStyle = o.col; rp(g, -L / 2, -HW, L, W, 1.5); g.fill();
    g.fillStyle = sheen(g, -HW, HW); rp(g, -L / 2, -HW, L, W, 1.5); g.fill();
    ribs(g, L, 4, 0.16);
    // roof walk and the centre seam
    g.fillStyle = 'rgba(30,24,20,.5)'; g.fillRect(-L / 2 + 1, -1.1, L - 2, 2.2);
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(-L / 2 + 1, -1.1, L - 2, 0.6);
    // door hatch in the middle of the roof, a brake wheel at one end
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-4, -HW + 1, 8, W - 2);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-4, -HW + 1, 8, 0.8);
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 0.6; g.beginPath(); g.arc(-L / 2 + 2.6, 0, 1.6, 0, 7); g.stroke();
    outline(g, -L / 2, -HW, L, W, 1.5);
  },
  grain: (g, L, o) => {   // covered hopper: rounded roof, a row of hatches, bay outlines below
    bogies(g, L);
    g.fillStyle = shade(o.col, -20); rp(g, -L / 2, -HW, L, W, 3); g.fill();
    g.fillStyle = o.col; rp(g, -L / 2 + 1, -HW + 1, L - 2, W - 2, 2.5); g.fill();
    g.fillStyle = sheen(g, -HW, HW); rp(g, -L / 2, -HW, L, W, 3); g.fill();
    ribs(g, L, 4, 0.1);
    g.fillStyle = 'rgba(0,0,0,.14)'; for (let i = 1; i < 3; i++) g.fillRect(-L / 2 + i * (L / 3) - 0.5, -HW + 1, 1, W - 2);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(-L / 2 + 2, -0.7, L - 4, 1.4);
    for (let i = 0; i < 6; i++) {
      const x = -L / 2 + 3.5 + i * ((L - 7) / 6) + ((L - 7) / 6 - 4) / 2;
      g.fillStyle = shade(o.col, -45); rp(g, x, -2.6, 4, 5.2, 1); g.fill();
      g.fillStyle = o.cargo ? '#e2b84a' : shade(o.col, -10); rp(g, x + 0.8, -1.8, 2.4, 3.6, 0.8); g.fill();
    }
    outline(g, -L / 2, -HW, L, W, 3);
  },
  gondola: (g, L, o) => {   // ballast hopper: carries gravel or rubble
    bogies(g, L);
    g.fillStyle = o.col; rp(g, -L / 2, -HW, L, W, 1.5); g.fill();
    g.fillStyle = sheen(g, -HW, HW); rp(g, -L / 2, -HW, L, W, 1.5); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = -L / 2 + 5; x < L / 2 - 2; x += 5) g.fillRect(x, -HW, 1, W);
    g.fillStyle = '#161616'; g.fillRect(-L / 2 + 2, -6, L - 4, 12);
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(-L / 2 + 2, -6, L - 4, 1.2);
    if (o.cargo === 'gravel') {
      g.fillStyle = '#6e695f'; g.fillRect(-L / 2 + 2.5, -5.5, L - 5, 11);
      for (let i = 0; i < 80; i++) dot(g, o.rng.range(-L / 2 + 3, L / 2 - 3), o.rng.range(-5, 5), o.rng.range(0.7, 1.5), o.rng.pick(['#8d877d', '#a19a8f', '#6e695f', '#b5ada0', '#cfc8bb']));
    } else if (o.cargo === 'ore') {   // heaped iron ore: dark, rusty lumps
      g.fillStyle = '#3d2f2a'; g.fillRect(-L / 2 + 2.5, -5.5, L - 5, 11);
      for (let i = 0; i < 70; i++) dot(g, o.rng.range(-L / 2 + 3, L / 2 - 3), o.rng.range(-5, 5), o.rng.range(0.8, 1.8), o.rng.pick(['#6b4434', '#4a3a33', '#8a5a40', '#2f2724', '#a0694a']));
    } else if (o.cargo === 'rubble') {
      g.fillStyle = '#4f4840'; g.fillRect(-L / 2 + 2.5, -5.5, L - 5, 11);
      for (let i = 0; i < 26; i++) { g.save(); g.translate(o.rng.range(-L / 2 + 4, L / 2 - 4), o.rng.range(-4, 4)); g.rotate(o.rng.range(0, 3)); g.fillStyle = o.rng.pick(['#7d7366', '#5a5248', '#958a7a', '#a89d8b']); g.fillRect(-2.5, -1.8, 5, 3.6); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-2.5, -1.8, 5, 1); g.restore(); }
    } else { g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.beginPath(); for (let x = -L / 2 + 6; x < L / 2 - 3; x += 6) { g.moveTo(x, -5); g.lineTo(x, 5); } g.stroke(); }
    outline(g, -L / 2, -HW, L, W, 1.5);
  },
  tank: (g, L, o) => {
    bogies(g, L);
    g.fillStyle = '#2b2b2b'; g.fillRect(-L / 2, -HW + 2, L, W - 4);
    g.fillStyle = '#3a3a3a'; g.fillRect(-L / 2 + 6, -HW + 1, 4, W - 2); g.fillRect(L / 2 - 10, -HW + 1, 4, W - 2);   // saddles
    const tg = g.createLinearGradient(0, -7.5, 0, 7.5);
    tg.addColorStop(0, shade(o.col, 60)); tg.addColorStop(0.3, o.col); tg.addColorStop(0.7, shade(o.col, -25)); tg.addColorStop(1, shade(o.col, -80));
    g.fillStyle = tg; rp(g, -L / 2 + 1, -7.5, L - 2, 15, 7.5); g.fill();
    // weld seams and the walkway
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 0.6; g.beginPath(); for (const x of [-L / 4, L / 4]) { g.moveTo(x, -7); g.lineTo(x, 7); } g.stroke();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-L / 2 + 8, -1, L - 16, 2);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-L / 2 + 8, -1, L - 16, 0.6);
    dot(g, 0, 0, 3.4, shade(o.col, -35)); dot(g, 0, 0, 2.6, shade(o.col, 10)); dot(g, -0.7, -0.9, 1.2, shade(o.col, 80));
    if (o.cargo === 'fuel') { g.fillStyle = '#e67e22'; g.fillRect(-L / 2 + 11, -1.2, 5, 2.4); g.fillRect(L / 2 - 16, -1.2, 5, 2.4); }
    g.strokeStyle = 'rgba(20,16,12,.5)'; g.lineWidth = 0.8; rp(g, -L / 2 + 1, -7.5, L - 2, 15, 7.5); g.stroke();
  },
  logs: (g, L, o) => {
    bogies(g, L);
    deck(g, L);
    if (o.cargo) [-5, 0, 5].forEach(y => {
      const lg = g.createLinearGradient(0, y - 2.6, 0, y + 2.6); lg.addColorStop(0, '#c89a66'); lg.addColorStop(0.5, '#9a6a3c'); lg.addColorStop(1, '#5e3e22');
      const a = o.rng.range(0, 2.5), z = o.rng.range(0, 2.5);
      g.fillStyle = lg; rp(g, -L / 2 + 1 + a, y - 2.6, L - 2 - a - z, 5.2, 2.6); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-L / 2 + 4 + a, y + 0.5); g.lineTo(L / 2 - 4 - z, y - 0.3); g.stroke();
      dot(g, L / 2 - 1.8 - z, y, 1.9, '#e2bb8a'); dot(g, L / 2 - 1.8 - z, y, 1.1, '#c79a62'); dot(g, L / 2 - 1.8 - z, y, 0.4, '#8d6239');
    });
    g.fillStyle = '#222'; [-L / 2 + 3, 0, L / 2 - 3].forEach(x => { g.fillRect(x - 1, -HW - 0.5, 2, 2.4); g.fillRect(x - 1, HW - 1.9, 2, 2.4); });
    outline(g, -L / 2, -HW + 1, L, W - 2, 1);
  },
  lumber: (g, L, o) => {   // flat car with bundles of sawn timber
    bogies(g, L);
    deck(g, L);
    if (o.cargo) {
      for (const [x0, x1] of [[-L / 2 + 2, -1], [1, L / 2 - 2]]) {
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x0 + 1, -5.5, x1 - x0, 13);
        g.fillStyle = '#d9b27a'; g.fillRect(x0, -6.5, x1 - x0, 13);
        g.strokeStyle = 'rgba(120,80,40,.45)'; g.lineWidth = 0.5; g.beginPath();
        for (let y = -6.5 + 2.2; y < 6.5; y += 2.2) { g.moveTo(x0, y); g.lineTo(x1, y); } g.stroke();
        g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x0, -6.5, x1 - x0, 1.4);
        g.fillStyle = '#2c3e50'; g.fillRect(x0 + (x1 - x0) * 0.3, -7, 1.2, 14); g.fillRect(x0 + (x1 - x0) * 0.7, -7, 1.2, 14);
      }
    }
    g.fillStyle = '#222'; [-L / 2 + 1, L / 2 - 2.5].forEach(x => g.fillRect(x, -HW + 1, 1.5, W - 2));
    outline(g, -L / 2, -HW + 1, L, W - 2, 1);
  },
  container: (g, L, o) => {
    bogies(g, L);
    g.fillStyle = '#2f3237'; rp(g, -L / 2, -HW + 1, L, W - 2, 1); g.fill();
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(-L / 2, -HW + 1, L, 0.8);
    const box = (x: number, len: number, col: string) => {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 1, -6, len, 14);
      g.fillStyle = col; g.fillRect(x, -7, len, 14);
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 0.6; g.beginPath();
      for (let i = x + 2.5; i < x + len; i += 2.5) { g.moveTo(i, -7); g.lineTo(i, 7); }
      g.stroke(); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x, -7, len, 1.5);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + len - 1.4, -7, 1.4, 14);   // door end
      g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x + 1.5, -4.5, 3, 1.2);   // logo patch
    };
    if (!o.cargo) { g.fillStyle = '#1d1f23'; g.fillRect(-L / 2 + 3, -5, L - 6, 10); g.fillStyle = '#f4d03f'; for (const x of [-L / 2 + 4, L / 2 - 6, -3]) g.fillRect(x, -1, 2, 2); outline(g, -L / 2, -HW + 1, L, W - 2, 1); return; }
    const l = (L - 5) / 2; box(-L / 2 + 1.5, l, o.col); box(1, l, o.rng.pick(CONT_COLS));
  },
};

const cache = new Map<string, HTMLCanvasElement>();
export const SPRITE_SCALE = 5;
export function sprite(art: string, len: number, seed: number, cargo: CargoKind | null, colours?: { c1: string; c2: string }, body?: string) {
  const key = `${art}|${len}|${seed}|${cargo}|${colours?.c1 ?? ''}|${body ?? ''}`;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = (len + 14) * SPRITE_SCALE; c.height = 28 * SPRITE_SCALE;
  const g = c.getContext('2d')!;
  g.scale(SPRITE_SCALE, SPRITE_SCALE); g.translate((len + 14) / 2, 14);
  const rng = new Rng(seed);
  const col = art === 'box' ? rng.pick(BOX_COLS) : art === 'tank' ? rng.pick(['#e9ecef', '#4a4f56', '#b0bec5', '#2e5e8e', '#d9d2c3', '#8e3b2b'])
    : art === 'container' ? rng.pick(CONT_COLS) : art === 'gondola' ? rng.pick(['#3e4a3d', '#4a3b32', '#2c3e50', '#6b4a2f'])
    : art === 'grain' ? rng.pick(['#cfc8bb', '#b9c4cc', '#c9b99a', '#9fb3a3']) : '#888888';
  PAINTERS[art](g, len, { rng, cargo, c1: colours?.c1 ?? '#e0a526', c2: colours?.c2 ?? '#2b2b2b', col: body ?? col });
  // a bold cartoon outline round the body
  g.strokeStyle = 'rgba(22,16,10,.8)'; g.lineWidth = 1; rp(g, -len / 2, -HW, len, W, 2.5); g.stroke();
  cache.set(key, c);
  return c;
}

// ---- scenery pieces ----
// A tree seen from above: a long soft shadow to the south-east, a dark underside, a lumpy canopy made of a few
// overlapping lobes, lit from the north-west, with a highlight on the crown.
export function tree(g: G, x: number, y: number, r: number, col: string, conifer: boolean, snow = false, seed = 0) {
  // a long shadow cast to the south-east (the model's spotlight is up in the north-west)
  const sx = x + r * 0.8 + 4, sy = y + r * 0.95 + 5;
  g.fillStyle = 'rgba(20,30,10,.22)'; g.beginPath(); g.ellipse(sx, sy, r * 1.15, r * 0.82, 0.75, 0, 7); g.fill();
  g.fillStyle = 'rgba(20,30,10,.14)'; g.beginPath(); g.ellipse(sx - r * 0.3, sy - r * 0.35, r * 0.95, r * 0.7, 0.75, 0, 7); g.fill();
  // a crisp dark rim, like the edge of a foam clump
  g.fillStyle = 'rgba(18,28,12,.55)'; g.beginPath(); g.arc(x, y - 1, r + 1, 0, 7); g.fill();
  const h = (k: number) => { const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  if (conifer) {   // a pine from above: a dark skirt, whorls of branches radiating from the trunk, a lit crown
    dot(g, x, y - 1, r, shade(col, -42));
    const n = 7 + Math.floor(h(3) * 3), rot = h(4) * 6.28;
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * 6.283, d = r * 0.46, lx = x + Math.cos(a) * d, ly = y - 2 + Math.sin(a) * d;
      g.fillStyle = shade(col, -8 + Math.cos(a + 0.8) * -16); g.beginPath(); g.ellipse(lx, ly, r * 0.55, r * 0.24, a, 0, 7); g.fill();
    }
    for (let i = 0; i < n; i++) {
      const a = rot + 0.45 + (i / n) * 6.283, d = r * 0.26, lx = x + Math.cos(a) * d, ly = y - 2 + Math.sin(a) * d;
      g.fillStyle = shade(col, 14 + Math.cos(a + 0.8) * -12); g.beginPath(); g.ellipse(lx, ly, r * 0.36, r * 0.16, a, 0, 7); g.fill();
    }
    dot(g, x, y - 2, r * 0.2, shade(col, 48)); dot(g, x - r * 0.06, y - 2 - r * 0.08, r * 0.08, shade(col, 95));
  } else {
    dot(g, x, y - 1, r, shade(col, -45));
    const lobes = 4 + Math.floor(h(1) * 3);
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * 6.283 + h(2) * 6.283, d = r * 0.42, lr = r * (0.55 + h(10 + i) * 0.2);
      const lx = x + Math.cos(a) * d, ly = y - 2 + Math.sin(a) * d;
      dot(g, lx, ly, lr, shade(col, -15 + Math.cos(a + 0.8) * -18));
    }
    const gr = g.createRadialGradient(x - r * 0.35, y - 2 - r * 0.4, r * 0.05, x, y - 2, r * 0.9);
    gr.addColorStop(0, shade(col, 55)); gr.addColorStop(0.6, shade(col, 10)); gr.addColorStop(1, shade(col, -22));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y - 2, r * 0.78, 0, 7); g.fill();
    dot(g, x - r * 0.3, y - 2 - r * 0.32, r * 0.22, 'rgba(255,255,230,.22)');
  }
  if (snow) for (let i = 0; i < 4; i++) dot(g, x + (i - 1.5) * r * 0.25, y - 4 + ((i * 7) % 5 - 2) * r * 0.12, r * 0.18, 'rgba(255,255,255,.88)');
}
// A flat-roofed building seen from the north-west: the roof on top, the sunlit south wall below it, a darker east
// wall, and a long shadow. `h` is the building's height in units.
export function rock(g: G, x: number, y: number, r: number, ang = 0.4) {
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + r * 0.3, y + r * 0.35, r * 1.05, r * 0.8, ang, 0, 7); g.fill();
  g.fillStyle = '#6f665a'; g.beginPath(); g.ellipse(x, y, r, r * 0.82, ang, 0, 7); g.fill();
  g.fillStyle = '#8a8070'; g.beginPath(); g.ellipse(x - r * 0.1, y - r * 0.15, r * 0.8, r * 0.6, ang, 0, 7); g.fill();
  dot(g, x - r * 0.35, y - r * 0.35, r * 0.32, '#a89d8b');
}
// A cartoon building seen from the south: a pitched roof (lit slope towards the sun, a darker slope beyond the
// ridge), a tall front wall with rows of windows and a door, a darker east side, a long shadow and a bold outline.
export function box3d(g: G, x: number, y: number, w: number, d: number, h: number, roof: string, wall: string, windows = true) {
  const ink = 'rgba(28,20,14,.8)';
  // shadow to the south-east
  g.fillStyle = 'rgba(20,25,10,.26)'; g.beginPath(); g.moveTo(x + 3, y - h + d + 3); g.lineTo(x + w + h * 0.7, y - h + d + 3); g.lineTo(x + w + h * 0.7, y + d + h * 0.45); g.lineTo(x + 3, y + d + h * 0.45); g.closePath(); g.fill();
  // east wall (in shade)
  g.fillStyle = shade(wall, -60); g.beginPath(); g.moveTo(x + w, y - h + d * 0.5); g.lineTo(x + w + h * 0.3, y - h + d * 0.5 + h * 0.3); g.lineTo(x + w + h * 0.3, y + d + h * 0.3 - h * 0.05); g.lineTo(x + w, y + d); g.closePath(); g.fill();
  // front (south) wall: a lit face with a darker plinth
  g.fillStyle = wall; g.fillRect(x, y - h + d, w, h);
  g.fillStyle = shade(wall, -30); g.fillRect(x, y + d - 2.2, w, 2.2);
  if (windows && h >= 8 && w >= 20) {
    const floors = Math.max(1, Math.min(3, Math.floor(h / 8))), n = Math.max(1, Math.floor((w - 8) / 12)), door = Math.floor(n / 2);
    for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
      const wx = x + 5 + i * ((w - 10) / n) + ((w - 10) / n - 5) / 2, wy = y - h + d + 2 + f * (h - 3) / floors;
      if (f === floors - 1 && i === door) {   // a door on the ground floor
        g.fillStyle = shade(roof, -40); g.fillRect(wx - 0.5, y + d - 2.2 - Math.min(7, h * 0.7), 6, Math.min(7, h * 0.7)); continue;
      }
      g.fillStyle = '#3d6a8a'; g.fillRect(wx, wy, 5, Math.max(2.5, (h - 3) / floors - 3));
      g.fillStyle = 'rgba(200,235,255,.55)'; g.fillRect(wx, wy, 2, Math.max(2.5, (h - 3) / floors - 3));
    }
  }
  // the roof: two slopes meeting at the ridge, with overhanging eaves
  const ridge = y - h + d * 0.45;
  g.fillStyle = shade(roof, 26); g.fillRect(x - 1.5, y - h - 1, w + 3, ridge - (y - h) + 1);
  g.fillStyle = shade(roof, -18); g.fillRect(x - 1.5, ridge, w + 3, y - h + d - ridge + 1.5);
  g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x - 1.5, y - h - 1, w + 3, 1.4);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 1.5, ridge - 0.6, w + 3, 1.2);
  g.fillStyle = 'rgba(0,0,0,.2)'; for (let k = x + 6; k < x + w; k += 6) g.fillRect(k, ridge + 1, 0.8, y - h + d - ridge - 1);   // roof tiles
  // bold outline round the whole thing
  g.strokeStyle = ink; g.lineWidth = 1.2; g.lineJoin = 'round';
  g.strokeRect(x - 1.5, y - h - 1, w + 3, d + 2.5); g.strokeRect(x, y - h + d + 1.5, w, h - 1.5);
}
