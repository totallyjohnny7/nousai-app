/**
 * ImageInputBar — shared UI for image upload/paste OCR feedback.
 * Shows preview thumbnail, progress bar, extracted text indicator, and error state.
 */
import { Camera, X, CheckCircle, AlertTriangle } from 'lucide-react';
import type { ImageOCRState } from '../hooks/useImageOCR';

interface ImageInputBarProps {
  ocr: ImageOCRState;
  compact?: boolean;
}

export default function ImageInputBar({ ocr, compact }: ImageInputBarProps) {
  const { imagePreview, isProcessing, ocrProgress, ocrText, ocrError, clearImage, triggerFileInput, fileInputRef, handleFile } = ocr;

  const hasContent = imagePreview || ocrText || ocrError || isProcessing;
  if (!hasContent && compact) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      {/* Upload button (only in full mode when nothing attached) */}
      {!compact && !hasContent && (
        <button
          onClick={triggerFileInput}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-sm)', background: 'transparent',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
          }}
        >
          <Camera size={14} /> Paste, drop, or upload an image
        </button>
      )}

      {/* Preview + progress/result row */}
      {hasContent && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: compact ? '4px 8px' : '6px 10px',
          background: 'var(--surface)', borderRadius: 8,
          border: '1px solid var(--border)', fontSize: 11,
        }}>
          {/* Thumbnail */}
          {imagePreview && (
            <img
              src={imagePreview}
              alt="preview"
              style={{ width: compact ? 28 : 36, height: compact ? 28 : 36, objectFit: 'cover', borderRadius: 4 }}
            />
          )}

          {/* Status */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {isProcessing && (
              <div>
                <div style={{ marginBottom: 3, color: 'var(--text-muted)' }}>Extracting text… {ocrProgress}%</div>
                <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${ocrProgress}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
            {!isProcessing && ocrText && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)' }}>
                <CheckCircle size={12} /> Text extracted ({ocrText.length} chars)
              </div>
            )}
            {!isProcessing && ocrError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--red)' }}>
                <AlertTriangle size={12} /> {ocrError}
              </div>
            )}
          </div>

          {/* Clear button */}
          {!isProcessing && (
            <button
              onClick={clearImage}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
