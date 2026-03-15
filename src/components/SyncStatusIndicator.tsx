import { useState, useEffect } from 'react'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

interface Props {
  status: SyncStatus
  lastSyncAt: string | null
}

function formatAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

export default function SyncStatusIndicator({ status, lastSyncAt }: Props) {
  // Re-render every minute so "X min ago" stays current
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  let dotClass = 'sync-dot'
  let label = ''

  if (status === 'syncing') {
    dotClass += ' sync-dot-syncing'
    label = 'Syncing...'
  } else if (status === 'synced' || status === 'idle') {
    dotClass += ' sync-dot-synced'
    label = lastSyncAt ? `Synced ${formatAgo(lastSyncAt)}` : ''
  } else if (status === 'offline') {
    dotClass += ' sync-dot-offline'
    label = 'Offline'
  } else if (status === 'error') {
    dotClass += ' sync-dot-error'
    label = 'Sync failed'
  }

  if (!label) return null

  return (
    <div className="sync-indicator" role="status" aria-label={label}>
      <span className={dotClass} />
      <span className="sync-indicator-label">{label}</span>
    </div>
  )
}
