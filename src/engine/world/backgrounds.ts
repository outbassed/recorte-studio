/**
 * Cenários 2D originais, desenhados em SVG por camadas com parallax próprio:
 *  sky (longe) → mid (paredes/prédios) → ground (chão). Móveis NÃO ficam aqui: são
 *  nós editáveis criados ao aplicar o cenário (`furniture`).
 * O desenho cobre ±1700 × ±900 unidades, além de qualquer proporção de quadro.
 */
import type { Background } from '../model/schema';
import { ellipse as el, n, path as p, rect as r, safeColor, seeded, shade } from '../render/svg';

export const FLOOR_Y = 420;
const X0 = -1800;
const WW = 3600;
const Y0 = -1000;
const HH = 2000;

export interface Furniture {
  propId: string;
  x: number;
  y: number;
  scale?: number;
  /** Fica à frente dos personagens */
  front?: boolean;
  colorA?: string;
  colorB?: string;
  state?: string;
}

export interface DrawCtx {
  night: boolean;
  wall: string;
  accent: string;
  floor: string;
  ink: string;
}

export interface BackgroundDef {
  id: string;
  label: string;
  group: 'Casa' | 'Trabalho e escola' | 'Cidade' | 'Exterior' | 'Estúdio';
  keywords: string[];
  wall: string;
  accent: string;
  floor: string;
  /** cena externa: céu com sol/lua */
  outdoor?: boolean;
  horizon?: number;
  furniture: Furniture[];
  /** posições sugeridas para personagens */
  spots: number[];
  mid: (c: DrawCtx) => string;
  ground?: (c: DrawCtx) => string;
}

const INK = '#23202b';
const st = (w = 5) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;

/* ---------- blocos de construção ---------- */
const wallFill = (c: DrawCtx, horizon = 150) =>
  r(X0, Y0, WW, HH / 2 + horizon + 10, `fill="${c.wall}"`) + r(X0, -540, WW, 150, `fill="${shade(c.wall, 0.08)}" fill-opacity=".6"`);

const baseboard = (c: DrawCtx, y = 150, h = 34) => r(X0, y - h, WW, h, `fill="${shade(c.wall, -0.3)}"`) + p(`M${X0} ${y - h}H${X0 + WW}`, `stroke="${INK}" stroke-opacity=".4" stroke-width="4"`);

const plankFloor = (c: DrawCtx, y = 150) => {
  let out = r(X0, y, WW, 900, `fill="${c.floor}"`);
  for (let i = 0; i < 6; i++) out += p(`M${X0} ${y + 24 + i * i * 15}H${X0 + WW}`, `stroke="${shade(c.floor, -0.2)}" stroke-width="3"`);
  for (let i = -14; i <= 14; i++) out += p(`M${i * 50} ${y}L${i * 230} ${y + 620}`, `stroke="${shade(c.floor, -0.14)}" stroke-width="3"`);
  return out;
};

const tileFloor = (c: DrawCtx, y = 150) => {
  let out = r(X0, y, WW, 900, `fill="${c.floor}"`);
  for (let i = 0; i < 6; i++) out += p(`M${X0} ${y + 20 + i * i * 18}H${X0 + WW}`, `stroke="${shade(c.floor, -0.22)}" stroke-width="4"`);
  for (let i = -12; i <= 12; i++) out += p(`M${i * 70} ${y}L${i * 300} ${y + 620}`, `stroke="${shade(c.floor, -0.22)}" stroke-width="4"`);
  return out;
};

const carpet = (x: number, y: number, rx: number, ry: number, col: string) =>
  el(x, y, rx, ry, `fill="${col}" ${st(4)}`) + el(x, y, rx * 0.8, ry * 0.76, `fill="none" stroke="${shade(col, 0.3)}" stroke-width="6"`);

const windowArt = (c: DrawCtx, x: number, y: number, w: number, h: number) => {
  const sky = c.night ? '#1b2547' : '#a8d4e8';
  const out = r(x - 14, y - 14, w + 28, h + 28, `fill="#efe9dc" ${st()}`) + r(x, y, w, h, `fill="${sky}" ${st(3)}`);
  const extra = c.night
    ? `<circle cx="${n(x + w * 0.72)}" cy="${n(y + h * 0.28)}" r="${n(h * 0.1)}" fill="#f1ecd1"/>`
    : el(x + w * 0.3, y + h * 0.3, w * 0.2, h * 0.08, 'fill="#fff" fill-opacity=".75"');
  return out + extra + p(`M${n(x + w / 2)} ${y}V${y + h}M${x} ${n(y + h / 2)}H${x + w}`, `stroke="#efe9dc" stroke-width="10"`) + r(x - 26, y + h + 12, w + 52, 16, `rx="4" fill="#efe9dc" ${st(4)}`);
};

const curtain = (x: number, y: number, w: number, h: number, col: string) => {
  const dark = shade(col, -0.18);
  return p(`M${x} ${y}H${x + w * 0.26}Q${x + w * 0.2} ${y + h * 0.6} ${x + w * 0.05} ${y + h}H${x}Z`, `fill="${col}" ${st(4)}`) +
    p(`M${x + w} ${y}H${x + w * 0.74}Q${x + w * 0.8} ${y + h * 0.6} ${x + w * 0.95} ${y + h}H${x + w}Z`, `fill="${dark}" ${st(4)}`) +
    r(x - 22, y - 16, w + 44, 14, `rx="6" fill="#6c4a33" ${st(3)}`);
};

const picture = (x: number, y: number, w: number, h: number, col: string) =>
  r(x, y, w, h, `fill="#6c4a33" ${st(4)}`) + r(x + 11, y + 11, w - 22, h - 22, `fill="${col}"`) + p(`M${x + 11} ${y + h - 11}L${n(x + w * 0.4)} ${n(y + h * 0.45)}L${n(x + w * 0.65)} ${n(y + h * 0.7)}L${n(x + w * 0.8)} ${n(y + h * 0.55)}L${x + w - 11} ${y + h - 11}Z`, `fill="${shade(col, -0.3)}"`);

const shelfWall = (x: number, y: number, w: number, c: DrawCtx) => {
  let out = r(x, y, w, 14, `fill="#7c5a44" ${st(3)}`);
  const cols = ['#d65f5f', '#5b8dbe', '#e0b04c', '#6dad6f', c.accent];
  let cx = x + 10;
  let i = 0;
  while (cx < x + w - 34) {
    const h = 40 + ((i * 17) % 34);
    const bw = 14 + ((i * 5) % 12);
    out += r(cx, y - h, bw, h, `fill="${cols[i % cols.length]}" ${st(2)}`);
    cx += bw + 3;
    i++;
  }
  return out;
};

const skyDraw = (c: DrawCtx, top: string, bottom: string, id: string) => {
  const nightTop = '#0d1330';
  const nightBottom = '#2c2f5e';
  const gid = `sky-${id}`;
  const stars = c.night ? (() => {
    const rnd = seeded(7);
    let out = '';
    for (let i = 0; i < 70; i++) out += `<circle cx="${n(X0 + rnd() * WW)}" cy="${n(-900 + rnd() * 900)}" r="${n(1.4 + rnd() * 2.2)}" fill="#f4f1d8" fill-opacity="${n(0.5 + rnd() * 0.5)}"/>`;
    return out;
  })() : '';
  return `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.night ? nightTop : top}"/><stop offset="1" stop-color="${c.night ? nightBottom : bottom}"/></linearGradient>` +
    r(X0 * 1.4, Y0, WW * 1.4, HH, `fill="url(#${gid})"`) + stars +
    (c.night ? `<circle cx="420" cy="-400" r="70" fill="#f1ecd1"/><circle cx="446" cy="-416" r="62" fill="#1a2144"/>` : `<circle cx="540" cy="-400" r="84" fill="#ffe9a8"/>` + el(-500, -390, 150, 34, 'fill="#fff" fill-opacity=".85"') + el(-420, -420, 90, 30, 'fill="#fff" fill-opacity=".85"') + el(120, -320, 110, 24, 'fill="#fff" fill-opacity=".7"'));
};

const building = (x: number, w: number, h: number, base: number, col: string, night: boolean, seed: number) => {
  const rnd = seeded(seed);
  let out = r(x, base - h, w, h, `fill="${col}" ${st(4)}`);
  const cols = Math.max(2, Math.floor(w / 62));
  const rows = Math.max(2, Math.floor(h / 80));
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const lit = night ? rnd() > 0.45 : rnd() > 0.8;
      out += r(x + 16 + (i * (w - 24)) / cols, base - h + 20 + j * (h / rows), 28, 42, `fill="${lit ? '#f4d98c' : night ? '#1f2748' : '#9fc4d4'}" stroke="${INK}" stroke-opacity=".5" stroke-width="2"`);
    }
  }
  return out;
};

const house = (x: number, base: number, w: number, h: number, col: string, roof: string, night: boolean) =>
  r(x, base - h, w, h, `fill="${col}" ${st()}`) +
  p(`M${x - 30} ${base - h}L${x + w / 2} ${base - h - 110}L${x + w + 30} ${base - h}Z`, `fill="${roof}" ${st()}`) +
  r(x + w * 0.12, base - h * 0.72, w * 0.26, h * 0.34, `fill="${night ? '#f4d98c' : '#a8d4e8'}" ${st(4)}`) +
  r(x + w * 0.56, base - h * 0.62, w * 0.28, h * 0.62, `fill="#7c5a44" ${st(4)}`);

const treeSil = (x: number, base: number, s: number, col: string) =>
  r(x - 12 * s, base - 100 * s, 24 * s, 100 * s, `fill="#6e5238" ${st(4)}`) + p(`M${x - 90 * s} ${base - 110 * s}C${x - 130 * s} ${base - 190 * s} ${x - 60 * s} ${base - 260 * s} ${x} ${base - 250 * s}C${x + 60 * s} ${base - 270 * s} ${x + 130 * s} ${base - 190 * s} ${x + 90 * s} ${base - 110 * s}C${x + 50 * s} ${base - 80 * s} ${x - 50 * s} ${base - 80 * s} ${x - 90 * s} ${base - 110 * s}Z`, `fill="${col}" ${st(4)}`);

const lightCone = (x: number, top: number, w: number, h: number, col: string, op = 0.16) =>
  p(`M${x - 22} ${top}L${x - w} ${top + h}H${x + w}L${x + 22} ${top}Z`, `fill="${col}" fill-opacity="${op}"`);

/* ---------- cenários ---------- */
export const BACKGROUNDS: BackgroundDef[] = [
  {
    id: 'sala', label: 'Sala de estar', group: 'Casa', keywords: ['sala', 'estar', 'casa'], wall: '#d9c6a5', accent: '#b5573f', floor: '#a97a52',
    spots: [-280, 280],
    furniture: [{ propId: 'sofa', x: 0, y: 200, scale: 1 }, { propId: 'lamp', x: -470, y: 230 }, { propId: 'plant', x: 480, y: 220 }],
    mid: (c) => wallFill(c) + r(X0, -30, WW, 6, `fill="${shade(c.wall, -0.2)}"`) + baseboard(c) + windowArt(c, -520, -360, 280, 260) + curtain(-540, -376, 320, 300, c.accent) + picture(300, -340, 240, 170, '#7fb0c8') + shelfWall(40, -160, 200, c),
    ground: (c) => plankFloor(c) + carpet(0, 340, 520, 90, c.accent),
  },
  {
    id: 'salamoderna', label: 'Sala moderna', group: 'Casa', keywords: ['moderna', 'apartamento', 'loft'], wall: '#e8e6e1', accent: '#2e6e73', floor: '#b9b2a6',
    spots: [-300, 300],
    furniture: [{ propId: 'sofa', x: -110, y: 210, colorA: '#2e6e73', colorB: '#245a5e' }, { propId: 'tv', x: 560, y: 230 }, { propId: 'plant', x: -600, y: 220, colorA: '#e8e6e1' }],
    mid: (c) => wallFill(c) + r(-1000, -540, 500, 690, `fill="${c.accent}"`) + (c.night ? r(-440, -440, 900, 420, `fill="#1b2547" ${st()}`) : r(-440, -440, 900, 420, `fill="#bfe1ee" ${st()}`)) + [-140, 160].map((x) => p(`M${x} -440V-20`, st(6))).join('') + building(-420, 180, 200, -20, '#7c8ea0', c.night, 3) + building(-200, 150, 300, -20, '#90a1b2', c.night, 5) + building(190, 240, 240, -20, '#7c8ea0', c.night, 8) + baseboard(c, 150, 14),
    ground: (c) => tileFloor(c),
  },
  {
    id: 'quarto', label: 'Quarto', group: 'Casa', keywords: ['quarto', 'dormitorio'], wall: '#c9c3df', accent: '#d27ba6', floor: '#9a7d68',
    spots: [-340, 300],
    furniture: [{ propId: 'bed', x: 300, y: 240 }, { propId: 'lamp', x: -120, y: 170, scale: 0.8 }, { propId: 'shelf', x: -620, y: 200 }],
    mid: (c) => wallFill(c) + windowArt(c, 100, -400, 300, 240) + curtain(80, -416, 340, 280, c.accent) + picture(-300, -360, 170, 210, '#f2c95c') + p(`M${X0} -60H${X0 + WW}`, `stroke="${shade(c.wall, -0.15)}" stroke-width="5"`) + baseboard(c),
    ground: (c) => plankFloor(c) + el(-200, 350, 280, 66, `fill="${c.accent}" ${st(4)}`),
  },
  {
    id: 'cozinha', label: 'Cozinha', group: 'Casa', keywords: ['cozinha'], wall: '#f1e3c4', accent: '#d65f5f', floor: '#cfc8bc',
    spots: [-250, 250],
    furniture: [{ propId: 'fridge', x: -610, y: 170 }, { propId: 'stove', x: -330, y: 170 }, { propId: 'sink', x: 40, y: 170 }, { propId: 'table', x: 430, y: 370, front: true }],
    mid: (c) => {
      let tiles = '';
      for (let i = -22; i <= 22; i++) for (let j = 0; j < 4; j++) tiles += r(i * 60, -150 + j * 60, 60, 60, `fill="${(i + j) % 2 ? '#fbf6ea' : shade(c.accent, 0.72)}"`);
      return wallFill(c) + tiles + r(-800, -480, 1100, 200, `rx="6" fill="#b08a5e" ${st()}`) + [-790, -520, -250, 20].map((x) => r(x, -470, 260, 180, `rx="5" fill="#c49a6c" ${st(3)}`)).join('') + windowArt(c, 420, -390, 240, 200) + baseboard(c, 150, 12);
    },
    ground: (c) => tileFloor(c),
  },
  {
    id: 'banheiro', label: 'Banheiro', group: 'Casa', keywords: ['banheiro', 'lavabo'], wall: '#bcdde0', accent: '#4f9aa5', floor: '#dcd8cc',
    spots: [-180, 260],
    furniture: [{ propId: 'toilet', x: 520, y: 200 }, { propId: 'mirror', x: -300, y: -60, scale: 1 }, { propId: 'sink', x: -300, y: 180, scale: 0.7, colorB: '#e8e6e1' }],
    mid: (c) => {
      let tiles = '';
      for (let i = -26; i <= 26; i++) for (let j = 0; j < 12; j++) tiles += r(i * 70, -540 + j * 60, 70, 60, `fill="${(i + j) % 2 ? c.wall : shade(c.wall, 0.2)}" stroke="#fff" stroke-opacity=".45" stroke-width="3"`);
      return wallFill(c) + tiles + r(60, -360, 200, 200, `fill="${c.night ? '#26305a' : '#dff2f5'}" ${st()}`) + p('M160 -360V-160M60 -260H260', st(5)) + baseboard(c, 150, 10);
    },
    ground: (c) => tileFloor(c),
  },
  {
    id: 'salaaula', label: 'Sala de aula', group: 'Trabalho e escola', keywords: ['aula', 'escola', 'classe', 'sala de aula'], wall: '#ddd4ad', accent: '#6dad6f', floor: '#b08a5e',
    spots: [-470, 0, 470],
    furniture: [{ propId: 'board', x: 0, y: -60 }, { propId: 'schooldesk', x: -470, y: 370, front: true }, { propId: 'schooldesk', x: 0, y: 370, front: true }, { propId: 'schooldesk', x: 470, y: 370, front: true }],
    mid: (c) => wallFill(c) + r(X0, -40, WW, 190, `fill="${shade(c.accent, 0.3)}"`) + windowArt(c, -920, -380, 220, 280) + windowArt(c, 700, -380, 220, 280) + `<circle cx="-500" cy="-340" r="60" fill="#f4f1ea" ${st()}/>` + p('M-500 -380V-340L-470 -320', `fill="none" ${st(6)}`) + picture(420, -390, 180, 120, '#e98f4e') + baseboard(c),
    ground: (c) => plankFloor(c),
  },
  {
    id: 'corredor', label: 'Corredor escolar', group: 'Trabalho e escola', keywords: ['corredor', 'armarios'], wall: '#d3dbe0', accent: '#4f7cb5', floor: '#a9b0b3',
    spots: [-300, 300],
    furniture: [],
    mid: (c) => {
      let out = wallFill(c);
      for (let i = -14; i <= 14; i++) {
        const x = i * 128;
        out += r(x, -310, 120, 460, `rx="4" fill="${i % 3 === 0 ? shade(c.accent, 0.18) : c.accent}" ${st(4)}`) + p(`M${x + 24} -280H${x + 96}M${x + 24} -262H${x + 96}M${x + 24} -244H${x + 96}`, `stroke="${INK}" stroke-opacity=".5" stroke-width="4"`) + `<circle cx="${x + 96}" cy="-90" r="7" fill="#cfd4d8" ${st(2)}/>`;
      }
      for (const x of [-680, 0, 680]) out += r(x - 110, -530, 220, 36, `fill="#f7f5e6" ${st(3)}`);
      return out + r(X0, -310, WW, 14, `fill="${shade(c.wall, -0.35)}"`);
    },
    ground: (c) => tileFloor(c),
  },
  {
    id: 'escritorio', label: 'Escritório', group: 'Trabalho e escola', keywords: ['escritorio', 'empresa', 'firma'], wall: '#c9d2d9', accent: '#3d5a86', floor: '#7d8896',
    spots: [-330, 330],
    furniture: [{ propId: 'desk', x: 0, y: 330, front: true }, { propId: 'computer', x: 40, y: 130 }, { propId: 'shelf', x: -640, y: 180 }, { propId: 'plant', x: 620, y: 200 }],
    mid: (c) => wallFill(c) + r(-280, -420, 640, 330, `fill="${c.night ? '#1b2547' : '#c5e3ef'}" ${st()}`) + building(-250, 150, 200, -90, '#7c8ea0', c.night, 11) + building(-80, 130, 260, -90, '#90a1b2', c.night, 12) + building(80, 170, 170, -90, '#7c8ea0', c.night, 13) + building(250, 100, 230, -90, '#90a1b2', c.night, 14) + r(-280, -420, 640, 330, `fill="none" ${st()}`) + p('M40 -420V-90', st(7)) + picture(500, -380, 200, 150, '#58a59a') + baseboard(c),
    ground: (c) => {
      let out = r(X0, 150, WW, 900, `fill="${c.floor}"`);
      for (let i = -9; i <= 9; i++) for (let j = 0; j < 6; j++) out += r(i * 220 + (j % 2) * 40 - 110, 150 + j * j * 22, 214, 16 + j * 14, `fill="${shade(c.floor, (i + j) % 2 ? 0.05 : -0.05)}"`);
      return out;
    },
  },
  {
    id: 'delegacia', label: 'Delegacia', group: 'Trabalho e escola', keywords: ['delegacia', 'policia', 'interrogatorio'], wall: '#b6bfb3', accent: '#3a5a8a', floor: '#8a8f88',
    spots: [-290, 300],
    furniture: [{ propId: 'desk', x: -120, y: 340, front: true, colorA: '#6e7a7a', colorB: '#4c5862' }, { propId: 'lamp', x: 220, y: 130, scale: 0.7, colorA: '#9aa3ad' }],
    mid: (c) => {
      let bars = '';
      for (let i = 0; i < 9; i++) bars += r(520 + i * 62, -470, 14, 620, `fill="#3d4450" ${st(3)}`);
      return wallFill(c) + r(X0, -40, WW, 190, `fill="${shade(c.wall, -0.2)}"`) + r(490, -500, 620, 650, `fill="#3a3f4b"`) + bars + r(490, -500, 620, 22, `fill="#3d4450" ${st(3)}`) + r(-620, -410, 300, 250, `fill="#e7e2cf" ${st()}`) + [0, 1, 2, 3].map((i) => r(-600 + i * 70, -390, 50, 70, `fill="${['#d9c6a5', '#c9d2d9', '#d9c6a5', '#f2c95c'][i]}" ${st(2)}`)).join('') + p('M-600 -290H-340M-600 -250H-420M-600 -210H-380', `stroke="${INK}" stroke-opacity=".4" stroke-width="5"`) + `<circle cx="-100" cy="-340" r="72" fill="${c.accent}" ${st()}/>` + p('M-100 -392L-84 -352L-44 -352L-76 -326L-64 -288L-100 -312L-136 -288L-124 -326L-156 -352L-116 -352Z', `fill="#e9c75c" ${st(3)}`) + baseboard(c);
    },
    ground: (c) => tileFloor(c),
  },
  {
    id: 'hospital', label: 'Hospital', group: 'Trabalho e escola', keywords: ['hospital', 'clinica', 'medico'], wall: '#d9ecea', accent: '#4fa79c', floor: '#c8d6d4',
    spots: [-330, 320],
    furniture: [{ propId: 'bed', x: 330, y: 240, colorA: '#f4f4f4', colorB: '#8fc7c0' }],
    mid: (c) => wallFill(c) + r(X0, -30, WW, 180, `fill="${shade(c.accent, 0.55)}"`) + r(X0, -40, WW, 12, `fill="${c.accent}"`) + r(-680, -400, 240, 240, `fill="#fff" ${st()}`) + r(-590, -370, 60, 180, `fill="${c.accent}"`) + r(-650, -310, 180, 60, `fill="${c.accent}"`) + windowArt(c, -200, -400, 260, 220) + p('M640 -180V110M580 110H700', st(7)) + r(610, -320, 60, 110, `rx="10" fill="#cfe7f2" ${st(4)}`) + p('M640 -210V-180', st(3)) + baseboard(c, 150, 10),
    ground: (c) => tileFloor(c),
  },
  {
    id: 'restaurante', label: 'Restaurante', group: 'Cidade', keywords: ['restaurante', 'jantar', 'cantina'], wall: '#a8473c', accent: '#e0b04c', floor: '#6e4a3c',
    spots: [-300, 300],
    furniture: [{ propId: 'table', x: 0, y: 360, front: true, colorA: '#f4f1ea' }, { propId: 'ceilinglamp', x: -420, y: -350 }, { propId: 'ceilinglamp', x: 420, y: -350 }],
    mid: (c) => {
      let tile = '';
      for (let i = -28; i <= 28; i++) tile += r(i * 64, -20, 32, 170, `fill="${shade(c.wall, -0.14)}"`);
      return wallFill(c) + tile + picture(-700, -370, 210, 150, '#d9c6a5') + picture(490, -370, 210, 150, '#7fb0c8') + r(-280, -430, 560, 220, `rx="110" fill="${shade(c.wall, -0.45)}" ${st()}`) + `<text x="0" y="-292" text-anchor="middle" font-family="Georgia,serif" font-size="74" font-weight="700" fill="${c.accent}">Cantina</text>` + r(X0, -30, WW, 12, `fill="${c.accent}"`) + baseboard(c);
    },
    ground: (c) => plankFloor(c),
  },
  {
    id: 'bar', label: 'Bar', group: 'Cidade', keywords: ['bar', 'boteco', 'balada'], wall: '#3c2a35', accent: '#e98f4e', floor: '#4c3a34',
    spots: [-330, 300],
    furniture: [{ propId: 'counter', x: 0, y: 200 }, { propId: 'ceilinglamp', x: -300, y: -350, colorA: '#7c5a44' }, { propId: 'ceilinglamp', x: 300, y: -350, colorA: '#7c5a44' }],
    mid: (c) => {
      let bottles = '';
      const cols = ['#58a56d', '#b5502f', '#e0b04c', '#5b8dbe', '#d27ba6'];
      for (let s = 0; s < 2; s++) {
        bottles += r(-720, -380 + s * 170, 1440, 16, `fill="#7c5a44" ${st(3)}`);
        for (let i = 0; i < 18; i++) {
          const x = -700 + i * 80;
          const y = -380 + s * 170;
          bottles += r(x, y - 80, 30, 80, `rx="6" fill="${cols[(i + s) % 5]}" ${st(3)}`) + r(x + 9, y - 112, 12, 34, `fill="${cols[(i + s) % 5]}" ${st(3)}`);
        }
      }
      return wallFill(c) + bottles + `<text x="0" y="-470" text-anchor="middle" font-family="Arial,sans-serif" font-size="70" font-weight="900" fill="${c.accent}">BAR DO ZÉ</text>` + baseboard(c, 150, 6);
    },
    ground: (c) => plankFloor(c),
  },
  {
    id: 'loja', label: 'Loja de roupas', group: 'Cidade', keywords: ['loja', 'roupas', 'boutique'], wall: '#efe3d3', accent: '#d27ba6', floor: '#c5b49e',
    spots: [-280, 280],
    furniture: [{ propId: 'counter', x: 500, y: 210, scale: 0.7, colorA: '#d27ba6' }],
    mid: (c) => {
      let racks = '';
      const cols = ['#d65f5f', '#5b8dbe', '#e0b04c', '#6dad6f', '#8e6fc1', '#2b2d3a'];
      for (const rx of [-760, -280]) {
        racks += p(`M${rx} -360H${rx + 420}`, `stroke="#5a5a64" stroke-width="10"`);
        for (let i = 0; i < 8; i++) {
          const x = rx + 20 + i * 50;
          racks += p(`M${x} -360V-340`, st(4)) + p(`M${x - 20} -336H${x + 20}L${x + 24} -210H${x - 24}Z`, `fill="${cols[i % 6]}" ${st(3)}`);
        }
      }
      return wallFill(c) + r(X0, -540, WW, 90, `fill="${c.accent}"`) + racks + r(300, -420, 240, 340, `rx="120" fill="#cfe7f2" stroke="#d8c47b" stroke-width="14"`) + baseboard(c);
    },
    ground: (c) => tileFloor(c),
  },
  {
    id: 'mercado', label: 'Mercado', group: 'Cidade', keywords: ['mercado', 'supermercado'], wall: '#eef0e6', accent: '#58a56d', floor: '#d6d6cc',
    spots: [-300, 300],
    furniture: [],
    mid: (c) => {
      let out = wallFill(c) + r(X0, -540, WW, 70, `fill="${c.accent}"`);
      const cols = ['#d65f5f', '#e0b04c', '#5b8dbe', '#e98f4e', '#6dad6f', '#d27ba6', '#f4f1ea'];
      for (const sx of [-950, -310, 330]) {
        out += r(sx, -440, 620, 590, `fill="#c9ccc4" ${st()}`);
        for (let s = 0; s < 4; s++) {
          const y = -420 + s * 142;
          out += r(sx + 10, y + 120, 600, 12, `fill="#7f8580" ${st(2)}`);
          for (let i = 0; i < 11; i++) {
            const h = 70 + ((i * s + i) % 4) * 11;
            out += r(sx + 18 + i * 54, y + 120 - h, 48, h, `rx="4" fill="${cols[(i + s * 3 + sx) % 7 < 0 ? 0 : (i + s * 3) % 7]}" ${st(2)}`);
          }
        }
      }
      return out;
    },
    ground: (c) => tileFloor(c),
  },
  {
    id: 'rua', label: 'Rua residencial', group: 'Exterior', keywords: ['rua', 'bairro', 'calcada'], wall: '#a8d4e8', accent: '#d65f5f', floor: '#6b7079', outdoor: true,
    spots: [-300, 300],
    furniture: [{ propId: 'streetlamp', x: -620, y: 200 }, { propId: 'car', x: 620, y: 210, scale: 0.7, colorA: '#5b8dbe' }],
    mid: (c) => house(-1100, 120, 420, 260, '#e9c58f', '#a8473c', c.night) + house(-560, 120, 460, 300, '#b4cfc0', '#596b82', c.night) + house(60, 120, 420, 260, '#e7b6a4', '#7c5a44', c.night) + house(620, 120, 480, 290, '#d9cfe6', '#a8473c', c.night) + treeSil(-120, 120, 1.1, '#5f9c6c') + treeSil(540, 120, 0.95, '#6dad6f'),
    ground: (c) => r(X0, 120, WW, 90, `fill="#b7b4ac"`) + p(`M${X0} 120H${X0 + WW}`, st(4)) + r(X0, 210, WW, 800, `fill="${c.floor}"`) + r(X0, 200, WW, 14, `fill="#8b8d90"`) + [-1400, -900, -400, 100, 600, 1100].map((x) => r(x, 400, 240, 16, `fill="#f4efc8"`)).join(''),
  },
  {
    id: 'centro', label: 'Centro urbano', group: 'Cidade', keywords: ['centro', 'cidade', 'avenida', 'predios'], wall: '#b7d4e4', accent: '#e0b04c', floor: '#5d626c', outdoor: true,
    spots: [-300, 300],
    furniture: [{ propId: 'streetlamp', x: 560, y: 190 }, { propId: 'trash', x: -560, y: 190 }],
    mid: (c) => {
      const cols = ['#7c8ea0', '#90a1b2', '#a18f85', '#8a7f97', '#6f8591'];
      let out = '';
      for (let i = -8; i <= 8; i++) out += building(i * 220 - 110, 214, 480 + ((i * i * 37) % 300), 140, cols[(i + 8) % 5]!, c.night, 30 + i);
      return out;
    },
    ground: (c) => r(X0, 130, WW, 80, `fill="#a6a39b"`) + p(`M${X0} 130H${X0 + WW}`, st(4)) + r(X0, 210, WW, 800, `fill="${c.floor}"`) + [-1200, -800, -400, 0, 400, 800, 1200].map((x) => r(x, 330, 40, 200, `fill="#ecebe0"`)).join(''),
  },
  {
    id: 'praca', label: 'Praça', group: 'Exterior', keywords: ['praca', 'encontro', 'chafariz'], wall: '#b4dcec', accent: '#c9b08a', floor: '#c9b08a', outdoor: true,
    spots: [-300, 300],
    furniture: [{ propId: 'bench', x: 0, y: 190 }, { propId: 'tree', x: -660, y: 170, scale: 0.9 }, { propId: 'streetlamp', x: 560, y: 180 }],
    mid: (c) => treeSil(-1100, 130, 1.3, '#6dad6f') + treeSil(1050, 130, 1.4, '#5f9c6c') + treeSil(300, 130, 0.9, '#6dad6f') + r(X0, 80, WW, 60, `fill="#7fb07c"`) + el(240, 134, 200, 34, `fill="#a9c7d4" ${st()}`) + r(226, 40, 28, 90, `fill="#a9a59c" ${st(4)}`) + el(240, 40, 80, 16, `fill="#a9c7d4" ${st(4)}`) + (c.night ? '' : p('M240 30Q200 -40 170 30M240 30Q280 -40 310 30', `fill="none" stroke="#dff2f5" stroke-width="7"`)),
    ground: (c) => {
      let out = r(X0, 130, WW, 900, `fill="${c.floor}"`);
      for (let j = 0; j < 7; j++) for (let i = -9; i <= 9; i++) out += r(i * 200 + (j % 2) * 100, 130 + j * j * 14, 196, 14 + j * 9, `fill="${shade(c.floor, ((i + j) % 3) * 0.05 - 0.05)}"`);
      return out;
    },
  },
  {
    id: 'parque', label: 'Parque', group: 'Exterior', keywords: ['parque', 'natureza', 'grama'], wall: '#aee0ef', accent: '#5f9c6c', floor: '#7db86f', outdoor: true,
    spots: [-300, 300],
    furniture: [{ propId: 'tree', x: 600, y: 190 }, { propId: 'bench', x: -520, y: 200 }],
    mid: () => p(`M${X0} 150Q-900 -80 -200 110T1000 40T${X0 + WW} 90V300H${X0}Z`, `fill="#94c98a" ${st(4)}`) + treeSil(-900, 110, 1, '#5f9c6c') + treeSil(-260, 120, 0.8, '#6dad6f') + treeSil(210, 100, 1.2, '#4f8a60') + treeSil(1000, 100, 1.05, '#5f9c6c'),
    ground: (c) => r(X0, 140, WW, 900, `fill="${c.floor}"`) + p(`M-200 140Q-40 300 -340 560H340Q190 300 80 140Z`, `fill="#d8c29a"`) + (() => {
      const rnd = seeded(9);
      let tufts = '';
      for (let i = 0; i < 60; i++) {
        const x = X0 + rnd() * WW;
        const y = 170 + rnd() * 430;
        tufts += `M${n(x)} ${n(y)}l-6 -14M${n(x)} ${n(y)}l7 -13`;
      }
      return p(tufts, `stroke="${shade(c.floor, -0.25)}" stroke-width="4" fill="none" stroke-linecap="round"`);
    })(),
  },
  {
    id: 'quintal', label: 'Quintal', group: 'Exterior', keywords: ['quintal', 'jardim', 'churrasco'], wall: '#b4dcec', accent: '#8c6a4f', floor: '#86b873', outdoor: true,
    spots: [-300, 300],
    furniture: [{ propId: 'plant', x: -640, y: 190 }, { propId: 'table', x: 520, y: 240, scale: 0.8, colorA: '#c9a273' }],
    mid: (c) => {
      let fence = r(X0, -90, WW, 240, `fill="${shade(c.accent, 0.2)}"`);
      for (let i = -24; i <= 24; i++) fence += p(`M${i * 76 - 34} 150V-110L${i * 76} -142L${i * 76 + 34} -110V150Z`, `fill="${c.accent}" ${st(4)}`);
      return treeSil(-700, -60, 1.2, '#5f9c6c') + treeSil(760, -60, 1.1, '#6dad6f') + fence;
    },
    ground: (c) => r(X0, 150, WW, 900, `fill="${c.floor}"`) + el(-40, 380, 300, 56, `fill="#c6b48d" ${st(4)}`),
  },
  {
    id: 'entrada', label: 'Entrada de casa', group: 'Exterior', keywords: ['entrada', 'fachada', 'varanda', 'portao'], wall: '#e4c98e', accent: '#b5573f', floor: '#a59f94', outdoor: true,
    spots: [-340, 330],
    furniture: [{ propId: 'door', x: 0, y: 170 }, { propId: 'plant', x: -200, y: 190, scale: 0.8 }, { propId: 'plant', x: 200, y: 190, scale: 0.8 }],
    mid: (c) => r(-1200, -400, 2400, 570, `fill="${c.wall}" ${st()}`) + p('M-1320 -400L0 -760L1320 -400Z', `fill="${c.accent}" ${st()}`) + windowArt(c, -700, -300, 300, 240) + windowArt(c, 400, -300, 300, 240) + r(-200, -360, 400, 34, `fill="#f4f1ea" ${st(4)}`) + r(-260, -390, 520, 40, `fill="${shade(c.accent, -0.2)}" ${st(4)}`),
    ground: (c) => r(X0, 170, WW, 900, `fill="${c.floor}"`) + r(-170, 170, 340, 90, `fill="#c8c2b4" ${st(4)}`) + p(`M-200 260L-360 900H360L200 260Z`, `fill="#c8c2b4"`) + r(X0, 200, 1400, 800, `fill="#7db86f"`) + r(400, 200, 1400, 800, `fill="#7db86f"`),
  },
  {
    id: 'praia', label: 'Praia', group: 'Exterior', keywords: ['praia', 'mar', 'areia'], wall: '#9ad8f0', accent: '#2f9ab8', floor: '#e6cf9d', outdoor: true,
    spots: [-300, 300],
    furniture: [],
    mid: (c) => {
      let w = r(X0, -60, WW, 240, `fill="${c.night ? '#1f3a66' : c.accent}"`);
      for (let i = 0; i < 6; i++) w += p(`M${X0} ${-30 + i * 36}Q-300 ${-44 + i * 36} 200 ${-30 + i * 36}T${X0 + WW} ${-30 + i * 36}`, `fill="none" stroke="#dff5f6" stroke-opacity=".55" stroke-width="6"`);
      return w;
    },
    ground: (c) => p(`M${X0} 160Q-200 110 500 170T${X0 + WW} 150V1000H${X0}Z`, `fill="${c.floor}" ${st(4)}`) + el(560, 450, 180, 24, 'fill="#000" fill-opacity=".14"') + p('M560 460L540 150', `stroke="#7c5a44" stroke-width="12"`) + p('M360 190Q545 40 730 190Z', `fill="#d65f5f" ${st()}`) + p('M430 190Q480 90 545 80Q600 90 660 190', `fill="#f4f1ea"`),
  },
  {
    id: 'garagem', label: 'Garagem', group: 'Casa', keywords: ['garagem', 'oficina'], wall: '#a9acad', accent: '#e0b04c', floor: '#73777a',
    spots: [-420, 90],
    furniture: [{ propId: 'car', x: 450, y: 210, scale: 0.85 }, { propId: 'box', x: -600, y: 180 }],
    mid: (c) => {
      let slats = '';
      for (let j = 0; j < 8; j++) slats += r(-500, -420 + j * 66, 1000, 62, `fill="${shade(c.wall, 0.2)}" ${st(3)}`);
      return wallFill(c) + r(-520, -440, 1040, 590, `fill="#8b8f90" ${st()}`) + slats + r(-1060, -320, 420, 220, `fill="#6c7072" ${st(4)}`) + p('M-1000 -280V-140M-930 -280V-150M-860 -280V-130M-780 -280V-160', `stroke="${INK}" stroke-width="10" stroke-linecap="round"`) + p(`M${X0} 90L${X0 + 200} 150H${X0 + WW}V90Z`, `fill="${c.accent}" fill-opacity=".2"`);
    },
    ground: (c) => r(X0, 150, WW, 900, `fill="${c.floor}"`) + el(-140, 360, 170, 26, `fill="#3a3c40" fill-opacity=".6"`),
  },
  {
    id: 'carro', label: 'Dentro do carro', group: 'Cidade', keywords: ['dentro do carro', 'interior de veiculo', 'veiculo', 'motorista'], wall: '#3b3f4a', accent: '#a8d4e8', floor: '#2b2d36',
    spots: [-300, 300],
    furniture: [],
    mid: (c) => {
      const sky = c.night ? '#1b2547' : c.accent;
      return r(X0, Y0, WW, HH, `fill="${c.wall}"`) + p('M-960 -410Q0 -480 960 -410L1040 40H-1040Z', `fill="${sky}" ${st(8)}`) + (c.night ? building(-640, 200, 200, 40, '#232a4e', true, 40) + building(380, 240, 230, 40, '#232a4e', true, 41) : treeSil(-680, 40, 1, '#5f9c6c') + treeSil(650, 40, 1.2, '#6dad6f')) + p('M0 -440V40', `stroke="${c.wall}" stroke-width="44"`);
    },
    ground: (c) => r(X0, 30, WW, 1000, `fill="${c.floor}"`) + p('M-1200 170Q0 100 1200 170V700H-1200Z', `fill="${shade(c.floor, 0.12)}" ${st(5)}`) + `<circle cx="-300" cy="120" r="94" fill="none" stroke="#14151b" stroke-width="22"/>` + r(-40, 90, 80, 60, `rx="6" fill="#5f8fbf" ${st(4)}`),
  },
  {
    id: 'estudio', label: 'Estúdio de TV', group: 'Estúdio', keywords: ['estudio', 'tv', 'telejornal', 'noticia', 'entrevista', 'programa'], wall: '#232a44', accent: '#3b82c4', floor: '#2f3550',
    spots: [-330, 320],
    furniture: [{ propId: 'podium', x: -330, y: 340, front: true }],
    mid: (c) => {
      let panels = '';
      for (let i = -12; i <= 12; i++) panels += r(i * 150, -540, 140, 690, `fill="${shade(c.wall, i % 2 ? 0.06 : -0.06)}"`);
      return wallFill(c) + panels + r(-40, -420, 720, 390, `rx="10" fill="#10131f" ${st()}`) + r(-22, -402, 684, 354, `rx="4" fill="${c.accent}"`) + `<text x="320" y="-208" text-anchor="middle" font-family="Arial,sans-serif" font-size="70" font-weight="900" fill="#fff">PLANTÃO</text>` + r(-800, -24, 1600, 12, `fill="${c.accent}"`) + lightCone(-560, -540, 280, 700, '#ffffff') + lightCone(620, -540, 280, 700, '#ffffff');
    },
    ground: (c) => r(X0, 150, WW, 900, `fill="${c.floor}"`) + el(0, 410, 780, 130, `fill="${c.accent}" fill-opacity=".35" ${st(4)}`),
  },
  {
    id: 'gravacao', label: 'Estúdio de gravação', group: 'Estúdio', keywords: ['gravacao', 'podcast', 'musica'], wall: '#4a3a52', accent: '#e98f4e', floor: '#3a2e38',
    spots: [-280, 280],
    furniture: [{ propId: 'desk', x: 0, y: 340, front: true, colorA: '#2b2d3a', colorB: '#21222c' }, { propId: 'computer', x: 340, y: 130 }],
    mid: (c) => {
      let foam = '';
      for (let i = -18; i <= 18; i++) for (let j = 0; j < 8; j++) foam += p(`M${i * 90} ${-540 + j * 86}l45 43l-45 43l-45 -43Z`, `fill="${shade(c.wall, (i + j) % 2 ? 0.1 : -0.1)}"`);
      return wallFill(c) + foam + r(-340, -420, 680, 300, `rx="8" fill="#141620" ${st()}`) + r(-322, -402, 310, 264, `fill="#28324f"`) + r(12, -402, 310, 264, `fill="#28324f"`) + `<circle cx="660" cy="-260" r="58" fill="${c.accent}" ${st()}/>` + `<text x="660" y="-246" text-anchor="middle" font-size="36" font-weight="900" font-family="Arial,sans-serif" fill="#fff">REC</text>` + baseboard(c, 150, 20);
    },
    ground: (c) => r(X0, 150, WW, 900, `fill="${c.floor}"`) + el(0, 390, 520, 70, `fill="${shade(c.floor, 0.14)}" ${st(4)}`),
  },
  {
    id: 'igreja', label: 'Igreja', group: 'Cidade', keywords: ['igreja', 'capela', 'casamento'], wall: '#d8cdbb', accent: '#7a5ca8', floor: '#a68d74',
    spots: [-260, 260],
    furniture: [{ propId: 'podium', x: 0, y: 210, colorA: '#7c5a44', colorB: '#d8c47b' }],
    mid: (c) => {
      let arcs = '';
      for (const x of [-860, -420, 420, 860]) {
        arcs += p(`M${x - 110} 150V-200Q${x} -420 ${x + 110} -200V150Z`, `fill="${shade(c.wall, -0.15)}" ${st()}`);
        arcs += p(`M${x - 70} 60V-190Q${x} -340 ${x + 70} -190V60Z`, `fill="${c.night ? '#2c2f5e' : c.accent}" ${st(4)}`) + p(`M${x} -320V60M${x - 70} -120H${x + 70}`, st(4));
      }
      return wallFill(c) + arcs + `<circle cx="0" cy="-340" r="110" fill="${c.night ? '#2c2f5e' : '#d9a441'}" ${st()}/>` + p('M0 -450V-230M-110 -340H110M-78 -418L78 -262M78 -418L-78 -262', st(4)) + baseboard(c);
    },
    ground: (c) => tileFloor(c) + p('M-200 150L-420 1000H420L200 150Z', `fill="#a33f3f"`),
  },
  {
    id: 'noturno', label: 'Cidade à noite', group: 'Cidade', keywords: ['noite', 'noturno', 'madrugada'], wall: '#232a4e', accent: '#d27ba6', floor: '#2d2f3e', outdoor: true,
    spots: [-300, 300],
    furniture: [{ propId: 'streetlamp', x: 560, y: 190 }],
    mid: () => {
      const cols = ['#232a4e', '#2a2f58', '#1f2547', '#2d2650'];
      let out = '';
      for (let i = -8; i <= 8; i++) out += building(i * 210 - 100, 204, 420 + ((i * i * 53) % 340), 140, cols[(i + 8) % 4]!, true, 60 + i);
      return out + r(-740, -180, 300, 90, `rx="8" fill="#14162c" stroke="#d27ba6" stroke-width="6"`) + `<text x="-590" y="-118" text-anchor="middle" font-family="Arial,sans-serif" font-size="46" font-weight="900" fill="#ff9ed2">ABERTO</text>`;
    },
    ground: (c) => r(X0, 130, WW, 80, `fill="#3b3d4c"`) + r(X0, 210, WW, 800, `fill="${c.floor}"`) + el(0, 370, 620, 80, 'fill="#ffe9a8" fill-opacity=".1"'),
  },
  {
    id: 'neutro', label: 'Cenário neutro', group: 'Estúdio', keywords: ['neutro', 'liso', 'vazio', 'simples'], wall: '#d8d4cc', accent: '#b8b4aa', floor: '#c6c2b8',
    spots: [-300, 300],
    furniture: [],
    mid: (c) => r(X0, Y0, WW, HH, `fill="${c.wall}"`),
    ground: (c) => `<radialGradient id="neutro-g" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="${shade(c.floor, 0.3)}"/><stop offset="1" stop-color="${c.floor}"/></radialGradient>` + r(X0, 150, WW, 900, `fill="url(#neutro-g)"`),
  },
  {
    id: 'chroma', label: 'Chroma key', group: 'Estúdio', keywords: ['chroma', 'verde', 'fundo verde'], wall: '#1fbf4f', accent: '#1fbf4f', floor: '#1fbf4f',
    spots: [-300, 300],
    furniture: [],
    mid: (c) => r(X0, Y0, WW, HH, `fill="${c.wall}"`),
  },
];

const BY_ID = new Map(BACKGROUNDS.map((b) => [b.id, b]));
export const getBackground = (id: string): BackgroundDef => BY_ID.get(id) ?? BY_ID.get('neutro')!;

/** Mapa dos ids da versão 0.4 para os cenários atuais. */
export const LEGACY_BACKGROUNDS: Record<string, string> = {
  sala: 'sala', quarto: 'quarto', cozinha: 'cozinha', rua: 'rua', escola: 'salaaula', escritorio: 'escritorio',
  parque: 'parque', bar: 'bar', praia: 'praia', estudio: 'estudio', hospital: 'hospital', loja: 'loja',
  delegacia: 'delegacia', igreja: 'igreja',
};

export interface BackgroundLayers { sky: string; mid: string; ground: string; overlay: string }

/** Camadas do fundo de uma cena, em função do preset e das variantes. */
export function renderBackground(bg: Background, idPrefix = ''): BackgroundLayers {
  const def = getBackground(bg.presetId);
  const night = bg.variant === 'night';
  const c: DrawCtx = {
    night,
    wall: safeColor(bg.primary || def.wall),
    accent: safeColor(bg.secondary || def.accent),
    floor: safeColor(bg.floor || def.floor),
    ink: INK,
  };
  const sky = def.outdoor ? skyDraw(c, shade(c.wall, -0.1), shade(c.wall, 0.4), `${idPrefix}${def.id}`) : '';
  let overlay = '';
  // Variantes: noite e tom escurecem/clareiam SÓ o fundo, nunca os personagens.
  if (night && !def.outdoor) overlay += r(X0 * 1.4, Y0, WW * 1.4, HH, `fill="#141a44" fill-opacity=".42"`);
  if (night && def.outdoor) overlay += r(X0 * 1.4, -200, WW * 1.4, 1200, `fill="#141a44" fill-opacity=".38"`);
  if (bg.tone === 'dark') overlay += r(X0 * 1.4, Y0, WW * 1.4, HH, `fill="#000" fill-opacity=".28"`);
  if (bg.tone === 'light') overlay += r(X0 * 1.4, Y0, WW * 1.4, HH, `fill="#fff" fill-opacity=".22"`);
  return { sky, mid: def.mid(c), ground: def.ground ? def.ground(c) : '', overlay };
}
