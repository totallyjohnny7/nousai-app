/**
 * videoStorage.ts — Firebase Storage helpers for Video Studio
 *
 * Storage layout:  videos/{uid}/{videoId}.{ext}
 * Metadata + captions sync via Firestore (see store.tsx / auth.ts trimForSync)
 * downloadUrl and thumbnailBase64 are NEVER synced to Firestore.
 */

import { getFirebaseStorageFns } from './auth';

export interface UploadVideoOptions {
  uid: string;
  videoId: string;
  blob: Blob;
  mimeType: string;
  onProgress?: (percent: number) => void;
}

/** Upload a video blob to Firebase Storage. Returns the storagePath. */
export async function uploadVideoToStorage(opts: UploadVideoOptions): Promise<string> {
  const { uid, videoId, blob, mimeType, onProgress } = opts;
  const { storageRef, uploadBytesResumable } = await getFirebaseStorageFns();

  const ext = mimeType === 'video/mp4' ? 'mp4' : mimeType === 'video/quicktime' ? 'mov' : 'webm';
  const path = `videos/${uid}/${videoId}.${ext}`;
  const ref = storageRef(path);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(ref, blob, { contentType: mimeType });
    task.on(
      'state_changed',
      (snapshot: any) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(pct);
      },
      (err: Error) => reject(err),
      () => resolve(),
    );
  });

  return path;
}

/** Get a fresh download URL for a storage path. Call this on mount or on playback error (URL expiry). */
export async function getVideoDownloadUrl(storagePath: string): Promise<string> {
  const { storageRef, getDownloadURL } = await getFirebaseStorageFns();
  const ref = storageRef(storagePath);
  return getDownloadURL(ref);
}

/** Delete a video file from Firebase Storage. Safe to call even if file is already gone. */
export async function deleteVideoFromStorage(storagePath: string): Promise<void> {
  try {
    const { storageRef, deleteObject } = await getFirebaseStorageFns();
    const ref = storageRef(storagePath);
    await deleteObject(ref);
  } catch (e: any) {
    // storage/object-not-found — already deleted, that's fine
    if (e?.code !== 'storage/object-not-found') {
      console.warn('[videoStorage] deleteObject failed:', e);
    }
  }
}

/** Extract a thumbnail from a video Blob by drawing a canvas frame at the given seek time. */
export async function generateVideoThumbnail(blob: Blob, seekSecs = 2): Promise<string | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(seekSecs, video.duration * 0.1);
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = Math.round(320 * (video.videoHeight / (video.videoWidth || 1)));
        const ctx = canvas.getContext('2d');
        if (!ctx) { cleanup(); resolve(null); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        resolve(null);
      } finally {
        cleanup();
      }
    });

    video.addEventListener('error', () => { cleanup(); resolve(null); });

    // Fallback: if seeked never fires (e.g. duration=0), return null after 5s
    setTimeout(() => { cleanup(); resolve(null); }, 5000);
  });
}
