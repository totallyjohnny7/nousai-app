import { useState } from 'react';

interface PhETEmbedProps {
  url: string;
  title: string;
}

export function PhETEmbed({ url, title }: PhETEmbedProps) {
  const [loading, setLoading] = useState(true);

  return (
    <div style={{ position: 'relative', background: '#0f0f23', borderRadius: 8, overflow: 'hidden' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#888', fontSize: 14, fontWeight: 600, zIndex: 1,
        }}>
          Loading {title}...
        </div>
      )}
      <iframe
        src={url}
        title={title}
        onLoad={() => setLoading(false)}
        style={{
          width: '100%', height: 500, border: 'none', display: 'block',
          opacity: loading ? 0 : 1, transition: 'opacity 0.3s',
        }}
        allow="autoplay; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
