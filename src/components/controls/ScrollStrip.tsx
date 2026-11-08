/**
 * Faixa horizontal rolável (abas, filtros, chips). Quando o conteúdo passa da largura:
 *  - barra de rolagem fina e VISÍVEL (não depende de gesto escondido);
 *  - setas laterais que rolam e ficam desabilitadas no fim (pista que some ao chegar à ponta);
 *  - roda do mouse vertical vira rolagem horizontal (Shift+roda e touchpad já são nativos);
 *  - o item ativo ou focado é trazido para a área visível, rolando SÓ a faixa, nunca a página.
 * Sem excesso, nada disso aparece e a faixa se comporta como uma linha comum.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ACTIVE = '[aria-selected="true"], [aria-pressed="true"], .is-active';
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Rola `strip` o mínimo para `el` ficar inteiro à vista (com uma folga). */
export function revealInStrip(strip: HTMLElement, el: HTMLElement, smooth = true): void {
  const s = strip.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const pad = 24;
  let left = strip.scrollLeft;
  if (r.left < s.left + pad) left -= s.left + pad - r.left;
  else if (r.right > s.right - pad) left += r.right - (s.right - pad);
  else return;
  strip.scrollTo({ left: Math.max(0, left), behavior: smooth && !reduced() ? 'smooth' : 'auto' });
}

export function ScrollStrip({ className = '', children, role, ariaLabel, testId, watch }: {
  className?: string; children: React.ReactNode; role?: string; ariaLabel?: string; testId?: string;
  /** Muda quando o item ativo muda (reposiciona a faixa). */
  watch?: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState({ over: false, left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const over = el.scrollWidth > el.clientWidth + 1;
    const left = over && el.scrollLeft > 1;
    const right = over && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setSt((o) => (o.over === over && o.left === left && o.right === right ? o : { over, left, right }));
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    const mo = new MutationObserver(() => { for (const c of el.children) ro.observe(c); update(); });
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    el.addEventListener('scroll', update, { passive: true });
    // Roda vertical → horizontal, só se a faixa ainda puder andar naquele sentido (senão a página rola).
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    // Foco por teclado num item escondido: traz para a área visível.
    const onFocus = (e: FocusEvent) => { if (e.target instanceof HTMLElement && e.target !== el) revealInStrip(el, e.target, false); };
    el.addEventListener('focusin', onFocus);
    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener('scroll', update);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('focusin', onFocus);
    };
  }, [update]);

  // Item ativo sempre à vista quando muda (clique, teclado ou mudança vinda de outro lugar).
  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>(ACTIVE);
    if (el && active) revealInStrip(el, active);
  }, [watch]);

  const by = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(80, el.clientWidth * 0.7), behavior: reduced() ? 'auto' : 'smooth' });
  };
  return (
    <div className={`hstrip${st.over ? ' is-over' : ''}${st.left ? ' has-left' : ''}${st.right ? ' has-right' : ''}`} data-testid={testId ? `${testId}-strip` : undefined}>
      {st.over && <button type="button" className="hstrip-arrow" tabIndex={-1} aria-label="Rolar para a esquerda" disabled={!st.left} data-testid={testId ? `${testId}-left` : undefined} onClick={() => by(-1)}><ChevronLeft size={14} /></button>}
      <div ref={ref} className={`hstrip-scroll ${className}`} role={role} aria-label={ariaLabel} data-testid={testId}>{children}</div>
      {st.over && <button type="button" className="hstrip-arrow" tabIndex={-1} aria-label="Rolar para a direita" disabled={!st.right} data-testid={testId ? `${testId}-right` : undefined} onClick={() => by(1)}><ChevronRight size={14} /></button>}
    </div>
  );
}
