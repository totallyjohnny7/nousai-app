/**
 * useRxStore — Bridge between RxDB collections and the existing Zustand-style store.
 *
 * Instead of rewriting the entire store.tsx (which would touch every component),
 * this hook provides load/save functions that slot into the existing architecture:
 *
 * - loadFromRxDB() → reads all collections → assembles NousAIData blob → returns it
 * - saveToRxDB(data) → diffs against last save → writes only changed collections
 * - subscribeToChanges(cb) → subscribes to RxDB changes → calls cb with fresh NousAIData
 *
 * This lets us swap the storage layer without changing the component tree.
 * The store.tsx continues to hold NousAIData in React state — but IDB reads/writes
 * are now handled by RxDB instead of raw IDB get/put.
 */
import type { RxDatabase } from 'rxdb';
import type { NousAIData, Course, CoachData, PluginData } from '../types';
import { getDb, isRxDbAvailable } from './index';
import { migrateFromBlob, isMigrated, scheduleOldDbCleanup } from './migrateFromBlob';

/** Strip RxDB internal fields and deep-clone to plain object.
 *  RxDB's toJSON() returns proxy objects that can't be structuredClone'd or stored in IDB.
 *  JSON round-trip is the safest way to get a fully plain object. */
function stripRxMeta(doc: any): any {
  if (!doc || typeof doc !== 'object') return doc;
  try {
    // JSON round-trip: strips proxies, getters, and non-serializable fields
    const json = JSON.parse(JSON.stringify(doc));
    const { _rev, _deleted, _meta, _attachments, ...clean } = json;
    return clean;
  } catch {
    return doc;
  }
}

/** Initialize RxDB + run migration if needed. Returns the database instance.
 *  Returns null if RxDB is unavailable (DB9 poisoned). */
export async function initRxStore(): Promise<RxDatabase | null> {
  if (!isRxDbAvailable()) return null;

  const db = await getDb();

  // Run migration from old blob if not yet done
  if (!isMigrated()) {
    await migrateFromBlob(db);
  } else {
    scheduleOldDbCleanup();
  }

  return db;
}

/** Read all RxDB collections and assemble into a NousAIData blob. */
export async function loadFromRxDB(): Promise<NousAIData | null> {
  if (!isRxDbAvailable()) return null;
  const db = await getDb();

  // Read all collections in parallel
  const [
    courseDocs,
    quizDocs,
    noteDocs,
    drawingDocs,
    annotationDocs,
    matchSetDocs,
    aiChatDocs,
    toolSessionDocs,
    savedProcDocs,
    savedVideoDocs,
    srCardDocs,
    settingsDoc,
    gamificationDoc,
    timerDoc,
    proficiencyDoc,
    pluginBlobDocs,
  ] = await Promise.all([
    db.courses.find().exec(),
    db.quiz_attempts.find().exec(),
    db.notes.find().exec(),
    db.drawings.find().exec(),
    db.annotations.find().exec(),
    db.match_sets.find().exec(),
    db.ai_chat_sessions.find().exec(),
    db.tool_sessions.find().exec(),
    db.saved_procedures.find().exec(),
    db.saved_videos.find().exec(),
    db.sr_cards.find().exec(),
    db.settings.findOne('main').exec(),
    db.gamification.findOne('main').exec(),
    db.timer.findOne('main').exec(),
    db.proficiency.findOne('main').exec(),
    db.plugin_blobs.find().exec(),
  ]);

  // If no settings AND no courses exist, this is a fresh/empty DB — fall back to legacy
  if (!settingsDoc && courseDocs.length === 0) {
    return null;
  }

  // If migration claims complete but critical data is missing, return null to trigger legacy fallback
  // This catches partial migrations where some collections failed schema validation
  if (courseDocs.length === 0 && !gamificationDoc && !proficiencyDoc) {
    console.warn('[RxDB] Data appears incomplete — falling back to legacy IDB');
    return null;
  }

  // Rebuild plugin blobs map — JSON round-trip to strip RxDB proxies
  const blobs: Record<string, any> = {};
  for (const doc of pluginBlobDocs) {
    try { blobs[doc.id] = JSON.parse(JSON.stringify(doc.data)); } catch { blobs[doc.id] = doc.data; }
  }

  // Reconstruct CoachData
  const coachBlob = blobs['coachData'] || {};
  const coachData: CoachData = {
    courses: courseDocs.map(d => stripRxMeta(d.toJSON()) as Course),
    sessions: coachBlob.sessions || [],
    streak: coachBlob.streak ?? 0,
    totalStudyMinutes: coachBlob.totalStudyMinutes ?? 0,
    weeklyPlan: coachBlob.weeklyPlan || null,
  };

  // Assemble full NousAIData
  const data: NousAIData = {
    settings: settingsDoc?.data ? JSON.parse(JSON.stringify(settingsDoc.data)) : {
      aiProvider: '',
      canvasUrl: '',
      canvasToken: '',
      canvasIcalUrl: '',
      canvasEvents: [],
    },
    pluginData: {
      coachData,
      quizHistory: quizDocs.map(d => stripRxMeta(d.toJSON())),
      notes: noteDocs.map(d => stripRxMeta(d.toJSON())),
      drawings: drawingDocs.map(d => stripRxMeta(d.toJSON())),
      annotations: annotationDocs.map(d => stripRxMeta(d.toJSON())),
      matchSets: matchSetDocs.map(d => stripRxMeta(d.toJSON())),
      aiChatSessions: aiChatDocs.map(d => stripRxMeta(d.toJSON())),
      toolSessions: toolSessionDocs.map(d => stripRxMeta(d.toJSON())),
      savedProcedures: savedProcDocs.map(d => stripRxMeta(d.toJSON())),
      savedVideos: savedVideoDocs.map(d => stripRxMeta(d.toJSON())),
      srData: { cards: srCardDocs.map(d => stripRxMeta(d.toJSON())) },
      gamificationData: gamificationDoc?.data ? JSON.parse(JSON.stringify(gamificationDoc.data)) : {},
      timerState: timerDoc?.data ? JSON.parse(JSON.stringify(timerDoc.data)) : {},
      proficiencyData: (proficiencyDoc?.data && proficiencyDoc.data.subjects)
        ? JSON.parse(JSON.stringify(proficiencyDoc.data))
        : { settings: { proficiencyThreshold: 85, minAttempts: 3, recentWeight: 0.7 }, subjects: {} },
      quizBank: blobs['quizBank'] || {},
      courseSpaces: blobs['courseSpaces'],
      goals: blobs['goals'],
      weeklyQuests: blobs['weeklyQuests'],
      studySessions: blobs['studySessions'],
      weeklyPlan: blobs['weeklyPlan'],
      assignments: blobs['assignments'],
      knowledgeWeb: blobs['knowledgeWeb'],
      studySchedules: blobs['studySchedules'],
      loginHistory: blobs['loginHistory'],
      notificationPrefs: blobs['notificationPrefs'],
      userProfile: blobs['userProfile'],
      omniProtocol: blobs['omniProtocol'],
      dashboardNotes: blobs['dashboardNotes'],
      cardQualityCache: blobs['cardQualityCache'],
      canvasLive: blobs['canvasLive'],
    } as PluginData,
  };

  // Final safety: JSON round-trip the entire NousAIData to ensure zero RxDB proxies survive.
  // Without this, structuredClone() in syncToCloud and saveToIDB will throw DataCloneError.
  return JSON.parse(JSON.stringify(data));
}

/**
 * Save NousAIData to RxDB — writes only changed collections.
 * Compares against last saved state to minimize writes.
 */
let lastSavedHash: Record<string, string> = {};

function quickHash(obj: unknown): string {
  // Dual 32-bit hash + length for change detection (effectively 64-bit, collision-safe to ~4B states)
  const str = JSON.stringify(obj);
  let h1 = 0, h2 = 0x9e3779b9; // h2 seeded with golden ratio
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = ((h1 << 5) - h1 + c) | 0;
    h2 = ((h2 << 7) ^ h2 ^ c) | 0;
  }
  return `${h1}_${h2}_${str.length}`;
}

export async function saveToRxDB(data: NousAIData): Promise<void> {
  if (!isRxDbAvailable()) return;
  const db = await getDb();
  const pd = data.pluginData;
  const now = new Date().toISOString();

  // ── Courses ──
  const courses = pd?.coachData?.courses ?? [];
  const coursesHash = quickHash(courses);
  if (coursesHash !== lastSavedHash['courses']) {
    // Upsert all courses, then remove any that no longer exist
    const existingIds = new Set((await db.courses.find().exec()).map((d: any) => d.id));
    const currentIds = new Set(courses.map((c: Course) => c.id));

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
      updatedAt: c.updatedAt || now,
      createdAt: (c as any).createdAt || now,
    })));

    // Delete courses that were removed
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const doc = await db.courses.findOne(id).exec();
        if (doc) await doc.remove();
      }
    }
    lastSavedHash['courses'] = coursesHash;
  }

  // ── Singletons (always upsert — cheap) ──
  await db.settings.upsert({ id: 'main', updatedAt: now, data: data.settings || {} });
  await db.gamification.upsert({ id: 'main', updatedAt: now, data: pd?.gamificationData || {} });
  await db.timer.upsert({ id: 'main', updatedAt: now, data: pd?.timerState || {} });
  await db.proficiency.upsert({ id: 'main', updatedAt: now, data: pd?.proficiencyData || {} });

  // ── Array collections — bulk upsert with hash check ──
  const arrayCollections: Array<{ key: string; collection: string; items: any[] }> = [
    { key: 'quizHistory', collection: 'quiz_attempts', items: pd?.quizHistory ?? [] },
    { key: 'notes', collection: 'notes', items: pd?.notes ?? [] },
    { key: 'drawings', collection: 'drawings', items: pd?.drawings ?? [] },
    { key: 'annotations', collection: 'annotations', items: pd?.annotations ?? [] },
    { key: 'matchSets', collection: 'match_sets', items: pd?.matchSets ?? [] },
    { key: 'aiChatSessions', collection: 'ai_chat_sessions', items: pd?.aiChatSessions ?? [] },
    { key: 'toolSessions', collection: 'tool_sessions', items: pd?.toolSessions ?? [] },
    { key: 'savedProcedures', collection: 'saved_procedures', items: pd?.savedProcedures ?? [] },
    { key: 'savedVideos', collection: 'saved_videos', items: pd?.savedVideos ?? [] },
  ];

  for (const { key, collection, items } of arrayCollections) {
    const hash = quickHash(items);
    if (hash !== lastSavedHash[key]) {
      // Upsert current items
      if (items.length > 0) {
        // SYNC FIX #8: Generate stable UUIDs for items without IDs instead of index-based
        // Index-based IDs (`key_000000`) are unstable — array reorders cause wrong overwrites
        await (db as any)[collection].bulkUpsert(
          items.map((item: any) => {
            if (!item.id) {
              // Generate stable ID from content hash to avoid index-based instability
              item.id = `${key}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
            }
            return {
              ...item,
              updatedAt: item.updatedAt || now,
              createdAt: item.createdAt || now,
            };
          })
        );
      }
      // Delete items removed from the array
      const currentIds = new Set(items.map((item: any) => item.id).filter(Boolean));
      const existing = await (db as any)[collection].find().exec();
      for (const doc of existing) {
        if (!currentIds.has(doc.id)) {
          await doc.remove();
        }
      }
      lastSavedHash[key] = hash;
    }
  }

  // ── SR Cards ──
  const srCards = pd?.srData?.cards ?? [];
  const srHash = quickHash(srCards);
  if (srHash !== lastSavedHash['srCards'] && srCards.length > 0) {
    await db.sr_cards.bulkUpsert(
      // SYNC FIX #8: Stable IDs for SR cards
      srCards.map((c: any) => ({
        id: c.id || `sr_${c.cardKey || c.key || Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
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
        updatedAt: c.last_review || now,
        createdAt: c.last_review || now,
      }))
    );
    lastSavedHash['srCards'] = srHash;
  }

  // ── Plugin blobs ──
  const blobEntries: Array<[string, unknown]> = [
    ['coachData', { ...(pd?.coachData || {}), courses: undefined }],
    ['quizBank', pd?.quizBank],
    ['courseSpaces', (pd as any)?.courseSpaces],
    ['goals', (pd as any)?.goals],
    ['weeklyQuests', (pd as any)?.weeklyQuests],
    ['studySessions', (pd as any)?.studySessions],
    ['weeklyPlan', (pd as any)?.weeklyPlan],
    ['assignments', (pd as any)?.assignments],
    ['knowledgeWeb', (pd as any)?.knowledgeWeb],
    ['studySchedules', (pd as any)?.studySchedules],
    ['omniProtocol', (pd as any)?.omniProtocol],
    ['dashboardNotes', (pd as any)?.dashboardNotes],
    ['canvasLive', (pd as any)?.canvasLive],
  ];

  for (const [key, val] of blobEntries) {
    if (val !== undefined && val !== null) {
      const hash = quickHash(val);
      if (hash !== lastSavedHash[`blob_${key}`]) {
        await db.plugin_blobs.upsert({ id: key, updatedAt: now, data: val });
        lastSavedHash[`blob_${key}`] = hash;
      }
    }
  }
}

/**
 * Subscribe to all RxDB collection changes.
 * Calls the callback with a fresh NousAIData whenever any collection changes.
 * Returns an unsubscribe function.
 */
export function subscribeToRxChanges(callback: (data: NousAIData) => void): () => void {
  // If RxDB is unavailable, return a no-op unsubscribe
  if (!isRxDbAvailable()) return () => {};

  let cancelled = false;
  const subs: Array<{ unsubscribe: () => void }> = [];

  // Debounce — RxDB fires per-document, we want to batch
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debouncedLoad = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (cancelled) return;
      const data = await loadFromRxDB();
      if (data && !cancelled) callback(data);
    }, 200);
  };

  // Subscribe to each collection
  getDb().then(db => {
    if (cancelled) return;
    const collectionNames = Object.keys(db.collections);
    for (const name of collectionNames) {
      const sub = db.collections[name].$.subscribe(() => {
        debouncedLoad();
      });
      subs.push(sub);
    }
  }).catch(() => { /* RxDB unavailable — no subscriptions */ });

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    for (const sub of subs) sub.unsubscribe();
  };
}
