/**
 * VocabBankTab — Import, view, and manage the per-course Japanese vocab bank.
 * Three panels: Bank (view/filter/delete), Import (paste JSON or simple format), Games Preview.
 */
import React, { useState, useMemo, useCallback } from 'react'
import type { VocabBankItem, VocabCategory } from './types'
import { CATEGORY_LABELS } from '../../data/jpVocabBank'
import AiImportPanel from './AiImportPanel'
import { ToolErrorBoundary } from '../ToolErrorBoundary'

// ─── helpers ──────────────────────────────────────────────────────────────────

let _importSeq = 0
function genId(): string { return `vb_${Date.now().toString(36)}_${(++_importSeq).toString(36)}` }

/** Parse pasted text: JSON array or `word :: meaning :: category` lines */
function parsePaste(raw: string): { items: VocabBankItem[]; errors: string[] } {
  const errors: string[] = []
  const items: VocabBankItem[] = []
  const text = raw.trim()

  // ── Try JSON first ──
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) { errors.push('JSON must be an array'); return { items, errors } }
      parsed.forEach((obj: Record<string, string>, i: number) => {
        if (!obj.word || !obj.meaning) {
          errors.push(`Row ${i + 1}: missing "word" or "meaning"`)
          return
        }
        items.push({
          id: genId(),
          word: String(obj.word).trim(),
          meaning: String(obj.meaning).trim(),
          category: (obj.category as VocabCategory) || 'other',
          reading: obj.reading ? String(obj.reading).trim() : undefined,
          example: obj.example ? String(obj.example).trim() : undefined,
          exampleEn: obj.exampleEn ? String(obj.exampleEn).trim() : undefined,
          notes: obj.notes ? String(obj.notes).trim() : undefined,
          source: 'imported',
        })
      })
      return { items, errors }
    } catch (e) {
      errors.push('Invalid JSON — check for missing quotes or commas')
      return { items, errors }
    }
  }

  // ── Simple line format: word :: meaning :: category ──
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  lines.forEach((line, i) => {
    const parts = line.split('::').map(p => p.trim())
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: expected "word :: meaning" (got: "${line.slice(0, 40)}")`)
      return
    }
    items.push({
      id: genId(),
      word: parts[0],
      meaning: parts[1],
      category: (parts[2] as VocabCategory) || 'other',
      source: 'imported',
    })
  })
  return { items, errors }
}

// ─── Category badge colour ────────────────────────────────────────────────────
const CAT_COLORS: Partial<Record<VocabCategory, string>> = {
  'noun':           '#3498db',
  'verbal-noun':    '#2980b9',
  'pronoun':        '#9b59b6',
  'demonstrative':  '#8e44ad',
  'verb-u':         '#27ae60',
  'verb-ru':        '#2ecc71',
  'verb-irregular': '#e74c3c',
  'i-adj':          '#e67e22',
  'na-adj':         '#d35400',
  'adverb':         '#f39c12',
  'particle':       '#1abc9c',
  'conjunction':    '#16a085',
  'interjection':   '#e91e63',
  'question-word':  '#ff5722',
  'counter':        '#607d8b',
  'grammar':        '#F5A623',
  'other':          '#7f8c8d',
}

function CatBadge({ cat }: { cat: VocabCategory }) {
  const color = CAT_COLORS[cat] ?? '#7f8c8d'
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}55`,
      borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600,
      whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace',
    }}>
      {CATEGORY_LABELS[cat] ?? cat}
    </span>
  )
}

// ─── Mini-game preview data ───────────────────────────────────────────────────
function gamePreviewItems(bank: VocabBankItem[]) {
  const flippable = bank.filter(v => v.word && v.meaning && !v.word.startsWith('〜') && v.category !== 'grammar')
  const grammar   = bank.filter(v => v.example && v.exampleEn)
  const listening = flippable
  return { flippable, grammar, listening }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  bank: VocabBankItem[]
  onSave: (updated: VocabBankItem[]) => void
  onBack: () => void
}

type Panel = 'bank' | 'import' | 'preview' | 'ai-import'

// ─── Component ────────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS: VocabCategory[] = [
  'noun','verbal-noun','pronoun','demonstrative','verb-u','verb-ru','verb-irregular',
  'i-adj','na-adj','adverb','particle','conjunction','interjection','question-word',
  'counter','grammar','other',
]

export default function VocabBankTab({ bank, onSave, onBack }: Props) {
  const [panel, setPanel] = useState<Panel>('bank')
  const [catFilter, setCatFilter] = useState<VocabCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  // Manual add state
  const [showAddForm, setShowAddForm] = useState(false)
  const [manualWord, setManualWord] = useState('')
  const [manualReading, setManualReading] = useState('')
  const [manualMeaning, setManualMeaning] = useState('')
  const [manualCategory, setManualCategory] = useState<VocabCategory>('noun')

  // Import state
  const [importText, setImportText] = useState('')
  const [parseResult, setParseResult] = useState<{ items: VocabBankItem[]; errors: string[] } | null>(null)
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append')

  // Computed
  const categories = useMemo(() => {
    const counts: Partial<Record<VocabCategory | 'all', number>> = { all: bank.length }
    bank.forEach(v => { counts[v.category] = (counts[v.category] ?? 0) + 1 })
    return counts
  }, [bank])

  const filtered = useMemo(() => {
    let list = catFilter === 'all' ? bank : bank.filter(v => v.category === catFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(v =>
        v.word.toLowerCase().includes(q) ||
        v.meaning.toLowerCase().includes(q) ||
        (v.reading?.toLowerCase().includes(q) ?? false)
      )
    }
    return list
  }, [bank, catFilter, search])

  const preview = useMemo(() => gamePreviewItems(bank), [bank])

  // Actions
  const deleteItem = useCallback((id: string) => {
    onSave(bank.filter(v => v.id !== id))
  }, [bank, onSave])

  const handleManualAdd = useCallback(() => {
    if (!manualWord.trim() || !manualMeaning.trim()) return
    const item: VocabBankItem = {
      id: genId(),
      word: manualWord.trim(),
      reading: manualReading.trim() || undefined,
      meaning: manualMeaning.trim(),
      category: manualCategory,
      source: 'custom',
    }
    onSave([...bank, item])
    setManualWord(''); setManualReading(''); setManualMeaning(''); setManualCategory('noun')
    setShowAddForm(false)
  }, [manualWord, manualReading, manualMeaning, manualCategory, bank, onSave])

  const clearAll = useCallback(() => {
    if (confirm(`Delete all ${bank.length} words from the bank? This cannot be undone.`)) {
      onSave([])
    }
  }, [bank.length, onSave])

  const handleParse = useCallback(() => {
    if (!importText.trim()) return
    setParseResult(parsePaste(importText))
  }, [importText])

  const handleImport = useCallback(() => {
    if (!parseResult || parseResult.items.length === 0) return
    const next = importMode === 'replace' ? parseResult.items : [...bank, ...parseResult.items]
    onSave(next)
    setImportText('')
    setParseResult(null)
    setPanel('bank')
  }, [parseResult, importMode, bank, onSave])

  const panelBtn = (p: Panel, label: string) => (
    <button
      onClick={() => setPanel(p)}
      style={{
        padding: '8px 16px', border: 'none', borderRadius: 8,
        background: panel === p ? 'var(--accent-color, #F5A623)' : 'var(--bg-secondary)',
        color: panel === p ? '#000' : 'var(--text-primary)',
        fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: '1px solid var(--border-color)', borderRadius: 8,
          padding: '6px 12px', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit',
        }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📖 Vocab Bank</h2>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{bank.length} words</span>
      </div>

      {/* Panel switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {panelBtn('bank',      `📚 Bank (${bank.length})`)}
        {panelBtn('import',   '📥 Import')}
        {panelBtn('preview',  '🎮 Games Preview')}
        {panelBtn('ai-import','✨ AI Import')}
      </div>

      {/* ── BANK PANEL ─────────────────────────────────────────────────── */}
      {panel === 'bank' && (
        <div>
          {/* Manual add form */}
          {showAddForm ? (
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              borderRadius: 10, padding: 14, marginBottom: 14,
            }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <input
                  value={manualWord}
                  onChange={e => setManualWord(e.target.value)}
                  placeholder="Japanese word *"
                  autoFocus
                  lang="ja"
                  style={{
                    flex: '1 1 120px', padding: '7px 10px', borderRadius: 7,
                    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
                  }}
                />
                <input
                  value={manualReading}
                  onChange={e => setManualReading(e.target.value)}
                  placeholder="Reading (hiragana)"
                  lang="ja"
                  style={{
                    flex: '1 1 120px', padding: '7px 10px', borderRadius: 7,
                    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
                  }}
                />
                <input
                  value={manualMeaning}
                  onChange={e => setManualMeaning(e.target.value)}
                  placeholder="English meaning *"
                  onKeyDown={e => { if (e.key === 'Enter') handleManualAdd() }}
                  style={{
                    flex: '2 1 160px', padding: '7px 10px', borderRadius: 7,
                    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
                  }}
                />
                <select
                  value={manualCategory}
                  onChange={e => setManualCategory(e.target.value as VocabCategory)}
                  style={{
                    flex: '1 1 140px', padding: '7px 10px', borderRadius: 7,
                    border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                  }}
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleManualAdd}
                  disabled={!manualWord.trim() || !manualMeaning.trim()}
                  style={{
                    padding: '7px 18px', borderRadius: 7, border: 'none',
                    background: manualWord.trim() && manualMeaning.trim() ? 'var(--accent-color, #F5A623)' : 'var(--bg-card)',
                    color: manualWord.trim() && manualMeaning.trim() ? '#000' : 'var(--text-muted)',
                    fontWeight: 700, fontSize: 13, cursor: manualWord.trim() && manualMeaning.trim() ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}
                >+ Add Word</button>
                <button
                  onClick={() => { setShowAddForm(false); setManualWord(''); setManualReading(''); setManualMeaning(''); setManualCategory('noun') }}
                  style={{
                    padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border-color)',
                    background: 'none', color: 'var(--text-muted)', fontSize: 13,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                marginBottom: 12, padding: '7px 16px', borderRadius: 7,
                border: '1px dashed var(--border-color)', background: 'none',
                color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 600,
              }}
            >+ Add Word Manually</button>
          )}

          {/* Search + clear */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search words..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
              }}
            />
            {bank.length > 0 && (
              <button onClick={clearAll} style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid var(--danger-color, #e74c3c)',
                background: 'none', color: 'var(--danger-color, #e74c3c)',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              }}>Clear All</button>
            )}
          </div>

          {/* Category filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {(['all', ...Object.keys(categories).filter(k => k !== 'all')] as (VocabCategory | 'all')[]).map(cat => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit',
                  cursor: 'pointer', fontWeight: catFilter === cat ? 700 : 400,
                  border: `1px solid ${catFilter === cat ? 'var(--accent-color, #F5A623)' : 'var(--border-color)'}`,
                  background: catFilter === cat ? 'var(--accent-color, #F5A623)22' : 'var(--bg-secondary)',
                  color: catFilter === cat ? 'var(--accent-color, #F5A623)' : 'var(--text-muted)',
                }}
              >
                {cat === 'all' ? `All (${categories.all ?? 0})` : `${CATEGORY_LABELS[cat] ?? cat} (${categories[cat] ?? 0})`}
              </button>
            ))}
          </div>

          {/* Word table */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              {bank.length === 0
                ? 'No words yet. Go to Import to add words.'
                : 'No results match your search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(v => (
                <div key={v.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr auto auto',
                  gap: 10, alignItems: 'center',
                  padding: '8px 12px', background: 'var(--bg-secondary)',
                  borderRadius: 8, border: '1px solid var(--border-color)',
                  fontSize: 14,
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{v.word}</span>
                    {v.reading && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>({v.reading})</span>}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>{v.meaning}</div>
                  <CatBadge cat={v.category} />
                  <button onClick={() => deleteItem(v.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 16, padding: '2px 4px',
                  }} title="Delete">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── IMPORT PANEL ───────────────────────────────────────────────── */}
      {panel === 'import' && (
        <div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 16, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Accepted formats:</strong><br />
            <code style={{ background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4 }}>word :: meaning :: category</code> (one per line)<br />
            — or —<br />
            <code style={{ background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4 }}>{`[{"word":"たべる","meaning":"to eat","category":"verb-ru","example":"すしをたべます。","exampleEn":"I eat sushi."}]`}</code><br />
            <br />
            <strong>Categories:</strong> noun · verbal-noun · pronoun · demonstrative · verb-u · verb-ru · verb-irregular · i-adj · na-adj · adverb · particle · conjunction · interjection · question-word · counter · grammar · other
          </div>

          <textarea
            value={importText}
            onChange={e => { setImportText(e.target.value); setParseResult(null) }}
            placeholder={`たべる :: to eat :: verb-ru\nのむ :: to drink :: verb-u\nきれい :: pretty/clean :: na-adj`}
            rows={10}
            style={{
              width: '100%', padding: 12, borderRadius: 8,
              border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: 13, fontFamily: 'DM Mono, monospace',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={importMode === 'append'} onChange={() => setImportMode('append')} /> Add to existing bank
            </label>
            <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} /> Replace bank
            </label>
            <button onClick={handleParse} disabled={!importText.trim()} style={{
              marginLeft: 'auto', padding: '8px 18px', borderRadius: 8,
              border: '1px solid var(--border-color)', background: 'var(--bg-card)',
              color: 'var(--text-primary)', fontWeight: 600, fontSize: 13,
              cursor: importText.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}>Parse</button>
          </div>

          {/* Parse result */}
          {parseResult && (
            <div style={{ marginTop: 14 }}>
              {parseResult.errors.length > 0 && (
                <div style={{ background: '#e74c3c22', border: '1px solid #e74c3c55', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <strong style={{ color: '#e74c3c', fontSize: 13 }}>⚠️ {parseResult.errors.length} parse error(s):</strong>
                  {parseResult.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#e74c3c', marginTop: 4 }}>{e}</div>)}
                </div>
              )}
              {parseResult.items.length > 0 && (
                <div style={{ background: '#2ecc7122', border: '1px solid #2ecc7155', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <strong style={{ color: '#2ecc71', fontSize: 13 }}>✓ {parseResult.items.length} word(s) ready to import</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {parseResult.items.slice(0, 12).map(v => (
                      <span key={v.id} style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                        borderRadius: 6, padding: '3px 8px', fontSize: 12,
                      }}>{v.word} → {v.meaning}</span>
                    ))}
                    {parseResult.items.length > 12 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>+{parseResult.items.length - 12} more</span>}
                  </div>
                </div>
              )}
              <button
                onClick={handleImport}
                disabled={parseResult.items.length === 0}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: parseResult.items.length > 0 ? 'var(--accent-color, #F5A623)' : 'var(--bg-secondary)',
                  color: parseResult.items.length > 0 ? '#000' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: 14, cursor: parseResult.items.length > 0 ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {importMode === 'replace' ? '⚠️ Replace Bank' : `+ Add ${parseResult.items.length} Words`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── GAMES PREVIEW PANEL ────────────────────────────────────────── */}
      {panel === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            {
              icon: '🃏', title: 'Memory Flip',
              desc: 'Matches word ↔ meaning pairs. Uses any word with both word + meaning.',
              count: preview.flippable.length,
              min: 4,
              items: preview.flippable,
            },
            {
              icon: '🔊', title: 'Listening Quiz',
              desc: 'TTS speaks the word, you pick the meaning. Same pool as Memory Flip.',
              count: preview.listening.length,
              min: 4,
              items: preview.listening,
            },
            {
              icon: '📝', title: 'Sentence Builder',
              desc: 'Uses entries that have both an "example" (JP) and "exampleEn" (EN) field.',
              count: preview.grammar.length,
              min: 1,
              items: preview.grammar,
            },
          ].map(g => (
            <div key={g.title} style={{
              background: 'var(--bg-secondary)', borderRadius: 12,
              border: '1px solid var(--border-color)', padding: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{g.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{g.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.desc}</div>
                </div>
                <span style={{
                  marginLeft: 'auto', fontWeight: 700, fontSize: 14,
                  color: g.count >= g.min ? '#2ecc71' : '#e74c3c',
                }}>
                  {g.count} word{g.count !== 1 ? 's' : ''} {g.count < g.min ? `(need ${g.min})` : '✓'}
                </span>
              </div>
              {g.count === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No words available — import some or they'll use default Nakama 1 content.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {g.items.slice(0, 20).map(v => (
                    <span key={v.id} style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                      borderRadius: 6, padding: '2px 8px', fontSize: 12,
                    }}>{v.word}</span>
                  ))}
                  {g.items.length > 20 && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 4px' }}>
                      +{g.items.length - 20} more
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {panel === 'ai-import' && (
        <ToolErrorBoundary toolName="AI Import">
          <AiImportPanel bank={bank} onSave={onSave} />
        </ToolErrorBoundary>
      )}
    </div>
  )
}
