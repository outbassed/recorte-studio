/**
 * Objetos 2D originais. Âncora em (0,0) = centro da base, para assentar no chão.
 * Cada objeto declara cores e estados reais (porta aberta/fechada, luz ligada…).
 */
import { ellipse as el, n, path as p, rect as r, shade } from '../render/svg';

export interface PropCtx { a: string; b: string; state: string; ink: string; id: string }
export interface PropDef {
  id: string;
  label: string;
  category: 'moveis' | 'casa' | 'eletronicos' | 'mao' | 'veiculos' | 'trabalho' | 'natureza';
  keywords: string[];
  w: number;
  h: number;
  a: string;
  b: string;
  states?: Array<{ id: string; label: string }>;
  defaultState?: string;
  /** Item pequeno, segurável pela mão: âncora no centro. */
  handheld?: boolean;
  /** Pendurado/na parede: sem sombra de chão. */
  wall?: boolean;
  draw: (c: PropCtx) => string;
}

const S = (c: PropCtx, w = 5) => `stroke="${c.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const ON_OFF = [{ id: 'on', label: 'Ligado' }, { id: 'off', label: 'Desligado' }];
const OPEN_CLOSED = [{ id: 'closed', label: 'Fechada' }, { id: 'open', label: 'Aberta' }];

export const PROPS: PropDef[] = [
  {
    id: 'table', label: 'Mesa de jantar', category: 'moveis', keywords: ['mesa'], w: 420, h: 190, a: '#a6764e', b: '#7c5a44',
    draw: (c) => r(-180, -170, 26, 170, `fill="${c.b}" ${S(c)}`) + r(154, -170, 26, 170, `fill="${c.b}" ${S(c)}`) + r(-210, -190, 420, 34, `rx="8" fill="${c.a}" ${S(c)}`) + p('M-190 -176H190', `stroke="${shade(c.a, 0.3)}" stroke-width="4"`),
  },
  {
    id: 'desk', label: 'Escrivaninha', category: 'trabalho', keywords: ['escrivaninha', 'mesa de trabalho', 'birô'], w: 400, h: 200, a: '#8c6a4f', b: '#5e4635',
    draw: (c) => r(-200, -200, 400, 30, `rx="5" fill="${c.a}" ${S(c)}`) + r(-188, -170, 110, 170, `fill="${c.b}" ${S(c)}`) + r(-176, -156, 86, 44, `rx="4" fill="${shade(c.b, 0.15)}" ${S(c, 3)}`) + r(-176, -102, 86, 44, `rx="4" fill="${shade(c.b, 0.15)}" ${S(c, 3)}`) + r(160, -170, 24, 170, `fill="${c.b}" ${S(c)}`),
  },
  {
    id: 'chair', label: 'Cadeira', category: 'moveis', keywords: ['cadeira', 'banco'], w: 130, h: 240, a: '#b08a5e', b: '#6e5038',
    draw: (c) => r(-52, -110, 14, 110, `fill="${c.b}" ${S(c, 4)}`) + r(38, -110, 14, 110, `fill="${c.b}" ${S(c, 4)}`) + r(-52, -240, 14, 130, `fill="${c.b}" ${S(c, 4)}`) + r(38, -240, 14, 130, `fill="${c.b}" ${S(c, 4)}`) + r(-54, -240, 108, 58, `rx="10" fill="${c.a}" ${S(c, 4)}`) + r(-62, -122, 124, 22, `rx="7" fill="${c.a}" ${S(c, 4)}`),
  },
  {
    id: 'sofa', label: 'Sofá', category: 'moveis', keywords: ['sofa', 'poltrona'], w: 520, h: 230, a: '#5d7f9e', b: '#47627b',
    draw: (c) => r(-235, -230, 470, 150, `rx="30" fill="${c.b}" ${S(c)}`) + r(-260, -120, 520, 100, `rx="24" fill="${c.a}" ${S(c)}`) + r(-268, -160, 70, 120, `rx="26" fill="${c.a}" ${S(c)}`) + r(198, -160, 70, 120, `rx="26" fill="${c.a}" ${S(c)}`) + p('M0 -118V-30', `${S(c, 4)} fill="none"`) + r(-210, -20, 22, 20, `fill="${c.ink}"`) + r(188, -20, 22, 20, `fill="${c.ink}"`),
  },
  {
    id: 'armchair', label: 'Poltrona', category: 'moveis', keywords: ['poltrona'], w: 280, h: 240, a: '#c0785a', b: '#9a5c44',
    draw: (c) => r(-110, -240, 220, 160, `rx="36" fill="${c.b}" ${S(c)}`) + r(-130, -125, 260, 95, `rx="24" fill="${c.a}" ${S(c)}`) + r(-140, -165, 60, 130, `rx="24" fill="${c.a}" ${S(c)}`) + r(80, -165, 60, 130, `rx="24" fill="${c.a}" ${S(c)}`) + r(-100, -30, 20, 30, `fill="${c.ink}"`) + r(80, -30, 20, 30, `fill="${c.ink}"`),
  },
  {
    id: 'bed', label: 'Cama', category: 'moveis', keywords: ['cama'], w: 600, h: 220, a: '#d9c7b2', b: '#6f7fb0',
    draw: (c) => r(-300, -220, 40, 220, `rx="8" fill="#7c5a44" ${S(c)}`) + r(-280, -110, 570, 80, `rx="12" fill="${c.a}" ${S(c)}`) + r(-120, -122, 410, 92, `rx="14" fill="${c.b}" ${S(c)}`) + r(-262, -146, 130, 48, `rx="20" fill="#f4f1ea" ${S(c)}`) + r(-280, -34, 24, 34, `fill="${c.ink}"`) + r(266, -34, 24, 34, `fill="${c.ink}"`),
  },
  {
    id: 'shelf', label: 'Estante de livros', category: 'moveis', keywords: ['estante', 'prateleira', 'livros'], w: 320, h: 430, a: '#8c6a4f', b: '#c9574b',
    draw: (c) => {
      let out = r(-160, -430, 320, 430, `rx="4" fill="${c.a}" ${S(c)}`);
      const cols = [c.b, '#4f86b5', '#e0b04c', '#5aa06c', '#8e6fc1', '#ede6d8'];
      for (let row = 0; row < 3; row++) {
        const y = -410 + row * 135;
        out += r(-142, y, 284, 118, `fill="${shade(c.a, -0.45)}" ${S(c, 3)}`);
        let x = -134;
        let i = row * 2;
        while (x < 110) {
          const w = 18 + ((i * 7) % 16);
          const h = 62 + ((i * 13) % 42);
          out += r(x, y + 118 - h, w, h, `fill="${cols[i % cols.length]}" ${S(c, 2)}`);
          x += w + 2;
          i++;
        }
      }
      return out;
    },
  },
  {
    id: 'door', label: 'Porta', category: 'casa', keywords: ['porta'], w: 230, h: 470, a: '#a06a42', b: '#2a2430', states: OPEN_CLOSED, defaultState: 'closed',
    draw: (c) => {
      const frame = r(-115, -470, 230, 470, `fill="${c.b}" ${S(c)}`);
      if (c.state === 'open') {
        return frame + p('M-100 -456L-30 -430V-10L-100 0Z', `fill="${c.a}" ${S(c)}`) + `<circle cx="-46" cy="-214" r="7" fill="#e9c75c" ${S(c, 2)}/>`;
      }
      return frame + r(-100, -456, 200, 456, `fill="${c.a}" ${S(c)}`) + r(-74, -426, 148, 160, `rx="4" fill="${shade(c.a, -0.14)}" ${S(c, 3)}`) + r(-74, -236, 148, 190, `rx="4" fill="${shade(c.a, -0.14)}" ${S(c, 3)}`) + `<circle cx="74" cy="-226" r="10" fill="#e9c75c" ${S(c, 3)}/>`;
    },
  },
  {
    id: 'window', label: 'Janela', category: 'casa', keywords: ['janela'], w: 320, h: 300, a: '#f0ebe0', b: '#a8d4e8', wall: true, states: OPEN_CLOSED, defaultState: 'closed',
    draw: (c) => {
      const glass = r(-150, -290, 300, 280, `fill="${c.b}" ${S(c)}`);
      const frame = c.state === 'open'
        ? p('M-150 -290L-205 -270V-30L-150 -10Z', `fill="${shade(c.a, -0.1)}" ${S(c)}`) + p('M150 -290L205 -270V-30L150 -10Z', `fill="${shade(c.a, -0.1)}" ${S(c)}`)
        : p('M0 -290V-10M-150 -150H150', `stroke="${c.a}" stroke-width="12"`);
      return glass + p('M-110 -120L-40 -240M-30 -60L30 -190', `stroke="#fff" stroke-opacity=".45" stroke-width="12"`) + frame + r(-170, -14, 340, 16, `rx="4" fill="${c.a}" ${S(c)}`);
    },
  },
  {
    id: 'picture', label: 'Quadro', category: 'casa', keywords: ['quadro', 'pintura'], w: 240, h: 180, a: '#6c4a33', b: '#7fb0c8', wall: true,
    draw: (c) => r(-120, -180, 240, 180, `fill="${c.a}" ${S(c)}`) + r(-102, -162, 204, 144, `fill="${c.b}" ${S(c, 3)}`) + p('M-102 -18L-40 -96L4 -50L44 -82L102 -18Z', `fill="${shade(c.b, -0.35)}"`) + `<circle cx="52" cy="-130" r="17" fill="#f6dc9a"/>`,
  },
  {
    id: 'plant', label: 'Vaso de planta', category: 'natureza', keywords: ['planta', 'vaso'], w: 170, h: 300, a: '#c0785a', b: '#5f9c6c',
    draw: (c) => p('M0 -110C-40 -170 -90 -190 -82 -240C-40 -230 -10 -190 0 -130C-6 -210 -12 -270 8 -300C40 -260 26 -190 6 -120C30 -170 60 -210 92 -210C96 -160 46 -130 4 -106Z', `fill="${c.b}" ${S(c)}`) + p('M-46 -110H46L34 0H-34Z', `fill="${c.a}" ${S(c)}`) + r(-54, -122, 108, 22, `rx="6" fill="${shade(c.a, 0.14)}" ${S(c)}`),
  },
  {
    id: 'lamp', label: 'Abajur', category: 'casa', keywords: ['abajur', 'luminaria', 'lampada', 'luz'], w: 170, h: 340, a: '#e6c478', b: '#5a4632', states: ON_OFF, defaultState: 'on',
    draw: (c) => (c.state === 'on' ? el(0, -255, 130, 110, `fill="#ffe9a8" fill-opacity=".28"`) : '') + p('M0 -210V-14', `stroke="${c.b}" stroke-width="12"`) + el(0, -8, 60, 12, `fill="${c.b}" ${S(c)}`) + p('M-46 -320H46L78 -210H-78Z', `fill="${c.state === 'on' ? '#ffe9a8' : c.a}" ${S(c)}`),
  },
  {
    id: 'ceilinglamp', label: 'Luminária de teto', category: 'casa', keywords: ['pendente', 'lustre'], w: 180, h: 180, a: '#3d4a66', b: '#ffe9a8', wall: true, states: ON_OFF, defaultState: 'on',
    draw: (c) => p('M0 -180V-110', `stroke="${c.ink}" stroke-width="5"`) + (c.state === 'on' ? p('M-70 -40L-160 170H160L70 -40Z', `fill="${c.b}" fill-opacity=".14"`) : '') + `<circle cx="0" cy="-36" r="22" fill="${c.state === 'on' ? c.b : '#b8b4aa'}" ${S(c)}/>` + p('M-80 -40Q-70 -112 0 -112Q70 -112 80 -40Z', `fill="${c.a}" ${S(c)}`),
  },
  {
    id: 'tv', label: 'Televisão', category: 'eletronicos', keywords: ['tv', 'televisao', 'televisor'], w: 420, h: 300, a: '#1f2230', b: '#5f8fbf', states: ON_OFF, defaultState: 'on',
    draw: (c) => r(-210, -300, 420, 250, `rx="14" fill="${c.a}" ${S(c)}`) + r(-192, -282, 384, 214, `rx="6" fill="${c.state === 'on' ? c.b : '#0d0f16'}"`) + (c.state === 'on' ? p('M-192 -130L-90 -220L-20 -160L70 -240L192 -120V-68H-192Z', `fill="${shade(c.b, 0.3)}"`) : p('M-150 -250L-70 -270', `stroke="#fff" stroke-opacity=".12" stroke-width="10"`)) + r(-22, -50, 44, 30, `fill="${c.a}" ${S(c)}`) + r(-110, -22, 220, 22, `rx="8" fill="${c.a}" ${S(c)}`),
  },
  {
    id: 'tvstand', label: 'Rack de TV', category: 'moveis', keywords: ['rack', 'aparador'], w: 460, h: 130, a: '#6e5038', b: '#8c6a4f',
    draw: (c) => r(-230, -130, 460, 110, `rx="6" fill="${c.a}" ${S(c)}`) + r(-212, -116, 200, 80, `fill="${c.b}" ${S(c, 3)}`) + r(12, -116, 200, 80, `fill="${c.b}" ${S(c, 3)}`) + `<circle cx="-30" cy="-76" r="5" fill="${c.ink}"/><circle cx="30" cy="-76" r="5" fill="${c.ink}"/>` + r(-210, -20, 20, 20, `fill="${c.ink}"`) + r(190, -20, 20, 20, `fill="${c.ink}"`),
  },
  {
    id: 'computer', label: 'Computador', category: 'eletronicos', keywords: ['computador', 'monitor', 'pc'], w: 240, h: 200, a: '#2b2d3a', b: '#7cc0d8', states: ON_OFF, defaultState: 'on',
    draw: (c) => r(-120, -200, 240, 150, `rx="9" fill="${c.a}" ${S(c)}`) + r(-106, -186, 212, 122, `rx="3" fill="${c.state === 'on' ? c.b : '#0d0f16'}"`) + (c.state === 'on' ? p('M-88 -160H40M-88 -136H80M-88 -112H10', `stroke="#fff" stroke-opacity=".8" stroke-width="7"`) : '') + r(-16, -50, 32, 34, `fill="${c.a}" ${S(c)}`) + r(-70, -18, 140, 18, `rx="6" fill="${c.a}" ${S(c)}`),
  },
  {
    id: 'laptop', label: 'Notebook', category: 'eletronicos', keywords: ['notebook', 'laptop'], w: 200, h: 130, a: '#a9b1bb', b: '#7cc0d8', states: ON_OFF, defaultState: 'on',
    draw: (c) => p('M-78 -130H78L88 -18H-88Z', `fill="${c.a}" ${S(c)}`) + p('M-66 -118H66L74 -28H-74Z', `fill="${c.state === 'on' ? c.b : '#0d0f16'}"`) + r(-100, -18, 200, 18, `rx="5" fill="${shade(c.a, 0.18)}" ${S(c)}`),
  },
  {
    id: 'fridge', label: 'Geladeira', category: 'casa', keywords: ['geladeira', 'refrigerador'], w: 230, h: 480, a: '#dfe5e8', b: '#9aa3ad',
    draw: (c) => r(-115, -480, 230, 470, `rx="18" fill="${c.a}" ${S(c)}`) + p('M-115 -320H115', S(c)) + r(-96, -370, 14, 34, `rx="6" fill="${c.b}" ${S(c, 3)}`) + r(-96, -300, 14, 70, `rx="6" fill="${c.b}" ${S(c, 3)}`) + r(-100, -12, 26, 12, `fill="${c.ink}"`) + r(74, -12, 26, 12, `fill="${c.ink}"`),
  },
  {
    id: 'stove', label: 'Fogão', category: 'casa', keywords: ['fogao', 'forno'], w: 250, h: 280, a: '#cfd4d8', b: '#2b2d3a', states: ON_OFF, defaultState: 'off',
    draw: (c) => r(-125, -250, 250, 250, `rx="8" fill="${c.a}" ${S(c)}`) + r(-100, -180, 200, 140, `rx="6" fill="${c.b}" ${S(c)}`) + (c.state === 'on' ? r(-82, -162, 164, 104, `rx="4" fill="#e8913f"`) : r(-82, -162, 164, 104, `rx="4" fill="#3f4356"`)) + r(-125, -280, 250, 32, `rx="6" fill="${c.b}" ${S(c)}`) + [-80, -27, 27, 80].map((x) => `<circle cx="${x}" cy="-214" r="11" fill="${c.b}" ${S(c, 3)}/>`).join(''),
  },
  {
    id: 'sink', label: 'Pia com armário', category: 'casa', keywords: ['pia', 'armario', 'balcao', 'bancada'], w: 420, h: 230, a: '#d7dee0', b: '#7e6a55',
    draw: (c) => r(-210, -180, 420, 180, `rx="4" fill="${c.b}" ${S(c)}`) + r(-196, -160, 186, 148, `fill="${shade(c.b, 0.1)}" ${S(c, 3)}`) + r(10, -160, 186, 148, `fill="${shade(c.b, 0.1)}" ${S(c, 3)}`) + r(-220, -196, 440, 22, `rx="4" fill="${c.a}" ${S(c)}`) + p('M30 -196V-230H-30', `fill="none" stroke="#9aa3ad" stroke-width="10" stroke-linecap="round"`),
  },
  {
    id: 'phone', label: 'Celular', category: 'mao', keywords: ['celular', 'telefone', 'smartphone'], w: 54, h: 100, a: '#21222c', b: '#7cc0d8', handheld: true, states: ON_OFF, defaultState: 'on',
    draw: (c) => r(-27, -50, 54, 100, `rx="9" fill="${c.a}" ${S(c, 4)}`) + r(-21, -42, 42, 80, `rx="3" fill="${c.state === 'on' ? c.b : '#0d0f16'}"`),
  },
  {
    id: 'remote', label: 'Controle remoto', category: 'mao', keywords: ['controle', 'remoto'], w: 34, h: 110, a: '#2b2d3a', b: '#d65f5f', handheld: true,
    draw: (c) => r(-17, -55, 34, 110, `rx="9" fill="${c.a}" ${S(c, 4)}`) + `<circle cy="-36" r="7" fill="${c.b}"/>` + [-14, 4, 22].map((y) => `<circle cx="-7" cy="${y}" r="4" fill="#cfd4d8"/><circle cx="7" cy="${y}" r="4" fill="#cfd4d8"/>`).join(''),
  },
  {
    id: 'book', label: 'Livro', category: 'mao', keywords: ['livro', 'caderno'], w: 110, h: 76, a: '#c9574b', b: '#f4f1ea', handheld: true, states: OPEN_CLOSED, defaultState: 'closed',
    draw: (c) => c.state === 'open'
      ? p('M0 -30Q-30 -44 -58 -30V34Q-30 22 0 34Q30 22 58 34V-30Q30 -44 0 -30Z', `fill="${c.b}" ${S(c, 4)}`) + p('M0 -30V34', S(c, 3))
      : r(-48, -38, 96, 76, `rx="5" fill="${c.a}" ${S(c, 4)}`) + r(-38, -24, 40, 8, `fill="${c.b}"`),
  },
  {
    id: 'mug', label: 'Caneca', category: 'mao', keywords: ['caneca', 'xicara', 'cafe'], w: 70, h: 64, a: '#e9e4d8', b: '#7c5a44', handheld: true,
    draw: (c) => p('M26 -18Q50 -18 46 4Q42 20 22 18', `fill="none" ${S(c, 7)}`) + r(-30, -32, 58, 64, `rx="8" fill="${c.a}" ${S(c, 4)}`) + r(-26, -28, 50, 10, `fill="${c.b}"`),
  },
  {
    id: 'microphone', label: 'Microfone', category: 'mao', keywords: ['microfone', 'mic'], w: 40, h: 120, a: '#2b2d3a', b: '#9aa3ad', handheld: true,
    draw: (c) => r(-11, -14, 22, 76, `rx="6" fill="${c.a}" ${S(c, 4)}`) + `<circle cy="-34" r="20" fill="${c.b}" ${S(c, 4)}/>`,
  },
  {
    id: 'bag', label: 'Sacola', category: 'mao', keywords: ['sacola', 'bolsa'], w: 110, h: 130, a: '#e0b04c', b: '#7c5a44', handheld: true,
    draw: (c) => p('M-26 -36C-26 -74 26 -74 26 -36', `fill="none" stroke="${c.b}" stroke-width="7"`) + p('M-50 -36H50L58 62H-58Z', `fill="${c.a}" ${S(c, 4)}`),
  },
  {
    id: 'box', label: 'Caixa', category: 'casa', keywords: ['caixa', 'pacote'], w: 200, h: 170, a: '#c49a6c', b: '#a57f55',
    draw: (c) => r(-100, -170, 200, 170, `rx="4" fill="${c.a}" ${S(c)}`) + r(-18, -170, 36, 170, `fill="${c.b}"`) + r(-100, -170, 200, 170, `rx="4" fill="none" ${S(c)}`),
  },
  {
    id: 'board', label: 'Lousa', category: 'trabalho', keywords: ['lousa', 'quadro negro', 'quadro branco'], w: 640, h: 340, a: '#2f5448', b: '#8c6a4f', wall: true,
    draw: (c) => r(-320, -340, 640, 340, `rx="6" fill="${c.b}" ${S(c)}`) + r(-302, -322, 604, 290, `fill="${c.a}" ${S(c, 3)}`) + p('M-250 -260Q-160 -310 -70 -260T110 -260M-240 -170H60M-240 -110H-40', `fill="none" stroke="#e9f0e6" stroke-opacity=".7" stroke-width="7" stroke-linecap="round"`) + r(-302, -28, 604, 14, `fill="${shade(c.b, -0.2)}"`),
  },
  {
    id: 'schooldesk', label: 'Carteira escolar', category: 'trabalho', keywords: ['carteira', 'mesa escolar'], w: 220, h: 170, a: '#c9a273', b: '#5b6677',
    draw: (c) => p('M-84 -130V0M84 -130V0', `stroke="${c.b}" stroke-width="12"`) + p('M-110 -170H110L100 -128H-100Z', `fill="${c.a}" ${S(c)}`) + r(-100, -24, 200, 12, `fill="${c.b}"`),
  },
  {
    id: 'counter', label: 'Balcão', category: 'trabalho', keywords: ['balcao', 'caixa registradora'], w: 620, h: 230, a: '#6e4a3c', b: '#d7c7ad',
    draw: (c) => r(-310, -210, 620, 210, `rx="4" fill="${c.a}" ${S(c)}`) + r(-326, -230, 652, 30, `rx="8" fill="${c.b}" ${S(c)}`) + [-210, -70, 70, 210].map((x) => r(x - 50, -180, 100, 150, `rx="5" fill="${shade(c.a, 0.12)}" ${S(c, 3)}`)).join(''),
  },
  {
    id: 'podium', label: 'Púlpito', category: 'trabalho', keywords: ['pulpito', 'bancada', 'telejornal'], w: 340, h: 300, a: '#3b5f92', b: '#e0b04c',
    draw: (c) => p('M-170 -300H170L140 0H-140Z', `fill="${c.a}" ${S(c)}`) + r(-186, -316, 372, 26, `rx="7" fill="${c.b}" ${S(c)}`) + `<circle cy="-160" r="48" fill="${shade(c.a, 0.25)}" ${S(c, 4)}/>` + p('M-22 -170L0 -130L22 -170', `fill="none" stroke="#fff" stroke-width="8"`),
  },
  {
    id: 'car', label: 'Carro', category: 'veiculos', keywords: ['carro', 'automovel'], w: 760, h: 300, a: '#d65f5f', b: '#a8d4e8', states: [{ id: 'side', label: 'Lateral' }, { id: 'front', label: 'Frente' }], defaultState: 'side',
    draw: (c) => {
      if (c.state === 'front') {
        return r(-170, -90, 40, 90, `rx="8" fill="${c.ink}"`) + r(130, -90, 40, 90, `rx="8" fill="${c.ink}"`) + p('M-130 -290H130L168 -160H-168Z', `fill="${c.b}" ${S(c)}`) + r(-210, -170, 420, 120, `rx="26" fill="${c.a}" ${S(c)}`) + `<circle cx="-150" cy="-112" r="26" fill="#f6dc9a" ${S(c)}/><circle cx="150" cy="-112" r="26" fill="#f6dc9a" ${S(c)}/>` + r(-60, -128, 120, 40, `rx="6" fill="${c.ink}"`);
      }
      return p('M-370 -60V-140Q-360 -170 -280 -176L-160 -280H150L270 -176Q360 -170 376 -130V-60Z', `fill="${c.a}" ${S(c)}`) + p('M-130 -262H-10V-176H-226ZM14 -262H140L226 -176H14Z', `fill="${c.b}" ${S(c, 4)}`) + r(30, -160, 44, 12, `rx="5" fill="${c.ink}"`) + r(-130, -160, 44, 12, `rx="5" fill="${c.ink}"`) + [-210, 220].map((x) => `<circle cx="${x}" cy="-58" r="58" fill="#21222c" ${S(c)}/><circle cx="${x}" cy="-58" r="24" fill="#cfd4d8"/>`).join('') + r(340, -130, 34, 24, `rx="6" fill="#f6dc9a" ${S(c, 3)}`);
    },
  },
  {
    id: 'bike', label: 'Bicicleta', category: 'veiculos', keywords: ['bicicleta', 'bike'], w: 400, h: 220, a: '#4f86b5', b: '#21222c',
    draw: (c) => [-130, 130].map((x) => `<circle cx="${x}" cy="-70" r="68" fill="none" stroke="${c.b}" stroke-width="9"/><circle cx="${x}" cy="-70" r="6" fill="${c.b}"/>`).join('') + p('M-130 -70L-50 -170H70L130 -70M-50 -170L-10 -70L70 -170M-10 -70H-130M70 -170L60 -205H100M-50 -170L-62 -200', `fill="none" stroke="${c.a}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"`) + r(-92, -214, 60, 14, `rx="6" fill="${c.b}"`),
  },
  {
    id: 'tree', label: 'Árvore', category: 'natureza', keywords: ['arvore'], w: 440, h: 660, a: '#5f9c6c', b: '#7c5a44',
    draw: (c) => p('M-36 0L-22 -270H22L40 0Z', `fill="${c.b}" ${S(c)}`) + p('M-160 -320C-240 -350 -220 -470 -130 -470C-120 -580 40 -620 90 -520C190 -530 240 -420 170 -360C190 -280 70 -240 10 -270C-50 -230 -140 -260 -160 -320Z', `fill="${c.a}" ${S(c)}`) + p('M-100 -400Q-60 -470 10 -470', `fill="none" stroke="${shade(c.a, 0.28)}" stroke-width="13" stroke-linecap="round"`),
  },
  {
    id: 'bench', label: 'Banco de praça', category: 'natureza', keywords: ['banco', 'praca'], w: 480, h: 200, a: '#a6764e', b: '#3d4a4a',
    draw: (c) => p('M-190 -120V0M190 -120V0', `stroke="${c.b}" stroke-width="16"`) + [-198, -160].map((y) => r(-230, y, 460, 26, `rx="5" fill="${c.a}" ${S(c)}`)).join('') + r(-240, -100, 480, 26, `rx="5" fill="${c.a}" ${S(c)}`),
  },
  {
    id: 'streetlamp', label: 'Poste de luz', category: 'natureza', keywords: ['poste'], w: 200, h: 640, a: '#30384a', b: '#ffe9a8', states: ON_OFF, defaultState: 'on',
    draw: (c) => (c.state === 'on' ? el(66, -520, 150, 120, `fill="${c.b}" fill-opacity=".25"`) : '') + p('M0 0V-580Q0 -620 66 -610', `fill="none" stroke="${c.a}" stroke-width="15" stroke-linecap="round"`) + p('M36 -610H100L88 -560H48Z', `fill="${c.state === 'on' ? c.b : '#a8a498'}" ${S(c)}`) + r(-22, -28, 44, 28, `fill="${c.a}"`),
  },
  {
    id: 'trash', label: 'Lixeira', category: 'casa', keywords: ['lixeira', 'lixo'], w: 130, h: 180, a: '#6b7a86', b: '#4c5862',
    draw: (c) => p('M-54 -150H54L44 0H-44Z', `fill="${c.a}" ${S(c)}`) + r(-64, -170, 128, 24, `rx="8" fill="${c.b}" ${S(c)}`) + p('M-22 -120L-16 -30M22 -120L16 -30', `stroke="${c.b}" stroke-width="6"`),
  },
  {
    id: 'mirror', label: 'Espelho', category: 'casa', keywords: ['espelho'], w: 170, h: 300, a: '#d8c47b', b: '#cbe5ef', wall: true,
    draw: (c) => el(0, -150, 85, 150, `fill="${c.b}" stroke="${c.a}" stroke-width="13"`) + p('M-40 -200L20 -260M-30 -130L34 -210', `stroke="#fff" stroke-opacity=".7" stroke-width="9" stroke-linecap="round"`),
  },
  {
    id: 'toilet', label: 'Vaso sanitário', category: 'casa', keywords: ['privada', 'sanitario'], w: 180, h: 260, a: '#f0f2f2', b: '#c7ced2',
    draw: (c) => r(-70, -260, 140, 100, `rx="10" fill="${c.a}" ${S(c)}`) + p('M-80 -160H80Q80 -70 40 -50L50 0H-50L-40 -50Q-80 -70 -80 -160Z', `fill="${c.a}" ${S(c)}`) + el(0, -152, 66, 13, `fill="${c.b}" ${S(c, 3)}`),
  },
];

const BY_ID = new Map(PROPS.map((x) => [x.id, x]));
export const getProp = (id: string): PropDef | undefined => BY_ID.get(id);

export function renderProp(id: string, a: string, b: string, state: string, ink = '#23202b', nodeId = ''): string {
  const def = BY_ID.get(id);
  if (!def) return r(-50, -100, 100, 100, `fill="#d65f5f" stroke="${ink}" stroke-width="4" stroke-dasharray="10 8"`);
  return def.draw({ a: a || def.a, b: b || def.b, state: state || def.defaultState || '', ink, id: nodeId });
}

export const PROP_CATEGORY_LABELS: Record<PropDef['category'], string> = {
  moveis: 'Móveis',
  casa: 'Casa',
  eletronicos: 'Eletrônicos',
  mao: 'De mão',
  veiculos: 'Veículos',
  trabalho: 'Trabalho e escola',
  natureza: 'Exterior',
};

/** Caixa local (âncora na base, exceto objetos de mão, ancorados no centro). */
export function propBounds(def: PropDef): { x: number; y: number; w: number; h: number } {
  if (def.handheld) return { x: -def.w / 2, y: -def.h / 2, w: def.w, h: def.h };
  return { x: -def.w / 2, y: -def.h, w: def.w, h: def.h };
}

export const nStr = n;
