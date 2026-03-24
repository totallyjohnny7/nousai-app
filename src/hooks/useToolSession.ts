/**
 * useToolSession — Generic hook for crash-safe tool session persistence.
 *
 * Any learn tool can use this to:
 *  - Start a new session (creates ToolSession in Zustand store → IDB → cloud)
 *  - Add messages (auto-persists on every message)
 *  - Resume a previous session
 *  - Log errors and mark sessions as broken
 *
 * Sessions are stored in pluginData.toolSessions and synced via the existing
 * AutoSyncScheduler pipeline (IDB → Firestore).
 */
import { useCallback, useRef } from 'react';
import { useStore } from '../store';
import type { ToolSession, ToolError } from '../types';

const MAX_SESSIONS = 100;

interface UseToolSessionOpts {
  toolName: string;
  toolIcon: string;
  courseId?: string | null;
  courseName?: string | null;
}

export function useToolSession(opts: UseToolSessionOpts) {
  const { data, setData } = useStore();
  const activeIdRef = useRef<string | null>(null);

  const getSessions = useCallback((): ToolSession[] => {
    return (data?.pluginData?.toolSessions as ToolSession[] | undefined) ?? [];
  }, [data]);

  // Uses functional updater via setData to always read latest state (no stale closures)
  const updateSessions = useCallback((updater: (prev: ToolSession[]) => ToolSession[]) => {
    setData((prev) => {
      const current = (prev.pluginData?.toolSessions as ToolSession[] | undefined) ?? [];
      let sessions = updater(current);
      // Enforce max sessions — evict oldest healthy sessions first
      if (sessions.length > MAX_SESSIONS) {
        const healthy = sessions.filter(s => s.sessionState === 'healthy').sort((a, b) => a.updatedAt - b.updatedAt);
        const excess = sessions.length - MAX_SESSIONS;
        const evictedIds = new Set(healthy.slice(0, excess).map(s => s.id));
        sessions = sessions.filter(s => !evictedIds.has(s.id));
      }
      return { ...prev, pluginData: { ...prev.pluginData, toolSessions: sessions } };
    });
  }, [setData]);

  /** Start a new session — returns the session ID */
  const startSession = useCallback((topic: string): string => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const session: ToolSession = {
      id,
      toolName: opts.toolName,
      toolIcon: opts.toolIcon,
      courseId: opts.courseId ?? null,
      courseName: opts.courseName ?? null,
      topic,
      messages: [],
      createdAt: now,
      updatedAt: now,
      preview: '',
      syncStatus: 'pending',
      localVersion: 1,
      cloudVersion: 0,
      hadError: false,
      errorLog: [],
      wasAutoFixed: false,
      fixApplied: null,
      sessionState: 'healthy',
    };
    activeIdRef.current = id;
    updateSessions(prev => [session, ...prev]);
    return id;
  }, [opts, updateSessions]);

  /** Add a message to the active session */
  const addMessage = useCallback((role: 'user' | 'ai', text: string) => {
    const sid = activeIdRef.current;
    if (!sid) return;
    updateSessions(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const messages = [...s.messages, { role, text }];
      const preview = s.preview || (role === 'ai' ? text.slice(0, 100) : s.preview);
      return {
        ...s,
        messages,
        preview,
        updatedAt: Date.now(),
        localVersion: s.localVersion + 1,
        syncStatus: 'pending' as const,
      };
    }));
  }, [updateSessions]);

  /** Update the last AI message (for streaming) */
  const updateLastAiMessage = useCallback((text: string) => {
    const sid = activeIdRef.current;
    if (!sid) return;
    updateSessions(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const messages = [...s.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === 'ai') {
        messages[lastIdx] = { ...messages[lastIdx], text };
      }
      const preview = s.preview || text.slice(0, 100);
      return { ...s, messages, preview, updatedAt: Date.now(), syncStatus: 'pending' as const };
    }));
  }, [updateSessions]);

  /** Resume an existing session by ID */
  const resumeSession = useCallback((sessionId: string): ToolSession | null => {
    const sessions = getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      activeIdRef.current = sessionId;
    }
    return session ?? null;
  }, [getSessions]);

  /** Log an error on the active session */
  const logError = useCallback((error: Omit<ToolError, 'timestamp' | 'recoveryAttempted' | 'recoverySucceeded' | 'fixDescription'>) => {
    const sid = activeIdRef.current;
    if (!sid) return;
    const toolError: ToolError = {
      ...error,
      timestamp: Date.now(),
      recoveryAttempted: false,
      recoverySucceeded: false,
      fixDescription: null,
    };
    updateSessions(prev => prev.map(s => {
      if (s.id !== sid) return s;
      return {
        ...s,
        hadError: true,
        errorLog: [...s.errorLog, toolError],
        sessionState: 'broken' as const,
        updatedAt: Date.now(),
        syncStatus: 'pending' as const,
      };
    }));
  }, [updateSessions]);

  /** Mark the active session as fixed after recovery */
  const markFixed = useCallback((fixDescription: string) => {
    const sid = activeIdRef.current;
    if (!sid) return;
    updateSessions(prev => prev.map(s => {
      if (s.id !== sid) return s;
      return {
        ...s,
        wasAutoFixed: true,
        fixApplied: fixDescription,
        sessionState: 'fixed' as const,
        updatedAt: Date.now(),
        syncStatus: 'pending' as const,
      };
    }));
  }, [updateSessions]);

  /** Delete a session by ID */
  const deleteSession = useCallback((sessionId: string) => {
    if (activeIdRef.current === sessionId) activeIdRef.current = null;
    updateSessions(prev => prev.filter(s => s.id !== sessionId));
  }, [updateSessions]);

  /** Get the active session */
  const getActiveSession = useCallback((): ToolSession | null => {
    if (!activeIdRef.current) return null;
    return getSessions().find(s => s.id === activeIdRef.current) ?? null;
  }, [getSessions]);

  return {
    sessions: getSessions(),
    activeSessionId: activeIdRef.current,
    startSession,
    addMessage,
    updateLastAiMessage,
    resumeSession,
    logError,
    markFixed,
    deleteSession,
    getActiveSession,
  };
}
