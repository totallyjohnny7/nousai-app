import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import type { NousAIData, FlashcardItem, CanvasEvent, QuizAttempt, Course, GamificationData, ProficiencyData, SRData, TimerState, PageContext, SavedVideo, VideoCaption, VideoNote, VideoNoteCategory, VideoNoteTemplate } from './types';
import { writeClipboard, saveFilePicker, openFilePicker, getPermPref } from './utils/permissions';
import { syncToCloud, syncFromCloud, subscribeToMetadataChanges } from './utils/auth';
import { runMigrations } from './utils/migrations';
import { validateBeforeWrite, countCards, logWrite } from './utils/writeGuard';
import { saveSnapshot } from './utils/snapshotManager';
import { dataHealthCheck, type HealthReport } from './utils/dataHealthCheck';
import { saveGoldenCopy } from './utils/goldenCopy';
import { initLeaderElection, destroyLeaderElection, broadcast, isLeader, getRole, TAB_ID, type TabRole } from './utils/tabLeader';
import { initRxStore, loadFromRxDB, saveToRxDB, subscribeToRxChanges } from './db/useRxStore';

/* ── Default empty state ──────────────────────────────── */
const emptyGamification: GamificationData = {
  xp: 0, level: 1, totalQuizzes: 0, totalCorrect: 0, totalAnswered: 0,
  totalMinutes: 0, streak: 0, bestStreak: 0, streakFreezes: 0,
  lastStudyDate: null, perfectScores: 0,
  badges: [], dailyGoal: { todayXp: 0, todayMinutes: 0, todayQuestions: 0, targetXp: 100 }
};

const emptyTimer: TimerState = {
  swRunning: false, swAccumulatedMs: 0, swResumedAt: null, swCourseId: '', swType: 'review',
  pomoRunning: false, pomoEndTime: null, pomoWorkMin: 20, pomoBreakMin: 10,
  pomoLongBreakMin: 15, pomoPhase: 'idle', pomoSession: 0, pomoTotalSessions: 0,
  pomoRemainingMs: 0, savedAt: Date.now()
};

/* ── Card-level merge: preserve local topic/media when cloud data lacks them ──
 *
 * Called before replacing local state with cloud data. Cards are matched by
 * their front+back content fingerprint (FlashcardItem has no id field).
 * Rule: cloud wins on conflicts; local fills in gaps (never overwrites cloud).
 * This prevents a cloud sync from silently wiping locally-set topic tags or
 * media attachments that haven't been uploaded to cloud yet.
 */
export function mergeLocalCardMeta(local: NousAIData | null, cloud: NousAIData): NousAIData {
  const localCourses = local?.pluginData?.coachData?.courses ?? [];
  const cloudCourses = cloud.pluginData?.coachData?.courses ?? [];
  if (localCourses.length === 0 || cloudCourses.length === 0) return cloud;

  // Per-course merge using updatedAt timestamps (Lamport 1978 simplified)
  const localById = new Map(localCourses.map(c => [c.id, c]));
  const cloudById = new Map(cloudCourses.map(c => [c.id, c]));
  const allIds = new Set([...localById.keys(), ...cloudById.keys()]);
  const mergedCourses: Course[] = [];

  for (const id of allIds) {
    const localCourse = localById.get(id);
    const cloudCourse = cloudById.get(id);

    if (!localCourse && cloudCourse) {
      // Only in cloud — new from other device
      mergedCourses.push(cloudCourse);
    } else if (localCourse && !cloudCourse) {
      // Only in local — new on this device
      mergedCourses.push(localCourse);
    } else if (localCourse && cloudCourse) {
      // Both exist — compare updatedAt, merge card metadata for the winner
      const localTime = localCourse.updatedAt || '';
      const cloudTime = cloudCourse.updatedAt || '';

      let winner: Course;
      if (cloudTime > localTime) {
        winner = cloudCourse;
      } else if (localTime > cloudTime) {
        winner = localCourse;
      } else {
        // Equal timestamps — trust cloud's card list; deletions bump updatedAt so they won't land here
        winner = cloudCourse;
      }

      // Preserve locally-set topic/media that cloud may lack
      const localCards = new Map((localCourse.flashcards ?? []).map(c => [`${c.front}\0${c.back}`, c]));
      const flashcards = (winner.flashcards ?? []).map(winnerCard => {
        const localCard = localCards.get(`${winnerCard.front}\0${winnerCard.back}`);
        if (!localCard) return winnerCard;
        const merged: FlashcardItem = { ...winnerCard };
        const cloudHasTopic = winnerCard.topic && winnerCard.topic !== '__none__';
        const localHasTopic = localCard.topic && localCard.topic !== '__none__';
        if (!cloudHasTopic && localHasTopic) merged.topic = localCard.topic;
        if (!winnerCard.media && localCard.media) merged.media = localCard.media;
        return merged;
      });

      mergedCourses.push({ ...winner, flashcards });
    }
  }

  // ── Merge pluginData arrays that have id + updatedAt fields ──────────
  // Without this, a cloud sync overwrites local annotations/notes/sessions
  // if the cloud snapshot was taken before the local edits.
  const localPD = local?.pluginData ?? {} as any;
  const cloudPD = cloud.pluginData ?? {} as any;

  function mergeById<T extends { id: string; updatedAt?: string | number; createdAt?: string | number }>(
    localArr: T[] | undefined,
    cloudArr: T[] | undefined,
  ): T[] | undefined {
    if (!localArr?.length && !cloudArr?.length) return cloudArr;
    if (!localArr?.length) return cloudArr;
    if (!cloudArr?.length) return localArr;

    const map = new Map<string, T>();
    // Seed with local entries
    for (const item of localArr) map.set(item.id, item);
    // Cloud wins if newer or equal; otherwise local keeps its version
    for (const item of cloudArr) {
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const cloudTime = String(item.updatedAt || item.createdAt || '');
        const localTime = String(existing.updatedAt || existing.createdAt || '');
        if (cloudTime >= localTime) map.set(item.id, item);
      }
    }
    return [...map.values()];
  }

  const mergedAnnotations = mergeById(localPD.annotations, cloudPD.annotations);
  const mergedNotes = mergeById(localPD.notes, cloudPD.notes);
  const mergedAiChatSessions = mergeById(localPD.aiChatSessions, cloudPD.aiChatSessions);
  const mergedToolSessions = mergeById(localPD.toolSessions, cloudPD.toolSessions);
  const mergedProcedures = mergeById(localPD.savedProcedures, cloudPD.savedProcedures);
  const mergedDrawings = mergeById(localPD.drawings, cloudPD.drawings);
  // Previously missing — offline-created entities in these arrays were being dropped
  const mergedMatchSets = mergeById(localPD.matchSets, cloudPD.matchSets);
  const mergedQuizHistory = mergeById(localPD.quizHistory, cloudPD.quizHistory);
  const mergedSavedVideos = mergeById(localPD.savedVideos, cloudPD.savedVideos);

  return {
    ...cloud,
    pluginData: {
      ...cloud.pluginData,
      coachData: {
        ...cloud.pluginData.coachData,
        courses: mergedCourses,
      },
      ...(mergedAnnotations !== undefined && { annotations: mergedAnnotations }),
      ...(mergedNotes !== undefined && { notes: mergedNotes }),
      ...(mergedAiChatSessions !== undefined && { aiChatSessions: mergedAiChatSessions }),
      ...(mergedToolSessions !== undefined && { toolSessions: mergedToolSessions }),
      ...(mergedProcedures !== undefined && { savedProcedures: mergedProcedures }),
      ...(mergedDrawings !== undefined && { drawings: mergedDrawings }),
      ...(mergedMatchSets !== undefined && { matchSets: mergedMatchSets }),
      ...(mergedQuizHistory !== undefined && { quizHistory: mergedQuizHistory }),
      ...(mergedSavedVideos !== undefined && { savedVideos: mergedSavedVideos }),
    },
  };
}

/* ── Data normalization — fills in missing optional fields ── */
export function normalizeData(d: NousAIData): NousAIData {
  // IDB data may be from older app versions missing newer fields, so cast to partial
  const s = d.settings as Partial<NousAIData['settings']> | undefined;
  const p = d.pluginData as Partial<NousAIData['pluginData']> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeArray = <T,>(v: any): T[] => {
    if (Array.isArray(v)) return v as T[];
    // Firestore can deserialize JS arrays as plain objects {0: ..., 1: ...}
    // Detect and recover these instead of silently wiping the data
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length > 0 && keys.every(k => /^\d+$/.test(k)))
        return keys.sort((a, b) => parseInt(a) - parseInt(b)).map(k => v[k]) as T[];
    }
    return [];
  };
  return {
    settings: {
      aiProvider: s?.aiProvider ?? '',
      canvasUrl: s?.canvasUrl ?? '',
      canvasToken: s?.canvasToken ?? '',
      canvasIcalUrl: s?.canvasIcalUrl ?? '',
      ...s,
      // Array fields AFTER spread — guards against Firestore object deserialization
      canvasEvents: safeArray(s?.canvasEvents),
    },
    pluginData: {
      coachData: p?.coachData ?? { courses: [], sessions: [], streak: 0, totalStudyMinutes: 0, weeklyPlan: null },
      proficiencyData: p?.proficiencyData ?? { settings: { proficiencyThreshold: 85, minAttempts: 3, recentWeight: 0.7 }, subjects: {} },
      srData: p?.srData ?? { cards: [] },
      timerState: p?.timerState ?? emptyTimer,
      gamificationData: p?.gamificationData ?? emptyGamification,
      quizBank: p?.quizBank ?? {},
      ...p,
      // Array fields AFTER spread — guards against Firestore object deserialization
      // (non-array truthy objects bypass || [] so we must use Array.isArray)
      quizHistory: safeArray(p?.quizHistory),
      notes: safeArray(p?.notes),
      drawings: safeArray(p?.drawings),
      matchSets: safeArray(p?.matchSets),
      aiChatSessions: safeArray(p?.aiChatSessions),
      toolSessions: safeArray(p?.toolSessions),
      savedVideos: safeArray(p?.savedVideos),
      omniProtocol: p?.omniProtocol ?? undefined,
    } as NousAIData['pluginData'],
  };
}

/* ── Cross-tab sync via leader election ──────────────── */
// Leader tab owns all IDB writes. Follower tabs proxy mutations through
// the BroadcastChannel → leader applies → broadcasts updated state back.
// Re-export TAB_ID from tabLeader (was previously defined here)
export { TAB_ID };

function broadcastDataChanged() {
  broadcast({ type: 'data-changed' });
}

// Follower tabs send their state updates to the leader via this message type
function sendMutationToLeader(data: NousAIData) {
  broadcast({ type: 'follower-mutation', payload: data });
}

/* ── Sync status type ────────────────────────────────── */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

/* ── Auto-sync scheduler ─────────────────────────────── */
const AUTO_SYNC_DEBOUNCE_MS = 10 * 1000; // 10 seconds (was 30s — reduced for faster cross-device sync)

class AutoSyncScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  dirty = false;
  private failCount = 0;           // consecutive failure count for retry backoff
  private dataRef: React.RefObject<NousAIData | null>;
  lastPushedTimestamp: string | null = null;  // tracks our last sync timestamp for self-trigger guard
  onFlushStart?: () => void;
  onFlushEnd?: (success: boolean) => void;

  constructor(dataRef: React.RefObject<NousAIData | null>) {
    this.dataRef = dataRef;
  }

  markDirty() {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), AUTO_SYNC_DEBOUNCE_MS);
  }

  /** Urgent sync — 3s debounce for critical state changes (card ratings, imports, course create/delete) */
  markDirtyUrgent() {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 3_000);
  }

  /** Immediate sync — no debounce, for create/delete/import operations */
  markDirtyImmediate() {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.flush();
  }

  async flush() {
    if (!this.dirty) return;
    const uid = localStorage.getItem('nousai-auth-uid');
    const autoSync = localStorage.getItem('nousai-auto-sync') !== 'false';
    if (!uid || !autoSync || !this.dataRef.current) return;
    // Safety: don't sync if courses is not an array (truly unloaded/corrupt state)
    // Empty array IS valid — user may have deleted all courses intentionally
    const courses = this.dataRef.current.pluginData?.coachData?.courses;
    if (!Array.isArray(courses)) {
      console.warn('[AUTO-SYNC] Skipped: courses is not an array (unloaded state)');
      return;
    }
    this.dirty = false;
    this.onFlushStart?.();
    try {
      // Pre-sync snapshot — save "before image" for recovery
      await saveSnapshot(this.dataRef.current, 'pre-sync').catch(() => {});
      await syncToCloud(uid, this.dataRef.current);
      const now = new Date().toISOString();
      localStorage.setItem('nousai-last-sync', now);
      this.lastPushedTimestamp = now; // track for self-trigger guard
      this.failCount = 0; // reset on success
      console.log('[AUTO-SYNC] Synced to cloud at', now);
      window.dispatchEvent(new CustomEvent('nousai-synced'));
      this.onFlushEnd?.(true);
    } catch (e) {
      this.failCount++;
      console.error('[AUTO-SYNC] Failed (attempt', this.failCount, '):', e);
      this.dirty = true; // retry on next change
      // Notify UI about the delay — dispatch with retry count so components can show context
      window.dispatchEvent(new CustomEvent('nousai-sync-delayed', {
        detail: { attempt: this.failCount, error: e instanceof Error ? e.message : 'Unknown error' }
      }));
      // Exponential backoff retry: 30s × 2^(failCount-1), capped at 5 minutes
      const retryDelay = Math.min(AUTO_SYNC_DEBOUNCE_MS * Math.pow(2, this.failCount - 1), 300_000);
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), retryDelay);
      this.onFlushEnd?.(false);
    }
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
  }
}

export interface MatchSet {
  id: string;
  name: string;
  subject: string;
  folder?: string;
  pairs: { term: string; definition: string }[];
  createdAt: string;
  bestScore?: number;
}

interface StoreCtx {
  data: NousAIData | null;
  setData: (d: NousAIData | ((prev: NousAIData) => NousAIData)) => void;
  updatePluginData: (partial: Partial<NousAIData['pluginData']>) => void;
  loaded: boolean;
  importData: (json: string) => void;
  exportData: () => string;
  copyToClipboard: (text: string) => Promise<boolean>;
  exportToFile: (filename?: string) => Promise<boolean>;
  importFromFile: () => Promise<boolean>;
  matchSets: MatchSet[];
  saveMatchSet: (ms: MatchSet) => void;
  events: CanvasEvent[];
  quizHistory: QuizAttempt[];
  courses: Course[];
  gamification: GamificationData;
  proficiency: ProficiencyData | null;
  srData: SRData | null;
  timerState: TimerState;
  setTimerState: (ts: TimerState) => void;
  einkMode: boolean;
  setEinkMode: (v: boolean) => void;
  betaMode: boolean;
  setBetaMode: (v: boolean) => void;
  backupNow: () => Promise<boolean>;
  triggerSyncToCloud: () => Promise<void>;
  triggerSyncFromCloud: () => Promise<void>;
  // Data health
  healthReport: HealthReport | null;
  // Sync status
  syncStatus: SyncStatus;
  lastSyncAt: string | null;
  remoteUpdateAvailable: boolean;
  startRemoteWatch: (uid: string) => void;
  stopRemoteWatch: () => void;
  loadRemoteData: () => Promise<void>;
  dismissRemoteBanner: () => void;
  // Page context for Nous AI Panel
  activePageContext: PageContext | null
  setPageContext: (ctx: PageContext | null) => void
  // Tool visibility (Learn page customization)
  hiddenToolIds: string[]
  setHiddenToolIds: (ids: string[]) => void
  // Video Studio
  savedVideos: SavedVideo[]
  addVideo: (video: SavedVideo) => void
  deleteVideo: (videoId: string) => void
  updateVideoMeta: (videoId: string, updates: Partial<Pick<SavedVideo, 'title' | 'captions' | 'defaultSpeed' | 'courseId' | 'downloadUrl' | 'thumbnailBase64' | 'notes' | 'noteTemplates' | 'duration'>>) => void
}

const Ctx = createContext<StoreCtx>({} as StoreCtx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setDataRaw] = useState<NousAIData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [einkMode, setEinkModeState] = useState(() => localStorage.getItem('nousai-eink') === 'true');
  const [betaMode, setBetaModeState] = useState(() => localStorage.getItem('nousai-beta') === 'true');
  const dataRef = useRef<NousAIData | null>(null);
  const fromSyncRef = useRef(false); // true when data was loaded from cross-tab sync (skip broadcast)
  const localDirtyRef = useRef(false); // true when local changes haven't been saved to IDB yet

  // ── Sync status state ───────────────────────────────────
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    navigator.onLine ? 'idle' : 'offline'
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() =>
    localStorage.getItem('nousai-last-sync')
  );
  const [remoteUpdateAvailable, setRemoteUpdateAvailable] = useState(false);
  const [activePageContext, setPageContext] = useState<PageContext | null>(null);
  const [hiddenToolIds, setHiddenToolIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('nousai-hidden-tools') ?? '[]') } catch { return [] }
  });
  const snapshotUnsubRef = useRef<(() => void) | null>(null);

  // Keep ref in sync so functional updaters always read latest
  useEffect(() => { dataRef.current = data; }, [data]);

  // setData supports both direct values and functional updaters to prevent race conditions
  const setData = useCallback((valOrFn: NousAIData | ((prev: NousAIData) => NousAIData)) => {
    localDirtyRef.current = true;
    if (typeof valOrFn === 'function') {
      setDataRaw(prev => prev ? valOrFn(prev) : prev);
    } else {
      setDataRaw(valOrFn);
    }
  }, []);

  // Safe helper: merges partial pluginData using functional updater (prevents stale data overwrites)
  const updatePluginData = useCallback((partial: Partial<NousAIData['pluginData']>) => {
    localDirtyRef.current = true;
    setDataRaw(prev => prev ? { ...prev, pluginData: { ...prev.pluginData, ...partial } } : prev);
  }, []);

  // Load from RxDB on mount — runs migration from old blob on first load.
  // Falls back to legacy IDB if RxDB fails (safety net during transition).
  useEffect(() => {
    (async () => {
      let d: NousAIData | null = null;
      let source = 'rxdb';

      try {
        // Initialize RxDB + run migration from old blob if needed
        await initRxStore();
        d = await loadFromRxDB();
        // If RxDB returned null but old IDB has data, reset migration flag and use legacy
        if (!d) {
          const legacyData = await loadFromIDB();
          if (legacyData) {
            console.warn('[STORE] RxDB returned null but legacy IDB has data — using legacy, will retry migration');
            localStorage.removeItem('nousai-rxdb-migrated');
            d = legacyData;
            source = 'idb-fallback';
          }
        }
      } catch (rxErr) {
        console.error('[STORE] RxDB load failed, falling back to legacy IDB:', rxErr);
        source = 'idb-fallback';
        d = await loadFromIDB();
      }

      // Check crash-recovery data from a follower tab that closed
      const crashRecovery = localStorage.getItem('nousai-crash-recovery');
      const crashAt = localStorage.getItem('nousai-crash-recovery-at');
      const idbModified = localStorage.getItem('nousai-data-modified-at');
      if (crashRecovery && crashAt && (!idbModified || crashAt > idbModified)) {
        try {
          const recovered = JSON.parse(crashRecovery) as NousAIData;
          if (recovered?.pluginData?.coachData) {
            d = recovered;
            source = 'crash-recovery';
            console.log('[STORE] Restored from crash-recovery (follower tab that closed)');
          }
        } catch { /* corrupt crash recovery data — ignore */ }
      }
      localStorage.removeItem('nousai-crash-recovery');
      localStorage.removeItem('nousai-crash-recovery-at');

      if (d) {
        const migrated = runMigrations(d);
        const normalized = normalizeData(migrated);
        const { report, repairedData } = dataHealthCheck(normalized);
        const final = report.autoRepaired.length > 0 ? repairedData : normalized;
        if (!report.healthy) {
          console.warn('[HEALTH CHECK]', report.score + '/100 —', report.issues.length, 'issues:', report.issues.map(i => `[${i.severity}] ${i.code}: ${i.message}`).join('; '));
        } else {
          console.log('[HEALTH CHECK] Score:', report.score + '/100 — healthy');
        }
        if (report.autoRepaired.length > 0) {
          console.log('[HEALTH CHECK] Auto-repaired:', report.autoRepaired.join('; '));
        }
        setHealthReport(report);
        console.log(`[STORE] Loaded from ${source}:`, final.pluginData?.coachData?.courses?.length ?? 0, 'courses,', final.pluginData?.quizHistory?.length ?? 0, 'quiz entries');
        lastSavedData = final;
        saveSnapshot(final, 'boot').catch(() => {});
        setDataRaw(final);
      }
      setLoaded(true);
    })();
  }, []);

  // Persist to IndexedDB on change — debounced to avoid redundant writes during rapid updates
  // LEADER ELECTION: Only the leader tab writes to IDB. Follower tabs send mutations to the leader.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!data) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      // Safety: don't save before initial IDB load completes (state is still default/empty)
      if (!loaded) {
        console.warn('[STORE] Blocked save: initial IDB load not yet complete');
        return;
      }

      // Follower tabs: send mutation to leader instead of writing IDB directly
      if (!isLeader()) {
        if (!fromSyncRef.current) {
          sendMutationToLeader(data);
        } else {
          fromSyncRef.current = false;
        }
        localDirtyRef.current = false;
        return;
      }

      // Leader tab: write to RxDB (per-document, only changed collections)
      const MAX_QUIZ_HISTORY = 500;
      const qh = data.pluginData?.quizHistory;
      const dataToSave = (qh && qh.length > MAX_QUIZ_HISTORY)
        ? { ...data, pluginData: { ...data.pluginData, quizHistory: qh.slice(-MAX_QUIZ_HISTORY) } }
        : data;
      try {
        await saveToRxDB(dataToSave);
      } catch (rxErr) {
        console.error('[STORE] RxDB save failed, falling back to legacy IDB:', rxErr);
        saveToIDB(dataToSave);
      }
      localDirtyRef.current = false;
      localStorage.setItem('nousai-data-modified-at', new Date().toISOString());
      // Only broadcast if this was a local change, not a cross-tab sync echo
      if (fromSyncRef.current) {
        fromSyncRef.current = false;
      } else {
        broadcastDataChanged();
      }
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [data]);

  // Cross-tab sync via leader election
  // Leader: handles follower-mutation messages by merging into its own state → writes IDB → broadcasts
  // Follower: handles data-changed messages by reloading from IDB
  const tabRoleRef = useRef<TabRole>('undecided');

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;

    initLeaderElection({
      onBecomeLeader: () => {
        tabRoleRef.current = 'leader';
        console.log('[STORE] Became leader — owning RxDB writes');
        // Force-write current state to RxDB to establish baseline
        if (dataRef.current && loaded) {
          saveToRxDB(dataRef.current).catch(() => saveToIDB(dataRef.current!));
        }
      },
      onLoseLeadership: () => {
        tabRoleRef.current = 'follower';
        console.log('[STORE] Lost leadership — switching to read-only');
      },
      onMessage: (msg: any) => {
        if (msg?.type === 'data-changed') {
          // Another tab (leader) updated RxDB — reload
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(async () => {
            const fresh = await loadFromRxDB() || await loadFromIDB();
            if (fresh) {
              fromSyncRef.current = true;
              setDataRaw(normalizeData(fresh));
            }
          }, 300);
        } else if (msg?.type === 'follower-mutation' && isLeader()) {
          // A follower tab sent us its updated state — merge it
          const followerData = msg.payload as NousAIData;
          if (followerData) {
            const merged = mergeLocalCardMeta(dataRef.current, normalizeData(followerData));
            fromSyncRef.current = false; // this IS a real change, broadcast after saving
            setDataRaw(merged);
          }
        }
      },
    });

    return () => {
      if (debounce) clearTimeout(debounce);
      destroyLeaderElection();
    };
  }, [loaded]);

  // Auto-sync to cloud (debounced 2min) when data changes + flush on tab hidden
  const autoSyncRef = useRef(new AutoSyncScheduler(dataRef));

  // Wire AutoSyncScheduler callbacks to syncStatus
  useEffect(() => {
    autoSyncRef.current.onFlushStart = () => setSyncStatus('syncing');
    autoSyncRef.current.onFlushEnd = (success) => setSyncStatus(success ? 'synced' : 'error');
  }, []);

  // Show sync delay toast via CustomEvent — emitted by AutoSyncScheduler on retry
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ attempt: number; error: string }>).detail;
      // Dispatch a global toast event that any component can listen to
      window.dispatchEvent(new CustomEvent('nousai-toast', {
        detail: {
          message: detail.attempt === 1
            ? '⚠ Sync delayed — retrying…'
            : `⚠ Sync failed (attempt ${detail.attempt}) — retrying in ${Math.min(30 * Math.pow(2, detail.attempt - 1), 300)}s`,
          type: 'warning',
          duration: 5000,
        }
      }));
    };
    window.addEventListener('nousai-sync-delayed', handler);
    return () => window.removeEventListener('nousai-sync-delayed', handler);
  }, []);

  // Listen to nousai-synced event (fired by AutoSyncScheduler on success)
  useEffect(() => {
    const handler = () => {
      const now = localStorage.getItem('nousai-last-sync');
      setLastSyncAt(now);
      setSyncStatus('synced');
    };
    window.addEventListener('nousai-synced', handler);
    return () => window.removeEventListener('nousai-synced', handler);
  }, []);

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => {
      setSyncStatus(prev => prev === 'offline' ? 'idle' : prev);
      // Flush any pending changes accumulated while offline
      if (autoSyncRef.current.dirty) {
        console.log('[STORE] Back online — flushing pending changes');
        autoSyncRef.current.flush();
      }
    };
    const goOffline = () => setSyncStatus('offline');
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const startRemoteWatch = useCallback((uid: string) => {
    snapshotUnsubRef.current?.();
    subscribeToMetadataChanges(uid, (remoteUpdatedAt: string) => {
      const localLastSync = localStorage.getItem('nousai-last-sync');
      if (!localLastSync || remoteUpdatedAt > localLastSync) {
        // Skip if WE caused this update (sync-ID comparison, not time-based)
        if (autoSyncRef.current.lastPushedTimestamp === remoteUpdatedAt) return;
        // If local has unsynced changes, flush first then load remote (was: silently defer = deadlock)
        const localModified = localStorage.getItem('nousai-data-modified-at');
        const lastSync = localStorage.getItem('nousai-last-sync');
        if (localModified && lastSync && localModified > lastSync) {
          console.log('[STORE] Remote update + local unsynced — flushing local first');
          autoSyncRef.current.flush().then(() => {
            window.dispatchEvent(new CustomEvent('nousai-remote-update-available'));
          });
          return;
        }
        // Auto-load silently — no banner click required
        const autoSync = localStorage.getItem('nousai-auto-sync') !== 'false';
        if (autoSync) {
          window.dispatchEvent(new CustomEvent('nousai-remote-update-available'));
        } else {
          setRemoteUpdateAvailable(true);
        }
      }
    }).then(unsub => { snapshotUnsubRef.current = unsub; });
  }, []);

  const stopRemoteWatch = useCallback(() => {
    snapshotUnsubRef.current?.();
    snapshotUnsubRef.current = null;
  }, []);

  const loadRemoteData = useCallback(async () => {
    const uid = localStorage.getItem('nousai-auth-uid');
    if (!uid) return;
    setSyncStatus('syncing');
    try {
      const cloudData = await syncFromCloud(uid);
      if (cloudData) {
        const normalized = normalizeData(cloudData);
        // Preserve locally-set topic/media that the cloud snapshot may lack
        const merged = mergeLocalCardMeta(dataRef.current, normalized);
        setData(merged);
        saveGoldenCopy(merged).catch(() => {}); // Growth-only golden copy update
        const now = new Date().toISOString();
        localStorage.setItem('nousai-last-sync', now);
        localStorage.setItem('nousai-data-modified-at', now);
        setLastSyncAt(now);
        setSyncStatus('synced');
        setRemoteUpdateAvailable(false);
        window.dispatchEvent(new CustomEvent('nousai-synced'));
      } else {
        setSyncStatus('idle');
      }
    } catch (e) {
      console.error('[STORE] loadRemoteData failed:', e);
      setSyncStatus('error');
    }
  }, [setData]);

  const dismissRemoteBanner = useCallback(() => {
    setRemoteUpdateAvailable(false);
  }, []);

  // ── Global sync triggers (for Ctrl+S / Ctrl+Shift+S hotkeys) ────
  const triggerSyncToCloud = useCallback(async () => {
    const uid = localStorage.getItem('nousai-auth-uid');
    if (!uid || !data) {
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: !uid ? 'Sign in to sync' : 'No data to sync' }));
      return;
    }
    setSyncStatus('syncing');
    window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'Syncing to cloud...' }));
    try {
      await syncToCloud(uid, data);
      const now = new Date().toISOString();
      localStorage.setItem('nousai-last-sync', now);
      setLastSyncAt(now);
      setSyncStatus('idle');
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: '✓ Synced to cloud!' }));
    } catch (e: any) {
      console.error('[STORE] triggerSyncToCloud failed:', e);
      setSyncStatus('error');
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'Sync failed — ' + (e?.message || 'check connection') }));
    }
  }, [data]);

  const triggerSyncFromCloud = useCallback(async () => {
    const uid = localStorage.getItem('nousai-auth-uid');
    if (!uid) {
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'Sign in to sync' }));
      return;
    }
    setSyncStatus('syncing');
    window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'Loading from cloud...' }));
    try {
      const cloudData = await syncFromCloud(uid);
      if (cloudData) {
        const normalized = normalizeData(cloudData);
        const merged = mergeLocalCardMeta(dataRef.current, normalized);
        setData(merged);
        saveGoldenCopy(merged).catch(() => {});
        const now = new Date().toISOString();
        localStorage.setItem('nousai-last-sync', now);
        localStorage.setItem('nousai-data-modified-at', now);
        setLastSyncAt(now);
        setSyncStatus('idle');
        window.dispatchEvent(new CustomEvent('nousai-toast', { detail: '✓ Loaded from cloud!' }));
      } else {
        setSyncStatus('idle');
        window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'No cloud data found' }));
      }
    } catch (e: any) {
      console.error('[STORE] triggerSyncFromCloud failed:', e);
      setSyncStatus('error');
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'Sync failed — ' + (e?.message || 'check connection') }));
    }
  }, [setData]);

  useEffect(() => {
    if (!data) return;
    autoSyncRef.current.markDirty();
  }, [data]);

  // Auto-load remote changes silently — no banner needed when auto-sync is on
  useEffect(() => {
    const handler = () => { loadRemoteData(); };
    window.addEventListener('nousai-remote-update-available', handler);
    return () => window.removeEventListener('nousai-remote-update-available', handler);
  }, [loadRemoteData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Leader: force-flush to IDB immediately (no debounce) + cloud sync
        if (isLeader()) {
          if (dataRef.current) {
            saveToRxDB(dataRef.current).catch(() => saveToIDB(dataRef.current!));
          }
          autoSyncRef.current.flush();
        } else if (dataRef.current && localDirtyRef.current) {
          // Follower: stash unsaved state to localStorage before tab goes hidden
          try {
            localStorage.setItem('nousai-crash-recovery', JSON.stringify(dataRef.current));
            localStorage.setItem('nousai-crash-recovery-at', new Date().toISOString());
          } catch { /* quota exceeded */ }
        }
      } else if (document.visibilityState === 'visible') {
        // Pull latest from cloud/IDB when tab becomes visible
        loadRemoteData();
      }
    };
    // pagehide: iOS Safari fires this but not always beforeunload
    const handlePageHide = () => {
      if (isLeader()) autoSyncRef.current.flush();
    };
    // 30s heartbeat: catch edge cases where debounce timer was cleared (leader only)
    const heartbeat = setInterval(() => {
      if (isLeader() && autoSyncRef.current.dirty && navigator.onLine) {
        autoSyncRef.current.flush();
      }
    }, 30_000);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      clearInterval(heartbeat);
      autoSyncRef.current.stop();
    };
  }, [loadRemoteData]);

  // Flush to IDB immediately on tab close so no data is lost
  // Leader: writes to IDB directly. Follower: writes crash-recovery key to localStorage.
  useEffect(() => {
    const flush = (e: BeforeUnloadEvent) => {
      if (dataRef.current) {
        if (isLeader()) {
          // Leader: best-effort write (RxDB with IDB fallback)
          saveToRxDB(dataRef.current).catch(() => saveToIDB(dataRef.current!));
        } else {
          // Follower: stash to localStorage as crash-recovery backup
          // (localStorage is synchronous — guaranteed to complete before tab closes)
          try {
            const compressed = JSON.stringify(dataRef.current);
            localStorage.setItem('nousai-crash-recovery', compressed);
            localStorage.setItem('nousai-crash-recovery-at', new Date().toISOString());
          } catch { /* localStorage quota exceeded — can't save, data was in IDB anyway */ }
        }
      }

      // If auto-sync is dirty (pending cloud write), warn the user
      if (autoSyncRef.current.dirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes that haven\'t synced to the cloud yet. Leave anyway?';
      }

      // Best-effort cloud sync on page hide (no guarantee it completes)
      if (isLeader()) autoSyncRef.current.flush();
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  function importData(json: string) {
    try {
      // Pre-import snapshot — save current state before overwriting
      if (data) saveSnapshot(data, 'pre-import').catch(() => {});
      const parsed = JSON.parse(json);
      // Validate basic structure
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        alert('Invalid data file. Expected a JSON object.');
        return;
      }
      // Handle the nested structure: support both flat and nested pluginData formats
      const raw: NousAIData = {
        settings: {
          ...(typeof parsed.settings === 'object' && parsed.settings ? parsed.settings : {}),
          canvasEvents: Array.isArray(parsed.settings?.canvasEvents) ? parsed.settings.canvasEvents : [],
        },
        pluginData: {
          ...(typeof parsed.pluginData === 'object' && parsed.pluginData ? parsed.pluginData : {}),
          // Support flat format (legacy): pull from top-level if not in pluginData
          quizHistory: parsed.pluginData?.quizHistory || parsed.quizHistory || [],
          coachData: parsed.pluginData?.coachData || parsed.coachData || undefined,
          proficiencyData: parsed.pluginData?.proficiencyData || parsed.proficiencyData || undefined,
          srData: parsed.pluginData?.srData || parsed.srData || undefined,
          timerState: parsed.pluginData?.timerState || parsed.timerState || undefined,
          gamificationData: parsed.pluginData?.gamificationData || parsed.gamificationData || undefined,
          quizBank: parsed.pluginData?.quizBank || parsed.quizBank || undefined,
        },
      };
      setData(normalizeData(raw));
    } catch (e) {
      console.error('Failed to parse data:', e);
      alert('Invalid data file. Please ensure the file is valid JSON.');
    }
  }

  function exportData(): string {
    if (!data) return '{}';
    // Strip sensitive credentials from export (same logic as syncToCloud)
    const safe = {
      ...data,
      settings: {
        ...Object.fromEntries(
          Object.entries(data.settings).filter(([k]) =>
            !k.toLowerCase().includes('token') && !k.toLowerCase().includes('apikey') && !k.toLowerCase().includes('api_key')
          )
        ),
        canvasToken: '',
        canvasUrl: data.settings.canvasUrl,
        aiProvider: data.settings.aiProvider,
      },
    };
    return JSON.stringify(safe, null, 2);
  }

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    if (!getPermPref('clipboard', true)) return false;
    const r = await writeClipboard(text);
    return r.granted;
  }, []);

  const exportToFile = useCallback(async (filename?: string): Promise<boolean> => {
    const json = exportData();
    const r = await saveFilePicker(json, filename || 'nousai-export.json');
    return r.granted;
  }, [data]);

  const importFromFile = useCallback(async (): Promise<boolean> => {
    const r = await openFilePicker([{ description: 'JSON', accept: { 'application/json': ['.json'] } }]);
    if (!r.granted || !r.file) return false;
    try {
      const text = await r.file.text();
      importData(text);
      return true;
    } catch { return false; }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => { const v = data?.settings?.canvasEvents; return Array.isArray(v) ? v : []; }, [data?.settings?.canvasEvents]);
  const quizHistory = useMemo(() => { const v = data?.pluginData?.quizHistory; return Array.isArray(v) ? v : []; }, [data?.pluginData?.quizHistory]);
  const courses = useMemo(() => { const v = data?.pluginData?.coachData?.courses; return Array.isArray(v) ? v : []; }, [data?.pluginData?.coachData?.courses]);
  const gamification = useMemo(() => data?.pluginData?.gamificationData || emptyGamification, [data?.pluginData?.gamificationData]);
  const proficiency = useMemo(() => data?.pluginData?.proficiencyData || null, [data?.pluginData?.proficiencyData]);
  const srData = useMemo(() => data?.pluginData?.srData || null, [data?.pluginData?.srData]);
  const timerState = useMemo(() => data?.pluginData?.timerState || emptyTimer, [data?.pluginData?.timerState]);
  const matchSets: MatchSet[] = useMemo(() => { const v = data?.pluginData?.matchSets; return Array.isArray(v) ? v as MatchSet[] : []; }, [data?.pluginData?.matchSets]);

  function saveMatchSet(ms: MatchSet) {
    if (!data) return;
    setData(prev => {
      const existing = (prev.pluginData.matchSets as MatchSet[] | undefined) || [];
      const idx = existing.findIndex(e => e.id === ms.id);
      const updated = idx >= 0
        ? existing.map((e, i) => i === idx ? ms : e)
        : [...existing, ms];
      return { ...prev, pluginData: { ...prev.pluginData, matchSets: updated } };
    });
  }

  // ── Video Studio mutators ─────────────────────────────
  const savedVideos: SavedVideo[] = useMemo(() => {
    const v = data?.pluginData?.savedVideos;
    return Array.isArray(v) ? (v as SavedVideo[]) : [];
  }, [data?.pluginData?.savedVideos]);

  function addVideo(video: SavedVideo) {
    updatePluginData({ savedVideos: [...savedVideos, video] });
  }

  function deleteVideo(videoId: string) {
    updatePluginData({ savedVideos: savedVideos.filter(v => v.id !== videoId) });
  }

  function updateVideoMeta(videoId: string, updates: Partial<Pick<SavedVideo, 'title' | 'captions' | 'defaultSpeed' | 'courseId' | 'downloadUrl' | 'thumbnailBase64' | 'notes' | 'noteTemplates' | 'duration'>>) {
    updatePluginData({
      savedVideos: savedVideos.map(v => v.id === videoId ? { ...v, ...updates } : v),
    });
  }

  function setTimerState(ts: TimerState) {
    if (!data) return;
    setData(prev => ({
      ...prev,
      pluginData: { ...prev.pluginData, timerState: ts }
    }));
  }

  function setEinkMode(v: boolean) {
    setEinkModeState(v);
    localStorage.setItem('nousai-eink', String(v));
    document.documentElement.classList.toggle('eink', v);
  }

  function setBetaMode(v: boolean) {
    setBetaModeState(v);
    localStorage.setItem('nousai-beta', String(v));
    document.documentElement.classList.toggle('beta', v);
  }

  // Apply eink/beta classes on mount
  useEffect(() => {
    if (einkMode) document.documentElement.classList.add('eink');
    if (betaMode) document.documentElement.classList.add('beta');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme class whenever settings.theme changes
  useEffect(() => {
    const theme = data?.settings?.theme ?? 'dark';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.classList.toggle('theme-light', !useDark);
  }, [data?.settings?.theme]);

  // ── Auto-backup interval ──────────────────────────────
  const backupNow = useCallback(async (): Promise<boolean> => {
    if (!data) return false;
    const handle = await loadBackupHandle();
    if (!handle) return false;
    const json = JSON.stringify(data, null, 2);
    return writeBackupFile(handle, json);
  }, [data]);

  useEffect(() => {
    const enabled = localStorage.getItem('nousai-auto-backup') === 'true';
    if (!enabled || !data) return;
    const BACKUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    const id = setInterval(() => { backupNow(); }, BACKUP_INTERVAL);
    return () => clearInterval(id);
  }, [data, backupNow]);

  const ctxValue = useMemo(() => ({
    data, setData, updatePluginData, loaded, importData, exportData, copyToClipboard, exportToFile, importFromFile,
    matchSets, saveMatchSet, events, quizHistory, courses, gamification, proficiency, srData,
    timerState, setTimerState, einkMode, setEinkMode, betaMode, setBetaMode, backupNow,
    triggerSyncToCloud, triggerSyncFromCloud,
    healthReport,
    syncStatus, lastSyncAt, remoteUpdateAvailable,
    startRemoteWatch, stopRemoteWatch, loadRemoteData, dismissRemoteBanner,
    activePageContext, setPageContext,
    hiddenToolIds,
    setHiddenToolIds: (ids: string[]) => {
      setHiddenToolIds(ids);
      localStorage.setItem('nousai-hidden-tools', JSON.stringify(ids));
    },
    savedVideos, addVideo, deleteVideo, updateVideoMeta,
  }), [data, loaded, matchSets, savedVideos, events, quizHistory, courses, gamification, proficiency, srData, timerState, einkMode, betaMode, // eslint-disable-line react-hooks/exhaustive-deps
    setData, updatePluginData, copyToClipboard, exportToFile, backupNow, triggerSyncToCloud, triggerSyncFromCloud,
    syncStatus, lastSyncAt, remoteUpdateAvailable,
    startRemoteWatch, stopRemoteWatch, loadRemoteData, dismissRemoteBanner,
    activePageContext, hiddenToolIds, healthReport]);

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);

/* ── IDB timeout wrapper ─────────────────────────────────── */
function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`IDB operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/* ── IndexedDB helpers ──────────────────────────────────── */
const DB_NAME = 'nousai-companion';
const STORE_NAME = 'appdata';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Track last successfully saved data for write guard comparison
let lastSavedData: NousAIData | null = null;

async function saveToIDB(data: NousAIData) {
  // Write guard: validate before committing to IDB
  const validation = validateBeforeWrite(data, lastSavedData);
  if (!validation.valid) {
    console.error('[WRITE-GUARD] IDB write BLOCKED:', validation.reason);
    window.dispatchEvent(new CustomEvent('nousai-write-blocked', {
      detail: { reason: validation.reason, source: 'saveToIDB' }
    }));
    return;
  }
  try {
    const db = await withTimeout(openDB());
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, 'main');
    lastSavedData = data;
    // Update card count checkpoint
    const cardCount = countCards(data);
    localStorage.setItem('nous_card_count_checkpoint', String(cardCount));
    logWrite('nousai-data', JSON.stringify(data).length, 'saveToIDB', cardCount);
  } catch (e) {
    console.error('[IDB] Failed to save:', e);
  }
}

// Exported so sync can force-write immediately (bypass debounce)
export { saveToIDB as forceWriteToIDB };

// Clear PWA service worker + caches so stale code doesn't block sync
export async function clearPWACache(): Promise<boolean> {
  let cleared = false;
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) { await r.unregister(); cleared = true; }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) { await caches.delete(k); cleared = true; }
    }
    if (cleared) console.log('[PWA] Cleared service worker + caches');
  } catch (e) {
    console.warn('[PWA] Cache clear failed:', e);
  }
  return cleared;
}

/* ── Auto-backup to local folder ──────────────────────── */
const BACKUP_HANDLE_KEY = 'backup-dir-handle';
const MAX_BACKUPS = 24;

async function saveBackupHandle(handle: FileSystemDirectoryHandle) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(handle, BACKUP_HANDLE_KEY);
}

async function loadBackupHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(BACKUP_HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}

async function clearBackupHandle() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(BACKUP_HANDLE_KEY);
  } catch { /* ignore */ }
}

async function writeBackupFile(handle: FileSystemDirectoryHandle, json: string): Promise<boolean> {
  try {
    // Check/request permission
    const perm = await (handle as any).requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { console.warn('[BACKUP] Permission denied'); return false; }

    // Write timestamped file
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 16); // 2026-03-12T15-30
    const filename = `nousai-backup-${ts}.json`;
    const file = await handle.getFileHandle(filename, { create: true });
    const writable = await file.createWritable();
    await writable.write(json);
    await writable.close();
    console.log('[BACKUP] Wrote', filename);

    // Prune old backups beyond MAX_BACKUPS
    const backups: string[] = [];
    for await (const [name] of (handle as any).entries()) {
      if (name.startsWith('nousai-backup-') && name.endsWith('.json')) backups.push(name);
    }
    backups.sort();
    if (backups.length > MAX_BACKUPS) {
      for (const old of backups.slice(0, backups.length - MAX_BACKUPS)) {
        try { await handle.removeEntry(old); console.log('[BACKUP] Pruned', old); } catch { /* skip */ }
      }
    }

    localStorage.setItem('nousai-last-backup', now.toISOString());
    return true;
  } catch (e) {
    console.error('[BACKUP] Write failed:', e);
    return false;
  }
}

export { saveBackupHandle, loadBackupHandle, clearBackupHandle, writeBackupFile };

async function loadFromIDB(): Promise<NousAIData | null> {
  try {
    const db = await withTimeout(openDB());
    return await withTimeout(new Promise<NousAIData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('main');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }));
  } catch (e) {
    console.error('[IDB] Failed to load:', e);
    return null;
  }
}
