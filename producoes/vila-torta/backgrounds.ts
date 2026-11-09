/**
 * Cenários do episódio: composições do Criador de Cenários (peças 2D por camadas, editáveis).
 * Cenários que o Recorte Studio já traz (rua, praça, sala, estúdio) são usados direto, com
 * objetos nativos por cima.
 */
import { createPiece } from '@/engine/world/pieces';
import { createCustomBackground } from '@/engine/world/customBackgrounds';
import type { CustomBackground, Piece, Project } from '@/engine/model/schema';
import type { BgSpec } from './lib';

const INK = '#23202b';
type P = Partial<Piece>;
const R = (x: number, y: number, w: number, h: number, fill: string, o: P = {}) => createPiece('rect', { x, y, w, h, fill, stroke: INK, strokeWidth: 4, ...o });
const E = (x: number, y: number, w: number, h: number, fill: string, o: P = {}) => createPiece('ellipse', { x, y, w, h, fill, stroke: INK, strokeWidth: 4, ...o });
const L = (x: number, y: number, w: number, stroke: string, sw = 5, rotation = 0, o: P = {}) => createPiece('line', { x, y, w, h: 1, stroke, strokeWidth: sw, rotation, ...o });
const T = (text: string, x: number, y: number, size: number, fill = INK, o: P = {}) => createPiece('text', { text, x, y, fontSize: size, fill, strokeWidth: 0, fontWeight: '900', ...o });
const TRI = (x: number, y: number, w: number, h: number, fill: string, o: P = {}) => createPiece('triangle', { x, y, w, h, fill, stroke: INK, strokeWidth: 4, ...o });
const BG = (x: number, y: number, w: number, h: number, fill: string, o: P = {}) => R(x, y, w, h, fill, { strokeWidth: 0, ...o });

/** Piso com réguas de perspectiva leves. */
function floor(y0: number, color: string, line: string): Piece[] {
  const out: Piece[] = [BG(0, (y0 + 700) / 2, 2208, 700 - y0, color, { name: 'Piso' }), L(0, y0, 2208, INK, 4, 0, { opacity: 0.55, name: 'Rodapé do piso' })];
  for (let i = 1; i < 6; i++) out.push(L(0, y0 + i * i * 14, 2208, line, 3, 0, { opacity: 0.5, name: `Junta ${i}` }));
  return out;
}

function patio(): Piece[] {
  const p: Piece[] = [];
  p.push(BG(0, -245, 2208, 790, '#efe3b8', { name: 'Fachada' }), BG(0, 105, 2208, 90, '#d8c48a', { name: 'Friso' }));
  for (let i = 0; i < 8; i++) {
    const x = -900 + i * 260;
    p.push(R(x, -250, 130, 150, '#a8d4e8', { name: `Janela ${i + 1}`, strokeWidth: 5 }), L(x, -250, 150, '#efe3b8', 8, 90, { name: `Esquadria ${i + 1}` }), L(x, -250, 130, '#efe3b8', 8, 0, { name: `Peitoril ${i + 1}` }));
  }
  p.push(R(0, -170, 220, 330, '#8c6a4f', { name: 'Portão', strokeWidth: 6 }), R(-52, -170, 90, 300, '#a6764e', { name: 'Folha esquerda' }), R(52, -170, 90, 300, '#a6764e', { name: 'Folha direita' }));
  p.push(R(0, -420, 760, 74, '#3b6fb6', { name: 'Faixa da escola', radius: 8, strokeWidth: 6 }), T('ESCOLA MUNICIPAL VILA TORTA', 0, -420, 44, '#fff7e6', { name: 'Nome da escola' }));
  p.push(...floor(150, '#cdc6b8', '#a9a293'));
  p.push(R(0, 330, 1500, 14, '#fff7e6', { name: 'Linha da quadra', strokeWidth: 0, opacity: 0.8 }), E(0, 330, 220, 60, 'none', { name: 'Círculo da quadra', stroke: '#fff7e6', strokeWidth: 6, opacity: 0.8 }));
  // árvores e bancos laterais
  for (const x of [-960, 960]) p.push(R(x, -30, 34, 240, '#7c5a44', { name: 'Tronco' }), E(x, -230, 300, 240, '#5f9c6c', { name: 'Copa' }));
  p.push(R(-640, 150, 240, 26, '#a6764e', { name: 'Banco' }), R(-640, 195, 20, 40, '#3d4a4a', { name: 'Pé' }), R(-540, 195, 20, 40, '#3d4a4a', { name: 'Pé' }));
  p.push(R(700, 130, 14, 330, '#6b7580', { name: 'Tabela' }), R(700, -40, 120, 80, '#fff7e6', { name: 'Tabela de basquete', strokeWidth: 5 }));
  return p;
}

function camarim(main: string, mainDark: string, accent: string, slogan: string, hat: boolean): Piece[] {
  const p: Piece[] = [BG(0, -120, 2208, 760, main, { name: 'Parede' }), BG(0, 130, 2208, 56, mainDark, { name: 'Rodapé' })];
  for (let i = -5; i <= 5; i++) p.push(L(i * 210, -120, 800, mainDark, 3, 90, { opacity: 0.18, name: 'Ripado' }));
  p.push(...floor(180, '#7c5a44', '#5e4635'));
  // espelho com lâmpadas
  p.push(R(0, -60, 760, 360, '#cbe5ef', { name: 'Espelho', radius: 18, strokeWidth: 8 }), L(-170, -90, 160, '#fff', 14, -35, { opacity: 0.6, name: 'Reflexo' }), L(-60, -30, 120, '#fff', 10, -35, { opacity: 0.5, name: 'Reflexo' }));
  for (let i = 0; i < 9; i++) p.push(E(-340 + i * 85, -260, 34, 34, '#fff3b0', { name: `Lâmpada ${i + 1}`, strokeWidth: 3 }), E(-340 + i * 85, 140, 34, 34, '#fff3b0', { name: `Lâmpada baixa ${i + 1}`, strokeWidth: 3 }));
  for (let i = 0; i < 4; i++) p.push(E(-400, -170 + i * 100, 34, 34, '#fff3b0', { name: `Lâmpada esq ${i + 1}`, strokeWidth: 3 }), E(400, -170 + i * 100, 34, 34, '#fff3b0', { name: `Lâmpada dir ${i + 1}`, strokeWidth: 3 }));
  // bancada
  p.push(R(0, 200, 840, 40, '#a6764e', { name: 'Bancada', radius: 6 }), R(-360, 270, 24, 130, '#6e5038', { name: 'Perna' }), R(360, 270, 24, 130, '#6e5038', { name: 'Perna' }));
  p.push(R(-300, 168, 60, 28, '#f4f1ea', { name: 'Pó compacto' }), R(-200, 160, 36, 44, '#d27ba6', { name: 'Frasco' }), R(240, 168, 80, 28, '#e9e4d8', { name: 'Toalha' }));
  // cabideiro à esquerda e pôster
  p.push(L(-780, -40, 320, '#6b7580', 8, 0, { name: 'Cabideiro' }), R(-920, 150, 14, 380, '#6b7580', { name: 'Poste esquerdo' }), R(-640, 150, 14, 380, '#6b7580', { name: 'Poste direito' }));
  for (let i = 0; i < 4; i++) p.push(R(-860 + i * 66, 20, 46, 140, accent, { name: `Terno ${i + 1}`, radius: 14, strokeWidth: 4 }), E(-860 + i * 66, -62, 10, 18, '#6b7580', { name: `Cabide ${i + 1}`, strokeWidth: 2 }));
  p.push(R(780, -190, 260, 320, '#fffdf6', { name: 'Pôster', strokeWidth: 5 }), T(slogan, 780, -190, 30, accent, { name: 'Slogan', rotation: -3 }));
  if (hat) p.push(R(900, 40, 14, 260, '#6b7580', { name: 'Suporte de chapéu' }), R(900, -50, 100, 110, '#e98f4e', { name: 'Cartola', radius: 8 }), R(900, -110, 140, 16, '#e98f4e', { name: 'Aba' }));
  return p;
}

function grafica(): Piece[] {
  const p: Piece[] = [BG(0, -120, 2208, 760, '#e7e1cc', { name: 'Parede' }), BG(0, 140, 2208, 50, '#c9c2a8', { name: 'Rodapé' }), ...floor(190, '#b5b0a2', '#8f8a7c')];
  // prateleiras de papel
  for (let r = 0; r < 3; r++) {
    p.push(R(-700, -330 + r * 150, 640, 14, '#7c5a44', { name: `Prateleira ${r + 1}` }));
    for (let i = 0; i < 9; i++) p.push(R(-960 + i * 62 + 50, -366 + r * 150, 48, 54, ['#fffdf6', '#f2c95c', '#a8d4e8', '#f4a6a6'][(i + r) % 4]!, { name: `Resma ${r}.${i}`, strokeWidth: 3 }));
  }
  p.push(R(540, -150, 520, 420, '#fffdf6', { name: 'Quadro de avisos', strokeWidth: 6 }), T('ORÇAMENTOS', 540, -310, 40, INK, { name: 'Aviso' }), T('Pagamento no prazo!', 540, -250, 30, '#2f7a4a', { name: 'Aviso 2' }), T('Fiado só amanhã.', 540, -200, 26, '#d63b3b', { name: 'Aviso 3', fontWeight: '700' }));
  p.push(R(920, -90, 6, 60, '#d63b3b', { name: 'Alfinete' }));
  p.push(E(-980, 10, 220, 220, '#9aa3ad', { name: 'Rolo de papel' }), E(-980, 10, 60, 60, '#6b7580', { name: 'Eixo' }));
  return p;
}

function comite(): Piece[] {
  const p: Piece[] = [BG(0, -120, 2208, 760, '#dfe6f2', { name: 'Parede' }), BG(0, 140, 2208, 56, '#8aa3c6', { name: 'Rodapé' }), ...floor(190, '#9aa3ad', '#7b838c')];
  p.push(R(-720, -250, 380, 520, '#3b6fb6', { name: 'Banner azul', strokeWidth: 6 }), T('PINOTE', -720, -230, 80, '#fff7e6', { name: 'Banner nome' }), T('TIRA O GAIVOTA', -720, -140, 38, '#f2c95c', { name: 'Banner frase' }));
  p.push(R(0, -240, 460, 290, '#fffdf6', { name: 'Quadro branco', strokeWidth: 8 }), T('PROPOSTAS:', -90, -330, 38, INK, { name: 'Título quadro', align: 'start' }), T('1) Tirar o Gaivota', -90, -270, 30, '#d63b3b', { name: 'Item 1', fontWeight: '700', align: 'start' }), T('2) ...', -90, -220, 30, '#6b7580', { name: 'Item 2', fontWeight: '700', align: 'start' }), T('3) ???', -90, -170, 30, '#6b7580', { name: 'Item 3', fontWeight: '700', align: 'start' }));
  p.push(R(720, -200, 300, 400, '#e8f0ff', { name: 'Mapa da cidade', strokeWidth: 5 }), L(720, -200, 220, '#3b6fb6', 8, 20, { name: 'Rua' }), E(760, -160, 24, 24, '#d63b3b', { name: 'Buraco 1' }), E(680, -220, 24, 24, '#d63b3b', { name: 'Buraco 2' }));
  p.push(R(-300, 230, 520, 36, '#8c6a4f', { name: 'Mesa' }), R(-540, 330, 20, 130, '#6e5038', { name: 'Perna' }), R(-60, 330, 20, 130, '#6e5038', { name: 'Perna' }));
  p.push(R(-420, 190, 120, 34, '#fff7e6', { name: 'Caixa de pizza' }), R(-320, 170, 90, 24, '#fffdf6', { name: 'Papéis' }));
  return p;
}

function setup(project: Project, name: string, sky: string, pieces: Piece[]): CustomBackground {
  const cb = createCustomBackground(project, name);
  cb.compositions.day = { sky, pieces };
  return cb;
}

export function buildBackgrounds(project: Project): Record<string, BgSpec> {
  const day = (cb: CustomBackground): BgSpec => ({ preset: `custom:${cb.id}`, tod: 'day', parallax: 0.5 });
  return {
    patio: day(setup(project, 'Pátio escolar', '#a8d4e8', patio())),
    camarimG: day(setup(project, 'Camarim do Gaivota', '#e98f4e', camarim('#f0b27a', '#c97b3d', '#e98f4e', 'GAIVOTA\nMAIS 4 ANOS', true))),
    camarimP: day(setup(project, 'Camarim do Pinote', '#3b6fb6', camarim('#8fb0e0', '#4a6fb0', '#3b6fb6', 'PINOTE\nNÃO SOU\nO GAIVOTA', false))),
    grafica: day(setup(project, 'Gráfica', '#e7e1cc', grafica())),
    comite: day(setup(project, 'Comitê do Pinote', '#dfe6f2', comite())),
    // nativos
    rua: { preset: 'rua', variant: 'day' },
    praca: { preset: 'praca', variant: 'day' },
    sala: { preset: 'sala', variant: 'day' },
    estudio: { preset: 'estudio' },
    carro: { preset: 'carro' },
    salaaula: { preset: 'salaaula' },
    escola: { preset: 'corredor' },
    centro: { preset: 'centro', variant: 'day' },
  };
}
