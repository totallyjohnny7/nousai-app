import { useState } from 'react';
import { Headphones, Wifi, WifiOff, RefreshCw, Copy, Save, X, Volume2, Edit3, Lightbulb } from 'lucide-react';
import { useStore } from '../../store';
import type { Note } from '../../types';
import { uid, copyText } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface OmiNote {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  type: 'recording' | 'note' | 'insight';
}

function OmiTool() {
  const { data, updatePluginData } = useStore();
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [notes, setNotes] = useState<OmiNote[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  function toggleConnection() {
    if (connected) {
      setConnected(false);
      setNotes([]);
      setLastSync(null);
    } else {
      // Simulate connection attempt
      setSyncing(true);
      setTimeout(() => {
        setConnected(true);
        setSyncing(false);
        // Load mock synced data
        setNotes([
          {
            id: uid(), title: 'Lecture: Intro to Calculus',
            content: 'Covered limits, continuity, and basic derivatives. Key concepts: epsilon-delta definition, squeeze theorem.',
            timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'recording',
          },
          {
            id: uid(), title: 'Study Session Notes',
            content: 'Reviewed chapter 5 on thermodynamics. Need to revisit entropy and the second law.',
            timestamp: new Date(Date.now() - 7200000).toISOString(), type: 'note',
          },
          {
            id: uid(), title: 'Key Insight: Memory Consolidation',
            content: 'Spaced repetition is most effective when intervals increase exponentially. Sleep between sessions boosts retention.',
            timestamp: new Date(Date.now() - 14400000).toISOString(), type: 'insight',
          },
        ]);
        setLastSync(new Date().toISOString());
      }, 1500);
    }
  }

  function syncNow() {
    setSyncing(true);
    setTimeout(() => {
      // Add a new mock note
      setNotes(prev => [{
        id: uid(),
        title: `Synced Note ${new Date().toLocaleTimeString()}`,
        content: 'New recording synced from Omi device. Content transcribed and ready for review.',
        timestamp: new Date().toISOString(),
        type: 'recording',
      }, ...prev]);
      setLastSync(new Date().toISOString());
      setSyncing(false);
    }, 1000);
  }

  function removeNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  const typeColors = {
    recording: 'var(--accent)',
    note: 'var(--green)',
    insight: 'var(--yellow)',
  };

  const typeIcons = {
    recording: Volume2,
    note: Edit3,
    insight: Lightbulb,
  };

  return (
    <div>
      {/* Connection Status */}
      <div className="card mb-3">
        <div className="card-title mb-3">
          <Headphones size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Omi Device
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: connected ? 'var(--green)' : 'var(--text-muted)',
              boxShadow: connected ? '0 0 8px var(--green)' : 'none',
            }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {syncing ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            className={`btn btn-sm ${connected ? 'btn-secondary' : 'btn-primary'}`}
            onClick={toggleConnection}
            disabled={syncing}
          >
            {connected ? <><WifiOff size={14} /> Disconnect</> : <><Wifi size={14} /> Connect</>}
          </button>
        </div>

        {connected && (
          <>
            <div className="flex gap-2 mb-3">
              <button
                className="btn btn-sm btn-secondary"
                onClick={syncNow}
                disabled={syncing}
                style={{ flex: 1 }}
              >
                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>

            <div className="flex items-center justify-between" style={{
              padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-primary)',
            }}>
              <div>
                <span className="text-sm" style={{ fontWeight: 500 }}>Auto-Sync</span>
                <span className="text-xs text-muted" style={{ display: 'block' }}>
                  Automatically sync when device is nearby
                </span>
              </div>
              <button
                onClick={() => setAutoSync(!autoSync)}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: autoSync ? 'var(--accent)' : 'var(--border)',
                  border: 'none', cursor: 'pointer',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'white',
                  position: 'absolute', top: 3,
                  left: autoSync ? 23 : 3,
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {lastSync && (
              <p className="text-xs text-muted" style={{ marginTop: 8 }}>
                Last synced: {new Date(lastSync).toLocaleString()}
              </p>
            )}
          </>
        )}
      </div>

      {/* Synced Notes */}
      {connected && notes.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>
            Synced Content ({notes.length})
          </h3>
          {notes.map(note => {
            const Icon = typeIcons[note.type];
            return (
              <div key={note.id} className="card mb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} style={{ color: typeColors[note.type] }} />
                    <span style={{
                      fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                      color: typeColors[note.type], letterSpacing: 0.5,
                    }}>
                      {note.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                      {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => removeNote(note.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{note.title}</div>
                <p className="text-sm text-muted" style={{ lineHeight: 1.6 }}>{note.content}</p>
                <div className="flex gap-2 mt-2">
                  <button className="btn btn-sm btn-secondary" onClick={() => copyText(note.content)}>
                    <Copy size={12} /> Copy
                  </button>
                  <button className="btn btn-sm btn-secondary" disabled={savedIds.has(note.id)} onClick={() => {
                    if (!data) return;
                    const libNote: Note = {
                      id: uid(),
                      title: note.title,
                      content: note.content,
                      folder: 'Omi',
                      tags: ['omi', note.type],
                      createdAt: note.timestamp,
                      updatedAt: new Date().toISOString(),
                      type: 'ai-output' as const,
                    };
                    const allNotes = [...(data.pluginData?.notes || []), libNote];
                    updatePluginData({ notes: allNotes });
                    setSavedIds(prev => new Set([...prev, note.id]));
                  }}>
                    <Save size={12} /> {savedIds.has(note.id) ? 'Saved!' : 'Save to Library'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state when not connected */}
      {!connected && !syncing && (
        <div className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>
          <Headphones size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p className="text-sm">Connect your Omi device to sync recordings and notes</p>
          <p className="text-xs text-muted" style={{ marginTop: 8 }}>
            Supports automatic transcription and study note generation
          </p>
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
