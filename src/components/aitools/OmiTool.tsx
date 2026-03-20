import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Headphones, WifiOff, RefreshCw, Key, ExternalLink, AlertCircle,
  CheckCircle, Zap, BookOpen, Brain, Clock, Activity,
} from 'lucide-react';
import { useStore } from '../../store';
import type { Note } from '../../types';
import type { FSRSCard } from '../../utils/fsrs';
import { uid, copyText } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import {
  subscribeOmiInbox,
  subscribeOmiTime,
  subscribeOmiFlashcards,
  markOmiFlashcardSynced,
} from '../../utils/auth';
import { loadFcFSRS, saveFcFSRS } from '../../utils/fsrsStorage';

const OMI_KEY_STORAGE = 'nousai-omi-api-key';
const OMI_AUTH_UID_KEY = 'nousai-auth-uid';

// ─── Omi API types (pull/manual sync) ────────────────────────────────────────
interface OmiTranscriptSegment {
  text: string;
  is_user: boolean;
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

// ─── Pull helper (manual sync fallback) ──────────────────────────────────────
async function fetchOmiConversations(apiKey: string, limit = 20): Promise<OmiConversation[]> {
  const res = await fetch(
    `/api/omi-proxy?endpoint=user%2Fconversations&limit=${limit}&include_transcript=true`,
    { headers: { 'x-omi-key': apiKey } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<OmiConversation[]>;
}

// ─── Health status ────────────────────────────────────────────────────────────
type PipelineStatus = 'active' | 'warn' | 'inactive' | 'unknown';

function getPipelineStatus(lastMemoryAt: string | null): PipelineStatus {
  if (!lastMemoryAt) return 'unknown';
  const now = Date.now();
  const last = new Date(lastMemoryAt).getTime();
  const hoursAgo = (now - last) / (1000 * 60 * 60);
  const hour = new Date().getHours();
  const isWearTime = hour >= 6 && hour <= 22;
  if (hoursAgo < 2) return 'active';
  if (isWearTime && hoursAgo > 3 && hoursAgo < 24) return 'warn';
  if (hoursAgo > 24) return 'inactive';
  return 'active';
}

// ─── Setup screen ─────────────────────────────────────────────────────────────
function OmiSetup({ onConnect }: { onConnect: (key: string) => void }) {
  const [keyInput, setKeyInput] = useState('');

  function handleSave() {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    localStorage.setItem(OMI_KEY_STORAGE, trimmed);
    onConnect(trimmed);
  }

  return (
    <div className="card">
      <div className="card-title mb-3">
        <Headphones size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Connect Omi Device
      </div>
      <p className="text-sm text-muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
        Sync your Omi AI wearable. Once connected, NousAI processes everything automatically —
        notes, flashcards, vocab, and knowledge gaps — with no buttons to click.
      </p>
      <div style={{
        background: 'var(--bg-primary)', padding: 12, borderRadius: 8,
        marginBottom: 12, border: '1px solid var(--border)',
      }}>
        <p className="text-xs" style={{ fontWeight: 700, marginBottom: 8 }}>Get your API key:</p>
        <ol style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.9, paddingLeft: 16, margin: 0 }}>
          <li>Open <strong>Omi app</strong> → Settings → Developer</li>
          <li>Create Key → name it "NousAI"</li>
          <li>Copy the key (starts with <code>omi_dev_</code>)</li>
          <li>Paste below and connect</li>
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
      <p className="text-xs text-muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
        After connecting, set up the webhook in{' '}
        <strong>Settings → Extensions → Omi</strong> for real-time auto-processing.
      </p>
    </div>
  );
}

// ─── Health banner ────────────────────────────────────────────────────────────
function HealthBanner({
  status, lastMemoryAt, todayCount, webhookActive,
}: {
  status: PipelineStatus;
  lastMemoryAt: string | null;
  todayCount: number;
  webhookActive: boolean;
}) {
  const timeAgo = lastMemoryAt ? (() => {
    const mins = Math.floor((Date.now() - new Date(lastMemoryAt).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  })() : null;

  if (status === 'unknown' || !webhookActive) {
    return (
      <div style={{
        padding: '10px 12px', borderRadius: 8, marginBottom: 10,
        background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)',
        fontSize: 12,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>⚙️ Webhook not configured</div>
        <div style={{ color: 'var(--text-muted)' }}>
          Go to <strong>Settings → Extensions → Omi</strong> to copy your webhook URL and enable auto-processing.
        </div>
      </div>
    );
  }

  const configs: Record<PipelineStatus, { bg: string; border: string; icon: string; msg: string }> = {
    active: {
      bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.3)',
      icon: '🟢', msg: `Pipeline active · Last memory: ${timeAgo} · ${todayCount} processed today`,
    },
    warn: {
      bg: 'rgba(245,166,35,0.08)', border: 'rgba(245,166,35,0.3)',
      icon: '⚠️', msg: 'No memories in a while — is Omi worn & charged?',
    },
    inactive: {
      bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.3)',
      icon: '🔴', msg: 'Webhook not receiving — check Omi app webhook setup',
    },
    unknown: { bg: '', border: '', icon: '', msg: '' },
  };

  const c = configs[status];
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8, marginBottom: 10,
      background: c.bg, border: `1px solid ${c.border}`, fontSize: 12,
    }}>
      <span style={{ fontWeight: 700 }}>{c.icon} Omi Pipeline</span>
      <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{c.msg}</span>
    </div>
  );
}

// ─── Today's coverage bar ────────────────────────────────────────────────────
function CoverageBar({ timeData }: { timeData: Record<string, unknown> | null }) {
  if (!timeData) return null;
  const edu = Number(timeData.education) || 0;
  const work = Number(timeData.work) || 0;
  const gen = Number(timeData.general) || 0;
  const total = edu + work + gen;
  if (total === 0) return null;

  const fmt = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  return (
    <div className="card mb-2" style={{ padding: '10px 12px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
        <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        TODAY'S COVERAGE — {fmt(total)} recorded
      </div>
      <div style={{ display: 'flex', gap: 3, height: 6, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
        {edu > 0 && (
          <div style={{ flex: edu, background: 'var(--accent)', borderRadius: 4 }} />
        )}
        {work > 0 && (
          <div style={{ flex: work, background: '#6366f1', borderRadius: 4 }} />
        )}
        {gen > 0 && (
          <div style={{ flex: gen, background: 'var(--border)', borderRadius: 4 }} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)' }}>
        {edu > 0 && <span><span style={{ color: 'var(--accent)' }}>■</span> Study {fmt(edu)}</span>}
        {work > 0 && <span><span style={{ color: '#6366f1' }}>■</span> Work {fmt(work)}</span>}
        {gen > 0 && <span><span style={{ color: 'var(--border)' }}>■</span> Other {fmt(gen)}</span>}
      </div>
    </div>
  );
}

// ─── Feed item ───────────────────────────────────────────────────────────────
function FeedItem({ item }: { item: Record<string, unknown> }) {
  const isDigest = item.kind === 'day_summary';
  const flashcardCount = Number(item.flashcardCount) || 0;
  const vocabCount = Number(item.vocabCount) || 0;
  const gapCount = Number(item.gapCount) || 0;
  const category = String(item.category || 'general');
  const time = item.receivedAt ? new Date(String(item.receivedAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const categoryIcon = isDigest ? '📅' : category === 'education' ? '📚' : category === 'work' ? '💻' : '💬';

  return (
    <div className="card mb-2" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
          {categoryIcon} {String(item.title || 'Omi Recording')}
        </div>
        <span className="text-xs text-muted" style={{ flexShrink: 0, marginLeft: 8 }}>{time}</span>
      </div>

      {(flashcardCount > 0 || vocabCount > 0 || gapCount > 0) && (
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {flashcardCount > 0 && (
            <span style={{ color: 'var(--accent)' }}>
              <Brain size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
              {flashcardCount} flashcards
            </span>
          )}
          {vocabCount > 0 && (
            <span>
              <BookOpen size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
              {vocabCount} vocab
            </span>
          )}
          {gapCount > 0 && (
            <span>
              <Zap size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
              {gapCount} gaps
            </span>
          )}
        </div>
      )}

      {isDigest && (
        <p className="text-xs text-muted" style={{ marginTop: 4, lineHeight: 1.5 }}>
          Saved to journal
        </p>
      )}
    </div>
  );
}

// ─── Main tool ────────────────────────────────────────────────────────────────
function OmiTool() {
  const { data, updatePluginData } = useStore();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(OMI_KEY_STORAGE) || '');
  const uid = localStorage.getItem(OMI_AUTH_UID_KEY) || '';

  // Firestore live state
  const [inboxDocs, setInboxDocs] = useState<Record<string, unknown>[]>([]);
  const [timeData, setTimeData] = useState<Record<string, unknown> | null>(null);

  // Manual pull state
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const webhookActive = !!localStorage.getItem('nousai-omi-webhook-configured');

  // Subscribe to live Firestore feeds
  useEffect(() => {
    if (!uid || !apiKey) return;
    let unsub1: (() => void) | null = null;
    let unsub2: (() => void) | null = null;
    let unsub3: (() => void) | null = null;

    subscribeOmiInbox(uid, setInboxDocs).then(u => { unsub1 = u });
    subscribeOmiTime(uid, today, setTimeData).then(u => { unsub2 = u });

    // FSRS sync: pick up flashcards generated by webhook
    subscribeOmiFlashcards(uid, (cards) => {
      if (!cards.length) return;
      const existing = loadFcFSRS();
      let added = 0;
      cards.forEach(card => {
        const key = `omi-${card.omiMemoryId}-${card.id}`;
        if (!existing[key]) {
          const newCard: FSRSCard = {
            key,
            topic: card.topic || 'Omi',
            front: card.q,
            back: card.a,
            state: 'new' as const,
            stability: 0,
            difficulty: 5,
            interval: 0,
            lapses: 0,
            reps: 0,
            lastReview: new Date().toISOString(),
            nextReview: new Date().toISOString(),
          };
          existing[key] = newCard;
          added++;
        }
        markOmiFlashcardSynced(uid, card.id).catch(() => {});
      });
      if (added > 0) saveFcFSRS(existing);
    }).then(u => { unsub3 = u });

    return () => {
      unsub1?.();
      unsub2?.();
      unsub3?.();
    };
  }, [uid, apiKey, today]);

  // Manual pull sync (fallback / on-demand)
  const syncNow = useCallback(async () => {
    if (!apiKey) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const conversations = await fetchOmiConversations(apiKey, 20);
      // Save any new ones to library that aren't already there
      const existingIds = new Set((data?.pluginData?.notes || []).map(n => n.id));
      const newNotes: Note[] = conversations
        .filter(c => !existingIds.has(`omi-${c.id}`))
        .map(c => ({
          id: `omi-${c.id}`,
          title: [c.structured?.emoji, c.structured?.title].filter(Boolean).join(' ') || 'Omi Recording',
          content: [
            c.structured?.overview || '',
            c.transcript_segments?.map(s => s.text).filter(Boolean).join(' ')
              ? `\n\nTranscript:\n${c.transcript_segments.map(s => s.text).join(' ').trim()}`
              : '',
          ].join('').trim(),
          folder: 'Omi',
          tags: ['omi', c.structured?.category || 'general', 'recording'],
          createdAt: c.started_at || c.finished_at || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          type: 'ai-output' as const,
        }));
      if (newNotes.length > 0 && data) {
        updatePluginData({ notes: [...(data.pluginData?.notes || []), ...newNotes] });
      }
      setLastSync(new Date().toISOString());
    } catch (e: unknown) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [apiKey, data, updatePluginData]);

  function disconnect() {
    localStorage.removeItem(OMI_KEY_STORAGE);
    setApiKey('');
    setInboxDocs([]);
    setTimeData(null);
  }

  const lastMemoryAt = useMemo(() => {
    if (!inboxDocs.length) return null;
    return String(inboxDocs[0]?.receivedAt || null);
  }, [inboxDocs]);

  const todayCount = useMemo(() =>
    inboxDocs.filter(d => String(d.receivedAt || '').startsWith(today)).length,
    [inboxDocs, today],
  );

  const status = getPipelineStatus(lastMemoryAt);

  if (!apiKey) {
    return <OmiSetup onConnect={key => { setApiKey(key); syncNow(); }} />;
  }

  return (
    <div>
      {/* Health banner */}
      <HealthBanner
        status={status}
        lastMemoryAt={lastMemoryAt}
        todayCount={todayCount}
        webhookActive={webhookActive}
      />

      {/* Today's coverage */}
      <CoverageBar timeData={timeData} />

      {/* Header controls */}
      <div className="card mb-2" style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: inboxDocs.length > 0 ? 'var(--green)' : 'var(--text-muted)',
              boxShadow: inboxDocs.length > 0 ? '0 0 5px var(--green)' : 'none',
            }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {syncing ? 'Syncing...' : inboxDocs.length > 0 ? 'Connected' : 'Ready'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={syncNow}
              disabled={syncing}
              style={{ fontSize: 11 }}
            >
              <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={disconnect}
              style={{ fontSize: 11 }}
            >
              <WifiOff size={11} /> Disconnect
            </button>
          </div>
        </div>

        {syncError && (
          <div style={{
            display: 'flex', gap: 6, alignItems: 'center',
            marginTop: 8, fontSize: 11, color: 'var(--error)',
          }}>
            <AlertCircle size={12} />
            {syncError}
          </div>
        )}
        {lastSync && !syncError && (
          <p className="text-xs text-muted" style={{ marginTop: 6 }}>
            Last manual sync: {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Live feed */}
      {inboxDocs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, marginTop: 8 }}>
            <Activity size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            LIVE FEED
          </div>
          {inboxDocs.map(item => (
            <FeedItem key={String(item.id)} item={item} />
          ))}
        </div>
      )}

      {/* Empty state — no inbox docs yet */}
      {inboxDocs.length === 0 && !syncing && (
        <div className="text-center" style={{ padding: '28px 16px', color: 'var(--text-muted)' }}>
          <Headphones size={32} style={{ marginBottom: 10, opacity: 0.2 }} />
          <p className="text-sm" style={{ fontWeight: 600, marginBottom: 6 }}>No memories yet</p>
          <p className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
            Wear your Omi and start talking. Memories appear here automatically within ~90 seconds of stopping.
          </p>
          <p className="text-xs" style={{ marginTop: 8, color: 'var(--accent)' }}>
            Set up your webhook in{' '}
            <strong>Settings → Extensions → Omi</strong> for real-time auto-processing.
          </p>
        </div>
      )}

      {/* Pipeline stats */}
      {inboxDocs.length > 0 && (
        <div className="card mt-2" style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <CheckCircle size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            PIPELINE STATUS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12 }}>
            <span>{inboxDocs.length} memories in feed</span>
            <span style={{ color: 'var(--accent)' }}>
              {inboxDocs.reduce((s, d) => s + (Number(d.flashcardCount) || 0), 0)} flashcards generated
            </span>
            <span>
              {inboxDocs.reduce((s, d) => s + (Number(d.vocabCount) || 0), 0)} vocab terms
            </span>
            <span>
              {inboxDocs.reduce((s, d) => s + (Number(d.gapCount) || 0), 0)} gaps logged
            </span>
          </div>
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

// Re-export for use elsewhere
export { copyText };
