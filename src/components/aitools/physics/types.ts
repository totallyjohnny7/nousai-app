/* ── Physics Sim Types ────────────────────────────────── */

export interface SliderConfig {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface SimState {
  [key: string]: any;
  t: number;
}

export interface SimClass {
  init(w: number, h: number, params: Record<string, number>): SimState;
  update(state: SimState, params: Record<string, number>, dt: number, w: number, h: number): SimState;
  draw(ctx: CanvasRenderingContext2D, state: SimState, params: Record<string, number>, w: number, h: number): void;
  statLine(state: SimState, params: Record<string, number>): string;
}

export interface SimDef {
  id: string;
  title: string;
  subtitle: string;
  type: 'canvas' | 'phet';
  sliders?: SliderConfig[];
  sim?: SimClass;
  phetUrl?: string;
}
