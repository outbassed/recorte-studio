/** SEQUÊNCIA 7 — A GRÁFICA  ·  SEQUÊNCIA 8 — DIA DE ELEIÇÃO */
import type { Builder, Shot } from '../lib';
import { convo, figurante } from './common';

type PK = 'bia' | 'rafa' | 'caique' | 'samuca' | 'lari';

/* ---------------------------------- GRÁFICA ---------------------------------- */
function fachada(s: Shot) {
  s.shape('loja', 'rect', { x: 0, y: -40, w: 1240, h: 520, fill: '#e8dcc0', sw: 5, bottom: false });
  s.shape('vitrine', 'rect', { x: -250, y: 20, w: 560, h: 300, fill: '#bfe3ee', sw: 6 });
  s.shape('porta', 'rect', { x: 330, y: 70, w: 190, h: 380, fill: '#7c5a44', sw: 6 });
  s.shape('vidro-porta', 'rect', { x: 330, y: 20, w: 120, h: 190, fill: '#bfe3ee', sw: 4 });
  s.prop('letreiro', 'obj_letreiro_grafica', { x: 0, y: -120, scale: 1.0, noShadow: true });
  s.prop('poster-g', 'obj_poster_g', { x: -380, y: 20, scale: 0.42, noShadow: true });
  s.prop('poster-p', 'obj_poster_p', { x: -120, y: 20, scale: 0.42, noShadow: true });
}
const TRAIL: Array<[PK, number, number]> = [['bia', -80, 250], ['rafa', -240, 236], ['caique', -380, 252], ['lari', -520, 238], ['samuca', -650, 254]];

export function seq7(B: Builder) {
  B.seq = 'S7 · A gráfica';
  B.shot('Os amigos passam em frente à gráfica (travelling)', 'rua', 5200, (s) => {
    fachada(s);
    const order: Array<[PK, number, number, number]> = [['rafa', -1180, 240, 560], ['caique', -1340, 254, 440], ['lari', -1500, 238, 290], ['samuca', -1660, 256, 150], ['bia', -1020, 252, 710]];
    for (const [k, x0, y, x1] of order) {
      s.actor(k, k, { x: x0, y, scale: 0.55, look: { x: 900, y: 120 }, ex: k === 'caique' ? 'happy' : 'neutral' });
      s.walk(k, 0, x0, x1, { dur: 4600 });
    }
    s.prop('garrafa', 'obj_garrafa', { x: 0, y: 0, scale: 0.6, held: 'samuca:L', noShadow: true });
    s.cam0({ x: -600, y: 10, zoom: 1.15 }); s.cam(0, { x: 200, zoom: 1.15 }, 5000, 'linear');
    s.look('bia', 3500, 'poster-g'); s.ex('bia', 3600, 'confused');
    s.dur(5200);
  });
  B.shot('Detalhe: as vitrines — a mesma frase nos dois cartazes', 'rua', 4600, (s) => {
    s.shape('fundo', 'rect', { x: 0, y: 0, w: 2400, h: 1300, fill: '#bfe3ee', sw: 0, bottom: true });
    s.prop('g', 'obj_poster_g', { x: -250, y: 450, scale: 1.45, noShadow: true, rot: -2 });
    s.prop('p', 'obj_poster_p', { x: 250, y: 450, scale: 1.45, noShadow: true, rot: 2 });
    s.text('igual', '=', { x: 0, y: 70, size: 190, color: '#d63b3b', sw: 14 });
    s.k('igual', 'opacity', [[0, 0, 'hold'], [1700, 1, 'hold']]);
    s.k('igual', 'transform.scaleX', [[1700, 0.1, 'linear'], [2000, 1, 'backOut']]); s.k('igual', 'transform.scaleY', [[1700, 0.1, 'linear'], [2000, 1, 'backOut']]);
    s.cam0({ x: -250, y: 30, zoom: 1.0 }); s.cam(0, { x: -250, zoom: 1.3 }, 1500, 'easeInOut'); s.cam(1600, { x: 250, y: 30, zoom: 1.3 }, 1800, 'easeInOut'); s.cam(3500, { x: 0, zoom: 1.0 }, 1000, 'easeInOut');
    s.dur(4600);
  });
  const stand = (s: Shot, ks: PK[], o: { ex?: Partial<Record<PK, string>> } = {}) => {
    fachada(s);
    for (const [k, x, y] of TRAIL) if (ks.includes(k)) s.actor(k, k, { x: x + 700, y, scale: 0.6, look: 'poster-g', ex: o.ex?.[k] ?? 'neutral' });
    if (ks.includes('samuca')) s.prop('garrafa', 'obj_garrafa', { x: 0, y: 0, scale: 0.65, held: 'samuca:L', noShadow: true });
  };
  convo(B, 'Bia percebe a mesma frase', 'rua', (s) => stand(s, ['bia', 'rafa', 'caique', 'lari', 'samuca']), ['two', ['bia', 'rafa']], [
    ['bia', 'Gente... olha as duas vitrines. É a mesma frase, palavra por palavra.', { ex: 'confused', g: 'point', side: 'R', dur: 4600 }],
    ['rafa', 'Mesma fonte, mesmas margens. Foi feito pela mesma gráfica.', { ex: 'thinking', g: 'none', dur: 4200 }],
  ], { extra: (s) => { s.look('bia', 0, 'poster-p'); s.look('rafa', 0, 'poster-g'); } });
  convo(B, 'Bia decide entrar', 'rua', (s) => stand(s, ['bia', 'rafa', 'caique', 'lari', 'samuca']), ['close', 'bia'], [
    ['bia', 'Vem comigo. Eu quero ouvir isso da boca do dono.', { ex: 'angry', g: 'none', dur: 3200 }],
  ], { extra: (s) => s.look('bia', 0, 'porta') });

  // interior
  const gp = { bia: { x: -170, y: 440, scale: 0.68 }, caique: { x: -350, y: 462, scale: 0.7 }, rafa: { x: -30, y: 415, scale: 0.64 }, lari: { x: -520, y: 425, scale: 0.66 }, samuca: { x: -250, y: 500, scale: 0.7 } } as const;
  const inter = (s: Shot, ks: PK[], o: { ex?: Partial<Record<PK, string>>; look?: Partial<Record<PK, string>>; donoEx?: string } = {}) => {
    s.prop('impressora', 'obj_impressora', { x: -640, y: 330, scale: 0.55, noShadow: true });
    s.prop('poster-g', 'obj_poster_g', { x: 520, y: 140, scale: 0.4, noShadow: true });
    s.prop('poster-p', 'obj_poster_p', { x: 760, y: 140, scale: 0.4, noShadow: true });
    s.prop('pilha', 'obj_pilha_papel', { x: 260, y: 330, scale: 0.6 });
    s.actor('dono', 'dono', { x: 360, y: 420, scale: 0.66, look: 'bia', ex: o.donoEx ?? 'happy' });
    s.prop('balcao', 'counter', { x: 360, y: 430, scale: 0.65, noShadow: false });
    for (const k of ks) s.actor(k, k, { ...gp[k], look: o.look?.[k] ?? 'dono', ex: o.ex?.[k] ?? 'neutral' });
    if (ks.includes('samuca')) s.prop('garrafa', 'obj_garrafa', { x: 0, y: 0, scale: 0.65, held: 'samuca:L', noShadow: true });
  };
  const ALL: PK[] = ['bia', 'rafa', 'caique', 'lari', 'samuca'];
  B.shot('Interior da gráfica: entram e vão ao balcão', 'grafica', 3600, (s) => {
    inter(s, []);
    for (const [k, x, y, tx] of [['bia', -1100, 440, -170], ['rafa', -1260, 415, -30], ['caique', -1420, 462, -350], ['lari', -1580, 425, -520], ['samuca', -1740, 500, -250]] as Array<[PK, number, number, number]>) {
      s.actor(k, k, { x, y, scale: gp[k].scale, look: 'dono', ex: 'neutral' }); s.walk(k, 0, x, tx, { dur: 3000 });
    }
    s.prop('garrafa', 'obj_garrafa', { x: 0, y: 0, scale: 0.65, held: 'samuca:L', noShadow: true });
    s.cam0({ x: -500, y: 20, zoom: 1.2 }); s.cam(0, { x: -100, zoom: 1.1 }, 3400, 'easeInOut');
    s.dur(3600);
  });
  convo(B, 'Bia interroga o dono', 'grafica', (s) => inter(s, ALL), ['two', ['bia', 'dono'], { dx: 80 }], [
    ['bia', 'O senhor faz propaganda pros dois candidatos?', { ex: 'suspicious', g: 'point', side: 'R', dur: 3200 }],
    ['dono', 'Claro.', { ex: 'happy', g: 'none', dur: 1000 }],
  ], { extra: (s) => s.look('bia', 0, 'dono') });
  convo(B, 'Bia: "Mas eles são adversários!"', 'grafica', (s) => inter(s, ALL), ['close', 'bia'], [
    ['bia', 'Mas eles são adversários!', { ex: 'surprised', g: 'none', style: 'shout', dur: 1900 }],
  ], { pad: 300 });
  convo(B, 'Dono: "Eu sou empresário, minha filha"', 'grafica', (s) => inter(s, ALL), ['medium', 'dono', { dx: -100 }], [
    ['dono', 'E eu sou empresário, minha filha.', { ex: 'proud', g: 'gesture', side: 'R', dur: 2500 }],
  ], { extra: (s) => s.look('dono', 0, 'bia') });
  convo(B, 'Caíque pergunta se ele tem lado', 'grafica', (s) => inter(s, ALL, { look: { caique: 'dono' } }), ['two', ['caique', 'dono'], { dx: 30 }], [
    ['caique', 'O senhor tem lado?', { ex: 'mocking', g: 'none', dur: 1700 }],
    ['dono', 'Tenho. O lado que paga no prazo.', { ex: 'proud', g: 'gesture', side: 'L', dur: 2900 }],
  ], { extra: (s) => { s.look('dono', 0, 'caique'); } });
  convo(B, 'Samuca e o café na escola', 'grafica', (s) => inter(s, ALL), ['medium', 'samuca', { dx: 90 }], [
    ['samuca', 'Minha mãe diz que ninguém deve trabalhar de graça. Eu tentei vender café na escola, mas bebi tudo antes.', { ex: 'happy', g: 'gesture', side: 'R', dur: 6600 }],
  ], { extra: (s) => s.look('samuca', 0, 'dono') });
  B.shot('O dono fica sem reação', 'grafica', 3600, (s) => {
    inter(s, ALL, { donoEx: 'confused', ex: { lari: 'laughing', caique: 'laughing', bia: 'tired', rafa: 'happy', samuca: 'happy' } });
    s.frame('medium', ['dono'], { dx: -60 });
    s.k('dono', 'blinkMode', [[0, 'open', 'hold'], [1000, 'closed', 'hold'], [1180, 'open', 'hold'], [2300, 'closed', 'hold'], [2480, 'open', 'hold']]);
    s.ex('dono', 1800, 'bored');
    s.cam(0, { zoom: 1.7 }, 3300, 'linear');
    s.dur(3600);
  });
}

/* ---------------------------------- ELEIÇÃO ---------------------------------- */
const VOT = 'praca';
const EP = { bia: { x: 30, y: 452, scale: 0.63 }, rafa: { x: 190, y: 420, scale: 0.6 }, caique: { x: -140, y: 440, scale: 0.62 }, lari: { x: -290, y: 428, scale: 0.6 }, samuca: { x: 350, y: 446, scale: 0.62 } } as const;
/** Local de votação na Praça do Coreto (deteriorada): fila, cabines, placa "EM BREVE" brilhando no meio do abandono. */
function votacao(s: Shot, ks: PK[], o: { fila?: boolean; look?: Partial<Record<PK, string>>; ex?: Partial<Record<PK, string>>; MA?: boolean } = {}) {
  s.prop('coreto', 'obj_coreto', { x: 420, y: 205, scale: 0.5, noShadow: true, bottom: true });
  s.prop('banco-quebrado', 'bench', { x: -740, y: 305, scale: 0.7, rot: -6 });
  s.prop('lixo1', 'trash', { x: -560, y: 300, scale: 0.7, rot: 70 });
  s.prop('poste-apagado', 'streetlamp', { x: 610, y: 300, scale: 0.55, state: 'off', rot: 4 });
  s.prop('placa-praca', 'obj_placa_praca', { x: -470, y: 330, scale: 0.72 });
  s.prop('placa-secao', 'obj_placa_secao', { x: 120, y: 200, scale: 0.5, noShadow: true });
  s.prop('cabine1', 'obj_cabine', { x: 760, y: 280, scale: 0.55 });
  s.prop('urna', 'obj_urna', { x: 650, y: 250, scale: 0.5, noShadow: true });
  if (o.fila !== false) {
    const sides: Array<'G' | 'P'> = ['G', 'P', 'G', 'P'];
    (['e1', 'e2', 'e3', 'e4'] as const).forEach((k, i) => figurante(s, k, k, sides[i]!, 420 - i * 105, 352 - (i % 2) * 8, 0.5, { look: { x: 800, y: 200 }, ex: 'bored' }));
  }
  if (o.MA !== false) {
    s.actor('marta', 'marta', { x: 80, y: 340, scale: 0.55, look: 'agenor', ex: 'angry', shirt: '#d27ba6' });
    s.actor('agenor', 'agenor', { x: 240, y: 340, scale: 0.55, look: 'marta', ex: 'angry' });
  }
  for (const k of ks) s.actor(k, k, { ...EP[k], look: o.look?.[k] ?? 'marta', ex: o.ex?.[k] ?? 'tired' });
  if (ks.includes('samuca')) s.prop('garrafa', 'obj_garrafa', { x: 0, y: 0, scale: 0.65, held: 'samuca:L', noShadow: true });
}
const EALL: PK[] = ['bia', 'rafa', 'caique', 'lari', 'samuca'];

export function seq8(B: Builder) {
  B.seq = 'S8 · Dia de eleição';
  B.shot('Dia de eleição: a fila e o local de votação (plano geral)', VOT, 5200, (s) => {
    votacao(s, EALL);
    s.cam0({ x: -500, y: 40, zoom: 1.1 }); s.cam(0, { x: 400, zoom: 1.1 }, 5000, 'easeInOut');
    // a fila anda um passo
    (['e1', 'e2', 'e3', 'e4'] as const).forEach((k, i) => { s.k(k, 'transform.x', [[0, 420 - i * 105, 'linear'], [1800, 420 - i * 105, 'hold'], [2600, 470 - i * 105, 'easeInOut']]); });
    s.dur(5200);
  });
  convo(B, 'Marta e Agenor brigando na fila', VOT, (s) => votacao(s, EALL), ['two', ['marta', 'agenor']], [
    ['marta', 'O seu candidato é um mentiroso, seu Agenor!', { ex: 'angry', g: 'point', side: 'R', style: 'shout', dur: 3100 }],
    ['agenor', 'O seu é pior! Mente até no horóscopo!', { ex: 'angry', g: 'gesture', side: 'L', style: 'shout', dur: 3000 }],
  ], { extra: (s) => { s.look('marta', 0, 'agenor'); s.look('agenor', 0, 'marta'); } });
  convo(B, 'Agenor: "Um mentiroso diferente!"', VOT, (s) => votacao(s, EALL), ['close', 'agenor'], [
    ['marta', 'O meu pelo menos disfarça!', { ex: 'angry', g: 'none', dur: 1900 }],
    ['agenor', 'MAS O MEU PELO MENOS É UM MENTIROSO DIFERENTE!', { ex: 'angry', g: 'none', style: 'shout', dur: 3600 }],
  ], { extra: (s) => { s.look('agenor', 0, 'marta'); s.fx('shake', 2200, 700, 0.5); }, pad: 600 });
  convo(B, 'Os protagonistas observam; Rafael duvida', VOT, (s) => votacao(s, EALL, { look: { bia: 'rafa', rafa: 'marta', caique: 'marta', lari: 'marta', samuca: 'fila' as never } }), ['two', ['rafa', 'bia']], [
    ['rafa', 'Talvez essa briga acabe depois da eleição.', { ex: 'thinking', g: 'none', dur: 3000 }],
    ['bia', 'Você acredita mesmo nisso?', { ex: 'suspicious', g: 'none', dur: 2000 }],
    ['rafa', 'Não.', { ex: 'tired', g: 'none', dur: 900, gapBefore: 500 }],
  ], { extra: (s) => { s.look('bia', 0, 'rafa'); s.look('rafa', 0, 'bia'); } });
  B.shot('Detalhe: a placa "EM BREVE: NOVA PRAÇA" no meio do abandono', VOT, 5000, (s) => {
    votacao(s, [], { fila: false, MA: false });
    s.cam0({ x: -700, y: 120, zoom: 1.1 }); s.cam(0, { x: -470, y: 60, zoom: 1.55 }, 4800, 'easeInOut');
    s.dur(5000);
  });
  convo(B, 'Caíque: "Reformaram a placa."', VOT, (s) => votacao(s, EALL, { look: { caique: 'placa-praca' } }), ['medium', 'caique', { dx: -100 }], [
    ['caique', 'Reformaram a placa.', { ex: 'mocking', g: 'point', side: 'L', dur: 1900 }],
  ], { pad: 900 });
  convo(B, 'Samuca: "Pelo menos a placa é bonita"', VOT, (s) => votacao(s, EALL, { look: { samuca: 'placa-praca', bia: 'samuca' } }), ['two', ['samuca', 'bia'], { dx: 20 }], [
    ['samuca', 'Pelo menos a placa é bonita.', { ex: 'happy', g: 'none', dur: 2200 }],
    ['bia', 'SAMUCA!', { ex: 'angry', g: 'none', style: 'shout', dur: 1400 }],
    ['samuca', 'Ué, eu não disse que a praça é bonita.', { ex: 'confused', g: 'shrug', dur: 2800 }],
  ], { extra: (s) => { s.fx('shake', 3300, 500, 0.3); } });
}
