import type { SimClass, SimState, SliderConfig } from '../types';

export const emPointChargesSliders: SliderConfig[] = [
  { key: 'charge', label: 'Charge', unit: 'μC', min: -10, max: 10, step: 0.5, default: 2 },
  { key: 'velocity', label: 'Velocity', unit: 'm/s', min: 1, max: 100, step: 1, default: 30 },
  { key: 'bField', label: 'B Field', unit: 'T', min: 0.1, max: 5, step: 0.1, default: 1 },
];

export const EMPointChargesSim: SimClass = {
  init(w, h, params) {
    return {
      x: w / 2,
      y: h / 2,
      vx: params.velocity * 0.5,
      vy: 0,
      trail: [] as { x: number; y: number }[],
      t: 0,
    };
  },

  update(state, params, dt) {
    state.t += dt;
    const q = params.charge * 1e-6;
    const B = params.bField;
    // Lorentz force: F = qv × B (B along z-axis, motion in xy)
    // ax = q*vy*B/m, ay = -q*vx*B/m  (assuming unit mass for vis)
    const scale = 500;
    const ax = q * state.vy * B * scale;
    const ay = -q * state.vx * B * scale;
    state.vx += ax * dt;
    state.vy += ay * dt;
    state.x += state.vx * dt * 3;
    state.y += state.vy * dt * 3;
    state.trail.push({ x: state.x, y: state.y });
    if (state.trail.length > 500) state.trail.shift();
    return state;
  },

  draw(ctx, state, _params, _w, _h) {
    const trail = state.trail as { x: number; y: number }[];

    // Trail
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(168,85,247,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      trail.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }

    // Charge particle
    ctx.beginPath();
    ctx.arc(state.x, state.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#a855f7';
    ctx.fill();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Velocity arrow
    const vMag = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
    if (vMag > 0.1) {
      const arrowLen = 25;
      const nx = state.vx / vMag, ny = state.vy / vMag;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(state.x, state.y);
      ctx.lineTo(state.x + nx * arrowLen, state.y + ny * arrowLen);
      ctx.stroke();
    }

    // B field indicator (into screen dots)
    ctx.fillStyle = 'rgba(96,165,250,0.2)';
    ctx.font = '16px sans-serif';
    for (let x = 40; x < _w; x += 60) {
      for (let y = 40; y < _h; y += 60) {
        ctx.fillText('⊗', x - 6, y + 6);
      }
    }
  },

  statLine(state, params) {
    const v = Math.sqrt(state.vx * state.vx + state.vy * state.vy).toFixed(1);
    return `q: ${params.charge}μC | v: ${v} m/s | B: ${params.bField}T | t: ${state.t.toFixed(2)}s`;
  },
};
