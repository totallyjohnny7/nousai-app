import { useState, useCallback } from 'react';
import {
  Headphones, WifiOff, RefreshCw, Copy, Save, Volume2, Edit3, Lightbulb,
  Key, ExternalLink, CheckCircle, AlertCircle, Wifi,
} from 'lucide-react';
import { useStore } from '../../store';
import type { Note } from '../../types';
import { uid, copyText } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

const OMI_KEY_STORAGE = 'nousai-omi-api-key';

// ─── Omi API types ──────────────────────────────────────────────
interface OmiTranscriptSegment {
  text: string;
  is_user: boolean;
  start: number;
  end: number;
}

interface OmiConversation {
  id: string;
  started_at: string;
  finished_at: string;
  structured: {
    title: string;
    overview: string;
    emoji: string;
    category: string;
    action_items: { description: string; completed: boolean }[];
  };
  transcript_segments: OmiTranscriptSegment[];
}

interface OmiNote {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  type: 'recording';
  actionItems: string[];
}

// ─── API helper ─────────────────────────────────────────────────
async function fetchOmiConversations(apiKey: string, limit = 20): Promise<OmiConversation[]> {
  const res = await fetch(
    `/api/omi-proxy?endpoint=user%2Fconversations&limit=${limit}&include_transcript=true`,
    { headers: { 'x-omi-key': apiKey } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<OmiConversation[]>;
}

function conversationToNote(conv: OmiConversation): OmiNote {
  const transcript = conv.transcript_segments
    ?.map(s => s.text)
    .filter(Boolean)
    .join(' ')
    .trim();

  const content = [
    conv.structured?.overview || '',
    transcript ? `\n\nTranscript:\n${transcript}` : '',
  ].join('').trim();

  return {
    id: conv.id,
    title: [conv.structured?.emoji, conv.structured?.title].filter(Boolean).join(' ') || 'Omi Recording',
    content,
    timestamp: conv.started_at || conv.finished_at || new Date().toISOString(),
    type: 'recording',
    actionItems: conv.structured?.action_items?.map(a => a.description) || [],
  };
}

// ─── Setup screen ────────────────────────────────────────────────
function OmiSetup({ onConnect }: { onConnect: (key: string) => void }) {
  const [keyInput, setKeyInput] = useState('');

  function handleSave() {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    localStorage.setItem(OMI_KEY_STORAGE, trimmed);
    onConnect(trimmed);
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <Headphones size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Connect Omi Device
        </div>
        <p className="text-sm text-muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
          Sync your Omi AI wearable conversations and transcriptions directly into your study library.
        </p>
        <div style={{
          background: 'var(--bg-primary)', padding: 12, borderRadius: 8,
          marginBottom: 12, border: '1px solid var(--border)',
        }}>
          <p className="text-xs" style={{ fontWeight: 700, marginBottom: 8 }}>How to get your API key:</p>
          <ol style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.9, paddingLeft: 16, margin: 0 }}>
            <li>Open the <strong>Omi app</strong> on your phone</li>
            <li>Go to <strong>Settings → Developer → Create Key</strong></li>
            <li>Name it "NousAI", select scopes: <code>conversations:read</code></li>
            <li>Copy the key (shown once!) and paste below</li>
          </ol>
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
          Developer API Key:
        </label>
        <input
          type="password"
          placeholder="omi_dev_..."
          value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--bg-primary)',
            color: 'var(--text-primary)', fontSize: 13, marginBottom: 10,
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={!keyInput.trim()}
            style={{ flex: 1 }}
          >
            <Key size={13} /> Connect Omi
          </button>
          <a
            href="https://docs.omi.me/doc/developer/api/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: 'none' }}
          >
            <ExternalLink size={13} /> Docs
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main tool ───────────────────────────────────────────────────
function OmiTool() {
  const { data, updatePluginData } = useStore();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(OMI_KEY_STORAGE) || '');
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notes, setNotes] = useState<OmiNote[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const sync = useCallback(async (key: string) => {
    setSyncing(true);
    setError(null);
    try {
      const conversations = await fetchOmiConversations(key);
      setNotes(conversations.map(conversationToNote));
      setConnected(true);
      setLastSync(new Date().toISOString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed');
      setConnected(false);
    } finally {
      setSyncing(false);
    }
  }, []);

  function handleConnect(key: string) {
    setApiKey(key);
    sync(key);
  }

  function disconnect() {
    localStorage.removeItem(OMI_KEY_STORAGE);
    setApiKey('');
    setConnected(false);
    setNotes([]);
    setLastSync(null);
    setError(null);
  }

  function saveToLibrary(note: OmiNote) {
    if (!data) return;
    const libNote: Note = {
      id: uid(),
      title: note.title,
      content: note.content + (note.actionItems.length
        ? '\n\nAction Items:\n' + note.actionItems.map(a => `• ${a}`).join('\n')
        : ''),
      folder: 'Omi',
      tags: ['omi', 'recording'],
      createdAt: note.timestamp,
      updatedAt: new Date().toISOString(),
      type: 'ai-output' as const,
    };
    updatePluginData({ notes: [...(data.pluginData?.notes || []), libNote] });
    setSavedIds(prev => new Set([...prev, note.id]));
  }

  function saveAll() {
    notes.filter(n => !savedIds.has(n.id)).forEach(n => saveToLibrary(n));
  }

  if (!apiKey) {
    return <OmiSetup onConnect={handleConnect} />;
  }

  return (
    <div>
      {/* Status card */}
      <div className="card mb-3">
        <div className="card-title mb-3">
          <Headphones size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Omi Device
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: connected ? 'var(--green)' : error ? 'var(--error)' : 'var(--text-muted)',
              boxShadow: connected ? '0 0 6px var(--green)' : 'none',
            }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {syncing ? 'Syncing...' : connected ? 'Connected' : error ? 'Error' : 'Ready'}
            </span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={disconnect} style={{ fontSize: 11 }}>
            <WifiOff size={12} /> Disconnect
          </button>
        </div>

        {error && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            background: 'rgba(239,68,68,0.08)', border: '1px solid var(--error)',
            borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--error)', marginBottom: 10,
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => sync(apiKey)}
            disabled={syncing}
            style={{ flex: 1 }}
          >
            <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          {!connected && !syncing && (
            <button className="btn btn-sm btn-primary" onClick={() => sync(apiKey)}>
              <Wifi size={13} /> Connect
            </button>
          )}
        </div>

        {lastSync && (
          <p className="text-xs text-muted" style={{ marginTop: 8 }}>
            Last synced: {new Date(lastSync).toLocaleString()} · {notes.length} conversations
          </p>
        )}
      </div>

      {/* Conversation list */}
      {notes.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>
              Conversations ({notes.length})
            </h3>
            {notes.some(n => !savedIds.has(n.id)) && (
              <button className="btn btn-sm btn-primary" onClick={saveAll} style={{ fontSize: 11 }}>
                <Save size={12} /> Save All
              </button>
            )}
          </div>

          {notes.map(note => {
            const saved = savedIds.has(note.id);
            return (
              <div key={note.id} className="card mb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Volume2 size={13} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 0.5 }}>
                      recording
                    </span>
                  </div>
                  <span className="text-xs text-muted">
                    {new Date(note.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                    {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{note.title}</div>
                <p className="text-sm text-muted" style={{ lineHeight: 1.6, maxHeight: 72, overflow: 'hidden' }}>
                  {note.content}
                </p>

                {note.actionItems.length > 0 && (
                  <div style={{ marginTop: 8, padding: '6px 8px', background: 'var(--bg-primary)', borderRadius: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>Action Items</span>
                    {note.actionItems.slice(0, 3).map((a, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>• {a}</div>
                    ))}
                    {note.actionItems.length > 3 && (
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                        +{note.actionItems.length - 3} more
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <button className="btn btn-sm btn-secondary" onClick={() => copyText(note.content)}>
                    <Copy size={12} /> Copy
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={saved}
                    onClick={() => saveToLibrary(note)}
                  >
                    {saved
                      ? <><CheckCircle size={12} style={{ color: 'var(--green)' }} /> Saved</>
                      : <><Save size={12} /> Save</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!syncing && connected && notes.length === 0 && (
        <div className="text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
          <Headphones size={36} style={{ marginBottom: 10, opacity: 0.25 }} />
          <p className="text-sm">No conversations yet.</p>
          <p className="text-xs text-muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
            Wear your Omi and start talking — conversations sync here automatically.
          </p>
        </div>
      )}

      {/* Initial state (key set but never synced) */}
      {!syncing && !connected && !error && notes.length === 0 && (
        <div className="text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
          <Edit3 size={36} style={{ marginBottom: 10, opacity: 0.25 }} />
          <p className="text-sm">Press <strong>Connect</strong> to sync your conversations.</p>
        </div>
      )}
    </div>
  );
}

export default function OmiToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Omi">
      <OmiTool />
    </ToolErrorBoundary>
  );
}
