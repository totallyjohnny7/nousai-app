import type { SimClass, SimState, SliderConfig } from '../types';

export const gaussLawSliders: SliderConfig[] = [
  { key: 'chargeEnclosed', label: 'Charge Enclosed', unit: 'μC', min: -10, max: 10, step: 0.5, default: 3 },
  { key: 'surfaceRadius', label: 'Surface Radius', unit: 'm', min: 0.2, max: 3, step: 0.1, default: 1 },
  { key: 'permittivity', label: 'Permittivity', unit: 'ε₀', min: 0.5, max: 5, step: 0.1, default: 1 },
];

const EPSILON0 = 8.854e-12;

export const GaussLawSim: SimClass = {
  init(_w, _h, _params) {
    return { t: 0, animPhase: 0 };
  },

  update(state, _params, dt) {
    state.t += dt;
    state.animPhase += dt * 1.5;
    return state;
  },

  draw(ctx, state, params, w, h) {
    const cx = w / 2, cy = h / 2;
    const Q = params.chargeEnclosed;
    const rMax = Math.min(w, h) / 2 - 30;
    const surfR = (params.surfaceRadius / 3) * rMax;

    // Gaussian surface (dashed circle)
    ctx.strokeStyle = 'rgba(251,191,36,0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, surfR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(251,191,36,0.3)';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('Gaussian Surface', cx + surfR * 0.7, cy - surfR * 0.7);

    // Point charge at center
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = Q > 0 ? '#ef4444' : Q < 0 ? '#3b82f6' : '#666';
    ctx.fill();
    ctx.strokeStyle = Q > 0 ? '#f87171' : Q < 0 ? '#60a5fa' : '#888';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Q > 0 ? '+' : Q < 0 ? '−' : '0', cx, cy + 5);
    ctx.textAlign = 'start';

    // Radial E field arrows
    if (Math.abs(Q) > 0.01) {
      const numArrows = 16;
      const E = Math.abs(Q * 1e-6) / (4 * Math.PI * params.permittivity * EPSILON0 * params.surfaceRadius * params.surfaceRadius);
      const arrowLen = Math.min(40, E * 1e-6);

      for (let i = 0; i < numArrows; i++) {
        const angle = (i / numArrows) * Math.PI * 2;
        const startR = surfR - arrowLen / 2;
        const endR = surfR + arrowLen / 2;
        const dir = Q > 0 ? 1 : -1;

        const sx = cx + (dir > 0 ? startR : endR) * Math.cos(angle);
        const sy = cy + (dir > 0 ? startR : endR) * Math.sin(angle);
        const ex = cx + (dir > 0 ? endR : startR) * Math.cos(angle);
        const ey = cy + (dir > 0 ? endR : startR) * Math.sin(angle);

        // Pulsing animation
        const pulse = 0.4 + 0.3 * Math.sin(state.animPhase + i * 0.4);
        ctx.strokeStyle = `rgba(239,68,68,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Arrowhead
        const headAngle = Math.atan2(ey - sy, ex - sx);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 6 * Math.cos(headAngle - 0.4), ey - 6 * Math.sin(headAngle - 0.4));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 6 * Math.cos(headAngle + 0.4), ey - 6 * Math.sin(headAngle + 0.4));
        ctx.stroke();
      }
    }

    // Flux text
    const flux = (Q * 1e-6) / (params.permittivity * EPSILON0);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(`Φ = Q/ε = ${flux.toExponential(2)} N·m²/C`, 10, h - 15);
  },

  statLine(_state, params) {
    const E = Math.abs(params.chargeEnclosed * 1e-6) / (4 * Math.PI * params.permittivity * EPSILON0 * params.surfaceRadius * params.surfaceRadius);
    const flux = (params.chargeEnclosed * 1e-6) / (params.permittivity * EPSILON0);
    return `E: ${E.toExponential(2)} N/C | Φ: ${flux.toExponential(2)} N·m²/C | t: ${_state.t.toFixed(2)}s`;
  },
};
