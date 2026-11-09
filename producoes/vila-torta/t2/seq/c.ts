/** S8 O tiroteio · S9 A fuga de Lon Ruan · S10 Cem reais por quinze minutos */
import type { Builder, Shot } from '../../lib';
import { convo } from '../../seq/common';
import { vehicle, drive } from '../../vehicles';
import { A, H } from './util';
import { show } from './b';

type K = 'rafa' | 'bia' | 'caique' | 'samuca' | 'lari';
const ALL: K[] = ['caique', 'rafa', 'bia', 'lari', 'samuca'];
const NIGHT = 'pracaNoite';
const PL: Record<K, [number, number, number]> = { caique: [-230, 520, 0.72], bia: [-50, 500, 0.7], rafa: [120, 480, 0.68], lari: [300, 505, 0.7], samuca: [-420, 485, 0.68] };
const stand = (s: Shot, ks: K[], o: { ex?: Partial<Record<K, string>>; look?: Partial<Record<K, string>>; fans?: boolean; lon?: boolean; sam?: boolean } = {}) => {
  show(s, ks.filter((k) => k !== 'samuca' || o.sam !== false), { lon: o.lon === false ? false : 0, ex: o.ex, look: o.look, lights: false });
};
/** Silhuetas dos dois grupos fictícios, ao fundo e de longe (sem armas à mostra). */
const gangs = (s: Shot, t = 0) => {
  A(s, 'gA', -1060, 330, 0.36, 'gB', 'angry', { who: 'gangA' }); A(s, 'gA2', -1130, 340, 0.36, 'gB', 'angry', { who: 'gangA' });
  A(s, 'gB', -820, 335, 0.36, 'gA', 'angry', { who: 'gangB' }); A(s, 'gB2', -760, 345, 0.36, 'gA', 'angry', { who: 'gangB' });
  s.act('gA', 'point', t + 400, { dur: 900, side: 'R' }); s.act('gB', 'gesture', t + 700, { dur: 1200, side: 'L', intensity: 1.2 });
};

export function seqC8(B: Builder) {
  B.seq = 'S8 · O tiroteio';
  B.shot('Quinze minutos de show: dois grupos surgem ao longe', NIGHT, 6200, (s) => {
    show(s, ALL, { t0: 0, t1: 6200, ex: { lari: 'neutral' }, look: { lari: 'gA' } });
    gangs(s, 1200);
    s.text('cartela', '15 MINUTOS DEPOIS', { x: 0, y: -440, size: 44, color: '#fff7e6', sw: 8 }); s.k('cartela', 'opacity', [[0, 0, 'linear'], [400, 1, 'easeOut'], [2400, 1, 'linear'], [3000, 0, 'easeIn']]);
    s.look('lari', 2800, 'gB'); s.ex('lari', 3000, 'worried'); s.snd('gritaria', 500, 0.35);
    s.cam0({ x: 0, y: 90, zoom: 1.0 }); s.cam(3000, { x: -520, y: 170, zoom: 1.5 }, 3000, 'easeInOut');
    s.dur(6200);
  });
  convo(B, 'Larissa nota algo estranho', NIGHT, (s) => { stand(s, ALL, { look: { lari: 'gB' } }); gangs(s); }, ['medium', 'lari', { dx: 40 }], [
    ['lari', 'Ei... tem uns caras discutindo ali no fundo. Bem feio.', { ex: 'worried', g: 'point', side: 'L', dur: 3600 }],
  ], { extra: (s) => s.look('lari', 0, 'gB') });
  B.shot('Ao longe: a discussão esquenta', NIGHT, 3400, (s) => {
    s.prop('palco', 'obj_palco', { x: 700, y: 190, scale: 0.6, noShadow: true, bottom: true });
    gangs(s); s.shape('escuro', 'rect', { x: 0, y: 0, w: 2400, h: 1300, fill: '#000', sw: 0, opacity: 0.25, vis: true });
    s.look('gA', 0, 'gB'); s.act('gA2', 'gesture', 200, { dur: 2400, side: 'R', intensity: 1.4 }); s.act('gB2', 'point', 500, { dur: 1800, side: 'L' });
    s.walk('gA', 600, -1060, -980, { dur: 1500, speed: 0.6 });
    s.cam0({ x: -900, y: 260, zoom: 2.2 }); s.cam(0, { x: -880, y: 270, zoom: 2.5 }, 3300, 'linear');
    s.dur(3400);
  });
  // o disparo: a música para de repente e as luzes saem do compasso
  B.shot('O primeiro disparo: a música para', NIGHT, 5200, (s) => {
    show(s, ALL, { t0: 0, t1: 2000, freeze: 1900, ex: { caique: 'excited', bia: 'angry', lari: 'worried' } }); s.snd('disparo', 1900, 0.9); s.snd('freada', 1900, 0.5);
    s.fx('flash', 1900, 160, 0.35); s.fx('shake', 1900, 400, 0.6);
    for (const k of ['p1', 'p2', 'p3', 'p4']) { s.k(k, 'rig.bodyY', [[1800, 0, 'linear'], [1900, 0, 'hold']]); s.act(k, 'react', 1960, { dur: 1200, intensity: 0.9 }); }
    for (const k of ALL) s.act(k, 'react', 1980, { dur: 1400, intensity: 0.8 });
    s.act('lon', 'react', 2000, { dur: 1400, intensity: 0.8 });
    s.ex('lon', 1950, 'scared'); s.ex('bia', 1950, 'scared'); s.ex('caique', 1950, 'astonished');
    s.cam0({ x: 0, y: 130, zoom: 1.15 });
    s.dur(5200);
  });
  convo(B, 'Bia: "Que porra foi essa?!"', NIGHT, (s) => stand(s, ALL, { ex: { bia: 'scared', caique: 'astonished' } }), ['close', 'bia'], [
    ['bia', 'QUE PORRA FOI ESSA?!', { ex: 'scared', g: 'none', style: 'shout', dur: 2000 }],
  ], { extra: (s) => { s.look('bia', 0, { x: -900, y: 300 }); s.snd('disparo', 1700, 0.6); s.fx('shake', 1700, 300, 0.3); } });
  B.shot('Pânico: a plateia procura abrigo, seguranças orientam a saída', NIGHT, 5600, (s) => {
    show(s, [], { lon: false, lights: false });
    A(s, 'seg', 360, 470, 0.7, { x: 1100, y: 480 }, 'angry', { who: 'seg1' }); A(s, 'seg2', 560, 480, 0.7, { x: 1100, y: 480 }, 'angry', { who: 'seg2' });
    s.act('seg', 'point', 400, { dur: 3000, side: 'R', intensity: 1.2 }); s.act('seg2', 'point', 600, { dur: 3000, side: 'R', intensity: 1.2 });
    s.say('seg', 'POR AQUI! SAÍDA PELA LATERAL!', { at: 700, dur: 2300, g: 'none', style: 'shout' });
    A(s, 'q1', -400, 520, 0.62, { x: 1200, y: 480 }, 'scared', { who: 'e1', shirt: '#7b2fbf' }); s.walk('q1', 300, -400, 1250, { dur: 2600, run: true });
    A(s, 'q2', -100, 535, 0.62, { x: 1200, y: 480 }, 'scared', { who: 'e3', shirt: '#c2185b' }); s.walk('q2', 500, -100, 1300, { dur: 2300, run: true });
    A(s, 'q3', -620, 540, 0.62, { x: 1200, y: 480 }, 'scared', { who: 'e6', shirt: '#14081f' }); s.walk('q3', 200, -620, 1300, { dur: 3000, run: true });
    A(s, 'q4', 200, 525, 0.62, { x: -1200, y: 480 }, 'scared', { who: 'e5', shirt: '#f2c95c' }); s.walk('q4', 700, 200, -1250, { dur: 3000, run: true });
    s.snd('passos', 300, 0.6, { dur: 2000 }); s.snd('passos', 2400, 0.5, { dur: 2000 }); s.snd('disparo', 3400, 0.5);
    for (const f of ['seg', 'seg2']) void f;
    s.cam0({ x: 200, y: 140, zoom: 1.15 }); s.cam(0, { x: 400, zoom: 1.15 }, 5400, 'linear');
    s.dur(5600);
  });
  convo(B, 'Rafael: "Gente, vem comigo!"', NIGHT, (s) => stand(s, ALL, { ex: { rafa: 'scared' } }), ['medium', 'rafa', { dx: 80 }], [
    ['rafa', 'GENTE, VEM COMIGO!', { ex: 'scared', g: 'point', side: 'R', style: 'shout', dur: 1900 }],
  ], { extra: (s) => { s.look('rafa', 0, { x: 1100, y: 480 }); s.snd('gritaria', 0, 0.3); }, pad: 300 });
  convo(B, 'Lari: "Samuca! Cadê o Samuca?!"', NIGHT, (s) => stand(s, ['caique', 'rafa', 'bia', 'lari'], { ex: { lari: 'scared' } }), ['close', 'lari'], [
    ['lari', 'SAMUCA! CADÊ O SAMUCA?!', { ex: 'scared', g: 'none', style: 'shout', dur: 2300 }],
  ], { extra: (s) => s.look('lari', 0, { x: -900, y: 500 }) });
  B.shot('Samuca aparece com o cachorro-quente', NIGHT, 4800, (s) => {
    stand(s, ['caique', 'rafa', 'bia', 'lari'], { ex: { caique: 'scared', bia: 'scared', rafa: 'scared', lari: 'worried' }, look: { caique: 'samuca', bia: 'samuca', rafa: 'samuca', lari: 'samuca' } });
    A(s, 'samuca', -1000, 495, 0.68, 'lari', 'happy'); H(s, 'dog', 'obj_cachorro_quente', 'samuca:R', 0.8);
    s.walk('samuca', 200, -1000, -470, { dur: 2600, run: true });
    s.say('samuca', 'Eu tô aqui!', { at: 2900, dur: 1300, g: 'none', ex: 'happy' });
    s.cam0({ x: -200, y: 250, zoom: 1.4 }); s.cam(0, { x: -150, zoom: 1.4 }, 4600, 'linear');
    s.dur(4800);
  });
  convo(B, 'Caíque: "Larga essa merda, Samuca!"', NIGHT, (s) => { stand(s, ALL, { ex: { caique: 'scared' } }); H(s, 'dog', 'obj_cachorro_quente', 'samuca:R', 0.8); }, ['two', ['caique', 'samuca'], { dx: -60 }], [
    ['caique', 'LARGA ESSA MERDA, SAMUCA!', { ex: 'scared', g: 'point', side: 'R', style: 'shout', dur: 2300 }],
    ['samuca', 'Mas eu acabei de comprar!', { ex: 'worried', g: 'hold', side: 'R', dur: 2200 }],
  ], { extra: (s) => { s.look('caique', 0, 'samuca'); s.look('samuca', 0, 'caique'); s.snd('disparo', 4400, 0.8); s.fx('shake', 4400, 400, 0.5); } });
  B.shot('Outro disparo: Samuca solta o lanche e acompanha os amigos', NIGHT, 4200, (s) => {
    stand(s, ALL, { ex: { caique: 'scared', bia: 'scared', rafa: 'scared', lari: 'scared', samuca: 'scared' } });
    s.prop('dog', 'obj_cachorro_quente', { x: 0, y: 0, scale: 0.8, held: 'samuca:R', noShadow: true });
    s.snd('disparo', 400, 0.8); s.fx('shake', 400, 400, 0.5);
    for (const k of ALL) s.act(k, 'react', 450, { dur: 1100, intensity: 0.8 });
    s.k('dog', 'heldBy', [[0, `${s.id('samuca')}:R`, 'hold'], [1100, '', 'hold']]);
    s.k('dog', 'transform.x', [[1100, -420, 'hold']]); s.k('dog', 'transform.y', [[1100, 420, 'hold'], [1500, 540, 'bounceOut']]);
    s.look('samuca', 1100, { x: 1000, y: 480 });
    for (const [k, i] of [['rafa', 0], ['bia', 1], ['lari', 2], ['caique', 3], ['samuca', 4]] as Array<[K, number]>) s.walk(k, 1500 + i * 80, PL[k][0], PL[k][0] + 1300, { dur: 2300, run: true });
    s.snd('passos', 1500, 0.7, { dur: 2000 });
    s.cam0({ x: 0, y: 260, zoom: 1.35 }); s.cam(1500, { x: 500, y: 260, zoom: 1.2 }, 2500, 'easeIn');
    s.dur(4200);
  });
  B.shot('Os cinco correm juntos para uma área segura (travelling)', 'ruaNoite', 5600, (s) => {
    s.snd('passos', 0, 0.6, { dur: 2000 }); s.snd('passos', 2000, 0.5, { dur: 2000 }); s.snd('disparo', 2600, 0.3);
    const order: Array<[K, number, number]> = [['rafa', -500, 410], ['bia', -640, 440], ['lari', -780, 425], ['samuca', -920, 450], ['caique', -1060, 430]];
    for (const [k, x, y] of order) { A(s, k, x, y, 0.66, { x: 1200, y: 400 }, 'scared'); s.walk(k, 0, x, x + 2400, { dur: 5200, run: true }); }
    s.cam0({ x: -300, y: 60, zoom: 1.3 }); s.cam(0, { x: 1750, y: 60, zoom: 1.3 }, 5300, 'linear');
    s.dur(5600);
  });
  B.shot('Em segurança: a contagem — todos juntos', 'ruaNoite', 3800, (s) => {
    const P: Array<[K, number, number]> = [['rafa', -250, 420], ['bia', -60, 446], ['lari', 120, 430], ['samuca', 290, 452], ['caique', -430, 436]];
    for (const [k, x, y] of P) A(s, k, x, y, 0.68, 'rafa', 'worried');
    s.look('rafa', 0, 'caique'); s.look('rafa', 900, 'bia'); s.look('rafa', 1500, 'lari'); s.look('rafa', 2100, 'samuca');
    for (const k of ALL) s.act(k, 'react', 0, { dur: 500, intensity: 0.2 });
    s.say('rafa', 'Um, dois, três, quatro... cinco. Todo mundo aqui.', { at: 400, dur: 3000, g: 'none', ex: 'worried' });
    s.ex('rafa', 3200, 'tired'); s.cam0({ x: -60, y: 90, zoom: 1.3 });
    s.dur(3800);
  });
}

/* --------------------------------- S9: A FUGA DE LON RUAN --------------------------------- */
export function seqC9(B: Builder) {
  B.seq = 'S9 · A fuga de Lon Ruan';
  B.shot('Lon Ruan percebe a gravidade e solta o microfone', NIGHT, 4600, (s) => {
    show(s, [], { lon: 0, lights: false });
    s.prop('mic', 'microphone', { x: 0, y: 0, scale: 0.7, held: 'lon:R', noShadow: true });
    s.k('mic', 'heldBy', [[0, `${s.id('lon')}:R`, 'hold'], [1600, '', 'hold']]);
    s.k('mic', 'transform.x', [[1600, 60, 'hold']]); s.k('mic', 'transform.y', [[1600, -40, 'hold'], [2100, 70, 'bounceOut']]);
    s.ex('lon', 0, 'excited'); s.ex('lon', 900, 'worried'); s.ex('lon', 1500, 'scared');
    s.look('lon', 0, { x: -900, y: 300 }); s.act('lon', 'react', 1400, { dur: 1200, intensity: 1 });
    s.walk('lon', 2400, 0, 1100, { dur: 1900, run: true });
    s.snd('freada', 1500, 0.4); s.snd('queda', 1650, 0.5); s.snd('disparo', 2000, 0.4);
    s.cam0({ x: 0, y: 70, zoom: 1.5 }); s.cam(2200, { x: 450, y: 120, zoom: 1.2 }, 2200, 'easeInOut');
    s.dur(4600);
  });
  B.shot('Bastidores: Lon corre e o celular escorrega', 'bastidores', 4400, (s) => {
    s.prop('case', 'obj_bastidor_cortina', { x: 400, y: 560, scale: 0.9, noShadow: true, bottom: true });
    A(s, 'lon', -1100, 470, 0.7, { x: 1000, y: 400 }, 'scared', { who: 'lon' });
    s.walk('lon', 0, -1100, 1200, { dur: 3800, run: true });
    s.prop('cel', 'obj_celular', { x: -300, y: 330, scale: 0.35, noShadow: true, vis: false });
    s.k('cel', 'visible', [[0, false, 'hold'], [1300, true, 'hold']]);
    s.k('cel', 'transform.y', [[1300, 250, 'linear'], [1600, 440, 'bounceOut']]); s.k('cel', 'transform.rotationDeg', [[1300, 0, 'linear'], [1600, 80, 'easeOut']]);
    s.k('cel', 'transform.x', [[1300, -300, 'linear'], [1600, -320, 'easeOut']]);
    s.snd('passos', 0, 0.6, { dur: 2000 }); s.snd('queda', 1500, 0.9);
    s.cam0({ x: -300, y: 120, zoom: 1.4 }); s.cam(0, { x: 300, y: 120, zoom: 1.4 }, 3800, 'easeInOut');
    s.dur(4400);
  });
  B.shot('Detalhe: o celular cai no chão', 'bastidores', 3600, (s) => {
    s.shape('chao', 'rect', { x: 0, y: 380, w: 2400, h: 700, fill: '#3a3345', sw: 0 });
    s.prop('cel', 'obj_celular', { x: 0, y: -80, scale: 1.4, noShadow: true });
    s.k('cel', 'transform.y', [[0, -300, 'hold'], [300, -300, 'linear'], [900, 380, 'bounceOut']]); s.k('cel', 'transform.rotationDeg', [[300, -20, 'linear'], [900, 72, 'easeOut']]);
    s.snd('queda', 800, 1);
    s.cam0({ x: 0, y: 160, zoom: 1.0 }); s.cam(1000, { x: 0, y: 260, zoom: 1.2 }, 2400, 'easeInOut');
    s.dur(3600);
  });
  B.shot('A equipe leva Lon até o carro, que parte', 'ruaNoite', 6000, (s) => {
    const v = vehicle(s, 'Carro', 'preto', { x: 100, y: 430, gs: 0.8 });
    A(s, 'prod', -700, 450, 0.66, 'Carro', 'scared', { who: 'produtor' }); A(s, 'lon', -820, 460, 0.7, 'Carro', 'scared', { who: 'lon' });
    s.walk('lon', 0, -820, -20, { dur: 2000, run: true }); s.walk('prod', 100, -700, -90, { dur: 1800, run: true });
    s.k('lon', 'visible', [[0, true, 'hold'], [2100, false, 'hold']]); s.k('prod', 'visible', [[0, true, 'hold'], [2000, false, 'hold']]);
    drive(s, v, 2600, 5600, 100, 1900, { ease: 'in', steps: 12 });
    s.snd('motor', 2500, 0.7); s.snd('disparo', 1000, 0.3);
    s.cam0({ x: 0, y: 160, zoom: 1.15 }); s.cam(0, { x: 400, y: 150, zoom: 1.15 }, 5800, 'easeInOut');
    s.dur(6000);
  });
  B.shot('Os fãs ficam sem informação', NIGHT, 4600, (s) => {
    show(s, [], { lon: false, lights: false });
    const fans: Array<[string, 'e1' | 'e3' | 'e5' | 'e6', number, string, string]> = [['q1', 'e1', -500, '#7b2fbf', 'confused'], ['q2', 'e3', -150, '#c2185b', 'worried'], ['q3', 'e5', 250, '#14081f', 'sad']];
    for (const [k, w, x, c, e] of fans) A(s, k, x, 520, 0.64, 'palco' as never, e, { who: w, shirt: c });
    s.act('q1', 'shrug', 500, { dur: 1400 }); s.act('q3', 'shrug', 1200, { dur: 1400 });
    s.say('q1', 'O show continua? Alguém sabe?', { at: 600, dur: 2200, g: 'none' });
    s.say('q2', 'Os caras foram embora e deixaram a gente aqui!', { at: 2900, dur: 2600, g: 'none' });
    s.snd('freada', 0, 0.1);
    s.cam0({ x: -100, y: 150, zoom: 1.35 });
    s.end(300);
  });
  const dist = (s: Shot, ks: K[] = ALL, o: { ex?: Partial<Record<K, string>> } = {}) => {
    s.prop('palco', 'obj_palco', { x: 900, y: 250, scale: 0.55, noShadow: true, bottom: true });
    const P: Record<K, [number, number, number]> = { caique: [-200, 450, 0.7], rafa: [-30, 420, 0.66], bia: [150, 450, 0.68], lari: [320, 430, 0.66], samuca: [470, 450, 0.66] };
    for (const k of ks) A(s, k, P[k][0], P[k][1], P[k][2], 'palco' as never, o.ex?.[k] ?? 'worried');
  };
  convo(B, 'Caíque: "Pra onde ele foi?!"', 'ruaNoite', (s) => dist(s, ALL, { ex: { caique: 'confused' } }), ['two', ['caique', 'rafa']], [
    ['caique', 'UÉ, CARALHO! PRA ONDE ELE FOI?!', { ex: 'astonished', g: 'point', side: 'R', style: 'shout', dur: 2900 }],
    ['rafa', 'Foi embora!', { ex: 'tired', g: 'none', dur: 1300 }],
    ['caique', 'MAS ELE NEM TERMINOU A MÚSICA!', { ex: 'angry', g: 'gesture', side: 'R', style: 'shout', dur: 2900 }],
  ], { extra: (s) => { s.look('caique', 0, 'palco' as never); s.look('rafa', 0, 'caique'); } });
  convo(B, 'Bia: "Tem tiroteio, Caíque!"', 'ruaNoite', (s) => dist(s, ALL), ['close', 'bia'], [
    ['bia', 'TEM TIROTEIO, CAÍQUE! ESQUECE ESSA PORRA!', { ex: 'angry', g: 'none', style: 'shout', dur: 3200 }],
  ], { extra: (s) => { s.look('bia', 0, 'caique'); s.snd('disparo', 2800, 0.4); } });
  B.shot('O fiscal também foge, tentando manter a pose', 'ruaNoite', 7400, (s) => {
    dist(s, ['rafa', 'lari']);
    A(s, 'fiscal', -1000, 470, 0.66, { x: 900, y: 450 }, 'proud', { who: 'norberto' }); H(s, 'apito', 'obj_apito', 'fiscal:R', 0.7); H(s, 'prancheta', 'book', 'fiscal:L', 0.7);
    s.walk('fiscal', 0, -1000, -250, { dur: 2500, run: true }); s.act('fiscal', 'stop', 2500, {});
    s.say('fiscal', 'ISSO SERÁ REGISTRADO COMO INFRAÇÃO GRAVÍSSIMA!', { at: 2700, dur: 3200, g: 'point', side: 'R', style: 'shout', ex: 'angry' });
    s.snd('disparo', 5900, 0.7); s.fx('shake', 5900, 350, 0.4); s.ex('fiscal', 5950, 'scared'); s.act('fiscal', 'react', 5950, { dur: 900 });
    s.say('fiscal', '...O registro pode ficar para amanhã.', { at: 6200, dur: 2000, g: 'none', ex: 'worried' });
    s.cam0({ x: -200, y: 100, zoom: 1.25 });
    s.dur(8200);
  });
  B.shot('O fiscal guarda o apito e sai correndo', 'ruaNoite', 3000, (s) => {
    A(s, 'fiscal', -200, 470, 0.66, { x: -1200, y: 450 }, 'worried', { who: 'norberto' }); H(s, 'prancheta', 'book', 'fiscal:L', 0.7);
    s.walk('fiscal', 600, -200, -1400, { dur: 2200, run: true }); s.snd('passos', 600, 0.6, { dur: 2000 });
    s.cam0({ x: -400, y: 100, zoom: 1.3 });
    s.dur(3000);
  });
}

/* --------------------------- S10: CEM REAIS POR QUINZE MINUTOS --------------------------- */
export function seqC10(B: Builder) {
  B.seq = 'S10 · Cem reais por quinze minutos';
  const rua = (s: Shot, ex: Partial<Record<K, string>> = {}) => {
    s.prop('poste', 'streetlamp', { x: -700, y: 300, scale: 0.7 });
    const P: Record<K, [number, number, number]> = { caique: [-300, 450, 0.7], rafa: [-90, 420, 0.66], bia: [100, 452, 0.68], lari: [290, 430, 0.66], samuca: [480, 448, 0.66] };
    for (const k of ALL) A(s, k, P[k][0], P[k][1], P[k][2], 'caique', ex[k] ?? 'tired');
  };
  convo(B, 'Caíque percebe: "Cem conto por quinze minutos!"', 'ruaNoite', (s) => rua(s, { caique: 'astonished' }), ['close', 'caique'], [
    ['caique', 'CARALHO! EU PAGUEI CEM CONTO PRA ASSISTIR QUINZE MINUTOS!', { ex: 'angry', g: 'none', style: 'shout', dur: 4000 }],
  ], { extra: (s) => { s.look('caique', 0, 'bia'); s.fx('shake', 400, 600, 0.4); } });
  convo(B, 'Bia: "E tu passou a semana inteira..."', 'ruaNoite', (s) => rua(s), ['two', ['bia', 'caique'], { dx: 30 }], [
    ['bia', 'E tu passou a semana inteira falando que seria o melhor dia da tua vida!', { ex: 'irritated', g: 'point', side: 'R', dur: 4800 }],
    ['caique', 'EU NÃO SABIA QUE IA TER TIROTEIO, PORRA!', { ex: 'angry', g: 'gesture', side: 'R', style: 'shout', dur: 3100 }],
  ], { extra: (s) => { s.look('bia', 0, 'caique'); s.look('caique', 0, 'bia'); } });
  convo(B, 'Rafael e Larissa: alívio e ingressos', 'ruaNoite', (s) => rua(s), ['two', ['rafa', 'lari'], { dx: 40 }], [
    ['rafa', 'Pelo menos todo mundo saiu inteiro.', { ex: 'worried', g: 'none', dur: 2500 }],
    ['lari', 'Agora é descobrir o que a produtora vai fazer com os ingressos.', { ex: 'thinking', g: 'none', dur: 3800 }],
  ], { extra: (s) => { s.look('rafa', 0, 'lari'); s.look('lari', 0, 'rafa'); } });
  convo(B, 'Samuca faz a conta', 'ruaNoite', (s) => rua(s), ['medium', 'samuca', { dx: 80 }], [
    ['samuca', 'Caíque, cem reais por quinze minutos dá mais de seis reais por minuto.', { ex: 'thinking', g: 'point', side: 'R', dur: 4800 }],
  ], { extra: (s) => s.look('samuca', 0, 'caique') });
  convo(B, 'Caíque: "Valeu, contador!"', 'ruaNoite', (s) => rua(s), ['close', 'caique'], [
    ['caique', 'VALEU, CONTADOR!', { ex: 'irritated', g: 'none', style: 'shout', dur: 1700 }],
  ], { extra: (s) => s.look('caique', 0, 'samuca'), pad: 200 });
  convo(B, 'Samuca: "Seis reais e sessenta e seis centavos"', 'ruaNoite', (s) => rua(s), ['two', ['samuca', 'caique'], { dx: 40 }], [
    ['samuca', 'Na verdade, dá seis reais e sessenta e seis centavos.', { ex: 'happy', g: 'none', dur: 3600 }],
  ], { extra: (s) => { s.look('samuca', 0, 'caique'); s.look('caique', 0, 'samuca'); s.ex('caique', 800, 'angry'); s.ex('caique', 2400, 'angry'); } });
  B.shot('Caíque irritado; Rafael ri discretamente (pausa cômica)', 'ruaNoite', 4200, (s) => {
    rua(s, { caique: 'angry', rafa: 'laughing', bia: 'bored', lari: 'laughing', samuca: 'happy' });
    s.look('rafa', 0, 'caique'); s.look('caique', 0, { x: 0, y: -100 }); s.look('bia', 0, 'caique');
    s.act('rafa', 'laugh', 700, { dur: 1700, intensity: 0.35 }); s.act('caique', 'crossArms', 300, { dur: 3600 });
    s.cam0({ x: -60, y: 90, zoom: 1.3 }); s.cam(0, { x: -120, zoom: 1.55 }, 4000, 'linear');
    s.dur(4200);
  });
}
