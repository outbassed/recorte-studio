/** SEQUÊNCIA 3 — PÁTIO DA ESCOLA */
import type { Builder, Shot } from '../lib';
import { convo } from './common';

const BG = 'patio';
const POS = {
  bia: { x: -170, y: 432, scale: 0.68 },
  caique: { x: -350, y: 455, scale: 0.7 },
  rafa: { x: -520, y: 415, scale: 0.66 },
  lari: { x: 170, y: 425, scale: 0.68 },
  samuca: { x: 360, y: 455, scale: 0.7 },
} as const;
type K = keyof typeof POS;
const LOOK: Record<K, string> = { bia: 'caique', caique: 'bia', rafa: 'caique', lari: 'bia', samuca: 'bia' };
const WHO: Record<K, string> = { bia: 'bia', caique: 'caique', rafa: 'rafa', lari: 'lari', samuca: 'samuca' };
const EX0: Record<K, string> = { bia: 'neutral', caique: 'happy', rafa: 'neutral', lari: 'happy', samuca: 'happy' };

/** Conjunto do pátio: todos os personagens pedidos, nas posições canônicas, com bola/garrafa/panfletos. */
function pat(s: Shot, ks: K[], o: { papers?: boolean; book?: boolean; ex?: Partial<Record<K, string>>; look?: Partial<Record<K, string>>; at?: Partial<Record<K, { x?: number; y?: number }>> } = {}) {
  for (const k of ks) {
    const p = { ...POS[k], ...(o.at?.[k] ?? {}) };
    s.actor(k, WHO[k], { ...p, look: o.look?.[k] ?? LOOK[k], ex: o.ex?.[k] ?? EX0[k] });
  }
  if (ks.includes('lari')) s.prop('bola', 'obj_bola_volei', { x: 0, y: 0, scale: 0.8, held: 'lari:R', noShadow: true });
  if (ks.includes('samuca')) s.prop('garrafa', 'obj_garrafa', { x: 0, y: 0, scale: 0.7, held: 'samuca:L', noShadow: true });
  if (ks.includes('bia') && o.papers) {
    s.prop('pan-g', 'obj_panfleto_g', { x: 0, y: 0, scale: 0.2, held: 'bia:L', noShadow: true });
    s.prop('pan-p', 'obj_panfleto_p', { x: 0, y: 0, scale: 0.2, held: 'bia:R', noShadow: true });
  } else if (ks.includes('bia') && o.book !== false) s.prop('pasta', 'book', { x: 0, y: 0, scale: 0.7, held: 'bia:R', noShadow: true });
}
const ALL: K[] = ['bia', 'caique', 'rafa', 'lari', 'samuca'];

export function seq3(B: Builder) {
  B.seq = 'S3 · Pátio da escola';

  B.shot('Pátio: intervalo (plano geral) — Bia organiza, Lari quica a bola', BG, 3600, (s) => {
    pat(s, ['bia', 'lari'], { look: { bia: { x: -170, y: 200 } as never, lari: 'bia' } as never });
    s.look('bia', 0, { x: -200, y: 330 });
    s.cam0({ x: -40, y: 0, zoom: 1.0 });
    s.cam(0, { x: 20, zoom: 1.12 }, 3600, 'linear');
    // Lari quica a bola de vôlei no lugar (objeto da mão solta no ar e volta)
    s.k('bola', 'heldBy', [[0, `${s.id('lari')}:R`, 'hold']]);
    s.act('bia', 'gesture', 400, { dur: 1600, intensity: 0.4, side: 'L' });
    s.act('lari', 'jump', 900, { dur: 700, intensity: 0.4 });
    s.act('lari', 'jump', 2300, { dur: 700, intensity: 0.5 });
    s.dur(3600);
  });

  B.shot('Rafael e Caíque chegam caminhando (travelling)', BG, 4400, (s) => {
    pat(s, ['bia', 'lari']);
    s.actor('rafa', 'rafa', { x: -1250, y: 415, scale: 0.66, look: 'bia', ex: 'neutral' });
    s.actor('caique', 'caique', { x: -1400, y: 455, scale: 0.7, look: 'bia', ex: 'happy' });
    s.walk('rafa', 0, -1250, -520, { dur: 3800 });
    s.walk('caique', 0, -1400, -350, { dur: 4000 });
    s.look('bia', 2800, 'caique'); s.ex('bia', 3100, 'irritated');
    s.cam0({ x: -650, y: 20, zoom: 1.2 });
    s.cam(0, { x: -300, zoom: 1.2 }, 4200, 'easeInOut');
    s.dur(4400);
  });

  B.shot('Samuca aparece com a garrafa térmica', BG, 3800, (s) => {
    pat(s, ['bia', 'caique', 'rafa', 'lari']);
    s.actor('samuca', 'samuca', { x: 1250, y: 455, scale: 0.7, look: { x: 0, y: 200 }, ex: 'happy' });
    s.prop('garrafa', 'obj_garrafa', { x: 0, y: 0, scale: 0.7, held: 'samuca:L', noShadow: true });
    s.walk('samuca', 0, 1250, 360, { dur: 3200 });
    s.act('samuca', 'hold', 2300, { dur: 900, side: 'L', intensity: 0.8 });
    s.ex('samuca', 2300, 'excited');
    s.t = 3000;
    s.say('samuca', 'Bom dia, pessoal! Tá fresquinho!', { g: 'none', dur: 1800, at: 2000 });
    s.cam0({ x: 520, y: 40, zoom: 1.2 });
    s.cam(0, { x: 150, zoom: 1.05 }, 3600, 'easeInOut');
    s.end(200);
  });

  convo(B, 'Bia comenta a discussão da rua', BG, (s) => pat(s, ALL), ['two', ['bia', 'rafa']], [
    ['bia', 'Vocês viram a confusão na Rua das Mangueiras? Tinha gente brigando por causa do buraco e dos candidatos.', { ex: 'irritated', g: 'gesture' }],
    ['rafa', 'Vimos. O Caíque ainda deu palpite.', { ex: 'tired', g: 'none' }],
  ], { extra: (s) => { s.look('bia', 0, 'rafa'); s.look('rafa', 0, 'bia'); } });

  convo(B, 'Caíque flerta: "Bom dia pra você também, meu amor"', BG, (s) => pat(s, ALL), ['over', ['caique', 'bia']], [
    ['caique', 'Bom dia pra você também, meu amor.', { ex: 'mocking', g: 'none' }],
  ], { pad: 200 });
  convo(B, 'Bia corta: "Não começa, Caíque"', BG, (s) => pat(s, ALL, { ex: { bia: 'irritated' } }), ['close', 'bia'], [
    ['bia', 'Não começa, Caíque.', { ex: 'irritated', g: 'none', dur: 1500 }],
  ], { pad: 250 });
  convo(B, 'Caíque insiste', BG, (s) => pat(s, ALL), ['medium', 'caique', { dx: -60 }], [
    ['caique', 'Nossa, tá linda hoje. Dormiu bem?', { ex: 'love', g: 'none' }],
  ], { extra: (s) => { s.look('caique', 0, 'bia'); }, pad: 150 });
  convo(B, 'Bia: "Dormi até você abrir essa boca"', BG, (s) => pat(s, ALL, { ex: { bia: 'angry' } }), ['close', 'bia'], [
    ['bia', 'Dormi até você abrir essa boca.', { ex: 'angry', g: 'none' }],
  ], { extra: (s) => s.act('bia', 'shakeHead', 300, { dur: 700, intensity: 0.5 }), pad: 700 });
  convo(B, 'Rafael pede que ele pare', BG, (s) => pat(s, ALL), ['two', ['rafa', 'caique']], [
    ['rafa', 'Caíque, deixa a minha irmã em paz.', { ex: 'tired', g: 'facepalm', side: 'R', dur: 2200 }],
  ], { extra: (s) => { s.look('rafa', 0, 'caique'); s.look('caique', 0, 'rafa'); } });
  convo(B, 'Caíque: "Futuro casamento"', BG, (s) => pat(s, ALL), ['medium', 'caique', { dx: 80 }], [
    ['caique', 'Porra, Rafa, você é meu melhor amigo. Devia apoiar nosso futuro casamento.', { ex: 'happy', g: 'gesture', side: 'R' }],
  ], { extra: (s) => s.look('caique', 0, 'rafa') });
  convo(B, 'Bia explode: "Casamento é o caralho!"', BG, (s) => pat(s, ALL), ['close', 'bia'], [
    ['bia', 'CASAMENTO É O CARALHO!', { ex: 'angry', g: 'none', dur: 1900, style: 'shout' }],
  ], { extra: (s) => { s.fx('shake', 350, 700, 0.5); s.k('bia', 'rig.headNod', [[300, 0, 'linear'], [450, -12, 'easeOut'], [1300, 0, 'easeInOut']]); }, pad: 600 });
  convo(B, 'Reação: Lari ri, Rafael balança a cabeça', BG, (s) => pat(s, ALL), ['two', ['lari', 'rafa'], { dx: -150 }], [], {
    dur: 2200, extra: (s) => { s.ex('lari', 0, 'laughing'); s.act('lari', 'laugh', 150, { dur: 1700 }); s.ex('rafa', 0, 'tired'); s.act('rafa', 'shakeHead', 400, { dur: 900, intensity: 0.5 }); s.look('lari', 0, 'bia'); s.look('rafa', 0, 'caique'); },
  });

  convo(B, 'Samuca interrompe com curiosidades', BG, (s) => pat(s, ALL), ['medium', 'samuca', { dx: -20 }], [
    ['samuca', 'Falando em casamento, sabiam que antigamente o bolo era feito de frutas pra durar um ano inteiro? Eu ia comer tudo no primeiro dia. Alguém trouxe lanche?', { ex: 'excited', g: 'gesture', dur: 6400 }],
  ], { extra: (s) => { s.look('samuca', 0, 'bia'); s.act('samuca', 'think', 2400, { dur: 1500, side: 'R' }); } });
  convo(B, 'Todos olham para o Samuca', BG, (s) => pat(s, ALL), ['wide'], [], {
    dur: 1900, extra: (s) => { for (const k of ['bia', 'caique', 'rafa', 'lari'] as const) { s.look(k, 0, 'samuca'); } s.ex('bia', 0, 'tired'); s.ex('caique', 0, 'laughing'); s.cam0({ x: 60, y: 40, zoom: 1.2 }); },
  });

  convo(B, 'Bia apresenta os panfletos', BG, (s) => pat(s, ALL, { papers: true }), ['medium', 'bia', { dx: 90 }], [
    ['bia', 'Chega. Olha o que eu peguei na praça: o panfleto de cada candidato.', { ex: 'neutral', g: 'hold', side: 'L', dur: 3400 }],
  ], { extra: (s) => { s.act('bia', 'hold', 700, { dur: 2300, side: 'L', intensity: 1 }); } });

  B.shot('Detalhe: os dois panfletos lado a lado', BG, 3800, (s) => {
    s.shape('fundo', 'rect', { x: 0, y: 0, w: 2400, h: 1300, fill: '#6f8fb3', sw: 0, bottom: true });
    s.prop('p1', 'obj_panfleto_g', { x: -260, y: 460, scale: 1.7, noShadow: true, rot: -3 });
    s.prop('p2', 'obj_panfleto_p', { x: 260, y: 460, scale: 1.7, noShadow: true, rot: 3 });
    s.cam0({ x: 0, y: 40, zoom: 0.9 });
    s.cam(0, { x: -20, y: 90, zoom: 1.05 }, 3600, 'linear');
    s.dur(3800);
  });

  convo(B, 'Samuca lê as propostas', BG, (s) => pat(s, ALL, { papers: true }), ['two', ['samuca', 'bia']], [
    ['samuca', 'Vamos melhorar a saúde, a educação e a segurança. Esse aqui também diz saúde, educação e segurança. Ué... é o mesmo?', { ex: 'confused', g: 'none', dur: 5600 }],
    ['bia', 'Agora procura onde diz COMO.', { ex: 'irritated', g: 'point', side: 'L' }],
  ], { extra: (s) => { s.look('samuca', 0, 'pan-g'); s.look('bia', 0, 'samuca'); } });
  convo(B, 'Samuca procura o "como"', BG, (s) => pat(s, ALL, { papers: true }), ['close', 'samuca'], [
    ['samuca', 'Não diz como. Diz "em breve". Mas não diz o quê.', { ex: 'thinking', g: 'none', dur: 3400 }],
  ], { extra: (s) => s.look('samuca', 0, { x: 340, y: 200 }) });
  convo(B, 'Caíque: "copiaram até a cola"', BG, (s) => pat(s, ALL, { papers: true }), ['medium', 'caique', { dx: 80 }], [
    ['caique', 'Os caras copiaram até a cola, puta que pariu!', { ex: 'laughing', g: 'gesture', dur: 3000 }],
  ], { extra: (s) => { s.look('caique', 0, 'bia'); s.act('caique', 'laugh', 2600, { dur: 900, intensity: 0.6 }); } });

  convo(B, 'Samuca nota o cachorro', BG, (s) => pat(s, ALL, { papers: true }), ['medium', 'samuca', { dx: -40 }], [
    ['samuca', 'Mas o panfleto do Pinote tem um cachorro.', { ex: 'curious' as never, g: 'point', side: 'R', dur: 2500 }],
  ], { extra: (s) => { s.ex('samuca', 0, 'thinking'); s.look('samuca', 0, 'pan-p'); } });
  convo(B, 'Bia: "E daí?!"', BG, (s) => pat(s, ALL, { papers: true }), ['close', 'bia'], [
    ['bia', 'E DAÍ?!', { ex: 'angry', g: 'none', dur: 1200, style: 'shout' }],
  ], { extra: (s) => s.fx('shake', 250, 500, 0.4), pad: 300 });
  convo(B, 'Samuca: "Eu gostei do cachorro"', BG, (s) => pat(s, ALL, { papers: true }), ['medium', 'samuca', { dx: -40 }], [
    ['samuca', 'Nada. Eu gostei do cachorro.', { ex: 'happy', g: 'none', dur: 2000 }],
  ], { extra: (s) => s.look('samuca', 0, 'pan-p'), pad: 400 });

  // pausa visual
  B.shot('Pausa visual: o silêncio constrangido no pátio', BG, 3600, (s) => {
    pat(s, ALL, { papers: true, ex: { bia: 'tired', caique: 'confused', rafa: 'tired', lari: 'surprised', samuca: 'happy' } });
    for (const k of ['bia', 'caique', 'rafa', 'lari'] as const) s.look(k, 0, 'samuca');
    s.cam0({ x: 0, y: 40, zoom: 1.1 });
    s.cam(0, { x: 60, zoom: 1.3 }, 3500, 'linear');
    s.act('bia', 'facepalm', 1400, { dur: 1500, side: 'R' });
    s.dur(3600);
  });
}
