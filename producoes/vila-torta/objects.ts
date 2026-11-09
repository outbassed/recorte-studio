/**
 * Objetos nativos (CustomObject do Criador de Objetos) usados pelo episódio.
 * Origem = centro da base (ou o pivô declarado). Tudo é peça 2D editável.
 */
import { CustomObjectSchema, type CustomObject, type ObjectClip, type Piece } from '@/engine/model/schema';
import { createPiece } from '@/engine/world/pieces';

const INK = '#23202b';
type P = Partial<Piece>;
const R = (x: number, y: number, w: number, h: number, fill: string, o: P = {}) => createPiece('rect', { x, y, w, h, fill, stroke: INK, strokeWidth: 4, radius: 0, ...o });
const E = (x: number, y: number, w: number, h: number, fill: string, o: P = {}) => createPiece('ellipse', { x, y, w, h, fill, stroke: INK, strokeWidth: 4, ...o });
const L = (x: number, y: number, w: number, stroke: string, sw = 6, rotation = 0, o: P = {}) => createPiece('line', { x, y, w, h: 1, stroke, strokeWidth: sw, rotation, ...o });
const T = (text: string, x: number, y: number, size: number, fill = INK, o: P = {}) => createPiece('text', { text, x, y, fontSize: size, fill, strokeWidth: 0, fontWeight: '900', ...o });
const TRI = (x: number, y: number, w: number, h: number, fill: string, o: P = {}) => createPiece('triangle', { x, y, w, h, fill, stroke: INK, strokeWidth: 4, ...o });
const STAR = (x: number, y: number, s: number, fill: string, o: P = {}) => createPiece('star', { x, y, w: s, h: s, fill, stroke: INK, strokeWidth: 3, sides: 5, ...o });

export const ORANGE = '#e98f4e';
export const BLUE = '#3b6fb6';
export const YELLOW = '#f2c95c';

const obj = (id: string, name: string, width: number, height: number, pieces: Piece[], o: Partial<CustomObject> = {}): CustomObject =>
  CustomObjectSchema.parse({ id, name, width, height, pieces, createdAt: 1, updatedAt: 1, ...o });
const frame = (id: string, pieces: Piece[], durationMs = 200) => ({ id, durationMs, pieces });
const clip = (id: string, name: string, frames: Array<ReturnType<typeof frame>>, mode: ObjectClip['mode'] = 'loop'): ObjectClip => ({ id, name, mode, frames });

/* ---------------------------- roda ---------------------------- */
function wheelPieces(): Piece[] {
  const out: Piece[] = [E(0, -60, 120, 120, '#2b2d36', { name: 'Pneu', strokeWidth: 5 }), E(0, -60, 80, 80, '#cfd4d8', { name: 'Aro' })];
  for (let i = 0; i < 5; i++) out.push(L(0, -60, 70, '#6b7580', 7, i * 36, { name: `Raio ${i + 1}` }));
  out.push(E(0, -60, 26, 26, '#9aa3ad', { name: 'Cubo', strokeWidth: 3 }));
  out.push(E(0, -97, 12, 12, '#d63b3b', { name: 'Marca (mostra o giro)', strokeWidth: 2 }));
  for (let i = 0; i < 5; i++) {
    const a = ((i * 72 - 90) * Math.PI) / 180;
    out.push(E(Math.cos(a) * 17, -60 + Math.sin(a) * 17, 7, 7, '#3a3f4b', { strokeWidth: 1, name: `Parafuso ${i + 1}` }));
  }
  return out;
}

function carBody(color: string, win = '#a8d4e8'): Piece[] {
  return [
    E(-210, -92, 150, 104, '#1b1a22', { name: 'Caixa de roda traseira', strokeWidth: 0 }),
    E(210, -92, 150, 104, '#1b1a22', { name: 'Caixa de roda dianteira', strokeWidth: 0 }),
    R(0, -112, 700, 100, color, { name: 'Chassi', radius: 30 }),
    R(235, -150, 230, 58, color, { name: 'Capô', radius: 24 }),
    R(-35, -205, 370, 118, color, { name: 'Cabine', radius: 44 }),
    R(-35, -208, 316, 78, win, { name: 'Vidros', radius: 28, strokeWidth: 4 }),
    L(-35, -208, 78, color, 12, 90, { name: 'Coluna' }),
    L(0, -120, 74, INK, 4, 90, { name: 'Porta (linha)' }),
    R(34, -140, 40, 9, '#9aa3ad', { name: 'Maçaneta', radius: 4, strokeWidth: 3 }),
    E(338, -126, 32, 42, '#f6dc9a', { name: 'Farol', strokeWidth: 4 }),
    R(-344, -128, 20, 44, '#d63b3b', { name: 'Lanterna', radius: 5, strokeWidth: 4 }),
    R(-352, -72, 22, 34, '#9aa3ad', { name: 'Para-choque traseiro', radius: 6 }),
    R(352, -72, 22, 34, '#9aa3ad', { name: 'Para-choque dianteiro', radius: 6 }),
  ];
}

/* ---------------------------- biblioteca ---------------------------- */
export function buildObjects(): Record<string, CustomObject> {
  const list: CustomObject[] = [];

  list.push(obj('obj_roda', 'Roda', 120, 120, wheelPieces(), { pivotX: 0, pivotY: -60 }));
  list.push(obj('obj_carro_corpo', 'Carro (carroceria)', 720, 260, carBody('#d65f5f'), { pivotX: 0, pivotY: 0 }));
  // Mola de suspensão: origem no TOPO (a escala Y estica/comprime a partir da caixa de roda).
  const spring: Piece[] = [R(0, -78, 16, 6, '#6b7580', { strokeWidth: 3 })];
  for (let i = 0; i < 6; i++) spring.push(L(0, -66 + i * 11, 40, '#9aa3ad', 6, i % 2 ? 22 : -22, { name: `Espira ${i + 1}` }));
  list.push(obj('obj_mola', 'Mola da suspensão', 40, 80, spring, { pivotX: 0, pivotY: -80 }));

  // Buraco no asfalto (visto de cima, achatado pela perspectiva do chão).
  const hole: Piece[] = [
    E(0, -22, 330, 74, '#7d7a80', { name: 'Borda quebrada', strokeWidth: 5 }),
    E(0, -22, 280, 56, '#3b2f2a', { name: 'Terra' }),
    E(0, -20, 220, 40, '#150f0d', { name: 'Fundo', strokeWidth: 0 }),
    L(-150, -22, 70, INK, 4, -8, { name: 'Rachadura' }), L(150, -24, 70, INK, 4, 10, { name: 'Rachadura' }),
    L(-90, -54, 50, INK, 4, 40, { name: 'Rachadura' }), L(100, -58, 50, INK, 4, -35, { name: 'Rachadura' }),
    E(-120, -4, 22, 12, '#9a968f', { name: 'Pedra', strokeWidth: 3 }), E(130, -2, 30, 14, '#9a968f', { name: 'Pedra', strokeWidth: 3 }),
  ];
  list.push(obj('obj_buraco', 'Buraco no asfalto', 340, 80, hole));

  // Caminhão da prefeitura (de lado, olhando para a direita).
  const truck: Piece[] = [
    E(-210, -88, 150, 104, '#1b1a22', { strokeWidth: 0 }), E(200, -88, 150, 104, '#1b1a22', { strokeWidth: 0 }),
    R(-95, -190, 440, 190 - 50, ORANGE, { name: 'Baú', radius: 10 }),
    R(-95, -168, 440, 12, '#f4f1ea', { name: 'Faixa', strokeWidth: 3 }),
    T('PREFEITURA', -95, -128, 54, '#fff7e6', { name: 'Texto PREFEITURA', strokeWidth: 5, stroke: INK }),
    T('DE VILA TORTA', -95, -86, 30, '#fff7e6', { name: 'Texto VILA TORTA', strokeWidth: 4, stroke: INK }),
    R(298, -160, 210, 120, '#f4f1ea', { name: 'Cabine', radius: 22 }),
    R(316, -148, 118, 62, '#a8d4e8', { name: 'Vidro', radius: 10 }),
    R(300, -72, 224, 36, '#9aa3ad', { name: 'Para-choque', radius: 8 }),
    E(500, -100, 22, 30, '#f6dc9a', { name: 'Farol', strokeWidth: 3 }),
    R(110, -36, 300, 22, '#6b7580', { name: 'Chassi', radius: 6, strokeWidth: 3 }),
    createPiece('triangle', { x: 20, y: -215, w: 50, h: 34, fill: '#f2a200', stroke: INK, strokeWidth: 3, name: 'Giroflex' }),
  ];
  list.push(obj('obj_caminhao', 'Caminhão da prefeitura', 620, 260, truck));

  // Placa final: três linhas de texto estruturado, pé de ferro.
  const placa: Piece[] = [
    R(0, -150, 16, 300, '#6b7580', { name: 'Poste', strokeWidth: 4 }),
    R(0, -330, 440, 300, YELLOW, { name: 'Placa', radius: 16, strokeWidth: 8 }),
    R(0, -330, 410, 270, 'none', { name: 'Filete', radius: 10, strokeWidth: 4 }),
    T('PREFEITURA DE VILA TORTA', 0, -442, 25, INK, { name: 'Linha 1' }),
    TRI(0, -352, 96, 82, '#d63b3b', { name: 'Triângulo de alerta', strokeWidth: 6 }),
    T('!', 0, -338, 56, '#fff7e6', { name: 'Exclamação' }),
    T('ATENÇÃO: BURACO', 0, -285, 38, INK, { name: 'Linha 2' }),
    T('GESTÃO SENHOR GAIVOTA', 0, -234, 27, '#8a3a12', { name: 'Linha 3' }),
  ];
  list.push(obj('obj_placa_buraco', 'Placa: atenção, buraco', 460, 470, placa));

  // Televisão da sala: moldura + tela vazia (conteúdo animado entra como nós por cima).
  const tv: Piece[] = [
    R(0, -310, 640, 400, '#23232d', { name: 'Moldura', radius: 22, strokeWidth: 6 }),
    R(0, -310, 590, 350, '#0d1226', { name: 'Tela', radius: 8, strokeWidth: 3 }),
    R(-250, -130, 30, 130, '#23232d', { name: 'Pé esquerdo' }), R(250, -130, 30, 130, '#23232d', { name: 'Pé direito' }),
    E(270, -98, 12, 12, '#d63b3b', { name: 'LED', strokeWidth: 2 }),
  ];
  list.push(obj('obj_tv', 'Televisão (tela vazia)', 660, 420, tv));

  // Púlpito com tampo, frente decorada e microfone fixo de haste.
  const pulpito = (c: string, c2: string, tag: string): Piece[] => [
    R(0, -140, 300, 280, c, { name: 'Corpo', radius: 8, strokeWidth: 5 }),
    R(0, -290, 330, 30, c2, { name: 'Tampo', radius: 8 }),
    E(0, -150, 120, 120, '#fff7e6', { name: 'Brasão' }),
    T(tag, 0, -150, 66, c, { name: 'Inicial', strokeWidth: 0 }),
    L(40, -330, 80, '#2b2d3a', 7, -40, { name: 'Haste' }), E(72, -362, 26, 34, '#2b2d3a', { name: 'Microfone' }),
  ];
  list.push(obj('obj_pulpito_g', 'Púlpito do Gaivota', 340, 380, pulpito(ORANGE, '#f4d9a8', 'G')));
  list.push(obj('obj_pulpito_p', 'Púlpito do Pinote', 340, 380, pulpito(BLUE, '#b5cdf0', 'P')));
  list.push(obj('obj_bancada', 'Bancada do apresentador', 420, 280, [
    R(0, -120, 400, 240, '#4a4f66', { name: 'Corpo', radius: 8 }), R(0, -250, 430, 28, '#cfd4d8', { name: 'Tampo', radius: 8 }), T('VT', 0, -120, 70, '#e0b04c', { name: 'Logo' }),
  ]));
  list.push(obj('obj_painel_debate', 'Painel do debate', 1100, 420, [
    R(0, -210, 1100, 420, '#162147', { name: 'Fundo', radius: 14, strokeWidth: 6 }),
    R(-370, -210, 300, 360, ORANGE, { name: 'Lado Gaivota', strokeWidth: 3, opacity: 0.35 }), R(370, -210, 300, 360, BLUE, { name: 'Lado Pinote', strokeWidth: 3, opacity: 0.35 }),
    T('DEBATE', 0, -270, 118, '#fff7e6', { name: 'Título', strokeWidth: 8, stroke: INK }), T('VILA TORTA', 0, -150, 94, '#f2c95c', { name: 'Subtítulo', strokeWidth: 7, stroke: INK }),
    T('AO VIVO • ELEIÇÕES', 0, -70, 36, '#fff7e6', { name: 'Faixa', strokeWidth: 0 }),
  ]));

  // Cartazes e bandeiras
  const cartaz = (c: string, nome: string, extra: string): Piece[] => [
    R(0, -190, 12, 380, '#8c6a4f', { name: 'Cabo', strokeWidth: 3 }), R(0, -340, 240, 160, c, { name: 'Cartaz', radius: 8, strokeWidth: 5 }),
    T(nome, 0, -355, 46, '#fff7e6', { name: 'Nome', strokeWidth: 5, stroke: INK }), T(extra, 0, -305, 22, '#fff7e6', { name: 'Slogan', strokeWidth: 0 }),
  ];
  list.push(obj('obj_cartaz_g', 'Cartaz do Gaivota', 260, 400, cartaz(ORANGE, 'GAIVOTA', 'Mais quatro anos!')));
  list.push(obj('obj_cartaz_p', 'Cartaz do Pinote', 260, 400, cartaz(BLUE, 'PINOTE', 'Tira o Gaivota!')));
  const bandeira = (c: string, nome: string, sk: number): Piece[] => [
    R(0, -250, 10, 500, '#8c6a4f', { name: 'Mastro', strokeWidth: 3 }),
    createPiece('rect', { x: 100, y: -460 + sk, w: 190, h: 120, fill: c, stroke: INK, strokeWidth: 5, rotation: sk * 0.4, name: 'Pano' }),
    T(nome, 100, -460 + sk, 34, '#fff7e6', { name: 'Nome', strokeWidth: 4, stroke: INK, rotation: sk * 0.4 }),
  ];
  for (const [id, c, nome] of [['g', ORANGE, 'GAIVOTA'], ['p', BLUE, 'PINOTE']] as const) {
    list.push(obj(`obj_bandeira_${id}`, `Bandeira ${nome}`, 300, 500, bandeira(c, nome, 0), {
      clips: [clip('acenar', 'Tremulando', [frame('a', bandeira(c, nome, -8), 260), frame('b', bandeira(c, nome, 0), 260), frame('c', bandeira(c, nome, 8), 260), frame('d', bandeira(c, nome, 0), 260)])],
      defaultClip: 'acenar',
    }));
  }

  // Panfletos (versão grande para detalhe; encolhem na mão).
  const dog = (x: number, y: number, s: number): Piece[] => [
    E(x, y + 20 * s, 90 * s, 54 * s, '#c58a45', { name: 'Corpo do cachorro', strokeWidth: 3 }), E(x + 40 * s, y - 14 * s, 54 * s, 48 * s, '#c58a45', { name: 'Cabeça do cachorro', strokeWidth: 3 }),
    E(x + 24 * s, y - 36 * s, 16 * s, 30 * s, '#8a5a33', { name: 'Orelha', strokeWidth: 3, rotation: -20 }), E(x + 52 * s, y - 38 * s, 16 * s, 30 * s, '#8a5a33', { name: 'Orelha', strokeWidth: 3, rotation: 20 }),
    E(x + 46 * s, y - 14 * s, 7 * s, 7 * s, INK, { name: 'Olho', strokeWidth: 0 }), E(x + 62 * s, y - 2 * s, 12 * s, 9 * s, INK, { name: 'Focinho', strokeWidth: 0 }),
    L(x - 40 * s, y + 6 * s, 30 * s, '#c58a45', 8 * s, -50, { name: 'Rabo' }), R(x - 20 * s, y + 52 * s, 10 * s, 26 * s, '#c58a45', { strokeWidth: 3 }), R(x + 22 * s, y + 52 * s, 10 * s, 26 * s, '#c58a45', { strokeWidth: 3 }),
  ];
  const panfleto = (c: string, nome: string, comCao: boolean): Piece[] => [
    R(0, -240, 340, 460, '#fffdf6', { name: 'Papel', strokeWidth: 5 }), R(0, -420, 340, 60, c, { name: 'Faixa', strokeWidth: 4 }),
    T(nome, 0, -420, 44, '#fff7e6', { name: 'Candidato', strokeWidth: 0 }),
    T('SAÚDE • EDUCAÇÃO • SEGURANÇA', 0, -360, 20, INK, { name: 'Temas', strokeWidth: 0 }),
    T('Vamos melhorar a saúde,', 0, -318, 26, INK, { name: 'Proposta 1', fontWeight: '700' }), T('a educação e a segurança.', 0, -286, 26, INK, { name: 'Proposta 2', fontWeight: '700' }),
    T('UMA VILA TORTA', 0, -236, 24, c, { name: 'Slogan 1' }), T('MELHOR PARA TODOS!', 0, -208, 24, c, { name: 'Slogan 2' }),
    ...(comCao ? dog(-10, -140, 1.15) : [R(0, -120, 200, 100, '#e9e4d8', { name: 'Foto', strokeWidth: 3 })]),
    T('Como? Em breve.', 0, -30, 22, '#6b7580', { name: 'Rodapé', strokeWidth: 0, italic: true }),
  ];
  list.push(obj('obj_panfleto_g', 'Panfleto do Gaivota', 360, 480, panfleto(ORANGE, 'GAIVOTA', false), { pivotY: -240 }));
  list.push(obj('obj_panfleto_p', 'Panfleto do Pinote', 360, 480, panfleto(BLUE, 'PINOTE', true), { pivotY: -240 }));

  // Garrafa térmica de Samuca (origem no centro, para a mão).
  list.push(obj('obj_garrafa', 'Garrafa térmica de Samuca', 60, 130, [
    R(0, -60, 54, 112, '#c9574b', { name: 'Corpo', radius: 14, strokeWidth: 4 }), R(0, -10, 58, 12, '#9aa3ad', { name: 'Anel', strokeWidth: 3 }),
    R(0, -128, 38, 20, '#2b2d3a', { name: 'Tampa', radius: 6, strokeWidth: 3 }), R(0, -112, 46, 8, '#cfd4d8', { name: 'Bocal', strokeWidth: 3 }),
    R(-4, -92, 12, 66, '#ffffff', { name: 'Brilho', strokeWidth: 0, opacity: 0.35, radius: 6 }),
  ], { pivotY: -65 }));
  // Bola de vôlei
  const bola = (rot: number): Piece[] => [
    E(0, -40, 80, 80, '#f4f1ea', { name: 'Bola', strokeWidth: 4 }),
    ...[0, 120, 240].map((a, i) => createPiece('line', { x: 0, y: -40, w: 78, h: 1, stroke: i === 1 ? '#3b6fb6' : '#f2c95c', strokeWidth: 9, rotation: a + rot, name: `Gomo ${i + 1}` })),
    E(0, -40, 80, 80, 'none', { name: 'Contorno', strokeWidth: 4 }),
  ];
  list.push(obj('obj_bola_volei', 'Bola de vôlei da Larissa', 80, 80, bola(0), { pivotY: -40 }));

  // Coreto, placa "Em breve" e barraca de café
  list.push(obj('obj_coreto', 'Coreto da praça', 560, 520, [
    R(0, -40, 520, 80, '#cdbfa6', { name: 'Base' }), R(0, -92, 560, 24, '#e8dcc4', { name: 'Piso' }),
    ...[-230, -115, 0, 115, 230].map((x, i) => R(x, -230, 20, 270, '#f4f1ea', { name: `Coluna ${i + 1}`, strokeWidth: 3 })),
    R(0, -330, 540, 36, '#6a5a8a', { name: 'Viga' }), TRI(0, -430, 640, 160, '#8e6fc1', { name: 'Telhado' }), E(0, -520, 28, 28, '#f2c95c', { name: 'Ponta' }),
    ...[-190, -95, 0, 95, 190].map((x, i) => E(x, -150, 54, 54, i % 2 ? '#d65f5f' : '#f2c95c', { name: `Enfeite ${i + 1}`, strokeWidth: 2 })),
  ]));
  list.push(obj('obj_placa_praca', 'Placa: em breve, nova praça', 760, 560, [
    R(-250, -190, 24, 380, '#8c6a4f', { name: 'Poste esquerdo' }), R(250, -190, 24, 380, '#8c6a4f', { name: 'Poste direito' }),
    R(0, -420, 700, 340, '#ffffff', { name: 'Painel', radius: 16, strokeWidth: 8 }), R(0, -420, 664, 304, '#58a56d', { name: 'Fundo verde', radius: 10, strokeWidth: 0 }),
    T('EM BREVE:', 0, -510, 62, '#fff7e6', { name: 'Em breve', strokeWidth: 6, stroke: INK }), T('NOVA PRAÇA', 0, -420, 86, '#f2c95c', { name: 'Nova praça', strokeWidth: 9, stroke: INK }),
    T('Gestão Senhor Gaivota', 0, -345, 30, '#fff7e6', { name: 'Gestão', strokeWidth: 0 }),
    E(-250, -500, 40, 40, '#f2c95c', { name: 'Sol', strokeWidth: 0 }), TRI(260, -500, 56, 44, '#2f7a4a', { name: 'Árvore', strokeWidth: 3 }),
  ]));
  list.push(obj('obj_barraca_cafe', 'Barraca de café', 360, 440, [
    R(-150, -170, 16, 340, '#8c6a4f', { name: 'Poste' }), R(150, -170, 16, 340, '#8c6a4f', { name: 'Poste' }),
    R(0, -330, 360, 56, '#d65f5f', { name: 'Toldo', radius: 6 }), ...[-130, -65, 0, 65, 130].map((x, i) => R(x, -330, 32, 56, i % 2 ? '#f4f1ea' : '#d65f5f', { name: `Listra ${i + 1}`, strokeWidth: 2 })),
    R(0, -70, 320, 140, '#a6764e', { name: 'Balcão', radius: 4 }), T('CAFÉ', 0, -80, 60, '#fff7e6', { name: 'CAFÉ', strokeWidth: 5, stroke: INK }),
    R(-60, -150, 36, 56, '#e9e4d8', { name: 'Garrafa', radius: 6, strokeWidth: 3 }), R(10, -150, 26, 40, '#e9e4d8', { name: 'Caneca', radius: 6, strokeWidth: 3 }), R(60, -145, 26, 30, '#e9e4d8', { name: 'Caneca', radius: 6, strokeWidth: 3 }),
  ]));
  list.push(obj('obj_carrinho_vendedor', 'Carrinho do vendedor', 420, 380, [
    R(0, -110, 360, 120, '#8c6a4f', { name: 'Caixa', radius: 8 }), E(-130, -28, 76, 76, '#2b2d36', { name: 'Roda' }), E(130, -28, 76, 76, '#2b2d36', { name: 'Roda' }),
    R(-90, -160, 120, 40, ORANGE, { name: 'Bonés G', radius: 12 }), R(70, -160, 120, 40, BLUE, { name: 'Bonés P', radius: 12 }),
    R(-80, -260, 8, 220, '#8c6a4f', { name: 'Haste G', strokeWidth: 2 }), R(80, -260, 8, 220, '#8c6a4f', { name: 'Haste P', strokeWidth: 2 }),
    R(-40, -300, 80, 54, ORANGE, { name: 'Bandeirinha G' }), R(120, -300, 80, 54, BLUE, { name: 'Bandeirinha P' }),
    T('2 POR 1', 0, -110, 44, '#fff7e6', { name: 'Preço', strokeWidth: 4, stroke: INK }),
  ]));

  // Palanque
  list.push(obj('obj_palanque', 'Palanque da vitória', 980, 520, [
    R(0, -60, 980, 120, '#8c6a4f', { name: 'Estrado', radius: 6 }), R(0, -130, 980, 20, '#b08a5e', { name: 'Piso' }),
    ...[-440, -220, 0, 220, 440].map((x, i) => R(x, -190, 12, 100, '#6e5038', { name: `Grade ${i + 1}`, strokeWidth: 3 })), R(0, -230, 920, 12, '#6e5038', { name: 'Corrimão', strokeWidth: 3 }),
    R(0, -660, 940, 200, ORANGE, { name: 'Faixa de fundo', radius: 10, strokeWidth: 6 }), T('CONTINUAR!', 0, -660, 130, '#fff7e6', { name: 'Slogan', strokeWidth: 9, stroke: INK }),
    ...[-420, 420].map((x) => STAR(x, -660, 60, YELLOW, {})),
    R(-440, -400, 10, 340, '#6e5038', { name: 'Poste esq.' }), R(440, -400, 10, 340, '#6e5038', { name: 'Poste dir.' }),
  ]));
  list.push(obj('obj_pulpito_vitoria', 'Púlpito do palanque', 300, 300, [
    R(0, -120, 260, 240, ORANGE, { name: 'Corpo', radius: 8 }), R(0, -250, 290, 26, '#f4d9a8', { name: 'Tampo', radius: 6 }), STAR(0, -120, 100, YELLOW, {}),
    L(36, -296, 80, '#2b2d3a', 7, -40, { name: 'Haste' }), E(66, -328, 24, 32, '#2b2d3a', { name: 'Microfone' }),
  ]));

  // Gráfica
  list.push(obj('obj_impressora', 'Máquina de impressão', 560, 380, [
    R(0, -170, 520, 300, '#7c8aa0', { name: 'Corpo', radius: 14 }), R(0, -290, 480, 60, '#4a5568', { name: 'Tampa', radius: 10 }),
    E(-140, -190, 100, 100, '#cfd4d8', { name: 'Rolo 1' }), E(0, -190, 100, 100, '#cfd4d8', { name: 'Rolo 2' }), E(140, -190, 100, 100, '#cfd4d8', { name: 'Rolo 3' }),
    L(-140, -190, 80, '#6b7580', 7, 0, { name: 'Marca rolo 1' }), L(0, -190, 80, '#6b7580', 7, 60, { name: 'Marca rolo 2' }), L(140, -190, 80, '#6b7580', 7, 120, { name: 'Marca rolo 3' }),
    R(0, -60, 440, 40, '#e9e4d8', { name: 'Folhas saindo', radius: 4, strokeWidth: 3 }), E(210, -250, 22, 22, '#58a56d', { name: 'Luz verde', strokeWidth: 3 }),
  ], {
    clips: [clip('rodar', 'Imprimindo', [0, 1, 2, 3].map((i) => frame(`f${i}`, [
      R(0, -170, 520, 300, '#7c8aa0', { name: 'Corpo', radius: 14 }), R(0, -290, 480, 60, '#4a5568', { name: 'Tampa', radius: 10 }),
      ...[-140, 0, 140].flatMap((x, k) => [E(x, -190, 100, 100, '#cfd4d8', { name: `Rolo ${k + 1}` }), L(x, -190, 80, '#6b7580', 7, i * 30 + k * 60, { name: `Marca rolo ${k + 1}` })]),
      R(0, -60 + (i % 2) * 3, 440, 40, '#e9e4d8', { name: 'Folhas saindo', radius: 4, strokeWidth: 3 }), E(210, -250, 22, 22, i % 2 ? '#58a56d' : '#2f7a4a', { name: 'Luz verde', strokeWidth: 3 }),
    ], 130)))], defaultClip: 'rodar',
  }));
  const poster = (c: string, nome: string): Piece[] => [
    R(0, -230, 300, 440, '#fffdf6', { name: 'Papel', strokeWidth: 5 }), R(0, -390, 300, 70, c, { name: 'Faixa', strokeWidth: 4 }), T(nome, 0, -390, 48, '#fff7e6', { name: 'Candidato', strokeWidth: 0 }),
    T('UMA VILA TORTA', 0, -290, 31, c, { name: 'Frase 1' }), T('MELHOR PARA', 0, -250, 31, c, { name: 'Frase 2' }), T('TODOS!', 0, -210, 31, c, { name: 'Frase 3' }),
    E(0, -130, 120, 120, '#e9e4d8', { name: 'Retrato', strokeWidth: 3 }), E(0, -150, 52, 52, '#c9a273', { name: 'Cabeça', strokeWidth: 3 }), R(0, -90, 84, 50, c, { name: 'Roupa', radius: 20, strokeWidth: 3 }),
  ];
  list.push(obj('obj_poster_g', 'Cartaz da gráfica (Gaivota)', 320, 460, poster(ORANGE, 'GAIVOTA'), { pivotY: -230 }));
  list.push(obj('obj_poster_p', 'Cartaz da gráfica (Pinote)', 320, 460, poster(BLUE, 'PINOTE'), { pivotY: -230 }));
  list.push(obj('obj_letreiro_grafica', 'Letreiro da gráfica', 520, 130, [R(0, -65, 500, 110, '#2f7a4a', { name: 'Placa', radius: 12, strokeWidth: 6 }), T('GRÁFICA RÁPIDA', 0, -78, 54, '#fff7e6', { name: 'Nome', strokeWidth: 5, stroke: INK }), T('aceitamos todos os clientes', 0, -34, 22, '#f2c95c', { name: 'Slogan', strokeWidth: 0 })]));
  list.push(obj('obj_pilha_papel', 'Pilha de papel', 220, 150, [R(0, -20, 200, 40, '#fffdf6', { name: 'Folhas' }), R(0, -60, 190, 40, '#fffdf6', { name: 'Folhas' }), R(0, -100, 180, 40, '#e9e4d8', { name: 'Folhas' }), R(0, -135, 170, 30, '#fffdf6', { name: 'Folhas' })]));

  // Votação
  list.push(obj('obj_cabine', 'Cabine de votação', 300, 460, [
    R(0, -230, 280, 440, '#5d7f9e', { name: 'Cabine', radius: 10 }), R(0, -110, 220, 160, '#3a5a7a', { name: 'Cortina', radius: 6 }), R(0, -400, 280, 50, '#f4f1ea', { name: 'Topo' }), T('VOTE AQUI', 0, -400, 34, INK, { name: 'Texto', strokeWidth: 0 }),
  ]));
  list.push(obj('obj_urna', 'Urna eletrônica', 220, 200, [R(0, -70, 200, 130, '#3b3f4a', { name: 'Corpo', radius: 10 }), R(0, -110, 150, 56, '#a8d4e8', { name: 'Visor', radius: 4, strokeWidth: 3 }), R(0, -38, 140, 40, '#e9e4d8', { name: 'Teclado', radius: 4, strokeWidth: 3 }), R(0, -6, 220, 18, '#2b2d3a', { name: 'Base', radius: 4 })]));
  list.push(obj('obj_placa_secao', 'Placa: local de votação', 480, 300, [R(0, -140, 14, 280, '#6b7580', { name: 'Poste' }), R(0, -240, 460, 120, '#3b6fb6', { name: 'Placa', radius: 10, strokeWidth: 6 }), T('LOCAL DE VOTAÇÃO', 0, -262, 40, '#fff7e6', { name: 'Título', strokeWidth: 0 }), T('SEÇÃO 042 • FILA ÚNICA', 0, -214, 26, '#f2c95c', { name: 'Seção', strokeWidth: 0 })]));
  list.push(obj('obj_cartaz_rua', 'Cartaz: cadê a rua asfaltada?', 300, 440, [R(0, -190, 12, 380, '#8c6a4f', { name: 'Cabo', strokeWidth: 3 }), R(0, -330, 300, 190, '#fffdf6', { name: 'Cartaz', radius: 6, strokeWidth: 5 }), T('CADÊ A RUA', 0, -380, 36, '#d63b3b', { name: 'Linha 1' }), T('ASFALTADA?', 0, -336, 36, '#d63b3b', { name: 'Linha 2' }), T('(prometeram em 2022)', 0, -292, 17, INK, { name: 'Nota', fontWeight: '700' })]));
  // TV do debate (conteúdo estático dentro da tela): mini-estúdio + faixa "AO VIVO".
  const debateTela = (live: boolean): Piece[] => ([
    R(0, -215, 590, 350, '#162147', { name: 'Fundo', strokeWidth: 0 }),
    R(-130, -140, 110, 120, ORANGE, { name: 'Púlpito G', strokeWidth: 3 }), E(-130, -250, 56, 60, '#e8b48c', { name: 'Gaivota', strokeWidth: 3 }), R(-130, -296, 54, 38, ORANGE, { name: 'Cartola', strokeWidth: 3 }),
    R(130, -140, 110, 120, BLUE, { name: 'Púlpito P', strokeWidth: 3 }), E(130, -250, 56, 60, '#e8b48c', { name: 'Pinote', strokeWidth: 3 }), R(130, -283, 56, 22, '#8a5a33', { name: 'Cabelo', strokeWidth: 3 }),
    R(0, -140, 80, 90, '#4a4f66', { name: 'Bancada', strokeWidth: 3 }), E(0, -220, 44, 48, '#d9ab76', { name: 'Apresentador', strokeWidth: 3 }),
    R(0, -100, 590, 48, '#0a0f24', { name: 'Faixa inferior', strokeWidth: 0 }), T('DEBATE VILA TORTA', -40, -100, 26, '#fff7e6', { name: 'Chamada', strokeWidth: 0 }),
    E(220, -100, 18, 18, live ? '#d63b3b' : '#6b2a2a', { name: 'AO VIVO', strokeWidth: 0 }),
  ]).map((p) => ({ ...p, y: p.y - 95 }));
  list.push(obj('obj_tv_debate', 'Tela de TV: debate', 660, 420, debateTela(true), {
    clips: [clip('ao_vivo', 'Ao vivo piscando', [frame('a', debateTela(true), 600), frame('b', debateTela(false), 600)])], defaultClip: 'ao_vivo',
  }));
  return Object.fromEntries(list.map((o) => [o.id, o]));
}
