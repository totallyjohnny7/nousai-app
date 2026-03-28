import { useState } from 'react'
import {
  Upload, RefreshCw, ChevronDown, ChevronRight, Cloud,
  Key, ExternalLink, Zap, Globe, Shield, BookOpen,
  Database, Headphones, Clipboard, Mic
} from 'lucide-react'
import type { NousAIData } from '../../types'
import type { AuthUser } from '../../utils/auth'
import { saveOmiConfig } from '../../utils/auth'
import { runFullCanvasSync } from '../../utils/canvasSync'
import type { SectionId } from './settingsTypes'
import { cardBodyStyle, inputStyle, labelStyle, rowStyle } from './settingsStyles'

interface ExtensionsSectionProps {
  data: NousAIData | null
  setData: (fn: (prev: NousAIData) => NousAIData) => void
  updatePluginData: (patch: Record<string, unknown>) => void
  authUser: AuthUser | null
  showToast: (msg: string) => void
  setExpanded: React.Dispatch<React.SetStateAction<Record<SectionId, boolean>>>
}

export default function ExtensionsSection({
  data, setData, updatePluginData, authUser, showToast, setExpanded,
}: ExtensionsSectionProps) {
  // Omi device state
  const [omiApiKey, setOmiApiKey] = useState(localStorage.getItem('nousai-omi-api-key') || '')
  const [omiKeyInput, setOmiKeyInput] = useState('')
  const [omiTesting, setOmiTesting] = useState(false)
  const [omiSetupOpen, setOmiSetupOpen] = useState(
    !localStorage.getItem('nousai-omi-setup-seen'),
  )
  const [omiAutoSettings, setOmiAutoSettings] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('nousai-omi-auto-settings') || '{}') }
    catch { return {} }
  })
  const [speechProfile, setSpeechProfile] = useState<Record<string, unknown>>(() => {
    try { return JSON.parse(localStorage.getItem('nousai-omi-speech-profile') || '{}') }
    catch { return {} }
  })
  const [customCorrInput, setCustomCorrInput] = useState({ heard: '', actual: '' })

  // Canvas sync state
  const [canvasSyncing, setCanvasSyncing] = useState(false)
  const [canvasSyncStatus, setCanvasSyncStatus] = useState<{
    ok: boolean; message: string; lastSync?: string
  } | null>(null)

  async function handleCanvasSync() {
    const canvasUrl = data?.settings?.canvasUrl
    const canvasToken = data?.settings?.canvasToken
    if (!canvasUrl || !canvasToken) {
      setCanvasSyncStatus({ ok: false, message: 'Canvas URL and token required' })
      return
    }
    setCanvasSyncing(true)
    setCanvasSyncStatus(null)
    try {
      const result = await runFullCanvasSync(canvasUrl, canvasToken)
      updatePluginData({
        canvasLive: {
          courses: result.courses,
          assignments: result.assignments,
          announcements: result.announcements,
          lastFullSync: new Date().toISOString(),
        },
      })
      const msg = result.errors.length > 0
        ? `Synced with ${result.errors.length} error(s): ${result.errors[0]}`
        : `Synced ${result.courses.length} courses, ${result.assignments.length} assignments`
      setCanvasSyncStatus({ ok: result.errors.length === 0, message: msg, lastSync: new Date().toLocaleString() })
    } catch (e) {
      setCanvasSyncStatus({ ok: false, message: e instanceof Error ? e.message : 'Sync failed' })
    } finally {
      setCanvasSyncing(false)
    }
  }

  return (
    <div style={cardBodyStyle}>
      {/* Chrome Extension */}
      <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#4285f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>NousAI Chrome Extension</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-sync Canvas grades, syllabus & assignments</div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: '4px 0' }}>
          Install the NousAI Chrome Extension to automatically import your course data from Canvas LMS.
          The extension scans your Canvas dashboard and sends grades, assignments, and syllabus info to NousAI.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { showToast('Extension sync triggered! Open Canvas in Chrome to push data.') }}>
            <RefreshCw size={13} /> Sync from Extension
          </button>
          <a href="https://chromewebstore.google.com/search/NousAI%20Canvas" target="_blank" rel="noopener noreferrer"
            className="btn btn-sm" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center', background: '#4285f4', color: '#fff', border: 'none' }}>
            <ExternalLink size={13} /> Get Extension
          </a>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

      {/* Data Import/Export */}
      <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Data Import/Export</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Import or export your study data</div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: '4px 0' }}>
          Import a data.json backup file to restore courses, quizzes, flashcards, and study history, or export your current data.
        </p>
        <button className="btn btn-secondary btn-sm" onClick={() => { setExpanded(p => ({ ...p, extensions: false, data: true })); showToast('Scroll to Data section to import') }}>
          <Upload size={13} /> Go to Import Data
        </button>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

      {/* Canvas LMS */}
      <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e53e3e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Canvas LMS (Direct)</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Connect directly to Canvas API</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <label style={{ ...labelStyle, fontSize: 11 }}>Canvas URL:</label>
            <input type="text" placeholder="https://canvas.unl.edu" value={data?.settings?.canvasUrl || ''} onChange={e => {
              const val = e.target.value; if (setData) setData(prev => ({ ...prev, settings: { ...prev.settings, canvasUrl: val } }))
            }} style={{ ...inputStyle, fontSize: 12 }} />
          </div>
          <div>
            <label style={{ ...labelStyle, fontSize: 11 }}>Canvas API Token:</label>
            <input type="password" placeholder="Enter your Canvas API token" value={data?.settings?.canvasToken || ''} onChange={e => {
              const val = e.target.value; if (setData) setData(prev => ({ ...prev, settings: { ...prev.settings, canvasToken: val } }))
            }} style={{ ...inputStyle, fontSize: 12 }} />
          </div>
          <div>
            <label style={{ ...labelStyle, fontSize: 11 }}>iCal Feed URL (for calendar events):</label>
            <input type="text" placeholder="https://canvas.unl.edu/feeds/calendars/..." value={data?.settings?.canvasIcalUrl || ''} onChange={e => {
              const val = e.target.value; if (setData) setData(prev => ({ ...prev, settings: { ...prev.settings, canvasIcalUrl: val } }))
            }} style={{ ...inputStyle, fontSize: 12 }} />
          </div>
          {/* Sync buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleCanvasSync}
              disabled={canvasSyncing}
              className="btn btn-primary btn-sm" style={{ fontSize: 11, gap: 4 }}>
              <RefreshCw size={11} /> {canvasSyncing ? 'Syncing...' : 'Sync Canvas'}
            </button>
          </div>
          {canvasSyncStatus && (
            <div style={{
              marginTop: 8, padding: '8px 12px', borderRadius: 6, fontSize: 12,
              background: canvasSyncStatus.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: canvasSyncStatus.ok ? '#22c55e' : '#ef4444',
              border: `1px solid ${canvasSyncStatus.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {canvasSyncStatus.message}
              {canvasSyncStatus.lastSync && (
                <span style={{ opacity: 0.7 }}> · {canvasSyncStatus.lastSync}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

      {/* Omi AI Wearable */}
      <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1a1a2e', border: '1px solid #F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Headphones size={18} color="#F5A623" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Omi AI Wearable</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Always-on wearable · fully automated pipeline</div>
          </div>
        </div>

        {/* Collapsible setup guide */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <button
            style={{
              width: '100%', textAlign: 'left', padding: '8px 12px',
              background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
            }}
            onClick={() => setOmiSetupOpen(v => !v)}
          >
            <span>📖 Setup Guide {!localStorage.getItem('nousai-omi-setup-seen') && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>● New</span>}</span>
            {omiSetupOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {omiSetupOpen && (
            <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>One-time setup, then forget it exists:</div>
              <ol style={{ paddingLeft: 16, margin: 0 }}>
                <li><strong>Unbox:</strong> charge fully (~45 min), hold button 3s to power on</li>
                <li><strong>Omi app:</strong> Download "Omi" → Settings → Experimental → enable Auto-create Speakers, Follow-up Questions, Goal Tracker, Daily Reflection</li>
                <li><strong>API Key:</strong> Omi app → Settings → Developer → Create Key → paste below</li>
                <li><strong>Webhook:</strong> copy URL below → Omi app → Developer → Webhooks → Add URL → subscribe to Conversation Events + Day Summary</li>
                <li><strong>Voice Accuracy:</strong> select your speech profile below, add custom corrections</li>
                <li><strong>Omi Apps (omi.me/apps):</strong> Improved Transcript, Insight Extractor, Class Notes Summarizer</li>
              </ol>
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 6, fontSize: 11 }}>
                <strong>After setup, NousAI runs silently. You just wear it:</strong><br />
                Every 90s of silence → 1 memory saved → flashcards queued → vocab extracted → notes auto-saved → gaps logged
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 8, fontSize: 10 }}
                onClick={() => {
                  localStorage.setItem('nousai-omi-setup-seen', '1');
                  setOmiSetupOpen(false);
                }}
              >
                ✓ Mark Setup Complete
              </button>
            </div>
          )}
        </div>

        {/* API Key */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Step 3: Developer API Key</div>
        {omiApiKey ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
              ✓ API key configured ({omiApiKey.slice(0, 12)}…)
            </div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11 }}
              onClick={() => {
                localStorage.removeItem('nousai-omi-api-key');
                setOmiApiKey('');
                setOmiKeyInput('');
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              type="password"
              placeholder="omi_dev_..."
              value={omiKeyInput}
              onChange={e => setOmiKeyInput(e.target.value)}
              style={{ ...inputStyle, fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1, fontSize: 11 }}
                disabled={omiTesting || !omiKeyInput.trim()}
                onClick={async () => {
                  const key = omiKeyInput.trim();
                  if (!key) return;
                  setOmiTesting(true);
                  try {
                    const res = await fetch(`/api/omi-proxy?endpoint=user%2Fconversations&limit=1`, {
                      headers: { 'x-omi-key': key },
                    });
                    if (res.ok) {
                      localStorage.setItem('nousai-omi-api-key', key);
                      setOmiApiKey(key);
                      setOmiKeyInput('');
                      showToast('Omi connected! Copy the webhook URL below to complete setup.');
                    } else {
                      const err = await res.json().catch(() => ({})) as { error?: string };
                      showToast(`Connection failed: ${err.error || res.status}`);
                    }
                  } catch {
                    showToast('Connection failed. Check your API key.');
                  } finally {
                    setOmiTesting(false);
                  }
                }}
              >
                <Key size={12} /> {omiTesting ? 'Testing...' : 'Save & Test'}
              </button>
              <a
                href="https://docs.omi.me/doc/developer/api/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none', fontSize: 11 }}
              >
                <ExternalLink size={12} /> Docs
              </a>
            </div>
          </div>
        )}

        {/* Webhook URL — shown after API key is set */}
        {omiApiKey && authUser && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Step 4: Webhook URL</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                readOnly
                value={`https://studynous.com/api/omi-webhook?uid=${authUser.uid}`}
                style={{ ...inputStyle, fontSize: 10, flex: 1, cursor: 'text', color: 'var(--text-muted)' }}
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, flexShrink: 0 }}
                onClick={() => {
                  navigator.clipboard.writeText(
                    `https://studynous.com/api/omi-webhook?uid=${authUser.uid}`,
                  );
                  localStorage.setItem('nousai-omi-webhook-configured', '1');
                  showToast('Webhook URL copied! Paste it in Omi app → Developer → Webhooks');
                }}
              >
                <Clipboard size={12} /> Copy
              </button>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Paste into Omi app → Developer → Webhooks → subscribe to: <strong>Conversation Events</strong> + <strong>Day Summary</strong>
            </p>
          </div>
        )}

        {/* Auto-processing toggles */}
        {omiApiKey && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={12} color="var(--accent)" /> Auto-Processing
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
              Everything runs automatically when Omi fires a webhook. Toggle off to disable individual processors.
            </p>
            {([
              { key: 'autoSaveNotes', label: 'Auto-save memories as Notes' },
              { key: 'autoFlashcards', label: 'Auto-generate flashcards (lectures)' },
              { key: 'autoVocab', label: 'Auto-extract vocabulary' },
              { key: 'autoGaps', label: 'Auto-detect knowledge gaps' },
              { key: 'autoVoiceCorrect', label: 'Auto-correct transcripts (AI, speech-aware)' },
            ] as const).map(({ key, label }) => {
              const enabled = omiAutoSettings[key] !== false;
              return (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => {
                      const next = { ...omiAutoSettings, [key]: !enabled };
                      setOmiAutoSettings(next);
                      localStorage.setItem('nousai-omi-auto-settings', JSON.stringify(next));
                      if (authUser) {
                        const aiKey = localStorage.getItem(
                          `nousai-ai-slot-generation-apikey`,
                        ) || localStorage.getItem(`nousai-ai-slot-chat-apikey`) || '';
                        saveOmiConfig(authUser.uid, {
                          omiAutoSettings: next,
                          omiAiKey: aiKey,
                        }).catch(() => {});
                      }
                    }}
                  />
                  <span style={{ fontSize: 12 }}>{label}</span>
                </label>
              );
            })}
            {/* Sync AI key button */}
            {authUser && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 10, marginTop: 4 }}
                onClick={() => {
                  const aiKey = localStorage.getItem('nousai-ai-slot-generation-apikey')
                    || localStorage.getItem('nousai-ai-slot-chat-apikey') || '';
                  if (!aiKey) {
                    showToast('No AI API key found. Set an OpenRouter key in AI Settings first.');
                    return;
                  }
                  saveOmiConfig(authUser.uid, {
                    omiAutoSettings,
                    omiAiKey: aiKey,
                  }).then(() => showToast('Auto-processing settings synced to webhook ✓')).catch(() => showToast('Sync failed. Check your connection.'));
                }}
              >
                <Cloud size={11} /> Sync AI key to webhook
              </button>
            )}
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              AI processors use your generation slot API key. Click "Sync AI key to webhook" after changing keys.
            </p>
          </div>
        )}

        {/* Voice Accuracy / Speech Profile */}
        {omiApiKey && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mic size={12} color="var(--accent)" /> Voice Accuracy
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
              Helps AI correction produce cleaner transcripts. Works for any speech difference or multilingual codeswitching.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Speech pattern</label>
                <select
                  value={String(speechProfile.speechDifference || '')}
                  onChange={e => {
                    const next = { ...speechProfile, speechDifference: e.target.value };
                    setSpeechProfile(next);
                    localStorage.setItem('nousai-omi-speech-profile', JSON.stringify(next));
                    if (authUser) saveOmiConfig(authUser.uid, { omiSpeechProfile: next }).catch(() => {});
                  }}
                  style={{ ...inputStyle, fontSize: 11 }}
                >
                  <option value="">None (default)</option>
                  <option value="lisp_interdental">Interdental lisp (s/z → th)</option>
                  <option value="lisp_lateral">Lateral lisp (slushy s)</option>
                  <option value="lisp_dentalized">Dentalized lisp (muffled s)</option>
                  <option value="lisp_palatal">Palatal lisp (compressed s)</option>
                  <option value="stutter">Stutter (repeated syllables)</option>
                  <option value="dysarthria">Dysarthria (motor speech)</option>
                  <option value="accent">Non-native accent</option>
                  <option value="other">Other (describe below)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Languages spoken</label>
                <input
                  type="text"
                  placeholder="e.g. english, japanese"
                  value={String(speechProfile.languagesInput || '')}
                  onChange={e => {
                    const next = {
                      ...speechProfile,
                      languagesInput: e.target.value,
                      languages: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                    };
                    setSpeechProfile(next);
                    localStorage.setItem('nousai-omi-speech-profile', JSON.stringify(next));
                    if (authUser) saveOmiConfig(authUser.uid, { omiSpeechProfile: next }).catch(() => {});
                  }}
                  style={{ ...inputStyle, fontSize: 11 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Subject areas</label>
                <input
                  type="text"
                  placeholder="e.g. biology, premed, computer science"
                  value={String(speechProfile.subjectsInput || '')}
                  onChange={e => {
                    const next = {
                      ...speechProfile,
                      subjectsInput: e.target.value,
                      subjects: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                    };
                    setSpeechProfile(next);
                    localStorage.setItem('nousai-omi-speech-profile', JSON.stringify(next));
                    if (authUser) saveOmiConfig(authUser.uid, { omiSpeechProfile: next }).catch(() => {});
                  }}
                  style={{ ...inputStyle, fontSize: 11 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>My custom corrections</label>
                {Array.isArray(speechProfile.customCorrections) && (speechProfile.customCorrections as { heard: string; actual: string }[]).map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, fontSize: 11 }}>
                    <span style={{ color: 'var(--error)', flex: 1 }}>{c.heard}</span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span style={{ color: 'var(--green)', flex: 1 }}>{c.actual}</span>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() => {
                        const next = {
                          ...speechProfile,
                          customCorrections: (speechProfile.customCorrections as { heard: string; actual: string }[]).filter((_, j) => j !== i),
                        };
                        setSpeechProfile(next);
                        localStorage.setItem('nousai-omi-speech-profile', JSON.stringify(next));
                        if (authUser) saveOmiConfig(authUser.uid, { omiSpeechProfile: next }).catch(() => {});
                      }}
                    >✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input
                    type="text"
                    placeholder="word heard"
                    value={customCorrInput.heard}
                    onChange={e => setCustomCorrInput(p => ({ ...p, heard: e.target.value }))}
                    style={{ ...inputStyle, fontSize: 11, flex: 1 }}
                  />
                  <span style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: 12 }}>→</span>
                  <input
                    type="text"
                    placeholder="actual word"
                    value={customCorrInput.actual}
                    onChange={e => setCustomCorrInput(p => ({ ...p, actual: e.target.value }))}
                    style={{ ...inputStyle, fontSize: 11, flex: 1 }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, flexShrink: 0 }}
                    disabled={!customCorrInput.heard || !customCorrInput.actual}
                    onClick={() => {
                      if (!customCorrInput.heard || !customCorrInput.actual) return;
                      const prev = Array.isArray(speechProfile.customCorrections)
                        ? speechProfile.customCorrections as { heard: string; actual: string }[]
                        : [];
                      const next = {
                        ...speechProfile,
                        customCorrections: [...prev, { heard: customCorrInput.heard, actual: customCorrInput.actual }],
                      };
                      setSpeechProfile(next);
                      localStorage.setItem('nousai-omi-speech-profile', JSON.stringify(next));
                      if (authUser) saveOmiConfig(authUser.uid, { omiSpeechProfile: next }).catch(() => {});
                      setCustomCorrInput({ heard: '', actual: '' });
                    }}
                  >
                    + Add
                  </button>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Test your pronunciation at{' '}
                  <a href="https://speech.microsoft.com/portal" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    speech.microsoft.com/portal ↗
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

      {/* Test Data */}
      <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Load Sample Data</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Generate test courses, quizzes & flashcards</div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: '4px 0' }}>
          Load 3 sample university courses (BIOL 3020, CHEM 2010, MATH 2350) with quiz history, flashcards, assignments, study sessions, and more.
          Great for testing and exploring all features.
        </p>
        <button className="btn btn-sm" style={{ background: '#f59e0b', color: '#000', border: 'none', fontWeight: 700 }} onClick={async () => {
          const { injectTestData } = await import('../../utils/testData');
          injectTestData(setData as unknown as (d: NousAIData) => void);
          showToast('Sample data loaded! Explore all features now.');
        }}>
          <Zap size={13} /> Load Test Data
        </button>
      </div>
    </div>
  )
}
