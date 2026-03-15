import { useState, useRef, useCallback } from 'react';
import { ScanLine, Copy, Save, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import type { Note } from '../../types';
import { copyText, inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

function OCRTool() {
  const { data, updatePluginData } = useStore();
  const [extractedText, setExtractedText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setExtractedText(`Invalid file type: "${file.type || file.name}". Please upload a PNG, JPG, or WEBP image.`);
      return;
    }
    setProcessing(true);
    setExtractedText('');
    setProgress(0);
    setSaved(false);

    // Show image preview
    const reader = new FileReader();
    reader.onload = (e) => setImageSrc(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: { progress: number }) => {
          if (typeof m.progress === 'number') setProgress(Math.round(m.progress * 100));
        },
      });
      const { data: ocrData } = await worker.recognize(file);
      setExtractedText(ocrData.text);
      await worker.terminate();
    } catch (err: any) {
      setExtractedText(`OCR Error: ${err.message || 'Failed to process image'}. You can paste text manually below.`);
    }
    setProcessing(false);
  }, []);

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) handleFile(file);
        return;
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function saveToLibrary() {
    if (!extractedText || !data) return;
    const note: Note = {
      id: `ocr-${Date.now()}`,
      title: `OCR Extract — ${new Date().toLocaleDateString()}`,
      content: extractedText,
      folder: 'AI Outputs',
      tags: ['ocr'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'ai-output',
    };
    const existing = (data.pluginData as Record<string, unknown>).notes as Note[] | undefined || [];
    updatePluginData({ notes: [...existing, note] });
    setSaved(true);
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <ScanLine size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Image to Text
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onPaste={handlePaste}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            padding: 40,
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'var(--accent-glow)' : 'transparent',
            transition: 'all 0.2s',
            marginBottom: 12,
          }}
        >
          <ScanLine size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Drop image here, click to upload, or paste (Ctrl+V)
          </p>
          <p className="text-xs text-muted" style={{ marginTop: 4 }}>
            Supports PNG, JPG, WEBP
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          style={{ display: 'none' }}
        />

        {/* Image preview */}
        {imageSrc && (
          <div style={{ marginBottom: 12, textAlign: 'center' }}>
            <img
              src={imageSrc}
              alt="Uploaded"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              style={{
                maxWidth: '100%', maxHeight: 200, borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
        )}

        {processing && (
          <div className="text-center" style={{ padding: 20 }}>
            <div style={{ color: 'var(--accent)', fontSize: 14, marginBottom: 8 }}>Processing image... {progress}%</div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
            </div>
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Manual text paste area */}
      <div className="card mb-3">
        <div className="card-title mb-2">Extracted / Pasted Text</div>
        <textarea
          value={extractedText}
          onChange={(e) => setExtractedText(e.target.value)}
          placeholder="Paste text from image here, or it will appear after processing..."
          rows={8}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <div className="flex gap-2 mt-2">
          <button className="btn btn-sm btn-secondary" onClick={() => copyText(extractedText)} disabled={!extractedText}>
            <Copy size={14} /> Copy
          </button>
          <button className="btn btn-sm btn-secondary" onClick={saveToLibrary} disabled={!extractedText || saved}>
            <Save size={14} /> {saved ? 'Saved!' : 'Save to Library'}
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => { setExtractedText(''); setImageSrc(null); }}>
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OcrToolWrapped() {
  return (
    <ToolErrorBoundary toolName="OCR">
      <OCRTool />
    </ToolErrorBoundary>
  );
}
