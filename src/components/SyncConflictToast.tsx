import { useEffect, useState } from 'react'
import type { SyncResolution } from '../utils/conflictDetection'

const MESSAGES: Record<SyncResolution, string> = {
  merge: 'Sync conflict resolved — your data was safely merged',
  'cloud-wins': 'Cloud data was newer — local updated',
  'local-wins': 'Your local data was fresher — cloud updated',
}

const ICONS: Record<SyncResolution, string> = {
  merge: '\u26A1',
  'cloud-wins': '\u2601\uFE0F',
  'local-wins': '\uD83D\uDCBE',
}

export default function SyncConflictToast() {
  const [visible, setVisible] = useState(false)
  const [resolution, setResolution] = useState<SyncResolution>('merge')

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SyncResolution>).detail
      if (detail) {
        setResolution(detail)
        setVisible(true)
      }
    }
    window.addEventListener('nousai-sync-resolution', handler)
    return () => window.removeEventListener('nousai-sync-resolution', handler)
  }, [])

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
        padding: '10px 16px', borderRadius: 'var(--radius-sm, 6px)',
        background: 'var(--bg-card, #1a1a2e)', color: 'var(--text-primary, #e0e0e0)',
        border: '1px solid var(--border, #333)', fontSize: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', maxWidth: 320,
        animation: 'fadeIn 0.2s ease-out',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span style={{ fontSize: 16 }}>{ICONS[resolution]}</span>
      <span>{MESSAGES[resolution]}</span>
    </div>
  )
}
