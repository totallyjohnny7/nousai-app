export interface FlashcardMedia {
  type: 'youtube' | 'image' | 'video';
  src: string;
  side: 'front' | 'back' | 'both';
  caption?: string;
}

/** Extract YouTube video ID from any YouTube URL format */
export function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&\s]+)/,
    /[?&]v=([^?&\s]+)/,
    /embed\/([^?&\s]+)/,
    /shorts\/([^?&\s]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Get YouTube thumbnail URL from video ID */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** Build YouTube embed URL from video ID (lazy-load friendly) */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/** Validate media object — returns cleaned media or null */
export function validateMedia(raw: unknown): FlashcardMedia | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (!m.src || typeof m.src !== 'string' || !m.src.trim()) return null;
  const type = m.type as string;
  if (!['youtube', 'image', 'video'].includes(type)) return null;
  const side = (['front', 'back', 'both'] as const).includes(m.side as never)
    ? (m.side as 'front' | 'back' | 'both')
    : 'back';
  return {
    type: type as 'youtube' | 'image' | 'video',
    src: m.src.trim(),
    side,
    caption: typeof m.caption === 'string' ? m.caption : '',
  };
}
