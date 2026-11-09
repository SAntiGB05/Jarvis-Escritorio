import { useEffect, useRef, useState } from 'react';
import { serviceInfo } from './App';
import { StageOrb } from './orb';
import { greeting, relTime, resetIn, useStore } from './store';
import { BLUE, GOLD, MONO, PALETTES, RED, STATES, lnc, rgb } from './theme';
import { Card, Choice, Dot, Eyebrow, PageHead, PrimaryBtn, SecondaryBtn, Slider, Toggle, inputStyle, useT } from './ui';

const GRID = 'linear-gradient(rgba(255,236,210,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,236,210,0.035) 1px,transparent 1px)';

export function permView(p: string | undefined, T: ReturnType<typeof useT>) {
  if (p === 'granted') return { dot: BLUE, text: 'Concedido', color: T.blue };
  if (p === 'denied') return { dot: RED, text: 'Denegado', color: T.red };
  if (p === 'unknown') return { dot: GOLD, text: 'Se pedirá al usarlo', color: T.acc };
  return { dot: GOLD, text: 'Pendiente', color: T.acc };
}

// ---------------------------------------------------------------------------
// 1. Inicio
// ---------------------------------------------------------------------------

export function Inicio() {
  const T = useT();
  const s = useStore();
  const { env, status, orbState } = s;
  const svc = serviceInfo(status, s.restarting, T.acc);
  const [label, color] = STATES[orbState] || STATES.idle;
  const perms = status?.perms;
  const last = status?.last;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 880 }}>
      <PageHead eyebrow="INICIO" title={greeting(env.userName.trim(), env.assistantName)} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        <div style={{ borderRadius: 16, border: `1px solid rgba(${T.ln},0.08)`, background: T.stage, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: GRID, backgroundSize: '28px 28px', pointerEvents: 'none' }} />
          <StageOrb state={orbState} orb={s.orb} size={260} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', color }}>
              <Dot color={color} />{label.toUpperCase()}
            </div>
            <div style={{ fontSize: 13, color: '#A39A8F' }}>Di «{env.wakeWord}» para hablar con {env.assistantName}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <PrimaryBtn onClick={s.simulate}>Simular activación</PrimaryBtn>
            <button className="btn-stage" onClick={() => s.go('orbe')}
              style={{ background: 'rgba(255,240,220,0.05)', color: '#F2EDE6', border: '1px solid rgba(255,236,210,0.1)', borderRadius: 8, padding: '8px 14px', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>
              Editar orbe
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <Eyebrow>SERVICIO</Eyebrow>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600 }}>
                  <Dot color={svc.dot} size={8} glow />{svc.label}
                </div>
                <div style={{ fontSize: 12, color: T.tx3 }}>{svc.sub}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <SecondaryBtn onClick={s.restart}>Reiniciar</SecondaryBtn>
                <SecondaryBtn onClick={s.toggleRunning}>{svc.action}</SecondaryBtn>
              </div>
            </div>
            <div style={{ height: 1, background: `rgba(${T.ln},0.07)` }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 13, color: T.tx2 }}>Arrancar al iniciar sesión</div>
              <Toggle on={!!status?.service.autostart} onClick={() => s.setAutostart(!status?.service.autostart)} />
            </div>
          </Card>

          <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Eyebrow>USO DE CLAUDE</Eyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {(status?.usage || [{ key: 'five_hour', label: 'Últimas 5 h', pct: null, resetsAt: null }, { key: 'seven_day', label: 'Últimos 7 días', pct: null, resetsAt: null }]).map(u => (
                <div key={u.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 27, background: `conic-gradient(${GOLD} ${((u.pct ?? 0) / 100) * 360}deg, rgba(${T.sf},0.08) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 22, background: T.gauge, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 12 }}>
                      {u.pct == null ? '—' : `${Math.round(u.pct)}%`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{u.label}</div>
                    <div style={{ fontSize: 11.5, color: T.tx3 }}>{resetIn(u.resetsAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="hov-card" onClick={() => s.go('sistema')} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
            <Eyebrow>PERMISOS</Eyebrow>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {([['mic', 'Mic'], ['acc', 'Accesibilidad'], ['auto', 'Automatización']] as const).map(([k, short]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.tx2 }}>
                  <Dot color={permView(perms?.[k], T).dot} size={7} />{short}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>ÚLTIMA INTERACCIÓN{last ? ` · ${relTime(last.ts)}` : ''}</Eyebrow>
          <a onClick={() => s.go('actividad')} style={{ fontSize: 12, cursor: 'pointer', color: T.acc }}>Ver actividad</a>
        </div>
        {last ? (
          <>
            <div style={{ fontSize: 14, color: T.tx3 }}>Tú: <span style={{ color: T.tx }}>{last.you}</span></div>
            <div style={{ fontSize: 14, color: T.tx3 }}>{env.assistantName}: <span style={{ color: T.acc }}>{last.reply}</span></div>
          </>
        ) : (
          <div style={{ fontSize: 14, color: T.tx3 }}>Aún no has hablado con {env.assistantName}. Di «{env.wakeWord}» y pídele algo.</div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Orbe
// ---------------------------------------------------------------------------

const CORNERS: [string, number, number, string][] = [
  ['tl', 9, 5, 'Arriba a la izquierda'], ['tr', 9, 107, 'Arriba a la derecha'],
  ['bl', 59, 5, 'Abajo a la izquierda'], ['br', 59, 107, 'Abajo a la derecha'],
];

export function OrbePage() {
  const T = useT();
  const s = useStore();
  const { orb, orbState } = s;
  const [label, color] = STATES[orbState] || STATES.idle;

  const sliders: [keyof typeof orb, string, number, number, number, (v: number) => string][] = [
    ['size', 'Tamaño', .6, 1.4, .01, v => Math.round(v * 100) + ' %'],
    ['count', 'Densidad', 400, 3000, 50, v => String(v)],
    ['speed', 'Velocidad de giro', .2, 2.5, .05, v => v.toFixed(2) + '×'],
    ['glow', 'Brillo', .3, 1.6, .01, v => Math.round(v * 100) + ' %'],
    ['turb', 'Turbulencia', 0, 2.5, .05, v => v.toFixed(2) + '×'],
  ];
  const toggles: [keyof typeof orb, string, string][] = [
    ['sound', 'Sonido al activarse', 'Un «tink» suave al oír su nombre'],
    ['dblclick', 'Doble clic para cancelar', 'Corta la escucha y la voz al instante'],
    ['drag', 'Se puede arrastrar', 'Muévelo con el ratón a donde quieras'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 920 }}>
      <PageHead eyebrow="ORBE · SE APLICA AL INSTANTE" title={`Así se ve ${s.env.assistantName}`}
        right={<SecondaryBtn onClick={s.resetOrb}>Restablecer</SecondaryBtn>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ borderRadius: 16, border: `1px solid rgba(${T.ln},0.08)`, background: T.stage, aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: GRID, backgroundSize: '28px 28px' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,236,210,0.06)' }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,236,210,0.06)' }} />
            <StageOrb state={orbState} orb={orb} size="100%" />
            <div style={{ position: 'absolute', left: 14, top: 12, fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', color }}>{label.toUpperCase()}</div>
            <div style={{ position: 'absolute', right: 14, bottom: 12, fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', color: '#8A8177' }}>{orb.count} PARTÍCULAS</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {Object.keys(STATES).map(id => {
              const a = orbState === id;
              return (
                <div key={id} onClick={() => s.setOrbState(id)} className="hov"
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 8, border: `1px solid ${a ? 'rgba(255,154,46,0.45)' : T.lnA}`,
                    background: a ? 'rgba(255,154,46,0.1)' : 'transparent', cursor: 'pointer', fontSize: 12.5, color: a ? T.acc : T.tx2 }}>
                  <Dot color={id === 'done' ? BLUE : id === 'error' ? RED : GOLD} />{STATES[id][0]}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Eyebrow>COLOR</Eyebrow>
              <div style={{ fontSize: 12, color: T.tx3 }}>{(PALETTES[orb.palette] || PALETTES.dorado).label}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {Object.keys(PALETTES).map(id => {
                const [d, m, p] = PALETTES[id].c;
                return (
                  <div key={id} title={PALETTES[id].label} onClick={() => s.setOrb('palette', id)}
                    style={{ width: 34, height: 34, borderRadius: 17, padding: 3, border: `1.5px solid ${orb.palette === id ? T.acc : 'transparent'}`, cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${rgb(p, 1)}, ${rgb(m, 1)} 45%, ${rgb(d, 1)})` }} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Eyebrow>FORMA Y MOVIMIENTO</Eyebrow>
            {sliders.map(([k, lab, min, max, step, fmt]) => (
              <Slider key={k} label={lab} display={fmt(orb[k] as number)} min={min} max={max} step={step} value={orb[k] as number}
                onChange={v => s.setOrb(k, v as never)} />
            ))}
          </Card>

          <Card style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Eyebrow>POSICIÓN</Eyebrow>
              <div style={{ width: 132, height: 84, borderRadius: 8, border: `1px solid rgba(${T.ln},0.14)`, background: T.well, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 7, borderBottom: `1px solid rgba(${T.ln},0.08)`, background: `rgba(${T.sf},0.04)` }} />
                {CORNERS.map(([id, top, left]) => {
                  const a = orb.corner === id;
                  return (
                    <div key={id} onClick={() => s.setOrb('corner', id)} className="hov-corner"
                      style={{ position: 'absolute', top, left, width: 20, height: 20, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: a ? 'rgba(255,154,46,0.18)' : 'transparent' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: a ? GOLD : lnc(T, 0.25), boxShadow: `0 0 8px ${a ? GOLD : 'transparent'}` }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: T.tx3 }}>{(CORNERS.find(c => c[0] === orb.corner) || CORNERS[1])[3]}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Eyebrow>COMPORTAMIENTO</Eyebrow>
              {toggles.map(([k, lab, sub]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{lab}</div><div style={{ fontSize: 11.5, color: T.tx3 }}>{sub}</div>
                  </div>
                  <Toggle on={!!orb[k]} onClick={() => s.setOrb(k, !orb[k] as never)} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Identidad
// ---------------------------------------------------------------------------

function Row({ title, sub, children, last }: { title: string; sub: string; children: React.ReactNode; last?: boolean }) {
  const T = useT();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,220px) minmax(0,1fr)', gap: 16, padding: '16px 0', borderBottom: last ? 'none' : `1px solid rgba(${T.ln},0.07)`, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: T.tx3 }}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

export function Identidad() {
  const T = useT();
  const s = useStore();
  const { env, status } = s;
  const w = env.wakeWord.trim();
  const variants = [...new Set([w.replace(/ph/gi, 'f'), w.replace(/ph/gi, 'f').replace(/ae/gi, 'a')].filter(x => x && x.toLowerCase() !== w.toLowerCase()))].map(x => x.toLowerCase());
  const syl = (w.toLowerCase().match(/[aeiouáéíóú]+/g) || []).length;
  const hint = !w ? { text: 'Escribe una palabra.', color: T.red }
    : syl < 2 ? { text: 'Muy corta: puede activarse por error.', color: T.acc }
      : { text: 'Buena elección.', color: T.blue };
  const user = env.userName.trim();
  const city = env.city.split(',')[0];
  const preview = {
    britanico: `Mañana en ${city}, 24 grados y lluvia probable, ${user || 'señor'}. Yo no saldría sin paraguas, por pura prudencia.`,
    cercano: `¡${user ? 'Hola, ' + user : 'Hola'}! Mañana en ${city} habrá 24 grados y puede llover, mejor lleva paraguas.`,
    formal: `Mañana en ${city}: 24 grados y 60 % de probabilidad de lluvia.`,
  }[env.persona] || '';
  const brain = status?.service.running ? status.service.brain : null;
  const conn = brain === 'ok' ? { text: 'Conectado con tu suscripción', color: T.blue, dot: BLUE }
    : brain === 'error' ? { text: 'Sin conexión con Claude', color: T.red, dot: RED }
      : brain === 'arrancando' ? { text: 'Conectando…', color: T.acc, dot: GOLD }
        : { text: status ? `${env.assistantName} está detenido` : 'Comprobando…', color: T.tx3, dot: T.tx4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
      <PageHead eyebrow="IDENTIDAD · SE APLICA AL REINICIAR" title="Nombre y personalidad" />

      <Card style={{ padding: '4px 18px' }}>
        <Row title="Nombre del asistente" sub="Cómo se presenta y cómo aparece aquí.">
          <input className="field" value={env.assistantName} maxLength={30} onChange={e => s.setEnv('assistantName', e.target.value)} style={inputStyle(T)} />
        </Row>
        <Row title="Palabra de activación" sub="Lo que dices para despertarlo. Mejor 2–3 sílabas y poco común.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="field" value={env.wakeWord} maxLength={30} onChange={e => s.setEnv('wakeWord', e.target.value)} style={inputStyle(T)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, color: T.tx3 }}>También acepta:</span>
              {(variants.length ? variants : [w.toLowerCase()]).filter(Boolean).map(v => (
                <span key={v} style={{ fontFamily: MONO, fontSize: 11, padding: '3px 8px', borderRadius: 5, background: `rgba(${T.sf},0.06)`, color: T.tx2 }}>{v}</span>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: hint.color }}>{hint.text}</div>
          </div>
        </Row>
        <Row title="Tu nombre" sub="Para dirigirse a ti." last>
          <input className="field" value={env.userName} maxLength={40} placeholder="¿Cómo te llamo?" onChange={e => s.setEnv('userName', e.target.value)} style={inputStyle(T)} />
        </Row>
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Eyebrow>PERSONALIDAD</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
          {[['britanico', 'Británico', 'Elegante, con ironía'], ['cercano', 'Cercano', 'Cálido y directo'], ['formal', 'Escueto', 'Solo el dato']].map(([v, lab, sub]) => (
            <Choice key={v} active={env.persona === v} onClick={() => s.setEnv('persona', v)} style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: env.persona === v ? T.acc : T.tx2 }}>{lab}</div>
              <div style={{ fontSize: 11.5, color: T.tx3 }}>{sub}</div>
            </Choice>
          ))}
        </div>
        <div style={{ borderRadius: 10, background: T.well, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Eyebrow spacing=".1em">«¿QUÉ TIEMPO HARÁ MAÑANA?»</Eyebrow>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: T.acc }}>{preview}</div>
        </div>
        <div style={{ fontSize: 11.5, color: T.tx3 }}>Siempre 1 o 2 frases cortas, sin listas ni enlaces: todo se convierte en voz.</div>
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Eyebrow>CEREBRO · CLAUDE</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: conn.color }}><Dot color={conn.dot} />{conn.text}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
          {[['haiku', 'Haiku', 'Rápido, consume poco límite'], ['sonnet', 'Sonnet', 'Equilibrado'], ['opus', 'Opus', 'El más listo; más lento']].map(([v, lab, sub]) => (
            <Choice key={v} active={env.brain === v} onClick={() => s.setEnv('brain', v)} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: env.brain === v ? T.acc : T.tx2 }}>{lab}</div>
              <div style={{ fontSize: 11.5, color: T.tx3 }}>{sub}</div>
            </Choice>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Voz y oído
// ---------------------------------------------------------------------------

const VOICES: [string, string][] = [
  ['es-CO-GonzaloNeural', 'Gonzalo · Colombia'], ['es-CO-SalomeNeural', 'Salomé · Colombia'],
  ['es-ES-AlvaroNeural', 'Álvaro · España'], ['es-ES-ElviraNeural', 'Elvira · España'],
  ['es-MX-JorgeNeural', 'Jorge · México'], ['es-MX-DaliaNeural', 'Dalia · México'],
];
const WHISPER_NOTE: Record<string, string> = {
  tiny: '75 MB · muy rápido · comete más errores', base: '145 MB · rápido', small: '480 MB · equilibrado · recomendado',
  medium: '1,5 GB · más preciso · más lento', 'large-v3': '3 GB · máxima precisión · lento en Macs modestos',
};

function MicMeter({ on, sens }: { on: boolean; sens: number }) {
  const T = useT();
  const { api } = useStore();
  const ref = useRef<HTMLCanvasElement>(null);
  const hist = useRef<number[]>(new Array(64).fill(0));
  const noise = useRef(300);
  const sensRef = useRef(sens); sensRef.current = sens;
  const onRef = useRef(on); onRef.current = on;

  useEffect(() => {
    let alive = true, raf = 0;
    const poll = async () => {
      while (alive && onRef.current) {
        try {
          const r = await api.mic_level();
          noise.current = r.noise;
          hist.current.push(Math.min(1, r.level / 4000)); hist.current.shift();
        } catch { /* la ventana se cerró */ }
        await new Promise(res => setTimeout(res, 60));
      }
    };
    if (on) { api.mic_start().then(ok => { if (ok) poll(); }); } else hist.current = new Array(64).fill(0);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const el = ref.current; if (!el) return;
      const Wc = el.clientWidth, Hc = el.clientHeight; if (!Wc) return;
      const dpr = window.devicePixelRatio || 1;
      if (el.width !== Math.round(Wc * dpr)) { el.width = Math.round(Wc * dpr); el.height = Math.round(Hc * dpr); }
      const ctx = el.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, Wc, Hc);
      // mismo umbral que oido.py: max(450, ruido × sensibilidad)
      const thr = Math.min(.95, Math.max(450, noise.current * sensRef.current) / 4000);
      const n = hist.current.length, bw = Wc / n;
      for (let i = 0; i < n; i++) {
        const v = hist.current[i], h = Math.max(2, v * Hc);
        ctx.fillStyle = v > thr ? 'rgba(255,154,46,0.95)' : onRef.current ? lnc(T, 0.32) : lnc(T, 0.1);
        ctx.fillRect(i * bw + 1, Hc - h, Math.max(1, bw - 2), h);
      }
      const ty = Hc - thr * Hc;
      ctx.fillStyle = T.light ? 'rgba(166,82,0,0.85)' : 'rgba(255,207,128,0.7)';
      for (let x = 0; x < Wc; x += 6) ctx.fillRect(x, ty, 3, 1);
    };
    draw();
    return () => { alive = false; cancelAnimationFrame(raf); if (on) api.mic_stop(); };
  }, [on, api, T]);

  return <canvas ref={ref} style={{ width: '100%', height: 56, display: 'block' }} />;
}

export function Voz() {
  const T = useT();
  const s = useStore();
  const { env } = s;
  const [testing, setTesting] = useState(false);
  const [voiceErr, setVoiceErr] = useState('');
  const [mic, setMic] = useState(false);
  const voices = VOICES.some(v => v[0] === env.voice) ? VOICES : [[env.voice, env.voice] as [string, string], ...VOICES];
  const signed = (n: number, unit: string) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + unit;

  const testVoice = async () => {
    if (testing) return;
    setTesting(true); setVoiceErr('');
    s.setOrbState('speaking');
    try {
      const r = await s.api.test_voice(env.voice, env.rate, env.pitch);
      if (!r.ok && r.error !== 'ocupada') setVoiceErr(r.error || 'No pude reproducir la voz.');
    } finally { setTesting(false); s.setOrbState('idle'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
      <PageHead eyebrow="VOZ Y OÍDO · SE APLICA AL REINICIAR" title="Cómo habla y cómo escucha" />

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Eyebrow>VOZ · MICROSOFT EDGE</Eyebrow>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={env.voice} onChange={e => s.setEnv('voice', e.target.value)}
            style={{ ...inputStyle(T, false, { fontSize: 13, padding: '9px 10px' }), flex: 1, minWidth: 0 }}>
            {voices.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <PrimaryBtn onClick={testVoice} style={{ flex: 'none', minWidth: 104 }}>{testing ? 'Hablando…' : 'Probar voz'}</PrimaryBtn>
        </div>
        {voiceErr && <div style={{ fontSize: 12, color: T.red, marginTop: -8 }}>{voiceErr}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Slider label="Velocidad" display={signed(env.rate, ' %')} min={-50} max={50} step={1} value={env.rate} onChange={v => s.setEnv('rate', v)} />
          <Slider label="Tono" display={signed(env.pitch, ' Hz')} min={-20} max={20} step={1} value={env.pitch} onChange={v => s.setEnv('pitch', v)} />
        </div>
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>OÍDO · WHISPER LOCAL</Eyebrow>
          <select value={env.lang} onChange={e => s.setEnv('lang', e.target.value)}
            style={{ background: T.well, border: `1px solid rgba(${T.ln},0.12)`, borderRadius: 7, padding: '5px 8px', color: T.tx, font: 'inherit', fontSize: 12, outline: 'none' }}>
            <option value="es">Español</option><option value="en">English</option><option value="pt">Português</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* visual invertido: a la derecha = más sensible (JARVIS_WAKE_SENS más bajo) */}
          <Slider label={`Sensibilidad a «${env.wakeWord}»`} display={env.sens.toFixed(1) + '× ruido'} min={1} max={5} step={0.1}
            value={6 - env.sens} onChange={v => s.setEnv('sens', Math.round((6 - v) * 10) / 10)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.tx4 }}><span>Menos sensible</span><span>Más sensible · más falsas alarmas</span></div>
        </div>
        <div style={{ borderRadius: 10, background: T.well, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12.5, color: T.tx2 }}>{mic ? 'Di algo: lo que supere la línea activaría la escucha' : 'Prueba de micrófono'}</div>
            <SecondaryBtn small onClick={() => setMic(m => !m)} style={{ padding: '5px 10px' }}>{mic ? 'Detener' : 'Probar micrófono'}</SecondaryBtn>
          </div>
          <MicMeter on={mic} sens={env.sens} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13 }}>Modelo de transcripción</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6 }}>
            {['tiny', 'base', 'small', 'medium', 'large-v3'].map(v => (
              <Choice key={v} active={env.whisper === v} onClick={() => s.setEnv('whisper', v)}
                style={{ padding: '8px 6px', borderRadius: 8, textAlign: 'center', fontFamily: MONO, fontSize: 11.5, color: env.whisper === v ? T.acc : T.tx2 }}>{v}</Choice>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: T.tx3 }}>
            {WHISPER_NOTE[env.whisper]}{env.whisper !== s.base.whisper ? ' · se descargará la primera vez (necesita internet)' : ''}
          </div>
        </div>
      </Card>
    </div>
  );
}
