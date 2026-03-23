/**
 * SharedContentPage — Public view for shared content via UUID link.
 * Route: /#/share/:shareId
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Copy, CheckCircle, LogIn } from 'lucide-react';
import { fetchSharedContent, type ShareableContent } from '../utils/auth';
import { safeRenderMd } from '../utils/renderMd';
import { useStore } from '../store';

export default function SharedContentPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { data, setData } = useStore();
  const uid = typeof window !== 'undefined' ? localStorage.getItem('nousai-auth-uid') : null;

  const [content, setContent] = useState<ShareableContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shareId) { setError('No share ID provided'); setLoading(false); return; }
    fetchSharedContent(shareId).then(c => {
      if (c) setContent(c);
      else setError('Content not found or link expired.');
      setLoading(false);
    }).catch(() => { setError('Failed to load shared content.'); setLoading(false); });
  }, [shareId]);

  function handleCopyToLibrary() {
    if (!content || !uid || !data) return;
    // Import based on content type
    if (content.type === 'deck' && Array.isArray(content.data)) {
      const existing = data.pluginData?.coachData?.courses ?? [];
      const newCourse = {
        id: crypto.randomUUID(),
        name: content.title + ' (shared)',
        shortName: content.title,
        flashcards: content.data,
        topics: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setData(prev => ({
        ...prev,
        pluginData: {
          ...prev.pluginData,
          coachData: {
            ...prev.pluginData?.coachData,
            courses: [...(prev.pluginData?.coachData?.courses ?? []), newCourse] as any,
          },
        },
      }));
      setCopied(true);
      setTimeout(() => navigate('/'), 1500);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--text-muted)' }}>
        <Loader2 size={20} className="spin" style={{ marginRight: 8 }} /> Loading shared content...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{error}</div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>Go to Dashboard</button>
      </div>
    );
  }

  if (!content) return null;

  const previewData = content.type === 'deck' && Array.isArray(content.data)
    ? content.data.slice(0, 5)
    : null;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          Shared {content.type}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
          {content.title}
        </h1>
        {content.courseName && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            From: {content.courseName}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Shared by {content.ownerName} · {new Date(content.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Preview */}
      {previewData && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
            Preview ({(content.data as unknown[]).length} cards total)
          </div>
          {previewData.map((card: any, i: number) => (
            <div key={i} className="card" style={{ padding: '10px 14px', marginBottom: 6, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                <div dangerouslySetInnerHTML={{ __html: safeRenderMd(card.front || '') }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <div dangerouslySetInnerHTML={{ __html: safeRenderMd(card.back || '') }} />
              </div>
            </div>
          ))}
          {(content.data as unknown[]).length > 5 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
              +{(content.data as unknown[]).length - 5} more cards
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {uid ? (
        <button
          className="btn btn-primary"
          onClick={handleCopyToLibrary}
          disabled={copied}
          style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700, gap: 8 }}
        >
          {copied
            ? <><CheckCircle size={16} /> Copied to your library!</>
            : <><Copy size={16} /> Copy to My Library</>
          }
        </button>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Sign in to copy this content to your library.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')} style={{ gap: 8 }}>
            <LogIn size={16} /> Sign In
          </button>
        </div>
      )}
    </div>
  );
}
