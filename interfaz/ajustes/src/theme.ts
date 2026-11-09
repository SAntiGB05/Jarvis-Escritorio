// Tokens de diseño (README del handoff → «Tokens de diseño»).

export const GOLD = '#FF9A2E';
export const GOLD_HOVER = '#FFAD52';
export const ON_GOLD = '#1A0F04';
export const BLUE = '#3D8BFF';
export const RED = '#FF4A3D';
export const MONO = "'JetBrains Mono', ui-monospace, monospace";
export const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, sans-serif";

export type Theme = {
  light: boolean; scheme: 'light' | 'dark';
  tx: string; tx2: string; tx3: string; tx4: string; tx5: string;
  acc: string; blue: string; red: string;
  ln: string; sf: string; well: string; stage: string; gauge: string; bar: string; win: string;
  knob: string; tgOff: string; lnA: string;
};

export function makeTheme(light: boolean): Theme {
  const lnc = (a: number) => (light ? `rgba(60,40,20,${Math.min(1, a * 1.8)})` : `rgba(255,236,210,${a})`);
  return light
    ? {
      light, scheme: 'light', tx: '#1C1814', tx2: '#3A332C', tx3: '#5F564C', tx4: '#746A60', tx5: '#A39A8F',
      acc: '#A65200', blue: '#1F5FD1', red: '#C4301F', ln: '60,40,20', sf: '60,40,20',
      well: 'rgba(255,255,255,0.8)', stage: 'radial-gradient(circle at 50% 45%, #2A2119 0%, #141210 75%)',
      gauge: '#F3EFE9', bar: 'rgba(250,247,242,0.95)', win: '#F6F3EE', knob: '#FFFFFF', tgOff: 'rgba(60,40,20,0.18)',
      lnA: lnc(0.1),
    }
    : {
      light, scheme: 'dark', tx: '#F2EDE6', tx2: '#D9D0C4', tx3: '#A39A8F', tx4: '#8A8177', tx5: '#5E5750',
      acc: '#FFCF80', blue: '#8DB8FF', red: '#FF8A80', ln: '255,236,210', sf: '255,240,220',
      well: 'rgba(0,0,0,0.3)', stage: 'rgba(0,0,0,0.28)', gauge: '#15120F', bar: 'rgba(30,25,20,0.92)',
      win: '#15120F', knob: '#D9D0C4', tgOff: 'rgba(255,240,220,0.14)', lnA: lnc(0.1),
    };
}

export const lnc = (T: Theme, a: number) => (T.light ? `rgba(60,40,20,${Math.min(1, a * 1.8)})` : `rgba(255,236,210,${a})`);

// Paletas del orbe [deep, mid, pale] (RGB 0–1)
export const PALETTES: Record<string, { label: string; c: number[][] }> = {
  dorado: { label: 'Dorado', c: [[1, 0.28, 0.02], [1, 0.52, 0.06], [1, 0.8, 0.45]] },
  azul: { label: 'Azul eléctrico', c: [[0, 0.12, 1], [0.02, 0.38, 1], [0.25, 0.68, 1]] },
  esmeralda: { label: 'Esmeralda', c: [[0, 0.4, 0.18], [0.05, 0.78, 0.45], [0.55, 1, 0.75]] },
  violeta: { label: 'Violeta', c: [[0.32, 0.02, 1], [0.6, 0.25, 1], [0.88, 0.7, 1]] },
  plata: { label: 'Plata', c: [[0.4, 0.45, 0.55], [0.72, 0.77, 0.86], [1, 1, 1]] },
};
export const DONE_C = PALETTES.azul.c;
export const ERR_C = [[0.55, 0.01, 0], [1, 0.03, 0.01], [1, 0.42, 0.3]];

export const STATES: Record<string, [string, string]> = {
  idle: ['En espera', '#FFCF80'], listening: ['Escuchando', '#FFCF80'], thinking: ['Pensando', '#FF9A2E'],
  speaking: ['Hablando', '#FF9A2E'], done: ['Completado', '#8DB8FF'], error: ['Error', '#FF8A80'],
};

export const rgb = (a: number[], al: number) => `rgba(${(a[0] * 255) | 0},${(a[1] * 255) | 0},${(a[2] * 255) | 0},${al})`;
