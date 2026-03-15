// src/utils/spotify.ts — Spotify PKCE OAuth + Now Playing

const SPOTIFY_SCOPES = 'user-read-currently-playing user-read-playback-state';
const REDIRECT_URI = 'https://nousai-app.vercel.app';

export interface SpotifyTrack {
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  spotifyUrl: string;
}

function generateCodeVerifier(length = 128): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function getSpotifyAuthUrl(clientId: string): Promise<string> {
  const verifier = generateCodeVerifier();
  const challenge = base64UrlEncode(await sha256(verifier));
  localStorage.setItem('spotify_code_verifier', verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state: 'nousai_spotify',
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeSpotifyCode(code: string, clientId: string): Promise<boolean> {
  const verifier = localStorage.getItem('spotify_code_verifier');
  if (!verifier) return false;
  try {
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    if (!resp.ok) return false;
    const data = await resp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem('spotify_refresh_token', data.refresh_token || '');
    localStorage.setItem('spotify_token_expires', String(Date.now() + data.expires_in * 1000));
    localStorage.removeItem('spotify_code_verifier');
    return true;
  } catch {
    return false;
  }
}

export async function refreshSpotifyToken(clientId: string): Promise<boolean> {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  if (!refreshToken) return false;
  try {
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!resp.ok) return false;
    const data = await resp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem('spotify_token_expires', String(Date.now() + data.expires_in * 1000));
    if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function getValidToken(clientId: string): Promise<string | null> {
  const token = localStorage.getItem('spotify_access_token');
  const expires = Number(localStorage.getItem('spotify_token_expires') || '0');
  if (!token) return null;
  if (Date.now() > expires - 60000) {
    const ok = await refreshSpotifyToken(clientId);
    if (!ok) return null;
    return localStorage.getItem('spotify_access_token');
  }
  return token;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyImage {
  url: string;
}

interface SpotifyItem {
  name: string;
  artists: SpotifyArtist[];
  album: {
    name: string;
    images: SpotifyImage[];
  };
  duration_ms: number;
  external_urls?: { spotify?: string };
}

interface SpotifyCurrentlyPlayingResponse {
  item: SpotifyItem | null;
  progress_ms: number | null;
  is_playing: boolean;
}

export async function getCurrentlyPlaying(clientId: string): Promise<SpotifyTrack | null> {
  const token = await getValidToken(clientId);
  if (!token) return null;
  try {
    const resp = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.status === 204 || !resp.ok) return null;
    const data = await resp.json() as SpotifyCurrentlyPlayingResponse;
    if (!data?.item) return null;
    return {
      name: data.item.name,
      artist: data.item.artists.map(a => a.name).join(', '),
      album: data.item.album.name,
      albumArt: data.item.album.images?.[1]?.url || data.item.album.images?.[0]?.url || '',
      durationMs: data.item.duration_ms,
      progressMs: data.progress_ms ?? 0,
      isPlaying: data.is_playing,
      spotifyUrl: data.item.external_urls?.spotify || '',
    };
  } catch {
    return null;
  }
}

export function getSpotifyClientId(): string {
  return localStorage.getItem('nousai-spotify-client-id') || '';
}

export function isSpotifyConnected(): boolean {
  return !!localStorage.getItem('spotify_access_token');
}

export function disconnectSpotify(): void {
  ['spotify_access_token', 'spotify_refresh_token', 'spotify_token_expires', 'spotify_code_verifier', 'nousai-spotify-client-id'].forEach(k => localStorage.removeItem(k));
}
