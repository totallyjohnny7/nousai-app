import { useEffect } from 'react'
import { RefreshCw, X } from 'lucide-react'

interface Props {
  onLoad: () => void
  onDismiss: () => void
}

export default function SyncStatusBanner({ onLoad, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 60_000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="sync-banner">
      <span className="sync-banner-text">New data available from another device</span>
      <button className="sync-banner-btn" onClick={onLoad}>
        <RefreshCw size={12} /> Load Now
      </button>
      <button className="sync-banner-dismiss" onClick={onDismiss} aria-label="Dismiss">
        <X size={12} />
      </button>
    </div>
  )
}
