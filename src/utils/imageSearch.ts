/**
 * imageSearch.ts — Multi-source contextual image fetching for NousPanel
 * Sources: Wikimedia Commons (all subjects), NASA (space)
 * Graceful fallback: returns [] if all sources fail.
 */

export interface ImageResult {
  url: string
  title?: string
  source: 'wikimedia' | 'nasa'
}

type SubjectCategory = 'biology' | 'medicine' | 'space' | 'physics' | 'japanese' | 'general'

/* ── Keyword extraction ─────────────────────────────────── */

const STRIP_PATTERNS = [
  /^(what is|what are|how does|how do|explain|tell me about|describe|why does|why do|what causes|how to)\s+/i,
]
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'on', 'to', 'for', 'is', 'are', 'was', 'were', 'be', 'been'])

export function extractKeyword(text: string): string {
  let s = text.trim().toLowerCase().replace(/[?!.,;:]/g, '')
  for (const pattern of STRIP_PATTERNS) {
    s = s.replace(pattern, '')
  }
  const words = s.split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w))
  return words.slice(0, 3).join(' ') || s.split(/\s+/).slice(0, 3).join(' ')
}

/* ── Subject detection ──────────────────────────────────── */

const SUBJECT_KEYWORDS: Record<SubjectCategory, string[]> = {
  biology: ['biology', 'genetics', 'cell', 'dna', 'rna', 'evolution', 'organism', 'species', 'chromosome', 'protein', 'enzyme', 'mitosis', 'meiosis', 'photosynthesis', 'krebs', 'transcription', 'ribosome', 'organelle', 'prokaryote', 'eukaryote', 'ecosystem', 'taxonomy'],
  medicine: ['medicine', 'medical', 'anatomy', 'pharmacology', 'drug', 'disease', 'neuron', 'synapse', 'diagnosis', 'pathology', 'surgery', 'cardiovascular', 'immune', 'vaccine', 'cancer', 'bacteria', 'virus', 'infection', 'therapy', 'clinical'],
  space: ['space', 'nasa', 'galaxy', 'orbit', 'star', 'cosmos', 'black hole', 'nebula', 'asteroid', 'telescope', 'planet', 'solar', 'comet', 'supernova', 'astrophysics', 'universe', 'exoplanet', 'quasar', 'dark matter'],
  physics: ['physics', 'circuit', 'resistor', 'capacitor', 'force', 'newton', 'wave', 'optics', 'electromagnetic', 'velocity', 'acceleration', 'torque', 'momentum', 'kinetic', 'potential', 'voltage', 'current', 'magnetic', 'quantum', 'thermodynamics', 'entropy'],
  japanese: ['japanese', 'kanji', 'hiragana', 'katakana', 'vocab', 'jlpt', 'conjugation', 'particle', '日本語', 'て-form', 'てform', 'verb form', 'grammar', 'keigo', 'furigana'],
  general: [],
}

export function detectSubjectCategory(userText: string, assistantText: string): SubjectCategory {
  // Check user's question first — more reliable signal than the AI response,
  // which often contains course names (e.g. "Evolution") that pollute detection.
  const userLower = userText.toLowerCase()
  for (const category of ['biology', 'medicine', 'space', 'physics', 'japanese'] as SubjectCategory[]) {
    if (SUBJECT_KEYWORDS[category].some(kw => userLower.includes(kw))) {
      return category
    }
  }
  // Fallback: scan assistant text for category signals
  const assistantLower = assistantText.toLowerCase()
  for (const category of ['biology', 'medicine', 'space', 'physics', 'japanese'] as SubjectCategory[]) {
    if (SUBJECT_KEYWORDS[category].some(kw => assistantLower.includes(kw))) {
      return category
    }
  }
  return 'general'
}

/* ── Fetch: Wikimedia Commons ───────────────────────────── */

async function fetchWikimedia(keyword: string): Promise<ImageResult[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(keyword)}&prop=pageimages&piprop=original&format=json&origin=*&gsrlimit=5`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const pages = data?.query?.pages
  if (!pages) return []
  const results: ImageResult[] = Object.values(pages)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.original?.source && !p.original.source.toLowerCase().endsWith('.svg'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({ url: p.original.source as string, title: p.title as string, source: 'wikimedia' as const }))
    .slice(0, 3)
  // Retry with first word if no results
  if (results.length === 0) {
    const firstWord = keyword.split(' ')[0]
    if (firstWord && firstWord !== keyword) {
      return fetchWikimediaDirect(firstWord)
    }
  }
  return results
}

async function fetchWikimediaDirect(keyword: string): Promise<ImageResult[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(keyword)}&prop=pageimages&piprop=original&format=json&origin=*&gsrlimit=5`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const pages = data?.query?.pages
  if (!pages) return []
  return Object.values(pages)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.original?.source && !p.original.source.toLowerCase().endsWith('.svg'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({ url: p.original.source as string, title: p.title as string, source: 'wikimedia' as const }))
    .slice(0, 3)
}

/* ── Fetch: NASA Image Library ──────────────────────────── */

async function fetchNASA(keyword: string): Promise<ImageResult[]> {
  const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(keyword)}&media_type=image`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const items = data?.collection?.items
  if (!items?.length) {
    // Retry with first word
    const firstWord = keyword.split(' ')[0]
    if (firstWord && firstWord !== keyword) {
      return fetchNASADirect(firstWord)
    }
    return []
  }
  return items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item: any) => item.links?.[0]?.href && !item.links[0].href.toLowerCase().endsWith('.svg'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item: any) => ({ url: item.links[0].href as string, title: item.data?.[0]?.title as string | undefined, source: 'nasa' as const }))
    .slice(0, 3)
}

async function fetchNASADirect(keyword: string): Promise<ImageResult[]> {
  const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(keyword)}&media_type=image`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const items = data?.collection?.items
  if (!items?.length) return []
  return items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item: any) => item.links?.[0]?.href && !item.links[0].href.toLowerCase().endsWith('.svg'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item: any) => ({ url: item.links[0].href as string, title: item.data?.[0]?.title as string | undefined, source: 'nasa' as const }))
    .slice(0, 3)
}

/* ── Main export ────────────────────────────────────────── */

export async function fetchRelevantImages(userText: string, assistantText: string): Promise<ImageResult[]> {
  const category = detectSubjectCategory(userText, assistantText)
  const baseKeyword = extractKeyword(userText)

  // Subject-specific keyword tweaks for better image results
  const keyword = category === 'medicine' ? baseKeyword + ' anatomy' :
                  category === 'space' ? baseKeyword + ' space' :
                  baseKeyword

  let results: ImageResult[] = []

  // NASA first for space topics
  if (category === 'space') {
    results = await fetchNASA(keyword).catch(() => [])
  }

  // Wikimedia as primary (non-space) or fallback (space with < 3 results)
  if (results.length < 3) {
    const wiki = await fetchWikimedia(keyword).catch(() => [])
    results = [...results, ...wiki]
  }

  // Dedup by URL
  const seen = new Set<string>()
  return results
    .filter(r => seen.has(r.url) ? false : (seen.add(r.url), true))
    .slice(0, 3)
}
