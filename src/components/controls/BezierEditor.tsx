/**
 * Editor compacto de curva cubic-bezier para o segmento de um keyframe.
 * - gráfico SVG com dois handles arrastáveis (mouse e toque, pointer events);
 * - alternativa sem arrastar: setas do teclado nos handles e campos numéricos (SliderNumberField);
 * - presets e "Restaurar" (volta ao easing nomeado do keyframe).
 * O X dos handles fica em [0,1] e o Y em [-1,2] (overshoot controlado), igual ao limite do modelo.
 */
import { useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { BEZIER_PRESETS, HANDLE_X_MAX, HANDLE_X_MIN, HANDLE_Y_MAX, HANDLE_Y_MIN, cubicBezierEase, sanitizeHandles, type BezierHandles } from '@/engine/animation/bezier';
import { SliderNumberField } from './SliderNumberField';

// Área do gráfico (unidades do viewBox). O Y visível vai de -0.5 a 1.5; além disso o handle é fixado na borda.
const PAD = 14;
const GW = 168; // largura de 1,0 em X
const UNIT_Y = 84; // altura de 1,0 em Y
const VIEW_Y_MIN = -0.5;
const VIEW_Y_MAX = 1.5;
const VIEW_W = GW + PAD * 2;
const VIEW_H = UNIT_Y * (VIEW_Y_MAX - VIEW_Y_MIN) + PAD * 2;

const px = (x: number) => PAD + x * GW;
const py = (y: number) => PAD + (VIEW_Y_MAX - Math.min(VIEW_Y_MAX, Math.max(VIEW_Y_MIN, y))) * UNIT_Y;
const round2 = (v: number) => Math.round(v * 100) / 100;

type HandleKey = 'p1' | 'p2';

export interface BezierEditorProps {
  handles: BezierHandles;
  onChange: (next: BezierHandles) => void;
  onReset: () => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  /** Prefixo dos data-testid */
  testId?: string;
}

export function BezierEditor({ handles, onChange, onReset, onGestureStart, onGestureEnd, testId = 'bezier' }: BezierEditorProps) {
  const h = sanitizeHandles(handles);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<HandleKey | null>(null);

  const apply = (which: HandleKey, x: number, y: number) => {
    const next = which === 'p1' ? { ...h, x1: x, y1: y } : { ...h, x2: x, y2: y };
    onChange(sanitizeHandles({ x1: round2(next.x1), y1: round2(next.y1), x2: round2(next.x2), y2: round2(next.y2) }));
  };

  const fromEvent = (e: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const vx = ((e.clientX - r.left) / r.width) * VIEW_W;
    const vy = ((e.clientY - r.top) / r.height) * VIEW_H;
    return { x: (vx - PAD) / GW, y: VIEW_Y_MAX - (vy - PAD) / UNIT_Y };
  };

  const startDrag = (which: HandleKey) => (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* ponteiro sintético ou já liberado: o arraste continua pelos eventos do próprio handle */
    }
    drag.current = which;
    onGestureStart?.();
  };
  const moveDrag = (which: HandleKey) => (e: React.PointerEvent) => {
    if (drag.current !== which) return;
    const p = fromEvent(e);
    if (p) apply(which, p.x, p.y);
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current) return;
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* já liberado */
    }
    drag.current = null;
    onGestureEnd?.();
  };

  const onKey = (which: HandleKey) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const cur = which === 'p1' ? { x: h.x1, y: h.y1 } : { x: h.x2, y: h.y2 };
    let { x, y } = cur;
    if (e.key === 'ArrowLeft') x -= step;
    else if (e.key === 'ArrowRight') x += step;
    else if (e.key === 'ArrowUp') y += step;
    else if (e.key === 'ArrowDown') y -= step;
    else return;
    e.preventDefault();
    e.stopPropagation();
    apply(which, x, y);
  };

  // Curva amostrada pela MESMA função do renderizador (o que se vê é o que toca).
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    pts.push(`${px(t).toFixed(1)},${py(cubicBezierEase(t, h)).toFixed(1)}`);
  }
  const clipped = (y: number) => y > VIEW_Y_MAX || y < VIEW_Y_MIN;
  const handle = (which: HandleKey, x: number, y: number, label: string) => (
    <g key={which}>
      <line x1={px(which === 'p1' ? 0 : 1)} y1={py(which === 'p1' ? 0 : 1)} x2={px(x)} y2={py(y)} className="bz-stem" />
      <circle
        cx={px(x)} cy={py(y)} r={7}
        className={`bz-handle${clipped(y) ? ' is-clipped' : ''}`}
        role="slider" tabIndex={0}
        aria-label={label}
        aria-valuetext={`x ${x.toFixed(2)}, y ${y.toFixed(2)}`}
        aria-valuenow={Math.round(x * 100)} aria-valuemin={0} aria-valuemax={100}
        data-testid={`${testId}-${which}`}
        onPointerDown={startDrag(which)} onPointerMove={moveDrag(which)} onPointerUp={endDrag} onPointerCancel={endDrag}
        onKeyDown={onKey(which)}
      />
    </g>
  );

  const matches = (p: BezierHandles) => p.x1 === h.x1 && p.y1 === h.y1 && p.x2 === h.x2 && p.y2 === h.y2;

  return (
    <div className="bezier-editor" data-testid={testId}>
      <svg ref={svgRef} className="bz-graph" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="group" aria-label="Curva de aceleração. Arraste os pontos ou use as setas do teclado." data-testid={`${testId}-graph`}>
        <rect x={px(0)} y={py(1)} width={GW} height={py(0) - py(1)} className="bz-unit" />
        <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} className="bz-diag" />
        <polyline points={pts.join(' ')} className="bz-curve" data-testid={`${testId}-curve`} />
        {handle('p1', h.x1, h.y1, 'Ponto de controle 1')}
        {handle('p2', h.x2, h.y2, 'Ponto de controle 2')}
      </svg>
      <div className="bz-presets" role="group" aria-label="Curvas prontas">
        {BEZIER_PRESETS.map((p) => (
          <button key={p.id} type="button" className={`btn btn-sm${matches(p.handles) ? ' is-active' : ''}`} aria-pressed={matches(p.handles)} data-testid={`${testId}-preset-${p.id}`} onClick={() => onChange(sanitizeHandles(p.handles))}>{p.label}</button>
        ))}
      </div>
      <details className="bz-numbers">
        <summary>Valores numéricos</summary>
        <SliderNumberField label="Ponto 1 · X (tempo)" min={HANDLE_X_MIN} max={HANDLE_X_MAX} step={0.01} decimals={2} sliderMin={0} sliderMax={1} value={h.x1} testId={`${testId}-x1`} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} onChange={(v) => onChange(sanitizeHandles({ ...h, x1: v }))} />
        <SliderNumberField label="Ponto 1 · Y (valor)" min={HANDLE_Y_MIN} max={HANDLE_Y_MAX} step={0.01} decimals={2} sliderMin={-1} sliderMax={2} value={h.y1} testId={`${testId}-y1`} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} onChange={(v) => onChange(sanitizeHandles({ ...h, y1: v }))} />
        <SliderNumberField label="Ponto 2 · X (tempo)" min={HANDLE_X_MIN} max={HANDLE_X_MAX} step={0.01} decimals={2} sliderMin={0} sliderMax={1} value={h.x2} testId={`${testId}-x2`} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} onChange={(v) => onChange(sanitizeHandles({ ...h, x2: v }))} />
        <SliderNumberField label="Ponto 2 · Y (valor)" min={HANDLE_Y_MIN} max={HANDLE_Y_MAX} step={0.01} decimals={2} sliderMin={-1} sliderMax={2} value={h.y2} testId={`${testId}-y2`} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} onChange={(v) => onChange(sanitizeHandles({ ...h, y2: v }))} />
      </details>
      <button type="button" className="btn btn-sm" data-testid={`${testId}-reset`} onClick={onReset}><RotateCcw size={13} /> Restaurar curva original</button>
    </div>
  );
}
