import { describe, it, expect } from 'vitest';
import { __test__ } from './cloudSync';
import { validateWrite } from './writeGuard';
import type { NousAIData, Course } from '../types';

const { mergeWithTombstones, cleanTombstones } = __test__;

// ── Helpers ───────────────────────────────────────────────
function makeData(overrides: Partial<{
  courses: Partial<Course>[];
  deletionLog: { id: string; entityType: string; deletedAt: number }[];
  notes: { id: string; title?: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[];
  gamificationData: { xp: number };
}>): NousAIData {
  return {
    settings: { aiProvider: 'openai', canvasUrl: '', canvasToken: '', canvasIcalUrl: '', canvasEvents: [] },
    pluginData: {
      quizHistory: [],
      coachData: {
        courses: (overrides.courses || []).map(c => ({
          id: c.id || 'c1',
          name: c.name || 'Test',
          shortName: c.shortName || 'T',
          color: c.color || '#000',
          topics: c.topics || [],
          flashcards: c.flashcards || [],
          deleted: c.deleted,
          deletedAt: c.deletedAt,
          updatedAt: c.updatedAt,
        })) as Course[],
        sessions: [],
        streak: 0,
        totalStudyMinutes: 0,
        weeklyPlan: null,
      },
      proficiencyData: {} as NousAIData['pluginData']['proficiencyData'],
      srData: {} as NousAIData['pluginData']['srData'],
      timerState: {} as NousAIData['pluginData']['timerState'],
      gamificationData: (overrides.gamificationData || { xp: 0 }) as NousAIData['pluginData']['gamificationData'],
      quizBank: {},
      notes: overrides.notes as NousAIData['pluginData']['notes'],
      deletionLog: overrides.deletionLog || [],
    },
  };
}

// ═══════════════════════════════════════════════════════════
// mergeWithTombstones
// ═══════════════════════════════════════════════════════════
describe('mergeWithTombstones', () => {
  it('merges courses from both sides', () => {
    const local = makeData({ courses: [{ id: 'c1', name: 'Physics' }] });
    const cloud = makeData({ courses: [{ id: 'c2', name: 'Biology' }] });
    const result = mergeWithTombstones(local, cloud);
    const ids = result.pluginData.coachData.courses.map(c => c.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
  });

  it('respects cloud deletionLog — skips locally alive item that cloud deleted', () => {
    const local = makeData({ courses: [{ id: 'c1', name: 'Physics' }] });
    const cloud = makeData({
      courses: [],
      deletionLog: [{ id: 'c1', entityType: 'course', deletedAt: Date.now() }],
    });
    const result = mergeWithTombstones(local, cloud);
    const ids = result.pluginData.coachData.courses.map(c => c.id);
    expect(ids).not.toContain('c1');
  });

  it('respects local deletionLog — skips cloud alive item that local deleted', () => {
    const local = makeData({
      courses: [],
      deletionLog: [{ id: 'c2', entityType: 'course', deletedAt: Date.now() }],
    });
    const cloud = makeData({ courses: [{ id: 'c2', name: 'Biology' }] });
    const result = mergeWithTombstones(local, cloud);
    const ids = result.pluginData.coachData.courses.map(c => c.id);
    expect(ids).not.toContain('c2');
  });

  it('per-card merge: combines flashcards from both sides within a course', () => {
    const local = makeData({
      courses: [{
        id: 'c1', name: 'Physics',
        flashcards: [{ id: 'f1', front: 'Q1', back: 'A1' }],
      }],
    });
    const cloud = makeData({
      courses: [{
        id: 'c1', name: 'Physics',
        flashcards: [{ id: 'f2', front: 'Q2', back: 'A2' }],
      }],
    });
    const result = mergeWithTombstones(local, cloud);
    const course = result.pluginData.coachData.courses.find(c => c.id === 'c1')!;
    const cardIds = course.flashcards.map((f: { id?: string }) => f.id);
    expect(cardIds).toContain('f1');
    expect(cardIds).toContain('f2');
  });

  it('per-card merge: deleted card stays deleted even if other side has it alive', () => {
    const now = Date.now();
    const local = makeData({
      courses: [{
        id: 'c1', name: 'Physics',
        flashcards: [{ id: 'f1', front: 'Q1', back: 'A1', deleted: true, deletedAt: now }],
      }],
    });
    const cloud = makeData({
      courses: [{
        id: 'c1', name: 'Physics',
        flashcards: [{ id: 'f1', front: 'Q1', back: 'A1' }],
      }],
    });
    const result = mergeWithTombstones(local, cloud);
    const course = result.pluginData.coachData.courses.find(c => c.id === 'c1')!;
    const card = course.flashcards.find((f: { id?: string }) => f.id === 'f1') as { deleted?: boolean };
    expect(card.deleted).toBe(true);
  });

  it('merges deletionLogs from both sides without duplicates', () => {
    const local = makeData({
      deletionLog: [{ id: 'x1', entityType: 'note', deletedAt: 100 }],
    });
    const cloud = makeData({
      deletionLog: [
        { id: 'x1', entityType: 'note', deletedAt: 100 },
        { id: 'x2', entityType: 'course', deletedAt: 200 },
      ],
    });
    const result = mergeWithTombstones(local, cloud);
    const ids = result.pluginData.deletionLog!.map(e => e.id);
    expect(ids).toEqual(['x1', 'x2']);
  });

  it('gamification: keeps higher XP', () => {
    const local = makeData({ gamificationData: { xp: 500 } });
    const cloud = makeData({ gamificationData: { xp: 800 } });
    const result = mergeWithTombstones(local, cloud);
    expect((result.pluginData.gamificationData as { xp: number }).xp).toBe(800);
  });

  it('gamification: local wins when higher', () => {
    const local = makeData({ gamificationData: { xp: 1200 } });
    const cloud = makeData({ gamificationData: { xp: 300 } });
    const result = mergeWithTombstones(local, cloud);
    expect((result.pluginData.gamificationData as { xp: number }).xp).toBe(1200);
  });
});

// ═══════════════════════════════════════════════════════════
// cleanTombstones
// ═══════════════════════════════════════════════════════════
describe('cleanTombstones', () => {
  it('keeps items deleted less than 30 days ago', () => {
    const recent = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days ago
    const data = makeData({
      courses: [{ id: 'c1', name: 'Test', deleted: true, deletedAt: recent }],
      deletionLog: [{ id: 'c1', entityType: 'course', deletedAt: recent }],
    });
    const result = cleanTombstones(data);
    expect(result.pluginData.coachData.courses).toHaveLength(1);
    expect(result.pluginData.deletionLog).toHaveLength(1);
  });

  it('removes items deleted more than 30 days ago', () => {
    const old = Date.now() - 45 * 24 * 60 * 60 * 1000; // 45 days ago
    const data = makeData({
      courses: [{ id: 'c1', name: 'Test', deleted: true, deletedAt: old }],
      deletionLog: [{ id: 'c1', entityType: 'course', deletedAt: old }],
    });
    const result = cleanTombstones(data);
    expect(result.pluginData.coachData.courses).toHaveLength(0);
    expect(result.pluginData.deletionLog).toHaveLength(0);
  });

  it('keeps non-deleted items regardless of age', () => {
    const data = makeData({
      courses: [{ id: 'c1', name: 'Active Course' }],
    });
    const result = cleanTombstones(data);
    expect(result.pluginData.coachData.courses).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════
// writeGuard (validateWrite)
// ═══════════════════════════════════════════════════════════
describe('validateWrite', () => {
  it('accepts valid data with no old data', () => {
    const data = makeData({ courses: [{ id: 'c1', name: 'Test' }] });
    expect(validateWrite(data, null)).toEqual({ valid: true });
  });

  it('rejects null/undefined data', () => {
    const result = validateWrite(null as unknown as NousAIData, null);
    expect(result.valid).toBe(false);
  });

  it('rejects data missing pluginData', () => {
    const result = validateWrite({ settings: {} } as NousAIData, null);
    expect(result.valid).toBe(false);
  });

  it('rejects data missing settings', () => {
    const result = validateWrite({ pluginData: {} } as NousAIData, null);
    expect(result.valid).toBe(false);
  });

  it('blocks >90% card loss', () => {
    const oldData = makeData({
      courses: [{
        id: 'c1', name: 'Test',
        flashcards: Array.from({ length: 100 }, (_, i) => ({ id: `f${i}`, front: `Q${i}`, back: `A${i}` })),
      }],
    });
    const newData = makeData({
      courses: [{
        id: 'c1', name: 'Test',
        flashcards: [{ id: 'f0', front: 'Q0', back: 'A0' }],
      }],
    });
    const result = validateWrite(newData, oldData);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('90%');
  });

  it('allows normal card count changes', () => {
    const oldData = makeData({
      courses: [{
        id: 'c1', name: 'Test',
        flashcards: Array.from({ length: 20 }, (_, i) => ({ id: `f${i}`, front: `Q${i}`, back: `A${i}` })),
      }],
    });
    const newData = makeData({
      courses: [{
        id: 'c1', name: 'Test',
        flashcards: Array.from({ length: 15 }, (_, i) => ({ id: `f${i}`, front: `Q${i}`, back: `A${i}` })),
      }],
    });
    expect(validateWrite(newData, oldData).valid).toBe(true);
  });

  it('blocks deletion of all courses', () => {
    const oldData = makeData({ courses: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }] });
    const newData = makeData({ courses: [] });
    const result = validateWrite(newData, oldData);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('courses');
  });

  it('ignores soft-deleted courses in count', () => {
    const oldData = makeData({ courses: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }] });
    const newData = makeData({
      courses: [
        { id: 'c1', name: 'A' },
        { id: 'c2', name: 'B', deleted: true, deletedAt: Date.now() },
      ],
    });
    // One active course remains — should be valid
    expect(validateWrite(newData, oldData).valid).toBe(true);
  });
});
