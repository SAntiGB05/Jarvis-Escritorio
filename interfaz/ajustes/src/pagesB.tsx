import { useEffect, useState } from 'react';
import type { Activity, UrlTest } from './api';
import { serviceInfo } from './App';
import { permView } from './pagesA';
import { dayTime, searchDate, useStore } from './store';
import { GOLD, MONO } from './theme';
import { Card, Dot, Eyebrow, PageHead, Pill, PrimaryBtn, SecondaryBtn, Toggle, inputStyle, useT } from './ui';

// ---------------------------------------------------------------------------
// 5. Capacidades
// ---------------------------------------------------------------------------

export function Capacidades() {
  const T = useT();
  const s = useStore();
  const { env, status } = s;
  const [showSecret, setShowSecret] = useState(false);
  const perms = status?.perms;
  const spMode = env.spId && env.spSecret ? 1 : perms?.acc === 'granted' ? 2 : 3;
  const autoOk = !perms || perms.auto === 'granted' || perms.auto === 'unknown';
  const modes: [number, string][] = [[1, 'Con API de Spotify: resultado exacto'], [2, 'Con Accesibilidad: pulsa «Reproducir» por ti'], [3, 'Solo abre la búsqueda; tú pulsas play']];
  const caps = [
    { title: 'Aplicaciones', desc: 'Abre y cierra apps instaladas, aunque digas el nombre aproximado.', example: '«Abre CapCut» · «Cierra Safari»', ok: autoOk },
    { title: 'Recordatorios', desc: 'Crea recordatorios con aviso y lee tus pendientes.', example: '«Recuérdame llamar a mamá en 20 min»', ok: autoOk },
    { title: 'Sistema', desc: 'Ajusta el volumen del Mac y te dice la fecha y la hora.', example: '«Pon el volumen al 40»', ok: true },
    { title: 'Conocimiento', desc: 'Wikipedia y páginas de sitios permitidos. Siempre cita la fuente.', example: '«¿Quién pintó La Gioconda?»', ok: true },
  ];
  const mono = inputStyle(T, true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 920 }}>
      <PageHead eyebrow="CAPACIDADES" title={`Lo que ${env.assistantName} puede hacer`} />

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14 }}>
        {caps.map(c => (
          <Card key={c.title} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</div><Pill ok={c.ok} okText="Disponible" noText="Necesita permiso" />
            </div>
            <div style={{ fontSize: 12.5, color: T.tx3, lineHeight: 1.45 }}>{c.desc}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: T.tx2, marginTop: 'auto' }}>{c.example}</div>
          </Card>
        ))}
      </div>

      <div style={{ borderRadius: 14, border: `1px dashed rgba(${T.ln},0.14)`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Eyebrow>LÍMITES DE SEGURIDAD</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, fontSize: 12.5, color: T.tx2 }}>
          <div>Sin acceso a archivos ni terminal. No edita nada.</div>
          <div>No navega fuera de los sitios permitidos.</div>
          <div>Ignora instrucciones escritas dentro de páginas web.</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Internet
// ---------------------------------------------------------------------------

const DOMAIN_RE = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/;

export function Internet() {
  const T = useT();
  const s = useStore();
  const [testUrl, setTestUrl] = useState('');
  const [res, setRes] = useState<UrlTest>({ state: 'empty' });
  const [newSite, setNewSite] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
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
        sub="Solo HTTPS. «dominio.com» incluye sus subdominios; «*.gov» cualquier dominio que termine así." />

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
              onChange={e => { setNewSite(e.target.value); setMsg(null); }} onKeyDown={e => { if (e.key === 'Enter') addSite(); }} style={mono} />
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

export function Actividad() {
  const T = useT();
  const s = useStore();
  const [data, setData] = useState<{ items: Activity[]; days: { day: number; date: string; count: number }[] } | null>(null);
  useEffect(() => { s.api.get_activity(60).then(setData).catch(() => {}); }, [s.api, s.status?.last?.ts]);
  const days = data?.days || [];
  const mx = Math.max(1, ...days.map(d => d.count));
  const total = days.reduce((a, b) => a + b.count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
      <PageHead eyebrow="ACTIVIDAD" title="Conversaciones recientes" />

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
              {c.tools.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {c.tools.map((t, j) => (
                    <span key={j} style={{ fontFamily: MONO, fontSize: 10.5, padding: '2px 7px', borderRadius: 4, background: `rgba(${T.sf},0.06)`, color: T.tx3 }}>{t}</span>
                  ))}
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
  const rows = [
    ['mic', 'Micrófono', `Para oír «${w}» y tus peticiones.`],
    ['acc', 'Accesibilidad', 'Para que Spotify reproduzca solo, sin API.'],
    ['auto', 'Automatización', 'Para controlar Spotify, Recordatorios y System Events.'],
  ] as const;
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
          const p = permView(status?.perms[k], T);
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < rows.length - 1 ? `1px solid rgba(${T.ln},0.06)` : 'none' }}>
              <Dot color={p.dot} size={9} glow />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{name}</div>
                <div style={{ fontSize: 12, color: T.tx3 }}>{desc}</div>
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
