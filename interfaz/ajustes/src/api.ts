// Puente con Python (jarvis/control.py → class Api). Fuera de pywebview (npm run dev)
// se usa un simulador con datos de ejemplo para poder diseñar sin la app.

export type Env = {
  assistantName: string; wakeWord: string; userName: string; persona: string; brain: string;
  voice: string; rate: number; pitch: number; whisper: string; lang: string; sens: number;
  city: string; lat: string; lon: string; spId: string; spSecret: string;
};
export type Orb = {
  palette: string; size: number; count: number; speed: number; glow: number; turb: number;
  corner: string; sound: boolean; dblclick: boolean; drag: boolean;
};
export type SiteGroup = { g: string; items: string[] };
export type Perm = 'granted' | 'pending' | 'denied' | 'unknown';
export type Usage = { key: string; label: string; pct: number | null; resetsAt: number | null; status?: string };
export type Activity = { ts: number; you: string; reply: string; tools: string[]; ok: boolean };
export type Status = {
  service: { running: boolean; restarting: boolean; since: number | null; autostart: boolean;
    brain: string | null; model?: string; error?: string | null };
  perms: { mic: Perm; acc: Perm; auto: Perm };
  usage: Usage[];
  last: Activity | null;
};
export type Config = { env: Env; orb: Orb; sites: SiteGroup[]; theme: string; version: string };
export type UrlTest = { state: 'empty' | 'invalid' | 'https' | 'ok' | 'blocked'; rule?: string; host?: string };

export interface Api {
  get_config(): Promise<Config>;
  save_env(env: Env): Promise<{ ok: boolean; error?: string; env?: Env }>;
  save_orb(orb: Orb): Promise<Orb>;
  save_theme(mode: string): Promise<string>;
  save_sites(groups: SiteGroup[]): Promise<SiteGroup[]>;
  test_url(url: string): Promise<UrlTest>;
  get_status(): Promise<Status>;
  get_activity(limit: number): Promise<{ items: Activity[]; days: { day: number; date: string; count: number }[] }>;
  get_searches(): Promise<{ when: string; q: string }[]>;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  restart(): Promise<boolean>;
  set_autostart(on: boolean): Promise<boolean>;
  open_log(): Promise<boolean>;
  open_privacy_pane(name: string): Promise<boolean>;
  preview_orb(state: string | null): Promise<boolean>;
  test_voice(voice: string, rate: number, pitch: number): Promise<{ ok: boolean; error?: string }>;
  mic_start(): Promise<boolean>;
  mic_level(): Promise<{ level: number; noise: number; live: boolean }>;
  mic_stop(): Promise<boolean>;
}

declare global {
  interface Window {
    pywebview?: { api: Api };
    jarvisAjustes?: { refresh: () => void };
  }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function simulador(): Api {
  const now = Date.now() / 1000;
  let running = true, autostart = true;
  let sites: SiteGroup[] = [
    { g: 'Enciclopedia', items: ['wikipedia.org', 'wikidata.org'] },
    { g: 'Gobierno e instituciones', items: ['*.gov.co', '*.gov', '*.gob.mx', '*.gob.es', '*.edu', 'un.org', 'who.int', 'dane.gov.co'] },
    { g: 'Clima', items: ['open-meteo.com'] },
    { g: 'Ayuda oficial de productos', items: ['support.apple.com', 'support.google.com', 'capcut.com'] },
  ];
  const acts: Activity[] = [
    { ts: now - 720, you: '¿Qué tiempo hará mañana?', reply: 'Mañana en Armenia, 24 grados con 60 % de probabilidad de lluvia. Yo llevaría paraguas.', tools: ['clima'], ok: true },
    { ts: now - 2300, you: 'Pon algo de Soda Stereo', reply: 'Reproduciendo Soda Stereo. Excelente elección, si me permite.', tools: ['spotify_reproducir'], ok: true },
    { ts: now - 90000, you: '¿Quién pintó La Gioconda?', reply: 'Leonardo da Vinci, según Wikipedia.', tools: ['buscar_wikipedia'], ok: true },
  ];
  const match = (host: string) => {
    for (const g of sites) for (const r of g.items)
      if (r.startsWith('*.') ? host.endsWith(r.slice(1)) : host === r || host.endsWith('.' + r)) return r;
    return undefined;
  };
  return {
    async get_config() {
      return {
        env: { assistantName: 'Jarvis', wakeWord: 'Raphael', userName: '', persona: 'britanico', brain: 'haiku', voice: 'es-CO-GonzaloNeural', rate: 5, pitch: -4, whisper: 'small', lang: 'es', sens: 2.5, city: 'Armenia, Quindío', lat: '4.5339', lon: '-75.6811', spId: '', spSecret: '' },
        orb: { palette: 'dorado', size: 1, count: 1600, speed: 1, glow: 1, turb: 1, corner: 'tr', sound: true, dblclick: true, drag: true },
        sites, theme: 'oscuro', version: '1.0',
      };
    },
    async save_env(env) { return { ok: true, env }; },
    async save_orb(orb) { return orb; },
    async save_theme(m) { return m; },
    async save_sites(g) { sites = g; return g; },
    async test_url(url) {
      const u = url.trim(); if (!u) return { state: 'empty' };
      try {
        const p = new URL(u.includes('://') ? u : 'https://' + u);
        if (p.protocol !== 'https:') return { state: 'https' };
        const rule = match(p.hostname);
        return rule ? { state: 'ok', rule, host: p.hostname } : { state: 'blocked', host: p.hostname };
      } catch { return { state: 'invalid' }; }
    },
    async get_status() {
      return {
        service: { running, restarting: false, since: running ? now - 7200 : null, autostart, brain: running ? 'ok' : null },
        perms: { mic: 'granted', acc: 'pending', auto: 'granted' },
        usage: [{ key: 'five_hour', label: 'Últimas 5 h', pct: 19, resetsAt: now + 8040 }, { key: 'seven_day', label: 'Últimos 7 días', pct: 30, resetsAt: now + 3 * 86400 }],
        last: acts[0],
      };
    },
    async get_activity() {
      const days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(Date.now() - (13 - i) * 86400000);
        return { day: d.getDate(), date: d.toISOString().slice(0, 10), count: [6, 9, 4, 11, 8, 3, 2, 12, 15, 9, 7, 10, 13, 5][i] };
      });
      return { items: acts, days };
    },
    async get_searches() { return [{ when: '2026-11-09 10:42', q: 'tasa de cambio dólar peso colombiano banrep' }]; },
    async start() { running = true; return true; },
    async stop() { running = false; return true; },
    async restart() { await wait(1500); running = true; return true; },
    async set_autostart(on) { autostart = on; return on; },
    async open_log() { return true; },
    async open_privacy_pane() { return true; },
    async preview_orb() { return true; },
    async test_voice() { await wait(2800); return { ok: true }; },
    async mic_start() { return true; },
    async mic_level() {
      const t = Date.now() / 1000, burst = Math.max(0, Math.sin(t * 0.9) * Math.sin(t * 2.3));
      return { level: 250 + Math.random() * 200 + burst * (1400 + Math.random() * 1800), noise: 220, live: true };
    },
    async mic_stop() { return true; },
  };
}

let cached: Api | null = null;
/** true dentro de la app (pywebview); false con el simulador del navegador. */
export let inApp = false;

/** Espera a que pywebview inyecte la API COMPLETA (primero aparece el objeto
 *  vacío y después sus métodos). Fuera de la app usa el simulador. */
export function getApi(): Promise<Api> {
  if (cached) return Promise.resolve(cached);
  const lista = () => typeof window.pywebview?.api?.get_config === 'function';
  return new Promise(resolve => {
    const t0 = Date.now();
    const check = () => {
      if (lista()) { cached = window.pywebview!.api; inApp = true; return resolve(cached); }
      // sin rastro de pywebview tras 1,5 s → navegador normal (npm run dev)
      if (!window.pywebview && Date.now() - t0 > 1500) { cached = simulador(); return resolve(cached); }
      setTimeout(check, 50);
    };
    window.addEventListener('pywebviewready', check);
    check();
  });
}
