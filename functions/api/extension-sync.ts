/**
 * NousAI Extension Sync Endpoint
 *
 * Receives Canvas grade/assignment data from the Chrome extension,
 * returns NousAI study data (courses, upcoming quizzes, streak) for display on Canvas pages.
 *
 * Auth: Firebase ID token in Authorization header (Bearer <token>)
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

interface Env {
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
}

const ALLOWED_ORIGINS = [
  'https://studynous.com',
  'https://www.studynous.com',
  'https://nousai-app.pages.dev',
  'https://nousai-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getFirebaseClients(env: Env) {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
  }
  return { db: getFirestore(), auth: getAuth() }
}

function json(data: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extra ?? {}) },
  })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const origin = request.headers.get('origin') ?? ''
  const isExtension = origin.startsWith('chrome-extension://')
  const corsOrigin = isExtension ? '*' : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  const idToken = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!idToken) return json({ error: 'Missing Authorization token' }, 401, corsHeaders)

  let firebase: ReturnType<typeof getFirebaseClients>
  try {
    firebase = getFirebaseClients(env)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Firebase init failed'
    return json({ error: 'Service unavailable', details: message }, 503, corsHeaders)
  }

  let uid: string
  try {
    const decoded = await firebase.auth.verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return json({ error: 'Invalid or expired token' }, 401, corsHeaders)
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const { grades, assignments } = body

  try {
    if (grades || assignments) {
      const ref = firebase.db.collection('users').doc(uid)
      const updateData: Record<string, unknown> = {}
      if (grades) updateData['extensionSync.grades'] = { ...(grades as object), syncedAt: new Date().toISOString() }
      if (assignments) updateData['extensionSync.assignments'] = { items: assignments, syncedAt: new Date().toISOString() }
      await ref.set(updateData, { merge: true })
    }

    const userDoc = await firebase.db.collection('users').doc(uid).get()
    const userData = userDoc.data() ?? {}
    const studySummary: Record<string, unknown> = userData.pluginData ? { hasData: true } : {}

    return json({ ok: true, uid, studySummary }, 200, corsHeaders)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: 'Sync failed', details: message }, 500, corsHeaders)
  }
}
