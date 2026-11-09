import React, { createContext, useContext } from 'react';
import { GOLD, MONO, ON_GOLD, type Theme } from './theme';

export const ThemeCtx = createContext<Theme>(null as unknown as Theme);
export const useT = () => useContext(ThemeCtx);

type Kids = { children?: React.ReactNode };

export function Eyebrow({ children, size = 10, spacing = '.14em', style }: Kids & { size?: number; spacing?: string; style?: React.CSSProperties }) {
  const T = useT();
  return <div style={{ fontFamily: MONO, fontSize: size, letterSpacing: spacing, color: T.tx4, ...style }}>{children}</div>;
}

export function PageHead({ eyebrow, title, sub, right }: { eyebrow: string; title: React.ReactNode; sub?: string; right?: React.ReactNode }) {
  const T = useT();
  const head = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Eyebrow size={10.5}>{eyebrow}</Eyebrow>
      <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: T.tx3, textWrap: 'pretty' } as React.CSSProperties}>{sub}</div>}
    </div>
  );
  if (!right) return head;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      {head}{right}
    </div>
  );
}

export function Card({ children, style, onClick, className }: Kids & { style?: React.CSSProperties; onClick?: () => void; className?: string }) {
  const T = useT();
  return (
    <div onClick={onClick} className={className}
      style={{ borderRadius: 14, border: `1px solid rgba(${T.ln},0.08)`, background: `rgba(${T.sf},0.03)`, padding: 18, ...style }}>
      {children}
    </div>
  );
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  const T = useT();
  return (
    <div role="switch" aria-checked={on} onClick={onClick}
      style={{ width: 34, height: 20, borderRadius: 10, background: on ? GOLD : T.tgOff, padding: 2, cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <div style={{ width: 16, height: 16, borderRadius: 8, background: on ? ON_GOLD : T.knob, transform: `translateX(${on ? 14 : 0}px)`, transition: 'transform .2s' }} />
    </div>
  );
}

export function PrimaryBtn({ children, onClick, style, disabled }: Kids & { onClick?: () => void; style?: React.CSSProperties; disabled?: boolean }) {
  return (
    <button className="btn-primary" onClick={onClick} disabled={disabled}
      style={{ background: GOLD, color: ON_GOLD, border: 'none', borderRadius: 8, padding: '8px 14px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', ...style }}>
      {children}
    </button>
  );
}

export function SecondaryBtn({ children, onClick, style, small }: Kids & { onClick?: () => void; style?: React.CSSProperties; small?: boolean }) {
  const T = useT();
  return (
    <button className="btn-sec" onClick={onClick}
      style={{ background: `rgba(${T.sf},0.05)`, color: T.tx, border: `1px solid rgba(${T.ln},0.1)`, borderRadius: small ? 7 : 8,
        padding: small ? '6px 10px' : '7px 12px', font: 'inherit', fontSize: small ? 12 : 12.5, cursor: 'pointer', whiteSpace: 'nowrap', ...style }}>
      {children}
    </button>
  );
}

export function inputStyle(T: Theme, mono = false, extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: T.well, border: `1px solid rgba(${T.ln},0.12)`, borderRadius: 8, padding: mono ? '8px 11px' : '9px 12px',
    color: T.tx, outline: 'none', width: '100%', ...(mono ? { fontFamily: MONO, fontSize: 12 } : { font: 'inherit', fontSize: 14 }), ...extra,
  };
}

/** Opción seleccionable (personalidad, cerebro, modelo de Whisper). */
export function Choice({ active, onClick, children, style }: Kids & { active: boolean; onClick: () => void; style?: React.CSSProperties }) {
  const T = useT();
  return (
    <div onClick={onClick} className="hov"
      style={{ borderRadius: 9, border: `1px solid ${active ? 'rgba(255,154,46,0.5)' : T.lnA}`, background: active ? 'rgba(255,154,46,0.12)' : 'transparent', cursor: 'pointer', ...style }}>
      {children}
    </div>
  );
}

export function Pill({ ok, okText, noText }: { ok: boolean; okText: string; noText?: string }) {
  const T = useT();
  return (
    <div style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap', background: ok ? 'rgba(61,139,255,0.12)' : 'rgba(255,154,46,0.12)', color: ok ? T.blue : T.acc }}>
      {ok ? okText : noText}
    </div>
  );
}

export function Dot({ color, size = 6, glow }: { color: string; size?: number; glow?: boolean }) {
  return <div style={{ width: size, height: size, borderRadius: size / 2, background: color, flex: 'none', boxShadow: glow ? `0 0 10px ${color}` : undefined }} />;
}

export function Slider({ label, display, min, max, step, value, onChange }: { label: React.ReactNode; display: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  const T = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>{label}</span><span style={{ fontFamily: MONO, fontSize: 11.5, color: T.acc }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </div>
  );
}
