/**
 * PhysicsDiagramCanvas — Excalidraw wrapper for Physics Practicum
 * Modes:
 *   'view'     — read-only rendering of a stored diagram
 *   'draw'     — full editor (used in question creation)
 *   'annotate' — loads question diagram + student draws on top
 */
import React, {
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
  Component,
  type ReactNode,
} from 'react';
import { exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import pako from 'pako';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/* ── Lazy Excalidraw ────────────────────────────────── */
const ExcalidrawLazy = React.lazy(() =>
  import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw }))
);

/* ── Props ──────────────────────────────────────────── */
export interface Props {
  mode: 'view' | 'draw' | 'annotate';
  initialData?: string | null; // base64(pako.deflate(JSON.stringify(ExcalidrawScene)))
  onChange?: (data: string) => void; // debounced 500ms, same format
  onExportImage?: (base64: string) => void; // JPEG base64 from exportToBlob
  height?: number;
  onClose?: () => void;
}

/* ── Imperative handle ──────────────────────────────── */
export interface PhysicsDiagramCanvasHandle {
  exportCurrentDiagram: () => Promise<string | undefined>;
}

/* ── Diagram data helpers ───────────────────────────── */
function compressDiagram(scene: object): string {
  const json = JSON.stringify(scene);
  const compressed = pako.deflate(json);
  return btoa(String.fromCharCode(...compressed));
}

function decompressDiagram(data: string): object | null {
  try {
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const json = pako.inflate(bytes, { to: 'string' });
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/* ── Physics presets ────────────────────────────────── */
// Free Body Diagram: coordinate axes + object dot + axis labels
const FREE_BODY_PRESET: Omit<ExcalidrawElement, 'id'>[] = [
  // x-axis arrow (horizontal)
  {
    type: 'arrow',
    x: 100,
    y: 300,
    width: 200,
    height: 0,
    angle: 0,
    strokeColor: '#1971c2',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: [[0, 0], [200, 0]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    version: 1,
    versionNonce: 0,
    index: 'a0',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // y-axis arrow (vertical, upward)
  {
    type: 'arrow',
    x: 100,
    y: 300,
    width: 0,
    height: -200,
    angle: 0,
    strokeColor: '#1971c2',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: [[0, 0], [0, -200]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    version: 1,
    versionNonce: 0,
    index: 'a1',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // Object dot (ellipse)
  {
    type: 'ellipse',
    x: 90,
    y: 290,
    width: 20,
    height: 20,
    angle: 0,
    strokeColor: '#e03131',
    backgroundColor: '#e03131',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    version: 1,
    versionNonce: 0,
    index: 'a2',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // x label
  {
    type: 'text',
    x: 310,
    y: 291,
    width: 16,
    height: 20,
    angle: 0,
    strokeColor: '#1971c2',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    fontSize: 16,
    fontFamily: 1,
    text: 'x',
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: 'x',
    lineHeight: 1.25,
    baseline: 14,
    version: 1,
    versionNonce: 0,
    index: 'a3',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // y label
  {
    type: 'text',
    x: 105,
    y: 82,
    width: 16,
    height: 20,
    angle: 0,
    strokeColor: '#1971c2',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    fontSize: 16,
    fontFamily: 1,
    text: 'y',
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: 'y',
    lineHeight: 1.25,
    baseline: 14,
    version: 1,
    versionNonce: 0,
    index: 'a4',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // "Object" label near dot
  {
    type: 'text',
    x: 118,
    y: 291,
    width: 56,
    height: 20,
    angle: 0,
    strokeColor: '#e03131',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    fontSize: 14,
    fontFamily: 1,
    text: 'Object',
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: 'Object',
    lineHeight: 1.25,
    baseline: 12,
    version: 1,
    versionNonce: 0,
    index: 'a5',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
];

// Circuit preset: rectangle (loop) + battery symbol lines + wire segments
const CIRCUIT_PRESET: Omit<ExcalidrawElement, 'id'>[] = [
  // Outer circuit rectangle (wire loop)
  {
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 300,
    height: 200,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    version: 1,
    versionNonce: 0,
    index: 'b0',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // Battery long plate (positive)
  {
    type: 'line',
    x: 230,
    y: 185,
    width: 0,
    height: 30,
    angle: 0,
    strokeColor: '#e03131',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 3,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: [[0, 0], [0, 30]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    version: 1,
    versionNonce: 0,
    index: 'b1',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // Battery short plate (negative)
  {
    type: 'line',
    x: 260,
    y: 192,
    width: 0,
    height: 16,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: [[0, 0], [0, 16]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    version: 1,
    versionNonce: 0,
    index: 'b2',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // Battery label
  {
    type: 'text',
    x: 220,
    y: 155,
    width: 60,
    height: 20,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    fontSize: 14,
    fontFamily: 1,
    text: 'Battery',
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: 'Battery',
    lineHeight: 1.25,
    baseline: 12,
    version: 1,
    versionNonce: 0,
    index: 'b3',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
];

// Ray diagram: optical axis + lens/mirror vertical + focal points
const RAY_DIAGRAM_PRESET: Omit<ExcalidrawElement, 'id'>[] = [
  // Horizontal optical axis
  {
    type: 'line',
    x: 50,
    y: 200,
    width: 500,
    height: 0,
    angle: 0,
    strokeColor: '#868e96',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'dashed',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: [[0, 0], [500, 0]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    version: 1,
    versionNonce: 0,
    index: 'c0',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // Vertical lens/mirror line
  {
    type: 'line',
    x: 300,
    y: 80,
    width: 0,
    height: 240,
    angle: 0,
    strokeColor: '#1971c2',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: [[0, 0], [0, 240]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    version: 1,
    versionNonce: 0,
    index: 'c1',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // Left focal point (F)
  {
    type: 'ellipse',
    x: 191,
    y: 191,
    width: 18,
    height: 18,
    angle: 0,
    strokeColor: '#e03131',
    backgroundColor: '#e03131',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    version: 1,
    versionNonce: 0,
    index: 'c2',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // Right focal point (F)
  {
    type: 'ellipse',
    x: 391,
    y: 191,
    width: 18,
    height: 18,
    angle: 0,
    strokeColor: '#e03131',
    backgroundColor: '#e03131',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    version: 1,
    versionNonce: 0,
    index: 'c3',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // Lens label
  {
    type: 'text',
    x: 308,
    y: 62,
    width: 40,
    height: 20,
    angle: 0,
    strokeColor: '#1971c2',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    fontSize: 14,
    fontFamily: 1,
    text: 'Lens',
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: 'Lens',
    lineHeight: 1.25,
    baseline: 12,
    version: 1,
    versionNonce: 0,
    index: 'c4',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
];

// Wave preset: zigzag approximating a sine wave with arrow
const WAVE_PRESET: Omit<ExcalidrawElement, 'id'>[] = [
  // Horizontal axis
  {
    type: 'line',
    x: 50,
    y: 200,
    width: 400,
    height: 0,
    angle: 0,
    strokeColor: '#868e96',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'dashed',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: [[0, 0], [400, 0]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    version: 1,
    versionNonce: 0,
    index: 'd0',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // Sine-like zigzag wave (arrow, multi-point)
  {
    type: 'arrow',
    x: 50,
    y: 200,
    width: 360,
    height: 0,
    angle: 0,
    strokeColor: '#1971c2',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: { type: 'proportional' },
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: [
      [0, 0],
      [45, -60],
      [90, 0],
      [135, 60],
      [180, 0],
      [225, -60],
      [270, 0],
      [315, 60],
      [360, 0],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    version: 1,
    versionNonce: 0,
    index: 'd1',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
  // "Wave" label
  {
    type: 'text',
    x: 190,
    y: 270,
    width: 120,
    height: 20,
    angle: 0,
    strokeColor: '#1971c2',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    isDeleted: false,
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    fontSize: 14,
    fontFamily: 1,
    text: 'Transverse Wave',
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: 'Transverse Wave',
    lineHeight: 1.25,
    baseline: 12,
    version: 1,
    versionNonce: 0,
    index: 'd2',
  } as unknown as Omit<ExcalidrawElement, 'id'>,
];

function applyPreset(elements: Omit<ExcalidrawElement, 'id'>[]): ExcalidrawElement[] {
  return elements.map(el => ({ ...el, id: crypto.randomUUID() })) as ExcalidrawElement[];
}

/* ── Error Boundary ─────────────────────────────────── */
interface ErrorBoundaryState {
  hasError: boolean;
}

class ExcalidrawErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.warn('PhysicsDiagramCanvas — Excalidraw error:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--text-muted, #888)',
            fontSize: 14,
            background: 'var(--bg-secondary, #1a1a1a)',
            borderRadius: 8,
            border: '1px solid var(--border, #333)',
          }}
        >
          Diagram editor unavailable. Submit your written answer to continue.
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Main Component ─────────────────────────────────── */
const PhysicsDiagramCanvas = forwardRef<PhysicsDiagramCanvasHandle, Props>(
  function PhysicsDiagramCanvas(
    { mode, initialData, onChange, onExportImage, height = 400, onClose },
    ref
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const excalidrawAPI = useRef<any>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    /* ── Decode initial scene ─────────────────────────── */
    const parsedInitialData = (() => {
      if (!initialData) {
        return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, scrollToContent: true };
      }
      const scene = decompressDiagram(initialData);
      if (!scene) {
        return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, scrollToContent: true };
      }
      return { ...(scene as object), scrollToContent: true };
    })();

    /* ── Export function ──────────────────────────────── */
    async function exportCurrentDiagram(): Promise<string | undefined> {
      if (!excalidrawAPI.current) return undefined;
      try {
        const blob = await exportToBlob({
          elements: excalidrawAPI.current.getSceneElements(),
          appState: excalidrawAPI.current.getAppState(),
          files: excalidrawAPI.current.getFiles(),
          mimeType: 'image/jpeg',
          quality: 0.7,
        });
        return new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn('Diagram export failed:', err);
        return undefined;
      }
    }

    /* ── Expose imperative handle ─────────────────────── */
    useImperativeHandle(ref, () => ({ exportCurrentDiagram }));

    /* ── onChange handler (debounced) ─────────────────── */
    const handleChange = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (elements: readonly any[], appState: any, files: any) => {
        if (!onChange && !onExportImage) return;

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
          if (onChange) {
            const scene = {
              elements: Array.from(elements),
              appState: { viewBackgroundColor: appState?.viewBackgroundColor ?? '#ffffff' },
              files: files ?? {},
            };
            try {
              onChange(compressDiagram(scene));
            } catch (err) {
              console.warn('PhysicsDiagramCanvas compress error:', err);
            }
          }
        }, 500);
      },
      [onChange, onExportImage]
    );

    /* ── Cleanup debounce on unmount ──────────────────── */
    useEffect(() => {
      return () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
      };
    }, []);

    /* ── Preset apply ─────────────────────────────────── */
    function applyPresetToCanvas(preset: Omit<ExcalidrawElement, 'id'>[]): void {
      if (!excalidrawAPI.current) return;
      const existing = excalidrawAPI.current.getSceneElements() as ExcalidrawElement[];
      const newElements = applyPreset(preset);
      excalidrawAPI.current.updateScene({ elements: [...existing, ...newElements] });
    }

    const isEditable = mode === 'draw' || mode === 'annotate';

    /* ── Render ───────────────────────────────────────── */
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          width: '100%',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--border, #333)',
          background: 'var(--bg-secondary, #1a1a1a)',
        }}
      >
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close diagram"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 20,
              background: 'rgba(0,0,0,0.55)',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        )}

        {/* Excalidraw canvas */}
        <div style={{ height, position: 'relative' }}>
          <ExcalidrawErrorBoundary>
            <React.Suspense
              fallback={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    fontSize: 13,
                    color: 'var(--text-muted, #888)',
                  }}
                >
                  Loading diagram editor…
                </div>
              }
            >
              <ExcalidrawLazy
                initialData={parsedInitialData}
                onChange={isEditable ? handleChange : undefined}
                viewModeEnabled={mode === 'view'}
                excalidrawAPI={(api: unknown) => {
                  excalidrawAPI.current = api;
                }}
              />
            </React.Suspense>
          </ExcalidrawErrorBoundary>
        </div>

        {/* Preset toolbar — draw / annotate only */}
        {isEditable && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: '8px 10px',
              borderTop: '1px solid var(--border, #333)',
              background: 'var(--bg-primary, #111)',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted, #888)',
                alignSelf: 'center',
                marginRight: 4,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Presets:
            </span>
            <PresetButton
              label="+ FBD"
              title="Free Body Diagram — coordinate axes and object"
              onClick={() => applyPresetToCanvas(FREE_BODY_PRESET)}
            />
            <PresetButton
              label="+ Circuit"
              title="Simple circuit loop with battery symbol"
              onClick={() => applyPresetToCanvas(CIRCUIT_PRESET)}
            />
            <PresetButton
              label="+ Ray Diagram"
              title="Ray diagram — optical axis, lens/mirror, focal points"
              onClick={() => applyPresetToCanvas(RAY_DIAGRAM_PRESET)}
            />
            <PresetButton
              label="+ Wave"
              title="Transverse wave diagram"
              onClick={() => applyPresetToCanvas(WAVE_PRESET)}
            />
          </div>
        )}
      </div>
    );
  }
);

/* ── Preset Button ──────────────────────────────────── */
function PresetButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'inherit',
        background: 'var(--bg-secondary, #1a1a1a)',
        border: '1px solid var(--border, #333)',
        borderRadius: 5,
        color: 'var(--text-primary, #eee)',
        cursor: 'pointer',
        transition: 'border-color 0.12s, background 0.12s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent, #F5A623)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent, #F5A623)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border, #333)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary, #eee)';
      }}
    >
      {label}
    </button>
  );
}

export default PhysicsDiagramCanvas;
