/**
 * Calibration Tracking — NousAI
 *
 * Tracks whether grades predict future performance.
 * Overconfidence: graded ≥3 but next review got 1.
 * Uses localStorage ring buffer (last 200 reviews).
 */

import type { CalibrationPoint, CalibrationStats } from '../types';

const LS_KEY = 'nousai-calibration';
const MAX_ENTRIES = 200;

function load(): CalibrationPoint[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(points: CalibrationPoint[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(points.slice(-MAX_ENTRIES)));
  } catch { /* storage full — skip silently */ }
}

export function recordCalibration(
  prevGrade: number,
  nextGrade: number,
  cardKey: string,
): void {
  const points = load();
  points.push({
    grade: prevGrade as 1|2|3|4,
    nextGrade: nextGrade as 1|2|3|4,
    cardKey,
    reviewedAt: new Date().toISOString(),
  });
  save(points);
}

export function computeCalibrationStats(): CalibrationStats {
  const points = load();
  if (points.length < 5) {
    return { score: 100, overconfidenceRate: 0, underconfidenceRate: 0 };
  }

  let correct = 0;
  let overconfident = 0;
  let underconfident = 0;

  for (const p of points) {
    // Correct calibration: grade matches next performance direction
    if (Math.abs(p.grade - p.nextGrade) <= 1) correct++;
    // Overconfident: said Good/Easy but next was Again
    if (p.grade >= 3 && p.nextGrade === 1) overconfident++;
    // Underconfident: said Again/Hard but next was Easy
    if (p.grade <= 2 && p.nextGrade === 4) underconfident++;
  }

  return {
    score: Math.round((correct / points.length) * 100),
    overconfidenceRate: Math.round((overconfident / points.length) * 100),
    underconfidenceRate: Math.round((underconfident / points.length) * 100),
  };
}

export function getCalibrationPoints(): CalibrationPoint[] {
  return load();
}
