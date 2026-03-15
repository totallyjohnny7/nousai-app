/**
 * StudyFloatingRail — Fixed vertical button at the right viewport edge.
 * Visible during any active quiz session.
 * Single button: toggle annotation sidecar (notes + draw + AI).
 */
import { Bookmark, BookmarkCheck } from 'lucide-react';

interface Props {
  onToggle: () => void;
  hasAnnotation: boolean;
  isOpen: boolean;
}

export default function StudyFloatingRail({ onToggle, hasAnnotation, isOpen }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button
        onClick={onToggle}
        title="Notes, Draw & Ask AI  (N)"
        aria-label={isOpen ? 'Close study notes panel' : 'Open study notes panel'}
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: isOpen ? 'var(--accent)' : 'var(--bg-secondary)',
          color: isOpen ? '#fff' : hasAnnotation ? 'var(--accent)' : 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          transition: 'background 0.15s, color 0.15s',
          padding: 0,
        }}
      >
        {hasAnnotation && !isOpen
          ? <BookmarkCheck size={16} />
          : <Bookmark size={16} />
        }
        <span style={{ fontSize: 8, fontWeight: 700, fontFamily: 'inherit', lineHeight: 1 }}>
          {isOpen ? 'CLOSE' : 'NOTES'}
        </span>
      </button>
    </div>
  );
}
