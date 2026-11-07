/** Campos básicos do design system. */
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal, Search, X } from 'lucide-react';
import type { Option } from '@/engine/character/catalog';
import { openContextMenu, type ContextMenuItem } from '@/state/uiStore';

export function SelectField({ label, value, options, onChange, testId, disabled }: { label: string; value: string; options: Option[]; onChange: (v: string) => void; testId?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} disabled={disabled} data-testid={testId} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function TextField({ label, value, onChange, testId, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; testId?: string; placeholder?: string; multiline?: boolean }) {
  const id = useId();
  const stop = (e: React.KeyboardEvent) => e.stopPropagation();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} className="input" rows={3} value={value} placeholder={placeholder} data-testid={testId} onKeyDown={stop} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="input" value={value} placeholder={placeholder} data-testid={testId} onKeyDown={stop} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function ColorField({ label, value, onChange, palette, testId }: { label: string; value: string; onChange: (v: string) => void; palette?: string[]; testId?: string }) {
  const id = useId();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = /^#[0-9a-f]{6}$/i.test(text);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="color-row">
        <input id={id} type="color" aria-label={`${label}: escolher cor`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#888888'} data-testid={testId} onChange={(e) => onChange(e.target.value)} />
        <input
          className={`input color-hex${valid ? '' : ' is-invalid'}`}
          aria-label={`${label}: código hexadecimal`}
          aria-invalid={!valid}
          value={text}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value);
          }}
          onBlur={() => setText(value)}
        />
      </div>
      {palette && (
        <div className="swatches" role="group" aria-label={`Paleta de ${label}`}>
          {palette.map((c) => (
            <button key={c} type="button" className={`swatch${c.toLowerCase() === value.toLowerCase() ? ' is-active' : ''}`} style={{ background: c }} aria-label={`Cor ${c}`} aria-pressed={c.toLowerCase() === value.toLowerCase()} onClick={() => onChange(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ToggleField({ label, checked, onChange, hint, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; testId?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} data-testid={testId} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span className="toggle-text">{label}{hint && <small>{hint}</small>}</span>
    </label>
  );
}

export function Section({ title, children, defaultOpen = true, actions, testId }: { title: string; children: React.ReactNode; defaultOpen?: boolean; actions?: React.ReactNode; testId?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`section${open ? ' is-open' : ''}`} data-testid={testId}>
      <div className="section-head">
        <button type="button" className="section-title" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {title}
        </button>
        {actions}
      </div>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

export function SearchBox({ value, onChange, placeholder, testId }: { value: string; onChange: (v: string) => void; placeholder: string; testId?: string }) {
  return (
    <div className="searchbox">
      <Search size={14} aria-hidden="true" />
      <input aria-label={placeholder} placeholder={placeholder} value={value} data-testid={testId} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => onChange(e.target.value)} />
      {value && <button type="button" aria-label="Limpar busca" onClick={() => onChange('')}><X size={14} /></button>}
    </div>
  );
}

export function IconButton({ label, onClick, children, disabled, active, danger, testId, className }: { label: string; onClick?: (e: React.MouseEvent) => void; children: React.ReactNode; disabled?: boolean; active?: boolean; danger?: boolean; testId?: string; className?: string }) {
  return (
    <button type="button" className={`icon-btn${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}${className ? ` ${className}` : ''}`} title={label} aria-label={label} aria-pressed={active === undefined ? undefined : active} disabled={disabled} data-testid={testId} onClick={onClick}>
      {children}
    </button>
  );
}

/** Botão "…" universal: a alternativa explícita ao menu de contexto no toque. */
export function MoreButton({ label, items, testId }: { label: string; items: () => ContextMenuItem[]; testId?: string }) {
  return (
    <IconButton label={label} testId={testId} onClick={(e) => {
      e.stopPropagation();
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      openContextMenu({ x: r.left, y: r.bottom + 4, items: items(), title: label });
    }}>
      <MoreHorizontal size={16} />
    </IconButton>
  );
}

/** Toque longo abre o mesmo menu do clique direito. */
export function useLongPress(callback: (x: number, y: number) => void, ms = 520) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = setTimeout(() => callback(e.clientX, e.clientY), ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
  };
}

/** Lista virtualizada de altura fixa: só o que está visível existe no DOM. */
export function VirtualList<T>({ items, itemHeight, renderItem, className, testId, overscan = 4, keyOf }: { items: T[]; itemHeight: number; renderItem: (item: T, index: number) => React.ReactNode; className?: string; testId?: string; overscan?: number; keyOf: (item: T) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [height, setHeight] = useState(400);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  const first = Math.max(0, Math.floor(scroll / itemHeight) - overscan);
  const last = Math.min(items.length, Math.ceil((scroll + height) / itemHeight) + overscan);
  return (
    <div ref={ref} className={className} data-testid={testId} onScroll={(e) => setScroll(e.currentTarget.scrollTop)}>
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {items.slice(first, last).map((it, i) => (
          <div key={keyOf(it)} style={{ position: 'absolute', top: (first + i) * itemHeight, left: 0, right: 0, height: itemHeight }}>
            {renderItem(it, first + i)}
          </div>
        ))}
      </div>
    </div>
  );
}
