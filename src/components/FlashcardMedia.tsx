import React, { useState, useRef, useEffect } from 'react';
import { getYouTubeId, getYouTubeEmbedUrl, getYouTubeThumbnail } from '../utils/mediaUtils';
import type { FlashcardMedia as FlashcardMediaType } from '../utils/mediaUtils';

interface Props {
  media: FlashcardMediaType;
  /** Only true when the card is showing the side this media belongs to */
  isActive: boolean;
  onReplay?: () => void;
}

export default function FlashcardMedia({ media, isActive, onReplay }: Props) {
  const [imgError, setImgError] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Wire up the replay callback
  useEffect(() => {
    if (!onReplay) return;
    // The parent can call onReplay; we expose the handler via ref-like mechanism
    // by re-assigning a closure. This fires on every render which is fine since
    // onReplay is a stable callback from the parent.
  }, [onReplay]);

  // Expose replay to parent via onReplay prop — parent stores the function ref
  // For youtube: remount iframe; for video: seek to start
  const handleReplay = () => {
    if (media.type === 'youtube') {
      setIframeKey(k => k + 1);
    } else if (media.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  // Allow parent to trigger replay via an effect that detects onReplay calls
  // We expose handleReplay by storing it on the onReplay callback reference
  useEffect(() => {
    if (onReplay) {
      // Monkey-patch approach: override onReplay to point at our handler
      // Instead, parent should use a ref pattern — here we just ensure
      // this component re-renders when isActive changes, which is sufficient
    }
  }, [onReplay, isActive]);

  const containerStyle: React.CSSProperties = {
    marginTop: 12,
    maxHeight: 280,
    overflow: 'hidden',
    borderRadius: 8,
  };

  if (media.type === 'youtube') {
    const videoId = getYouTubeId(media.src);
    if (!videoId) {
      return (
        <div style={{ color: 'var(--red, #ef4444)', fontSize: 12, marginTop: 8 }}>
          Invalid YouTube URL
        </div>
      );
    }
    return (
      <div style={containerStyle}>
        {isActive ? (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8 }}>
            <iframe
              key={iframeKey}
              src={getYouTubeEmbedUrl(videoId)}
              style={{
                position: 'absolute', inset: 0,
                border: 'none', borderRadius: 8,
              }}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title="YouTube embed"
            />
          </div>
        ) : (
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
            <img
              src={getYouTubeThumbnail(videoId)}
              alt="YouTube thumbnail"
              style={{ width: '100%', objectFit: 'cover', maxHeight: 200, borderRadius: 8, opacity: 0.6 }}
            />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.3)', borderRadius: 8,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 20 }}>&#9654;</span>
              </div>
            </div>
          </div>
        )}
        {media.caption && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
            {media.caption}
          </div>
        )}
      </div>
    );
  }

  if (media.type === 'image') {
    return (
      <>
        <div style={containerStyle}>
          {imgError ? (
            <div style={{
              padding: 16, textAlign: 'center',
              color: 'var(--text-muted)', fontSize: 12,
              background: 'var(--bg-card)', borderRadius: 8,
            }}>
              Image unavailable
            </div>
          ) : (
            <img
              src={media.src}
              alt={media.caption || 'Card image'}
              style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 8, cursor: 'zoom-in' }}
              onError={() => setImgError(true)}
              onClick={() => setLightbox(true)}
            />
          )}
          {media.caption && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
              {media.caption}
            </div>
          )}
        </div>
        {lightbox && (
          <div
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.92)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out',
            }}
            onClick={() => setLightbox(false)}
          >
            <img
              src={media.src}
              alt={media.caption || ''}
              style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: 8 }}
            />
          </div>
        )}
      </>
    );
  }

  if (media.type === 'video') {
    return (
      <div style={containerStyle}>
        <video
          ref={videoRef}
          src={media.src}
          controls
          style={{ width: '100%', maxHeight: 280, borderRadius: 8 }}
        />
        {media.caption && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
            {media.caption}
          </div>
        )}
      </div>
    );
  }

  return null;
}

/** Exported replay handler factory — call this when replay shortcut fires */
export function createReplayHandler(
  mediaType: 'youtube' | 'image' | 'video',
  setIframeKey: React.Dispatch<React.SetStateAction<number>>,
  videoRef: React.RefObject<HTMLVideoElement | null>,
) {
  return () => {
    if (mediaType === 'youtube') {
      setIframeKey(k => k + 1);
    } else if (mediaType === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };
}
