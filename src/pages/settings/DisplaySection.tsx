import { Monitor, Tablet } from 'lucide-react'
import type { NousAIData } from '../../types'
import { getLevel, THEME_PRESETS } from '../../utils/gamification'
import type { DisplayPrefs } from './settingsTypes'
import { cardBodyStyle, rowStyle, toggleStyle, toggleKnobStyle, fieldGroupStyle, labelStyle } from './settingsStyles'

interface DisplaySectionProps {
  displayPrefs: DisplayPrefs
  updateDisplayPrefs: (patch: Partial<DisplayPrefs>) => void
  einkMode: boolean
  setEinkMode: (v: boolean) => void
  betaMode: boolean
  setBetaMode: (v: boolean) => void
  data: NousAIData | null
  setData: (fn: (prev: NousAIData) => NousAIData) => void
  showToast: (msg: string) => void
}

export default function DisplaySection({
  displayPrefs, updateDisplayPrefs,
  einkMode, setEinkMode, betaMode, setBetaMode,
  data, setData, showToast,
}: DisplaySectionProps) {
  return (
    <div style={cardBodyStyle}>
      {/* ── Font Family ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Font Family</div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {[
            { label: 'Default', val: 'inherit', css: 'inherit' },
            { label: 'Inter', val: 'inter', css: "'Inter', system-ui, sans-serif" },
            { label: 'Sora', val: 'sora', css: "'Sora', system-ui, sans-serif" },
            { label: 'Nunito', val: 'nunito', css: "'Nunito', system-ui, sans-serif", gfont: 'Nunito:wght@400;600;700' },
            { label: 'Lato', val: 'lato', css: "'Lato', system-ui, sans-serif", gfont: 'Lato:wght@400;700' },
            { label: 'Serif', val: 'serif', css: 'Georgia, serif' },
            { label: 'Mono', val: 'mono', css: 'ui-monospace, monospace' },
            { label: 'OpenDyslexic', val: 'dyslexic', css: 'OpenDyslexic, sans-serif' },
          ].map(({ label, val, css, gfont } : { label: string; val: string; css: string; gfont?: string }) => {
            const cur = localStorage.getItem('nousai-pref-fontfamily') || 'inherit';
            return (
              <button key={val} className={`btn btn-sm ${cur === val ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontFamily: css }}
                onClick={() => {
                  localStorage.setItem('nousai-pref-fontfamily', val);
                  if (val === 'dyslexic' && !document.getElementById('dyslexic-font-link')) {
                    const link = document.createElement('link');
                    link.id = 'dyslexic-font-link';
                    link.rel = 'stylesheet';
                    link.href = 'https://fonts.cdnfonts.com/css/opendyslexic';
                    document.head.appendChild(link);
                  }
                  if (gfont && !document.getElementById(`gfont-${val}`)) {
                    const link = document.createElement('link');
                    link.id = `gfont-${val}`;
                    link.rel = 'stylesheet';
                    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(gfont)}&display=swap`;
                    document.head.appendChild(link);
                  }
                  document.documentElement.style.setProperty('--font-family-body', css);
                  showToast(`Font: ${label}`);
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Density ── */}
      <div style={{ ...rowStyle, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>UI Density</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Compact mode reduces padding for more content</div>
        </div>
        <div className="flex gap-2">
          {[{ label: 'Comfortable', val: '' }, { label: 'Compact', val: 'compact' }].map(({ label, val }) => {
            const cur = localStorage.getItem('nousai-pref-density') || '';
            return (
              <button key={val} className={`btn btn-sm ${cur === val ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  localStorage.setItem('nousai-pref-density', val);
                  if (val) document.documentElement.setAttribute('data-density', val);
                  else document.documentElement.removeAttribute('data-density');
                  showToast(`Density: ${label}`);
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Standard / E-Ink */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Display Mode</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${!einkMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setEinkMode(false)}
          >
            <Monitor size={16} /> Standard
          </button>
          <button
            className={`btn ${einkMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setEinkMode(true)}
          >
            <Tablet size={16} /> E-Ink / Boox
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          E-Ink mode removes animations, increases contrast, and enlarges touch targets for e-ink displays.
        </p>
      </div>

      {/* Font Size */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Font Size</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Adjust text size across the app</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['small', 'medium', 'large'] as const).map(s => (
            <button
              key={s}
              style={{
                padding: '6px 12px', fontSize: s === 'small' ? 11 : s === 'medium' ? 13 : 15,
                fontWeight: displayPrefs.fontSize === s ? 700 : 500,
                fontFamily: 'inherit',
                background: displayPrefs.fontSize === s ? 'var(--accent, #fff)' : 'var(--bg-primary)',
                color: displayPrefs.fontSize === s ? 'var(--bg-primary, #000)' : 'var(--text-secondary)',
                border: displayPrefs.fontSize === s ? 'none' : '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onClick={() => updateDisplayPrefs({ fontSize: s })}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Compact Mode */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Compact Mode</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reduces padding and spacing</div>
        </div>
        <button
          style={toggleStyle(displayPrefs.compactMode)}
          onClick={() => updateDisplayPrefs({ compactMode: !displayPrefs.compactMode })}
        >
          <div style={toggleKnobStyle(displayPrefs.compactMode)} />
        </button>
      </div>

      {/* Accent Color */}
      <div style={{ ...rowStyle }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>🎨 Accent Color</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Customize the app's accent color.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={displayPrefs.accentColor}
              onChange={e => updateDisplayPrefs({ accentColor: e.target.value })}
              style={{ width: 36, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'none', padding: 2 }}
              title="Pick accent color"
            />
            <button
              onClick={() => updateDisplayPrefs({ accentColor: '#F5A623' })}
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', cursor: 'pointer' }}
            >Reset</button>
          </div>
      </div>

      {/* Unlockable Theme Presets */}
      <div style={{ ...rowStyle }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>🎨 Theme Presets</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unlock color themes by leveling up.</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {THEME_PRESETS.map(t => {
            const userLevel = getLevel(data?.pluginData?.gamificationData?.xp ?? 0)
            const unlocked = userLevel >= t.unlockLevel
            const active = displayPrefs.accentColor === t.color
            return (
              <button key={t.id}
                disabled={!unlocked}
                title={unlocked ? t.name : `Unlock at level ${t.unlockLevel}`}
                onClick={() => unlocked && updateDisplayPrefs({ accentColor: t.color })}
                style={{
                  width: 24, height: 24, borderRadius: '50%', border: active ? '2px solid var(--text-primary)' : '2px solid transparent',
                  background: unlocked ? t.color : 'var(--bg-secondary)', cursor: unlocked ? 'pointer' : 'not-allowed',
                  opacity: unlocked ? 1 : 0.35, position: 'relative', flexShrink: 0,
                  boxShadow: active ? `0 0 8px ${t.color}80` : 'none',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Theme toggle */}
      <div style={{ ...rowStyle }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>🎨 Theme</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Switch between dark and light mode.</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['dark', 'light', 'system'] as const).map(t => {
            const active = (data?.settings?.theme ?? 'dark') === t
            return (
              <button
                key={t}
                onClick={() => setData(prev => ({ ...prev, settings: { ...prev.settings, theme: t } }))}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                  border: active ? '1px solid var(--color-accent, #F5A623)' : '1px solid var(--border)',
                  background: active ? 'rgba(245,166,35,0.15)' : 'var(--bg-secondary)',
                  color: active ? 'var(--color-accent, #F5A623)' : 'var(--text-muted)',
                  textTransform: 'capitalize',
                }}
              >{t}</button>
            )
          })}
        </div>
      </div>

      {/* Color Presets */}
      {(() => {
        const CANVAS_THEME_PRESETS = [
          { id: 'default', label: 'Default', color: '#ffffff' },
          { id: 'amber',   label: 'Amber',   color: '#F5A623' },
          { id: 'forest',  label: 'Forest',  color: '#4ade80' },
          { id: 'ocean',   label: 'Ocean',   color: '#38bdf8' },
          { id: 'dusk',    label: 'Dusk',    color: '#a78bfa' },
        ]
        const active = (data?.settings?.themePreset as string) ?? 'default'
        return (
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>🎨 Color Preset</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Choose a color theme for the app.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CANVAS_THEME_PRESETS.map(p => (
                <button
                  key={p.id}
                  title={p.label}
                  onClick={() => setData(prev => ({ ...prev, settings: { ...prev.settings, themePreset: p.id === 'default' ? '' : p.id } }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                    fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                    border: active === p.id || (p.id === 'default' && !active)
                      ? `1px solid ${p.color}` : '1px solid var(--border)',
                    background: active === p.id || (p.id === 'default' && !active)
                      ? `${p.color}22` : 'var(--bg-secondary)',
                    color: active === p.id || (p.id === 'default' && !active)
                      ? p.color : 'var(--text-muted)',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Auto Dark Mode Schedule */}
      {(() => {
        const sched = (data?.settings?.autoDarkSchedule as { enabled?: boolean; startTime?: string; endTime?: string }) ?? {}
        const enabled = sched.enabled ?? false
        const startTime = sched.startTime ?? '20:00'
        const endTime = sched.endTime ?? '07:00'
        const update = (patch: Record<string, unknown>) => setData(prev => ({
          ...prev,
          settings: { ...prev.settings, autoDarkSchedule: { enabled, startTime, endTime, ...patch } }
        }))
        return (
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>🌙 Auto Dark Schedule</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Automatically switch to dark mode on a schedule.</div>
              </div>
              <button style={toggleStyle(enabled)} onClick={() => update({ enabled: !enabled })}>
                <div style={toggleKnobStyle(enabled)} />
              </button>
            </div>
            {enabled && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                <label style={{ color: 'var(--text-secondary)' }}>Dark from</label>
                <input type="time" value={startTime} onChange={e => update({ startTime: e.target.value })}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', padding: '2px 6px', fontSize: 12 }} />
                <label style={{ color: 'var(--text-secondary)' }}>to</label>
                <input type="time" value={endTime} onChange={e => update({ endTime: e.target.value })}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', padding: '2px 6px', fontSize: 12 }} />
              </div>
            )}
          </div>
        )
      })()}

      {/* High Contrast */}
      <div style={{ ...rowStyle }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>⬛ High Contrast</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enhance contrast for better readability.</div>
        </div>
        <button style={toggleStyle(displayPrefs.highContrast)} onClick={() => updateDisplayPrefs({ highContrast: !displayPrefs.highContrast })}>
          <div style={toggleKnobStyle(displayPrefs.highContrast)} />
        </button>
      </div>

      {/* Color-Blind Safe */}
      <div style={{ ...rowStyle }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>🔵 Color-Blind Safe</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Replaces red/green with orange/blue.</div>
        </div>
        <button style={toggleStyle(displayPrefs.colorBlind)} onClick={() => updateDisplayPrefs({ colorBlind: !displayPrefs.colorBlind })}>
          <div style={toggleKnobStyle(displayPrefs.colorBlind)} />
        </button>
      </div>

      {/* Reduced Motion */}
      <div style={{ ...rowStyle }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>⏸ Reduced Motion</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Minimizes animations across the app.</div>
        </div>
        <button style={toggleStyle(displayPrefs.reducedMotion)} onClick={() => updateDisplayPrefs({ reducedMotion: !displayPrefs.reducedMotion })}>
          <div style={toggleKnobStyle(displayPrefs.reducedMotion)} />
        </button>
      </div>

      {/* Beta Mode */}
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>🧪 Beta Mode</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Preview experimental features. Your data is always safe — switch back anytime.
          </div>
        </div>
        <button
          style={toggleStyle(betaMode)}
          onClick={() => setBetaMode(!betaMode)}
        >
          <div style={toggleKnobStyle(betaMode)} />
        </button>
      </div>
    </div>
  )
}
