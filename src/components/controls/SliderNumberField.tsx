/**
 * Slider + caixa numérica: componente ÚNICO para qualquer barrinha do app.
 *
 * Contrato (testado em SliderNumberField.test.tsx):
 *  - slider → número sem atraso; número → slider e preview;
 *  - aceita negativos e decimais, com vírgula ou ponto;
 *  - pode ficar vazio ou só com "-" enquanto se digita, sem sobrescrever a digitação;
 *  - valor fora do alcance do slider é mantido: o slider apenas satura;
 *  - fora dos limites reais do motor: mostra erro e, ao confirmar, usa o limite;
 *  - um gesto inteiro gera uma só entrada de histórico (onGestureStart/End).
 */
import { useId, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

export interface SliderNumberFieldProps {
  label: string;
  value: number;
  onChange: (stored: number) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  min?: number;
  max?: number;
  sliderMin?: number;
  sliderMax?: number;
  step?: number;
  unit?: string;
  /** valor exibido = guardado × display */
  display?: number;
  decimals?: number;
  disabled?: boolean;
  testId?: string;
  /** Elemento extra à direita do rótulo (botão de keyframe etc.) */
  extra?: React.ReactNode;
  stepper?: boolean;
}

export function parseNumberInput(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || t === '-' || t === '+' || t === '.' || t === '-.') return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

export function formatNumber(v: number, decimals: number): string {
  const r = Number(v.toFixed(decimals));
  return String(Object.is(r, -0) ? 0 : r).replace('.', ',');
}

export function SliderNumberField(p: SliderNumberFieldProps) {
  const display = p.display ?? 1;
  const decimals = p.decimals ?? 1;
  const step = p.step ?? 1;
  const shown = p.value * display;
  const hardMin = p.min !== undefined ? p.min * display : undefined;
  const hardMax = p.max !== undefined ? p.max * display : undefined;
  const sMin = p.sliderMin ?? hardMin ?? 0;
  const sMax = p.sliderMax ?? hardMax ?? 100;
  const id = useId();

  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const gesture = useRef(false);
  const shownText = text ?? formatNumber(shown, decimals);

  const limitMsg = (v: number): string => {
    if (hardMin !== undefined && v < hardMin) return `Mínimo: ${formatNumber(hardMin, decimals)}${p.unit ? ` ${p.unit}` : ''}`;
    if (hardMax !== undefined && v > hardMax) return `Máximo: ${formatNumber(hardMax, decimals)}${p.unit ? ` ${p.unit}` : ''}`;
    return '';
  };

  const emit = (shownValue: number) => p.onChange(shownValue / display);

  const startGesture = () => {
    if (!gesture.current) {
      gesture.current = true;
      p.onGestureStart?.();
    }
  };
  const endGesture = () => {
    if (gesture.current) {
      gesture.current = false;
      p.onGestureEnd?.();
    }
  };

  const onTyping = (raw: string) => {
    setText(raw);
    const v = parseNumberInput(raw);
    if (v === null) {
      // Vazio ou "-" são estados válidos DURANTE a digitação.
      setError(raw.trim() === '' || /^[-+.,]$/.test(raw.trim()) ? '' : 'Digite um número válido');
      return;
    }
    const msg = limitMsg(v);
    setError(msg);
    if (!msg) {
      startGesture();
      emit(v);
    }
  };

  const confirm = () => {
    if (text === null) return;
    const v = parseNumberInput(text);
    if (v === null) {
      // Valor inválido ao confirmar: volta para o último válido e avisa.
      if (text.trim() !== '' && !/^[-+.,]$/.test(text.trim())) setError('Número inválido: valor anterior mantido');
      setText(null);
      endGesture();
      return;
    }
    const msg = limitMsg(v);
    if (msg) {
      const clamped = Math.min(hardMax ?? v, Math.max(hardMin ?? v, v));
      startGesture();
      emit(clamped);
      setError(`${msg}: valor ajustado`);
    }
    else setError('');
    setText(null);
    endGesture();
  };

  const bump = (dir: number) => {
    const base = parseNumberInput(shownText) ?? shown;
    let next = Number((base + dir * step).toFixed(6));
    if (hardMin !== undefined) next = Math.max(hardMin, next);
    if (hardMax !== undefined) next = Math.min(hardMax, next);
    setText(null);
    setError('');
    emit(next);
  };

  const saturated = shown < sMin || shown > sMax;
  return (
    <div className={`snf${p.disabled ? ' is-disabled' : ''}`} data-testid={p.testId}>
      <div className="snf-head">
        <label className="field-label" htmlFor={id}>{p.label}</label>
        {p.extra}
      </div>
      <div className="snf-row">
        <input
          type="range"
          className={saturated ? 'is-saturated' : ''}
          aria-label={`${p.label} (barra)`}
          min={sMin}
          max={sMax}
          step={step}
          disabled={p.disabled}
          value={Math.min(sMax, Math.max(sMin, shown))}
          onPointerDown={startGesture}
          onPointerUp={endGesture}
          onKeyDown={startGesture}
          onKeyUp={endGesture}
          onBlur={endGesture}
          onChange={(e) => {
            setText(null);
            setError('');
            emit(Number(e.target.value));
          }}
        />
        <div className={`snf-box${error ? ' has-error' : ''}`}>
          {p.stepper !== false && (
            <button type="button" className="snf-step" tabIndex={-1} aria-label={`Diminuir ${p.label}`} disabled={p.disabled} onClick={() => bump(-1)}><Minus size={12} /></button>
          )}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : undefined}
            disabled={p.disabled}
            value={shownText}
            onFocus={(e) => {
              setText(formatNumber(shown, decimals));
              e.target.select();
            }}
            onChange={(e) => onTyping(e.target.value)}
            onBlur={confirm}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                confirm();
                e.currentTarget.blur();
              }
              if (e.key === 'Escape') {
                setText(null);
                setError('');
                endGesture();
                e.currentTarget.blur();
              }
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                bump(e.key === 'ArrowUp' ? 1 : -1);
              }
              e.stopPropagation();
            }}
          />
          {p.unit && <span className="snf-unit">{p.unit}</span>}
          {p.stepper !== false && (
            <button type="button" className="snf-step" tabIndex={-1} aria-label={`Aumentar ${p.label}`} disabled={p.disabled} onClick={() => bump(1)}><Plus size={12} /></button>
          )}
        </div>
      </div>
      {error && <div className="snf-error" id={`${id}-err`} role="alert">{error}</div>}
    </div>
  );
}
