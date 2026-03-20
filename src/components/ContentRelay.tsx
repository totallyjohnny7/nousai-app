/**
 * ContentRelay — Seamless Cross-Device Content Relay
 *
 * Auto-opens panel the instant a payload arrives — no hunting for the badge.
 * Handles text, URL, note, image, and drawing types.
 * Offline-queued: payloads sent while offline flush automatically when back online.
 * Large content (>100KB): auto-uploaded to Firebase Storage, not Firestore.
 * Delay reminders: "Still sending…" after 3s; "Queued items delivered" when back online.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { buildRelayPayload, sendToRelay, subscribeToRelay } from '../utils/contentRelay';
import type { RelayPayload, RelayContentType } from '../types';

interface Props {
  uid: string;
}

const RELAY_QUEUE_KEY = 'nousai-relay-queue';
/** Show "Still sending…" if Firestore write takes longer than this */
const SLOW_SEND_MS = 3_000;
/** Show a size warning hint when content exceeds this */
const LARGE_HINT_BYTES = 100_000;

function relayTypeLabel(type: RelayContentType): string {
  return { text: 'Text', url: 'URL', note: 'Note', image: 'Image', drawing: 'Drawing ✏️' }[type] ?? type;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContentRelay({ uid }: Props) {
  const { data, updatePluginData } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<RelayPayload | null>(null);
  const [sendText, setSendText] = useState('');
  const [sendType, setSendType] = useState<RelayContentType>('text');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSlow, setSendSlow] = useState(false);       // "Still sending…" after 3s
  const [queueFlushed, setQueueFlushed] = useState(0);   // # items delivered from offline queue
  const [pulse, setPulse] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe — auto-open panel and pulse FAB on arrival
  useEffect(() => {
    const subscribe = () => {
      unsubRef.current = subscribeToRelay(uid, (payload) => {
        // Handle download error gracefully
        if (payload.content === '__relay_download_error__') {
          setSendError('Large content could not be downloaded. Check your connection.');
          return;
        }
        setPendingPayload(payload);
        setOpen(true);      // auto-open panel instantly
        setPulse(true);     // pulse animation on FAB
        setTimeout(() => setPulse(false), 1500);
      });
    };

    const handleVisibility = () => {
      if (document.hidden) {
        unsubRef.current?.();
        unsubRef.current = null;
      } else {
        subscribe();
      }
    };

    subscribe();
    document.addEventListener('visibilitychange', handleVisibility);

    // Flush offline queue on connection restore — notify user items were delivered
    const flushQueue = () => {
      const raw = localStorage.getItem(RELAY_QUEUE_KEY);
      if (!raw) return;
      try {
        const queue: RelayPayload[] = JSON.parse(raw);
        if (!queue.length) return;
        const count = queue.length;
        localStorage.removeItem(RELAY_QUEUE_KEY);
        Promise.all(queue.map((p) => sendToRelay(uid, p).catch(() => {}))).then(() => {
          setQueueFlushed(count);
          setTimeout(() => setQueueFlushed(0), 4000);
        });
      } catch { localStorage.removeItem(RELAY_QUEUE_KEY); }
    };

    window.addEventListener('online', flushQueue);
    flushQueue();

    return () => {
      unsubRef.current?.();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', flushQueue);
    };
  }, [uid]);

  // ── Incoming action handlers ───────────────────────────
  const handleSaveToNotes = () => {
    if (!pendingPayload) return;
    const newNote = {
      id: crypto.randomUUID(),
      title: `From relay · ${relayTypeLabel(pendingPayload.type)}`,
      content: pendingPayload.content,
      folder: 'Relay',
      tags: ['relay'],
      type: 'note' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updatePluginData({ notes: [...(data?.pluginData?.notes ?? []), newNote] });
    setPendingPayload(null);
    setOpen(false);
  };

  const handleOpenInDraw = () => {
    if (!pendingPayload) return;
    navigate('/draw', { state: { relayDrawing: pendingPayload.content } });
    setPendingPayload(null);
    setOpen(false);
  };

  const handleOpenURL = () => {
    if (!pendingPayload) return;
    window.open(pendingPayload.content, '_blank', 'noopener');
    setPendingPayload(null);
  };

  const handleCopyToClipboard = () => {
    if (!pendingPayload) return;
    navigator.clipboard.writeText(pendingPayload.content).catch(() => {});
    setPendingPayload(null);
    setOpen(false);
  };

  const handleDismiss = () => {
    setPendingPayload(null);
    setOpen(false);
  };

  const handleSend = useCallback(async () => {
    if (!sendText.trim()) return;
    setSending(true);
    setSendError('');
    setSendSlow(false);

    // Slow-connection reminder after SLOW_SEND_MS
    slowTimerRef.current = setTimeout(() => setSendSlow(true), SLOW_SEND_MS);

    try {
      const payload = buildRelayPayload(sendType, sendText.trim());
      if (navigator.onLine) {
        await sendToRelay(uid, payload);
      } else {
        const raw = localStorage.getItem(RELAY_QUEUE_KEY);
        const queue: RelayPayload[] = raw ? JSON.parse(raw) : [];
        queue.push(payload);
        localStorage.setItem(RELAY_QUEUE_KEY, JSON.stringify(queue));
      }
      setSendText('');
      setOpen(false);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      clearTimeout(slowTimerRef.current!);
      slowTimerRef.current = null;
      setSending(false);
      setSendSlow(false);
    }
  }, [uid, sendType, sendText]);

  // Cleanup slow timer on unmount
  useEffect(() => () => { if (slowTimerRef.current) clearTimeout(slowTimerRef.current); }, []);

  // Preview text — never show raw drawing JSON
  const previewText = (payload: RelayPayload) => {
    if (payload.type === 'drawing') {
      try {
        const parsed = JSON.parse(payload.content);
        const elCount = parsed.elements?.length ?? 0;
        return `Drawing: "${parsed.name ?? 'Untitled'}" · ${elCount} element${elCount !== 1 ? 's' : ''}`;
      } catch { return 'Drawing (invalid)'; }
    }
    return payload.content.slice(0, 200) + (payload.content.length > 200 ? '…' : '');
  };

  const sendContentSize = sendText.length;
  const isLargeContent = sendContentSize > LARGE_HINT_BYTES;

  const sendButtonLabel = () => {
    if (sendSlow) return '⏳ Still sending…';
    if (sending) return 'Sending…';
    if (!navigator.onLine) return 'Queue (Offline)';
    if (isLargeContent) return `Send via Storage (${formatBytes(sendContentSize)})`;
    return 'Send to Other Devices';
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        className={`content-relay-fab${pendingPayload ? ' content-relay-fab--active' : ''}${pulse ? ' content-relay-fab--pulse' : ''}`}
        onClick={() => setOpen(!open)}
        title="Content Relay"
        aria-label="Content Relay"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        {pendingPayload && <span className="content-relay-badge" aria-hidden="true" />}
      </button>

      {/* Offline queue delivered toast */}
      {queueFlushed > 0 && (
        <div className="content-relay-toast" role="status">
          ✓ {queueFlushed} queued item{queueFlushed !== 1 ? 's' : ''} delivered
        </div>
      )}

      {/* Slide-up panel */}
      {open && (
        <div className="content-relay-panel" role="dialog" aria-label="Content Relay">
          <div className="content-relay-panel__header">
            <span className="content-relay-panel__title">
              {pendingPayload ? `⬇ Incoming ${relayTypeLabel(pendingPayload.type)}` : 'Content Relay'}
            </span>
            <button className="content-relay-panel__close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>

          {/* ── Incoming section ── */}
          {pendingPayload && (
            <div className="content-relay-incoming">
              {pendingPayload.sizeBytes && pendingPayload.sizeBytes > LARGE_HINT_BYTES && (
                <div className="content-relay-incoming__size">
                  📦 {formatBytes(pendingPayload.sizeBytes)}
                  {pendingPayload.contentRef ? ' · loaded from Storage' : ''}
                </div>
              )}
              <div className="content-relay-incoming__preview">
                {previewText(pendingPayload)}
              </div>
              <div className="content-relay-incoming__actions">
                {pendingPayload.type === 'drawing' && (
                  <button className="btn btn-primary btn-sm" onClick={handleOpenInDraw}>
                    Open in Draw
                  </button>
                )}
                {pendingPayload.type === 'url' && (
                  <button className="btn btn-primary btn-sm" onClick={handleOpenURL}>
                    Open URL
                  </button>
                )}
                {(pendingPayload.type === 'text' || pendingPayload.type === 'note' || pendingPayload.type === 'image') && (
                  <button className="btn btn-primary btn-sm" onClick={handleSaveToNotes}>
                    Save to Notes
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={handleCopyToClipboard}>
                  Copy
                </button>
                {pendingPayload.type !== 'drawing' && pendingPayload.type !== 'url' && (
                  <button className="btn btn-ghost btn-sm" onClick={handleSaveToNotes}>
                    Save
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={handleDismiss}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ── Send section ── */}
          {!pendingPayload && (
            <div className="content-relay-send">
              <div className="content-relay-send__row">
                <select
                  className="content-relay-send__type"
                  value={sendType}
                  onChange={(e) => setSendType(e.target.value as RelayContentType)}
                >
                  <option value="text">Text</option>
                  <option value="url">URL</option>
                  <option value="note">Note</option>
                </select>
                {isLargeContent && (
                  <span className="content-relay-send__size-hint" title="Large content will be sent via Firebase Storage">
                    {formatBytes(sendContentSize)}
                  </span>
                )}
              </div>
              <textarea
                className="content-relay-send__textarea"
                placeholder="Type or paste content to send to another device…"
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                rows={4}
              />
              {sendSlow && (
                <div className="content-relay-send__slow">
                  ⏳ Large content uploading to Storage — this may take a few seconds…
                </div>
              )}
              {sendError && <div className="content-relay-error">{sendError}</div>}
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={sending || !sendText.trim()}
              >
                {sendButtonLabel()}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
