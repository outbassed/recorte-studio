/** S11 O dia seguinte · S12 Pós-créditos: a delegacia */
import type { Builder, Shot } from '../../lib';
import { convo } from '../../seq/common';
import { vehicle } from '../../vehicles';
import { A, H } from './util';
import { norb } from './a';

type K = 'rafa' | 'bia' | 'caique' | 'samuca' | 'lari';
const ALL: K[] = ['caique', 'rafa', 'bia', 'lari', 'samuca'];
const MANHA = 'praca';
const P: Record<K, [number, number, number]> = { caique: [-300, 450, 0.7], bia: [-90, 452, 0.68], rafa: [110, 420, 0.66], lari: [290, 432, 0.66], samuca: [470, 448, 0.66] };
function manha(s: Shot, ks: K[], o: { ex?: Partial<Record<K, string>>; look?: Partial<Record<K, string>>; fiscal?: number; zefa?: number } = {}) {
  s.prop('coreto', 'obj_coreto', { x: -80, y: 220, scale: 0.5, noShadow: true, bottom: true });
  s.prop('palco', 'obj_palco', { x: 700, y: 300, scale: 0.5, noShadow: true, bottom: true });
  s.prop('copos1', 'obj_copos', { x: -460, y: 520, scale: 1.1, noShadow: true }); s.prop('copos2', 'obj_copos', { x: 380, y: 540, scale: 1.0, noShadow: true });
  s.prop('barraca', 'obj_barraca_hotdog', { x: -760, y: 340, scale: 0.6, rot: 18 }); A(s, 'vend', -620, 355, 0.55, 'barraca' as never, 'sad', { who: 'vendedor' });
  s.prop('lixeira1', 'trash', { x: 560, y: 360, scale: 0.7 }); s.prop('lixeira2', 'trash', { x: 640, y: 372, scale: 0.7, rot: 90 });
  A(s, 'lim1', 560, 400, 0.58, 'lixeira1' as never, 'tired', { who: 'e2', shirt: '#58a56d' }); A(s, 'lim2', 700, 410, 0.58, 'lim1', 'bored', { who: 'e6', shirt: '#58a56d' });
  s.act('lim1', 'pick', 600, { dur: 900, side: 'R' }); s.act('lim2', 'pick', 1500, { dur: 900, side: 'L' });
  if (o.fiscal !== undefined) norb(s, o.fiscal, 440, 0.62, 'angry');
  if (o.zefa !== undefined) A(s, 'zefa', o.zefa, 452, 0.62, 'fiscal', 'angry', { who: 'senhora' });
  for (const k of ks) A(s, k, P[k][0], P[k][1], P[k][2], o.look?.[k] ?? 'caique', o.ex?.[k] ?? 'tired');
}
export function seqD11(B: Builder) {
  B.seq = 'S11 · O dia seguinte';
  B.shot('Praça no dia seguinte: copos, lixo e a limpeza (plano geral)', MANHA, 5600, (s) => {
    manha(s, []);
    s.cam0({ x: -500, y: 80, zoom: 1.15 }); s.cam(0, { x: 400, y: 80, zoom: 1.15 }, 5400, 'easeInOut');
    s.dur(5600);
  });
  B.shot('Os amigos chegam à praça vazia', MANHA, 4400, (s) => {
    manha(s, []);
    for (const [k, i] of [['caique', 0], ['bia', 1], ['rafa', 2], ['lari', 3], ['samuca', 4]] as Array<[K, number]>) { A(s, k, P[k][0] - 1300 - i * 100, P[k][1], P[k][2], 'copos1' as never, 'tired'); s.walk(k, i * 100, P[k][0] - 1300 - i * 100, P[k][0], { dur: 3600 }); }
    s.cam0({ x: -500, y: 80, zoom: 1.2 }); s.cam(0, { x: -50, zoom: 1.2 }, 4200, 'easeInOut');
    s.dur(4400);
  });
  convo(B, 'Caíque reclama do reembolso', MANHA, (s) => manha(s, ALL), ['medium', 'caique', { dx: 80 }], [
    ['caique', 'A produtora ainda não explicou como vai ser o reembolso. Nem um "desculpa" mandaram!', { ex: 'irritated', g: 'gesture', side: 'R', dur: 5600 }],
  ], { extra: (s) => s.look('caique', 0, 'bia') });
  convo(B, 'Bia provoca a idolatria do Caíque', MANHA, (s) => manha(s, ALL), ['two', ['bia', 'caique'], { dx: 20 }], [
    ['bia', 'Cem reais e um tiroteio. Que ídolo, hein?', { ex: 'mocking', g: 'gesture', side: 'R', dur: 3000 }],
    ['caique', 'Eu continuo gostando das músicas dele. Mas, tá... aquilo foi um absurdo.', { ex: 'tired', g: 'none', dur: 4700 }],
  ], { extra: (s) => { s.look('bia', 0, 'caique'); s.look('caique', 0, 'bia'); s.ex('caique', 3300, 'sad'); } });
  convo(B, 'Rafael e Larissa sobre quem só queria assistir', MANHA, (s) => manha(s, ALL), ['two', ['rafa', 'lari'], { dx: 40 }], [
    ['rafa', 'A violência prejudicou gente que só queria assistir a uma apresentação.', { ex: 'worried', g: 'none', dur: 4800 }],
    ['lari', 'Verdade. Tinha criança, tinha idoso... Ninguém ali merecia aquele susto.', { ex: 'sad', g: 'none', dur: 4500 }],
  ], { extra: (s) => { s.look('rafa', 0, 'lari'); s.look('lari', 0, 'rafa'); } });
  B.shot('Samuca e o vendedor de cachorro-quente', MANHA, 6600, (s) => {
    manha(s, ALL, { look: { samuca: 'vend' } });
    s.t = 400;
    s.say('samuca', 'Moço, o senhor conseguiu recuperar sua barraca?', { ex: 'worried', g: 'point', side: 'L', dur: 3000 });
    s.say('vend', 'Só metade. A outra metade está no chão, junto com o meu purê.', { ex: 'sad', g: 'shrug', dur: 4300 });
    s.look('vend', 0, 'samuca'); s.frame('two', ['samuca', 'vend'], { dx: -100, zoom: 1.2 });
    s.end(300);
  });
  // o fiscal reaparece
  B.shot('Seu Norberto reaparece e multa os funcionários da limpeza', MANHA, 7200, (s) => {
    manha(s, ALL, { ex: { caique: 'tired' } });
    norb(s, -1100, 460, 0.62, 'angry'); H(s, 'multa', 'obj_multa', 'fiscal:R', 0.2);
    s.walk('fiscal', 0, -1100, 360, { dur: 3600 }); s.look('fiscal', 0, 'lixeira1');
    s.say('fiscal', 'As lixeiras estão quarenta e dois centímetros fora da posição ideal! ISSO AQUI NÃO PODE!', { at: 3600, dur: 5000, g: 'point', side: 'R', style: 'shout', ex: 'angry' });
    s.snd('apito', 3500, 0.5);
    for (const k of ALL) s.look(k, 0, 'fiscal');
    s.cam0({ x: -400, y: 130, zoom: 1.3 }); s.cam(0, { x: 220, y: 150, zoom: 1.4 }, 7000, 'easeInOut');
    s.dur(7200);
  });
  convo(B, 'Funcionário: "Quem deu autoridade ao senhor?"', MANHA, (s) => manha(s, ALL, { fiscal: 360 }), ['two', ['lim1', 'fiscal'], { dx: 20 }], [
    ['lim1', 'Moço, quem foi que deu autoridade pro senhor?', { ex: 'suspicious', g: 'none', dur: 2800 }],
    ['fiscal', 'A COMUNIDADE RECONHECE MINHA LIDERANÇA!', { ex: 'proud', g: 'gesture', side: 'R', style: 'shout', dur: 3000 }],
  ], { extra: (s) => { s.look('lim1', 0, 'fiscal'); s.look('fiscal', 0, 'lim1'); } });
  B.shot('Dona Zefa chega: "Eu não reconheço porra nenhuma!"', MANHA, 6800, (s) => {
    manha(s, ALL, { fiscal: 360, ex: { caique: 'happy', bia: 'mocking' } });
    A(s, 'zefa', 1250, 462, 0.62, 'fiscal', 'angry', { who: 'senhora' }); H(s, 'multa-velha', 'obj_multa', 'zefa:R', 0.2);
    s.walk('zefa', 0, 1250, 700, { dur: 2200 });
    s.say('zefa', 'EU NÃO RECONHEÇO PORRA NENHUMA!', { at: 2400, dur: 2200, g: 'point', side: 'L', style: 'shout', ex: 'angry' });
    s.ex('fiscal', 2500, 'scared'); s.look('fiscal', 0, 'lim1'); s.look('fiscal', 2300, 'zefa'); s.act('fiscal', 'react', 2600, { dur: 900, intensity: 0.6 });
    s.cam0({ x: 300, y: 130, zoom: 1.3 }); s.cam(0, { x: 450, y: 130, zoom: 1.4 }, 6600, 'easeInOut');
    s.say('fiscal', 'Hã... a senhora está com a multa do dia três em aberto...', { at: 4800, dur: 2000, g: 'none', ex: 'worried' });
    s.dur(6800);
  });
  B.shot('A população não leva mais as multas a sério', MANHA, 4800, (s) => {
    manha(s, ALL, { fiscal: 360, zefa: 640, ex: { caique: 'laughing', bia: 'laughing', rafa: 'laughing', lari: 'laughing', samuca: 'happy' } });
    for (const k of ['lim1', 'lim2', 'vend'] as const) s.ex(k, 0, 'laughing');
    s.ex('fiscal', 0, 'ashamed'); s.look('fiscal', 0, 'zefa');
    s.act('zefa', 'crossArms', 200, { dur: 3000 }); s.act('caique', 'laugh', 300, { dur: 2400, intensity: 0.5 }); s.act('lim2', 'laugh', 600, { dur: 2000, intensity: 0.5 });
    s.walk('fiscal', 2200, 360, -300, { dur: 2200, speed: 0.8 });
    s.cam0({ x: 100, y: 130, zoom: 1.1 });
    s.dur(4800);
  });
}

/* ------------------------------ S12: PÓS-CRÉDITOS · DELEGACIA ------------------------------ */
const DEL = 'delegacia';
function delegacia(s: Shot, ex: { lon?: string; pol?: string } = {}) {
  s.prop('pc', 'computer', { x: 20, y: 270, scale: 0.7 });
  A(s, 'pol', 220, 440, 0.7, 'lon', ex.pol ?? 'neutral', { who: 'policial1' });
  s.prop('balcao', 'counter', { x: 140, y: 440, scale: 0.8, noShadow: false });
  A(s, 'lon', -240, 470, 0.7, 'pol', ex.lon ?? 'worried', { who: 'lon' });
}
export function seqD12(B: Builder) {
  B.seq = 'S12 · Pós-créditos: a delegacia';
  B.shot('Delegacia de Vila Torta: Lon Ruan chega disfarçado', DEL, 5400, (s) => {
    s.prop('balcao', 'counter', { x: 140, y: 440, scale: 0.8 });
    A(s, 'pol', 220, 440, 0.7, 'lon', 'bored', { who: 'policial1' });
    A(s, 'lon', -1100, 470, 0.7, 'pol', 'worried', { who: 'lon' }); s.walk('lon', 400, -1100, -240, { dur: 3500, speed: 0.8 });
    A(s, 'pol2', -520, 400, 0.62, 'lon', 'tired', { who: 'policial2' }); s.act('pol2', 'think', 500, { dur: 1800, side: 'R' });
    s.look('pol2', 0, 'lon');
    s.cam0({ x: -300, y: 80, zoom: 1.1 }); s.cam(0, { x: 0, y: 80, zoom: 1.2 }, 5200, 'easeInOut');
    s.dur(5400);
  });
  convo(B, 'Policial: "Bom dia. O que aconteceu?"', DEL, (s) => delegacia(s), ['two', ['pol', 'lon'], { dx: -20 }], [
    ['pol', 'Bom dia. O que aconteceu?', { ex: 'neutral', g: 'none', dur: 2000 }],
    ['lon', 'Doutor, levaram meu iPhone!', { ex: 'worried', g: 'gesture', side: 'R', dur: 2400 }],
  ], { extra: (s) => { s.look('pol', 0, 'lon'); s.look('lon', 0, 'pol'); } });
  convo(B, 'Policial: "O senhor viu alguém pegando?"', DEL, (s) => delegacia(s), ['medium', 'pol', { dx: 40 }], [
    ['pol', 'O senhor viu alguém pegando?', { ex: 'thinking', g: 'none', dur: 2200 }],
  ], { extra: (s) => s.look('pol', 0, 'lon') });
  convo(B, 'Lon: "Ele sumiu quando eu tava saindo do show"', DEL, (s) => delegacia(s), ['medium', 'lon', { dx: 40 }], [
    ['lon', 'Não. Ele sumiu quando eu tava saindo do show.', { ex: 'worried', g: 'shrug', dur: 3300 }],
  ], { extra: (s) => s.look('lon', 0, 'pol') });
  convo(B, 'Policial: "Então pode ter sido perdido"', DEL, (s) => delegacia(s), ['two', ['pol', 'lon']], [
    ['pol', 'Então pode ter sido perdido. Vamos registrar a ocorrência.', { ex: 'neutral', g: 'none', dur: 3800 }],
  ], { extra: (s) => { s.look('pol', 0, 'lon'); s.look('lon', 0, 'pol'); s.ex('pol', 2800, 'suspicious'); } });
  B.shot('O policial reconhece o cantor', DEL, 5600, (s) => {
    delegacia(s, { pol: 'suspicious' }); s.frame('close', ['pol'], { dy: 0 });
    s.ex('pol', 0, 'confused'); s.ex('pol', 900, 'surprised'); s.look('pol', 0, { x: -240, y: 200 }); s.look('pol', 1000, 'lon');
    s.say('pol', 'Peraí... o senhor não é aquele cantor que se apresentou ontem?', { at: 1800, dur: 3700, g: 'none', ex: 'suspicious' });
    s.end(300);
  });
  convo(B, 'Lon: "...Sou."', DEL, (s) => delegacia(s), ['close', 'lon'], [
    ['lon', '...Sou.', { ex: 'ashamed', g: 'none', dur: 1200, gapBefore: 600 }],
  ], { extra: (s) => { s.look('lon', 0, 'pol'); s.look('lon', 1500, { x: -900, y: 100 }); }, pad: 800 });
  convo(B, 'Policial: "Que tava cantando contra a polícia?"', DEL, (s) => delegacia(s, { pol: 'suspicious' }), ['medium', 'pol', { dx: 40 }], [
    ['pol', 'Aquele que tava cantando contra a polícia?', { ex: 'suspicious', g: 'point', side: 'L', dur: 3000 }],
  ], { extra: (s) => s.look('pol', 0, 'lon'), pad: 1800 });
  convo(B, 'Lon: "Uma coisa é a música, outra é o meu iPhone, pô!"', DEL, (s) => delegacia(s), ['two', ['lon', 'pol'], { dx: 40 }], [
    ['lon', 'Uma coisa é a música, outra coisa é meu iPhone, pô!', { ex: 'angry', g: 'gesture', side: 'R', dur: 3800 }],
  ], { extra: (s) => { s.look('lon', 0, 'pol'); s.look('pol', 0, 'lon'); s.ex('pol', 4200, 'tired'); } });
  convo(B, 'Policial segue o atendimento normalmente', DEL, (s) => delegacia(s, { pol: 'bored' }), ['two', ['pol', 'lon']], [
    ['pol', 'Certo. Qual o modelo e a cor do aparelho?', { ex: 'bored', g: 'none', dur: 3000 }],
    ['lon', 'iPhone de última geração, dourado, com capinha dourada e brilhante.', { ex: 'worried', g: 'gesture', side: 'R', dur: 4200 }],
  ], { extra: (s) => { s.look('pol', 0, 'pc'); s.look('lon', 0, 'pol'); s.act('pol', 'gesture', 400, { dur: 2200, side: 'R', intensity: 0.3 }); } });
  B.shot('Lon espera, olhando para o relógio', DEL, 3200, (s) => {
    delegacia(s, { pol: 'bored', lon: 'tired' }); s.frame('medium', ['lon']); s.look('lon', 0, { x: -400, y: 150 });
    s.act('lon', 'crossArms', 300, { dur: 2800 }); s.cam(0, { zoom: 1.9 }, 3000, 'linear');
    s.dur(3200);
  });
  // última piada: viatura x fiscal
  const frente = (s: Shot, o: { fiscalX?: number } = {}) => {
    s.shape('placa', 'rect', { x: -520, y: 60, w: 520, h: 100, fill: '#2a5aa0', sw: 6, radius: 10, bottom: true }); s.text('placa-t', 'DELEGACIA DE VILA TORTA', { x: -520, y: 60, size: 34, color: '#fff7e6', sw: 0 });
    vehicle(s, 'Viatura', 'viatura', { x: 240, y: 430, gs: 0.8 });
    A(s, 'fiscal', o.fiscalX ?? -60, 470, 0.66, 'Viatura' as never, 'angry', { who: 'norberto' }); H(s, 'multa', 'obj_multa', 'fiscal:R', 0.22); H(s, 'prancheta', 'book', 'fiscal:L', 0.7);
  };
  B.shot('Lon sai da delegacia e vê o fiscal multando a viatura', 'rua', 5600, (s) => {
    frente(s); A(s, 'lon', -900, 460, 0.7, 'fiscal', 'worried', { who: 'lon' }); s.walk('lon', 0, -900, -500, { dur: 2600, speed: 0.9 });
    s.say('fiscal', 'ESTACIONAMENTO IRREGULAR! MULTA DE TREZENTOS REAIS!', { at: 2400, dur: 3100, g: 'point', side: 'R', style: 'shout', ex: 'angry' });
    s.look('lon', 2600, 'fiscal'); s.ex('lon', 2800, 'confused'); s.snd('apito', 2300, 0.5);
    s.cam0({ x: -300, y: 120, zoom: 1.2 }); s.cam(0, { x: -50, zoom: 1.25 }, 5400, 'easeInOut');
    s.dur(5600);
  });
  B.shot('Detalhe: o fiscal prende a multa no para-brisa da viatura', 'rua', 3000, (s) => {
    frente(s, { fiscalX: 20 }); s.frame('two', ['fiscal', 'Viatura' as never], { zoom: 1.7 }); s.act('fiscal', 'pick', 300, { dur: 1400, side: 'R' });
    s.dur(3000);
  });
  convo(B, 'Policial: "O senhor é fiscal de trânsito?"', 'rua', (s) => { frente(s); A(s, 'pol', -330, 455, 0.7, 'fiscal', 'suspicious', { who: 'policial1' }); }, ['two', ['pol', 'fiscal'], { dx: 20 }], [
    ['pol', 'O senhor é fiscal de trânsito?', { ex: 'suspicious', g: 'none', dur: 2200 }],
    ['fiscal', 'Sou fiscal de tudo!', { ex: 'proud', g: 'gesture', side: 'R', style: 'shout', dur: 1900 }],
    ['pol', 'Tem identificação oficial?', { ex: 'bored', g: 'hold', side: 'R', dur: 2100 }],
  ], { extra: (s) => { s.look('pol', 0, 'fiscal'); s.look('fiscal', 0, 'pol'); } });
  B.shot('O fiscal olha para o próprio crachá', 'rua', 4200, (s) => {
    frente(s); A(s, 'pol', -330, 455, 0.7, 'fiscal', 'bored', { who: 'policial1' });
    s.prop('cracha', 'obj_cracha', { x: 0, y: 0, scale: 0.2, held: 'fiscal:R', noShadow: true });
    s.frame('close', ['fiscal']); s.look('fiscal', 0, { x: 60, y: 470 }); s.ex('fiscal', 0, 'proud'); s.ex('fiscal', 1200, 'worried');
    s.say('fiscal', '...Estou aguardando a emissão.', { at: 1800, dur: 2200, g: 'none', ex: 'ashamed' });
    s.dur(4200);
  });
  convo(B, 'Policial: "Não pode aplicar multas sem autorização"', 'rua', (s) => { frente(s); A(s, 'pol', -330, 455, 0.7, 'fiscal', 'bored', { who: 'policial1' }); A(s, 'lon', -600, 470, 0.7, 'fiscal', 'confused', { who: 'lon' }); }, ['two', ['pol', 'fiscal'], { dx: -20 }], [
    ['pol', 'Então pare de atrapalhar a passagem. O senhor não pode aplicar multa sem autorização.', { ex: 'angry', g: 'point', side: 'L', dur: 5600 }],
  ], { extra: (s) => { s.look('pol', 0, 'fiscal'); s.look('fiscal', 0, 'pol'); s.ex('fiscal', 3500, 'angry'); } });
  B.shot('Norberto recolhe a prancheta, indignado — corte seco para preto', 'rua', 6000, (s) => {
    frente(s); A(s, 'pol', -330, 455, 0.7, 'fiscal', 'bored', { who: 'policial1' }); A(s, 'lon', -600, 470, 0.7, 'fiscal', 'confused', { who: 'lon' });
    s.walk('fiscal', 800, -60, -1000, { dur: 3600, speed: 0.8 });
    s.say('fiscal', 'NINGUÉM RESPEITA MAIS A AUTORIDADE NESTA CIDADE!', { at: 1000, dur: 3300, g: 'gesture', side: 'R', style: 'shout', ex: 'angry' });
    s.look('pol', 0, 'fiscal'); s.look('lon', 0, 'fiscal'); s.ex('lon', 1500, 'laughing');
    s.cam0({ x: -300, y: 120, zoom: 1.2 });
    s.fx('fadeBlack', 5990, 10);
    s.dur(6000);
  });
  B.shot('Preto', 'neutro', 1400, (s) => { s.shape('preto', 'rect', { x: 0, y: 0, w: 4000, h: 2400, fill: '#000', sw: 0 }); s.dur(1400); });
}
