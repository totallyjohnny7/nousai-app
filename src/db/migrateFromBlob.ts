/**
 * Migration: old monolithic IDB blob → RxDB per-document collections.
 *
 * Reads the single 'main' key from the old 'nousai-companion' IDB database,
 * decomposes it into individual RxDB documents, and bulk-inserts them.
 *
 * Safety:
 * - Old database is NOT deleted (kept as rollback backup for 30 days)
 * - Migration is idempotent (skips if already done)
 * - Golden copy is untouched (separate IDB database)
 * - If migration fails, the app falls back to the old code path
 */
import type { RxDatabase } from 'rxdb';
import type { NousAIData, Course } from '../types';
// Many stored entities have extra fields not in the strict TS interfaces,
// so we use 'any' casts for the migration deserialization.

const OLD_DB_NAME = 'nousai-companion';
const OLD_STORE_NAME = 'appdata';
const MIGRATION_FLAG = 'nousai-rxdb-migrated';
const MIGRATION_BACKUP_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Check if migration was already completed */
export function isMigrated(): boolean {
  return localStorage.getItem(MIGRATION_FLAG) === 'true';
}

/** Read old blob from the legacy IDB database */
async function readOldBlob(): Promise<NousAIData | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(OLD_DB_NAME);
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OLD_STORE_NAME)) {
          db.close();
          resolve(null);
          return;
        }
        const tx = db.transaction(OLD_STORE_NAME, 'readonly');
        const getReq = tx.objectStore(OLD_STORE_NAME).get('main');
        getReq.onsuccess = () => {
          db.close();
          resolve(getReq.result || null);
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    } catch {
      resolve(null);
    }
  });
}

/** Generate a stable ID for entities that don't have one */
function stableId(prefix: string, index: number): string {
  return `${prefix}_${String(index).padStart(6, '0')}`;
}

/** Get current ISO timestamp */
function now(): string {
  return new Date().toISOString();
}

/**
 * Run the migration: decompose old blob → RxDB collections.
 * Returns true if migration ran, false if skipped (already done or no data).
 */
export async function migrateFromBlob(db: RxDatabase): Promise<boolean> {
  if (isMigrated()) {
    console.log('[MIGRATION] Already migrated to RxDB — skipping');
    return false;
  }

  const oldData = await readOldBlob();
  if (!oldData) {
    console.log('[MIGRATION] No old IDB data found — fresh install');
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return false;
  }

  console.log('[MIGRATION] Starting blob → RxDB migration...');
  const startTime = Date.now();
  const pd = oldData.pluginData;
  let errors = 0;

  // Helper: wrap each collection migration so one failure doesn't abort everything
  async function safeUpsert(label: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      errors++;
      console.error(`[MIGRATION] ${label} failed (non-fatal):`, e);
    }
  }

  try {
    // ── Courses ──────────────────────────────────
    const courses = pd?.coachData?.courses ?? [];
    if (courses.length > 0) {
      await db.courses.bulkUpsert(courses.map((c: Course) => ({
        id: c.id,
        name: c.name || 'Untitled',
        shortName: c.shortName || '',
        color: c.color || '#666',
        emoji: (c as any).emoji || '',
        topics: c.topics || [],
        flashcards: c.flashcards || [],
        modules: c.modules || [],
        pdfCards: (c as any).pdfCards || [],
        manualCards: (c as any).manualCards || [],
        manualMCQuestions: (c as any).manualMCQuestions || [],
        manualExamQuestions: (c as any).manualExamQuestions || [],
        cardCount: c.flashcards?.length ?? 0,
        difficulty: (c as any).difficulty || 'standard',
        archived: (c as any).archived || false,
        updatedAt: c.updatedAt || now(),
        createdAt: (c as any).createdAt || now(),
      })));
      console.log('[MIGRATION] Migrated', courses.length, 'courses');
    }

    // ── Quiz History ────────────────────────────
    const quizzes = pd?.quizHistory ?? [];
    if (quizzes.length > 0) {
      await db.quiz_attempts.bulkUpsert(quizzes.map((q: any, i: number) => ({
        id: q.id || stableId('quiz', i),
        subject: q.subject || '',
        subtopic: q.subtopic || '',
        date: q.date || now(),
        score: q.score ?? 0,
        totalQuestions: q.totalQuestions ?? 0,
        timeSpent: q.timeSpent ?? 0,
        answers: q.answers || [],
        quizType: q.quizType || '',
        difficulty: q.difficulty || '',
        courseId: q.courseId || '',
        tags: q.tags || [],
        updatedAt: q.date || now(),
        createdAt: q.date || now(),
      })));
      console.log('[MIGRATION] Migrated', quizzes.length, 'quiz attempts');
    }

    // ── Notes ───────────────────────────────────
    const notes = pd?.notes ?? [];
    if (notes.length > 0) {
      await db.notes.bulkUpsert(notes.map((n: any) => ({
        id: n.id,
        title: n.title || 'Untitled',
        content: n.content || '',
        subject: n.subject || '',
        folder: n.folder || '',
        tags: n.tags || [],
        pinned: n.pinned || false,
        format: n.format || 'markdown',
        courseId: n.courseId || '',
        updatedAt: n.updatedAt || now(),
        createdAt: n.createdAt || now(),
      })));
      console.log('[MIGRATION] Migrated', notes.length, 'notes');
    }

    // ── Drawings ────────────────────────────────
    const drawings = pd?.drawings ?? [];
    if (drawings.length > 0) {
      await db.drawings.bulkUpsert(drawings.map((d: any) => ({
        id: d.id,
        title: d.title || 'Untitled',
        subject: d.subject || '',
        elements: typeof d.elements === 'string' ? d.elements : JSON.stringify(d.elements || []),
        appState: typeof d.appState === 'string' ? d.appState : JSON.stringify(d.appState || {}),
        courseId: d.courseId || '',
        folder: d.folder || '',
        updatedAt: d.updatedAt || now(),
        createdAt: d.createdAt || now(),
      })));
      console.log('[MIGRATION] Migrated', drawings.length, 'drawings');
    }

    // ── Annotations ─────────────────────────────
    const annotations = pd?.annotations ?? [];
    if (annotations.length > 0) {
      await db.annotations.bulkUpsert(annotations.map((a: any) => ({
        id: a.id,
        quizAttemptId: a.quizAttemptId || '',
        questionIndex: a.questionIndex ?? 0,
        note: a.note || '',
        highlight: a.highlight || '',
        tags: a.tags || [],
        courseId: a.courseId || '',
        updatedAt: a.updatedAt || now(),
        createdAt: a.createdAt || now(),
      })));
      console.log('[MIGRATION] Migrated', annotations.length, 'annotations');
    }

    // ── Match Sets ──────────────────────────────
    const matchSets = pd?.matchSets ?? [];
    if (matchSets.length > 0) {
      await db.match_sets.bulkUpsert(matchSets.map((m: any) => ({
        id: m.id,
        name: m.name || '',
        subject: m.subject || '',
        folder: m.folder || '',
        pairs: m.pairs || [],
        bestScore: m.bestScore ?? 0,
        updatedAt: m.updatedAt || m.createdAt || now(),
        createdAt: m.createdAt || now(),
      })));
      console.log('[MIGRATION] Migrated', matchSets.length, 'match sets');
    }

    // ── AI Chat Sessions ────────────────────────
    const aiChats = pd?.aiChatSessions ?? [];
    if (aiChats.length > 0) {
      await db.ai_chat_sessions.bulkUpsert(aiChats.map((s: any) => ({
        id: s.id,
        title: s.title || '',
        messages: s.messages || [],
        model: s.model || '',
        courseId: s.courseId || '',
        toolId: s.toolId || '',
        updatedAt: s.updatedAt || now(),
        createdAt: s.createdAt || now(),
      })));
      console.log('[MIGRATION] Migrated', aiChats.length, 'AI chat sessions');
    }

    // ── Tool Sessions ───────────────────────────
    const toolSessions = pd?.toolSessions ?? [];
    if (toolSessions.length > 0) {
      await db.tool_sessions.bulkUpsert(toolSessions.map((t: any) => ({
        id: t.id,
        toolId: t.toolId || '',
        toolLabel: t.toolLabel || '',
        courseId: t.courseId || '',
        input: t.input || {},
        output: t.output || {},
        errors: t.errors || [],
        status: t.status || 'completed',
        startedAt: t.startedAt || '',
        completedAt: t.completedAt || '',
        durationMs: t.durationMs ?? 0,
        updatedAt: t.updatedAt || t.completedAt || now(),
        createdAt: t.createdAt || t.startedAt || now(),
      })));
      console.log('[MIGRATION] Migrated', toolSessions.length, 'tool sessions');
    }

    // ── Saved Procedures ────────────────────────
    const procedures = pd?.savedProcedures ?? [];
    if (procedures.length > 0) {
      await db.saved_procedures.bulkUpsert(procedures.map((p: any) => ({
        id: p.id,
        name: p.name || '',
        category: p.category || '',
        steps: p.steps || [],
        courseId: p.courseId || '',
        quizResults: p.quizResults || [],
        updatedAt: p.updatedAt || now(),
        createdAt: p.createdAt || now(),
      })));
      console.log('[MIGRATION] Migrated', procedures.length, 'saved procedures');
    }

    // ── Saved Videos ────────────────────────────
    const videos = pd?.savedVideos ?? [];
    if (videos.length > 0) {
      await db.saved_videos.bulkUpsert(videos.map((v: any) => ({
        id: v.id,
        title: v.title || '',
        url: v.url || '',
        downloadUrl: v.downloadUrl || '',
        thumbnailBase64: v.thumbnailBase64 || '',
        duration: v.duration ?? 0,
        courseId: v.courseId || '',
        captions: v.captions || [],
        notes: v.notes || [],
        noteTemplates: v.noteTemplates || [],
        defaultSpeed: v.defaultSpeed ?? 1,
        updatedAt: v.updatedAt || now(),
        createdAt: v.createdAt || now(),
      })));
      console.log('[MIGRATION] Migrated', videos.length, 'saved videos');
    }

    // ── SR Cards (spaced repetition) ────────────
    const srCards = pd?.srData?.cards ?? [];
    if (srCards.length > 0) {
      await db.sr_cards.bulkUpsert(srCards.map((c: any, i: number) => ({
        id: c.id || stableId('sr', i),
        courseId: c.courseId || '',
        cardKey: c.cardKey || c.key || '',
        due: c.due || '',
        stability: c.stability ?? 0,
        difficulty: c.difficulty ?? 0,
        elapsed_days: c.elapsed_days ?? 0,
        scheduled_days: c.scheduled_days ?? 0,
        reps: c.reps ?? 0,
        lapses: c.lapses ?? 0,
        state: c.state ?? 0,
        last_review: c.last_review || '',
        suspended: c.suspended || false,
        leechCount: c.leechCount ?? 0,
        updatedAt: c.last_review || now(),
        createdAt: c.last_review || now(),
      })));
      console.log('[MIGRATION] Migrated', srCards.length, 'SR cards');
    }

    // ── Singletons ──────────────────────────────
    await safeUpsert('settings', () => db.settings.upsert({
      id: 'main', updatedAt: now(), data: oldData.settings || {},
    }));

    await safeUpsert('gamification', () => db.gamification.upsert({
      id: 'main', updatedAt: now(), data: pd?.gamificationData || {},
    }));

    await safeUpsert('timer', () => db.timer.upsert({
      id: 'main', updatedAt: now(), data: pd?.timerState || {},
    }));

    await safeUpsert('proficiency', () => db.proficiency.upsert({
      id: 'main', updatedAt: now(),
      data: pd?.proficiencyData || { settings: { proficiencyThreshold: 85, minAttempts: 3, recentWeight: 0.7 }, subjects: {} },
    }));

    // ── Plugin blobs (catch-all for less-structured data) ──
    const blobKeys = [
      'coachData',  // sessions, streak, totalStudyMinutes, weeklyPlan (non-courses data)
      'quizBank', 'courseSpaces', 'goals', 'weeklyQuests', 'studySessions',
      'weeklyPlan', 'assignments', 'knowledgeWeb', 'studySchedules',
      'loginHistory', 'notificationPrefs', 'userProfile', 'omniProtocol',
      'dashboardNotes', 'cardQualityCache', 'canvasLive',
    ];
    for (const key of blobKeys) {
      const val = (pd as any)?.[key];
      if (val !== undefined && val !== null) {
        // For coachData, strip courses (already migrated separately)
        const data = key === 'coachData'
          ? { ...val, courses: undefined }
          : val;
        await db.plugin_blobs.upsert({ id: key, updatedAt: now(), data });
      }
    }
    console.log('[MIGRATION] Migrated plugin blobs');

    // SYNC FIX #19: Only mark complete if no critical singleton failures
    // Check that critical singletons actually exist in RxDB before marking done
    let singletonsMissing = false;
    try {
      const settingsDoc = await db.settings.findOne('main').exec();
      if (!settingsDoc) singletonsMissing = true;
    } catch { singletonsMissing = true; }

    if (singletonsMissing && errors > 0) {
      console.error('[MIGRATION] Critical singletons missing — NOT marking migration complete. Will retry on next load.');
      return false;
    }

    // ── Mark migration complete ─────────────────
    localStorage.setItem(MIGRATION_FLAG, 'true');
    localStorage.setItem('nousai-rxdb-migrated-at', now());

    const elapsed = Date.now() - startTime;
    if (errors > 0) {
      console.warn(`[MIGRATION] Complete in ${elapsed}ms with ${errors} non-fatal errors — some data may need re-sync`);
    } else {
      console.log(`[MIGRATION] Complete in ${elapsed}ms — all data moved to RxDB`);
    }
    return true;

  } catch (error) {
    console.error('[MIGRATION] Failed:', error);
    // Do NOT set migration flag — allow retry on next load
    throw error;
  }
}

/**
 * Schedule cleanup of old IDB database after 30 days.
 * Called on app boot if migration is already complete.
 */
export function scheduleOldDbCleanup(): void {
  const migratedAt = localStorage.getItem('nousai-rxdb-migrated-at');
  if (!migratedAt) return;

  const elapsed = Date.now() - new Date(migratedAt).getTime();
  if (elapsed > MIGRATION_BACKUP_EXPIRY) {
    // 30 days passed — safe to delete old database
    try {
      indexedDB.deleteDatabase(OLD_DB_NAME);
      localStorage.removeItem('nousai-rxdb-migrated-at');
      console.log('[MIGRATION] Cleaned up old IDB database (30-day backup period expired)');
    } catch (e) {
      console.warn('[MIGRATION] Failed to clean up old database:', e);
    }
  }
}
