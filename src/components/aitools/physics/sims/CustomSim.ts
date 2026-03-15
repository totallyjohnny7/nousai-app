import type { SimClass, SimState } from '../types';

/**
 * Creates a SimClass from a user-defined equation string.
 * The equation should be of the form: A*sin(k*x - w*t)
 * Variables in the equation correspond to slider keys.
 */
export function createCustomSimClass(equation: string): SimClass {
  let evalFn: (x: number, t: number, p: Record<string, number>) => number;

  try {
    // Build function with Math methods available and slider params accessible
    const fn = new Function(
      'x', 't', 'p', 'M',
      `try { with(p) { with(M) { return ${equation}; } } } catch(e) { return 0; }`
    ) as (x: number, t: number, p: Record<string, number>, M: typeof Math) => number;
    evalFn = (x, t, p) => fn(x, t, p, Math);
  } catch {
    evalFn = () => 0;
  }

  return {
    init(_w, _h, _params) {
      return { t: 0 };
    },

    update(state, _params, dt) {
      state.t += dt;
      return state;
    },

    draw(ctx, state, params, w, h) {
      const midY = h / 2;

      // Center line
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();
      ctx.setLineDash([]);

      // Plot equation
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      for (let px = 0; px < w; px++) {
        const x = (px / w) * 10; // map pixel to 0-10 range
        const y = evalFn(x, state.t, params);
        const screenY = midY - y * 30; // scale output
        if (!isFinite(screenY)) continue;
        if (!started) { ctx.moveTo(px, screenY); started = true; }
        else ctx.lineTo(px, screenY);
      }
      ctx.stroke();

      // Axes labels
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('x →', w - 30, midY + 15);
      ctx.fillText('y ↑', 5, 15);
    },

    statLine(state, _params) {
      return `Custom | t: ${state.t.toFixed(2)}s`;
    },
  };
}
