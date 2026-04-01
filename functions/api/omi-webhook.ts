/**
 * NousAI Omi Webhook — Autonomous Processing Hub
 *
 * Receives POST at /api/omi-webhook?uid={firebaseUID}
 * Returns 200 OK immediately, then runs the full pipeline via waitUntil():
 *   transcript correction → note save → flashcard generation →
 *   vocab extraction → knowledge gap detection → study time tracking
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

interface Env {
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
}

interface OmiMemory {
  id: string
  structured: {
    title: string
    overview: string
    emoji: string
    category: string | null
    action_items: { description: string; completed: boolean }[]
  }
}

interface OmiAutoSettings {
  autoSaveNotes?: boolean
  autoFlashcards?: boolean
  autoVocab?: boolean
  autoGaps?: boolean
  autoVoiceCorrect?: boolean
}

interface SpeechProfile {
  speechDifference?: string
  languages?: string[]
  subjects?: string[]
  name?: string
  customCorrections?: { heard: string; actual: string }[]
}

// ─── Firebase ─────────────────────────────────────────────────────────────────

function getDb(env: Env): ReturnType<typeof getFirestore> {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getFirestore()
}

// ─── OpenRouter helper ────────────────────────────────────────────────────────

async function callAI(prompt: string, apiKey: string, model = 'mistralai/mistral-7b-instruct'): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://studynous.com',
        'X-Title': 'NousAI Study Companion',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.2,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`)
    const data = await res.json() as { choices: { message: { content: string } }[] }
    return data.choices?.[0]?.message?.content?.trim() ?? ''
  } catch (e) {
    clearTimeout(timeout)
    throw e
  }
}

function parseJsonSafely<T>(text: string): T | null {
  try {
    const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0]) as T
  } catch {
    return null
  }
}

// ─── Processors ───────────────────────────────────────────────────────────────

async function correctTranscript(
  firestore: ReturnType<typeof getFirestore>,
  uid: string,
  memory: OmiMemory,
  apiKey: string,
  speechProfile: SpeechProfile,
): Promise<void> {
  try {
    let text = memory.structured.overview || ''
    if (!text) return

    if (speechProfile.customCorrections?.length) {
      for (const { heard, actual } of speechProfile.customCorrections) {
        if (heard && actual) text = text.replace(new RegExp(heard, 'gi'), actual)
      }
    }

    const diffDesc = speechProfile.speechDifference
      ? `Speaker has a ${speechProfile.speechDifference.replace(/_/g, ' ')}.`
      : 'Speaker may have speech-to-text errors.'
    const langDesc = speechProfile.languages?.length
      ? `Speaker uses ${speechProfile.languages.join(' and ')} (preserve non-English words exactly).`
      : ''
    const subjectDesc = speechProfile.subjects?.length
      ? `Context: ${speechProfile.subjects.join(', ')} — expect domain terminology.`
      : ''
    const nameDesc = speechProfile.name ? `Speaker's name is "${speechProfile.name}" — correct if misheard.` : ''

    const prompt = `Correct speech-to-text errors in this transcript.
${diffDesc} ${langDesc} ${subjectDesc} ${nameDesc}
Fix obvious STT errors using context. Preserve meaning exactly.
Return ONLY the corrected text — no explanation, no labels.

Transcript:
${text}`

    const corrected = await callAI(prompt, apiKey)
    if (!corrected) return

    const ref = firestore.collection('users').doc(uid).collection('omi-inbox').doc(memory.id)
    await ref.set({ overview: corrected, rawOverview: text }, { merge: true })
  } catch (e) {
    console.error('[omi-webhook] correctTranscript failed:', (e as Error).message)
  }
}

async function saveToLibrary(
  firestore: ReturnType<typeof getFirestore>,
  uid: string,
  memory: OmiMemory,
): Promise<void> {
  try {
    const category = memory.structured.category || 'general'
    const content = [
      memory.structured.overview || '',
      memory.structured.action_items?.length
        ? '\n\nAction Items:\n' + memory.structured.action_items.map(a => `• ${a.description}`).join('\n')
        : '',
    ].join('').trim()

    if (!content) return

    const ref = firestore.collection('users').doc(uid).collection('notes').doc(`omi-${memory.id}`)
    await ref.set({
      id: `omi-${memory.id}`,
      title: [memory.structured.emoji, memory.structured.title].filter(Boolean).join(' ') || 'Omi Note',
      content,
      folder: 'Omi',
      tags: ['omi', category, 'auto'],
      source: 'omi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'ai-output',
    }, { merge: true })
  } catch (e) {
    console.error('[omi-webhook] saveToLibrary failed:', (e as Error).message)
  }
}

async function generateFlashcards(
  firestore: ReturnType<typeof getFirestore>,
  uid: string,
  memory: OmiMemory,
  apiKey: string,
): Promise<void> {
  try {
    const text = memory.structured.overview || ''
    if (!text || text.length < 100) return

    const prompt = `Extract 3-7 flashcard Q&A pairs from this lecture/study transcript.
Return ONLY a JSON array — no explanation, no markdown fences.
Format: [{"q": "question", "a": "answer"}]

Transcript:
${text}`

    const raw = await callAI(prompt, apiKey)
    const cards = parseJsonSafely<{ q: string; a: string }[]>(raw)
    if (!Array.isArray(cards) || cards.length === 0) return

    const now = new Date().toISOString()
    const batch = firestore.batch()
    cards.forEach((card, i) => {
      if (!card.q || !card.a) return
      const ref = firestore.collection('users').doc(uid).collection('omi-flashcards').doc(`${memory.id}-${i}`)
      batch.set(ref, {
        q: card.q,
        a: card.a,
        topic: memory.structured.title || 'Omi',
        omiMemoryId: memory.id,
        addedToFSRS: false,
        createdAt: now,
      }, { merge: true })
    })
    await batch.commit()
  } catch (e) {
    console.error('[omi-webhook] generateFlashcards failed:', (e as Error).message)
  }
}

async function extractVocab(
  firestore: ReturnType<typeof getFirestore>,
  uid: string,
  memory: OmiMemory,
  apiKey: string,
): Promise<void> {
  try {
    const text = memory.structured.overview || ''
    if (!text || text.length < 80) return

    const prompt = `Extract domain-specific or academic vocabulary terms from this transcript.
Return only terms a student should know — skip common words.
Return ONLY a JSON array — no explanation, no markdown fences.
Format: [{"term": "term name", "definition": "brief definition"}]

Transcript:
${text}`

    const raw = await callAI(prompt, apiKey)
    const terms = parseJsonSafely<{ term: string; definition: string }[]>(raw)
    if (!Array.isArray(terms) || terms.length === 0) return

    const now = new Date().toISOString()
    const batch = firestore.batch()
    terms.forEach((item, i) => {
      if (!item.term || !item.definition) return
      const ref = firestore.collection('users').doc(uid).collection('omi-vocab').doc(`${memory.id}-${i}`)
      batch.set(ref, {
        term: item.term,
        definition: item.definition,
        memoryId: memory.id,
        createdAt: now,
      }, { merge: true })
    })
    await batch.commit()
  } catch (e) {
    console.error('[omi-webhook] extractVocab failed:', (e as Error).message)
  }
}

async function extractKnowledgeGaps(
  firestore: ReturnType<typeof getFirestore>,
  uid: string,
  memory: OmiMemory,
  apiKey: string,
): Promise<void> {
  try {
    const text = memory.structured.overview || ''
    if (!text || text.length < 100) return

    const prompt = `Identify knowledge gaps from this study/lecture transcript.
What concepts were mentioned but NOT fully explained?
What questions were raised but not answered?
Return ONLY a JSON array — no explanation, no markdown fences.
Format: [{"gap": "concept or question", "context": "brief context from transcript"}]

Transcript:
${text}`

    const raw = await callAI(prompt, apiKey)
    const gaps = parseJsonSafely<{ gap: string; context: string }[]>(raw)
    if (!Array.isArray(gaps) || gaps.length === 0) return

    const now = new Date().toISOString()
    const batch = firestore.batch()
    gaps.forEach((item, i) => {
      if (!item.gap) return
      const ref = firestore.collection('users').doc(uid).collection('omi-gaps').doc(`${memory.id}-${i}`)
      batch.set(ref, {
        gap: item.gap,
        context: item.context || '',
        memoryId: memory.id,
        surfaced: false,
        createdAt: now,
      }, { merge: true })
    })
    await batch.commit()
  } catch (e) {
    console.error('[omi-webhook] extractKnowledgeGaps failed:', (e as Error).message)
  }
}

async function updateStudyTime(
  firestore: ReturnType<typeof getFirestore>,
  uid: string,
  memory: OmiMemory,
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const category = (memory.structured.category || 'general').toLowerCase()
    const field = category === 'education' ? 'education' : category === 'work' ? 'work' : 'general'
    const ref = firestore.collection('users').doc(uid).collection('omi-time').doc(today)
    await ref.set({
      [field]: FieldValue.increment(2),
      total: FieldValue.increment(2),
      updatedAt: new Date().toISOString(),
    }, { merge: true })
  } catch (e) {
    console.error('[omi-webhook] updateStudyTime failed:', (e as Error).message)
  }
}

async function saveDailySummary(
  firestore: ReturnType<typeof getFirestore>,
  uid: string,
  summary: { text: string; date: string },
): Promise<void> {
  try {
    const ref = firestore.collection('users').doc(uid).collection('omi-inbox').doc(`digest-${summary.date}`)
    await ref.set({
      id: `digest-${summary.date}`,
      kind: 'day_summary',
      title: `Daily Digest — ${summary.date}`,
      overview: summary.text,
      category: 'digest',
      receivedAt: new Date().toISOString(),
      processed: true,
    }, { merge: true })

    const noteRef = firestore.collection('users').doc(uid).collection('notes').doc(`omi-digest-${summary.date}`)
    await noteRef.set({
      id: `omi-digest-${summary.date}`,
      title: `📅 Daily Digest — ${summary.date}`,
      content: summary.text,
      folder: 'Omi',
      tags: ['omi', 'digest', 'auto'],
      source: 'omi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'ai-output',
    }, { merge: true })
  } catch (e) {
    console.error('[omi-webhook] saveDailySummary failed:', (e as Error).message)
  }
}

async function saveToInbox(
  firestore: ReturnType<typeof getFirestore>,
  uid: string,
  memory: OmiMemory,
  counts: { flashcards: number; vocab: number; gaps: number },
): Promise<void> {
  try {
    const ref = firestore.collection('users').doc(uid).collection('omi-inbox').doc(memory.id)
    await ref.set({
      id: memory.id,
      kind: 'memory_created',
      title: [memory.structured.emoji, memory.structured.title].filter(Boolean).join(' ') || 'Omi Recording',
      overview: memory.structured.overview || '',
      rawOverview: memory.structured.overview || '',
      emoji: memory.structured.emoji || '🎙',
      category: memory.structured.category || 'general',
      action_items: memory.structured.action_items || [],
      flashcardCount: counts.flashcards,
      vocabCount: counts.vocab,
      gapCount: counts.gaps,
      receivedAt: new Date().toISOString(),
      processed: true,
    }, { merge: true })

    // Soft cap: delete oldest docs over 200
    const inbox = await firestore
      .collection('users').doc(uid).collection('omi-inbox')
      .orderBy('receivedAt', 'desc')
      .offset(200)
      .limit(50)
      .get()
    if (!inbox.empty) {
      const batch = firestore.batch()
      inbox.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
    }
  } catch (e) {
    console.error('[omi-webhook] saveToInbox failed:', (e as Error).message)
  }
}

// ─── Background pipeline ───────────────────────────────────────────────────────

async function runPipeline(
  body: { type?: string; memory?: OmiMemory; summary?: { text: string; date: string } },
  uid: string,
  env: Env,
): Promise<void> {
  try {
    const firestore = getDb(env)
    const userDoc = await firestore.collection('users').doc(uid).get()
    const userData = userDoc.data() ?? {}
    const autoSettings: OmiAutoSettings = userData.omiAutoSettings ?? {}
    const speechProfile: SpeechProfile = userData.omiSpeechProfile ?? {}
    const aiKey: string = userData.omiAiKey ?? ''

    if (body?.type === 'day_summary' && body.summary) {
      await saveDailySummary(firestore, uid, body.summary)
      return
    }

    const memory = body?.memory
    if (!memory?.id || !memory.structured) {
      console.error('[omi-webhook] Invalid memory payload for uid:', uid)
      return
    }

    const category = (memory.structured.category || 'general').toLowerCase()
    const isEducation = category === 'education' || category === 'study' || category === 'learning'
    const canRunAI = !!aiKey

    await Promise.allSettled([
      saveToInbox(firestore, uid, memory, { flashcards: 0, vocab: 0, gaps: 0 }),
      autoSettings.autoSaveNotes !== false
        ? saveToLibrary(firestore, uid, memory)
        : Promise.resolve(),
      updateStudyTime(firestore, uid, memory),
      canRunAI && autoSettings.autoVoiceCorrect !== false
        ? correctTranscript(firestore, uid, memory, aiKey, speechProfile)
        : Promise.resolve(),
      canRunAI && isEducation && autoSettings.autoFlashcards !== false
        ? generateFlashcards(firestore, uid, memory, aiKey)
        : Promise.resolve(),
      canRunAI && autoSettings.autoVocab !== false
        ? extractVocab(firestore, uid, memory, aiKey)
        : Promise.resolve(),
      canRunAI && isEducation && autoSettings.autoGaps !== false
        ? extractKnowledgeGaps(firestore, uid, memory, aiKey)
        : Promise.resolve(),
    ])
  } catch (e) {
    console.error('[omi-webhook] Pipeline error for uid:', uid, (e as Error).message)
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, waitUntil } = context
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  const url = new URL(request.url)
  const uid = url.searchParams.get('uid')?.trim() ?? ''
  if (!uid || uid.length < 10) {
    return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400, headers: corsHeaders })
  }

  // Parse body before returning, pass to background pipeline
  const body = await request.json().catch(() => ({})) as {
    type?: string
    memory?: OmiMemory
    summary?: { text: string; date: string }
  }

  // Return 200 immediately, run pipeline in background
  waitUntil(runPipeline(body, uid, env))

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
