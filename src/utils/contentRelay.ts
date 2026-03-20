/**
 * Cross-Device Content Relay — NousAI
 *
 * Ephemeral Firestore clipboard at users/{uid}/relay/clipRelay.
 * Payloads expire after 30s. Last-write-wins (clipboard model).
 * Large payloads (>100KB) are stored in Firebase Storage — only the
 * download URL goes in Firestore, staying well under the 1MB doc limit.
 * NOT part of main sync pipeline — no gzip, no BroadcastChannel.
 */

import type { RelayPayload, RelayContentType } from '../types';
import { writeRelayDoc, watchRelayDoc, deleteRelayDoc, uploadRelayContent, downloadRelayContent } from './auth';

const EXPIRY_MS = 30_000;
const MAX_IMAGE_BYTES = 500_000;   // 500KB base64 cap for images
const LARGE_PAYLOAD_BYTES = 100_000; // >100KB → offload to Firebase Storage

/**
 * Short, session-stable fingerprint to prevent echoing our own relay messages.
 * Based on UA prefix + screen dimensions — NOT persisted.
 */
export function getDeviceFingerprint(): string {
  const raw = navigator.userAgent.slice(0, 60) + screen.width + screen.height;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function buildRelayPayload(type: RelayContentType, content: string): RelayPayload {
  if (type === 'image' && content.length > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large for relay (max ${MAX_IMAGE_BYTES / 1000}KB base64). Compress before sending.`);
  }
  const now = new Date();
  return {
    type,
    content,
    sizeBytes: content.length,
    sourceDevice: getDeviceFingerprint(),
    sentAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EXPIRY_MS).toISOString(),
  };
}

/**
 * Send a relay payload to another device.
 * For large payloads (>100KB), content is uploaded to Firebase Storage and
 * only the download URL is stored in Firestore — avoids the 1MB doc limit.
 */
export async function sendToRelay(uid: string, payload: RelayPayload): Promise<void> {
  if (payload.content.length > LARGE_PAYLOAD_BYTES) {
    // Offload large content to Firebase Storage
    const contentRef = await uploadRelayContent(uid, payload.content);
    const lightPayload: RelayPayload = {
      ...payload,
      content: '',       // cleared — receiver fetches from contentRef
      contentRef,
    };
    await writeRelayDoc(uid, lightPayload);
  } else {
    await writeRelayDoc(uid, payload);
  }
}

/**
 * Subscribe to incoming relay payloads from other devices.
 * Automatically resolves large payloads from Storage before calling onReceive.
 * Returns unsubscribe function — call on component unmount.
 */
export function subscribeToRelay(
  uid: string,
  onReceive: (payload: RelayPayload) => void,
): () => void {
  const myFingerprint = getDeviceFingerprint();

  return watchRelayDoc(uid, async (rawData) => {
    const data = rawData as RelayPayload;
    if (!data || !data.sentAt) return;

    // Echo prevention — ignore payloads we sent ourselves
    if (data.sourceDevice === myFingerprint) return;

    // Expiry check
    if (new Date(data.expiresAt) < new Date()) {
      deleteRelayDoc(uid).catch(() => {});
      return;
    }

    // If large payload was offloaded to Storage, download it first
    if (data.contentRef) {
      try {
        const content = await downloadRelayContent(data.contentRef);
        onReceive({ ...data, content, contentRef: undefined });
      } catch {
        // Deliver with empty content + error marker rather than silently dropping
        onReceive({ ...data, content: '__relay_download_error__' });
      }
    } else {
      onReceive(data);
    }

    // Clean up after receiving so other devices don't also trigger
    deleteRelayDoc(uid).catch(() => {});
  });
}

export async function clearRelay(uid: string): Promise<void> {
  await deleteRelayDoc(uid);
}
