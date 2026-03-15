import { useState, useEffect, useCallback } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { speak, stopSpeaking, isSpeaking, isTTSAvailable } from '../utils/speechTools'

interface ReadAloudButtonProps {
  text: string
  /** Optional small label shown next to icon */
  label?: string
  className?: string
}

export default function ReadAloudButton({ text, label, className }: ReadAloudButtonProps) {
  const [speaking, setSpeaking] = useState(false)

  // Poll speaking state (Web Speech API lacks reliable React state events)
  useEffect(() => {
    if (!speaking) return
    const id = setInterval(() => {
      if (!isSpeaking()) { setSpeaking(false) }
    }, 300)
    return () => clearInterval(id)
  }, [speaking])

  const toggle = useCallback(() => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
    } else {
      speak(text, {}, () => setSpeaking(false))
      setSpeaking(true)
    }
  }, [speaking, text])

  if (!isTTSAvailable()) return null

  return (
    <button
      onClick={toggle}
      aria-label={speaking ? 'Stop reading aloud' : 'Read aloud'}
      title={speaking ? 'Stop' : 'Read aloud'}
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: speaking ? 'var(--color-accent)' : 'var(--bg-secondary)',
        color: speaking ? '#000' : 'var(--text-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 6, padding: '3px 8px', fontSize: 12,
        cursor: 'pointer', transition: 'all 0.15s', fontWeight: 500,
      }}
    >
      {speaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
      {label && <span>{speaking ? 'Stop' : label}</span>}
    </button>
  )
}
