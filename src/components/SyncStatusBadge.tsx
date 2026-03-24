/**
 * SyncStatusBadge — persistent sync status indicator in the app header.
 * Shows current sync state and warns if last sync > 10 minutes ago.
 * Science: Nielsen's Heuristic #1 — Visibility of System Status.
 */
import { useState } from 'react';
import { useStore } from '../store';

const STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  synced:  { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', dot: '#22c55e', label: 'Synced' },
  syncing: { bg: 'rgba(245,166,35,0.12)', color: '#F5A623', dot: '#F5A623', label: 'Syncing...' },
  error:   { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', dot: '#ef4444', label: 'Sync Failed' },
  offline: { bg: 'rgba(156,163,175,0.12)', color: '#9ca3af', dot: '#9ca3af', label: 'Offline' },
  idle:    { bg: 'rgba(156,163,175,0.08)', color: '#9ca3af', dot: '#6b7280', label: 'Idle' },
};

export default function SyncStatusBadge() {
  const { syncStatus, lastSyncAt, healthReport } = useStore();
  const [expanded, setExpanded] = useState(false);
  const style = STYLES[syncStatus] || STYLES.idle;

  // Warning if last sync > 10 minutes ago
  const staleSync = lastSyncAt
    ? (Date.now() - new Date(lastSyncAt).getTime()) > 10 * 60 * 1000
    : false;

  const healthScore = healthReport?.score ?? null;
  const healthColor = healthScore === null ? '#6b7280'
    : healthScore >= 80 ? '#22c55e'
    : healthScore >= 50 ? '#F5A623'
    : '#ef4444';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 12,
          background: staleSync ? 'rgba(239,68,68,0.12)' : style.bg,
          border: '1px solid transparent',
          color: staleSync ? '#ef4444' : style.color,
          fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: staleSync ? '#ef4444' : style.dot,
          animation: syncStatus === 'syncing' ? 'pulse 1s infinite' : undefined,
        }} />
        {staleSync ? 'Stale' : style.label}
      </button>

      {expanded && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: 'var(--bg-card, #1a1a2e)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px', minWidth: 200,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1000,
          fontSize: 12, color: 'var(--text-primary)',
        }}>
          <div style={{ marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Sync Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Row label="Status" value={style.label} color={style.color} />
            <Row label="Last Sync" value={lastSyncAt ? formatAgo(lastSyncAt) : 'Never'} color={staleSync ? '#ef4444' : undefined} />
            {healthScore !== null && (
              <Row label="Health" value={`${healthScore}/100`} color={healthColor} />
            )}
            {healthReport && healthReport.issues.length > 0 && (
              <div style={{ marginTop: 4, padding: '4px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', fontSize: 10 }}>
                {healthReport.issues.slice(0, 3).map((issue, i) => (
                  <div key={i} style={{ color: issue.severity === 'critical' ? '#ef4444' : issue.severity === 'warning' ? '#F5A623' : '#9ca3af' }}>
                    [{issue.severity}] {issue.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: color || 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'Just now';
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86400_000) return `${Math.round(ms / 3600_000)}h ago`;
  return `${Math.round(ms / 86400_000)}d ago`;
}
