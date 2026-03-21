/**
 * VirtualStreamDeck — NousAI
 *
 * Touch-screen replica of the Elgato Stream Deck MK.2 for devices that don't
 * support WebHID (Boox, iPad, Firefox, etc.).
 *
 * Also acts as the RECEIVER of cross-device Stream Deck relay events:
 * - Windows presses a physical key → Firestore → this component fires the action
 * - Tapping a virtual button → Firestore → Windows fires the action
 *
 * Usage: render on any page where Stream Deck actions are relevant.
 * Visibility: collapses to a floating tab by default, expands on tap.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { streamDeckService } from '../utils/streamDeckService';
import type { StreamDeckMode, StreamDeckModeConfig } from '../utils/streamDeckService';
import { watchQKAction } from '../utils/auth';
import type { QKActionPayload } from '../utils/auth';
import { getDeviceFingerprint } from '../utils/contentRelay';

interface VirtualStreamDeckProps {
  uid: string;
}

const MODE_COLORS: Record<StreamDeckMode, string> = {
  flashcard: '#F5A623',
  quiz:       '#EF4444',
  drawing:    '#22C55E',
  navigation: '#3B82F6',
  notes:      '#A855F7',
};

const MODE_ICONS: Record<StreamDeckMode, string> = {
  flashcard:  '📖',
  quiz:       '❓',
  drawing:    '✏️',
  navigation: '🧭',
  notes:      '📝',
};

const STALE_MS = 5_000; // Ignore relay events older than 5 seconds

export default function VirtualStreamDeck({ uid }: VirtualStreamDeckProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(() => streamDeckService.getConfig());
  const [flashedBtn, setFlashedBtn] = useState<number | null>(null);
  const myFingerprint = useRef(getDeviceFingerprint());

  // Sync config from service
  useEffect(() => {
    return streamDeckService.subscribe(() => setConfig(streamDeckService.getConfig()));
  }, []);

  // Relay receiver — fire actions from other devices
  useEffect(() => {
    const unsub = watchQKAction(uid, (payload: QKActionPayload) => {
      // Ignore our own relay events (echo prevention)
      if (payload.fromDevice === myFingerprint.current) return;
      // Ignore stale events
      if (Date.now() - payload.ts > STALE_MS) return;
      streamDeckService.dispatchActionFromRelay(payload.actionId);
      // Flash the matching button in the virtual panel
      const modeConfig = config.modes[config.currentMode];
      const idx = modeConfig.buttons.findIndex((b) => b.actionId === payload.actionId);
      if (idx >= 0) {
        setFlashedBtn(idx);
        setTimeout(() => setFlashedBtn(null), 400);
      }
    });
    return unsub;
  }, [uid, config]);

  const handleButtonPress = useCallback((buttonIndex: number, actionId: string) => {
    // Flash feedback
    setFlashedBtn(buttonIndex);
    setTimeout(() => setFlashedBtn(null), 200);
    // Dispatch locally and relay to other devices
    streamDeckService.dispatchActionFromVirtual(actionId);
  }, []);

  const modeConfig: StreamDeckModeConfig = config.modes[config.currentMode];
  const accentColor = MODE_COLORS[config.currentMode];

  return (
    <div style={{ position: 'fixed', bottom: 88, right: 16, zIndex: 900, fontFamily: 'var(--font-mono, monospace)' }}>
      {/* Collapsed tab */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            background: accentColor,
            color: '#000',
            border: 'none',
            borderRadius: 10,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(0,0,0,.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          aria-label="Open virtual Stream Deck"
        >
          {MODE_ICONS[config.currentMode]} SD
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div
          style={{
            background: '#1a1a1a',
            border: `1px solid ${accentColor}44`,
            borderRadius: 14,
            padding: 12,
            width: 260,
            boxShadow: '0 8px 32px rgba(0,0,0,.6)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: accentColor, fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>
              {MODE_ICONS[config.currentMode]} STREAM DECK
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
              aria-label="Close virtual Stream Deck"
            >×</button>
          </div>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {(Object.keys(MODE_COLORS) as StreamDeckMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => streamDeckService.setMode(mode)}
                style={{
                  background: config.currentMode === mode ? MODE_COLORS[mode] : '#2a2a2a',
                  color: config.currentMode === mode ? '#000' : '#aaa',
                  border: 'none',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1, 4)}
              </button>
            ))}
          </div>

          {/* 3×5 button grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {modeConfig.buttons.map((btn, i) => (
              <button
                key={i}
                onPointerDown={() => handleButtonPress(i, btn.actionId)}
                style={{
                  background: flashedBtn === i ? accentColor : '#2a2a2a',
                  color: flashedBtn === i ? '#000' : '#e5e7eb',
                  border: `1px solid ${flashedBtn === i ? accentColor : '#333'}`,
                  borderRadius: 8,
                  padding: '10px 6px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background .15s, color .15s',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
                <span style={{ display: 'block', color: '#555', fontSize: 10, marginBottom: 2 }}>{i + 1}</span>
                {btn.label}
              </button>
            ))}
          </div>

          {/* Relay status */}
          <div style={{ marginTop: 8, fontSize: 10, color: '#555', textAlign: 'center' }}>
            Cross-device relay active · actions sync instantly
          </div>
        </div>
      )}
    </div>
  );
}
