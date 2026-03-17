# Batch Figure Generation — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Generate SVG physics diagrams for all 179 image-less questions via a one-time batch script, then patch them into the live question bank without losing session history.

---

## Problem

248 questions were imported into Physics Practicum. 179 of them have no figure (`questionImageBase64 = null`). Many reference "See Figure X.XX" or describe a physical setup that benefits from a diagram. The textbook figures can't be recovered without expensive full-chapter re-OCR; instead, we generate equivalent setup diagrams from question text only.

**Constraint:** Generated figures must NOT reveal the answer — they show only the physical setup described in the question text.

---

## Approach

**SVG via AI (Option A)**
- Call OpenRouter Gemini Flash for each question → receive SVG code → encode as base64 → store in `questionImageBase64` with `questionImageMime: image/svg+xml`
- SVG slots directly into the existing `<img>` render path in `PhysicsSession.tsx` — zero new display code
- Estimated cost: < $0.05 for all 179 questions
- Each figure cached to disk immediately → re-runs cost $0

---

## Section 1: The Script (`scripts/generate-figures.mjs`)

### Inputs
- `scripts/output/chapter19.json`, `chapter20.json`, `chapter21.json`
- `scripts/output/figures-cache.json` (created on first run, reused forever)

### Processing loop
For each question across all 3 chapter JSONs:
1. Skip if `question.questionImageBase64` already exists (has real OCR image)
2. Skip if `figures-cache.json` has an entry for `question.id` (already generated)
3. Call OpenRouter Gemini Flash with SVG generation prompt — **question text only, no `expectedAnswer`**
4. Extract SVG from response, validate (`<svg` present, length > 100 chars, length < 6000 chars)
5. Encode: `Buffer.from(svgString).toString('base64')`
6. Write to `figures-cache.json` immediately (before moving to next question)
7. Update question object in memory

### SVG prompt contract
```
You are a physics diagram generator. Given a physics question, draw a clean SVG showing ONLY the physical setup — never the answer or solution.

Rules:
- viewBox="0 0 400 300", dark background rect fill="#0f0f0f"
- Strokes: white (#ffffff) for structure, amber (#f59e0b) for key elements/labels
- Font: 13px monospace, fill white
- Show geometry, component symbols, arrows for direction/velocity/field — NO numerical answers
- No solution steps, no calculated values, no "answer" labels
- Keep SVG under 3500 characters
- Return ONLY the SVG element, no markdown fences, no explanation

Question: {questionText}
```

### Outputs
- Updated `scripts/output/chapter19.json`, `chapter20.json`, `chapter21.json` with `questionImageBase64` and `questionImageMime` filled for all previously-blank questions
- `scripts/output/figures-patch.json` — flat array of `{ id, questionImageBase64, questionImageMime }` for every question that received a figure (used by the Patch Figures import tab)
- `scripts/output/figures-cache.json` — keyed by **question ID** (`question.id`), caches the SVG base64 string. Unmatched IDs (not found in bank) are logged to stdout for auditability.

### Failsafes (mirrors `extract-physics.mjs`)
| Failsafe | Behavior |
|----------|----------|
| Per-question cache | Written immediately after each successful generation; re-run skips cached questions |
| `--dry-run` flag | Prints count of questions to process + cost estimate, exits without calling any API |
| 3× retry with backoff | On 429 or 5xx: wait 15s / 30s / fail |
| Skip-if-exists | Questions that already have `questionImageBase64` from OCR are never overwritten |
| SVG validation | If AI returns invalid/empty SVG, logs a warning and leaves that question blank rather than storing garbage |

---

## Section 2: Patch Import Tab

**Why not re-import full JSONs?**
The existing Bulk Import always generates fresh question IDs — re-importing 248 questions creates duplicates and wipes session history (SR intervals, wrong counts, confidence history).

**Solution:** A new "Patch Figures" sub-tab inside Manage Bank → Bulk Import accepts `figures-patch.json`. It matches by `question.id`, updates only `questionImageBase64` and `questionImageMime`, and leaves all other fields untouched.

### File: `src/components/physquiz/PhysicsQuestionEditor.tsx`

Add a `'patch'` option to the existing `bulkTab` state union: `'single' | 'json' | 'manual' | 'patch'`

**Patch tab UI:**
- File upload input accepting `.json`
- On file load: parse array of `{ id, questionImageBase64, questionImageMime }`
- Preview: "X figures found — Y questions matched in bank"
- "Apply Patch" button: iterates existing questions, applies matching figures, calls `updateBankQuestions()`
- Success toast: "X figures applied"

### Data flow
```
figures-patch.json
  → parse [{id, questionImageBase64, questionImageMime}]
  → build Map<id, figureData>
  → preview step: show "X matched, Y unmatched (IDs not found — skipped silently)"
  → user clicks "Apply Patch (X)" to confirm
  → for each question in bank: if map.has(q.id) → merge image fields only
  → updatePluginData({ physicsQuiz: { ...existing, questions: updatedQuestions } })
```

**Unmatched IDs:** If a patch entry ID doesn't match any question in the bank, it is silently skipped. The preview step shows the unmatched count so the user can investigate before applying.

**Rollback:** The patch tab shows a preview (matched count, sample question titles) before any write. This acts as a dry-run gate. No auto-rollback after apply — but since only image fields are touched, the worst case is running the patch again or clearing the field in the question editor.

### TypeScript note
`bulkTab` state union must be extended: `'single' | 'json' | 'manual' | 'patch'`. Failure to update this union causes a TypeScript compile error.

### SVG rendering
SVGs are rendered via `data:image/svg+xml;base64,{b64}` in the existing `<img>` tag — this works in all modern browsers. The MIME string stored on the question is exactly `"image/svg+xml"`.

### Storage size check
179 SVGs × ~3500 chars avg ≈ 625 KB raw. SVG is highly repetitive XML — pako gzip compression (already used for Firestore sync) reduces this to ~80–120 KB. Total data with existing 1.85 MB → gzip ~0.4 MB + ~0.1 MB figures ≈ 0.5 MB compressed, well under the 1 MB Firestore document limit. Verify actual compressed size after generation before syncing to cloud.

---

## Section 3: End-to-End User Flow

```
1. node scripts/generate-figures.mjs --dry-run
   → prints: "179 questions to process | estimated cost: ~$0.01 | 0 cached"

2. node scripts/generate-figures.mjs
   → generates figures one by one, caches each
   → writes updated chapter JSONs + figures-patch.json
   → prints: "✅ 179 figures generated | 0 errors | $0.00 to re-run"

3. Open https://nousai-app.vercel.app
   → Physics Practicum → Manage Bank → Bulk Import → Patch Figures tab
   → Upload figures-patch.json → click "Apply Patch (179)"
   → Toast: "179 figures applied"

4. Start any practice session — figures appear instantly in every question
   No API call during study, no wait, works offline
```

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/generate-figures.mjs` | New script |
| `scripts/output/figures-patch.json` | Generated output (gitignored) |
| `scripts/output/figures-cache.json` | Generated cache (gitignored) |
| `src/components/physquiz/PhysicsQuestionEditor.tsx` | Add `patch` tab to Bulk Import |

---

## Out of Scope

- Generating interactive/animated diagrams (that's the Labs feature)
- Updating figures when question text changes (manual re-run covers this)
- Generating figures for questions that already have OCR-extracted images
