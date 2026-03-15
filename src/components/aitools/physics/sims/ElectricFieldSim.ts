import type { SimClass, SimState, SliderConfig } from '../types';

export const electricFieldSliders: SliderConfig[] = [
  { key: 'charge1', label: 'Charge 1', unit: 'μC', min: -10, max: 10, step: 0.5, default: 3 },
  { key: 'charge2', label: 'Charge 2', unit: 'μC', min: -10, max: 10, step: 0.5, default: -3 },
  { key: 'distance', label: 'Distance', unit: 'm', min: 0.5, max: 5, step: 0.1, default: 2.5 },
];

export const ElectricFieldSim: SimClass = {
  init(w, h, params) {
    const gap = (params.distance / 5) * w;
    const cx = w / 2;
    return {
      charges: [
        { x: cx - gap / 2, y: h / 2, q: params.charge1 },
        { x: cx + gap / 2, y: h / 2, q: params.charge2 },
      ],
      t: 0,
    };
  },

  update(state, _params, dt) {
    state.t += dt;
    return state;
  },

  draw(ctx, state, _params, w, h) {
    const charges = state.charges as { x: number; y: number; q: number }[];

    // Draw field lines on a grid
    for (let gx = 20; gx < w; gx += 30) {
      for (let gy = 20; gy < h; gy += 30) {
        let ex = 0, ey = 0;
        charges.forEach(c => {
          const dx = gx - c.x, dy = gy - c.y;
          const r2 = dx * dx + dy * dy;
          if (r2 < 400) return;
          const r = Math.sqrt(r2);
          const e = c.q * 5000 / r2;
          ex += e * dx / r;
          ey += e * dy / r;
        });
        const mag = Math.sqrt(ex * ex + ey * ey);
        if (mag < 0.01) continue;
        const len = Math.min(12, mag * 8);
        const nx = ex / mag, ny = ey / mag;
        ctx.strokeStyle = `rgba(99,102,241,${Math.min(0.6, mag * 3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + nx * len, gy + ny * len);
        ctx.stroke();
      }
    }

    // Draw charges
    charges.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = c.q > 0 ? '#ef4444' : '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = c.q > 0 ? '#f87171' : '#60a5fa';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.q > 0 ? '+' : '−', c.x, c.y + 5);
      ctx.textAlign = 'start';
    });
  },

  statLine(state, params) {
    const k = 8.99e9;
    const r = params.distance || 1;
    const F = k * Math.abs(params.charge1 * 1e-6) * Math.abs(params.charge2 * 1e-6) / (r * r);
    const E = k * Math.abs(params.charge1 * 1e-6) / (r * r);
    return `E: ${E.toExponential(2)} N/C | F: ${F.toExponential(2)} N | t: ${state.t.toFixed(2)}s`;
  },
};
