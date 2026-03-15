import { useState, useCallback, useRef, useEffect } from 'react'
import type { VocabBankItem, VocabCategory } from './types'
import { CATEGORY_LABELS } from '../../data/jpVocabBank'
import { callAI, isAIConfigured } from '../../utils/ai'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiWord {
  word: string
  reading: string
  meaning: string
  category: VocabCategory | string  // may be invalid from AI — validated on use
}

interface AiSentence {
  jp: string   // space-tokenized, no trailing 。
  en: string
}

interface AiResult {
  input: string
  type: 'word' | 'sentence'
  words: AiWord[]
  sentence?: AiSentence
}

interface PreviewWord extends AiWord {
  id: string
  isDuplicate: boolean
  included: boolean
  categoryValid: boolean
}

interface PreviewSentence {
  jp: string
  en: string
  isDuplicate: boolean
  included: boolean
}

interface ParsedPreview {
  input: string
  type: 'word' | 'sentence'
  words: PreviewWord[]
  sentence?: PreviewSentence
  warning?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set<VocabCategory>([
  'noun','verbal-noun','pronoun','demonstrative',
  'verb-u','verb-ru','verb-irregular',
  'i-adj','na-adj','adverb','particle',
  'conjunction','interjection','question-word',
  'counter','grammar','other',
])

const AI_SYSTEM_PROMPT = `You are a Japanese language analyzer. Given a list of Japanese words or sentences, analyze each one and return a JSON array.

Rules:
- For each input line, detect whether it is a single word/particle/expression ("word") or a full sentence ("sentence").
- For words: identify the hiragana reading, English meaning, and grammatical category.
- For sentences: extract each constituent word with its reading, meaning, and category, AND provide the full sentence tokenized with a half-width ASCII space between each token (words, particles, and verb endings separated). Do NOT include trailing punctuation like 。 in the jp field.
- Category must be exactly one of: noun, verbal-noun, pronoun, demonstrative, verb-u, verb-ru, verb-irregular, i-adj, na-adj, adverb, particle, conjunction, interjection, question-word, counter, grammar, other
- Return ONLY a valid JSON array. No markdown, no code fences, no explanation.

JSON schema (return an array of these objects):
[
  {
    "input": "<original input line>",
    "type": "word",
    "words": [
      { "word": "<JP>", "reading": "<hiragana>", "meaning": "<EN>", "category": "<category>" }
    ]
  },
  {
    "input": "<original sentence>",
    "type": "sentence",
    "words": [
      { "word": "<JP token>", "reading": "<hiragana>", "meaning": "<EN>", "category": "<category>" }
    ],
    "sentence": {
      "jp": "<space-tokenized hiragana/kana, no trailing 。>",
      "en": "<English translation>"
    }
  }
]`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeSentenceJp(jp: string): string {
  return jp.replace(/。$/, '').trim()
}

function buildPreview(results: AiResult[], bank: VocabBankItem[]): ParsedPreview[] {
  const bankWords = new Set(bank.map(b => b.word))

  return results.map(r => {
    const words: PreviewWord[] = (r.words ?? []).map((w, i) => ({
      ...w,
      id: `${r.input}-${i}`,
      isDuplicate: bankWords.has(w.word),
      included: true,
      categoryValid: (VALID_CATEGORIES as Set<string>).has(w.category),
    }))

    let sentence: PreviewSentence | undefined
    if (r.type === 'sentence' && r.sentence) {
      const jp = sanitizeSentenceJp(r.sentence.jp)
      sentence = {
        jp,
        en: r.sentence.en,
        isDuplicate: bankWords.has(jp),
        included: true,
      }
    }

    let warning: string | undefined
    if (r.type === 'word' && words.length === 0) {
      warning = `No words extracted for: ${r.input}`
    }
    if (r.type === 'sentence' && !r.sentence) {
      warning = `No sentence data returned for: ${r.input}`
    }

    return { input: r.input, type: r.type, words, sentence, warning }
  })
}

function previewToItems(preview: ParsedPreview[]): VocabBankItem[] {
  const items: VocabBankItem[] = []
  for (const p of preview) {
    for (const w of p.words) {
      if (!w.included) continue
      const category: VocabCategory = (VALID_CATEGORIES as Set<string>).has(w.category)
        ? (w.category as VocabCategory)
        : 'other'
      items.push({
        id: crypto.randomUUID(),
        word: w.word,
        reading: w.reading || undefined,
        meaning: w.meaning,
        category,
        source: 'custom',
      })
    }
    if (p.sentence?.included) {
      const jp = sanitizeSentenceJp(p.sentence.jp)
      items.push({
        id: crypto.randomUUID(),
        word: jp,
        meaning: p.sentence.en,
        category: 'grammar',
        example: jp,
        exampleEn: p.sentence.en,
        source: 'custom',
      })
    }
  }
  return items
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const,
  },
  btn: (primary?: boolean, disabled?: boolean) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
    background: disabled ? 'var(--bg-secondary)' : primary ? 'var(--accent-color, #F5A623)' : 'var(--bg-secondary)',
    color: disabled ? 'var(--text-muted)' : primary ? '#000' : 'var(--text-primary)',
    opacity: disabled ? 0.5 : 1,
  }),
  tag: (color: string) => ({
    background: color + '22', color, border: `1px solid ${color}55`,
    borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600,
    fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' as const,
  }),
  row: (highlight?: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
    borderRadius: 8, marginBottom: 4,
    background: highlight ? '#F5A62322' : 'var(--bg-secondary)',
    border: highlight ? '1px solid #F5A62355' : '1px solid var(--border-color)',
    flexWrap: 'wrap' as const,
  }),
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategorySelect({ value, onChange }: { value: string; onChange: (v: VocabCategory) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as VocabCategory)}
      style={{ ...s.input, width: 'auto', padding: '4px 8px', fontSize: 12 }}
    >
      {(Object.entries(CATEGORY_LABELS) as [VocabCategory, string][]).map(([k, label]) => (
        <option key={k} value={k}>{label}</option>
      ))}
    </select>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  bank: VocabBankItem[]
  onSave: (updated: VocabBankItem[]) => void
}

type Mode = 'single' | 'bulk'

export default function AiImportPanel({ bank, onSave }: Props) {
  const [mode, setMode] = useState<Mode>('single')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedPreview[] | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const aiReady = isAIConfigured()

  useEffect(() => () => { if (successTimerRef.current) clearTimeout(successTimerRef.current) }, [])

  const analyze = useCallback(async () => {
    const lines = input.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const raw = await callAI([
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: lines.join('\n') },
      ], { json: true })

      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      let parsed: AiResult[]
      try {
        parsed = JSON.parse(clean)
        if (!Array.isArray(parsed)) throw new Error('Expected JSON array')
      } catch {
        setError('Could not parse AI response — try again or rephrase your input.')
        return
      }
      setPreview(buildPreview(parsed, bank))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [input, bank])

  const toggleWord = useCallback((inputStr: string, wordId: string) => {
    setPreview(prev => prev?.map(p =>
      p.input === inputStr
        ? { ...p, words: p.words.map(w => w.id === wordId ? { ...w, included: !w.included } : w) }
        : p
    ) ?? null)
  }, [])

  const toggleSentence = useCallback((inputStr: string) => {
    setPreview(prev => prev?.map(p =>
      p.input === inputStr && p.sentence
        ? { ...p, sentence: { ...p.sentence, included: !p.sentence.included } }
        : p
    ) ?? null)
  }, [])

  const updateWordField = useCallback((inputStr: string, wordId: string, field: keyof AiWord, value: string) => {
    setPreview(prev => prev?.map(p =>
      p.input === inputStr
        ? {
            ...p,
            words: p.words.map(w => {
              if (w.id !== wordId) return w
              const updated = { ...w, [field]: value }
              if (field === 'category') {
                updated.categoryValid = (VALID_CATEGORIES as Set<string>).has(value)
              }
              return updated
            }),
          }
        : p
    ) ?? null)
  }, [])

  const updateSentenceField = useCallback((inputStr: string, field: 'jp' | 'en', value: string) => {
    setPreview(prev => prev?.map(p =>
      p.input === inputStr && p.sentence
        ? { ...p, sentence: { ...p.sentence, [field]: value } }
        : p
    ) ?? null)
  }, [])

  const addToBank = useCallback(() => {
    if (!preview) return
    const newItems = previewToItems(preview)
    if (newItems.length === 0) return

    const merged = [...bank]
    for (const item of newItems) {
      const idx = merged.findIndex(b => b.word === item.word)
      if (idx >= 0) merged[idx] = item
      else merged.push(item)
    }
    onSave(merged)

    const wordCount = newItems.filter(i => i.category !== 'grammar').length
    const sentCount = newItems.filter(i => i.category === 'grammar').length
    const parts = []
    if (wordCount > 0) parts.push(`${wordCount} word${wordCount !== 1 ? 's' : ''}`)
    if (sentCount > 0) parts.push(`${sentCount} sentence${sentCount !== 1 ? 's' : ''}`)
    setSuccessMsg(`Added ${parts.join(' + ')} to bank`)
    setInput('')
    setPreview(null)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setSuccessMsg(null), 3000)
  }, [preview, bank, onSave])

  const modeBtn = (m: Mode, label: string) => (
    <button
      onClick={() => { setMode(m); setPreview(null); setError(null) }}
      style={{
        padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer',
        fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
        background: mode === m ? 'var(--accent-color, #F5A623)' : 'var(--bg-secondary)',
        color: mode === m ? '#000' : 'var(--text-primary)',
      }}
    >{label}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', gap: 8 }}>
        {modeBtn('single', '✏️ Single Entry')}
        {modeBtn('bulk',   '📋 Bulk Paste')}
      </div>

      {!aiReady && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, background: '#ff572222',
          border: '1px solid #ff572255', color: 'var(--text-primary)', fontSize: 13,
        }}>
          No AI provider configured. Go to <strong>Settings → AI</strong> to add your API key.
        </div>
      )}

      {mode === 'single' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Type or paste a Japanese word or sentence:
          </label>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !loading && aiReady) analyze() }}
            placeholder="e.g. たべる  or  毎日カフェに行きます"
            lang="ja"
            style={s.input}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            One word or sentence per line:
          </label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={'たべる\n飲む\n毎日カフェに行きます\nきれい'}
            rows={6}
            lang="ja"
            style={{ ...s.input, resize: 'vertical' }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={analyze}
          disabled={!aiReady || loading || !input.trim()}
          style={s.btn(true, !aiReady || loading || !input.trim())}
        >
          {loading ? '⏳ Analyzing…' : '🔍 Analyze'}
        </button>
        {successMsg && (
          <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 600 }}>✓ {successMsg}</span>
        )}
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, background: '#ff572222',
          border: '1px solid #ff572255', color: '#ff9999', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {preview && (
        <PreviewSection
          preview={preview}
          onToggleWord={toggleWord}
          onToggleSentence={toggleSentence}
          onUpdateWordField={updateWordField}
          onUpdateSentenceField={updateSentenceField}
          onAddToBank={addToBank}
        />
      )}
    </div>
  )
}

// ─── Preview Section ──────────────────────────────────────────────────────────

interface PreviewSectionProps {
  preview: ParsedPreview[]
  onToggleWord: (input: string, wordId: string) => void
  onToggleSentence: (input: string) => void
  onUpdateWordField: (input: string, wordId: string, field: keyof AiWord, value: string) => void
  onUpdateSentenceField: (input: string, field: 'jp' | 'en', value: string) => void
  onAddToBank: () => void
}

function PreviewSection({
  preview, onToggleWord, onToggleSentence,
  onUpdateWordField, onUpdateSentenceField, onAddToBank,
}: PreviewSectionProps) {
  const totalSelected = preview.reduce((n, p) => {
    return n + p.words.filter(w => w.included).length + (p.sentence?.included ? 1 : 0)
  }, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Preview — {totalSelected} item{totalSelected !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onAddToBank}
          disabled={totalSelected === 0}
          style={s.btn(true, totalSelected === 0)}
        >
          ✅ Add {totalSelected} to Bank
        </button>
      </div>

      {preview.map((p, i) => (
        <div key={`${i}-${p.input}`} style={{
          border: '1px solid var(--border-color)', borderRadius: 10,
          padding: '12px 14px', background: 'var(--bg-tertiary, var(--bg-secondary))',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'DM Mono, monospace' }}>
            Input: {p.input}
          </div>

          {p.warning && (
            <div style={{ fontSize: 12, color: '#F5A623', marginBottom: 8 }}>⚠️ {p.warning}</div>
          )}

          {p.sentence && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F5A623', marginBottom: 6 }}>
                📝 Sentence Entry (for Sentence Builder game)
              </div>
              <div style={s.row(p.sentence.isDuplicate)}>
                <input
                  type="checkbox"
                  checked={p.sentence.included}
                  onChange={() => onToggleSentence(p.input)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <input
                    value={p.sentence.jp}
                    onChange={e => onUpdateSentenceField(p.input, 'jp', e.target.value)}
                    lang="ja"
                    style={{ ...s.input, fontSize: 13, padding: '4px 8px' }}
                    placeholder="Space-tokenized Japanese"
                  />
                  <input
                    value={p.sentence.en}
                    onChange={e => onUpdateSentenceField(p.input, 'en', e.target.value)}
                    style={{ ...s.input, fontSize: 13, padding: '4px 8px' }}
                    placeholder="English translation"
                  />
                </div>
                {p.sentence.isDuplicate && (
                  <span style={s.tag('#F5A623')}>already in bank</span>
                )}
              </div>
            </div>
          )}

          {p.words.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                {p.type === 'sentence' ? '🔤 Individual Words' : '🔤 Word'}
              </div>
              {p.words.map(w => (
                <div key={w.id} style={s.row(w.isDuplicate)}>
                  <input
                    type="checkbox"
                    checked={w.included}
                    onChange={() => onToggleWord(p.input, w.id)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <input
                    value={w.word}
                    onChange={e => onUpdateWordField(p.input, w.id, 'word', e.target.value)}
                    lang="ja"
                    style={{ ...s.input, width: 90, padding: '4px 8px', fontSize: 13 }}
                    placeholder="Japanese"
                  />
                  <input
                    value={w.reading}
                    onChange={e => onUpdateWordField(p.input, w.id, 'reading', e.target.value)}
                    lang="ja"
                    style={{ ...s.input, width: 90, padding: '4px 8px', fontSize: 13 }}
                    placeholder="Reading"
                  />
                  <input
                    value={w.meaning}
                    onChange={e => onUpdateWordField(p.input, w.id, 'meaning', e.target.value)}
                    style={{ ...s.input, flex: 1, minWidth: 100, padding: '4px 8px', fontSize: 13 }}
                    placeholder="English meaning"
                  />
                  <CategorySelect
                    value={w.category}
                    onChange={v => onUpdateWordField(p.input, w.id, 'category', v)}
                  />
                  {!w.categoryValid && (
                    <span style={s.tag('#F5A623')}>check category</span>
                  )}
                  {w.isDuplicate && (
                    <span style={s.tag('#F5A623')}>exists</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
