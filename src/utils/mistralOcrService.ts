/**
 * mistralOcrService.ts
 * Unified OCR service using Mistral Direct API (https://api.mistral.ai/v1/ocr).
 * Replaces pdfOcrService.ts — handles both PDFs and images.
 *
 * Used by:
 *   - PdfUploaderTool    → pdfToCards()      full OCR + flashcard generation pipeline
 *   - OcrTool            → runMistralOcr()   extract text from image/PDF
 *   - PhysicsAiImport    → runMistralOcr()   extract text from image/PDF
 */

import { callAI, getConfigForSlot } from './ai'
import type { PdfCard } from '../types'

// ─── Constants ───────────────────────────────────────────────────────────────

const WARN_BYTES      = 30 * 1024 * 1024   // 30 MB — warn but still proceed
const MAX_BYTES       = 50 * 1024 * 1024   // 50 MB — hard block
const OCR_TIMEOUT_MS  = 180_000            // 3 min — Mistral OCR on large PDFs is slow
const CARD_TIMEOUT_MS =  60_000            // 1 min — card generation call
const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr'

// ─── Progress types ───────────────────────────────────────────────────────────

export type OcrStage = 'reading' | 'ocr' | 'generating' | 'done'

export interface OcrProgress {
  stage: OcrStage
  message: string
}

export interface PdfOcrResult {
  /** Raw OCR output — markdown with LaTeX equations */
  markdown: string
  /** Parsed quiz cards ready to convert to FlashcardItems */
  cards: PdfCard[]
  /** Set when file is 30–50 MB; display to user before/during processing */
  sizeWarning?: string
}

// ─── Key resolution ───────────────────────────────────────────────────────────

// Mistral OCR requires a Mistral API key — no other provider's key works here.
function getMistralKey(): string {
  // 1. OCR slot configured with Mistral
  const slotProvider = localStorage.getItem('nousai-ai-slot-ocr-provider') || ''
  const slotKey = localStorage.getItem('nousai-ai-slot-ocr-apikey') || ''
  if (slotProvider === 'mistral' && slotKey) return slotKey

  // 2. Global default set to Mistral
  const provider = localStorage.getItem('nousai-ai-provider')
  if (provider === 'mistral') {
    const key = localStorage.getItem('nousai-ai-apikey') || ''
    if (key) return key
  }

  // 3. Build-time env variable (VITE_MISTRAL_API_KEY in .env)
  const envKey = (import.meta.env.VITE_MISTRAL_API_KEY as string | undefined) || ''
  if (envKey) return envKey

  throw new Error(
    'Mistral API key not found. Set VITE_MISTRAL_API_KEY in your .env file, ' +
    'or go to Settings → AI Providers → PDF & Image OCR and select Mistral.',
  )
}

// ─── File → data URL ──────────────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      if (!result) reject(new Error('Failed to encode file'))
      else resolve(result)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ─── Mistral OCR fetch ────────────────────────────────────────────────────────

async function fetchMistralOcr(
  apiKey: string,
  dataUrl: string,
  mimeType: string,
  timeoutMs: number,
): Promise<string> {
  const isPdf = mimeType === 'application/pdf'
  const document = isPdf
    ? { type: 'document_url', document_url: dataUrl }
    : { type: 'image_url', image_url: dataUrl }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(MISTRAL_OCR_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'mistral-ocr-latest', document, include_image_base64: false }),
      signal: controller.signal,
    })
  } catch (e: unknown) {
    clearTimeout(timer)
    if ((e as { name?: string })?.name === 'AbortError') {
      throw new Error('OCR request timed out. Try a smaller file or check your connection.')
    }
    throw e
  }

  if (!res.ok) {
    clearTimeout(timer)
    const err = await res.json().catch(() => null) as { message?: string } | null
    if (res.status === 401) throw new Error('Invalid Mistral API key — check Settings → AI Providers → PDF & Image OCR.')
    if (res.status === 429) throw new Error('Mistral rate limit reached. Please wait a moment and try again.')
    throw new Error(err?.message || `Mistral OCR failed (HTTP ${res.status})`)
  }

  let data: { pages?: Array<{ markdown: string }> }
  try {
    data = await res.json()
  } catch (e: unknown) {
    clearTimeout(timer)
    if ((e as { name?: string })?.name === 'AbortError') {
      throw new Error('OCR timed out reading response. Try a smaller file.')
    }
    throw e
  }
  clearTimeout(timer)

  const markdown = (data.pages ?? []).map(p => p.markdown).join('\n\n')
  return markdown
}

// ─── JSON card extraction (3-tier fallback) ───────────────────────────────────

function parseJsonCards(text: string): PdfCard[] {
  // Tier 1: text is already valid JSON
  try {
    const data = JSON.parse(text.trim())
    if (Array.isArray(data)) return data as PdfCard[]
  } catch { /* continue */ }

  // Tier 2: JSON is inside a ```json ... ``` fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    try {
      const data = JSON.parse(fenceMatch[1].trim())
      if (Array.isArray(data)) return data as PdfCard[]
    } catch { /* continue */ }
  }

  // Tier 3: find first [...] array anywhere in the response
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      const data = JSON.parse(arrayMatch[0])
      if (Array.isArray(data)) return data as PdfCard[]
    } catch { /* continue */ }
  }

  return []
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run OCR on a PDF or image file — returns extracted markdown text.
 * Used by OcrTool and PhysicsAiImport.
 */
export async function runMistralOcr(
  file: File,
  onProgress?: (stage: OcrStage, message: string) => void,
): Promise<string> {
  const apiKey = getMistralKey()
  onProgress?.('reading', 'Reading file…')
  const dataUrl = await fileToDataUrl(file)
  onProgress?.('ocr', 'Running Mistral OCR…')
  return fetchMistralOcr(apiKey, dataUrl, file.type, OCR_TIMEOUT_MS)
}

/**
 * Full pipeline: OCR + flashcard generation.
 * Used by PdfUploaderTool (drop-in replacement for pdfOcrService.pdfToCards).
 */
export async function pdfToCards(
  file: File,
  onProgress: (p: OcrProgress) => void,
): Promise<PdfOcrResult> {
  // ── Size validation ─────────────────────────────────────────────────────
  if (file.size > MAX_BYTES) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
      `Maximum allowed size is 50 MB.`,
    )
  }

  const sizeWarning =
    file.size > WARN_BYTES
      ? `Large file (${(file.size / 1024 / 1024).toFixed(1)} MB) — OCR may take up to 3 minutes.`
      : undefined

  const apiKey = getMistralKey()

  // ── Stage 1: Read file ──────────────────────────────────────────────────
  onProgress({ stage: 'reading', message: 'Reading PDF file...' })
  const fileDataUrl = await fileToDataUrl(file)

  // ── Stage 2: OCR via Mistral Direct ────────────────────────────────────
  onProgress({ stage: 'ocr', message: 'Extracting text, equations and diagrams (Mistral OCR)...' })

  const markdown = await fetchMistralOcr(apiKey, fileDataUrl, 'application/pdf', OCR_TIMEOUT_MS)

  if (!markdown.trim()) {
    throw new Error(
      'OCR returned empty content. The PDF may be blank, password-protected, or ' +
      'could not be processed by Mistral OCR.',
    )
  }

  // ── Stage 3: Generate cards ─────────────────────────────────────────────
  onProgress({ stage: 'generating', message: 'Generating quiz cards from extracted content...' })

  // Trim to ~12 000 chars to keep within context limits for card generation model
  const contentSlice = markdown.length > 12_000
    ? markdown.slice(0, 12_000) + '\n\n[Content truncated — showing first portion]'
    : markdown

  const cardPrompt = `You are a study card generator for a physics/science study app.

Given the OCR-extracted PDF content below (markdown format, with LaTeX equations), generate 10–20 quiz flashcards covering the key concepts.

Output ONLY a valid JSON array with no markdown fences and no surrounding text:
[
  {"question": "What is Newton's second law?", "answer": "$F = ma$ — Force equals mass times acceleration.", "type": "vocab"},
  {"question": "Which equation describes kinetic energy?", "answer": "$E_k = \\frac{1}{2}mv^2$", "type": "mcq", "choices": ["A) $E_k = mv$", "B) $E_k = \\frac{1}{2}mv^2$", "C) $E_k = mgh$", "D) $E_k = Fd$"]}
]

Rules:
- "vocab" cards: question = term/concept, answer = definition/explanation
- "mcq" cards: include exactly 4 choices labeled A) B) C) D) — one must be the correct answer
- Preserve LaTeX in answers when equations are involved (e.g. $F = ma$)
- Cover key definitions, equations, principles, and important facts
- Answers must be concise (1–2 sentences maximum)
- Do not invent facts not present in the content

PDF Content:
${contentSlice}`

  // Use the OCR slot config for card generation (fallback to default if unconfigured)
  const cfg = getConfigForSlot('ocr')
  if (cfg.provider === 'none' || !cfg.apiKey) {
    throw new Error('AI not configured for card generation. Go to Settings → AI Providers → PDF & Image OCR.')
  }

  const cardText = await callAI(
    [{ role: 'user', content: cardPrompt }],
    { temperature: 0.4, maxTokens: 4096 },
    'ocr',
  )

  const cards = parseJsonCards(cardText)

  if (cards.length === 0) {
    throw new Error(
      'Failed to parse quiz cards from the AI response. ' +
      'The model may have returned an unexpected format. Try again.',
    )
  }

  onProgress({ stage: 'done', message: `Generated ${cards.length} cards successfully.` })

  return { markdown, cards, sizeWarning }
}

// Re-export CARD_TIMEOUT_MS for any consumers that need it
export { CARD_TIMEOUT_MS }
