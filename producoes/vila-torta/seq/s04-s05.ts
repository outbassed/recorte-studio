/** SEQUÊNCIA 4 — AS TORCIDAS POLÍTICAS  ·  SEQUÊNCIA 5 — OS CAMARINS */
import type { Builder, Shot } from '../lib';
import { convo, figurante } from './common';

const PR = 'praca';
const PROT = {
  lari: { x: -110, y: 440, scale: 0.62 }, rafa: { x: 70, y: 410, scale: 0.58 }, caique: { x: -270, y: 425, scale: 0.6 },
  bia: { x: 230, y: 450, scale: 0.63 }, samuca: { x: 380, y: 420, scale: 0.58 },
} as const;
type PK = keyof typeof PROT;

/** Praça do Coreto: coreto ao fundo, bandeiras, cartazes, torcidas divididas e vendedor — igual em todas as tomadas. */
function praca(s: Shot, ks: PK[], o: { crowd?: boolean; vendor?: boolean; look?: Partial<Record<PK, string>>; ex?: Partial<Record<PK, string>>; at?: Partial<Record<PK, { x?: number; y?: number }>> } = {}) {
  s.prop('coreto', 'obj_coreto', { x: -20, y: 205, scale: 0.55, noShadow: true, bottom: true });
  s.prop('barraca', 'obj_barraca_cafe', { x: -700, y: 250, scale: 0.62 });
  s.prop('bandeira-g', 'obj_bandeira_g', { x: -840, y: 262, scale: 0.7, noShadow: true });
  s.prop('bandeira-p', 'obj_bandeira_p', { x: 800, y: 262, scale: 0.7, noShadow: true });
  if (o.crowd !== false) {
    figurante(s, 'e1', 'e1', 'G', -610, 345, 0.52, { look: 'e4' });
    figurante(s, 'e2', 'e2', 'G', -450, 365, 0.55, { look: 'e5' });
    figurante(s, 'e3', 'e3', 'G', -320, 340, 0.5, { look: 'e6' });
    figurante(s, 'e4', 'e4', 'P', 470, 345, 0.52, { look: 'e1' });
    figurante(s, 'e5', 'e5', 'P', 600, 368, 0.55, { look: 'e2' });
    figurante(s, 'e6', 'e6', 'P', 725, 340, 0.5, { look: 'e3' });
    s.prop('cartaz1', 'obj_cartaz_g', { x: 0, y: 0, scale: 0.5, held: 'e1:R', noShadow: true });
    s.prop('cartaz2', 'obj_cartaz_p', { x: 0, y: 0, scale: 0.5, held: 'e5:L', noShadow: true });
  }
  if (o.vendor !== false) {
    s.prop('carrinho', 'obj_carrinho_vendedor', { x: 150, y: 270, scale: 0.55 });
    s.actor('vend', 'vendedor', { x: 60, y: 300, scale: 0.55, look: 'lari', ex: 'excited' });
  }
  for (const k of ks) {
    const p = { ...PROT[k], ...(o.at?.[k] ?? {}) };
    s.actor(k, k, { ...p, look: o.look?.[k] ?? 'vend', ex: o.ex?.[k] ?? 'surprised' });
  }
  if (ks.includes('samuca')) s.prop('garrafa', 'obj_garrafa', { x: 0, y: 0, scale: 0.65, held: 'samuca:L', noShadow: true });
}
const ALL4: PK[] = ['lari', 'rafa', 'caique', 'bia', 'samuca'];

export function seq4(B: Builder) {
  B.seq = 'S4 · As torcidas políticas';

  B.shot('Praça do Coreto: as torcidas (panorâmica)', PR, 5600, (s) => {
    praca(s, []);
    s.cam0({ x: -720, y: 50, zoom: 1.2 });
    s.cam(0, { x: 700, zoom: 1.2 }, 5400, 'easeInOut');
    s.t = 700; s.say('e1', 'GAIVOTA! GAIVOTA!', { dur: 1700, g: 'none', style: 'shout', at: 400 });
    s.say('e4', 'PINOTE! PINOTE!', { dur: 1700, g: 'none', style: 'shout', at: 2500 });
    s.act('e1', 'jump', 450, { dur: 700, intensity: 0.5 }); s.act('e2', 'jump', 600, { dur: 700, intensity: 0.4 });
    s.act('e4', 'jump', 2550, { dur: 700, intensity: 0.5 }); s.act('e5', 'jump', 2700, { dur: 700, intensity: 0.4 });
    s.dur(5600);
  });

  convo(B, 'Vendedor anuncia produtos dos dois lados', PR, (s) => praca(s, ALL4, { look: { lari: 'vend', rafa: 'vend', caique: 'vend', bia: 'vend', samuca: 'barraca' as never } }), ['medium', 'vend', { dx: 40 }], [
    ['vend', 'Bandeira do Gaivota! Boné do Pinote! Leva dois, paga um!', { ex: 'excited', g: 'gesture', style: 'shout', dur: 3400 }],
  ], { extra: (s) => { s.look('vend', 0, 'cam'); } });
  convo(B, 'Vendedor: "Meu lado é o de quem paga"', PR, (s) => praca(s, ALL4), ['two', ['vend', 'lari']], [
    ['lari', 'Moço, e você vota em quem?', { ex: 'curious' as never, g: 'none', dur: 1900 }],
    ['vend', 'Eu? Meu lado é o de quem paga!', { ex: 'mocking', g: 'gesture', dur: 2500 }],
  ], { extra: (s) => { s.look('lari', 0, 'vend'); s.look('vend', 0, 'lari'); s.ex('lari', 0, 'surprised'); } });

  convo(B, 'Lari: "parece final de campeonato"', PR, (s) => praca(s, ALL4), ['medium', 'lari', { dx: 70 }], [
    ['lari', 'Caramba, parece final de campeonato.', { ex: 'excited', g: 'gesture', dur: 2500 }],
  ], { extra: (s) => s.look('lari', 0, 'e1') });
  convo(B, 'Rafael: "ninguém sabe qual é o prêmio"', PR, (s) => praca(s, ALL4), ['two', ['rafa', 'caique'], { dx: -40 }], [
    ['rafa', 'Só que ninguém sabe qual é o prêmio.', { ex: 'thinking', g: 'none', dur: 2400 }],
    ['caique', 'Quatro anos de salário, motorista e ar-condicionado.', { ex: 'mocking', g: 'gesture', side: 'R', dur: 3400 }],
  ], { extra: (s) => { s.look('rafa', 0, 'e1'); s.look('caique', 0, 'rafa'); } });

  B.shot('Bia vai perguntar aos eleitores', PR, 5200, (s) => {
    praca(s, ['lari', 'rafa', 'caique', 'samuca'], { look: { lari: 'bia', rafa: 'bia', caique: 'bia', samuca: 'barraca' as never } });
    s.actor('bia', 'bia', { x: 230, y: 450, scale: 0.63, look: 'e1', ex: 'irritated' });
    s.walk('bia', 200, 230, -330, { dur: 2800 });
    s.cam0({ x: 0, y: 40, zoom: 1.15 }); s.cam(0, { x: -200, zoom: 1.45 }, 4600, 'easeInOut');
    s.say('bia', 'Com licença! Quais são as propostas do seu candidato?', { at: 3100, dur: 2800, g: 'none' });
    s.look('e1', 3000, 'bia'); s.ex('e1', 3000, 'suspicious');
    s.dur(5200);
  });
  convo(B, 'Eleitora laranja acusa a Bia', PR, (s) => praca(s, ['bia', 'lari', 'rafa', 'caique', 'samuca'], { at: { bia: { x: -330, y: 450 } }, look: { bia: 'e1' } }), ['two', ['e1', 'bia']], [
    ['e1', 'Pergunta dessas só quem é do Pinote faz!', { ex: 'angry', g: 'point', side: 'L', style: 'shout', dur: 2700 }],
    ['bia', 'Eu só perguntei...', { ex: 'confused', g: 'none', dur: 1600 }],
  ], { extra: (s) => { s.look('e1', 0, 'bia'); } });
  convo(B, 'Eleitor azul acusa a Bia', PR, (s) => praca(s, ['bia', 'lari', 'rafa', 'caique', 'samuca'], { at: { bia: { x: -330, y: 450 } }, look: { bia: 'e4' } }), ['two', ['bia', 'e4'], { dx: 160, zoom: 1.2 }], [
    ['e4', 'Ela tá com o Gaivota, tá na cara!', { ex: 'angry', g: 'point', side: 'L', style: 'shout', dur: 2500 }],
    ['e2', 'Claro que tá! Olha a cara de gaivota dela!', { ex: 'mocking', g: 'none', dur: 2600 }],
  ], { extra: (s) => { s.look('e4', 0, 'bia'); s.look('e2', 0, 'bia'); } });
  convo(B, 'Bia perde a paciência', PR, (s) => praca(s, ['bia', 'lari', 'rafa', 'caique', 'samuca'], { at: { bia: { x: -330, y: 450 } }, look: { bia: 'cam' as never } }), ['close', 'bia'], [
    ['bia', 'EU SÓ QUERO SABER O QUE ELES VÃO FAZER, PORRA!', { ex: 'angry', g: 'none', style: 'shout', dur: 3000 }],
  ], { extra: (s) => { s.look('bia', 0, 'e1'); s.fx('shake', 400, 900, 0.7); s.k('bia', 'rig.headNod', [[300, 0, 'linear'], [550, -12, 'easeOut'], [1200, 8, 'easeInOut'], [2400, 0, 'easeOut']]); } });
  B.shot('Lari afasta a Bia da discussão', PR, 3800, (s) => {
    praca(s, ['rafa', 'caique', 'samuca'], { look: { rafa: 'bia', caique: 'bia', samuca: 'barraca' as never } });
    s.actor('bia', 'bia', { x: -330, y: 450, scale: 0.63, look: 'e1', ex: 'angry' });
    s.actor('lari', 'lari', { x: -200, y: 440, scale: 0.62, look: 'bia', ex: 'worried' });
    s.say('lari', 'Vem, Bia, respira. Vem comigo.', { at: 300, dur: 2200, g: 'none' });
    s.walk('lari', 900, -200, 60, { dur: 2500 }); s.walk('bia', 1000, -330, -80, { dur: 2500 });
    s.ex('bia', 1500, 'tired');
    s.cam0({ x: -150, y: 40, zoom: 1.3 }); s.cam(0, { x: 20, zoom: 1.3 }, 3600, 'easeInOut');
    s.dur(3800);
  });

  convo(B, 'Samuca quer café', PR, (s) => praca(s, ALL4, { at: { bia: { x: 60 }, lari: { x: -80, y: 450 } } }), ['medium', 'samuca', { dx: -90 }], [
    ['samuca', 'Gente... a barraca da praça vende café?', { ex: 'curious' as never, g: 'point', side: 'R', dur: 2800 }],
  ], { extra: (s) => { s.ex('samuca', 0, 'excited'); s.look('samuca', 0, 'barraca'); } });
  convo(B, 'Caíque: "tem uma guerra política!"', PR, (s) => praca(s, ALL4, { at: { bia: { x: 60 }, lari: { x: -80, y: 450 } } }), ['two', ['caique', 'samuca']], [
    ['caique', 'Samuca, tem uma guerra política acontecendo aqui!', { ex: 'astonished', g: 'gesture', style: 'shout', dur: 3300 }],
    ['samuca', 'Eu vi. Mas acho que dá pra comprar café durante uma guerra.', { ex: 'happy', g: 'none', dur: 3800 }],
  ], { extra: (s) => { s.look('caique', 0, 'samuca'); s.look('samuca', 0, 'caique'); } });
  convo(B, 'Fim: a torcida segue ao fundo', PR, (s) => praca(s, ALL4, { at: { bia: { x: 60 }, lari: { x: -80, y: 450 } }, ex: { bia: 'tired', caique: 'tired', rafa: 'tired', lari: 'laughing', samuca: 'happy' } }), ['wide'], [], {
    dur: 2400, extra: (s) => { s.say('e1', 'GAIVOTA!', { at: 300, dur: 900, g: 'none', style: 'shout' }); s.say('e5', 'PINOTE!', { at: 1200, dur: 900, g: 'none', style: 'shout' }); s.cam0({ x: 0, y: 40, zoom: 1.1 }); },
  });
}

/* ---------------------------------- CAMARINS ---------------------------------- */
export function seq5(B: Builder) {
  B.seq = 'S5 · Os camarins';
  const camarim = (s: Shot, side: 'G' | 'P', o: { ex?: string; ex2?: string; pose?: string } = {}) => {
    const g = side === 'G';
    s.actor('cand', g ? 'gaivota' : 'pinote', { x: -150, y: 440, scale: 0.8, look: 'cam', ex: o.ex ?? (g ? 'proud' : 'excited'), headStrength: 0.2, pose: o.pose });
    s.actor('ass', g ? 'assessor' : 'assessora', { x: 330, y: 435, scale: 0.7, look: 'cand', ex: o.ex2 ?? 'tired' });
    s.prop('prancheta', 'book', { x: 0, y: 0, scale: 0.8, held: 'ass:L', noShadow: true, a: g ? '#e98f4e' : '#8e6fc1' });
  };
  const bgG = 'camarimG'; const bgP = 'camarimP';
  const arrumar = (s: Shot, t: number) => { // mão à cabeça/gola: ajuste de roupa
    s.k('cand', 'rig.armRUpper', [[t, 0, 'linear'], [t + 450, 165, 'easeOut'], [t + 1300, 165, 'linear'], [t + 1750, 0, 'easeInOut']]);
    s.k('cand', 'rig.armRLower', [[t, 0, 'linear'], [t + 450, 40, 'easeOut'], [t + 1300, 40, 'linear'], [t + 1750, 0, 'easeInOut']]);
  };

  B.shot('Camarim do Gaivota: ajusta a cartola', bgG, 4600, (s) => {
    camarim(s, 'G'); s.frame('two', ['cand', 'ass'], { dy: -10 });
    arrumar(s, 500);
    s.t = 1800;
    s.say('ass', 'Prefeito, o debate vai perguntar dos buracos, da saúde e da falta d’água.', { dur: 3400, g: 'none' });
    s.ex('cand', 1800, 'mocking');
    s.dur(5400);
  });
  B.shot('Camarim do Pinote: ensaia o discurso', bgP, 5200, (s) => {
    camarim(s, 'P'); s.frame('two', ['cand', 'ass'], { dy: -10 });
    s.t = 500;
    s.say('cand', 'Cidadãos de Vila Torta! O futuro bate à porta... e eu sou a campainha!', { dur: 4300, g: 'gesture', side: 'R', ex: 'excited', intensity: 1.2 });
    s.act('cand', 'gesture', 5000, { dur: 100 });
    s.look('ass', 0, 'cand'); s.ex('ass', 2500, 'bored');
    s.dur(5200);
  });
  convo(B, 'Gaivota: "Não posso resolver tudo no primeiro mandato"', bgG, (s) => camarim(s, 'G'), ['medium', 'cand', { dx: 60 }], [
    ['cand', 'Meu filho, eu não posso resolver tudo no primeiro mandato!', { ex: 'proud', g: 'gesture', side: 'R', dur: 3500 }],
  ], { extra: (s) => s.look('cand', 0, 'ass') });
  convo(B, 'Pinote ajeita o cabelo; assessora pede propostas', bgP, (s) => camarim(s, 'P'), ['two', ['cand', 'ass']], [
    ['ass', 'Doutor, o público quer propostas concretas.', { ex: 'worried', g: 'point', side: 'L', dur: 2800 }],
  ], { extra: (s) => { s.look('cand', 0, 'cam'); arrumar(s, 300); } });
  convo(B, 'Assessor: "O senhor já está terminando o mandato"', bgG, (s) => camarim(s, 'G'), ['two', ['cand', 'ass']], [
    ['ass', 'O senhor já está terminando o mandato.', { ex: 'tired', g: 'none', dur: 2600 }],
    ['cand', 'Justamente! Não deu tempo!', { ex: 'happy', g: 'gesture', side: 'R', dur: 2000 }],
  ], { extra: (s) => s.look('cand', 0, 'ass'), pad: 900 });
  convo(B, 'Pinote: "Já tenho uma." — "Qual?"', bgP, (s) => camarim(s, 'P'), ['two', ['cand', 'ass']], [
    ['cand', 'Já tenho uma.', { ex: 'proud', g: 'none', dur: 1400 }],
    ['ass', 'Qual?', { ex: 'surprised', g: 'none', dur: 1000 }],
    ['cand', 'Tirar o Gaivota!', { ex: 'excited', g: 'gesture', side: 'R', style: 'shout', dur: 2000 }],
  ], { extra: (s) => s.look('cand', 0, 'ass') });
  convo(B, 'Assessora: "E depois?"', bgP, (s) => camarim(s, 'P'), ['close', 'ass', { dx: -20 }], [
    ['ass', 'E depois?', { ex: 'suspicious', g: 'none', dur: 1200 }],
  ], { pad: 600 });
  convo(B, 'Pinote explode: "Você também vai começar com essas perguntas?!"', bgP, (s) => camarim(s, 'P'), ['medium', 'cand', { dx: 60 }], [
    ['cand', 'Você também vai começar com essas perguntas?!', { ex: 'angry', g: 'gesture', style: 'shout', dur: 3200 }],
  ], { extra: (s) => { s.look('cand', 0, 'ass'); s.fx('shake', 300, 500, 0.3); } });

  // rima visual final: os dois ajustam a gravata no espelho
  B.shot('Os dois se olham no espelho (Gaivota)', bgG, 2200, (s) => {
    s.actor('cand', 'gaivota', { x: 0, y: 470, scale: 1.0, look: 'cam', ex: 'proud', headStrength: 0.1 });
    s.frame('medium', ['cand']); arrumar(s, 300);
    s.dur(2200);
  });
  B.shot('Os dois se olham no espelho (Pinote)', bgP, 2400, (s) => {
    s.actor('cand', 'pinote', { x: 0, y: 470, scale: 1.0, look: 'cam', ex: 'proud', headStrength: 0.1 });
    s.frame('medium', ['cand']); arrumar(s, 400);
    s.dur(2400);
  });
}
