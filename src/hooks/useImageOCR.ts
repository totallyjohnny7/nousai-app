/**
 * useImageOCR — shared hook for image paste/drop/upload with Tesseract.js OCR.
 * Extracts text from screenshots, photos, and image files.
 */
import { useState, useRef, useCallback } from 'react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic'];

export interface ImageOCRState {
  imagePreview: string | null;  // data URL for preview display
  imageBase64: string | null;   // raw base64 (no prefix) for AI vision
  imageMimeType: string | null; // e.g. "image/png"
  isProcessing: boolean;
  ocrProgress: number;
  ocrText: string;
  ocrError: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFile: (file: File) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  triggerFileInput: () => void;
  clearImage: () => void;
}

export function useImageOCR(): ImageOCRState {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [ocrError, setOcrError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearImage = useCallback(() => {
    setImagePreview(null);
    setImageBase64(null);
    setImageMimeType(null);
    setIsProcessing(false);
    setOcrProgress(0);
    setOcrText('');
    setOcrError('');
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/') && !ACCEPTED_TYPES.includes(file.type)) return;
    if (file.size > MAX_FILE_SIZE) {
      setOcrError('Image too large (max 10MB)');
      return;
    }

    setIsProcessing(true);
    setOcrText('');
    setOcrError('');
    setOcrProgress(0);

    // Show preview and store base64 for AI vision
    setImageMimeType(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      // Extract raw base64 (strip "data:image/png;base64," prefix)
      const base64 = dataUrl.split(',')[1];
      if (base64) setImageBase64(base64);
    };
    reader.readAsDataURL(file);

    try {
      const { createWorker } = await import('tesseract.js');
      // Support English + Japanese + Chinese + Korean for multilingual documents
      const worker = await createWorker('eng+jpn+chi_sim+kor', 1, {
        logger: (m: { progress: number }) => {
          if (typeof m.progress === 'number') setOcrProgress(Math.round(m.progress * 100));
        },
      });
      const { data: ocrData } = await worker.recognize(file);
      setOcrText(ocrData.text.trim());
      await worker.terminate();
    } catch (err: any) {
      setOcrError(err.message || 'OCR failed');
    }
    setIsProcessing(false);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleFile(file);
        }
        return;
      }
    }
    // Not an image paste — let default behavior proceed (text paste)
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    imagePreview, imageBase64, imageMimeType, isProcessing, ocrProgress, ocrText, ocrError,
    fileInputRef, handleFile, handlePaste, handleDrop, handleDragOver,
    triggerFileInput, clearImage,
  };
}
