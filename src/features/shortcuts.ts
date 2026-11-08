/** Atalhos de teclado reais do editor, por categoria. Fonte única para a ajuda, Configurações e o manual. */
export interface Shortcut { keys: string; action: string; category: 'Reprodução' | 'Edição' | 'Palco' | 'Timeline' | 'Janelas' }

export const SHORTCUTS: Shortcut[] = [
  { keys: 'Espaço', action: 'Reproduzir / pausar', category: 'Reprodução' },
  { keys: ', e .', action: 'Quadro anterior / próximo', category: 'Reprodução' },
  { keys: 'Ctrl+Z', action: 'Desfazer', category: 'Edição' },
  { keys: 'Ctrl+Shift+Z ou Ctrl+Y', action: 'Refazer', category: 'Edição' },
  { keys: 'Delete', action: 'Excluir seleção (com confirmação)', category: 'Edição' },
  { keys: 'Ctrl+D', action: 'Duplicar seleção', category: 'Edição' },
  { keys: 'Ctrl+C / Ctrl+V', action: 'Copiar / colar keyframe', category: 'Timeline' },
  { keys: 'K', action: 'Criar keyframes de posição no tempo atual', category: 'Timeline' },
  { keys: 'Ctrl+roda do mouse', action: 'Zoom do palco ou da timeline', category: 'Timeline' },
  { keys: 'Setas', action: 'Mover o elemento 1 px', category: 'Palco' },
  { keys: 'Shift+Setas', action: 'Mover o elemento 10 px', category: 'Palco' },
  { keys: 'F', action: 'Ajustar o palco à janela', category: 'Palco' },
  { keys: 'G', action: 'Grade de terços', category: 'Palco' },
  { keys: 'Q', action: 'Ver somente o quadro exportável', category: 'Palco' },
  { keys: 'Alt+arrastar', action: 'Mover a área de trabalho', category: 'Palco' },
  { keys: 'Shift+clique', action: 'Selecionar vários', category: 'Palco' },
  { keys: 'Esc', action: 'Fechar popup ou limpar seleção', category: 'Janelas' },
  { keys: '?', action: 'Lista de atalhos', category: 'Janelas' },
  { keys: 'F1', action: 'Abrir o manual', category: 'Janelas' },
];
