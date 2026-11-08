/**
 * Fontes do texto (palco, criadores e exportação). Só fontes do sistema, com reserva previsível:
 * nada é baixado da internet, então prévia e vídeo usam a mesma fonte no mesmo computador.
 */
export const FONT_STACKS: Record<'sans' | 'serif' | 'hand' | 'mono', string> = {
  sans: "'Trebuchet MS','Segoe UI',Arial,sans-serif",
  serif: "Georgia,'Times New Roman',serif",
  hand: "'Comic Sans MS','Segoe Print','Trebuchet MS',cursive",
  mono: "Consolas,'Courier New',monospace",
};
export const FONT_OPTIONS = [{ id: 'sans', label: 'Sem serifa' }, { id: 'serif', label: 'Serifada' }, { id: 'hand', label: 'Manuscrita' }, { id: 'mono', label: 'Monoespaçada' }];
