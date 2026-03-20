/**
 * ScreenLassoTool — UnifiedLearnPage wrapper for ScreenLasso
 *
 * Platform capability check: shows instructions on supported platforms,
 * unsupported message on Firefox/Safari/Boox/Mobile.
 * Registered in UnifiedLearnPage "Capture" category.
 */

import React, { useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import { useAuthUser } from '../../hooks/useAuthUser';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

const ScreenLasso = lazyWithRetry(() => import('../ScreenLasso'));

const supported = typeof navigator !== 'undefined' &&
  'mediaDevices' in navigator &&
  'getDisplayMedia' in navigator.mediaDevices;

function ScreenLassoToolInner() {
  const [open, setOpen] = useState(false);
  const { uid } = useAuthUser();

  if (!supported) {
    return (
      <div className="screen-lasso-unsupported">
        <ScanSearch size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
        <h3>Screen Lasso not available</h3>
        <p>Screen capture requires a modern desktop browser:</p>
        <ul>
          <li>Chrome or Edge on Windows / macOS</li>
          <li>Not available on Firefox, Safari, iPad, Boox, or mobile</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="screen-lasso-tool">
      <div className="screen-lasso-tool__header">
        <ScanSearch size={24} style={{ color: 'var(--color-accent)' }} />
        <h3>Screen Lasso</h3>
      </div>
      <p className="screen-lasso-tool__desc">
        Capture any region of your screen, extract text via OCR, and save as a note or relay to another device.
      </p>
      <ol className="screen-lasso-tool__steps">
        <li>Click Capture — browser will ask for screen permission</li>
        <li>Draw a polygon around the region you want</li>
        <li>AI extracts the text (OCR)</li>
        <li>Save as Note or Send to Relay device</li>
      </ol>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Capture Screen Region
      </button>
      {open && (
        <React.Suspense fallback={null}>
          <ScreenLasso
            isOpen={open}
            onClose={() => setOpen(false)}
            uid={uid ?? undefined}
          />
        </React.Suspense>
      )}
    </div>
  );
}

export default function ScreenLassoTool() {
  return (
    <ToolErrorBoundary toolName="Screen Lasso">
      <ScreenLassoToolInner />
    </ToolErrorBoundary>
  );
}
