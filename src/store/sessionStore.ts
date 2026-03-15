/**
 * sessionStore — Zustand-persisted "Scribe OS" session manager.
 *
 * Each unique questionId gets a UUID-keyed ScribeSession that survives
 * page reloads (via localStorage). Canvas PNG lives in IDB; only the
 * IDB key is stored here (too large for localStorage).
 *
 * The Library tab queries all sessions for the current subject so the
 * student can Rehydrate any past annotation into the sidecar.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ───────────────────────────────────────────────────────────

export interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
}

export interface ScribeSession {
  sessionId: string;
  questionId: string;
  questionText: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
  textContent: string;
  canvasKey?: string;   // IDB storage key for canvas PNG (not stored here)
  chatLog: ChatMsg[];
  hasCanvas: boolean;
}

interface SessionState {
  /** sessionId → ScribeSession */
  sessions: Record<string, ScribeSession>;
  /** questionId → sessionId (so same question always reuses its session) */
  questionMap: Record<string, string>;

  // ── Actions ──
  /** Returns existing session for question, or creates a new one */
  getOrCreate: (questionId: string, questionText: string, subject: string) => ScribeSession;
  updateText: (sessionId: string, text: string) => void;
  setCanvasKey: (sessionId: string, canvasKey: string) => void;
  updateChat: (sessionId: string, msgs: ChatMsg[]) => void;
  getSessionsBySubject: (subject: string) => ScribeSession[];
  getAllSessions: () => ScribeSession[];
  /** Delete a specific session (optional housekeeping) */
  deleteSession: (sessionId: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Store ────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: {},
      questionMap: {},

      getOrCreate: (questionId, questionText, subject) => {
        const { sessions, questionMap } = get();
        const existingId = questionMap[questionId];
        if (existingId && sessions[existingId]) {
          return sessions[existingId];
        }
        const sessionId = genId();
        const now = new Date().toISOString();
        const session: ScribeSession = {
          sessionId,
          questionId,
          questionText,
          subject,
          createdAt: now,
          updatedAt: now,
          textContent: '',
          chatLog: [],
          hasCanvas: false,
        };
        set(state => ({
          sessions: { ...state.sessions, [sessionId]: session },
          questionMap: { ...state.questionMap, [questionId]: sessionId },
        }));
        return session;
      },

      updateText: (sessionId, text) => {
        set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...s, textContent: text, updatedAt: new Date().toISOString() },
            },
          };
        });
      },

      setCanvasKey: (sessionId, canvasKey) => {
        set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...s, canvasKey, hasCanvas: true,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      updateChat: (sessionId, msgs) => {
        set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...s, chatLog: msgs, updatedAt: new Date().toISOString() },
            },
          };
        });
      },

      getSessionsBySubject: (subject) =>
        Object.values(get().sessions)
          .filter(s => s.subject === subject)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

      getAllSessions: () =>
        Object.values(get().sessions)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

      deleteSession: (sessionId) => {
        set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          const { [sessionId]: _removed, ...restSessions } = state.sessions;
          const { [s.questionId]: _removedMap, ...restMap } = state.questionMap;
          return { sessions: restSessions, questionMap: restMap };
        });
      },
    }),
    {
      name: 'nousai-scribe-sessions',
      // Exclude derived state from persistence — just keep the raw data
      partialize: (state) => ({
        sessions: state.sessions,
        questionMap: state.questionMap,
      }),
    }
  )
);
