import { useState, useEffect } from 'react'
import { Volume2, VolumeX, Minus, Plus, RefreshCw } from 'lucide-react'
import { SHORTCUT_DEFS, SHORTCUT_CATEGORIES, FIXED_SHORTCUTS, getShortcutKey, setShortcutKey, resetAllShortcuts, formatKey } from '../../utils/shortcuts'
import type { StudyPrefs } from './settingsTypes'
import { LANGUAGES, DIFFICULTIES } from './settingsConstants'
import { cardBodyStyle, selectStyle, rowStyle, toggleStyle, toggleKnobStyle } from './settingsStyles'

interface StudySectionProps {
  studyPrefs: StudyPrefs
  updateStudyPrefs: (patch: Partial<StudyPrefs>) => void
  showToast: (msg: string) => void
}

// ─── Shortcut Row Component ────────────────────────────────
function ShortcutRow({ shortcut }: { shortcut: (typeof SHORTCUT_DEFS)[number] }) {
  const [listening, setListening] = useState(false);
  const currentKey = getShortcutKey(shortcut.id);
  const isCustom = currentKey !== shortcut.defaultKey;

  useEffect(() => {
    if (!listening) return;
    function handleKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      const key = e.key === ' ' ? 'Space' : e.key;
      if (key === 'Escape') { setListening(false); return; }
      setShortcutKey(shortcut.id, key);
      setListening(false);
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [listening, shortcut.id]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 8px', borderRadius: 4,
      background: listening ? 'var(--accent-glow)' : 'transparent',
    }}>
      <div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{shortcut.label}</span>
        {shortcut.description && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{shortcut.description}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => setListening(!listening)}
          style={{
            fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
            padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
            border: listening ? '2px solid var(--accent)' : `1px solid ${isCustom ? 'var(--accent)' : 'var(--border)'}`,
            background: listening ? 'var(--accent-glow)' : isCustom ? 'var(--accent-glow)' : 'var(--bg-primary)',
            color: listening ? 'var(--accent)' : isCustom ? 'var(--accent-light)' : 'var(--text-primary)',
            minWidth: 36, textAlign: 'center',
          }}
        >
          {listening ? '...' : formatKey(currentKey)}
        </button>
        {isCustom && (
          <button
            onClick={() => { setShortcutKey(shortcut.id, shortcut.defaultKey); }}
            title="Reset to default"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', padding: 2, fontSize: 10,
            }}
          >
            <RefreshCw size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function StudySection({ studyPrefs, updateStudyPrefs, showToast }: StudySectionProps) {
  return (
    <div style={cardBodyStyle}>
      {/* Daily XP Goal */}
      <div style={rowStyle}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Daily XP Goal</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{studyPrefs.dailyXpGoal} XP per day</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '4px 6px', color: 'var(--text-primary)', display: 'flex' }}
            onClick={() => updateStudyPrefs({ dailyXpGoal: Math.max(50, studyPrefs.dailyXpGoal - 50) })}
          >
            <Minus size={14} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, minWidth: 36, textAlign: 'center' }}>{studyPrefs.dailyXpGoal}</span>
          <button
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '4px 6px', color: 'var(--text-primary)', display: 'flex' }}
            onClick={() => updateStudyPrefs({ dailyXpGoal: Math.min(500, studyPrefs.dailyXpGoal + 50) })}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Quiz Question Count */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Default Quiz Questions</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Questions per quiz session</div>
        </div>
        <select
          style={{ ...selectStyle, width: 'auto', minWidth: 80 }}
          value={studyPrefs.quizQuestionCount}
          onChange={e => updateStudyPrefs({ quizQuestionCount: parseInt(e.target.value) })}
        >
          {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* Flashcard Auto-Flip */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Flashcard Auto-Flip</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-reveal answer after delay</div>
        </div>
        <select
          style={{ ...selectStyle, width: 'auto', minWidth: 80 }}
          value={studyPrefs.flashcardAutoFlip}
          onChange={e => updateStudyPrefs({ flashcardAutoFlip: e.target.value })}
        >
          <option value="off">Off</option>
          <option value="3">3 sec</option>
          <option value="5">5 sec</option>
          <option value="10">10 sec</option>
        </select>
      </div>

      {/* Pomodoro Work Duration */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Pomodoro Work</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Focus session length</div>
        </div>
        <select
          style={{ ...selectStyle, width: 'auto', minWidth: 80 }}
          value={studyPrefs.pomoWork}
          onChange={e => updateStudyPrefs({ pomoWork: parseInt(e.target.value) })}
        >
          {[15, 20, 25, 30, 45].map(n => <option key={n} value={n}>{n} min</option>)}
        </select>
      </div>

      {/* Pomodoro Break Duration */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Pomodoro Break</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Break session length</div>
        </div>
        <select
          style={{ ...selectStyle, width: 'auto', minWidth: 80 }}
          value={studyPrefs.pomoBreak}
          onChange={e => updateStudyPrefs({ pomoBreak: parseInt(e.target.value) })}
        >
          {[3, 5, 10].map(n => <option key={n} value={n}>{n} min</option>)}
        </select>
      </div>

      {/* Language */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Language</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Preferred study language</div>
        </div>
        <select
          style={{ ...selectStyle, width: 'auto', minWidth: 110 }}
          value={studyPrefs.language}
          onChange={e => updateStudyPrefs({ language: e.target.value })}
        >
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Difficulty */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Difficulty</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Default quiz difficulty</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {DIFFICULTIES.map(d => (
            <button
              key={d}
              style={{
                padding: '6px 12px', fontSize: 12, fontFamily: 'inherit',
                fontWeight: studyPrefs.difficulty === d ? 700 : 500,
                background: studyPrefs.difficulty === d ? 'var(--accent, #fff)' : 'var(--bg-primary)',
                color: studyPrefs.difficulty === d ? 'var(--bg-primary, #000)' : 'var(--text-secondary)',
                border: studyPrefs.difficulty === d ? 'none' : '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onClick={() => updateStudyPrefs({ difficulty: d })}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Sound Effects */}
      <div style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {studyPrefs.soundEffects ? <Volume2 size={16} /> : <VolumeX size={16} style={{ color: 'var(--text-muted)' }} />}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Sound Effects</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Audio feedback for actions</div>
          </div>
        </div>
        <button
          style={toggleStyle(studyPrefs.soundEffects)}
          onClick={() => updateStudyPrefs({ soundEffects: !studyPrefs.soundEffects })}
        >
          <div style={toggleKnobStyle(studyPrefs.soundEffects)} />
        </button>
      </div>

      {/* Keyboard Shortcuts */}
      <div style={{ ...rowStyle, borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Keyboard Shortcuts</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click a key to rebind, press new key</div>
          </div>
          <button className="btn btn-sm" onClick={() => { resetAllShortcuts(); showToast('Shortcuts reset to defaults'); }} style={{ fontSize: 11 }}>
            <RefreshCw size={11} /> Reset All
          </button>
        </div>
        {(Object.keys(SHORTCUT_CATEGORIES) as Array<keyof typeof SHORTCUT_CATEGORIES>).map(cat => {
          const items = SHORTCUT_DEFS.filter(s => s.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
                {SHORTCUT_CATEGORIES[cat]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {items.map(s => (
                  <ShortcutRow key={s.id} shortcut={s} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Fixed shortcuts reference (not rebindable) */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
            📋 Reference — Built-in Shortcuts (not rebindable)
          </div>
          {Object.entries(
            FIXED_SHORTCUTS.reduce((acc, s) => {
              (acc[s.category] = acc[s.category] || []).push(s);
              return acc;
            }, {} as Record<string, typeof FIXED_SHORTCUTS>)
          ).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{cat}</div>
              {items.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px', fontSize: 11 }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 6, fontSize: 10 }}>{s.description}</span>
                  </div>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                    padding: '1px 6px', borderRadius: 3, background: 'var(--bg-primary)',
                    border: '1px solid var(--border)', color: 'var(--text-muted)',
                  }}>
                    {s.key}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
