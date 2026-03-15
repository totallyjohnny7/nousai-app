/**
 * ConflictModal — shown when local and cloud data checksums differ
 *
 * Never auto-overwrites. User always decides which version to keep.
 * Utility functions (detectConflict, etc.) live in utils/conflictDetection.ts
 */
import React, { useEffect, useRef } from 'react';
import type { ConflictInfo } from '../utils/conflictDetection';

export type { ConflictInfo };

interface ConflictModalProps {
  conflict: ConflictInfo;
  onKeepLocal: () => void;
  onKeepCloud: () => void;
}

function formatAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${Math.floor(diffHr / 24)} days ago`;
}

export function ConflictModal({ conflict, onKeepLocal, onKeepCloud }: ConflictModalProps) {
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  // Focus first button on mount
  useEffect(() => {
    firstBtnRef.current?.focus();
  }, []);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onKeepLocal(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onKeepLocal]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: '1px solid var(--border, #333)',
          borderRadius: 12,
          padding: 28,
          maxWidth: 440,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <h2 id="conflict-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
            Sync Conflict Detected
          </h2>
        </div>

        <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
          <strong style={{ color: 'var(--text-primary, #fff)' }}>"{conflict.entityName}"</strong> was
          changed in two places. Which version do you want to keep?
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button
            ref={firstBtnRef}
            onClick={onKeepLocal}
            style={{
              flex: 1,
              padding: '14px 12px',
              borderRadius: 10,
              border: '2px solid var(--accent, #6366f1)',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--accent, #6366f1)', fontSize: 14, marginBottom: 4 }}>
              Keep Local
            </div>
            <div style={{ color: 'var(--text-secondary, #aaa)', fontSize: 12 }}>
              Edited {formatAgo(conflict.localTimestamp)}
            </div>
            <div style={{ color: 'var(--text-dim, #666)', fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>
              #{conflict.localChecksum.slice(0, 8)}
            </div>
          </button>

          <button
            onClick={onKeepCloud}
            style={{
              flex: 1,
              padding: '14px 12px',
              borderRadius: 10,
              border: '1px solid var(--border, #333)',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--text-primary, #fff)', fontSize: 14, marginBottom: 4 }}>
              Use Cloud
            </div>
            <div style={{ color: 'var(--text-secondary, #aaa)', fontSize: 12 }}>
              Saved {formatAgo(conflict.cloudTimestamp)}
            </div>
            <div style={{ color: 'var(--text-dim, #666)', fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>
              #{conflict.cloudChecksum.slice(0, 8)}
            </div>
          </button>
        </div>

        <p style={{ color: 'var(--text-dim, #666)', fontSize: 12, margin: 0 }}>
          Your choice is remembered for this session. A backup of both versions is saved automatically.
        </p>
      </div>
    </div>
  );
}
