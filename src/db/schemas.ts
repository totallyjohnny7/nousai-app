/**
 * RxDB Schemas — one collection per entity type.
 *
 * Replaces the monolithic NousAIData blob stored in a single IDB key.
 * Each collection syncs independently to Firestore via replication-firestore.
 *
 * Naming: snake_case for collection names (RxDB convention), camelCase for fields.
 * Every document gets: id (primary key), updatedAt (indexed for replication),
 * and _deleted (soft delete, handled by RxDB replication internally).
 */
import type { RxJsonSchema, RxCollectionCreator } from 'rxdb';

// ── Helper: wraps a schema with standard sync metadata fields ──
function withSyncMeta(
  title: string,
  properties: Record<string, any>,
  required: string[] = [],
  indexes: string[][] | string[] = [],
): RxJsonSchema<any> {
  return {
    version: 0,
    title,
    primaryKey: 'id',
    type: 'object',
    properties: {
      id: { type: 'string', maxLength: 128 },
      updatedAt: { type: 'string', maxLength: 40 },
      createdAt: { type: 'string', maxLength: 40 },
      ...properties,
    },
    required: ['id', 'updatedAt', ...required],
    indexes: ['updatedAt', ...indexes],
  };
}

// ── Courses ────────────────────────────────────
// One doc per course. Flashcards are embedded (not a separate collection)
// because they're always loaded/displayed together with their course.
export const courseSchema = withSyncMeta('course', {
  name: { type: 'string' },
  shortName: { type: 'string' },
  color: { type: 'string' },
  emoji: { type: 'string' },
  topics: { type: 'array', items: { type: 'object' } },
  flashcards: { type: 'array', items: { type: 'object' } },
  modules: { type: 'array', items: { type: 'object' } },
  pdfCards: { type: 'array', items: { type: 'object' } },
  manualCards: { type: 'array', items: { type: 'object' } },
  manualMCQuestions: { type: 'array', items: { type: 'object' } },
  manualExamQuestions: { type: 'array', items: { type: 'object' } },
  cardCount: { type: 'number' },
  difficulty: { type: 'string' },
  archived: { type: 'boolean' },
}, ['name']);

// ── Quiz History ───────────────────────────────
// One doc per quiz attempt.
export const quizAttemptSchema = withSyncMeta('quiz_attempt', {
  subject: { type: 'string' },
  subtopic: { type: 'string' },
  date: { type: 'string' },
  score: { type: 'number' },
  totalQuestions: { type: 'number' },
  timeSpent: { type: 'number' },
  answers: { type: 'array', items: { type: 'object' } },
  quizType: { type: 'string' },
  difficulty: { type: 'string' },
  courseId: { type: 'string' },
  tags: { type: 'array', items: { type: 'string' } },
});

// ── Notes ──────────────────────────────────────
export const noteSchema = withSyncMeta('note', {
  title: { type: 'string' },
  content: { type: 'string' },
  subject: { type: 'string' },
  folder: { type: 'string' },
  tags: { type: 'array', items: { type: 'string' } },
  pinned: { type: 'boolean' },
  format: { type: 'string' },
  courseId: { type: 'string' },
});

// ── Drawings ───────────────────────────────────
export const drawingSchema = withSyncMeta('drawing', {
  title: { type: 'string' },
  subject: { type: 'string' },
  elements: { type: 'string' }, // Excalidraw JSON string (too complex for schema)
  appState: { type: 'string' }, // Excalidraw appState JSON
  courseId: { type: 'string' },
  folder: { type: 'string' },
});

// ── Annotations (quiz annotations) ────────────
export const annotationSchema = withSyncMeta('annotation', {
  quizAttemptId: { type: 'string' },
  questionIndex: { type: 'number' },
  note: { type: 'string' },
  highlight: { type: 'string' },
  tags: { type: 'array', items: { type: 'string' } },
  courseId: { type: 'string' },
});

// ── Match Sets ─────────────────────────────────
export const matchSetSchema = withSyncMeta('match_set', {
  name: { type: 'string' },
  subject: { type: 'string' },
  folder: { type: 'string' },
  pairs: { type: 'array', items: { type: 'object' } },
  bestScore: { type: 'number' },
});

// ── AI Chat Sessions ───────────────────────────
export const aiChatSessionSchema = withSyncMeta('ai_chat_session', {
  title: { type: 'string' },
  messages: { type: 'array', items: { type: 'object' } },
  model: { type: 'string' },
  courseId: { type: 'string' },
  toolId: { type: 'string' },
});

// ── Tool Sessions ──────────────────────────────
export const toolSessionSchema = withSyncMeta('tool_session', {
  toolId: { type: 'string' },
  toolLabel: { type: 'string' },
  courseId: { type: 'string' },
  input: { type: 'object' },
  output: { type: 'object' },
  errors: { type: 'array', items: { type: 'object' } },
  status: { type: 'string' },
  startedAt: { type: 'string' },
  completedAt: { type: 'string' },
  durationMs: { type: 'number' },
});

// ── Saved Procedures ───────────────────────────
export const savedProcedureSchema = withSyncMeta('saved_procedure', {
  name: { type: 'string' },
  category: { type: 'string' },
  steps: { type: 'array', items: { type: 'object' } },
  courseId: { type: 'string' },
  quizResults: { type: 'array', items: { type: 'object' } },
});

// ── Saved Videos ───────────────────────────────
export const savedVideoSchema = withSyncMeta('saved_video', {
  title: { type: 'string' },
  url: { type: 'string' },
  downloadUrl: { type: 'string' },
  thumbnailBase64: { type: 'string' },
  duration: { type: 'number' },
  courseId: { type: 'string' },
  captions: { type: 'array', items: { type: 'object' } },
  notes: { type: 'array', items: { type: 'object' } },
  noteTemplates: { type: 'array', items: { type: 'object' } },
  defaultSpeed: { type: 'number' },
});

// ── SR Cards (spaced repetition) ───────────────
// One doc per card's FSRS scheduling state.
export const srCardSchema = withSyncMeta('sr_card', {
  courseId: { type: 'string' },
  cardKey: { type: 'string', maxLength: 512 },
  due: { type: 'string' },
  stability: { type: 'number' },
  difficulty: { type: 'number' },
  elapsed_days: { type: 'number' },
  scheduled_days: { type: 'number' },
  reps: { type: 'number' },
  lapses: { type: 'number' },
  state: { type: 'number' },
  last_review: { type: 'string' },
  suspended: { type: 'boolean' },
  leechCount: { type: 'number' },
}, ['cardKey']);

// ── Singletons: settings, gamification, timer, proficiency ──
// These are single-document collections with a fixed id = 'main'.
export const settingsSchema: RxJsonSchema<any> = {
  version: 0,
  title: 'settings',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 128 },
    updatedAt: { type: 'string', maxLength: 40 },
    data: { anyOf: [{ type: 'object' }, { type: 'array' }] },
  },
  required: ['id'],
};

export const gamificationSchema: RxJsonSchema<any> = {
  version: 0,
  title: 'gamification',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 128 },
    updatedAt: { type: 'string', maxLength: 40 },
    data: { type: 'object' },
  },
  required: ['id'],
};

export const timerSchema: RxJsonSchema<any> = {
  version: 0,
  title: 'timer',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 128 },
    updatedAt: { type: 'string', maxLength: 40 },
    data: { type: 'object' },
  },
  required: ['id'],
};

export const proficiencySchema: RxJsonSchema<any> = {
  version: 0,
  title: 'proficiency',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 128 },
    updatedAt: { type: 'string', maxLength: 40 },
    data: { type: 'object' },
  },
  required: ['id'],
};

// ── Catch-all for less-structured plugin data ──
// courseSpaces, goals, weeklyQuests, studySchedules, etc.
// Stored as keyed JSON blobs to avoid schema explosion.
// `data` uses anyOf to accept both objects AND arrays (some plugin data is array-shaped).
export const pluginBlobSchema: RxJsonSchema<any> = {
  version: 0,
  title: 'plugin_blob',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 128 },  // e.g. 'courseSpaces', 'goals', 'weeklyQuests'
    updatedAt: { type: 'string', maxLength: 40 },
    data: { anyOf: [{ type: 'object' }, { type: 'array' }, { type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
  },
  required: ['id'],
};

// ── Collection definitions map ─────────────────
export const collections: Record<string, RxCollectionCreator> = {
  courses:          { schema: courseSchema },
  quiz_attempts:    { schema: quizAttemptSchema },
  notes:            { schema: noteSchema },
  drawings:         { schema: drawingSchema },
  annotations:      { schema: annotationSchema },
  match_sets:       { schema: matchSetSchema },
  ai_chat_sessions: { schema: aiChatSessionSchema },
  tool_sessions:    { schema: toolSessionSchema },
  saved_procedures: { schema: savedProcedureSchema },
  saved_videos:     { schema: savedVideoSchema },
  sr_cards:         { schema: srCardSchema },
  settings:         { schema: settingsSchema },
  gamification:     { schema: gamificationSchema },
  timer:            { schema: timerSchema },
  proficiency:      { schema: proficiencySchema },
  plugin_blobs:     { schema: pluginBlobSchema },
};
