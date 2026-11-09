import { useEffect, useRef } from 'react';
import { inApp, type Orb } from './api';
import { DONE_C, ERR_C, PALETTES, rgb } from './theme';

// ---------------------------------------------------------------------------
// Motor 2D (referencia del prototipo): esfera de Fibonacci con rotación,
// inclinación, perspectiva, ruido senoidal y mezcla aditiva. Se usa para la
// mini esfera de la barra lateral y como respaldo fuera de la app.
// ---------------------------------------------------------------------------

const ST: Record<string, Record<string, number>> = {
  idle: { sp: .25, tb: .05, gl: .8, sc: 1, re: 0, sw: 0, pu: 0, ji: 0 },
  listening: { sp: .35, tb: .06, gl: 1.15, sc: .84, re: .16, sw: 0, pu: 0, ji: 0 },
  thinking: { sp: 1.5, tb: .16, gl: 1, sc: .94, re: 0, sw: 1, pu: 1, ji: 0 },
  speaking: { sp: .45, tb: .09, gl: 1.05, sc: 1, re: .26, sw: 0, pu: 0, ji: 0 },
  done: { sp: .35, tb: .05, gl: 1.35, sc: 1.02, re: 0, sw: 0, pu: 0, ji: 0 },
  error: { sp: .3, tb: .12, gl: .95, sc: .94, re: 0, sw: 0, pu: 0, ji: 1 },
};
type Part = { x: number; y: number; z: number; r: number; ph: number; k: number };

function makeParts(n: number): Part[] {
  const a: Part[] = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i;
    const rr = Math.random() < .78 ? .95 + Math.random() * .1 : .3 + Math.random() * .62;
    a.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, r: rr, ph: Math.random() * 6.283, k: Math.random() });
  }
  return a;
}
const mix = (a: number[], b: number[], f: number) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

class Engine {
  state = 'idle';
  orb: Orb = { palette: 'dorado', size: 1, count: 1600, speed: 1, glow: 1, turb: 1, corner: 'tr', sound: true, dblclick: true, drag: true };
  cur = { ...ST.idle };
  col = PALETTES.dorado.c.map(a => a.slice());
  rot = 0; amp = 0; last = 0; raf = 0;
  parts = makeParts(1600); partsN = 1600; partsMini = makeParts(420);
  canvases = new Map<HTMLCanvasElement, 'big' | 'mini'>();

  add(el: HTMLCanvasElement, kind: 'big' | 'mini') {
    this.canvases.set(el, kind);
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }
  remove(el: HTMLCanvasElement) { this.canvases.delete(el); }

  tick = (now: number) => {
    if (!this.canvases.size) { this.raf = 0; return; }
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(.05, (now - (this.last || now)) / 1000); this.last = now;
    const t = now / 1000, st = this.state, o = this.orb;
    if (this.partsN !== o.count) { this.parts = makeParts(o.count); this.partsN = o.count; }
    const s = ST[st] || ST.idle, k = Math.min(1, dt * 4);
    for (const key in s) (this.cur as Record<string, number>)[key] += (s[key] - (this.cur as Record<string, number>)[key]) * k;
    const pal = PALETTES[o.palette] || PALETTES.dorado;
    const tgt = st === 'done' ? (o.palette === 'azul' ? PALETTES.dorado.c : DONE_C) : st === 'error' ? ERR_C : pal.c;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) this.col[i][j] += (tgt[i][j] - this.col[i][j]) * k;
    this.rot += dt * this.cur.sp * o.speed * 1.2;
    let a = 0;
    if (st === 'speaking') a = Math.abs(Math.sin(t * 9.3) * Math.sin(t * 3.1 + 1)) * (.6 + .4 * Math.sin(t * 1.3));
    if (st === 'listening') a = .4 * Math.abs(Math.sin(t * 5.3) * Math.sin(t * 1.7));
    this.amp += (a - this.amp) * .25;
    for (const [el, kind] of this.canvases) {
      if (!el.isConnected) { this.canvases.delete(el); continue; }
      this.draw(el, kind, t);
    }
  };

  draw(el: HTMLCanvasElement, kind: 'big' | 'mini', t: number) {
    const S = el.clientWidth; if (!S) return;
    const dpr = window.devicePixelRatio || 1, W = Math.round(S * dpr);
    if (el.width !== W) { el.width = W; el.height = W; }
    const ctx = el.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, S, S);
    const o = this.orb, c = this.cur;
    const pulse = c.pu * (.5 + .5 * Math.sin(t * 6));
    const glow = c.gl * o.glow * (1 + pulse * .35);
    const R = S * .3 * c.sc * (kind === 'mini' ? 1 : o.size) * (1 + this.amp * c.re);
    let jx = 0, jy = 0;
    if (c.ji > .05 && Math.random() < .35) { jx = (Math.random() - .5) * S * .035 * c.ji; jy = (Math.random() - .5) * S * .035 * c.ji; }
    const cx = S / 2 + jx, cy = S / 2 + jy, [d, m, p] = this.col;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.9);
    g.addColorStop(0, rgb(m, .3 * glow)); g.addColorStop(.35, rgb(d, .14 * glow)); g.addColorStop(1, rgb(d, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const parts = kind === 'mini' ? this.partsMini : this.parts;
    const B = 8, paths: Path2D[] = []; for (let b = 0; b < B; b++) paths.push(new Path2D());
    const tb = c.tb * o.turb, tilt = .38, ct = Math.cos(tilt), stl = Math.sin(tilt);
    const ps = (S / 320) * (kind === 'mini' ? 2.2 : 1) * Math.sqrt(1600 / Math.max(400, parts.length));
    for (let i = 0; i < parts.length; i++) {
      const q = parts[i];
      const n = Math.sin(q.x * 3.1 + t * 1.4 + q.ph) * Math.cos(q.y * 2.7 - t * 1.1) * tb + Math.sin(q.z * 4 + t * 2.3) * tb * .5;
      const rr = q.r * (1 + n), x = q.x * rr, y = q.y * rr, z = q.z * rr;
      const an = this.rot + c.sw * (q.y * 1.6 * Math.sin(t * .9) + q.r * .8);
      const ca = Math.cos(an), sa = Math.sin(an);
      const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
      const y2 = y * ct - z1 * stl, z2 = y * stl + z1 * ct;
      const pr = 2.4 / (2.4 - z2), sx = cx + x1 * R * pr, sy = cy + y2 * R * pr;
      const dep = Math.max(0, Math.min(.999, (z2 + 1) / 2)), b = (dep * B) | 0;
      const sz = (.5 + 1.3 * dep) * ps * (.7 + q.k * .6);
      paths[b].moveTo(sx + sz, sy); paths[b].arc(sx, sy, sz, 0, 6.283);
    }
    for (let b = 0; b < B; b++) {
      const f = b / (B - 1), cc = f < .5 ? mix(d, m, f * 2) : mix(m, p, (f - .5) * 2);
      ctx.fillStyle = rgb(cc, Math.min(1, (.16 + .62 * f) * Math.min(1.3, glow)));
      ctx.fill(paths[b]);
    }
    if (this.state === 'done') {
      const ph = (t % 1.6) / 1.6;
      ctx.strokeStyle = rgb(p, (1 - ph) * .7); ctx.lineWidth = Math.max(1, S / 200);
      ctx.beginPath(); ctx.arc(cx, cy, R * (1 + ph * .9), 0, 6.283); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

export const engine = new Engine();

export function CanvasOrb({ size, kind, state, orb }: { size: number | string; kind: 'big' | 'mini'; state: string; orb: Orb }) {
  const ref = useRef<HTMLCanvasElement>(null);
  engine.state = state;
  engine.orb = orb;
  useEffect(() => {
    const el = ref.current!;
    engine.add(el, kind);
    return () => engine.remove(el);
  }, [kind]);
  return <canvas ref={ref} style={{ width: size, height: size, display: 'block', position: 'relative' }} />;
}

// ---------------------------------------------------------------------------
// Vista previa real: la misma esfera Three.js de la ventana flotante.
// ---------------------------------------------------------------------------


export function RealOrb({ state, orb, style }: { state: string; orb: Orb; style?: React.CSSProperties }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const latest = useRef({ state, orb });
  latest.current = { state, orb };

  const send = () => {
    const w = ref.current?.contentWindow;
    if (!w || !ready.current) return;
    w.postMessage({ type: 'config', config: latest.current.orb }, '*');
    w.postMessage({ type: 'state', state: latest.current.state }, '*');
  };
  useEffect(send, [state, orb]);

  return (
    <iframe ref={ref} title="Vista previa del orbe" src={`./orbe/index.html?embed=1&state=${state}`}
      onLoad={() => { ready.current = true; setTimeout(send, 50); }}
      // colorScheme 'light' = el de orbe/index.html: si no coinciden, WebKit pinta el iframe opaco
      style={{ border: 'none', background: 'transparent', colorScheme: 'light', display: 'block', position: 'relative', pointerEvents: 'none', ...style }} />
  );
}

/** El orbe grande: real dentro de la app, canvas en el navegador. */
export function StageOrb({ state, orb, size }: { state: string; orb: Orb; size: number | string }) {
  return inApp
    ? <RealOrb state={state} orb={orb} style={{ width: size, height: size }} />
    : <CanvasOrb size={size} kind="big" state={state} orb={orb} />;
}
