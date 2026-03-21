/**
 * Adaptive Pomodoro — timer that adjusts based on study performance.
 *
 * - Retention >90%: auto-extend session by 5 min (flow state)
 * - Retention <70%: suggest early break (cognitive overload)
 * - 90+ minutes continuous: force 20-min break
 *
 * Based on Danziger et al. (2011) — decision quality degrades over time
 * but resets after breaks.
 */

export interface PomodoroState {
  isRunning: boolean;
  isPaused: boolean;
  totalSeconds: number;      // total session duration (adjustable)
  elapsedSeconds: number;    // time spent so far
  remainingSeconds: number;  // totalSeconds - elapsedSeconds
  autoExtended: boolean;     // true if timer was auto-extended
  breakSuggested: boolean;   // true if retention dropped
  forcedBreak: boolean;      // true if 90+ min reached
}

export function createPomodoro(durationMinutes: number = 25): PomodoroState {
  const totalSeconds = durationMinutes * 60;
  return {
    isRunning: false,
    isPaused: false,
    totalSeconds,
    elapsedSeconds: 0,
    remainingSeconds: totalSeconds,
    autoExtended: false,
    breakSuggested: false,
    forcedBreak: false,
  };
}

export function tickPomodoro(state: PomodoroState): PomodoroState {
  if (!state.isRunning || state.isPaused) return state;
  const elapsed = state.elapsedSeconds + 1;
  return {
    ...state,
    elapsedSeconds: elapsed,
    remainingSeconds: Math.max(0, state.totalSeconds - elapsed),
    forcedBreak: elapsed >= 90 * 60, // 90 minutes
  };
}

export function adaptPomodoro(
  state: PomodoroState,
  retentionRate: number // 0-1
): PomodoroState {
  let updated = { ...state };

  // Auto-extend if in flow (retention >90% and timer about to end)
  if (retentionRate > 0.9 && state.remainingSeconds <= 60 && state.remainingSeconds > 0 && !state.autoExtended) {
    updated.totalSeconds += 5 * 60; // +5 min
    updated.remainingSeconds += 5 * 60;
    updated.autoExtended = true;
  }

  // Suggest break if struggling (retention <70%)
  if (retentionRate < 0.7 && state.elapsedSeconds > 5 * 60) {
    updated.breakSuggested = true;
  }

  return updated;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
