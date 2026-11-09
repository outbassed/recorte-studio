/** S1 Os cem reais · S2 Surge o fiscal · S3 Duas confusões */
import type { Builder, Shot } from '../../lib';
import { convo } from '../../seq/common';
import { A, H } from './util';

type K = 'rafa' | 'bia' | 'caique' | 'samuca' | 'lari';
const RP: Record<K, [number, number, number]> = { caique: [-150, 432, 0.68], rafa: [-330, 416, 0.66], bia: [170, 442, 0.68], lari: [330, 426, 0.66], samuca: [490, 436, 0.66] };
const rua1 = (s: Shot, ks: K[], o: { ing?: boolean; look?: Partial<Record<K, string>>; ex?: Partial<Record<K, string>>; salgado?: boolean } = {}) => {
  s.prop('cartaz', 'obj_cartaz_show', { x: -760, y: 300, scale: 0.62, noShadow: false });
  s.prop('arvore', 'tree', { x: 800, y: 178, scale: 0.7, a: '#4f9a5c', bottom: true });
  for (const k of ks) A(s, k, RP[k][0], RP[k][1], RP[k][2], o.look?.[k] ?? 'caique', o.ex?.[k] ?? 'neutral');
  if (o.ing !== false && ks.includes('caique')) H(s, 'ingresso', 'obj_ingresso', 'caique:R', 0.28);
  if (o.salgado !== false && ks.includes('samuca')) H(s, 'salgado', 'obj_salgado', 'samuca:R', 0.8);
};
const ALL: K[] = ['caique', 'rafa', 'bia', 'lari', 'samuca'];

export function seqA1(B: Builder) {
  B.seq = 'S1 · Os cem reais';
  B.shot('Rua de Vila Torta: o cartaz do show (plano geral)', 'rua', 4600, (s) => {
    s.prop('cartaz', 'obj_cartaz_show', { x: -300, y: 330, scale: 0.8 });
    s.prop('faixa', 'obj_faixa_show', { x: 460, y: 160, scale: 0.8, noShadow: true });
    s.prop('arvore', 'tree', { x: 800, y: 178, scale: 0.7, a: '#4f9a5c', bottom: true });
    A(s, 'e1', -1100, 300, 0.5, { x: 900, y: 150 }, 'neutral'); s.walk('e1', 200, -1100, 900, { dur: 4200 });
    A(s, 'e5', 1100, 310, 0.5, { x: -900, y: 150 }, 'happy', { shirt: '#7b2fbf' }); s.walk('e5', 600, 1100, -700, { dur: 4000 });
    s.cam0({ x: -60, y: 20, zoom: 1.0 }); s.cam(0, { x: -240, y: 110, zoom: 1.3 }, 4400, 'easeInOut');
    s.dur(4600);
  });
  B.shot('Detalhe: cartaz "HOJE À NOITE! LON RUAN AO VIVO"', 'neutro', 3600, (s) => {
    s.shape('fundo', 'rect', { x: 0, y: 0, w: 2400, h: 1300, fill: '#c9b8d8', sw: 0, bottom: true });
    s.prop('cartaz', 'obj_cartaz_show', { x: 0, y: 520, scale: 1.4, noShadow: true });
    s.cam0({ x: 0, y: 160, zoom: 0.9 }); s.cam(0, { x: 0, y: -60, zoom: 1.1 }, 3500, 'linear');
    s.dur(3600);
  });
  B.shot('Caíque chega correndo com o ingresso', 'rua', 4400, (s) => {
    rua1(s, ['rafa'], { look: { rafa: 'caique' } });
    A(s, 'caique', -1100, 432, 0.68, 'rafa', 'excited'); H(s, 'ingresso', 'obj_ingresso', 'caique:R', 0.28);
    s.walk('caique', 0, -1100, -150, { dur: 2800, run: true });
    s.look('rafa', 0, 'caique');
    s.say('caique', 'HOJE TEM LON RUAN, PORRA!', { at: 2200, dur: 2000, g: 'none', ex: 'excited' });
    s.cam0({ x: -520, y: 60, zoom: 1.2 }); s.cam(0, { x: -240, zoom: 1.2 }, 3000, 'easeInOut');
    s.dur(4400);
  });
  convo(B, 'Detalhe: o ingresso de R$ 100', 'neutro', (s) => {
    s.shape('fundo', 'rect', { x: 0, y: 0, w: 2400, h: 1300, fill: '#8aa0b8', sw: 0, bottom: true });
    s.prop('ingresso', 'obj_ingresso', { x: 0, y: 330, scale: 1.8, noShadow: true, rot: -6 });
    s.cam0({ y: 40, zoom: 0.95 }); s.cam(0, { zoom: 1.1 }, 2800, 'linear');
  }, ['wide'], [], { dur: 2900 });
  convo(B, 'Rafael: "Tu tá falando disso desde segunda"', 'rua', (s) => rua1(s, ['caique', 'rafa'], { look: { rafa: 'caique' } }), ['two', ['rafa', 'caique']], [
    ['rafa', 'Tu tá falando disso desde segunda-feira.', { ex: 'tired', g: 'none', dur: 2600 }],
    ['caique', 'E VOU FALAR ATÉ DOMINGO!', { ex: 'excited', g: 'gesture', style: 'shout', dur: 2200 }],
    ['rafa', 'Mas hoje é sábado.', { ex: 'confused', g: 'none', dur: 1700 }],
  ], { extra: (s) => s.look('caique', 0, 'rafa') });
  convo(B, 'Caíque: "Então falta pouco!"', 'rua', (s) => rua1(s, ['caique', 'rafa']), ['close', 'caique'], [
    ['caique', 'ENTÃO FALTA POUCO!', { ex: 'excited', g: 'none', style: 'shout', dur: 1900 }],
  ], { extra: (s) => { s.look('caique', 0, 'rafa'); s.k('caique', 'rig.headNod', [[300, 0, 'linear'], [500, -10, 'easeOut'], [1300, 0, 'easeInOut']]); }, pad: 500 });
  convo(B, 'Rafael olha o ingresso: "Cem reais?"', 'rua', (s) => rua1(s, ['caique', 'rafa']), ['two', ['rafa', 'caique'], { dx: -30 }], [
    ['rafa', 'Cem reais?', { ex: 'surprised', g: 'point', side: 'R', dur: 1500 }],
    ['caique', 'Dinheiro bem investido!', { ex: 'proud', g: 'gesture', dur: 2000 }],
  ], { extra: (s) => { s.look('rafa', 0, 'ingresso'); s.look('caique', 0, 'rafa'); } });
  B.shot('Bia e Larissa se aproximam', 'rua', 3600, (s) => {
    rua1(s, ['caique', 'rafa'], { look: { caique: 'rafa', rafa: 'bia' } });
    A(s, 'bia', 1000, 442, 0.68, 'caique', 'irritated'); A(s, 'lari', 1160, 426, 0.66, 'caique', 'happy');
    s.walk('bia', 0, 1000, 170, { dur: 3000 }); s.walk('lari', 150, 1160, 330, { dur: 3000 });
    s.look('rafa', 800, 'bia');
    s.cam0({ x: 200, y: 60, zoom: 1.15 }); s.cam(0, { x: 20, zoom: 1.15 }, 3400, 'easeInOut');
    s.dur(3600);
  });
  convo(B, 'Bia: "Tu pagou cem reais pra ouvir um cara gritando?"', 'rua', (s) => rua1(s, ['caique', 'rafa', 'bia', 'lari'], { ex: { bia: 'irritated' } }), ['two', ['bia', 'caique'], { dx: -20 }], [
    ['bia', 'Tu pagou cem reais pra ouvir um cara gritando num microfone?', { ex: 'disgusted', g: 'gesture', side: 'R', dur: 4200 }],
    ['caique', 'Não é um cara qualquer, minha princesa.', { ex: 'love', g: 'none', dur: 2700 }],
  ], { extra: (s) => { s.look('bia', 0, 'caique'); s.look('caique', 0, 'bia'); } });
  convo(B, 'Bia: "Não me chama de princesa!"', 'rua', (s) => rua1(s, ['caique', 'rafa', 'bia', 'lari']), ['close', 'bia'], [
    ['bia', 'NÃO ME CHAMA DE PRINCESA!', { ex: 'angry', g: 'none', style: 'shout', dur: 2100 }],
  ], { extra: (s) => { s.look('bia', 0, 'caique'); s.fx('shake', 300, 500, 0.4); }, pad: 500 });
  convo(B, 'Larissa: "Vai chegar rouco no show"', 'rua', (s) => rua1(s, ['caique', 'rafa', 'bia', 'lari']), ['two', ['lari', 'caique'], { dx: 100 }], [
    ['lari', 'Caíque, se você continuar assim, vai chegar rouco no show.', { ex: 'laughing', g: 'gesture', dur: 3600 }],
    ['caique', 'Eu vou perder a voz de tanto cantar!', { ex: 'excited', g: 'gesture', side: 'R', dur: 2600 }],
  ], { extra: (s) => { s.look('lari', 0, 'caique'); s.look('caique', 0, 'lari'); } });
  B.shot('Samuca chega com um salgado', 'rua', 5000, (s) => {
    rua1(s, ['caique', 'rafa', 'bia', 'lari'], { look: { caique: 'samuca', rafa: 'samuca', bia: 'samuca', lari: 'samuca' } });
    A(s, 'samuca', 1250, 436, 0.66, 'caique', 'happy'); H(s, 'salgado', 'obj_salgado', 'samuca:R', 0.8);
    s.walk('samuca', 0, 1250, 490, { dur: 2300 });
    s.say('samuca', 'Vocês estão falando do show? Vai vender comida lá?', { at: 2500, dur: 2700, g: 'none', ex: 'thinking' });
    s.cam0({ x: 300, y: 50, zoom: 1.15 }); s.cam(0, { x: 120, zoom: 1.15 }, 4000, 'easeInOut');
    s.dur(5000);
  });
  B.shot('Todos olham para ele — corte seco', 'rua', 1900, (s) => {
    rua1(s, ALL, { ex: { caique: 'confused', rafa: 'tired', bia: 'bored', lari: 'surprised', samuca: 'thinking' } });
    for (const k of ['caique', 'rafa', 'bia', 'lari'] as K[]) s.look(k, 0, 'samuca');
    s.frame('wide', []); s.cam0({ x: 160, y: 40, zoom: 1.35 });
    s.dur(1900);
  });
}

/* ------------------------------- S2: SURGE O FISCAL ------------------------------- */
const RES = 'rua';
export const norb = (s: Shot, x: number, y = 232, sc = 0.62, ex = 'proud') => {
  A(s, 'fiscal', x, y, sc, 'cam', ex, { who: 'norberto' });
  H(s, 'prancheta', 'book', 'fiscal:L', 0.7);
};
const casa = (s: Shot, o: { cadeira?: boolean; zefa?: boolean; ex?: string } = {}) => {
  s.prop('arvore', 'tree', { x: -820, y: 175, scale: 0.62, a: '#4f9a5c', bottom: true });
  s.prop('portao', 'door', { x: 520, y: 232, scale: 0.55 });
  if (o.cadeira !== false) s.prop('cadeira', 'chair', { x: 360, y: 250, scale: 0.55, a: '#f4f1ea', b: '#cfd4d8' });
  if (o.zefa !== false) A(s, 'zefa', 360, 252, 0.6, 'fiscal', o.ex ?? 'neutral', { who: 'senhora', pose: 'sit' });
};
export function seqA2(B: Builder) {
  B.seq = 'S2 · Surge o fiscal';
  B.shot('Seu Norberto mede a calçada com fita métrica', RES, 5400, (s) => {
    casa(s, { ex: 'neutral' });
    A(s, 'fiscal', -900, 232, 0.62, { x: 360, y: 150 }, 'proud', { who: 'norberto' });
    H(s, 'prancheta', 'book', 'fiscal:L', 0.7); H(s, 'fita', 'obj_fita_metrica', 'fiscal:R', 0.6);
    s.walk('fiscal', 0, -900, 120, { dur: 4200, speed: 0.9 });
    s.act('fiscal', 'gesture', 800, { dur: 1800, side: 'R', intensity: 0.6 });
    s.snd('passos', 100, 0.3, { dur: 2000 });
    s.cam0({ x: -300, y: 50, zoom: 1.15 }); s.cam(0, { x: 100, zoom: 1.2 }, 5000, 'easeInOut');
    s.dur(5400);
  });
  convo(B, 'Fiscal: "ATENÇÃO! ISSO AQUI NÃO PODE!"', RES, (s) => { casa(s); norb(s, 120); }, ['medium', 'fiscal', { dx: 80 }], [
    ['fiscal', 'ATENÇÃO! ISSO AQUI NÃO PODE!', { ex: 'angry', g: 'point', side: 'R', style: 'shout', dur: 2300 }],
  ], { extra: (s) => { s.look('fiscal', 0, 'zefa'); s.snd('apito', 700, 0.6); }, pad: 300 });
  convo(B, 'Senhora e fiscal: ocupação irregular', RES, (s) => { casa(s); norb(s, 120); }, ['two', ['zefa', 'fiscal'], { dy: -20 }], [
    ['zefa', 'O quê?', { ex: 'confused', g: 'none', dur: 1000 }],
    ['fiscal', 'Ocupação irregular da calçada!', { ex: 'proud', g: 'gesture', side: 'R', dur: 2400 }],
    ['zefa', 'Meu filho, eu moro aqui há quarenta anos.', { ex: 'tired', g: 'none', dur: 3000 }],
    ['fiscal', 'Justamente! Quarenta anos de infração!', { ex: 'angry', g: 'point', side: 'R', dur: 2900 }],
  ], { extra: (s) => { s.look('zefa', 0, 'fiscal'); s.look('fiscal', 0, 'zefa'); } });
  B.shot('Fiscal preenche a multa inventada', RES, 4200, (s) => {
    casa(s); norb(s, 120, 232, 0.62, 'proud'); s.look('fiscal', 0, { x: 120, y: 400 });
    s.prop('multa', 'obj_multa', { x: 0, y: 0, scale: 0.28, held: 'fiscal:L', noShadow: true });
    s.act('fiscal', 'gesture', 300, { dur: 3200, side: 'R', intensity: 0.5 });
    s.frame('medium', ['fiscal'], { dx: 60 }); s.cam(0, { zoom: 2.0 }, 4000, 'linear');
    s.dur(4200);
  });
  B.shot('Detalhe: o auto de infração (Pix da esposa)', 'neutro', 4000, (s) => {
    s.shape('fundo', 'rect', { x: 0, y: 0, w: 2400, h: 1300, fill: '#a8b8c8', sw: 0, bottom: true });
    s.prop('multa', 'obj_multa', { x: 0, y: 40, scale: 1.45, noShadow: true, rot: -2 });
    s.cam0({ x: 0, y: 0, zoom: 0.95 }); s.cam(0, { x: 0, y: 0, zoom: 1.1 }, 3900, 'linear');
    s.dur(4000);
  });
  convo(B, 'Senhora: "Onde eu pago isso?" — "No Pix"', RES, (s) => { casa(s); norb(s, 120); }, ['two', ['zefa', 'fiscal']], [
    ['zefa', 'E onde eu pago isso?', { ex: 'confused', g: 'none', dur: 1800 }],
    ['fiscal', 'Pode ser no Pix.', { ex: 'proud', g: 'none', dur: 1700 }],
    ['zefa', 'Pix da prefeitura?', { ex: 'suspicious', g: 'none', dur: 1800 }],
    ['fiscal', 'Da minha esposa. O sistema oficial ainda está em desenvolvimento.', { ex: 'proud', g: 'gesture', side: 'L', dur: 4300 }],
  ], { extra: (s) => { s.look('zefa', 0, 'fiscal'); s.look('fiscal', 0, 'zefa'); } });
  convo(B, 'A senhora olha, incrédula', RES, (s) => { casa(s); norb(s, 120); }, ['close', 'zefa'], [], {
    dur: 2400, extra: (s) => { s.ex('zefa', 0, 'suspicious'); s.ex('zefa', 1200, 'disgusted'); s.look('zefa', 0, 'fiscal'); s.act('zefa', 'shakeHead', 600, { dur: 900, intensity: 0.4 }); },
  });
  B.shot('Close no crachá: "FISCAL GERAL DE TUDO"', 'neutro', 4400, (s) => {
    s.shape('fundo', 'rect', { x: 0, y: 0, w: 2400, h: 1300, fill: '#e8dcc0', sw: 0, bottom: true });
    s.shape('colete', 'rect', { x: 0, y: 240, w: 1300, h: 900, fill: '#d4ff00', sw: 6, radius: 30 });
    s.prop('cracha', 'obj_cracha', { x: 0, y: 40, scale: 1.5, noShadow: true });
    s.k('cracha', 'transform.rotationDeg', [[0, -2, 'linear'], [1800, 2, 'easeInOut'], [3600, -2, 'easeInOut']]);
    s.cam0({ x: 0, y: 0, zoom: 0.95 }); s.cam(0, { y: 0, zoom: 1.1 }, 4300, 'linear');
    s.dur(4400);
  });
  B.shot('O fiscal segue procurando outra infração', RES, 5200, (s) => {
    casa(s); A(s, 'fiscal', 120, 232, 0.62, { x: 1000, y: 200 }, 'proud', { who: 'norberto' });
    H(s, 'prancheta', 'book', 'fiscal:L', 0.7);
    s.walk('fiscal', 800, 120, 1100, { dur: 4200 });
    s.look('zefa', 0, 'fiscal'); s.ex('zefa', 1500, 'angry');
    s.say('fiscal', 'Lixeira fora do alinhamento... ISSO AQUI NÃO PODE!', { at: 1800, dur: 3200, g: 'none', ex: 'angry' });
    s.cam0({ x: 200, y: 40, zoom: 1.1 }); s.cam(0, { x: 520, zoom: 1.1 }, 5000, 'easeInOut');
    s.dur(5200);
  });
}

/* ------------------------------- S3: DUAS CONFUSÕES ------------------------------- */
const SALA = 'sala';
import { sala } from '../../seq/s06-debate';
const salaA = (s: Shot, ks: K[], ex: Partial<Record<K, string>> = {}) => {
  s.prop('cartaz-sala', 'obj_cartaz_show', { x: 70, y: 380, scale: 0.35, noShadow: true });
  sala(s, ks, { tv: false, ex, look: { caique: 'bia', bia: 'caique', rafa: 'caique', lari: 'caique', samuca: 'cartaz-sala' } });
  s.prop('celular-musica', 'phone', { x: 0, y: 0, scale: 1.3, held: 'caique:R', noShadow: true });
};
export function seqA3(B: Builder) {
  B.seq = 'S3 · Duas confusões';
  B.shot('Sala do Rafa e da Bia: Caíque ouve a prévia (plano geral)', SALA, 4400, (s) => {
    salaA(s, ['bia', 'lari', 'rafa', 'caique', 'samuca'], { caique: 'excited', bia: 'angry', rafa: 'tired', lari: 'happy', samuca: 'thinking' });
    s.cam0({ x: 60, y: 40, zoom: 1.0 }); s.cam(0, { x: -40, zoom: 1.2 }, 4200, 'easeInOut');
    s.snd('beat', 300, 0.35, { dur: 4000 });
    s.k('caique', 'rig.headNod', [[0, 0, 'linear'], [330, 6, 'easeInOut'], [660, 0, 'easeInOut'], [990, 6, 'easeInOut'], [1320, 0, 'easeInOut'], [1650, 6, 'easeInOut'], [1980, 0, 'easeInOut'], [2310, 6, 'easeInOut'], [2640, 0, 'easeInOut']]);
    s.dur(4400);
  });
  convo(B, 'Bia: "DESLIGA ESSA PORRA!"', SALA, (s) => salaA(s, ['bia', 'lari', 'rafa', 'caique', 'samuca']), ['close', 'bia'], [
    ['bia', 'Caíque, DESLIGA ESSA PORRA!', { ex: 'angry', g: 'none', style: 'shout', dur: 2400 }],
  ], { extra: (s) => { s.look('bia', 0, 'caique'); s.snd('beat', 0, 0.3, { dur: 2800 }); s.fx('shake', 300, 400, 0.3); } });
  convo(B, 'Caíque: "Tu não entende cultura!"', SALA, (s) => salaA(s, ['bia', 'lari', 'rafa', 'caique', 'samuca']), ['medium', 'caique', { dx: 60 }], [
    ['caique', 'Tu não entende cultura!', { ex: 'angry', g: 'gesture', side: 'L', dur: 2100 }],
  ], { extra: (s) => s.snd('beat', 0, 0.25, { dur: 2400 }) });
  convo(B, 'Rafael: "Já ouviu o álbum inteiro três vezes"', SALA, (s) => salaA(s, ['bia', 'lari', 'rafa', 'caique', 'samuca']), ['two', ['rafa', 'caique'], { dx: 40 }], [
    ['rafa', 'Tu já ouviu o álbum inteiro três vezes.', { ex: 'tired', g: 'none', dur: 2700 }],
    ['caique', 'Quatro. Eu comecei de novo.', { ex: 'proud', g: 'none', dur: 2200 }],
  ]);
  convo(B, 'Larissa: aproveita o show, mas discorda do cantor', SALA, (s) => salaA(s, ['bia', 'lari', 'rafa', 'caique', 'samuca']), ['medium', 'lari', { dx: 60 }], [
    ['lari', 'Eu vou curtir o show, mas não concordo com tudo que ele fala, tá?', { ex: 'worried', g: 'shrug', dur: 4300 }],
  ]);
  convo(B, 'Caíque acha um absurdo', SALA, (s) => salaA(s, ['bia', 'lari', 'rafa', 'caique', 'samuca']), ['close', 'caique'], [
    ['caique', 'COMO ASSIM "NÃO CONCORDA"?!', { ex: 'astonished', g: 'none', style: 'shout', dur: 2300 }],
  ], { extra: (s) => { s.look('caique', 0, 'lari'); s.fx('shake', 250, 400, 0.3); }, pad: 500 });
  // trama B — duas fiscalizações intercaladas
  B.shot('Fiscal x rapaz da bicicleta', 'rua', 6400, (s) => {
    s.prop('arvore', 'tree', { x: 800, y: 178, scale: 0.7, a: '#4f9a5c', bottom: true });
    s.prop('bike', 'bike', { x: -80, y: 270, scale: 0.55 });
    A(s, 'rapaz', -250, 252, 0.62, 'fiscal', 'confused', { who: 'rapaz' }); A(s, 'fiscal', 150, 240, 0.62, 'rapaz', 'angry', { who: 'norberto' });
    H(s, 'prancheta', 'book', 'fiscal:L', 0.7); H(s, 'multa', 'obj_multa', 'fiscal:R', 0.2);
    s.t = 500;
    s.say('fiscal', 'Bicicleta estacionada em desacordo com o alinhamento! ISSO AQUI NÃO PODE!', { ex: 'angry', g: 'point', side: 'R', dur: 4400 });
    s.say('rapaz', 'Qual lei o senhor tá aplicando?', { ex: 'suspicious', g: 'none', dur: 2300 });
    s.cam0({ x: 0, y: 60, zoom: 1.2 });
    s.end(300);
  });
  convo(B, 'Fiscal: "Uma lei municipal extremamente específica"', 'rua', (s) => { s.prop('bike', 'bike', { x: -80, y: 270, scale: 0.55 }); A(s, 'rapaz', -250, 252, 0.62, 'fiscal', 'suspicious', { who: 'rapaz' }); A(s, 'fiscal', 150, 240, 0.62, 'rapaz', 'proud', { who: 'norberto' }); H(s, 'prancheta', 'book', 'fiscal:L', 0.7); }, ['two', ['fiscal', 'rapaz']], [
    ['fiscal', 'Uma lei municipal extremamente específica.', { ex: 'proud', g: 'gesture', side: 'R', dur: 3000 }],
    ['rapaz', 'Qual?', { ex: 'suspicious', g: 'none', dur: 1000 }],
    ['fiscal', '...Ainda estou procurando o número.', { ex: 'worried', g: 'none', dur: 2700, gapBefore: 900 }],
  ], { extra: (s) => { s.look('fiscal', 0, 'rapaz'); s.look('rapaz', 0, 'fiscal'); s.ex('fiscal', 1900, 'proud'); } });
  convo(B, 'Samuca e o tamanho das caixas de som', SALA, (s) => salaA(s, ['bia', 'lari', 'rafa', 'caique', 'samuca']), ['medium', 'samuca', { dx: 150 }], [
    ['samuca', 'O cartaz diz "caixas de som gigantes". Gigante quanto? Do tamanho de uma geladeira? Cabe um salgado dentro?', { ex: 'thinking', g: 'gesture', side: 'R', dur: 6800 }],
  ], { extra: (s) => s.look('samuca', 0, 'cartaz-sala') });
  B.shot('Fiscal x dono do cachorro (som, lixo e cachorro)', 'rua', 5600, (s) => {
    s.prop('arvore', 'tree', { x: -800, y: 178, scale: 0.62, a: '#4f9a5c', bottom: true });
    s.prop('cao', 'obj_cachorro', { x: -80, y: 270, scale: 0.42 });
    A(s, 'dono', -270, 252, 0.62, 'fiscal', 'confused', { who: 'dono_cao' }); A(s, 'fiscal', 200, 240, 0.62, 'dono', 'angry', { who: 'norberto' });
    H(s, 'prancheta', 'book', 'fiscal:L', 0.7);
    s.t = 400;
    s.say('fiscal', 'Esse cachorro está latindo acima do decibelímetro regulamentar!', { ex: 'angry', g: 'point', side: 'R', dur: 4300 });
    s.say('dono', 'O senhor tem decibelímetro?', { ex: 'suspicious', g: 'none', dur: 2200 });
    s.say('fiscal', 'Tenho um aplicativo. Gratuito.', { ex: 'proud', g: 'none', dur: 2200 });
    s.cam0({ x: 0, y: 60, zoom: 1.15 });
    s.end(300);
  });
  B.shot('Apito: o fiscal apita à toa', 'rua', 2600, (s) => {
    A(s, 'fiscal', 0, 240, 0.7, 'cam', 'angry', { who: 'norberto' }); H(s, 'apito', 'obj_apito', 'fiscal:R', 0.7);
    s.frame('medium', ['fiscal']); s.act('fiscal', 'point', 200, { dur: 1200, side: 'L' }); s.snd('apito', 400, 0.7); s.fx('shake', 450, 500, 0.25);
    s.dur(2600);
  });
}
