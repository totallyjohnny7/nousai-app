import type { GradeCategory, GradeEntry, WhatIfEntry } from '../types';

// Scale to 100% if not all categories have grades yet (ungraded categories skipped)
export function calculateFinalGrade(
  categories: GradeCategory[],
  entries: GradeEntry[]
): { letter: string; percent: number; breakdown: Record<string, number> } {
  const totalWeight = categories.reduce((a, c) => a + c.weight, 0);
  if (Math.abs(totalWeight) < 0.01) return { letter: '—', percent: 0, breakdown: {} };

  let weightedSum = 0;
  let includedWeight = 0;
  const breakdown: Record<string, number> = {};

  for (const cat of categories) {
    const catEntries = entries.filter(
      e => e.categoryId === cat.id && !e.flags.includes('dropped') && e.score !== null
    );
    if (catEntries.length === 0) continue; // skip unassessed categories

    const catTotal = catEntries.reduce((a, e) => a + e.total, 0);
    if (catTotal === 0) continue; // divide-by-zero guard

    const catEarned = catEntries.reduce((a, e) => a + (e.score ?? 0), 0);
    const catPercent = catEarned / catTotal;
    breakdown[cat.name] = Math.round(catPercent * 100);
    weightedSum += catPercent * cat.weight;
    includedWeight += cat.weight;
  }

  if (includedWeight === 0) return { letter: '—', percent: 0, breakdown };

  const scaledPercent = (weightedSum / includedWeight) * 100;
  return { letter: percentToLetter(scaledPercent), percent: Math.round(scaledPercent), breakdown };
}

// What-if grade: same as calculateFinalGrade but adds what-if entries as if they were real entries
export function whatIfFinalGrade(
  categories: GradeCategory[],
  entries: GradeEntry[],
  whatIfEntries: WhatIfEntry[]
): { letter: string; percent: number } {
  const syntheticEntries: GradeEntry[] = whatIfEntries.map(w => ({
    id: `whatif-${w.id}`,
    categoryId: w.categoryId,
    name: w.name,
    score: w.hypotheticalScore,
    total: w.total,
    date: new Date().toISOString(),
    flags: [],
  }));
  const combined = [...entries, ...syntheticEntries];
  const result = calculateFinalGrade(categories, combined);
  return { letter: result.letter, percent: result.percent };
}

export function gradeTrend(entries: GradeEntry[]): 'up' | 'down' | 'neutral' {
  const gradedEntries = entries
    .filter(e => e.score !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (gradedEntries.length < 3) return 'neutral';
  const mid = Math.floor(gradedEntries.length / 2);
  const recentAvg = avg(gradedEntries.slice(mid));
  const olderAvg = avg(gradedEntries.slice(0, mid));
  if (recentAvg > olderAvg + 2) return 'up';
  if (recentAvg < olderAvg - 2) return 'down';
  return 'neutral';
}

function avg(entries: GradeEntry[]): number {
  const graded = entries.filter(e => e.score !== null && e.total > 0);
  if (graded.length === 0) return 0;
  return graded.reduce((a, e) => a + (e.score! / e.total) * 100, 0) / graded.length;
}

export function percentToLetter(p: number): string {
  if (p >= 93) return 'A';
  if (p >= 90) return 'A-';
  if (p >= 87) return 'B+';
  if (p >= 83) return 'B';
  if (p >= 80) return 'B-';
  if (p >= 77) return 'C+';
  if (p >= 73) return 'C';
  if (p >= 70) return 'C-';
  if (p >= 67) return 'D+';
  if (p >= 63) return 'D';
  if (p >= 60) return 'D-';
  return 'F';
}
