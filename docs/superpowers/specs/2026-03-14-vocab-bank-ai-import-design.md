# Vocab Bank AI Import & English Labels — Design Spec
**Date**: 2026-03-14
**Status**: Approved by user

---

## Overview

Three connected improvements to the NousAI Japanese Vocab Bank:

1. **AI Import Tab** — paste words/sentences and have AI analyze, classify, and add them to the vocab bank
2. **English Category Labels** — filter buttons AND category badges show both Japanese and English
3. **Sentence Vocab Bank Logic** — correct handling of Japanese sentences so Sentence Builder game works properly

---

## Feature 1: English Category Labels

### Problem
The filter buttons in `VocabBankTab.tsx` call `.split(' ')[0]` on the `CATEGORY_LABELS` value, stripping the English portion. The `CatBadge` component (line 97) does the same. Result: only Japanese shows everywhere.

### Solution
Remove the `.split(' ')[0]` truncation in both the filter button render (line 248) and in `CatBadge`. Use the full `CATEGORY_LABELS` value directly.

**Filter buttons before**: `名詞 (20)`
**Filter buttons after**: `名詞 Noun (20)`

**Category badges before**: `名詞`
**Category badges after**: `名詞 Noun`

### Implementation Note
Both the filter button render (line 248) and the `CatBadge` component (line 97) in `VocabBankTab.tsx` contain `.split(' ')[0]` calls that must be removed. These are in the **same file** as the 4th tab addition — fix them as part of the same PR.

Note: Some labels like `'する-Verb Noun'` and `'文法 Grammar Pattern'` contain multiple words — `.split(' ')[0]` would truncate them to `'する-Verb'` and `'文法'` respectively. The fix (removing the split entirely) correctly shows the full label for all 17 categories.

### Files Affected
- `src/components/jpquiz/VocabBankTab.tsx` — two locations: filter button render (line 248) + CatBadge component (line 97)

---

## Feature 2: AI Import Tab

### Architecture
Add a 4th tab "✨ AI Import" to the Vocab Bank panel (alongside Bank / Import / Games Preview).

### Two Modes

#### Single Entry Mode
- Text input: "Type or paste a Japanese word or sentence..."
- "Analyze" button (disabled with tooltip "Configure an AI provider in Settings" if no AI key set)
- "Analyzing..." spinner replaces button text while AI call is in flight
- On success: renders preview below

**If word detected**: one editable row with fields — word (JP), reading, meaning, category dropdown, notes — plus "Add to Bank" button. After clicking "Add to Bank": form resets to empty, inline success message "Added [word] to bank" for 2 seconds.

**If sentence detected**: two result blocks:
1. **Sentence entry block**: shows editable JP (space-tokenized) + EN fields → stored as `category: 'grammar'` entry → feeds Sentence Builder game
2. **Word breakdown table**: each extracted word as a row (word, reading, meaning, category badge — all editable), checkbox per row — duplicates highlighted yellow with "exists" badge → "Add Selected to Bank"

After adding: form resets, success message shows count added.

#### Bulk Paste Mode
- Textarea: "One word or sentence per line..."
- "Analyze All" button (same disabled/loading states as single entry)
- On success: scrollable preview table, one result block per input line, checkboxes (all checked by default)
- Duplicate words (exact `word` field match, case-sensitive) highlighted yellow with "already in bank" badge — user can uncheck to skip or leave checked to overwrite
- "Add Selected to Bank" confirms all checked items

### Duplicate Detection Rule
A duplicate is defined as an existing bank entry where `existingItem.word === proposedItem.word` (exact string, case-sensitive). When a duplicate is detected: highlight the row yellow, show "already in bank" badge, leave the checkbox checked so user must actively uncheck to skip.

### AI Prompt Contract

The AI is called with a structured system prompt + user message. Use `callAI(messages, { json: true })` — the `json: true` option enables JSON mode on providers that support it and instructs the model to return raw JSON without markdown fences.

**System prompt**:
```
You are a Japanese language analyzer. Given a list of Japanese words or sentences, analyze each one and return a JSON array.

Rules:
- For each input, detect whether it is a single word/particle/expression ("word") or a full sentence ("sentence").
- For words: identify reading (hiragana), English meaning, and grammatical category.
- For sentences: extract each constituent word with its reading, meaning, and category, AND provide the full sentence tokenized with a half-width ASCII space between each token (words, particles, and verb endings separated). Do NOT include trailing punctuation like 。in the jp field.
- Category must be exactly one of: noun, verbal-noun, pronoun, demonstrative, verb-u, verb-ru, verb-irregular, i-adj, na-adj, adverb, particle, conjunction, interjection, question-word, counter, grammar, other
- Return ONLY a valid JSON array. No markdown, no code fences, no explanation.

JSON schema:
[
  {
    "input": "<original input line>",
    "type": "word" | "sentence",
    "words": [
      { "word": "<JP>", "reading": "<hiragana>", "meaning": "<EN>", "category": "<category>" }
    ],
    "sentence": {
      "jp": "<space-tokenized hiragana/kana sentence, no trailing 。>",
      "en": "<English translation>"
    }
  }
]
Note: "sentence" key is only present when type is "sentence".
```

**User message**: The raw input lines, one per line.

### AI Response Validation

After parsing the JSON response, validate each entry:

1. If JSON parsing fails (malformed, markdown-wrapped): show inline error "Could not parse AI response — try again or rephrase your input."
2. If `type` is `"word"` but `words` is empty or missing: skip that entry, show warning badge "No words extracted for: [input]"
3. If `type` is `"sentence"` but `sentence` key is absent: treat it as a word-only result (skip sentence entry, still show word breakdown)
4. If a word's `category` is not one of the 17 valid values: default it to `"other"` and add a yellow warning indicator on that row so the user can correct it
5. If `words` contains a particle-only entry (category `"particle"`) with `word` matching `/^[はがをにへでともの]$/`): keep as-is — particles are valid vocab entries

### Sentence Entry Data Shape

Sentence entries stored in the vocab bank use the **Japanese tokenized sentence** as the `word` field — consistent with existing grammar pattern conventions (e.g., existing entries use JP pattern in `word`). English goes in `meaning`:

```typescript
{
  id: crypto.randomUUID(),
  word: 'まいにち カフェ に いきます',     // space-tokenized JP (no 。) — used as primary label in Bank list
  meaning: 'I go to the cafe every day.',    // English translation
  category: 'grammar',
  example: 'まいにち カフェ に いきます',   // same as word — Sentence Builder splits this
  exampleEn: 'I go to the cafe every day.',
  reading: undefined,                         // no reading field for grammar entries
  source: 'custom'
}
```

**Convention note**: Existing grammar entries use `word` for a JP formula/pattern (e.g. `'Xは Y です'`) while `example` holds a full usage sentence. AI-imported sentence entries deviate from this: both `word` and `example` hold the same space-tokenized sentence. This is intentional — AI imports produce real sentences, not formula patterns — and is documented here explicitly so future maintainers are not confused. The `word` field is used as the primary display label in the Bank list, so showing the JP sentence there is the most readable choice.

**Game behavior**: Entries with `category: 'grammar'` are intentionally excluded from Memory Flip and Listening Quiz (both filter `v.category !== 'grammar'`). Sentence entries appear only in Sentence Builder. This is correct — full sentences don't suit card-flip or listening games, and users should not expect AI-imported sentences to appear in those games.

**Sentence Builder compatibility**: `SentenceBuilderGame.tsx` already strips trailing `。` via `.replace(/。$/, '')` before splitting. AI prompt instructs model to omit trailing punctuation from `sentence.jp`. Frontend also strips it as a safety measure before storing.

### Games Preview Behavior
Sentence entries with `category: 'grammar'` and both `example` + `exampleEn` populated will correctly appear in the Sentence Builder count in the Games Preview panel (the existing filter `bank.filter(v => v.example && v.exampleEn)` catches them regardless of category). This is the intended behavior.

### No AI Provider State
When `isAIConfigured()` returns false:
- "Analyze" / "Analyze All" button is disabled and grayed out
- Inline message below input: "No AI provider configured. Go to Settings → AI to add your API key."

### Files Affected
- `src/components/jpquiz/VocabBankTab.tsx` — add 4th tab
- `src/components/jpquiz/AiImportPanel.tsx` — new component (single entry + bulk paste modes, validation, preview UI)
- `src/utils/ai.ts` — reuse existing `callAI()` + `isAIConfigured()` — no changes needed

---

## Feature 3: Sentence Vocab Bank Logic Correctness

### Core Rule
The `example` field of any sentence entry **must use half-width ASCII spaces between tokens** because `SentenceBuilderGame.tsx:46` splits on `/\s+/`. Full-width spaces or no spaces produce a single unbreakable tile.

### Enforcement
1. AI prompt explicitly instructs model to output half-width spaces between tokens and omit trailing `。`
2. Frontend applies `.replace(/。$/, '').trim()` to `sentence.jp` before storing (matches existing `initTiles` logic in Sentence Builder)
3. Preview UI displays the tokenized sentence so users can visually verify spacing before confirming

---

## Data Flow

```
User Input (AI Import tab)
    ↓ callAI(messages, { json: true })
AI JSON Response
    ↓ parse + validate (fallback to 'other' for unknown categories)
Preview Table (editable fields, checkboxes, duplicate flags)
    ↓ user confirms
VocabBankItem[] merged into Zustand store
    ↓
    ├→ Words (noun/verb/adj/etc.) → Memory Flip, Listening Quiz
    └→ Sentence entries (grammar category) → Sentence Builder
```

---

## Out of Scope
- Kanji lookup or furigana generation beyond what AI provides
- Automatic deduplication without user confirmation
- Batch importing from external files (covered by existing Import tab)
- Editing existing bank entries via AI (separate feature)
