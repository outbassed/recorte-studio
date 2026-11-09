/** Objetos nativos novos do T1E2 (Criador de Objetos). Origem = centro da base. */
import { CustomObjectSchema, type CustomObject, type Piece } from '@/engine/model/schema';
import { createPiece } from '@/engine/world/pieces';
import { buildObjects } from '../objects';

const INK = '#23202b';
type P = Partial<Piece>;
const R = (x: number, y: number, w: number, h: number, fill: string, o: P = {}) => createPiece('rect', { x, y, w, h, fill, stroke: INK, strokeWidth: 4, ...o });
const E = (x: number, y: number, w: number, h: number, fill: string, o: P = {}) => createPiece('ellipse', { x, y, w, h, fill, stroke: INK, strokeWidth: 4, ...o });
const L = (x: number, y: number, w: number, stroke: string, sw = 5, rotation = 0, o: P = {}) => createPiece('line', { x, y, w, h: 1, stroke, strokeWidth: sw, rotation, ...o });
const T = (text: string, x: number, y: number, size: number, fill = INK, o: P = {}) => createPiece('text', { text, x, y, fontSize: size, fill, strokeWidth: 0, fontWeight: '900', ...o });
const TRI = (x: number, y: number, w: number, h: number, fill: string, o: P = {}) => createPiece('triangle', { x, y, w, h, fill, stroke: INK, strokeWidth: 4, ...o });
const obj = (id: string, name: string, width: number, height: number, pieces: Piece[], o: Partial<CustomObject> = {}) => CustomObjectSchema.parse({ id, name, width, height, pieces, createdAt: 1, updatedAt: 1, ...o });
const PURPLE = '#7b2fbf'; const GOLD = '#f2c95c';

export function buildObjects2(): Record<string, CustomObject> {
  const base = buildObjects();
  const L2: CustomObject[] = [];
  L2.push(obj('obj_cartaz_show', 'Cartaz do show: Lon Ruan', 520, 720, [
    R(0, -360, 480, 680, '#14081f', { name: 'Fundo', radius: 14, strokeWidth: 8 }),
    R(0, -360, 440, 640, PURPLE, { name: 'Moldura', radius: 10, strokeWidth: 0, opacity: 0.55 }),
    T('HOJE À NOITE!', 0, -620, 52, GOLD, { name: 'Linha 1' }),
    E(0, -440, 190, 200, '#b97f55', { name: 'Cabeça do cantor' }), R(0, -535, 190, 40, '#f2c95c', { name: 'Cabelo descolorido', radius: 18 }), R(0, -440, 200, 44, '#111', { name: 'Óculos', radius: 14 }),
    R(0, -300, 250, 110, '#c2185b', { name: 'Jaqueta', radius: 28 }), E(0, -345, 120, 22, GOLD, { name: 'Corrente', strokeWidth: 3 }),
    T('LON RUAN', 0, -222, 84, '#fff7e6', { name: 'Nome', strokeWidth: 8, stroke: INK }),
    T('AO VIVO', 0, -150, 60, GOLD, { name: 'Ao vivo', strokeWidth: 6, stroke: INK }),
    T('PRAÇA DO CORETO', 0, -90, 40, '#fff7e6', { name: 'Local' }),
    R(0, -40, 380, 62, GOLD, { name: 'Faixa do preço', radius: 8 }), T('INGRESSOS: R$ 100', 0, -40, 38, INK, { name: 'Preço' }),
  ]));
  L2.push(obj('obj_ingresso', 'Ingresso R$ 100', 420, 200, [
    R(0, -100, 400, 180, GOLD, { name: 'Papel', radius: 14, strokeWidth: 5 }), R(140, -100, 6, 160, 'none', { name: 'Picote', strokeWidth: 3, stroke: '#8a6a1d' }),
    T('LON RUAN', -50, -150, 46, '#14081f', { name: 'Nome' }), T('AO VIVO · PRAÇA DO CORETO', -50, -108, 20, '#14081f', { name: 'Local', fontWeight: '700' }),
    T('SETOR ÚNICO', -50, -76, 20, '#6a2a8a', { name: 'Setor', fontWeight: '700' }), T('R$ 100', 112, -60, 34, '#d63b3b', { name: 'Preço', rotation: -6 }),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => R(-150 + i * 14, -40, 5 + (i % 3) * 3, 36, '#14081f', { name: `Barra ${i}`, strokeWidth: 0 })),
  ], { pivotY: -100 }));
  L2.push(obj('obj_cracha', 'Crachá do fiscal', 380, 460, [
    L(0, -430, 150, '#8a6a1d', 6, 30, { name: 'Barbante E' }), L(0, -430, 150, '#8a6a1d', 6, -30, { name: 'Barbante D' }),
    R(0, -200, 340, 380, '#fffdf6', { name: 'Cartão', radius: 10, strokeWidth: 6 }), R(0, -340, 340, 70, '#d4ff00', { name: 'Faixa', strokeWidth: 4, radius: 8 }),
    T('FISCAL GERAL DE TUDO', 0, -340, 30, INK, { name: 'Cargo' }), E(0, -240, 90, 90, '#e8dcc0', { name: 'Foto' }), T('(foto 3x4 colada com fita)', 0, -170, 16, '#6b7580', { name: 'Nota', fontWeight: '700' }),
    T('SEU NORBERTO', 0, -120, 44, INK, { name: 'Nome' }), T('AUTORIZADO POR MIM', 0, -62, 28, '#d63b3b', { name: 'Autorização' }), L(0, -30, 280, '#6b7580', 3, 0, { name: 'Assinatura' }),
  ], { pivotY: -200 }));
  L2.push(obj('obj_multa', 'Bloco de multas', 380, 460, [
    R(0, -230, 340, 420, '#fffdf6', { name: 'Papel', strokeWidth: 5 }), T('AUTO DE INFRAÇÃO', 0, -400, 36, '#d63b3b', { name: 'Título' }),
    T('(válido porque eu disse)', 0, -362, 20, '#6b7580', { name: 'Subtítulo', fontWeight: '700' }),
    T('Infração: ocupação irregular', -150, -300, 22, INK, { name: 'Campo 1', align: 'start', fontWeight: '700' }), T('da calçada com cadeira', -150, -270, 22, INK, { name: 'Campo 2', align: 'start', fontWeight: '700' }),
    T('Valor: R$ 150,00', -150, -220, 26, INK, { name: 'Valor', align: 'start' }), T('Pagar no Pix:', -150, -170, 24, INK, { name: 'Pix 1', align: 'start', fontWeight: '700' }), T('da minha esposa', -150, -138, 26, '#1b6b3a', { name: 'Pix 2', align: 'start' }),
    L(0, -80, 260, INK, 3, 0, { name: 'Linha da assinatura' }), T('Fiscal Norberto', 0, -55, 22, INK, { name: 'Assinatura', italic: true }),
  ], { pivotY: -230 }));
  L2.push(obj('obj_apito', 'Apito', 70, 50, [E(-6, -22, 50, 40, '#9aa3ad', { name: 'Corpo' }), R(30, -16, 34, 18, '#9aa3ad', { name: 'Bocal', radius: 4 }), E(-6, -22, 14, 14, INK, { name: 'Furo', strokeWidth: 0 })], { pivotY: -22 }));
  L2.push(obj('obj_fita_metrica', 'Fita métrica', 90, 90, [E(0, -45, 80, 80, '#f2c95c', { name: 'Caixa' }), E(0, -45, 26, 26, '#6b7580', { name: 'Eixo' }), R(46, -45, 60, 10, '#fffdf6', { name: 'Fita', strokeWidth: 3 })], { pivotY: -45 }));
  L2.push(obj('obj_celular', 'Celular de Lon Ruan', 120, 220, [
    R(0, -110, 110, 210, '#c9a227', { name: 'Capinha dourada', radius: 18, strokeWidth: 5 }), R(0, -112, 90, 180, '#0d1226', { name: 'Tela', radius: 8, strokeWidth: 2 }),
    T('LR', 0, -130, 34, GOLD, { name: 'Logo' }), E(24, -190, 14, 14, '#222', { name: 'Câmera' }), ...[0, 1, 2].map((i) => L(-20 + i * 8, -90 + i * 26, 50, '#6a2a8a', 3, 20, { name: `Reflexo ${i}` })),
  ], { pivotY: -110 }));
  L2.push(obj('obj_cachorro_quente', 'Cachorro-quente', 90, 50, [R(0, -22, 80, 22, '#e0b04c', { name: 'Pão', radius: 11 }), R(0, -32, 90, 12, '#b5502f', { name: 'Salsicha', radius: 6 }), L(0, -33, 80, '#f2c95c', 4, 0, { name: 'Mostarda' })], { pivotY: -25 }));
  L2.push(obj('obj_salgado', 'Salgado', 70, 40, [TRI(0, -22, 70, 40, '#d99a45', { name: 'Coxinha' })], { pivotY: -22 }));
  L2.push(obj('obj_barraca_hotdog', 'Barraca de cachorro-quente', 360, 460, [
    R(-150, -180, 14, 360, '#8c6a4f', { name: 'Poste' }), R(150, -180, 14, 360, '#8c6a4f', { name: 'Poste' }),
    R(0, -340, 380, 60, '#d63b3b', { name: 'Toldo', radius: 6 }), ...[-130, -65, 0, 65, 130].map((x, i) => R(x, -340, 32, 60, i % 2 ? '#f4f1ea' : '#d63b3b', { name: `Listra ${i}`, strokeWidth: 2 })),
    R(0, -80, 330, 150, '#d9d2c0', { name: 'Balcão' }), T('CACHORRO-QUENTE', 0, -92, 40, '#a02020', { name: 'Letreiro' }), T('R$ 12', 0, -50, 30, INK, { name: 'Preço' }),
    R(-70, -170, 80, 50, '#b0b6bd', { name: 'Chapa' }), R(60, -165, 70, 40, '#e0b04c', { name: 'Pães', radius: 14 }),
  ]));
  L2.push(obj('obj_caixa_som', 'Caixa de som (torre)', 240, 420, [
    R(0, -210, 220, 400, '#1c1c24', { name: 'Gabinete', radius: 10, strokeWidth: 5 }), E(0, -300, 140, 140, '#3a3a48', { name: 'Alto-falante 1' }), E(0, -300, 70, 70, '#16161e', { name: 'Cone 1' }),
    E(0, -140, 160, 160, '#3a3a48', { name: 'Alto-falante 2' }), E(0, -140, 80, 80, '#16161e', { name: 'Cone 2' }), T('LR', 0, -45, 30, GOLD, { name: 'Logo' }),
  ], { clips: [{ id: 'pulsar', name: 'Pulsando', mode: 'loop', frames: [0, 1].map((i) => ({ id: `f${i}`, durationMs: 330, pieces: [
    R(0, -210, 220, 400, '#1c1c24', { name: 'Gabinete', radius: 10, strokeWidth: 5 }), E(0, -300, 140 + i * 10, 140 + i * 10, '#3a3a48'), E(0, -300, 70 + i * 8, 70 + i * 8, '#16161e'),
    E(0, -140, 160 + i * 12, 160 + i * 12, '#3a3a48'), E(0, -140, 80 + i * 10, 80 + i * 10, '#16161e'), T('LR', 0, -45, 30, GOLD),
  ] })) }], defaultClip: 'pulsar' }));
  const palcoBase = (telao: string): Piece[] => [
    R(0, -60, 1500, 120, '#2a2a36', { name: 'Tablado', strokeWidth: 5 }), R(0, -125, 1500, 14, '#444458', { name: 'Borda do piso', strokeWidth: 3 }),
    R(0, -470, 1460, 18, '#8a8a99', { name: 'Treliça superior', strokeWidth: 4 }), R(-730, -300, 18, 520, '#8a8a99', { name: 'Treliça E', strokeWidth: 4 }), R(730, -300, 18, 520, '#8a8a99', { name: 'Treliça D', strokeWidth: 4 }),
    R(0, -285, 700, 340, '#0a0a14', { name: 'Telão', radius: 8, strokeWidth: 6 }), R(0, -285, 660, 300, '#2a0d4a', { name: 'Tela do telão', radius: 4, strokeWidth: 0 }),
    T(telao, 0, -300, 100, GOLD, { name: 'Texto do telão', strokeWidth: 6, stroke: INK }), T('AO VIVO · VILA TORTA', 0, -210, 30, '#fff7e6', { name: 'Subtítulo do telão' }),
    ...[-600, -360, 360, 600].map((x, i) => E(x, -440, 60, 60, ['#ff4fa3', '#4fd1ff', '#ffe14f', '#7dff6a'][i]!, { name: `Refletor ${i + 1}`, strokeWidth: 3 })),
    R(-640, -130, 220, 12, '#555', { name: 'Degrau' }),
  ];
  L2.push(obj('obj_palco', 'Palco do show (telão e treliças)', 1500, 560, palcoBase('LON RUAN')));
  L2.push(obj('obj_bastidor_cortina', 'Cortina de bastidor', 600, 700, [R(0, -350, 580, 680, '#2b1840', { name: 'Pano', strokeWidth: 5 }), ...[-240, -120, 0, 120, 240].map((x) => L(x, -350, 680, '#1a0d2b', 8, 90, { name: 'Dobra' })), R(0, -690, 600, 18, '#9a9aa8', { name: 'Varão' })]));
  L2.push(obj('obj_cachorro', 'Cachorro', 260, 190, [
    R(-10, -100, 150, 70, '#c58a45', { name: 'Corpo', radius: 30 }), E(95, -135, 86, 80, '#c58a45', { name: 'Cabeça' }), E(70, -165, 30, 56, '#8a5a33', { name: 'Orelha', rotation: -15 }),
    E(118, -140, 12, 12, INK, { name: 'Olho', strokeWidth: 0 }), E(140, -118, 22, 16, INK, { name: 'Focinho', strokeWidth: 0 }), R(-60, -35, 22, 60, '#c58a45', { name: 'Pata T' }), R(40, -35, 22, 60, '#c58a45', { name: 'Pata F' }),
    L(-100, -125, 60, '#c58a45', 14, -35, { name: 'Rabo' }),
  ], { clips: [{ id: 'abanar', name: 'Abanando o rabo', mode: 'loop', frames: [-35, -10, 15, -10].map((r, i) => ({ id: `f${i}`, durationMs: 140, pieces: [R(-10, -100, 150, 70, '#c58a45', { name: 'Corpo', radius: 30 }), E(95, -135, 86, 80, '#c58a45'), E(70, -165, 30, 56, '#8a5a33', { rotation: -15 }), E(118, -140, 12, 12, INK, { strokeWidth: 0 }), E(140, -118, 22, 16, INK, { strokeWidth: 0 }), R(-60, -35, 22, 60, '#c58a45'), R(40, -35, 22, 60, '#c58a45'), L(-100, -125, 60, '#c58a45', 14, r)] })) }], defaultClip: 'abanar' }));
  L2.push(obj('obj_copos', 'Copos e lixo do evento', 300, 60, [E(-100, -10, 20, 14, '#fffdf6', { strokeWidth: 3 }), E(-30, -8, 20, 14, '#d63b3b', { strokeWidth: 3 }), R(40, -12, 40, 14, '#e0b04c', { rotation: 12, strokeWidth: 3 }), E(110, -10, 22, 14, '#fffdf6', { strokeWidth: 3 })]));
  L2.push(obj('obj_faixa_show', 'Faixa: Lon Ruan', 700, 160, [R(0, -80, 680, 140, PURPLE, { name: 'Faixa', radius: 10, strokeWidth: 6 }), T('LON RUAN · SÁBADO · R$ 100', 0, -80, 52, GOLD, { name: 'Texto', strokeWidth: 5, stroke: INK })]));
  // viatura: mesma geometria do carro, branca e azul
  const car = base.obj_carro_corpo!;
  const recolor = (p: Piece): Piece => ({ ...p, fill: p.fill === '#d65f5f' ? '#f4f1ea' : p.fill });
  L2.push({ ...car, id: 'obj_viatura_corpo', name: 'Viatura (carroceria)', pieces: [...car.pieces.map(recolor),
    R(0, -112, 700, 28, '#2a5aa0', { name: 'Faixa azul', strokeWidth: 3 }), T('POLÍCIA', -20, -112, 26, '#fffdf6', { name: 'Texto POLÍCIA', strokeWidth: 0 }),
    R(-35, -270, 90, 22, '#2a2a36', { name: 'Barra de luz', radius: 6 }), E(-60, -272, 22, 22, '#d63b3b', { name: 'Luz vermelha', strokeWidth: 2 }), E(-10, -272, 22, 22, '#3b6fb6', { name: 'Luz azul', strokeWidth: 2 })] });
  L2.push({ ...car, id: 'obj_carro_preto', name: 'Carro preto (fuga)', pieces: car.pieces.map((p) => ({ ...p, fill: p.fill === '#d65f5f' ? '#23232d' : p.fill })) });
  return { ...base, ...Object.fromEntries(L2.map((o) => [o.id, o])) };
}
