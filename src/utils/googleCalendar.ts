/**
 * Google Calendar OAuth2 + API integration.
 * Uses OAuth2 implicit grant flow (browser popup).
 *
 * Setup: User must provide a Google OAuth2 Client ID.
 * Create one at https://console.developers.google.com/
 * (Authorized JS origins: your domain; no redirect URIs needed for implicit flow)
 *
 * Storage keys:
 *   nousai-google-token      → { token: string, expiry: number }
 *   nousai-google-client-id  → string
 *   nousai-google-synced     → Record<blockId, gcalEventId>
 */

import type { StudyBlock, GoogleCalendarEvent } from '../types';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const TOKEN_KEY = 'nousai-google-token';
const CLIENT_ID_KEY = 'nousai-google-client-id';
const SYNCED_KEY = 'nousai-google-synced';

export function getGoogleClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';
}

export function setGoogleClientId(id: string): void {
  localStorage.setItem(CLIENT_ID_KEY, id);
}

export function getGoogleToken(): string | null {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    const { token, expiry } = JSON.parse(stored) as { token: string; expiry: number };
    if (Date.now() > expiry) { localStorage.removeItem(TOKEN_KEY); return null; }
    return token;
  } catch { return null; }
}

function storeToken(token: string, expiresIn: number): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiry: Date.now() + expiresIn * 1000 }));
}

export function isGoogleConnected(): boolean {
  return getGoogleToken() !== null;
}

export function disconnectGoogle(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Opens a popup OAuth2 flow and stores the access token. */
export async function connectGoogleCalendar(): Promise<void> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error('Google OAuth Client ID not configured');

  return new Promise((resolve, reject) => {
    const redirectUri = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: SCOPES,
      include_granted_scopes: 'true',
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    const popup = window.open(authUrl, 'google-auth', 'width=500,height=600,scrollbars=yes');
    if (!popup) { reject(new Error('Popup blocked — please allow popups for this site')); return; }

    const interval = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(interval);
          reject(new Error('Auth cancelled'));
          return;
        }
        const hash = popup.location.hash;
        if (hash && hash.includes('access_token')) {
          clearInterval(interval);
          popup.close();
          const p = new URLSearchParams(hash.slice(1));
          const token = p.get('access_token');
          const expiresIn = parseInt(p.get('expires_in') || '3600', 10);
          if (token) { storeToken(token, expiresIn); resolve(); }
          else { reject(new Error('No access token in response')); }
        }
      } catch {
        // cross-origin frame — not yet redirected back, keep polling
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => { clearInterval(interval); if (!popup.closed) popup.close(); reject(new Error('Auth timed out')); }, 300_000);
  });
}

/** Fetch upcoming events from the primary Google Calendar. */
export async function getCalendarEvents(daysAhead: number): Promise<GoogleCalendarEvent[]> {
  const token = getGoogleToken();
  if (!token) throw new Error('Not authenticated with Google');

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 86_400_000).toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); throw new Error('Token expired — please reconnect'); }
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);

  const data = await res.json() as { items?: GoogleCalendarEvent[] };
  return data.items || [];
}

function getSyncedMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SYNCED_KEY) || '{}') as Record<string, string>; }
  catch { return {}; }
}

function saveSyncedMap(map: Record<string, string>): void {
  localStorage.setItem(SYNCED_KEY, JSON.stringify(map));
}

/**
 * Find an existing Google Calendar event for a study block.
 * Checks local cache first, then queries the API.
 * Idempotent: f(f(x)) = f(x)
 */
async function findSyncedEvent(blockId: string): Promise<string | null> {
  const map = getSyncedMap();
  if (map[blockId]) return map[blockId];

  const token = getGoogleToken();
  if (!token) return null;

  try {
    const q = encodeURIComponent(`nousaiBlockId=${blockId}`);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=${q}&maxResults=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json() as { items?: { id: string }[] };
    if (data.items?.length) {
      const eventId = data.items[0].id;
      map[blockId] = eventId;
      saveSyncedMap(map);
      return eventId;
    }
  } catch { /* ignore */ }
  return null;
}

/** Push a study block to Google Calendar (idempotent). Returns eventId. */
export async function pushStudyBlockToCalendar(block: StudyBlock): Promise<string> {
  const token = getGoogleToken();
  if (!token) throw new Error('Not authenticated with Google');

  // Idempotency check
  const existing = await findSyncedEvent(block.id);
  if (existing) return existing;

  const startDate = new Date(`${block.date}T09:00:00`);
  const endDate = new Date(startDate.getTime() + block.durationMin * 60_000);

  const body = {
    summary: `[NousAI] ${block.courseName}: ${block.topic}`,
    description: `Study session — ${block.type} (${block.durationMin} min)\nGenerated by NousAI Companion`,
    start: { dateTime: startDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
    extendedProperties: {
      private: {
        [`nousai-block-${block.id}`]: 'true',
        nousaiBlockId: block.id,
      },
    },
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Failed to create calendar event: ${res.status}`);

  const created = await res.json() as { id: string };
  const map = getSyncedMap();
  map[block.id] = created.id;
  saveSyncedMap(map);
  return created.id;
}

export async function isStudyBlockSynced(blockId: string): Promise<boolean> {
  const result = await findSyncedEvent(blockId);
  return result !== null;
}
