/** Modal acessível: trap de foco, Esc fecha, foco volta ao elemento de origem. */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from '../controls/fields';

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, size = 'md', testId, footer }: { title: string; onClose: () => void; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'full'; testId?: string; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => previous?.focus?.();
  }, []);
  // Portal no <body>: um ancestral com transform/filter (ex.: cartão com :hover) transformaria o
  // position:fixed em "relativo ao ancestral" e o modal oscilaria junto com o :hover.
  return createPortal(
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') onCloseRef.current();
          if (e.key === 'Tab') {
            const list = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
            if (!list?.length) return;
            const first = list[0]!;
            const last = list[list.length - 1]!;
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <IconButton label="Fechar" testId="modal-close" onClick={onClose}><X size={18} /></IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
