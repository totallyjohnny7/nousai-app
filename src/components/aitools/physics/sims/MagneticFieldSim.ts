import type { SimClass, SimState, SliderConfig } from '../types';

export const magneticFieldSliders: SliderConfig[] = [
  { key: 'current', label: 'Current', unit: 'A', min: 0.1, max: 20, step: 0.1, default: 5 },
  { key: 'wireLength', label: 'Wire Length', unit: 'm', min: 0.5, max: 5, step: 0.1, default: 2 },
  { key: 'distFromWire', label: 'Distance', unit: 'm', min: 0.1, max: 3, step: 0.05, default: 0.5 },
];

const MU0 = 4 * Math.PI * 1e-7;

export const MagneticFieldSim: SimClass = {
  init(_w, _h, _params) {
    return { t: 0, animPhase: 0 };
  },

  update(state, _params, dt) {
    state.t += dt;
    state.animPhase += dt * 2;
    return state;
  },

  draw(ctx, state, params, w, h) {
    const cx = w / 2, cy = h / 2;
    const I = params.current;

    // Wire cross-section (current going into screen)
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();
    // X mark for current into screen
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5); ctx.stroke();

    // Concentric B field circles
    const maxR = Math.min(w, h) / 2 - 20;
    const numRings = 8;
    for (let i = 1; i <= numRings; i++) {
      const r = (i / numRings) * maxR;
      const rMeters = (i / numRings) * 3; // map to 0-3m
      const B = MU0 * I / (2 * Math.PI * rMeters);
      const alpha = Math.min(0.6, B * 1e5);

      ctx.strokeStyle = `rgba(59,130,246,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Direction arrows on each ring
      const numArrows = 4;
      for (let a = 0; a < numArrows; a++) {
        const angle = (a / numArrows) * Math.PI * 2 + state.animPhase;
        const ax = cx + r * Math.cos(angle);
        const ay = cy + r * Math.sin(angle);
        const tangentAngle = angle + Math.PI / 2;
        const arrowSize = 6;
        ctx.fillStyle = `rgba(96,165,250,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(ax + arrowSize * Math.cos(tangentAngle), ay + arrowSize * Math.sin(tangentAngle));
        ctx.lineTo(ax + arrowSize * Math.cos(tangentAngle + 2.5), ay + arrowSize * Math.sin(tangentAngle + 2.5));
        ctx.lineTo(ax + arrowSize * Math.cos(tangentAngle - 2.5), ay + arrowSize * Math.sin(tangentAngle - 2.5));
        ctx.fill();
      }
    }

    // Distance indicator line
    const distPx = (params.distFromWire / 3) * maxR;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + distPx, cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(`r = ${params.distFromWire}m`, cx + distPx / 2 - 15, cy - 8);
  },

  statLine(_state, params) {
    const B = MU0 * params.current / (2 * Math.PI * params.distFromWire);
    return `B: ${B.toExponential(2)} T | I: ${params.current}A | r: ${params.distFromWire}m`;
  },
};
