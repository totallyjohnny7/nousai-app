import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import type { NousAIData, CanvasEvent, QuizAttempt, Course, GamificationData, ProficiencyData, SRData, TimerState, PageContext, SavedVideo, VideoCaption, VideoNote, VideoNoteCategory, VideoNoteTemplate, DeviceSettings } from './types';
import { writeClipboard, saveFilePicker, openFilePicker, getPermPref } from './utils/permissions';
import { runMigrations } from './utils/migrations';
import { dataHealthCheck, type HealthReport } from './utils/dataHealthCheck';
import { initLeaderElection, destroyLeaderElection, broadcast, isLeader, getRole, TAB_ID, type TabRole } from './utils/tabLeader';
import { log, warn } from './utils/logger';
import { SyncScheduler, pullFromCloud } from './sync/cloudSync';
import { validateWrite } from './sync/writeGuard';

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

/* ── Merge logic moved to src/sync/mergeEngine.ts ── */

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
      deletionLog: safeArray(p?.deletionLog),
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

export interface MatchSet {
  id: string;
  name: string;
  subject: string;
  folder?: string;
  pairs: { term: string; definition: string }[];
  createdAt: string;
  bestScore?: number;
  deleted?: boolean;
  deletedAt?: number;
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
  // Device settings (Input Devices — K20, Stream Deck, Gamepad, etc.)
  deviceSettings: DeviceSettings
  setDeviceSettings: (settings: DeviceSettings) => void
  // UI state flags for K20 hotkey system
  isReviewActive: boolean
  setIsReviewActive: (v: boolean) => void
  modalOpen: boolean
  setModalOpen: (v: boolean) => void
  annotationPanelOpen: boolean
  setAnnotationPanelOpen: (v: boolean) => void
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
  const loadedRef = useRef(false); // true after initial IDB load completes (guards against pre-load saves)
  const syncSchedulerRef = useRef<SyncScheduler | null>(null);

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

  // ── Device settings (K20, Stream Deck, Gamepad, etc.) ──
  const [deviceSettings, setDeviceSettingsRaw] = useState<DeviceSettings>(() => {
    try {
      const raw = localStorage.getItem('nousai_device_settings');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DeviceSettings>;
        return { k20: true, streamDeck: false, gamepad: false, midi: false, otherHID: false, ...parsed, keyboard: true } as DeviceSettings;
      }
    } catch { /* corrupt */ }
    return { keyboard: true, k20: true, streamDeck: false, gamepad: false, midi: false, otherHID: false };
  });
  const setDeviceSettings = useCallback((s: DeviceSettings) => {
    const safe = { ...s, keyboard: true as const };
    setDeviceSettingsRaw(safe);
    try { localStorage.setItem('nousai_device_settings', JSON.stringify(safe)); } catch { /* full */ }
  }, []);

  // ── UI state flags for K20 hotkey system ──
  const [isReviewActive, setIsReviewActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [annotationPanelOpen, setAnnotationPanelOpen] = useState(false);

  // Keep ref in sync so functional updaters always read latest
  useEffect(() => { dataRef.current = data; }, [data]);

  // setData supports both direct values and functional updaters to prevent race conditions
  const setData = useCallback((valOrFn: NousAIData | ((prev: NousAIData) => NousAIData)) => {
    localDirtyRef.current = true;
    if (typeof valOrFn === 'function') {
      setDataRaw(prev => prev ? valOrFn(prev) : prev);
    } else {
      setDataRaw(valOrFn);
      // Write-through: when setting data for the first time (onboarding/import),
      // persist immediately — don't rely on the debounced save effect,
      // which can lose data due to leader election race conditions.
      if (!dataRef.current && valOrFn) {
        log('[STORE] First data write (onboarding/import) — persisting immediately');
        saveToIDB(valOrFn);
      }
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
      let source = 'legacy-idb';

      // PRIMARY: Load from legacy IDB (reliable, always works)
      // RxDB is disabled due to persistent DB9 schema errors that delete user data.
      // Legacy IDB is the single source of truth until RxDB migration is fixed.
      try {
        d = await loadFromIDB();
        if (d) {
          log('[STORE] Loaded from legacy IDB');
        }
      } catch (idbErr) {
        console.error('[STORE] Legacy IDB load failed:', idbErr);
      }

      // TODO: sync-v3 — cloud recovery

      // Check crash-recovery data from a follower tab that closed
      // Only use crash recovery if it has MORE content than what we loaded (prevents stale overwrites)
      const crashRecovery = localStorage.getItem('nousai-crash-recovery');
      if (crashRecovery) {
        try {
          const recovered = JSON.parse(crashRecovery) as NousAIData;
          if (recovered?.pluginData?.coachData) {
            // Compare content richness: use crash recovery only if it has more data
            const currentCourses = d?.pluginData?.coachData?.courses?.length ?? 0;
            const currentCards = d?.pluginData?.srData?.cards?.length ?? 0;
            const recoveredCourses = recovered.pluginData?.coachData?.courses?.length ?? 0;
            const recoveredCards = recovered.pluginData?.srData?.cards?.length ?? 0;
            const currentScore = currentCourses * 100 + currentCards;
            const recoveredScore = recoveredCourses * 100 + recoveredCards;
            if (recoveredScore > currentScore) {
              d = recovered;
              source = 'crash-recovery';
              log('[STORE] Restored from crash-recovery — had more data than IDB/RxDB');
            } else {
              log('[STORE] Skipped crash-recovery — IDB/RxDB data is richer or equal');
            }
          }
        } catch { /* corrupt crash recovery data — ignore */ }
      }
      localStorage.removeItem('nousai-crash-recovery');
      localStorage.removeItem('nousai-crash-recovery-at');
      // MicroMacro feature removed — clean up stale localStorage data
      localStorage.removeItem('nous_micromacro_sets');

      if (d) {
        const migrated = runMigrations(d);
        const normalized = normalizeData(migrated);
        // Backfill flashcard IDs for existing cards that don't have them
        let backfilled = false;
        for (const course of normalized.pluginData?.coachData?.courses || []) {
          for (const card of course.flashcards || []) {
            if (!card.id) {
              card.id = crypto.randomUUID();
              backfilled = true;
            }
          }
        }
        if (backfilled) log('[STORE] Backfilled flashcard IDs');
        const { report, repairedData } = dataHealthCheck(normalized);
        const final = report.autoRepaired.length > 0 ? repairedData : normalized;
        if (!report.healthy) {
          warn('[HEALTH CHECK]', report.score + '/100 —', report.issues.length, 'issues:', report.issues.map((i: { severity: string; code: string; message: string }) => `[${i.severity}] ${i.code}: ${i.message}`).join('; '));
        } else {
          log('[HEALTH CHECK] Score:', report.score + '/100 — healthy');
        }
        if (report.autoRepaired.length > 0) {
          log('[HEALTH CHECK] Auto-repaired:', report.autoRepaired.join('; '));
        }
        setHealthReport(report);
        log(`[STORE] Loaded from ${source}:`, final.pluginData?.coachData?.courses?.length ?? 0, 'courses,', final.pluginData?.quizHistory?.length ?? 0, 'quiz entries');
        lastSavedData = final;
        setDataRaw(final);
      }
      // One-time cleanup of stale sync-v2 localStorage keys
      if (!localStorage.getItem('sync-v3-migrated')) {
        ['nousai_lamport', 'nousai-pre-pull-backup', 'nous_card_count_checkpoint'].forEach(k => localStorage.removeItem(k));
        localStorage.setItem('sync-v3-migrated', 'true');
      }

      loadedRef.current = true;
      setLoaded(true);
    })();
  }, []);

  // D3: TODO — Defer pull during active edits. This requires threading an isEditing
  // state through all editor components (TipTap, flashcard editor, quiz creation, etc.)
  // and checking it before triggering auto-pulls. Skipped for now — too invasive.

  // Persist to IndexedDB on change — debounced to avoid redundant writes during rapid updates
  // LEADER ELECTION: Only the leader tab writes to IDB. Follower tabs send mutations to the leader.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!data) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      // Safety: don't save to IDB before the initial load has completed (prevents race condition
      // where a pre-load state transition could wipe persisted data). After loadedRef is true, any
      // state (including 0 courses) represents an intentional user action and must be persisted.
      if (!loadedRef.current) {
        warn('[STORE] Blocked save: initial IDB load not yet complete');
        return;
      }

      // Follower tabs: send mutation to leader instead of writing IDB directly.
      // IMPORTANT: 'undecided' tabs (leader election pending) save directly —
      // otherwise data from onboarding/import is lost because sendMutationToLeader
      // broadcasts to a leader that doesn't exist yet.
      if (getRole() === 'follower') {
        if (!fromSyncRef.current) {
          sendMutationToLeader(data);
        } else {
          fromSyncRef.current = false;
        }
        localDirtyRef.current = false;
        return;
      }

      // Leader tab: save to legacy IDB (primary, reliable)
      const MAX_QUIZ_HISTORY = 500;
      const qh = data.pluginData?.quizHistory;
      const dataToSave = (qh && qh.length > MAX_QUIZ_HISTORY)
        ? { ...data, pluginData: { ...data.pluginData, quizHistory: qh.slice(-MAX_QUIZ_HISTORY) } }
        : data;
      // PRIMARY: Legacy IDB — always works, never corrupts
      saveToIDB(dataToSave);
      // Schedule cloud sync if logged in
      const uid = localStorage.getItem('nousai-auth-uid');
      if (uid && syncSchedulerRef.current) {
        syncSchedulerRef.current.schedulePush(dataToSave);
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
        log('[STORE] Became leader — owning IDB writes');
      },
      onLoseLeadership: () => {
        tabRoleRef.current = 'follower';
        log('[STORE] Lost leadership — switching to read-only');
      },
      onMessage: (msg: { type: string; payload?: unknown }) => {
        if (msg?.type === 'data-changed') {
          // Another tab (leader) updated RxDB — reload
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(async () => {
            try {
              const fresh = await loadFromIDB();
              if (fresh) {
                fromSyncRef.current = true;
                setDataRaw(normalizeData(fresh));
              }
            } catch (err) {
              console.error('[STORE] Cross-tab sync failed:', err);
              fromSyncRef.current = false;
            }
          }, 300);
        } else if (msg?.type === 'follower-mutation' && isLeader()) {
          // A follower tab sent us its updated state — use it directly
          const followerData = msg.payload as NousAIData;
          if (followerData) {
            const merged = normalizeData(followerData);
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

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => setSyncStatus(prev => prev === 'offline' ? 'idle' : prev);
    const goOffline = () => setSyncStatus('offline');
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Sync V3: start/stop scheduler on auth change ────────
  useEffect(() => {
    const uid = localStorage.getItem('nousai-auth-uid');
    if (uid && loaded) {
      const scheduler = new SyncScheduler(uid);
      scheduler.onStatusChange = (status) => setSyncStatus(status);
      scheduler.start(() => dataRef.current);
      syncSchedulerRef.current = scheduler;
      // Pull on login
      scheduler.pullOnLogin(dataRef.current).then(result => {
        if (result) {
          fromSyncRef.current = true;
          setDataRaw(normalizeData(result));
        }
      });
      return () => {
        scheduler.stop();
        syncSchedulerRef.current = null;
      };
    }
  }, [loaded]);

  const startRemoteWatch = useCallback((_uid: string) => { /* TODO: sync-v3 */ }, []);
  const stopRemoteWatch = useCallback(() => { /* TODO: sync-v3 */ }, []);
  const loadRemoteData = useCallback(async () => { /* TODO: sync-v3 */ }, []);
  const dismissRemoteBanner = useCallback(() => { setRemoteUpdateAvailable(false); }, []);

  // ── Global sync triggers (for Ctrl+S / Ctrl+Shift+S hotkeys) ────
  const triggerSyncToCloud = useCallback(async () => {
    const uid = localStorage.getItem('nousai-auth-uid');
    if (!uid || !data) {
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'Sign in first to sync' }));
      return;
    }
    setSyncStatus('syncing');
    try {
      if (syncSchedulerRef.current) {
        await syncSchedulerRef.current.triggerNow(data);
      }
      setSyncStatus('synced');
      setLastSyncAt(new Date().toISOString());
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'Synced to cloud!' }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message || (e as { code?: string })?.code || JSON.stringify(e);
      console.error('[STORE] Sync to cloud failed:', msg, e);
      setSyncStatus('error');
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: `Sync failed: ${msg}` }));
    }
  }, [data]);

  const triggerSyncFromCloud = useCallback(async () => {
    const uid = localStorage.getItem('nousai-auth-uid');
    if (!uid) {
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'Sign in first to sync' }));
      return;
    }
    setSyncStatus('syncing');
    try {
      const result = await pullFromCloud(uid, dataRef.current, true); // force — user-initiated
      if (result) {
        setData(normalizeData(result));
        setSyncStatus('synced');
        setLastSyncAt(new Date().toISOString());
        window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'Pulled from cloud!' }));
      } else {
        setSyncStatus('idle');
      }
    } catch (e: unknown) {
      setSyncStatus('error');
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: `Pull failed: ${e instanceof Error ? e.message : 'Unknown'}` }));
    }
  }, [setData]);


  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Leader: force-flush to IDB immediately (no debounce)
        if (isLeader()) {
          if (dataRef.current) saveToIDB(dataRef.current);
        } else if (dataRef.current && localDirtyRef.current) {
          // Follower: stash unsaved state to localStorage before tab goes hidden
          try {
            localStorage.setItem('nousai-crash-recovery', JSON.stringify(dataRef.current));
            localStorage.setItem('nousai-crash-recovery-at', new Date().toISOString());
          } catch { /* quota exceeded */ }
        }
      }
    };
    const handlePageHide = () => {
      if (isLeader() && dataRef.current) saveToIDB(dataRef.current);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  // Flush to IDB immediately on tab close so no data is lost
  useEffect(() => {
    const flush = () => {
      if (dataRef.current) {
        if (isLeader()) {
          saveToIDB(dataRef.current);
        } else {
          try {
            localStorage.setItem('nousai-crash-recovery', JSON.stringify(dataRef.current));
            localStorage.setItem('nousai-crash-recovery-at', new Date().toISOString());
          } catch { /* localStorage quota exceeded */ }
        }
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  function importData(json: string) {
    try {
      // Pre-import: TODO sync-v3 — snapshot before overwriting
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
      // Restore study guide HTML from export if present
      if (parsed._studyGuideHtml && typeof parsed._studyGuideHtml === 'object') {
        import('./features/study-generator/studyGuideStore').then(({ saveAllGuideHtml }) => {
          saveAllGuideHtml(parsed._studyGuideHtml).catch(() => {});
        });
      }
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
    // Include study guide HTML from dedicated IDB store in the export
    let json = exportData();
    try {
      const { loadAllGuideHtml } = await import('./features/study-generator/studyGuideStore');
      const guideHtmlMap = await loadAllGuideHtml();
      if (Object.keys(guideHtmlMap).length > 0) {
        const parsed = JSON.parse(json);
        parsed._studyGuideHtml = guideHtmlMap;
        json = JSON.stringify(parsed, null, 2);
      }
    } catch { /* ignore — export still works without guide HTML */ }
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
    } catch (e: unknown) { console.error('[STORE] Import from file failed:', e); return false; }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => { const v = data?.settings?.canvasEvents; return Array.isArray(v) ? v : []; }, [data?.settings?.canvasEvents]);
  const quizHistory = useMemo(() => { const v = data?.pluginData?.quizHistory; return Array.isArray(v) ? v.filter(q => !q.deleted) : []; }, [data?.pluginData?.quizHistory]);
  const courses = useMemo(() => { const v = data?.pluginData?.coachData?.courses; return Array.isArray(v) ? v.filter(c => !c.deleted) : []; }, [data?.pluginData?.coachData?.courses]);
  const gamification = useMemo(() => data?.pluginData?.gamificationData || emptyGamification, [data?.pluginData?.gamificationData]);
  const proficiency = useMemo(() => data?.pluginData?.proficiencyData || null, [data?.pluginData?.proficiencyData]);
  const srData = useMemo(() => data?.pluginData?.srData || null, [data?.pluginData?.srData]);
  const timerState = useMemo(() => data?.pluginData?.timerState || emptyTimer, [data?.pluginData?.timerState]);
  const matchSets: MatchSet[] = useMemo(() => { const v = data?.pluginData?.matchSets; return Array.isArray(v) ? (v as MatchSet[]).filter(m => !m.deleted) : []; }, [data?.pluginData?.matchSets]);

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
    return Array.isArray(v) ? (v as SavedVideo[]).filter(vid => !vid.deleted) : [];
  }, [data?.pluginData?.savedVideos]);

  function addVideo(video: SavedVideo) {
    updatePluginData({ savedVideos: [...savedVideos, video] });
  }

  function deleteVideo(videoId: string) {
    if (!data) return;
    const allVideos = (data.pluginData?.savedVideos || []) as SavedVideo[];
    updatePluginData({
      savedVideos: allVideos.map(v => v.id === videoId ? { ...v, deleted: true, deletedAt: Date.now() } : v),
      deletionLog: [...(data.pluginData.deletionLog || []), { id: videoId, entityType: 'video', deletedAt: Date.now() }]
    });
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
    // Include study guide HTML in backup
    let payload: Record<string, unknown> = { ...data };
    try {
      const { loadAllGuideHtml } = await import('./features/study-generator/studyGuideStore');
      const guideHtml = await loadAllGuideHtml();
      if (Object.keys(guideHtml).length > 0) payload._studyGuideHtml = guideHtml;
    } catch { /* backup still works without guide HTML */ }
    const json = JSON.stringify(payload, null, 2);
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
    deviceSettings, setDeviceSettings,
    isReviewActive, setIsReviewActive,
    modalOpen, setModalOpen,
    annotationPanelOpen, setAnnotationPanelOpen,
  }), [data, loaded, matchSets, savedVideos, events, quizHistory, courses, gamification, proficiency, srData, timerState, einkMode, betaMode, // eslint-disable-line react-hooks/exhaustive-deps
    setData, updatePluginData, copyToClipboard, exportToFile, backupNow, triggerSyncToCloud, triggerSyncFromCloud,
    syncStatus, lastSyncAt, remoteUpdateAvailable,
    startRemoteWatch, stopRemoteWatch, loadRemoteData, dismissRemoteBanner,
    activePageContext, hiddenToolIds, healthReport,
    deviceSettings, setDeviceSettings,
    isReviewActive, setIsReviewActive, modalOpen, setModalOpen, annotationPanelOpen, setAnnotationPanelOpen]);

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);

/* ── IDB timeout wrapper ─────────────────────────────────── */
function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
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
  const validation = validateWrite(data, lastSavedData);
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
    if (cleared) log('[PWA] Cleared service worker + caches');
  } catch (e) {
    warn('[PWA] Cache clear failed:', e);
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
  } catch (e: unknown) { console.error('[BACKUP] Failed to load handle:', e); return null; }
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
    if (perm !== 'granted') { warn('[BACKUP] Permission denied'); return false; }

    // Write timestamped file
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 16); // 2026-03-12T15-30
    const filename = `nousai-backup-${ts}.json`;
    const file = await handle.getFileHandle(filename, { create: true });
    const writable = await file.createWritable();
    await writable.write(json);
    await writable.close();
    log('[BACKUP] Wrote', filename);

    // Prune old backups beyond MAX_BACKUPS
    const backups: string[] = [];
    for await (const [name] of (handle as any).entries()) {
      if (name.startsWith('nousai-backup-') && name.endsWith('.json')) backups.push(name);
    }
    backups.sort();
    if (backups.length > MAX_BACKUPS) {
      for (const old of backups.slice(0, backups.length - MAX_BACKUPS)) {
        try { await handle.removeEntry(old); log('[BACKUP] Pruned', old); } catch { /* skip */ }
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
