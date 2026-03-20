import { useState, lazy, Suspense } from 'react';
import type { SavedVideo } from '../types';
import { useStore } from '../store';
import { deleteVideoFromStorage } from '../utils/videoStorage';

const VideoPlayer = lazy(() => import('../components/VideoPlayer'));
const VideoTool = lazy(() => import('../components/aitools/VideoTool'));

function formatDuration(secs: number): string {
  if (!isFinite(secs) || isNaN(secs) || secs === 0) return '--:--';
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; }
}

export default function VideosPage() {
  const { savedVideos, deleteVideo, courses } = useStore();

  const [activeVideo, setActiveVideo] = useState<SavedVideo | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterCourse, setFilterCourse] = useState('');
  const [filterType, setFilterType] = useState<'' | 'upload' | 'recording'>('');
  const [search, setSearch] = useState('');

  const filtered = savedVideos
    .filter(v => {
      if (filterCourse && v.courseId !== filterCourse) return false;
      if (filterType && v.type !== filterType) return false;
      if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function handleDelete(videoId: string) {
    const v = savedVideos.find(v => v.id === videoId);
    if (v?.storagePath) {
      await deleteVideoFromStorage(v.storagePath);
    }
    deleteVideo(videoId);
    setConfirmDeleteId(null);
    if (activeVideo?.id === videoId) setActiveVideo(null);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontSize: '1.5rem', fontWeight: 700 }}>Videos</h1>
        <button
          onClick={() => setShowUpload(v => !v)}
          style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem' }}
        >
          {showUpload ? '✕ Close' : '+ Upload / Record'}
        </button>
      </div>

      {/* Upload/Record panel */}
      {showUpload && (
        <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: '1.25rem', overflow: 'hidden' }}>
          <Suspense fallback={<div style={{ padding: '1rem', color: 'var(--muted)' }}>Loading…</div>}>
            <VideoTool />
          </Suspense>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search videos…"
          style={{ flex: 1, minWidth: 180, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem' }}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value as '' | 'upload' | 'recording')}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.6rem', color: 'var(--text)', fontSize: '0.82rem' }}>
          <option value="">All types</option>
          <option value="upload">Uploads</option>
          <option value="recording">Recordings</option>
        </select>
        {courses.length > 0 && (
          <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.6rem', color: 'var(--text)', fontSize: '0.82rem' }}>
            <option value="">All courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Video grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--muted)' }}>
          <p style={{ margin: 0, fontSize: '1rem' }}>No videos yet</p>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>Upload a video or record your screen to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {filtered.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              courseName={courses.find(c => c.id === v.courseId)?.name}
              onPlay={() => setActiveVideo(v)}
              onDelete={() => setConfirmDeleteId(v.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDeleteId && (
        <div onClick={() => setConfirmDeleteId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 12, padding: '1.5rem', maxWidth: 380, width: '90%', border: '1px solid var(--border)' }}>
            <p style={{ margin: '0 0 1rem', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>Delete this video?</p>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--muted)' }}>This will permanently delete the video file from Firebase Storage and cannot be undone.</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => handleDelete(confirmDeleteId)} style={{ flex: 1, background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem', cursor: 'pointer', fontWeight: 700 }}>
                Delete
              </button>
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video player modal */}
      {activeVideo && (
        <Suspense fallback={null}>
          <VideoPlayer video={activeVideo} onClose={() => setActiveVideo(null)} />
        </Suspense>
      )}
    </div>
  );
}

// ── Video Card component ─────────────────────────────────

interface VideoCardProps {
  video: SavedVideo;
  courseName?: string;
  onPlay: () => void;
  onDelete: () => void;
}

function VideoCard({ video, courseName, onPlay, onDelete }: VideoCardProps) {
  const noteCount = video.notes?.length ?? 0;
  const captionCount = video.captions?.length ?? 0;

  return (
    <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.15s' }}
      onClick={onPlay}>
      {/* Thumbnail */}
      <div style={{ aspectRatio: '16/9', background: '#111', position: 'relative', overflow: 'hidden' }}>
        {video.thumbnailBase64 ? (
          <img src={video.thumbnailBase64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '2rem' }}>
            {video.type === 'recording' ? '⏺' : '▶'}
          </div>
        )}
        {/* Duration badge */}
        <span style={{ position: 'absolute', bottom: 6, right: 8, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.72rem', borderRadius: 4, padding: '0.1rem 0.35rem', fontFamily: 'DM Mono, monospace' }}>
          {formatDuration(video.duration)}
        </span>
        {/* Type badge */}
        <span style={{ position: 'absolute', top: 6, left: 8, background: video.type === 'recording' ? '#e63946' : 'var(--accent)', color: video.type === 'recording' ? '#fff' : '#000', fontSize: '0.65rem', borderRadius: 4, padding: '0.1rem 0.35rem', fontWeight: 700 }}>
          {video.type === 'recording' ? 'REC' : 'VIDEO'}
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: '0.65rem 0.75rem' }}>
        <p style={{ margin: '0 0 0.25rem', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={video.title}>
          {video.title}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{formatDate(video.createdAt)}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{formatSize(video.size)}</span>
          {courseName && <span style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 600 }}>{courseName}</span>}
        </div>
        {(noteCount > 0 || captionCount > 0) && (
          <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.4rem' }}>
            {noteCount > 0 && <span style={{ fontSize: '0.68rem', color: 'var(--muted)', background: 'var(--bg)', borderRadius: 4, padding: '0.1rem 0.35rem', border: '1px solid var(--border)' }}>📝 {noteCount}</span>}
            {captionCount > 0 && <span style={{ fontSize: '0.68rem', color: 'var(--muted)', background: 'var(--bg)', borderRadius: 4, padding: '0.1rem 0.35rem', border: '1px solid var(--border)' }}>CC {captionCount}</span>}
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }} title="Delete">
            🗑 Delete
          </button>
        </div>
      </div>
    </div>
  );
}
