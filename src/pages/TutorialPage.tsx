import { useState, useMemo, useCallback, useEffect } from 'react'
import { TUTORIAL_CATEGORIES, type TutorialEntry, type TutorialCategory } from '../data/tutorialContent'

// ─── TutorialPage ─────────────────────────────────────────────────────────────
// Dedicated full-screen guide — accessible at /#/tutorial.
// Two-panel layout on desktop (category nav + content), pill+accordion on mobile.
// No store access — fully static content page.
// ─────────────────────────────────────────────────────────────────────────────

export default function TutorialPage() {
  const [activeCategory, setActiveCategory] = useState('getting-started')
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [mobileOpenIds, setMobileOpenIds] = useState<Set<string>>(new Set())

  // Inject responsive CSS once
  useEffect(() => {
    const id = 'tutorial-responsive'
    if (document.getElementById(id)) return
    const s = document.createElement('style')
    s.id = id
    s.textContent = `
      @media (max-width: 767px) {
        .tp-desktop { display: none !important; }
        .tp-mobile { display: flex !important; flex-direction: column; flex: 1; overflow: hidden; min-height: 0; }
      }
      @media (min-width: 768px) {
        .tp-mobile { display: none !important; }
      }
      .tp-card:hover { border-color: var(--accent) !important; transform: translateY(-1px); }
      .tp-cat-btn:hover { background: var(--bg-card) !important; }
    `
    document.head.appendChild(s)
  }, [])

  // Search across all entries
  const searchResults = useMemo<Array<{ cat: TutorialCategory; entry: TutorialEntry }> | null>(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    const out: Array<{ cat: TutorialCategory; entry: TutorialEntry }> = []
    for (const cat of TUTORIAL_CATEGORIES) {
      for (const entry of cat.entries) {
        if (
          entry.title.toLowerCase().includes(q) ||
          entry.tldr.toLowerCase().includes(q) ||
          entry.content.toLowerCase().includes(q) ||
          entry.tags.some(t => t.includes(q))
        ) {
          out.push({ cat, entry })
        }
      }
    }
    return out
  }, [search])

  const currentCategory = TUTORIAL_CATEGORIES.find(c => c.id === activeCategory) ?? TUTORIAL_CATEGORIES[0]

  const activeEntry = useMemo<TutorialEntry | null>(() => {
    if (!activeEntryId) return null
    for (const cat of TUTORIAL_CATEGORIES) {
      const found = cat.entries.find(e => e.id === activeEntryId)
      if (found) return found
    }
    return null
  }, [activeEntryId])

  const displayEntries: TutorialEntry[] = searchResults
    ? searchResults.map(r => r.entry)
    : currentCategory.entries

  const selectCategory = (catId: string) => {
    setActiveCategory(catId)
    setActiveEntryId(null)
    setSearch('')
  }

  const openEntry = (entry: TutorialEntry, catId: string) => {
    setActiveEntryId(entry.id)
    setActiveCategory(catId)
  }

  const toggleMobile = useCallback((id: string) => {
    setMobileOpenIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const getCatForEntry = (entry: TutorialEntry): TutorialCategory =>
    TUTORIAL_CATEGORIES.find(c => c.entries.some(e => e.id === entry.id)) ?? currentCategory

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body, Inter, sans-serif)' }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>🎓</span>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'var(--font-heading, Sora, sans-serif)', letterSpacing: '-0.3px' }}>NousAI Guide</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Complete guide to every feature — written for beginners</div>
          </div>
        </div>
        <input
          type="text"
          placeholder="Search all guides…"
          value={search}
          onChange={e => { setSearch(e.target.value); setActiveEntryId(null) }}
          style={{ width: 240, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-input, var(--bg-card))', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
          aria-label="Search guides"
        />
      </div>

      {search && (
        <div style={{ padding: '7px 24px', fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          {searchResults && searchResults.length > 0
            ? `${searchResults.length} guide${searchResults.length === 1 ? '' : 's'} match "${search}"`
            : `No guides match "${search}" — try a shorter search`}
        </div>
      )}

      {/* ── Desktop: two-panel ────────────────────────────────── */}
      <div className="tp-desktop" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Sidebar */}
        <nav style={{ width: 220, minWidth: 220, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '10px 0' }} aria-label="Guide categories">
          {TUTORIAL_CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id && !search
            return (
              <button
                key={cat.id}
                className="tp-cat-btn"
                onClick={() => selectCategory(cat.id)}
                title={cat.description}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', background: isActive ? 'var(--bg-card)' : 'transparent',
                  border: 'none', borderLeft: isActive ? `3px solid ${cat.color}` : '3px solid transparent',
                  cursor: 'pointer', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{cat.icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2px' }}>{cat.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim, var(--text-muted))', marginTop: 1 }}>{cat.entries.length} guides</span>
                </div>
                {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />}
              </button>
            )
          })}
          <div style={{ marginTop: 'auto', padding: '16px 14px 8px' }}>
            <a href="/#/settings" style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>← Back to Settings</a>
          </div>
        </nav>

        {/* Content area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {activeEntry && !search ? (
            <EntryDetail entry={activeEntry} color={getCatForEntry(activeEntry).color} onBack={() => setActiveEntryId(null)} />
          ) : (
            <>
              {!search && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 26 }}>{currentCategory.icon}</span>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'var(--font-heading, Sora, sans-serif)' }}>{currentCategory.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{currentCategory.description}</div>
                  </div>
                </div>
              )}
              <EntryGrid
                entries={displayEntries}
                getCat={getCatForEntry}
                showCatLabel={!!search}
                onSelect={openEntry}
              />
            </>
          )}
        </main>
      </div>

      {/* ── Mobile: pills + accordion ─────────────────────────── */}
      <div className="tp-mobile" style={{ display: 'none' }}>
        {/* Category pills */}
        <div style={{ display: 'flex', overflowX: 'auto', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' } as React.CSSProperties}>
          {TUTORIAL_CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id && !search
            return (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 20,
                  border: `1px solid ${isActive ? cat.color : 'var(--border)'}`,
                  background: 'var(--bg-card)', color: isActive ? cat.color : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: isActive ? 700 : 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {cat.icon} {cat.label}
              </button>
            )
          })}
        </div>

        {/* Accordion entries */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {displayEntries.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 32 }}>No guides match your search.</p>
          ) : (
            displayEntries.map(entry => {
              const isOpen = mobileOpenIds.has(entry.id)
              const cat = getCatForEntry(entry)
              return (
                <div key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button
                    onClick={() => toggleMobile(entry.id)}
                    aria-expanded={isOpen}
                    style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '12px 14px 10px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', gap: 10, alignItems: 'flex-start' }}
                  >
                    <div style={{ width: 4, minHeight: 36, borderRadius: 2, background: cat.color, flexShrink: 0, alignSelf: 'stretch' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading, Sora, sans-serif)', lineHeight: 1.3 }}>{entry.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 3 }}>{entry.tldr}</div>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 2 }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 14px 16px 28px' }}>
                      <pre style={{ fontSize: 13, lineHeight: 1.85, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, wordBreak: 'break-word' }}>{entry.content}</pre>
                      {entry.proTip && <ProTipBox tip={entry.proTip} />}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── EntryGrid ────────────────────────────────────────────────────────────────

function EntryGrid({
  entries,
  getCat,
  showCatLabel,
  onSelect,
}: {
  entries: TutorialEntry[]
  getCat: (e: TutorialEntry) => TutorialCategory
  showCatLabel: boolean
  onSelect: (e: TutorialEntry, catId: string) => void
}) {
  if (entries.length === 0) {
    return <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 32 }}>No guides match your search — try a shorter term.</p>
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {entries.map(entry => {
        const cat = getCat(entry)
        const isStartHere = entry.id === 'first-steps'
        return (
          <button
            key={entry.id}
            className="tp-card"
            onClick={() => onSelect(entry, cat.id)}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius, 8px)', cursor: 'pointer', textAlign: 'left',
              padding: 0, overflow: 'hidden', transition: 'border-color 0.15s, transform 0.1s',
              display: 'flex', flexDirection: 'column', color: 'var(--text-primary)',
            }}
            aria-label={entry.title}
          >
            <div style={{ height: 4, background: cat.color, flexShrink: 0 }} />
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading, Sora, sans-serif)', lineHeight: 1.3, flex: 1 }}>{entry.title}</span>
                {isStartHere && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#F5A623', background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 20, padding: '2px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    Start Here →
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                {entry.tldr}
              </div>
              {showCatLabel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim, var(--text-muted))', marginTop: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, flexShrink: 0, display: 'inline-block' }} />
                  {cat.label}
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── EntryDetail ──────────────────────────────────────────────────────────────

function EntryDetail({ entry, color, onBack }: { entry: TutorialEntry; color: string; onBack: () => void }) {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 40 }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '0 0 16px', display: 'block', fontFamily: 'inherit' }}>
        ← Back
      </button>
      <div style={{ height: 4, borderRadius: 4, background: color, marginBottom: 16 }} />
      <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading, Sora, sans-serif)', lineHeight: 1.25, marginBottom: 10, margin: '0 0 10px' }}>
        {entry.title}
      </h1>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 20, padding: '5px 14px', display: 'inline-block', marginBottom: 20, lineHeight: 1.5, border: '1px solid var(--border)' }}>
        {entry.tldr}
      </div>
      <pre style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, wordBreak: 'break-word' }}>
        {entry.content}
      </pre>
      {entry.proTip && <ProTipBox tip={entry.proTip} />}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          ← Back to list
        </button>
      </div>
    </div>
  )
}

// ─── ProTipBox ────────────────────────────────────────────────────────────────

function ProTipBox({ tip }: { tip: string }) {
  return (
    <div style={{ borderLeft: '3px solid #F5A623', background: 'rgba(245,166,35,0.06)', borderRadius: '0 8px 8px 0', padding: '12px 16px', marginTop: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#F5A623', letterSpacing: '0.5px', marginBottom: 6, textTransform: 'uppercase' }}>⚡ Pro Tip</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{tip}</div>
    </div>
  )
}
