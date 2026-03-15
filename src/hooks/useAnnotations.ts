/**
 * useAnnotations — Load, save, and auto-sync quiz annotations.
 * - Text notes: saved via updatePluginData → Firestore (debounced 30s existing pipeline)
 * - Canvas PNG: saved only to IndexedDB (too large for Firestore; key ref stored in annotation)
 * - 750ms debounce on both save paths to avoid rapid writes
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import type { QuizAnnotation } from '../types';
import { saveFile, loadFile } from '../utils/fileStore';

export type SyncStatus = 'idle' | 'saving' | 'saved';

interface UseAnnotationsResult {
  annotation: QuizAnnotation | null;
  canvasData: string | null;        // resolved IDB canvas PNG (base64)
  saveText: (text: string) => void;
  saveCanvas: (dataUrl: string) => void;
  clearAnnotation: () => void;
  syncStatus: SyncStatus;
  hasAnnotation: boolean;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useAnnotations(contentId: string, subjectTag: string): UseAnnotationsResult {
  const { data, updatePluginData } = useStore();
  const [canvasData, setCanvasData] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive current annotation from store
  const annotation = (data?.pluginData?.annotations ?? []).find(
    (a: QuizAnnotation) => a.contentId === contentId
  ) ?? null;

  const hasAnnotation = Boolean(
    annotation && (annotation.textContent || annotation.canvasStorageKey)
  );

  // Load canvas from IDB whenever the annotation/contentId changes
  useEffect(() => {
    setCanvasData(null);
    if (!annotation?.canvasStorageKey) return;
    loadFile(annotation.canvasStorageKey).then(data => {
      if (data) setCanvasData(data);
    });
  }, [annotation?.canvasStorageKey, contentId]);

  // Upsert helper — merges fields into annotation list
  const upsert = useCallback((fields: Partial<QuizAnnotation>) => {
    const existing = data?.pluginData?.annotations ?? [];
    const idx = existing.findIndex((a: QuizAnnotation) => a.contentId === contentId);
    const now = new Date().toISOString();

    let updated: QuizAnnotation[];
    if (idx >= 0) {
      updated = existing.map((a: QuizAnnotation, i: number) =>
        i === idx ? { ...a, ...fields, updatedAt: now } : a
      );
    } else {
      const newEntry: QuizAnnotation = {
        id: generateId(),
        contentId,
        subjectTag,
        createdAt: now,
        updatedAt: now,
        ...fields,
      };
      updated = [...existing, newEntry];
    }
    updatePluginData({ annotations: updated });
  }, [contentId, subjectTag, data, updatePluginData]);

  // Save text note (debounced 750ms)
  const saveText = useCallback((text: string) => {
    setSyncStatus('saving');
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(() => {
      upsert({ textContent: text });
      setSyncStatus('saved');
      // Reset to idle after 2s
      setTimeout(() => setSyncStatus('idle'), 2000);
    }, 750);
  }, [upsert]);

  // Save canvas (debounced 750ms, IDB only)
  const saveCanvas = useCallback((dataUrl: string) => {
    setSyncStatus('saving');
    setCanvasData(dataUrl);
    if (canvasTimerRef.current) clearTimeout(canvasTimerRef.current);
    canvasTimerRef.current = setTimeout(async () => {
      const key = `annotation-canvas-${contentId}`;
      await saveFile(key, dataUrl);
      upsert({ canvasStorageKey: key });
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }, 750);
  }, [contentId, upsert]);

  // Clear annotation entirely
  const clearAnnotation = useCallback(() => {
    const existing = data?.pluginData?.annotations ?? [];
    const updated = existing.filter((a: QuizAnnotation) => a.contentId !== contentId);
    updatePluginData({ annotations: updated });
    setCanvasData(null);
    setSyncStatus('idle');
  }, [contentId, data, updatePluginData]);

  // Cleanup timers on unmount / contentId change
  useEffect(() => {
    return () => {
      if (textTimerRef.current) clearTimeout(textTimerRef.current);
      if (canvasTimerRef.current) clearTimeout(canvasTimerRef.current);
    };
  }, [contentId]);

  return { annotation, canvasData, saveText, saveCanvas, clearAnnotation, syncStatus, hasAnnotation };
}
