import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Api, Config, Env, Orb, SiteGroup, Status } from './api';
import { CanvasOrb } from './orb';
import { Actividad, Capacidades, Internet, Sistema } from './pagesB';
import { Identidad, Inicio, OrbePage, Voz } from './pagesA';
import { StoreCtx, type Page, type Store } from './store';
import { BLUE, GOLD, MONO, RED, SANS, makeTheme } from './theme';
import { Dot, Eyebrow, ThemeCtx } from './ui';

const ORB0: Orb = { palette: 'dorado', size: 1, count: 1600, speed: 1, glow: 1, turb: 1, corner: 'tr', sound: true, dblclick: true, drag: true };

export function App({ api, config }: { api: Api; config: Config }) {
  const [page, setPage] = useState<Page>('inicio');
  const [themeMode, setThemeMode] = useState(config.theme || 'oscuro');
  const [env, setEnvState] = useState<Env>(config.env);
  const [base, setBase] = useState<Env>(config.env);
  const [orb, setOrbState_] = useState<Orb>(config.orb);
  const [sites, setSites] = useState<SiteGroup[]>(config.sites);
  const [status, setStatus] = useState<Status | null>(null);
  const [orbState, setOrbStateRaw] = useState('idle');
  const [restarting, setRestarting] = useState(false);
  const [restartErr, setRestartErr] = useState('');
  const timers = useRef<number[]>([]);
  const pageRef = useRef(page); pageRef.current = page;

  // ---- tema ----
  const mq = useMemo(() => window.matchMedia?.('(prefers-color-scheme: light)'), []);
  const [, force] = useState(0);
  useEffect(() => {
    if (!mq) return;
    const h = () => force(x => x + 1);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [mq]);
  const light = themeMode === 'claro' || (themeMode === 'auto' && !!mq?.matches);
  const T = useMemo(() => makeTheme(light), [light]);
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--sf', T.sf); r.setProperty('--ln', T.ln); r.setProperty('--tx', T.tx); r.setProperty('--red', T.red);
    r.colorScheme = T.scheme;
    document.body.style.background = T.win;
  }, [T]);
  const pickTheme = (m: string) => { setThemeMode(m); api.save_theme(m); };

  // ---- estado (cada 5 s) ----
  const refreshStatus = useCallback(() => { api.get_status().then(setStatus).catch(() => {}); }, [api]);
  useEffect(() => {
    refreshStatus();
    const id = window.setInterval(() => { if (document.visibilityState !== 'hidden') refreshStatus(); }, 5000);
    window.jarvisAjustes = {
      refresh: () => {
        refreshStatus();
        api.get_config().then(c => { setSites(c.sites); setOrbState_(c.orb); });
      },
    };
    return () => window.clearInterval(id);
  }, [api, refreshStatus]);

  // ---- orbe: estado de la vista previa ----
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const setOrbState = (s: string) => {
    clearTimers();
    setOrbStateRaw(s);
    if (pageRef.current === 'orbe') api.preview_orb(s);
  };
  const simulate = () => {
    clearTimers();
    const seq: [string, number][] = [['listening', 0], ['thinking', 1800], ['speaking', 3500], ['done', 6400], ['idle', 7800]];
    seq.forEach(([s, ms]) => later(() => {
      setOrbStateRaw(s);
      // la esfera flotante real también lo enseña (y se esconde al acabar)
      api.preview_orb(s === 'idle' && pageRef.current !== 'orbe' ? null : s);
    }, ms));
  };
  const orbStateRef = useRef(orbState); orbStateRef.current = orbState;
  // En la página Orbe la esfera flotante real se queda visible como vista previa.
  useEffect(() => {
    if (page !== 'orbe') { api.preview_orb(null); return; }
    api.preview_orb(orbState);
    const id = window.setInterval(() => api.preview_orb(orbStateRef.current), 1200);
    return () => { window.clearInterval(id); api.preview_orb(null); };
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- orbe: ajustes (se guardan al instante) ----
  const saveOrbTimer = useRef(0);
  const persistOrb = (o: Orb) => {
    window.clearTimeout(saveOrbTimer.current);
    saveOrbTimer.current = window.setTimeout(() => api.save_orb(o), 150);
  };
  const setOrb: Store['setOrb'] = (k, v) => setOrbState_(o => { const n = { ...o, [k]: v }; persistOrb(n); return n; });
  const resetOrb = () => { setOrbState_(ORB0); persistOrb(ORB0); };

  // ---- .env (se aplica al reiniciar) ----
  const setEnv: Store['setEnv'] = (k, v) => setEnvState(e => ({ ...e, [k]: v }));
  const dirty = (Object.keys(env) as (keyof Env)[]).filter(k => env[k] !== base[k]).length;

  const restart = async () => {
    if (restarting) return;
    setRestartErr('');
    if (dirty) {
      const r = await api.save_env(env);
      if (!r.ok) { setRestartErr(r.error || 'No pude guardar los ajustes.'); return; }
      const saved = r.env || env;
      setEnvState(saved); setBase(saved);
    }
    clearTimers();
    setRestarting(true); setOrbStateRaw('thinking');
    try { await api.restart(); } finally {
      setRestarting(false); setOrbStateRaw('done');
      later(() => setOrbStateRaw('idle'), 1200);
      refreshStatus();
      later(refreshStatus, 2500);
    }
  };
  const toggleRunning = async () => {
    if (status?.service.running) { await api.stop(); setOrbStateRaw('idle'); } else await api.start();
    refreshStatus(); later(refreshStatus, 1500);
  };
  const setAutostart = async (on: boolean) => {
    await api.set_autostart(on);
    refreshStatus();
  };
  const saveSites = async (g: SiteGroup[]) => { setSites(g); setSites(await api.save_sites(g)); };

  const store: Store = {
    api, page, go: setPage, env, base, setEnv, orb, setOrb, resetOrb, sites, saveSites, status, refreshStatus,
    orbState, setOrbState, simulate, restarting, restart, toggleRunning, setAutostart, dirty, version: config.version,
  };

  // ---- barra lateral ----
  const perms = status?.perms;
  const permMissing = !!perms && (['mic', 'acc', 'auto'] as const).some(k => perms[k] === 'pending' || perms[k] === 'denied');
  const spMode = env.spId && env.spSecret ? 1 : perms?.acc === 'granted' ? 2 : 3;
  const svc = serviceInfo(status, restarting, T.acc);

  const nav = (list: [Page, string, boolean?][]) => list.map(([id, label, badge]) => {
    const a = page === id;
    return (
      <div key={id} onClick={() => setPage(id)} className={a ? '' : 'hov'}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
          background: a ? 'rgba(255,154,46,0.12)' : 'transparent', color: a ? T.acc : T.tx2, fontSize: 13 }}>
        <span>{label}</span>{badge && <Dot color={GOLD} />}
      </div>
    );
  });

  return (
    <ThemeCtx.Provider value={T}>
      <StoreCtx.Provider value={store}>
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: T.win, color: T.tx, fontFamily: SANS, fontSize: 13, colorScheme: T.scheme }}>
          {/* barra de título: los semáforos son los nativos de macOS */}
          <div className="pywebview-drag-region"
            style={{ height: 44, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 0 84px', borderBottom: `1px solid rgba(${T.ln},0.07)`, position: 'relative' }}>
            <div className="pywebview-drag-region" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 13, fontWeight: 600, color: T.tx2, whiteSpace: 'nowrap' }}>
              {env.assistantName || 'Jarvis'} — Ajustes
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, padding: 2, borderRadius: 7, background: `rgba(${T.sf},0.06)`, border: `1px solid rgba(${T.ln},0.1)`, position: 'relative' }}>
              {([['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Auto']] as const).map(([v, label]) => (
                <div key={v} onClick={() => pickTheme(v)}
                  style={{ padding: '3px 10px', borderRadius: 5, fontSize: 11.5, cursor: 'pointer', background: themeMode === v ? 'rgba(255,154,46,0.16)' : 'transparent', color: themeMode === v ? T.acc : T.tx3 }}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '224px minmax(0,1fr)' }}>
            <div style={{ borderRight: `1px solid rgba(${T.ln},0.07)`, background: `rgba(${T.sf},0.015)`, padding: '18px 12px', display: 'flex', flexDirection: 'column', gap: 22, overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px' }}>
                <div style={{ flex: 'none' }}><CanvasOrb size={38} kind="mini" state={orbState} orb={orb} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.assistantName || 'Jarvis'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', color: T.tx3 }}>
                    <Dot color={svc.dot} />{svc.label}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Eyebrow style={{ padding: '0 10px 6px' }}>ASISTENTE</Eyebrow>
                {nav([['inicio', 'Inicio'], ['orbe', 'Orbe'], ['identidad', 'Identidad'], ['voz', 'Voz y oído']])}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Eyebrow style={{ padding: '0 10px 6px' }}>CONTROL</Eyebrow>
                {nav([['capacidades', 'Capacidades', spMode === 3], ['internet', 'Internet'], ['actividad', 'Actividad'], ['sistema', 'Sistema', permMissing]])}
              </div>
              <div style={{ marginTop: 'auto', padding: '12px 10px 4px', borderTop: `1px solid rgba(${T.ln},0.07)`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Eyebrow spacing=".1em">AUDIO 100 % LOCAL</Eyebrow>
                <div style={{ fontSize: 11.5, lineHeight: 1.45, color: T.tx3 }}>Tu voz nunca sale del Mac. Solo el texto llega al cerebro.</div>
              </div>
            </div>

            <div style={{ position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '28px 32px 96px' }}>
                {page === 'inicio' && <Inicio />}
                {page === 'orbe' && <OrbePage />}
                {page === 'identidad' && <Identidad />}
                {page === 'voz' && <Voz />}
                {page === 'capacidades' && <Capacidades />}
                {page === 'internet' && <Internet />}
                {page === 'actividad' && <Actividad />}
                {page === 'sistema' && <Sistema />}
              </div>

              {(dirty > 0 || restarting || restartErr) && (
                <div style={{ position: 'absolute', left: 32, right: 32, bottom: 20, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 10px 10px 16px', borderRadius: 12, background: T.bar,
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,154,46,0.3)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', maxWidth: '100%' }}>
                    <Dot color={restartErr ? RED : GOLD} size={7} />
                    <div style={{ fontSize: 13, color: restartErr ? T.red : T.tx }}>
                      {restartErr || (restarting ? `Reiniciando ${env.assistantName}…` : `${dirty} ${dirty === 1 ? 'cambio se aplica' : 'cambios se aplican'} al reiniciar ${env.assistantName}`)}
                    </div>
                    <button className="btn-ghost" onClick={() => { setEnvState(base); setRestartErr(''); }}
                      style={{ background: 'transparent', color: T.tx3, border: 'none', padding: '6px 8px', font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>Descartar</button>
                    <button className="btn-primary" onClick={restart}
                      style={{ background: GOLD, color: '#1A0F04', border: 'none', borderRadius: 8, padding: '7px 12px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {restarting ? 'Reiniciando…' : 'Reiniciar ahora'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </StoreCtx.Provider>
    </ThemeCtx.Provider>
  );
}

export function serviceInfo(status: Status | null, restarting: boolean, pale: string) {
  const s = status?.service;
  if (restarting || s?.restarting) return { label: 'Reiniciando…', dot: pale, sub: 'Volverá en unos segundos', action: 'Detener', running: true };
  if (!s) return { label: 'Comprobando…', dot: pale, sub: '', action: 'Detener', running: false };
  if (s.running) {
    const since = s.since ? new Date(s.since * 1000) : null;
    const hh = since ? `${String(since.getHours()).padStart(2, '0')}:${String(since.getMinutes()).padStart(2, '0')}` : '';
    let sub = since ? `Activo desde las ${hh} · escuchando en segundo plano` : 'Escuchando en segundo plano';
    if (s.brain === 'arrancando') sub = 'Arrancando el cerebro…';
    if (s.brain === 'error') return { label: 'Con errores', dot: RED, sub: `El cerebro no arrancó: ${s.error || 'revisa Claude Code y tu sesión'}`, action: 'Detener', running: true };
    return { label: 'En marcha', dot: BLUE, sub, action: 'Detener', running: true };
  }
  return { label: 'Detenido', dot: RED, sub: s.autostart ? 'Hasta el próximo inicio de sesión' : 'Hasta que lo vuelvas a iniciar', action: 'Iniciar', running: false };
}
