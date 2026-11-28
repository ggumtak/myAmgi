import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconClose, IconEraser, IconPen, IconTrash, IconUndo } from '../../ui';
import { pushOverlay, type OverlayHandle } from '../../ui/overlayStack';

export interface WhiteboardOverlayProps {
  open: boolean;
  cardKey: number | string;
  theme: 'light' | 'dark' | 'eink';
  onClose: () => void;
}

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number;
  eraser: boolean;
}

// Canvas 2D ink palette (canvas drawing APIs require explicit color strings)
const LIGHT_COLORS = [
  { id: 'ink', label: '검정', hex: '#191F28' },
  { id: 'blue', label: '파랑', hex: '#3182F6' },
  { id: 'red', label: '빨강', hex: '#F04452' },
  { id: 'green', label: '초록', hex: '#0BA360' },
];

const DARK_COLORS = [
  { id: 'ink', label: '흰색', hex: '#F2F4F6' },
  { id: 'blue', label: '파랑', hex: '#5AA2FF' },
  { id: 'red', label: '빨강', hex: '#FF6B76' },
  { id: 'green', label: '초록', hex: '#2FD08A' },
];

const WIDTH_PRESETS = [
  { id: 'thin', label: '얇게', px: 2.5 },
  { id: 'med', label: '보통', px: 4.5 },
  { id: 'thick', label: '굵게', px: 8 },
];

function configureStrokeCtx(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  isEink: boolean
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (stroke.eraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    const color = isEink ? '#000000' : stroke.color;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
  }
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  point: StrokePoint,
  isEink: boolean
): void {
  ctx.save();
  configureStrokeCtx(ctx, stroke, isEink);
  const r = stroke.eraser
    ? (stroke.width * 3.2) / 2
    : Math.max(1, (stroke.width * (0.65 + point.pressure * 0.7)) / 2);
  ctx.beginPath();
  ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSegment(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  prev: StrokePoint,
  curr: StrokePoint,
  isEink: boolean
): void {
  ctx.save();
  configureStrokeCtx(ctx, stroke, isEink);
  const pressure = (prev.pressure + curr.pressure) / 2;
  ctx.lineWidth = stroke.eraser
    ? stroke.width * 3.2
    : Math.max(1.2, stroke.width * (0.65 + pressure * 0.75));
  ctx.beginPath();
  ctx.moveTo(prev.x, prev.y);
  ctx.lineTo(curr.x, curr.y);
  ctx.stroke();
  ctx.restore();
}

export const WhiteboardOverlay: React.FC<WhiteboardOverlayProps> = ({
  open,
  cardKey,
  theme,
  onClose,
}) => {
  const isEink = theme === 'eink';
  const palette = isEink
    ? [{ id: 'ink', label: '검정', hex: '#000000' }]
    : theme === 'dark'
      ? DARK_COLORS
      : LIGHT_COLORS;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  // Non-blocking overlay: closes on Android back & Escape via overlayStack, while allowing
  // StudyView shortcuts (Space/Enter/1-4/Volume/B) to keep working with whiteboard open.
  const overlayHandleRef = useRef<OverlayHandle>({ close: onClose, blocking: false });
  overlayHandleRef.current.close = onClose;

  const [colorIdx, setColorIdx] = useState(0);
  const [widthIdx, setWidthIdx] = useState(1);
  const [eraserMode, setEraserMode] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);

  const currentColor = palette[Math.min(colorIdx, palette.length - 1)]?.hex ?? '#191F28';
  const currentWidth = WIDTH_PRESETS[widthIdx]?.px ?? 4.5;

  // Register in global overlay stack while open so Android back & Escape close the whiteboard
  useEffect(() => {
    if (!open) {
      activePointerIdRef.current = null;
      activeStrokeRef.current = null;
      return;
    }

    const handle = overlayHandleRef.current;
    const popOverlay = pushOverlay(handle);

    return () => {
      popOverlay();
      activePointerIdRef.current = null;
      activeStrokeRef.current = null;
    };
  }, [open]);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const drawStroke = (s: Stroke) => {
      if (s.points.length === 0) return;
      if (s.points.length === 1) {
        drawDot(ctx, s, s.points[0], isEink);
        return;
      }
      ctx.save();
      configureStrokeCtx(ctx, s, isEink);
      for (let i = 1; i < s.points.length; i++) {
        const prev = s.points[i - 1];
        const curr = s.points[i];
        const pressure = (prev.pressure + curr.pressure) / 2;
        ctx.lineWidth = s.eraser
          ? s.width * 3.2
          : Math.max(1.2, s.width * (0.65 + pressure * 0.75));
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
      ctx.restore();
    };

    for (const s of strokesRef.current) {
      drawStroke(s);
    }
    if (activeStrokeRef.current) {
      drawStroke(activeStrokeRef.current);
    }
  }, [isEink]);

  const getIncrementalContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      redrawAll();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, rect };
  }, [redrawAll]);

  // Auto-clear canvas whenever card changes (standard AnkiDroid behavior)
  useEffect(() => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    activePointerIdRef.current = null;
    setStrokeCount(0);
    redrawAll();
  }, [cardKey, redrawAll]);

  // Resize canvas cleanly when opened or resized
  useEffect(() => {
    if (!open) return;
    redrawAll();
    const onResize = () => redrawAll();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, redrawAll]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ready = getIncrementalContext();
    if (!ready) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without active pointer
    }
    activePointerIdRef.current = e.pointerId;
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    const startPoint: StrokePoint = {
      x: e.clientX - ready.rect.left,
      y: e.clientY - ready.rect.top,
      pressure,
    };
    const stroke: Stroke = {
      points: [startPoint],
      color: currentColor,
      width: currentWidth,
      eraser: eraserMode,
    };
    activeStrokeRef.current = stroke;
    drawDot(ready.ctx, stroke, startPoint, isEink);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId || !activeStrokeRef.current) return;
    const ready = getIncrementalContext();
    if (!ready) return;

    const stroke = activeStrokeRef.current;
    const nativeEv = e.nativeEvent;
    const samples: PointerEvent[] =
      typeof nativeEv.getCoalescedEvents === 'function'
        ? nativeEv.getCoalescedEvents()
        : [nativeEv];
    const eventsToProcess = samples.length > 0 ? samples : [nativeEv];

    for (const sample of eventsToProcess) {
      const pressure =
        sample.pointerType === 'pen' && sample.pressure > 0 ? sample.pressure : 0.5;
      const curr: StrokePoint = {
        x: sample.clientX - ready.rect.left,
        y: sample.clientY - ready.rect.top,
        pressure,
      };
      const prev = stroke.points[stroke.points.length - 1];
      if (prev && prev.x === curr.x && prev.y === curr.y) continue;
      stroke.points.push(curr);
      if (prev) {
        drawSegment(ready.ctx, stroke, prev, curr, isEink);
      } else {
        drawDot(ready.ctx, stroke, curr, isEink);
      }
    }
  };

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore release errors
      }
    }
    activePointerIdRef.current = null;
    if (activeStrokeRef.current) {
      strokesRef.current.push(activeStrokeRef.current);
      activeStrokeRef.current = null;
      setStrokeCount(strokesRef.current.length);
    }
  };

  const handleUndoStroke = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redrawAll();
  };

  const handleClear = () => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    activePointerIdRef.current = null;
    setStrokeCount(0);
    redrawAll();
  };

  if (!open) return null;

  return (
    <div className="amgi-wb-layer" aria-label="필기장">
      <canvas
        ref={canvasRef}
        className="amgi-wb-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onLostPointerCapture={finishStroke}
      />

      <div className="amgi-wb-toolbar" role="toolbar" aria-label="필기장 도구">
        {!isEink && (
          <div className="amgi-wb-colors" role="group" aria-label="펜 색상">
            {palette.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                className={`amgi-wb-swatch compact ${!eraserMode && colorIdx === idx ? 'active' : ''}`}
                data-compact="true"
                aria-label={`${c.label} 펜`}
                onClick={() => {
                  setColorIdx(idx);
                  setEraserMode(false);
                }}
              >
                <span className="amgi-wb-swatch-dot" style={{ background: c.hex }} />
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={`amgi-wb-btn compact ${!eraserMode ? 'active' : ''}`}
          data-compact="true"
          aria-label="펜 굵기 변경"
          title={`펜 굵기: ${WIDTH_PRESETS[widthIdx].label}`}
          onClick={() => {
            if (eraserMode) {
              setEraserMode(false);
            } else {
              setWidthIdx((i) => (i + 1) % WIDTH_PRESETS.length);
            }
          }}
        >
          <IconPen size={16} />
          <span className="amgi-wb-size-tag">{WIDTH_PRESETS[widthIdx].label}</span>
        </button>

        <button
          type="button"
          className={`amgi-wb-btn compact ${eraserMode ? 'active' : ''}`}
          data-compact="true"
          aria-label="지우개"
          onClick={() => setEraserMode((v) => !v)}
        >
          <IconEraser size={16} />
        </button>

        <button
          type="button"
          className="amgi-wb-btn compact"
          data-compact="true"
          aria-label="획 되돌리기"
          disabled={strokeCount === 0}
          onClick={handleUndoStroke}
        >
          <IconUndo size={16} />
        </button>

        <button
          type="button"
          className="amgi-wb-btn compact"
          data-compact="true"
          aria-label="전체 지우기"
          disabled={strokeCount === 0}
          onClick={handleClear}
        >
          <IconTrash size={16} />
        </button>

        <button
          type="button"
          className="amgi-wb-btn compact"
          data-compact="true"
          aria-label="필기장 닫기"
          onClick={onClose}
        >
          <IconClose size={16} />
        </button>
      </div>
    </div>
  );
};

export default WhiteboardOverlay;
