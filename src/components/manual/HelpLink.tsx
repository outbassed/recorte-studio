import { CircleHelp } from 'lucide-react';
import { openManual } from '@/state/uiStore';

/** Ajuda contextual: abre o manual no capítulo indicado, sem sair do editor. */
export function HelpLink({ chapter, label }: { chapter: string; label?: string }) {
  return (
    <button type="button" className="help-link" aria-label={label ?? 'Ajuda sobre esta área'} title={label ?? 'Ajuda sobre esta área'} data-testid={`help-${chapter}`} onClick={(e) => { e.stopPropagation(); openManual(chapter); }}>
      <CircleHelp size={14} />
    </button>
  );
}
