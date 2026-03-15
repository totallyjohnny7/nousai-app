// src/utils/fcm.ts
// Firebase Cloud Messaging for push notifications

import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { getApp } from 'firebase/app';

let messaging: Messaging | null = null;

export function isFCMSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function initFCM(vapidKey: string): Promise<string | null> {
  if (!isFCMSupported()) return null;
  try {
    const app = getApp();
    messaging = getMessaging(app);
    const sw = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: sw });
    return token || null;
  } catch (e) {
    console.warn('[FCM] init failed:', e);
    return null;
  }
}

export function onForegroundMessage(cb: (payload: unknown) => void): (() => void) {
  if (!messaging) return () => {};
  const unsub = onMessage(messaging, cb);
  return unsub;
}

export async function requestFCMPermission(vapidKey: string): Promise<{ token: string | null; error?: string }> {
  if (!isFCMSupported()) return { token: null, error: 'Push notifications not supported in this browser' };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { token: null, error: 'Notification permission denied' };
    const token = await initFCM(vapidKey);
    if (token) localStorage.setItem('nousai-fcm-token', token);
    return { token };
  } catch (e: unknown) {
    return { token: null, error: (e as Error)?.message || 'FCM error' };
  }
}

export function getFCMToken(): string | null {
  return localStorage.getItem('nousai-fcm-token');
}

export function clearFCMToken(): void {
  localStorage.removeItem('nousai-fcm-token');
}
