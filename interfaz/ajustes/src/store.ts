import { createContext, useContext } from 'react';
import type { Api, Env, Orb, SiteGroup, Status } from './api';

export type Page = 'inicio' | 'orbe' | 'identidad' | 'voz' | 'capacidades' | 'internet' | 'actividad' | 'sistema';

export type Store = {
  api: Api;
  page: Page; go: (p: Page) => void;
  env: Env; base: Env; setEnv: <K extends keyof Env>(k: K, v: Env[K]) => void;
  orb: Orb; setOrb: <K extends keyof Orb>(k: K, v: Orb[K]) => void; resetOrb: () => void;
  sites: SiteGroup[]; saveSites: (g: SiteGroup[]) => Promise<void>;
  status: Status | null; refreshStatus: () => void;
  orbState: string; setOrbState: (s: string) => void; simulate: () => void;
  restarting: boolean; restart: () => void; toggleRunning: () => void; setAutostart: (on: boolean) => void;
  dirty: number; version: string;
};

export const StoreCtx = createContext<Store>(null as unknown as Store);
export const useStore = () => useContext(StoreCtx);

// ---- utilidades de texto ----

export function relTime(ts: number): string {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return 'AHORA';
  if (s < 3600) return `HACE ${Math.round(s / 60)} MIN`;
  if (s < 86400) return `HACE ${Math.round(s / 3600)} H`;
  return `HACE ${Math.round(s / 86400)} D`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const two = (n: number) => String(n).padStart(2, '0');

export function clock(ts: number): string {
  const d = new Date(ts * 1000);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

export function dayTime(ts: number): string {
  const d = new Date(ts * 1000), hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return clock(ts);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return `${two(d.getDate())} ${MESES[d.getMonth()]}`;
}

/** «2026-11-09 10:42» → «09 nov · 10:42» */
export function searchDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(s);
  return m ? `${m[3]} ${MESES[+m[2] - 1]} · ${m[4]}` : s;
}

export function resetIn(at: number | null): string {
  if (!at) return 'Sin datos todavía';
  const s = at - Date.now() / 1000;
  if (s <= 0) return 'Ventana reiniciada';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d >= 1) return `Se reinicia en ${d} ${d === 1 ? 'día' : 'días'}`;
  if (h >= 1) return `Se reinicia en ${h} h ${m} min`;
  return `Se reinicia en ${Math.max(1, m)} min`;
}

export function greeting(user: string, name: string): string {
  if (!user) return `${name} está listo`;
  const h = new Date().getHours();
  return `${h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${user}`;
}
