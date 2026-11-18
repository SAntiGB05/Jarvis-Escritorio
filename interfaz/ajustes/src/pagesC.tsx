import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MemoryItem, Package, Project, Shortcut } from './api';
import { dayTime, useStore } from './store';
import { GOLD, MONO } from './theme';
import { Servicios } from './pagesB';
import { Card, Dot, Eyebrow, PageHead, Pill, PrimaryBtn, SecondaryBtn, Toggle, inputStyle, useT } from './ui';

// ---------------------------------------------------------------------------
// utilidades
// ---------------------------------------------------------------------------

function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'blue' | 'red' }) {
  const T = useT();
  const c = { neutral: [`rgba(${T.sf},0.06)`, T.tx3], gold: ['rgba(255,154,46,0.12)', T.acc], blue: ['rgba(61,139,255,0.12)', T.blue], red: ['rgba(255,74,61,0.12)', T.red] }[tone];
  return <span style={{ fontFamily: MONO, fontSize: 10.5, padding: '2px 7px', borderRadius: 4, background: c[0], color: c[1], whiteSpace: 'nowrap' }}>{children}</span>;
}

const PERM_LABEL: Record<string, string> = {
  'automation:com.apple.Terminal': 'Automatización · Terminal', 'automation:com.apple.iCal': 'Automatización · Calendario',
  'automation:com.apple.Notes': 'Automatización · Notas', 'automation:com.apple.iWork.Numbers': 'Automatización · Numbers',
  accessibility: 'Accesibilidad', screen: 'Grabación de pantalla',
};

// ---------------------------------------------------------------------------
// Paquetes de capacidad (punto 7) + comportamiento (puntos 10 y 16)
// ---------------------------------------------------------------------------

export function Paquetes() {
  const T = useT();
  const s = useStore();
  const [pkgs, setPkgs] = useState<Package[]>([]);
  const [running, setRunning] = useState<string[] | null>(null);
  useEffect(() => { s.api.get_packages().then(r => { setPkgs(r.packages); setRunning(r.running); }).catch(() => {}); }, [s.api, s.status?.service.since]);

  const toggle = async (id: string) => {
    const ids = pkgs.filter(p => (p.id === id ? !p.active : p.active)).map(p => p.id);
    setPkgs(await s.api.save_packages(ids));
  };
  const activos = pkgs.filter(p => p.active).map(p => p.id).sort().join(',');
  const pendiente = running !== null && [...running].sort().join(',') !== activos;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 920 }}>
      <PageHead eyebrow="PAQUETES · SE APLICAN AL REINICIAR" title="Paquetes de capacidad"
        sub={`Cada paquete trae sus herramientas y su modo de uso. Los límites los pone la app al arrancar ${s.env.assistantName}, nunca el modelo.`}
        right={pendiente ? <PrimaryBtn onClick={s.restart}>{s.restarting ? 'Reiniciando…' : 'Reiniciar para aplicar'}</PrimaryBtn> : undefined} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        {pkgs.map(p => (
          <Card key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: p.active ? 1 : 0.75 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: T.tx3, marginTop: 3, lineHeight: 1.45 }}>{p.desc}</div>
              </div>
              <Toggle on={p.active} onClick={() => toggle(p.id)} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {p.tools.map(t => <Tag key={t} tone={p.confirm.includes(t) ? 'gold' : 'neutral'}>{t}</Tag>)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: T.tx3 }}>
              {p.confirm.length > 0 && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Dot color={GOLD} />Doble clic en la esfera para: {p.confirm.join(', ')}</div>}
              {p.untrusted.length > 0 && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Dot color={T.red} />Contenido externo: bloquea escrituras en ese turno</div>}
              {p.perms.length > 0 && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Dot color={T.blue} />Necesita: {p.perms.map(x => PERM_LABEL[x] || x).join(', ')}</div>}
              {p.note && <div>{p.note}</div>}
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Eyebrow>COMPORTAMIENTO · SE APLICA AL REINICIAR</Eyebrow>
        <Row title="Respuesta rápida sin Claude" sub="Volumen, pausa, siguiente canción, la hora y abrir apps conocidas se resuelven al instante y sin gastar cuota.">
          <Toggle on={s.env.fastpath === '1'} onClick={() => s.setEnv('fastpath', s.env.fastpath === '1' ? '0' : '1')} />
        </Row>
        <Row title="Briefing del día" sub="En la primera activación del día (solo con la palabra de activación): clima, recordatorios y agenda en unos 30 s.">
          <Toggle on={s.env.briefing === '1'} onClick={() => s.setEnv('briefing', s.env.briefing === '1' ? '0' : '1')} />
        </Row>
        <Row title="Horario de silencio" sub="Sin briefing ni avisos hablados en ese horario (también respeta No molestar). Vacío = nunca.">
          <input className="field" value={s.env.quiet} placeholder="22:00-07:00" spellCheck={false}
            onChange={e => s.setEnv('quiet', e.target.value.trim())} style={inputStyle(T, true, { width: 140 })} />
        </Row>
      </Card>

      <Servicios />
    </div>
  );
}

function Row({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  const T = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: 13 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: T.tx3, lineHeight: 1.45 }}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proyectos (registro del paquete Desarrollo, punto 6)
// ---------------------------------------------------------------------------

export function Proyectos() {
  const T = useT();
  const s = useStore();
  const [list, setList] = useState<Project[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { s.api.get_projects().then(setList).catch(() => {}); }, [s.api]);

  const upd = (i: number, k: keyof Project, v: string) => { setList(l => l.map((p, j) => j === i ? { ...p, [k]: v } : p)); setDirty(true); setMsg(null); };
  const add = () => { setList(l => [...l, { name: '', path: '', dev: 'npm run dev', test: 'npm test' }]); setDirty(true); };
  const del = (i: number) => { setList(l => l.filter((_, j) => j !== i)); setDirty(true); };
  const pick = async (i: number) => { const f = await s.api.pick_folder(); if (f) { upd(i, 'path', f); if (!list[i].name) upd(i, 'name', f.split('/').pop() || ''); } };
  const save = async () => {
    const r = await s.api.save_projects(list);
    if (!r.ok) { setMsg({ ok: false, text: r.error || 'No pude guardar.' }); return; }
    setList(r.projects || list); setDirty(false); setMsg({ ok: true, text: 'Guardado. Ya está activo.' });
  };
  const mono = inputStyle(T, true, { padding: '6px 9px', fontSize: 11.5 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 980 }}>
      <PageHead eyebrow="PROYECTOS · SE APLICA AL INSTANTE" title="Registro de proyectos"
        sub="Las herramientas de desarrollo solo trabajan con estos proyectos: el asistente dice un nombre y la app decide la ruta y el comando. Nunca acepta rutas ni comandos dictados." />
      <Card style={{ padding: '8px 16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: T.tx4, fontFamily: MONO, fontSize: 10, letterSpacing: '.1em' }}>
              <th style={{ padding: '10px 6px', fontWeight: 400 }}>NOMBRE</th><th style={{ padding: '10px 6px', fontWeight: 400 }}>CARPETA</th>
              <th style={{ padding: '10px 6px', fontWeight: 400 }}>COMANDO DEV</th><th style={{ padding: '10px 6px', fontWeight: 400 }}>COMANDO TEST</th><th />
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={i} style={{ borderTop: `1px solid rgba(${T.ln},0.06)` }}>
                <td style={{ padding: '8px 6px', width: 150 }}><input className="field" value={p.name} placeholder="catalogo" onChange={e => upd(i, 'name', e.target.value)} style={mono} /></td>
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input className="field" value={p.path} placeholder="~/Developer/catalogo" onChange={e => upd(i, 'path', e.target.value)} style={{ ...mono, color: p.exists === false ? T.red : T.tx }} />
                    <SecondaryBtn small onClick={() => pick(i)}>Elegir…</SecondaryBtn>
                  </div>
                </td>
                <td style={{ padding: '8px 6px', width: 170 }}><input className="field" value={p.dev} onChange={e => upd(i, 'dev', e.target.value)} style={mono} /></td>
                <td style={{ padding: '8px 6px', width: 200 }}><input className="field" value={p.test} onChange={e => upd(i, 'test', e.target.value)} style={mono} /></td>
                <td style={{ padding: '8px 0 8px 6px', width: 28 }}>
                  <div className="chip-x" title="Quitar" onClick={() => del(i)} style={{ width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tx4, cursor: 'pointer' }}>×</div>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={5} style={{ padding: '14px 6px', color: T.tx3 }}>Todavía no hay proyectos. Añade el primero.</td></tr>}
          </tbody>
        </table>
      </Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SecondaryBtn onClick={add}>Añadir proyecto</SecondaryBtn>
        <PrimaryBtn onClick={save} disabled={!dirty}>Guardar</PrimaryBtn>
        <div style={{ fontSize: 12, color: msg ? (msg.ok ? T.blue : T.red) : T.tx4, marginLeft: 6 }}>{msg ? msg.text : 'Se guarda en data/proyectos.json.'}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Atajos de Apple (punto 12)
// ---------------------------------------------------------------------------

export function Atajos() {
  const T = useT();
  const s = useStore();
  const [all, setAll] = useState<string[] | null>(null);
  const [allowed, setAllowed] = useState<Shortcut[]>([]);
  useEffect(() => { s.api.get_shortcuts().then(r => { setAll(r.all); setAllowed(r.allowed); }).catch(() => setAll([])); }, [s.api]);
  const save = (l: Shortcut[]) => { setAllowed(l); s.api.save_shortcuts(l); };
  const names = useMemo(() => Array.from(new Set([...(all || []), ...allowed.map(a => a.name)])), [all, allowed]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
      <PageHead eyebrow="ATAJOS · SE APLICA AL INSTANTE" title="Atajos de Apple permitidos"
        sub="El asistente solo puede ejecutar los atajos que marques. Los de escritura piden doble clic en la esfera; los de lectura no. Requiere el paquete «Atajos de Apple»." />
      <Card style={{ padding: '4px 18px' }}>
        {all === null && <div style={{ padding: '14px 0', color: T.tx3 }}>Leyendo tus atajos…</div>}
        {all !== null && !names.length && <div style={{ padding: '14px 0', color: T.tx3 }}>No encontré atajos en este Mac (app Atajos).</div>}
        {names.map((n, i) => {
          const a = allowed.find(x => x.name === n);
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i ? `1px solid rgba(${T.ln},0.06)` : 'none' }}>
              <Toggle on={!!a} onClick={() => save(a ? allowed.filter(x => x.name !== n) : [...allowed, { name: n, mode: 'escritura' }])} />
              <div style={{ flex: 1, fontSize: 13 }}>{n}</div>
              {a && (
                <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 7, background: `rgba(${T.sf},0.06)` }}>
                  {(['lectura', 'escritura'] as const).map(m => (
                    <div key={m} onClick={() => save(allowed.map(x => x.name === n ? { ...x, mode: m } : x))}
                      style={{ padding: '3px 10px', borderRadius: 5, fontSize: 11.5, cursor: 'pointer', background: a.mode === m ? 'rgba(255,154,46,0.16)' : 'transparent', color: a.mode === m ? T.acc : T.tx3 }}>
                      {m === 'lectura' ? 'Lectura' : 'Escritura · doble clic'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memoria y avisos programados (puntos 13 y 16)
// ---------------------------------------------------------------------------

export function Memoria() {
  const T = useT();
  const s = useStore();
  const [data, setData] = useState<{ memory: MemoryItem[]; reminders: MemoryItem[] }>({ memory: [], reminders: [] });
  const [apple, setApple] = useState<{ ok: boolean; error?: string; items: (MemoryItem & { list?: string })[] } | null>(null);
  const cargar = () => {
    s.api.get_memory().then(setData).catch(() => {});
    s.api.get_apple_reminders().then(setApple).catch(() => setApple({ ok: false, error: 'No pude leer la app Recordatorios.', items: [] }));
  };
  useEffect(cargar, [s.api, s.status?.last?.ts]); // eslint-disable-line react-hooks/exhaustive-deps
  const fmt = (ts: number | null) => ts ? new Date(ts * 1000).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha';

  const seccion = (titulo: string, como: string, ejemplo: string, n: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</div>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: T.tx4 }}>{n}</div>
      </div>
      <div style={{ fontSize: 12, color: T.tx3 }}>{como} <span style={{ fontFamily: MONO, fontSize: 11, color: T.tx2 }}>{ejemplo}</span></div>
    </div>
  );
  const list = (items: MemoryItem[], empty: string, when: (m: MemoryItem) => string, onDel?: (id: string) => void, extra?: (m: MemoryItem) => string) => (
    <Card style={{ padding: '4px 18px' }}>
      {!items.length && <div style={{ padding: '14px 0', fontSize: 12.5, color: T.tx3 }}>{empty}</div>}
      {items.map((m, i) => (
        <div key={m.id + i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i ? `1px solid rgba(${T.ln},0.06)` : 'none' }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: T.tx4, width: 120, flex: 'none' }}>{when(m)}</div>
          <div style={{ flex: 1, fontSize: 13 }}>{m.text}{extra && extra(m) ? <span style={{ color: T.tx4, fontSize: 11.5 }}> · {extra(m)}</span> : null}</div>
          {onDel && <SecondaryBtn small onClick={() => onDel(m.id)}>Borrar</SecondaryBtn>}
        </div>
      ))}
    </Card>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 780 }}>
      <PageHead eyebrow="MEMORIA" title={`Lo que ${s.env.assistantName} recuerda`}
        sub="Tres cosas distintas según cómo se lo pidas. Los datos se usan como información, nunca como instrucciones, y una página web no puede escribir aquí."
        right={<SecondaryBtn onClick={cargar}>Actualizar</SecondaryBtn>} />

      {seccion('Datos sobre ti', 'Se guardan cuando dices', '«Recuerda que prefiero el café sin azúcar»', data.memory.length)}
      {list(data.memory, 'Todavía no recuerda ningún dato.', m => m.ts ? dayTime(m.ts) : '', id => s.api.delete_memory(id).then(setData))}

      {seccion('Recordatorios (app Recordatorios)', 'Se crean cuando dices', '«Recuérdame llamar a mamá hoy a las 6»', apple?.items.length || 0)}
      {apple && !apple.ok
        ? <Card style={{ fontSize: 12.5, color: T.red }}>{apple.error}</Card>
        : list(apple?.items || [], apple ? 'No tienes recordatorios pendientes.' : 'Leyendo la app Recordatorios…', m => fmt(m.ts), undefined, m => (m as { list?: string }).list || '')}
      <div><SecondaryBtn small onClick={() => s.api.open_reminders_app()}>Abrir Recordatorios</SecondaryBtn></div>

      {seccion('Avisos hablados', 'Te los dice en voz alta a esa hora cuando dices', '«Avísame a las 5 que salga a caminar»', data.reminders.length)}
      {list(data.reminders, 'No hay avisos programados.', m => fmt(m.ts), id => s.api.delete_reminder(id).then(setData))}

      <div style={{ fontSize: 11.5, color: T.tx4, lineHeight: 1.5 }}>Los datos nuevos llegan al cerebro al reiniciar o en la siguiente conversación larga; en la conversación actual ya los sabe.</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funciones: tabla con todo lo que hace Jarvis (las que ya estaban y las nuevas)
// ---------------------------------------------------------------------------

type Estado = 'activa' | 'paquete' | 'pendiente' | 'recompilar' | 'manual';
type Fila = { f: string; desc: string; ej: string; prio?: string; pkg?: string; estado?: Estado };

const EXISTENTES: Fila[] = [
  { f: 'Palabra de activación', desc: 'Detecta «Raphael» (configurable) en tu Mac con Whisper; el audio nunca sale del equipo.', ej: '«Raphael, …»' },
  { f: 'Transcripción local', desc: 'Whisper (tiny → large-v3) en español, inglés o portugués, con sensibilidad ajustable.', ej: 'Voz y oído' },
  { f: 'Cerebro Claude Code', desc: 'Proceso claude -p de larga vida en tu suscripción (sin API key), con personalidad y respuestas cortas para voz.', ej: 'Haiku · Sonnet · Opus' },
  { f: 'Voz de respuesta', desc: 'Voz neural gratuita de Microsoft Edge, con velocidad y tono configurables y prueba en vivo.', ej: 'es-CO-GonzaloNeural' },
  { f: 'Esfera flotante', desc: 'Orbe Three.js que aparece al activarse y refleja escuchando, pensando, hablando, completado o error.', ej: 'Página Orbe' },
  { f: 'Cancelar con doble clic', desc: 'Doble clic en la esfera la desactiva y descarta la petición en curso.', ej: 'Doble clic' },
  { f: 'Conversación de seguimiento', desc: 'Tras responder sigue escuchando unos segundos, sin repetir la palabra de activación.', ej: '«¿Y mañana?»' },
  { f: 'Bajar Spotify al escuchar', desc: 'Atenúa la música mientras habla contigo y la restaura al terminar.', ej: 'Automático' },
  { f: 'Abrir y cerrar apps', desc: 'Apps instaladas, aunque digas el nombre aproximado.', ej: 'abrir_app · cerrar_app' },
  { f: 'Spotify', desc: 'Reproduce canciones, artistas, álbumes o playlists (API, Accesibilidad o búsqueda) y controla la reproducción.', ej: 'spotify_reproducir · spotify_control' },
  { f: 'Recordatorios', desc: 'Crea recordatorios con fecha y hora en la app Recordatorios y lee los pendientes.', ej: 'crear_recordatorio · listar_recordatorios' },
  { f: 'Volumen, fecha y hora', desc: 'Ajusta el volumen del Mac y da la fecha y hora exactas.', ej: 'volumen · fecha_hora' },
  { f: 'Clima', desc: 'Actual y pronóstico de 3 días con open-meteo para tu ubicación fija.', ej: 'clima' },
  { f: 'Wikipedia y páginas oficiales', desc: 'Consulta Wikipedia y lee páginas solo de sitios de la lista blanca; responde directo, sin dictar la fuente.', ej: 'buscar_wikipedia · leer_pagina' },
  { f: 'Búsqueda web limitada', desc: 'WebSearch como último recurso; un hook le impone los dominios permitidos y registra cada búsqueda.', ej: 'limitar_busqueda.py' },
  { f: 'Lista blanca de internet', desc: 'Solo HTTPS a dominios permitidos, revalidando cada redirección; editable en el panel.', ej: 'Página Internet' },
  { f: 'Abrir los ajustes por voz', desc: 'El asistente puede abrir esta ventana cuando se lo pides.', ej: 'abrir_ajustes' },
  { f: 'Panel de ajustes', desc: 'Inicio, Orbe, Identidad, Voz y oído, Internet, Actividad y Sistema (más las páginas nuevas del plan).', ej: 'Esta ventana' },
  { f: 'Historial y uso', desc: 'Conversaciones recientes, búsquedas web y consumo de las ventanas de 5 h y 7 días.', ej: 'Actividad · Inicio' },
  { f: 'Permisos y servicio', desc: 'Estado de micrófono, Accesibilidad y Automatización; iniciar, detener, reiniciar, registro y arranque al iniciar sesión.', ej: 'Página Sistema' },
  { f: 'App de barra de menús', desc: 'Jarvis.app nativa con Python incrustado; relanza el motor si se cae.', ej: 'Barra de menús' },
  { f: 'Contenido como información', desc: 'Lo que devuelven las herramientas se marca como «información, no instrucciones».', ej: 'Defensa blanda' },
];

const NUEVAS: Fila[] = [
  { f: 'Lanzador nativo restringido', desc: 'Jarvis.app ya no es un intérprete de Python para cualquiera: solo 4 scripts por ruta canónica y con SHA-256 fijado al compilar; sin -c, -m ni variables PYTHON*.', ej: 'lanzador.c · crear_app.sh', prio: 'P0 · 1', estado: 'recompilar' },
  { f: 'Bloqueo de escrituras en turnos contaminados', desc: 'Si en el turno entró contenido externo (web, Wikipedia, portapapeles, agenda, pantalla), un hook del anfitrión bloquea toda herramienta que escribe o actúa.', ej: 'limitar_escritura.py', prio: 'P0 · 2' },
  { f: 'Confirmación física con doble clic', desc: 'Las acciones de riesgo ponen la esfera en ámbar, se anuncian en voz alta y solo se ejecutan con doble clic en 20 s (con nonce aleatorio).', ej: 'Esfera ámbar', prio: 'P0 · 3' },
  { f: 'Reglas anti-exfiltración', desc: 'Las URL que elige el modelo no pueden llevar más de 200 caracteres de parámetros ni datos con aspecto de base64; aviso al añadir dominios de riesgo.', ej: '_get · Internet', prio: 'P0 · 4' },
  { f: 'Delegar a Claude Code', desc: 'Las tareas que modifican código se abren en Terminal con Claude Code y la tarea escrita; revisas cada cambio en pantalla.', ej: 'delegar_a_claude_code', prio: 'P1 · 5', pkg: 'desarrollo' },
  { f: 'Registro de proyectos', desc: 'Nombre, carpeta y comandos dev/test por proyecto; el modelo nunca dicta rutas ni comandos.', ej: 'Página Proyectos', prio: 'P1 · 6', pkg: 'desarrollo' },
  { f: 'Auditar dependencias', desc: 'npm audit (sin instalar ni ejecutar scripts) y resumen de vulnerabilidades por gravedad.', ej: 'auditar_dependencias', prio: 'P1 · 6', pkg: 'desarrollo' },
  { f: 'Puertos', desc: 'Qué proceso ocupa un puerto y liberarlo (SIGTERM; SIGKILL solo si lo pides). Nunca toca procesos del sistema ni de Jarvis.', ej: 'puerto_en_uso · liberar_puerto', prio: 'P1 · 6', pkg: 'desarrollo' },
  { f: 'Levantar proyecto y tests', desc: 'Abre el comando dev en Terminal y ejecuta los tests con resumen hablado («38 pasan, 2 fallan»).', ej: 'iniciar_proyecto · ejecutar_tests', prio: 'P1 · 6', pkg: 'desarrollo' },
  { f: 'Git por voz', desc: 'Cambios sin commit de todos los proyectos, pull solo fast-forward y crear ramas, siempre sin hooks del repositorio.', ej: 'git_estado · git_pull · git_rama', prio: 'P1 · 6', pkg: 'desarrollo' },
  { f: 'Estado del Mac y Homebrew', desc: 'Disco libre, batería, memoria y paquetes de brew con actualización.', ej: 'estado_sistema · brew_pendientes', prio: 'P1 · 6', pkg: 'desarrollo' },
  { f: 'Paquetes de capacidad', desc: 'Manifiesto + SKILL.md + herramientas por carpeta; se activan aquí y la app los aplica al arrancar (herramientas, skills, hooks y permisos).', ej: 'Página Paquetes', prio: 'P1 · 7' },
  { f: 'Voz en streaming por frases', desc: 'Empieza a hablar en cuanto Claude completa la primera frase y prepara la siguiente mientras suena la actual.', ej: 'Automático', prio: 'P1 · 8' },
  { f: 'Métricas de latencia', desc: 'Whisper, primer token, Claude total, síntesis y primer audio en cada petición, con medias en Actividad.', ej: 'actividad.jsonl', prio: 'P1 · 9' },
  { f: 'Lo que Jarvis no pudo hacer', desc: 'registrar_limite anota cada petición sin herramienta; Actividad las agrupa por motivo para decidir qué construir.', ej: 'registrar_limite', prio: 'P1 · 9' },
  { f: 'Respuesta rápida sin LLM', desc: 'Volumen, pausa, siguiente, la hora y abrir apps conocidas en milisegundos y sin gastar cuota.', ej: 'fastpath.py', prio: 'P2 · 10' },
  { f: 'Portapapeles', desc: 'Lee, resume o traduce lo que copiaste (cuenta como contenido no confiable).', ej: 'leer_portapapeles', prio: 'P2 · 11', pkg: 'portapapeles' },
  { f: 'Atajos de Apple', desc: 'Ejecuta solo los atajos que eliges, marcados como lectura o escritura (con doble clic).', ej: 'ejecutar_atajo · Página Atajos', prio: 'P2 · 12', pkg: 'atajos' },
  { f: 'Memoria del usuario', desc: '«Recuerda que…» se guarda y se usa como datos; la ves y la borras en Memoria. Rechaza contraseñas y tarjetas.', ej: 'recordar · Página Memoria', prio: 'P2 · 13', pkg: 'memoria' },
  { f: 'Calendario y Notas', desc: 'Consulta tu agenda, crea eventos (con doble clic) y dicta notas en la app Notas.', ej: 'agenda · crear_evento · crear_nota', prio: 'P2 · 14', pkg: 'calendario' },
  { f: 'Interrumpir por voz (barge-in)', desc: 'Escuchar «Raphael, para» mientras habla requiere cancelación de eco con AVAudioEngine; queda para una iteración posterior.', ej: '—', prio: 'P2 · 15', estado: 'pendiente' },
  { f: 'Briefing del día', desc: 'En la primera activación del día: clima, recordatorios y agenda en unos 30 s (opcional).', ej: 'Paquetes → Comportamiento', prio: 'P2 · 16' },
  { f: 'Avisos hablados', desc: '«Avísame a las 5…» se dice en voz alta a esa hora, respetando el horario de silencio y No molestar.', ej: 'programar_aviso', prio: 'P2 · 16' },
  { f: 'Control del sistema', desc: 'Subir o bajar el brillo, bloquear la pantalla y consultar la batería.', ej: 'brillo · bloquear_pantalla · bateria', prio: 'P2 · 17', pkg: 'sistema' },
  { f: '¿Qué hay en mi pantalla?', desc: 'Captura la pantalla y la describe; paquete aparte, desactivado por defecto y con contenido no confiable.', ej: 'que_hay_en_pantalla', prio: 'P2 · 17', pkg: 'pantalla' },
  { f: 'Dictado a hoja de cálculo', desc: 'Añade filas dictadas (gastos, inventario) a la hoja abierta en Numbers o Excel.', ej: 'agregar_fila', prio: 'P2 · 17', pkg: 'hoja_calculo' },
  { f: 'Retención y borrado del historial', desc: 'El historial se borra solo pasados N días (30 por defecto) y hay un botón «Borrar historial».', ej: 'Página Actividad', prio: 'P3 · 18' },
  { f: 'Buzón de avisos protegido', desc: 'data/avisos/ solo para tu usuario (0700) y confirmaciones con nonce de un solo uso.', ej: 'data/avisos/', prio: 'P3 · 18' },
  { f: 'Secreto de Spotify en el Llavero', desc: 'El Client Secret se guarda en el Llavero de macOS, sale de .env y ya no llega al proceso de Claude.', ej: 'Llavero', prio: 'P3 · 19' },
  { f: 'Proyecto fuera del Escritorio', desc: 'Mover la carpeta a ~/Developer o ~/Library/Application Support/Jarvis permite quitar los permisos de Escritorio y Documentos.', ej: 'Mover y crear_app.sh', prio: 'P3 · 19', estado: 'manual' },
  { f: 'Modelo según complejidad', desc: 'Haiku para lo cotidiano y Sonnet bajo demanda; se decidirá con las métricas nuevas.', ej: '—', prio: 'P3 · 20', estado: 'pendiente' },
  { f: 'Terminal elevada con Touch ID', desc: 'Diseño listo pero no activado: solo si «Lo que Jarvis no pudo hacer» muestra que hace falta.', ej: '—', prio: 'P3 · 21', estado: 'pendiente' },
];

export function Funciones() {
  const T = useT();
  const s = useStore();
  const [pkgs, setPkgs] = useState<Package[]>([]);
  const [filtro, setFiltro] = useState<'todas' | 'existentes' | 'nuevas'>('todas');
  const [q, setQ] = useState('');
  useEffect(() => { s.api.get_packages().then(r => setPkgs(r.packages)).catch(() => {}); }, [s.api]);

  const estadoDe = (r: Fila): Estado => r.estado || (r.pkg && !pkgs.find(p => p.id === r.pkg)?.active ? 'paquete' : 'activa');
  const view: Record<Estado, { text: string; tone: 'blue' | 'gold' | 'neutral' | 'red' }> = {
    activa: { text: 'Activa', tone: 'blue' }, paquete: { text: 'Paquete desactivado', tone: 'neutral' },
    pendiente: { text: 'Pendiente', tone: 'red' }, recompilar: { text: 'Activa al recompilar', tone: 'gold' }, manual: { text: 'Paso manual', tone: 'gold' },
  };
  const match = (r: Fila) => !q.trim() || `${r.f} ${r.desc} ${r.ej}`.toLowerCase().includes(q.trim().toLowerCase());
  const nuevasHechas = NUEVAS.filter(r => !['pendiente', 'manual'].includes(estadoDe(r))).length;

  const tabla = (rows: Fila[], nueva: boolean) => (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: T.tx4, fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', background: `rgba(${T.sf},0.03)` }}>
              <th style={{ padding: '11px 16px', fontWeight: 400, width: '22%' }}>FUNCIÓN</th>
              <th style={{ padding: '11px 10px', fontWeight: 400 }}>QUÉ HACE</th>
              <th style={{ padding: '11px 10px', fontWeight: 400, width: '20%' }}>HERRAMIENTA / DÓNDE</th>
              {nueva && <th style={{ padding: '11px 10px', fontWeight: 400, width: 70 }}>PLAN</th>}
              <th style={{ padding: '11px 16px 11px 10px', fontWeight: 400, width: 140 }}>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {rows.filter(match).map(r => {
              const e = view[nueva ? estadoDe(r) : 'activa'];
              return (
                <tr key={r.f} style={{ borderTop: `1px solid rgba(${T.ln},0.06)`, verticalAlign: 'top' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 500, color: T.tx }}>{r.f}</td>
                  <td style={{ padding: '11px 10px', color: T.tx3, lineHeight: 1.45 }}>{r.desc}</td>
                  <td style={{ padding: '11px 10px', fontFamily: MONO, fontSize: 11, color: T.tx2, lineHeight: 1.5 }}>{r.ej}</td>
                  {nueva && <td style={{ padding: '11px 10px', fontFamily: MONO, fontSize: 11, color: T.acc, whiteSpace: 'nowrap' }}>{r.prio}</td>}
                  <td style={{ padding: '11px 16px 11px 10px' }}><Tag tone={e.tone}>{e.text}</Tag></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
      <PageHead eyebrow="FUNCIONES" title={`Todo lo que ${s.env.assistantName} sabe hacer`}
        sub="Las que ya estaban y las que se añadieron con el plan de mejoras y seguridad (v1, 11 nov 2026)." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
        {[['YA ESTABAN', String(EXISTENTES.length)], ['NUEVAS CON EL PLAN', String(NUEVAS.length)], ['NUEVAS ACTIVAS', `${nuevasHechas} / ${NUEVAS.length}`], ['TOTAL', String(EXISTENTES.length + NUEVAS.length)]].map(([k, v]) => (
          <Card key={k} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Eyebrow>{k}</Eyebrow>
            <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 7, background: `rgba(${T.sf},0.06)`, border: `1px solid rgba(${T.ln},0.1)` }}>
          {([['todas', 'Todas'], ['existentes', 'Ya estaban'], ['nuevas', 'Nuevas']] as const).map(([v, l]) => (
            <div key={v} onClick={() => setFiltro(v)} style={{ padding: '4px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: filtro === v ? 'rgba(255,154,46,0.16)' : 'transparent', color: filtro === v ? T.acc : T.tx3 }}>{l}</div>
          ))}
        </div>
        <input className="field" value={q} placeholder="Buscar función…" onChange={e => setQ(e.target.value)} style={inputStyle(T, false, { width: 240, fontSize: 13, padding: '7px 11px' })} />
      </div>

      {filtro !== 'nuevas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ fontSize: 15, fontWeight: 600 }}>Funciones que ya estaban</div><Pill ok okText={`${EXISTENTES.length}`} /></div>
          {tabla(EXISTENTES, false)}
        </div>
      )}
      {filtro !== 'existentes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ fontSize: 15, fontWeight: 600 }}>Nuevas con el plan de mejoras</div><Pill ok={false} noText={`${NUEVAS.length}`} okText="" /></div>
          {tabla(NUEVAS, true)}
          <div style={{ fontSize: 11.5, color: T.tx4, lineHeight: 1.5 }}>
            «Paquete desactivado»: la función existe pero su paquete está apagado en Paquetes. «Activa al recompilar»: se aplica al ejecutar ./empaquetar/crear_app.sh.
            «Pendiente»: el propio plan la deja para cuando las métricas lo justifiquen o para una iteración posterior.
          </div>
        </div>
      )}
    </div>
  );
}
