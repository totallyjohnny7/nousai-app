/**
 * Schema Versioning + Migration Runner for NousAI
 *
 * When the app adds new fields or restructures data, migrations run
 * once per IDB record (tracked by schemaVersion).
 *
 * Safety contract:
 *  - If a migration throws, the old data is kept as-is and an error is logged.
 *  - Migrations are idempotent — safe to re-run.
 *  - Version bumps forward only (never downgrade).
 */

import type { NousAIData, GamificationData } from '../types';

// ── Current schema version ─────────────────────────────────────────────────────

export const CURRENT_SCHEMA_VERSION = 3;

// ── Migration definitions ──────────────────────────────────────────────────────

type MigrationFn = (data: NousAIData) => NousAIData;

interface Migration {
  version: number;       // the version this migration produces
  description: string;
  run: MigrationFn;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initialize schemaVersion field',
    run: (data) => {
      // No-op: just marks data as having been through migration system
      return data;
    },
  },
  {
    version: 2,
    description: 'Fill missing gamificationData fields added in v1.3',
    run: (data) => {
      const g = data.pluginData?.gamificationData as Partial<GamificationData> | undefined;
      if (!g) return data;

      const patched: GamificationData = {
        xp: g.xp ?? 0,
        level: g.level ?? 1,
        totalQuizzes: g.totalQuizzes ?? 0,
        totalCorrect: g.totalCorrect ?? 0,
        totalAnswered: g.totalAnswered ?? 0,
        totalMinutes: g.totalMinutes ?? 0,
        streak: g.streak ?? 0,
        bestStreak: g.bestStreak ?? 0,
        streakFreezes: g.streakFreezes ?? 0,
        lastStudyDate: g.lastStudyDate ?? null,
        perfectScores: g.perfectScores ?? 0,
        badges: Array.isArray(g.badges) ? g.badges : [],
        dailyGoal: {
          todayXp: g.dailyGoal?.todayXp ?? 0,
          todayMinutes: g.dailyGoal?.todayMinutes ?? 0,
          todayQuestions: g.dailyGoal?.todayQuestions ?? 0,
          targetXp: g.dailyGoal?.targetXp ?? 100,
        },
      };

      return {
        ...data,
        pluginData: {
          ...data.pluginData,
          gamificationData: patched,
        },
      };
    },
  },
  {
    version: 3,
    description: 'Ensure coachData.courses is always an array; normalize course topics',
    run: (data) => {
      const coach = data.pluginData?.coachData;
      if (!coach) return data;

      const courses = Array.isArray(coach.courses) ? coach.courses : [];
      const normalizedCourses = courses.map((c) => ({
        ...c,
        topics: Array.isArray(c.topics) ? c.topics : [],
        flashcards: Array.isArray(c.flashcards) ? c.flashcards : [],
        modules: Array.isArray(c.modules) ? c.modules : [],
      }));

      return {
        ...data,
        pluginData: {
          ...data.pluginData,
          coachData: {
            ...coach,
            courses: normalizedCourses,
            sessions: Array.isArray(coach.sessions) ? coach.sessions : [],
          },
        },
      };
    },
  },
];

// ── Migration runner ───────────────────────────────────────────────────────────

/**
 * Run all pending migrations on data loaded from IDB.
 *
 * @param data   - raw data from IDB (may be from any past version)
 * @returns      - migrated data at CURRENT_SCHEMA_VERSION
 */
export function runMigrations(data: NousAIData): NousAIData {
  const currentVersion: number = (data as NousAIData & { __schemaVersion?: number }).__schemaVersion ?? 0;

  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    return data; // already up to date
  }

  console.log(
    `[MIGRATIONS] Running migrations v${currentVersion} → v${CURRENT_SCHEMA_VERSION}`
  );

  let migrated = data;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue; // already applied

    try {
      console.log(`[MIGRATIONS] Applying v${migration.version}: ${migration.description}`);
      migrated = migration.run(migrated);
    } catch (e) {
      // Safety: log the error but keep old data — never corrupt
      console.error(
        `[MIGRATIONS] Migration v${migration.version} failed — keeping existing data:`,
        e
      );
      // Don't apply further migrations if this one failed
      // (they may depend on previous migration's output)
      break;
    }
  }

  // Stamp the version
  (migrated as NousAIData & { __schemaVersion: number }).__schemaVersion = CURRENT_SCHEMA_VERSION;

  return migrated;
}

/**
 * Read the schema version from a data object.
 */
export function getSchemaVersion(data: NousAIData): number {
  return (data as NousAIData & { __schemaVersion?: number }).__schemaVersion ?? 0;
}
