/** Expressões: conjuntos de parâmetros de UM rosto. Nunca sobrepõem outro rosto. */
export interface MouthParams {
  /** meia-largura relativa (1 = padrão) */
  w: number;
  /** abertura 0–1 */
  open: number;
  /** curvatura: + sorriso, − tristeza */
  curve: number;
  teeth: number;
  tongue: number;
  skew: number;
  round: number;
}

export interface ExpressionDef {
  id: string;
  label: string;
  browY: number;
  browAngle: number;
  browCurve: number;
  browAsym: number;
  /** Abertura visível (pálpebra superior) 0–1,1. A órbita não muda. */
  open: number;
  /** Pálpebra inferior 0–0,7. */
  lower: number;
  pupil: number;
  gazeX: number;
  gazeY: number;
  mouth: MouthParams;
  tears?: boolean;
  blush?: boolean;
  sweat?: boolean;
  hearts?: boolean;
  zzz?: boolean;
  gloom?: boolean;
  keywords: string[];
}

const m = (w: number, open: number, curve: number, teeth = 0, tongue = 0, skew = 0, round = 0): MouthParams => ({
  w, open, curve, teeth, tongue, skew, round,
});

const e = (
  id: string,
  label: string,
  o: Partial<Omit<ExpressionDef, 'id' | 'label' | 'mouth' | 'keywords'>>,
  mouth: MouthParams,
  keywords: string[],
): ExpressionDef => ({
  id, label, browY: 0, browAngle: 0, browCurve: 0.5, browAsym: 0, open: 1, lower: 0, pupil: 1, gazeX: 0, gazeY: 0,
  mouth, keywords, ...o,
});

export const EXPRESSIONS: ExpressionDef[] = [
  e('neutral', 'Neutro', {}, m(0.8, 0, 0.1), ['neutra', 'normal', 'serio', 'seria']),
  e('happy', 'Feliz', { browY: -3, lower: 0.12 }, m(1, 0.1, 0.9), ['alegre', 'contente', 'sorrindo', 'sorriso']),
  e('laughing', 'Rindo', { browY: -6, open: 0.55, lower: 0.3 }, m(1.15, 0.85, 1, 1, 0.7), ['risada', 'gargalhando', 'rir']),
  e('excited', 'Empolgado', { browY: -10, open: 1.1, pupil: 1.1 }, m(1.1, 0.7, 1, 1, 0.3), ['animado', 'empolgada', 'animada']),
  e('angry', 'Bravo', { browY: 7, browAngle: 20, browCurve: 0, open: 0.8, lower: 0.2, pupil: 0.85 }, m(0.85, 0.35, -0.7, 1), ['brava', 'furioso', 'furiosa', 'raiva', 'zangado']),
  e('irritated', 'Irritado', { browY: 5, browAngle: 12, browCurve: 0.1, open: 0.7, lower: 0.15 }, m(0.75, 0, -0.45, 0, 0, 0.15), ['irritada', 'chateado', 'chateada', 'impaciente']),
  e('sad', 'Triste', { browY: -2, browAngle: -16, open: 0.8, gazeY: 0.35 }, m(0.7, 0.05, -0.75), ['tristeza', 'melancolico', 'deprimido']),
  e('crying', 'Chorando', { browY: -4, browAngle: -20, open: 0.55, gazeY: 0.3, tears: true }, m(0.9, 0.55, -0.9, 0, 0.3), ['choro', 'chorar', 'lagrimas']),
  e('surprised', 'Surpreso', { browY: -14, browCurve: 0.9, open: 1.1, pupil: 0.8 }, m(0.5, 0.7, 0, 0, 0, 0, 1), ['surpresa', 'chocado', 'chocada']),
  e('astonished', 'Espantado', { browY: -18, browCurve: 1, open: 1.1, pupil: 0.6 }, m(0.6, 1, 0, 0, 0.3, 0, 1), ['espanto', 'boquiaberto', 'pasmo']),
  e('scared', 'Assustado', { browY: -10, browAngle: -14, open: 1.1, pupil: 0.55, sweat: true }, m(0.95, 0.45, -0.35, 1), ['medo', 'assustada', 'apavorado', 'susto']),
  e('suspicious', 'Desconfiado', { browY: 4, browAngle: 8, browAsym: 11, open: 0.55, lower: 0.2, gazeX: 0.5 }, m(0.65, 0, -0.1, 0, 0, 0.35), ['desconfianca', 'duvidando', 'suspeita']),
  e('confused', 'Confuso', { browY: -2, browAsym: 14, browCurve: 0.7 }, m(0.6, 0.05, -0.1, 0, 0, -0.45), ['confusa', 'perdido', 'sem entender']),
  e('ashamed', 'Envergonhado', { browAngle: -10, open: 0.7, gazeY: 0.7, blush: true }, m(0.5, 0, -0.1, 0, 0, 0.2), ['vergonha', 'timido', 'corado']),
  e('shy', 'Tímido', { browAngle: -6, open: 0.8, gazeX: -0.5, gazeY: 0.5, blush: true }, m(0.45, 0, 0.45), ['timida', 'encabulado']),
  e('sleepy', 'Com sono', { browY: 3, browAngle: -4, open: 0.28, zzz: true }, m(0.5, 0.15, 0, 0, 0, 0, 0.5), ['sono', 'sonolento', 'dormindo', 'bocejo']),
  e('tired', 'Cansado', { browY: 3, browAngle: -8, open: 0.5, lower: 0.15, gloom: true }, m(0.65, 0.05, -0.25), ['cansada', 'exausto', 'esgotado']),
  e('mocking', 'Deboche', { browY: -2, browAsym: 16, open: 0.65, lower: 0.2, gazeX: 0.4 }, m(0.85, 0.05, 0.65, 0, 0, 0.5), ['debochado', 'zombando', 'sarcastico', 'ironia']),
  e('love', 'Apaixonado', { browY: -5, browAngle: -6, open: 0.9, hearts: true, blush: true }, m(0.75, 0.1, 0.8), ['paixao', 'apaixonada', 'amor']),
  e('thinking', 'Pensativo', { browY: -3, browAsym: 8, open: 0.85, gazeX: 0.6, gazeY: -0.7 }, m(0.5, 0, 0, 0, 0, 0.35), ['pensando', 'pensativa', 'refletindo']),
  e('disgusted', 'Com nojo', { browY: 5, browAngle: 10, browAsym: 5, open: 0.6, lower: 0.35 }, m(0.8, 0.3, -0.7, 0, 0.9, 0.25), ['nojo', 'enojado', 'eca']),
  e('worried', 'Preocupado', { browY: -5, browAngle: -18, open: 0.95, sweat: true }, m(0.7, 0.02, -0.4, 0, 0, 0.2), ['preocupada', 'preocupacao', 'nervoso', 'ansioso']),
  e('proud', 'Orgulhoso', { browY: -4, open: 0.65, lower: 0.1 }, m(0.85, 0, 0.7, 0, 0, 0.15), ['orgulhosa', 'convencido', 'confiante']),
  e('bored', 'Entediado', { browY: 2, open: 0.5, lower: 0.05, gazeX: 0.5 }, m(0.6, 0, -0.05), ['entediada', 'tedio']),
];

const BY_ID = new Map(EXPRESSIONS.map((x) => [x.id, x]));
export const NEUTRAL = BY_ID.get('neutral')!;
export const getExpression = (id: string): ExpressionDef => BY_ID.get(id) ?? NEUTRAL;

/** Visemas simplificados: substituem a boca atual; nunca adicionam outra. */
export const VISEMES: Record<string, { label: string; mouth: MouthParams }> = {
  rest: { label: 'Fechada', mouth: m(0.6, 0, 0) },
  M: { label: 'M/B/P', mouth: m(0.65, 0, 0) },
  A: { label: 'A', mouth: m(0.85, 0.9, 0.05, 0.4, 0.5) },
  E: { label: 'E', mouth: m(0.95, 0.5, 0.1, 0.8, 0.1) },
  I: { label: 'I', mouth: m(1, 0.22, 0.2, 1) },
  O: { label: 'O', mouth: m(0.55, 0.7, 0, 0, 0.1, 0, 1) },
  U: { label: 'U', mouth: m(0.34, 0.38, 0, 0, 0, 0, 1) },
  F: { label: 'F/V', mouth: m(0.72, 0.14, 0, 1) },
  L: { label: 'L/N/T', mouth: m(0.75, 0.42, 0.05, 0.5, 0.9) },
  S: { label: 'S/Z', mouth: m(0.85, 0.12, 0.1, 1) },
};

export const blendMouth = (a: MouthParams, b: MouthParams, t: number): MouthParams => ({
  w: a.w + (b.w - a.w) * t,
  open: a.open + (b.open - a.open) * t,
  curve: a.curve + (b.curve - a.curve) * t,
  teeth: a.teeth + (b.teeth - a.teeth) * t,
  tongue: a.tongue + (b.tongue - a.tongue) * t,
  skew: a.skew + (b.skew - a.skew) * t,
  round: a.round + (b.round - a.round) * t,
});
