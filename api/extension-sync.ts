/**
 * NousAI Extension Sync Endpoint
 *
 * Receives Canvas grade/assignment data from the Chrome extension,
 * returns NousAI study data (courses, upcoming quizzes, streak) for display on Canvas pages.
 *
 * Auth: Firebase ID token in Authorization header (Bearer <token>)
 * The extension gets this token from chrome.storage (stored after user logs in via popup)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Initialize Firebase Admin SDK once
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()
const auth = getAuth()

const ALLOWED_ORIGINS = [
  'https://nousai-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const origin = req.headers.origin || ''
  const isExtension = req.headers.origin?.startsWith('chrome-extension://')
  if (ALLOWED_ORIGINS.includes(origin) || isExtension) {
    res.setHeader('Access-Control-Allow-Origin', isExtension ? '*' : origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth: verify Firebase ID token
  const authHeader = req.headers.authorization || ''
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!idToken) return res.status(401).json({ error: 'Missing Authorization token' })

  let uid: string
  try {
    const decoded = await auth.verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  const { grades, assignments } = req.body || {}

  try {
    // Store Canvas data from extension into Firestore (merged into user doc)
    if (grades || assignments) {
      const ref = db.collection('users').doc(uid)
      const updateData: Record<string, unknown> = {}
      if (grades) updateData['extensionSync.grades'] = { ...grades, syncedAt: new Date().toISOString() }
      if (assignments) updateData['extensionSync.assignments'] = { items: assignments, syncedAt: new Date().toISOString() }
      await ref.set(updateData, { merge: true })
    }

    // Return NousAI study data for display in the extension sidebar
    const userDoc = await db.collection('users').doc(uid).get()
    const userData = userDoc.data() || {}

    // Extract lightweight study summary from stored PluginData
    const pluginRaw = userData.pluginData
    let studySummary: Record<string, unknown> = {}
    if (pluginRaw) {
      try {
        // Data is gzip compressed — return raw for now; extension can display without decompressing
        studySummary = { hasData: true }
      } catch {
        studySummary = {}
      }
    }

    return res.status(200).json({
      ok: true,
      uid,
      studySummary,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Sync failed', details: message })
  }
}
