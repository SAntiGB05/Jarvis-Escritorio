import { useEffect, useState } from 'react';
import type { Activity, Metrics, UrlTest } from './api';
import { serviceInfo } from './App';
import { permView } from './pagesA';
import { dayTime, searchDate, useStore } from './store';
import { GOLD, MONO } from './theme';
import { Card, Dot, Eyebrow, PageHead, Pill, PrimaryBtn, SecondaryBtn, Toggle, inputStyle, useT } from './ui';

// ---------------------------------------------------------------------------
// Servicios conectados (Spotify y clima) — se muestran en Paquetes
// ---------------------------------------------------------------------------

export function Servicios() {
  const T = useT();
  const s = useStore();
  const { env, status } = s;
  const [showSecret, setShowSecret] = useState(false);
  const perms = status?.perms;
  const spMode = env.spId && env.spSecret ? 1 : perms?.acc === 'granted' ? 2 : 3;
  const modes: [number, string][] = [[1, 'Con API de Spotify: resultado exacto'], [2, 'Con Accesibilidad: pulsa «Reproducir» por ti'], [3, 'Solo abre la búsqueda; tú pulsas play']];
  const mono = inputStyle(T, true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Eyebrow>SERVICIOS CONECTADOS · SE APLICA AL REINICIAR</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Spotify</div><Pill ok={spMode < 3} okText="Disponible" noText="Limitado" />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: T.tx2 }}>«Pon Blinding Lights» · «Siguiente» · «¿Qué suena?»</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {modes.map(([n, label]) => (
              <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 10px', borderRadius: 7, background: n === spMode ? 'rgba(255,154,46,0.1)' : 'transparent' }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: n === spMode ? GOLD : T.tx5 }}>0{n}</div>
                <div style={{ fontSize: 12.5, color: n === spMode ? T.acc : T.tx4 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input className="field" value={env.spId} placeholder="Client ID (opcional)" spellCheck={false} onChange={e => s.setEnv('spId', e.target.value.trim())} style={mono} />
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="field" type={showSecret ? 'text' : 'password'} value={env.spSecret} placeholder="Client Secret" spellCheck={false} autoComplete="off"
                onChange={e => s.setEnv('spSecret', e.target.value.trim())} style={{ ...mono, flex: 1, minWidth: 0, width: 'auto' }} />
              <SecondaryBtn onClick={() => setShowSecret(x => !x)} style={{ padding: '0 10px', fontSize: 12 }}>{showSecret ? 'Ocultar' : 'Mostrar'}</SecondaryBtn>
            </div>
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Clima</div><Pill ok okText="Disponible" />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: T.tx2 }}>«¿Va a llover mañana?» · «¿Qué temperatura hace?»</div>
          <div style={{ fontSize: 12.5, color: T.tx3 }}>Actual y pronóstico de 3 días desde open-meteo.com, para una ubicación fija.</div>
          <input className="field" value={env.city} onChange={e => s.setEnv('city', e.target.value)} style={inputStyle(T, false, { fontSize: 13 })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="field" value={env.lat} title="Latitud" onChange={e => s.setEnv('lat', e.target.value.trim())} style={{ ...mono, color: T.tx2 }} />
            <input className="field" value={env.lon} title="Longitud" onChange={e => s.setEnv('lon', e.target.value.trim())} style={{ ...mono, color: T.tx2 }} />
          </div>
        </Card>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Internet
// ---------------------------------------------------------------------------

const DOMAIN_RE = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/;

// Punto 4: dominios donde terceros publican o reciben datos (canal de exfiltración).
const RIESGO: [RegExp, string][] = [
  [/(^|\.)(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|cutt\.ly|rebrand\.ly|shorturl\.at|lnkd\.in)$/, 'un acortador de enlaces'],
  [/(^|\.)(forms\.gle|docs\.google\.com|forms\.office\.com|typeform\.com|jotform\.com|surveymonkey\.com|tally\.so|formspree\.io)$/, 'un servicio de formularios'],
  [/(^|\.)(pastebin\.com|gist\.github\.com|githubusercontent\.com|hastebin\.com|ghostbin\.\w+|paste\.ee|dpaste\.\w+|rentry\.co|justpaste\.it|controlc\.com)$/, 'un sitio para pegar texto'],
  [/(^|\.)(webhook\.site|requestbin\.\w+|pipedream\.net|ngrok\.io|ngrok-free\.app|beeceptor\.com|hookbin\.com|trycloudflare\.com)$/, 'un receptor de peticiones'],
  [/(^|\.)(dropbox\.com|drive\.google\.com|wetransfer\.com|mega\.nz|file\.io|transfer\.sh)$/, 'un almacenamiento de archivos'],
];
const riesgo = (d: string) => RIESGO.find(([re]) => re.test(d.replace(/^\*\./, '')))?.[1];
const ABIERTOS = new Set(['*.com', '*.org', '*.net', '*.io', '*.co', '*.app', '*.dev']);

export function Internet() {
  const T = useT();
  const s = useStore();
  const [testUrl, setTestUrl] = useState('');
  const [res, setRes] = useState<UrlTest>({ state: 'empty' });
  const [newSite, setNewSite] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [searches, setSearches] = useState<{ when: string; q: string }[]>([]);

  useEffect(() => { s.api.get_searches().then(setSearches).catch(() => {}); }, [s.api]);
  useEffect(() => {
    const id = window.setTimeout(() => { s.api.test_url(testUrl).then(setRes).catch(() => {}); }, 150);
    return () => window.clearTimeout(id);
  }, [testUrl, s.sites, s.api]);

  const testView = {
    empty: { text: 'Escribe una dirección para comprobarla.', color: T.tx4 },
    invalid: { text: 'No parece una URL válida.', color: T.red },
    https: { text: 'Bloqueada · solo se permite HTTPS', color: T.red },
    ok: { text: `Permitida · coincide con ${res.rule}`, color: T.blue },
    blocked: { text: `Bloqueada · ${res.host} no está en la lista`, color: T.red },
  }[res.state];

  const addSite = async () => {
    const v = newSite.trim().toLowerCase();
    if (!v) return;
    if (!DOMAIN_RE.test(v) || (!v.startsWith('*.') && !v.includes('.'))) { setMsg({ ok: false, text: 'Formato no válido. Usa dominio.com o *.terminacion' }); return; }
    if (s.sites.some(g => g.items.includes(v))) { setMsg({ ok: false, text: 'Ese dominio ya está en la lista.' }); return; }
    const r = ABIERTOS.has(v) ? 'una terminación abierta a cualquiera' : riesgo(v);
    if (r && aviso !== v) {
      setAviso(v);
      setMsg({ ok: false, text: `Cuidado: «${v}» es ${r}. Ahí terceros publican o reciben datos y una página podría usarlo para sacar tu información. Pulsa Añadir otra vez para confirmar.` });
      return;
    }
    setAviso(null);
    const groups = s.sites.map(g => ({ ...g, items: [...g.items] }));
    let cg = groups.find(g => g.g === 'Personalizados');
    if (!cg) { cg = { g: 'Personalizados', items: [] }; groups.push(cg); }
    cg.items.push(v);
    await s.saveSites(groups);
    setNewSite('');
    setMsg({ ok: true, text: `Añadido «${v}». Ya está activo.` });
  };
  const remove = (g: string, d: string) => s.saveSites(s.sites.map(x => x.g === g ? { ...x, items: x.items.filter(i => i !== d) } : x));
  const mono = inputStyle(T, true, { flex: 1, minWidth: 0, width: 'auto' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
      <PageHead eyebrow="INTERNET · SE APLICA AL INSTANTE" title="Sitios permitidos"
        sub="Solo HTTPS. «dominio.com» incluye sus subdominios; «*.gov» cualquier dominio que termine así. Añade solo sitios de lectura: nunca acortadores, formularios ni sitios donde terceros publican texto." />

      <Card style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>PROBAR UNA URL</Eyebrow>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="field" value={testUrl} placeholder="https://www.dane.gov.co/…" spellCheck={false} onChange={e => setTestUrl(e.target.value)} style={mono} />
          </div>
          <div style={{ fontSize: 12, color: testView.color }}>{testView.text}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>AÑADIR DOMINIO</Eyebrow>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="field" value={newSite} placeholder="ejemplo.org o *.gob.ec" spellCheck={false}
              onChange={e => { setNewSite(e.target.value); setMsg(null); setAviso(null); }} onKeyDown={e => { if (e.key === 'Enter') addSite(); }} style={mono} />
            <PrimaryBtn onClick={addSite} style={{ padding: '0 14px', fontSize: 12.5 }}>Añadir</PrimaryBtn>
          </div>
          <div style={{ fontSize: 12, color: msg ? (msg.ok ? T.blue : T.red) : T.tx4 }}>{msg ? msg.text : 'Se guarda en sitios_permitidos.txt.'}</div>
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {s.sites.filter(g => g.items.length).map(g => (
          <div key={g.g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{g.g}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: T.tx4 }}>{g.items.length}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {g.items.map(d => (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px 5px 10px', borderRadius: 7, border: `1px solid rgba(${T.ln},0.1)`, background: `rgba(${T.sf},0.03)`, fontFamily: MONO, fontSize: 11.5, color: T.tx2 }}>
                  {d}
                  <div className="chip-x" title={`Quitar ${d}`} onClick={() => remove(g.g, d)}
                    style={{ width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tx4, cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>×</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Card style={{ padding: '6px 18px' }}>
        <Eyebrow style={{ padding: '12px 0 6px' }}>BÚSQUEDAS WEB RECIENTES</Eyebrow>
        {searches.length ? searches.map((x, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 12, padding: '10px 0', borderTop: `1px solid rgba(${T.ln},0.06)`, fontSize: 12.5 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: T.tx4 }}>{searchDate(x.when)}</div>
            <div style={{ color: T.tx2 }}>{x.q}</div>
          </div>
        )) : (
          <div style={{ padding: '10px 0 14px', borderTop: `1px solid rgba(${T.ln},0.06)`, fontSize: 12.5, color: T.tx3 }}>Todavía no ha hecho ninguna búsqueda web.</div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Actividad
// ---------------------------------------------------------------------------

const FASES: [string, string][] = [['whisper', 'Transcripción'], ['primer_token', 'Primer token'], ['claude_total', 'Claude total'],
  ['tts_primer_audio', 'Síntesis 1.ª frase'], ['primer_audio', 'Hasta oír la respuesta'], ['total', 'Respuesta rápida']];
const seg = (ms?: number) => ms === undefined ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;

export function Actividad() {
  const T = useT();
  const s = useStore();
  const [data, setData] = useState<{ items: Activity[]; days: { day: number; date: string; count: number }[] } | null>(null);
  const [met, setMet] = useState<Metrics | null>(null);
  const [borrar, setBorrar] = useState(false);
  const cargar = () => { s.api.get_activity(60).then(setData).catch(() => {}); s.api.get_metrics().then(setMet).catch(() => {}); };
  useEffect(cargar, [s.api, s.status?.last?.ts]); // eslint-disable-line react-hooks/exhaustive-deps
  const limpiar = async () => {
    if (!borrar) { setBorrar(true); window.setTimeout(() => setBorrar(false), 4000); return; }
    setBorrar(false); await s.api.clear_history(); cargar();
  };
  const days = data?.days || [];
  const mx = Math.max(1, ...days.map(d => d.count));
  const total = days.reduce((a, b) => a + b.count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
      <PageHead eyebrow="ACTIVIDAD" title="Conversaciones recientes"
        right={<SecondaryBtn onClick={limpiar} style={borrar ? { color: T.red, borderColor: 'rgba(255,74,61,0.4)' } : undefined}>{borrar ? '¿Seguro? Pulsa otra vez' : 'Borrar historial'}</SecondaryBtn>} />

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Eyebrow>LATENCIA MEDIA POR FASE · ÚLTIMAS 200</Eyebrow>
          {met && <div style={{ fontFamily: MONO, fontSize: 11, color: T.tx3 }}>{met.fast} de {met.count} sin Claude · {met.errors} con error</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
          {FASES.map(([k, label]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 9, background: `rgba(${T.sf},0.03)`, border: `1px solid rgba(${T.ln},0.06)` }}>
              <div style={{ fontSize: 11.5, color: T.tx3 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: k === 'primer_audio' ? T.acc : T.tx }}>{seg(met?.phases[k]?.avg)}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: T.tx4 }}>{met?.phases[k] ? `mediana ${seg(met.phases[k].p50)} · n=${met.phases[k].n}` : 'sin datos aún'}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>LO QUE {s.env.assistantName.toUpperCase()} NO PUDO HACER</Eyebrow>
        <div style={{ fontSize: 12, color: T.tx3 }}>Agrupado por motivo: te dice qué herramienta conviene construir a continuación.</div>
        {met && !met.unresolved.length && <div style={{ fontSize: 12.5, color: T.tx3, padding: '6px 0' }}>Nada por ahora.</div>}
        {met?.unresolved.map(u => (
          <div key={u.reason} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 80px', gap: 12, alignItems: 'baseline', padding: '9px 0', borderTop: `1px solid rgba(${T.ln},0.06)` }}>
            <div style={{ fontFamily: MONO, fontSize: 15, color: T.acc }}>{u.count}×</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 13 }}>{u.reason}</div>
              <div style={{ fontSize: 11.5, color: T.tx4 }}>{u.examples.map(e => `«${e}»`).join(' · ')}</div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: T.tx4, textAlign: 'right' }}>{dayTime(u.last)}</div>
          </div>
        ))}
      </Card>

      <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 13 }}>Conservar el historial</div>
          <div style={{ fontSize: 11.5, color: T.tx3 }}>Conversaciones, búsquedas y límites más antiguos se borran solos. 0 = sin límite. Se aplica al reiniciar.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input className="field" type="number" min={0} max={3650} value={s.env.retention}
            onChange={e => s.setEnv('retention', Math.max(0, Math.min(3650, Math.round(+e.target.value || 0))))} style={inputStyle(T, true, { width: 80 })} />
          <span style={{ fontSize: 12, color: T.tx3 }}>días</span>
        </div>
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>PETICIONES · ÚLTIMOS 14 DÍAS</Eyebrow>
          <div style={{ fontFamily: MONO, fontSize: 11, color: T.acc }}>{total} {total === 1 ? 'PETICIÓN' : 'PETICIONES'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14,minmax(0,1fr))', gap: 6, alignItems: 'end', height: 110 }}>
          {days.map((b, i) => {
            const today = i === days.length - 1;
            return (
              <div key={b.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <div title={`${b.count} ${b.count === 1 ? 'petición' : 'peticiones'}`}
                  style={{ width: '100%', maxWidth: 22, height: `${Math.max(b.count ? 4 : 2, Math.round((b.count / mx) * 86))}%`, borderRadius: '4px 4px 2px 2px', background: today ? GOLD : b.count ? 'rgba(255,154,46,0.32)' : `rgba(${T.sf},0.06)` }} />
                <div style={{ fontFamily: MONO, fontSize: 9.5, color: today ? T.acc : T.tx4 }}>{b.day}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {data && !data.items.length && (
          <div style={{ fontSize: 13, color: T.tx3, padding: '6px 0' }}>Todavía no hay conversaciones registradas. Aparecerán aquí en cuanto hables con {s.env.assistantName}.</div>
        )}
        {(data?.items || []).map((c, i) => (
          <div key={c.ts + ':' + i} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', gap: 16, padding: '14px 0', borderBottom: `1px solid rgba(${T.ln},0.07)` }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: T.tx4, paddingTop: 2 }}>{dayTime(c.ts)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 13.5, color: T.tx }}>{c.you}</div>
              <div style={{ fontSize: 13.5, color: c.ok ? T.acc : T.red }}>{c.reply}</div>
              {(c.tools.length > 0 || c.fast || c.unresolved || c.ms?.primer_audio) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {c.fast && <span style={{ fontFamily: MONO, fontSize: 10.5, padding: '2px 7px', borderRadius: 4, background: 'rgba(61,139,255,0.12)', color: T.blue }}>rápido · sin Claude</span>}
                  {c.unresolved && <span style={{ fontFamily: MONO, fontSize: 10.5, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,74,61,0.12)', color: T.red }}>no resuelto{c.reason ? ` · ${c.reason}` : ''}</span>}
                  {c.tools.map((t, j) => (
                    <span key={j} style={{ fontFamily: MONO, fontSize: 10.5, padding: '2px 7px', borderRadius: 4, background: `rgba(${T.sf},0.06)`, color: T.tx3 }}>{t}</span>
                  ))}
                  {!!c.ms?.primer_audio && <span style={{ fontFamily: MONO, fontSize: 10.5, padding: '2px 7px', color: T.tx4 }}>{seg(c.ms.primer_audio)} hasta oírlo</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Sistema
// ---------------------------------------------------------------------------

export function Sistema() {
  const T = useT();
  const s = useStore();
  const { status, env } = s;
  const svc = serviceInfo(status, s.restarting, T.acc);
  const w = env.wakeWord.trim();
  const detalle = status?.perms.autoDetail || [];
  const rows = [
    ['mic', 'Micrófono', `Para oír «${w}» y tus peticiones.`],
    ['acc', 'Accesibilidad', 'Para que Spotify reproduzca solo y para el brillo.'],
    ['auto', 'Automatización', `Para controlar ${detalle.length ? detalle.map(d => d.app).join(', ') : 'Spotify, Recordatorios y System Events'}.`],
    ...(status?.perms.screen ? [['screen', 'Grabación de pantalla', 'Para «¿Qué hay en mi pantalla?» (paquete Pantalla).']] : []),
  ] as [('mic' | 'acc' | 'auto' | 'screen'), string, string][];
  const open = (k: string) => {
    s.api.open_privacy_pane(k);
    window.setTimeout(s.refreshStatus, 1500);
    window.setTimeout(s.refreshStatus, 5000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
      <PageHead eyebrow="SISTEMA" title="Permisos y servicio" />

      <Card style={{ padding: '4px 18px' }}>
        {rows.map(([k, name, desc], i) => {
          const p = permView(status?.perms[k] || undefined, T);
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < rows.length - 1 ? `1px solid rgba(${T.ln},0.06)` : 'none' }}>
              <Dot color={p.dot} size={9} glow />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{name}</div>
                <div style={{ fontSize: 12, color: T.tx3 }}>{desc}</div>
                {k === 'auto' && detalle.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                    {detalle.map(d => <span key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.tx3 }}><Dot color={permView(d.state, T).dot} />{d.app}</span>)}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: p.color, whiteSpace: 'nowrap' }}>{p.text}</div>
              <SecondaryBtn small onClick={() => open(k)}>Abrir Ajustes</SecondaryBtn>
            </div>
          );
        })}
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Eyebrow>SERVICIO</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <PrimaryBtn onClick={s.toggleRunning}>{svc.action}</PrimaryBtn>
          <SecondaryBtn onClick={s.restart} style={{ padding: '8px 14px', fontSize: 13 }}>Reiniciar</SecondaryBtn>
          <SecondaryBtn onClick={() => s.api.open_log()} style={{ padding: '8px 14px', fontSize: 13 }}>Ver registro</SecondaryBtn>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.tx3, marginLeft: 4 }}><Dot color={svc.dot} />{svc.label}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 13 }}>Arrancar al iniciar sesión</div>
            <div style={{ fontSize: 11.5, color: T.tx3 }}>Si se cae, macOS lo vuelve a abrir solo.</div>
          </div>
          <Toggle on={!!status?.service.autostart} onClick={() => s.setAutostart(!status?.service.autostart)} />
        </div>
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Eyebrow>ACERCA DE</Eyebrow>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
          <span>{env.assistantName} de escritorio</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: T.tx3 }}>v{s.version} · macOS</span>
        </div>
        <div style={{ fontSize: 12.5, color: T.tx3, lineHeight: 1.5 }}>
          La palabra de activación y la transcripción se hacen en tu Mac con Whisper. Usa tu suscripción de Claude y la voz gratuita de Microsoft Edge. Basado en partes de ethanplusai/jarvis — solo uso personal.
        </div>
      </Card>
    </div>
  );
}
