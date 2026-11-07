/** Catálogos com rótulos pt-BR para o criador de personagens e para os comandos. */
import { EAR_STYLES, EYE_STYLES, BROW_STYLES, NOSE_STYLES } from './face';

export interface Option { id: string; label: string; keywords?: string[] }

export const HEAD_SHAPES: Option[] = [
  { id: 'oval', label: 'Oval' },
  { id: 'round', label: 'Redonda' },
  { id: 'square', label: 'Quadrada' },
  { id: 'heart', label: 'Coração' },
  { id: 'long', label: 'Alongada' },
  { id: 'diamond', label: 'Diamante' },
  { id: 'pear', label: 'Pera' },
  { id: 'wide', label: 'Larga' },
];

const lbl = (rec: Record<string, unknown>, labels: Record<string, string>): Option[] =>
  Object.keys(rec).map((id) => ({ id, label: labels[id] ?? id }));

export const EYE_OPTIONS = lbl(EYE_STYLES, { round: 'Redondos', oval: 'Ovais', almond: 'Amendoados', big: 'Grandes', small: 'Pequenos', sleepy: 'Sonolentos', wide: 'Largos', cat: 'Felinos' });
export const BROW_OPTIONS = lbl(BROW_STYLES, { soft: 'Suave', thick: 'Grossa', thin: 'Fina', arched: 'Arqueada', straight: 'Reta', bushy: 'Peluda', short: 'Curta', none: 'Sem sobrancelha' });
export const NOSE_OPTIONS = lbl(NOSE_STYLES, { button: 'Botão', small: 'Pequeno', round: 'Redondo', pointy: 'Pontudo', long: 'Comprido', wide: 'Largo', hook: 'Aquilino', bulb: 'Batata', flat: 'Achatado', upturned: 'Arrebitado' });
export const EAR_OPTIONS = lbl(EAR_STYLES, { round: 'Redondas', small: 'Pequenas', big: 'Grandes', pointy: 'Pontudas', none: 'Escondidas' });
export const MOUTH_OPTIONS: Option[] = [
  { id: 'simple', label: 'Simples' },
  { id: 'lips', label: 'Lábios finos' },
  { id: 'full', label: 'Lábios cheios' },
  { id: 'wide', label: 'Larga' },
  { id: 'small', label: 'Pequena' },
  { id: 'thin', label: 'Traço fino' },
  { id: 'cute', label: 'Miúda' },
];
export const MUSTACHE_OPTIONS: Option[] = [
  { id: 'none', label: 'Sem bigode' },
  { id: 'thin', label: 'Fino' },
  { id: 'pencil', label: 'Lápis' },
  { id: 'thick', label: 'Grosso', keywords: ['bigodao'] },
  { id: 'handlebar', label: 'Guidão' },
  { id: 'walrus', label: 'Morsa' },
];
export const BEARD_OPTIONS: Option[] = [
  { id: 'none', label: 'Sem barba' },
  { id: 'stubble', label: 'Por fazer' },
  { id: 'goatee', label: 'Cavanhaque' },
  { id: 'chin', label: 'Queixo' },
  { id: 'chinstrap', label: 'Contorno' },
  { id: 'full', label: 'Cheia' },
  { id: 'long', label: 'Longa' },
];

export const TOPS: Option[] = [
  { id: 'tshirt', label: 'Camiseta', keywords: ['camiseta', 'blusa'] },
  { id: 'tank', label: 'Regata', keywords: ['regata'] },
  { id: 'longsleeve', label: 'Manga longa', keywords: ['manga longa'] },
  { id: 'shirt', label: 'Camisa social', keywords: ['camisa', 'social'] },
  { id: 'polo', label: 'Polo', keywords: ['polo'] },
  { id: 'hoodie', label: 'Moletom com capuz', keywords: ['moletom', 'capuz'] },
  { id: 'sweater', label: 'Suéter', keywords: ['sueter', 'tricot', 'malha'] },
  { id: 'jacket', label: 'Jaqueta aberta', keywords: ['jaqueta'] },
  { id: 'blazer', label: 'Blazer', keywords: ['blazer', 'terno', 'paleto'] },
  { id: 'coat', label: 'Casaco longo', keywords: ['casaco', 'sobretudo'] },
  { id: 'dress', label: 'Vestido', keywords: ['vestido'] },
  { id: 'scrubs', label: 'Uniforme médico', keywords: ['medico', 'enfermeiro', 'jaleco'] },
  { id: 'police', label: 'Uniforme policial', keywords: ['policial', 'policia', 'guarda'] },
  { id: 'apron', label: 'Avental', keywords: ['avental', 'cozinheiro'] },
];

export const BOTTOMS: Option[] = [
  { id: 'pants', label: 'Calça', keywords: ['calca'] },
  { id: 'jeans', label: 'Jeans', keywords: ['jeans'] },
  { id: 'sweatpants', label: 'Calça de moletom', keywords: ['calca de moletom'] },
  { id: 'shorts', label: 'Bermuda', keywords: ['bermuda', 'shorts'] },
  { id: 'skirt', label: 'Saia curta', keywords: ['saia'] },
  { id: 'longskirt', label: 'Saia longa', keywords: ['saia longa'] },
];

export const SHOES: Option[] = [
  { id: 'sneakers', label: 'Tênis', keywords: ['tenis'] },
  { id: 'boots', label: 'Botas', keywords: ['bota', 'botas'] },
  { id: 'dress', label: 'Sapato social', keywords: ['sapato'] },
  { id: 'sandals', label: 'Sandálias', keywords: ['sandalia', 'chinelo'] },
  { id: 'heels', label: 'Salto', keywords: ['salto'] },
];

export const PATTERNS: Option[] = [
  { id: 'none', label: 'Lisa' },
  { id: 'stripes', label: 'Listrada', keywords: ['listrada', 'listras'] },
  { id: 'dots', label: 'Bolinhas', keywords: ['bolinhas', 'poa'] },
  { id: 'floral', label: 'Florida', keywords: ['florida', 'flores', 'floral'] },
  { id: 'plaid', label: 'Xadrez', keywords: ['xadrez'] },
];

export interface AccessoryOption extends Option { slot: 'head' | 'eyes' | 'neck' | 'ears' | 'wrist' | 'back' }
export const ACCESSORIES: AccessoryOption[] = [
  { id: 'cap', label: 'Boné', slot: 'head', keywords: ['bone'] },
  { id: 'beanie', label: 'Gorro', slot: 'head', keywords: ['gorro', 'touca'] },
  { id: 'fedora', label: 'Chapéu', slot: 'head', keywords: ['chapeu'] },
  { id: 'tophat', label: 'Cartola', slot: 'head', keywords: ['cartola'] },
  { id: 'headband', label: 'Faixa de cabelo', slot: 'head', keywords: ['faixa', 'tiara'] },
  { id: 'glasses', label: 'Óculos', slot: 'eyes', keywords: ['oculos'] },
  { id: 'squareglasses', label: 'Óculos quadrados', slot: 'eyes', keywords: ['oculos quadrados'] },
  { id: 'sunglasses', label: 'Óculos de sol', slot: 'eyes', keywords: ['oculos de sol'] },
  { id: 'earrings', label: 'Brincos', slot: 'ears', keywords: ['brinco', 'brincos'] },
  { id: 'necklace', label: 'Colar', slot: 'neck', keywords: ['colar'] },
  { id: 'scarf', label: 'Lenço', slot: 'neck', keywords: ['lenco', 'cachecol'] },
  { id: 'tie', label: 'Gravata', slot: 'neck', keywords: ['gravata'] },
  { id: 'bowtie', label: 'Gravata-borboleta', slot: 'neck', keywords: ['gravata borboleta'] },
  { id: 'watch', label: 'Relógio', slot: 'wrist', keywords: ['relogio'] },
  { id: 'backpack', label: 'Mochila', slot: 'back', keywords: ['mochila'] },
];

export const AGE_OPTIONS: Option[] = [
  { id: 'child', label: 'Criança', keywords: ['crianca', 'menino', 'menina', 'aluno', 'aluna'] },
  { id: 'teen', label: 'Adolescente', keywords: ['adolescente', 'jovem'] },
  { id: 'adult', label: 'Adulto', keywords: ['adulto'] },
  { id: 'elder', label: 'Idoso', keywords: ['idoso', 'idosa', 'velho', 'velha', 'senhor', 'senhora', 'vovo'] },
];

export const SKIN_PALETTE = ['#fbe0c8', '#f2c9a5', '#e8b48c', '#d49a6e', '#b97f55', '#9a6443', '#7a4a30', '#5a3524', '#3f261b'];
export const HAIR_PALETTE = ['#17141a', '#3a2b28', '#5c3b28', '#8a5a33', '#c58a45', '#e6c478', '#b5502f', '#cfcdc8', '#f4f1ea', '#c75c8c', '#4e7bd0', '#58a56d'];
export const CLOTH_PALETTE = ['#f4f1ea', '#2b2d3a', '#d65f5f', '#e98f4e', '#f2c95c', '#6dad6f', '#5b8dbe', '#3d4a66', '#8e6fc1', '#d27ba6', '#7c5a44', '#9aa3ad'];

/** Combinações inválidas para indicação visual, sem bloquear a edição. */
export function outfitConflicts(top: string, bottom: string, accessories: string[], hairTall: boolean): string[] {
  const out: string[] = [];
  if (top === 'dress') out.push('O vestido cobre a parte de baixo: a calça/saia escolhida fica oculta.');
  const heads = accessories.filter((a) => ACCESSORIES.find((o) => o.id === a)?.slot === 'head');
  if (heads.length > 1) out.push('Mais de um item na cabeça: eles ficarão sobrepostos.');
  const eyes = accessories.filter((a) => ACCESSORIES.find((o) => o.id === a)?.slot === 'eyes');
  if (eyes.length > 1) out.push('Dois óculos ao mesmo tempo: apenas o último é desenhado.');
  if (hairTall && heads.some((h) => h !== 'headband')) out.push('Este cabelo é alto: o chapéu pode cortar o volume.');
  if ((top === 'blazer' || top === 'hoodie' || top === 'coat') && accessories.includes('necklace')) out.push('O colar fica escondido por esta roupa.');
  if (bottom === 'longskirt' && top === 'coat') out.push('O casaco longo cobre parte da saia.');
  return out;
}
