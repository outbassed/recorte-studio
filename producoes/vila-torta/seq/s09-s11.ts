/** SEQUÊNCIAS 9 (apuração), 10 (vitória do Gaivota) e 11 (pós-créditos: a placa) */
import type { Builder, Shot } from '../lib';
import { convo, figurante, puff, ruaSet, RUA } from './common';
import { sala } from './s06-debate';
import { vehicle, drive } from '../vehicles';

type SK = 'bia' | 'lari' | 'rafa' | 'caique' | 'samuca';
const SALL: SK[] = ['bia', 'lari', 'rafa', 'caique', 'samuca'];
const O = '#e98f4e'; const Bl = '#3b6fb6';

/* ------------------------- gráficos eleitorais fictícios animados ------------------------- */
const STEPS: Array<[number, number, number]> = [[38.1, 29.4, 31], [44.0, 41.2, 58], [47.2, 46.8, 77], [48.3, 50.4, 91], [50.2, 49.8, 98], [50.8, 49.2, 100]];
const fmt = (n: number) => n.toFixed(1).replace('.', ',') + '%';

/** Tela de apuração dentro do objeto "Televisão" (base em (cx, baseY), escala k). `t0 < 0` = já terminada (estática). */
function apuracao(s: Shot, cx: number, baseY: number, k: number, t0: number, step = 1100) {
  const cy = baseY - 310 * k;
  const live = t0 >= 0;
  s.shape('ap:fundo', 'rect', { x: cx, y: cy, w: 590 * k, h: 350 * k, fill: '#0d1a3a', sw: 0 });
  s.shape('ap:faixa', 'rect', { x: cx, y: cy - 140 * k, w: 590 * k, h: 56 * k, fill: '#a3202c', sw: 0 });
  s.text('ap:titulo', 'APURAÇÃO · PREFEITO DE VILA TORTA', { x: cx, y: cy - 140 * k, size: 25 * k, color: '#fff7e6', sw: 0 });
  const baseBar = cy + 118 * k;
  const H = 230 * k;
  const bars: Array<[string, number, string, string]> = [['G', cx - 130 * k, O, 'GAIVOTA'], ['P', cx + 130 * k, Bl, 'PINOTE']];
  for (const [id, x, col, nome] of bars) {
    s.shape(`ap:barra-${id}`, 'rect', { x, y: -H / 2, w: 150 * k, h: H, fill: col, sw: 4 * k });
    s.group(`ap:grupo-${id}`, [`ap:barra-${id}`], { x, y: baseBar });
    // o rect foi criado em (x, -H/2) dentro do grupo: ajusta o X local para 0
    const n = s.scene.nodes[s.id(`ap:barra-${id}`)]!; n.transform.x = 0;
    s.text(`ap:nome-${id}`, nome, { x, y: baseBar + 22 * k, size: 26 * k, color: col, sw: 0 });
  }
  STEPS.forEach(([g, p, secoes], i) => {
    const ti = live ? t0 + i * step : -1;
    const tEnd = live ? t0 + (i + 1) * step : -1;
    const last = i === STEPS.length - 1;
    for (const [id, v, x] of [['G', g, cx - 130 * k], ['P', p, cx + 130 * k]] as const) {
      const key = `ap:pct-${id}-${i}`;
      s.text(key, fmt(v), { x, y: cy - 70 * k, size: 50 * k, color: '#fff7e6', stroke: '#0d1a3a', sw: 7 * k, vis: !live && last });
      if (live) s.k(key, 'visible', [[0, false, 'hold'], [ti, true, 'hold'], ...(last ? [] : [[tEnd, false, 'hold'] as [number, boolean, 'hold']])]);
    }
    const kk = `ap:secoes-${i}`;
    s.text(kk, `${secoes}% das seções apuradas`, { x: cx, y: cy + 160 * k, size: 17 * k, color: '#cfd4d8', sw: 0, vis: !live && last });
    if (live) s.k(kk, 'visible', [[0, false, 'hold'], [ti, true, 'hold'], ...(last ? [] : [[tEnd, false, 'hold'] as [number, boolean, 'hold']])]);
  });
  // barras: crescem a cada etapa (altura proporcional ao percentual)
  for (const [id, idx] of [['G', 0], ['P', 1]] as const) {
    const gk = `ap:grupo-${id}`;
    if (live) s.k(gk, 'transform.scaleY', [[0, 0.02, 'hold'], ...STEPS.map(([g, p], i) => [t0 + i * step + 100, ((idx === 0 ? g : p) / 60) * k, 'easeInOut'] as [number, number, 'easeInOut']).map(([t, v, e]) => [t, v / k * k, e] as [number, number, 'easeInOut'])]);
    else s.scene.nodes[s.id(gk)]!.transform.scaleY = (idx === 0 ? STEPS[5]![0] : STEPS[5]![1]) / 60 * 1;
    // as barras já estão desenhadas com altura H (em 100%); a escala relativa = pct/60
    if (live) s.k(gk, 'transform.scaleY', [[0, 0.02, 'hold'], ...STEPS.map(([g, p], i) => [t0 + i * step + 100, (idx === 0 ? g : p) / 60, 'easeInOut'] as [number, number, 'easeInOut'])]);
  }
  const tb = live ? t0 + 5 * step + 400 : 0;
  s.shape('ap:selo', 'burst', { x: cx, y: cy + 10 * k, w: 420 * k, h: 150 * k, fill: '#f2c95c', sw: 5 * k, rot: -6, vis: !live });
  s.text('ap:vencedor', 'GAIVOTA REELEITO', { x: cx, y: cy + 10 * k, size: 40 * k, color: '#23202b', sw: 0, rot: -6, vis: !live });
  if (live) {
    for (const key of ['ap:selo', 'ap:vencedor']) {
      s.k(key, 'visible', [[0, false, 'hold'], [tb, true, 'hold']]);
      s.k(key, 'transform.scaleX', [[tb, 0.1, 'linear'], [tb + 300, 1, 'backOut']]);
      s.k(key, 'transform.scaleY', [[tb, 0.1, 'linear'], [tb + 300, 1, 'backOut']]);
    }
  }
}
const tvAp = (live: boolean, t0 = 300) => (s: Shot) => apuracao(s, -640, 345, 0.7, live ? t0 : -1);

export function seq9(B: Builder) {
  B.seq = 'S9 · Apuração';
  B.shot('Sala: a apuração começa; os cinco acompanham tensos', 'sala', 6200, (s) => {
    sala(s, SALL, { tv: tvAp(true, 500), ex: { bia: 'worried', lari: 'worried', rafa: 'thinking', caique: 'bored', samuca: 'excited' } });
    s.cam0({ x: -120, y: 40, zoom: 1.15 }); s.cam(0, { x: -330, zoom: 1.25 }, 6000, 'easeInOut');
    s.dur(6200);
  });
  B.shot('TV: gráficos da apuração (Gaivota × Pinote) — close na tela', 'sala', 8600, (s) => {
    s.prop('tv', 'obj_tv', { x: 0, y: 480, scale: 1.45, noShadow: true });
    apuracao(s, 0, 480, 1.45, 400);
    s.cam0({ x: 0, y: 40, zoom: 1.0 }); s.cam(0, { y: 20, zoom: 1.14 }, 8400, 'linear');
    s.fx('flash', 400 + 5 * 1100 + 400, 200, 0.4);
    s.dur(8600);
  });
  const S = (ex: Partial<Record<SK, string>>, look?: Partial<Record<SK, string>>) => (s: Shot) => sala(s, SALL, { tv: tvAp(false), ex, look });
  convo(B, 'Bia indignada com o resultado', 'sala', S({ bia: 'angry', lari: 'surprised', rafa: 'tired', caique: 'bored', samuca: 'sad' }), ['close', 'bia'], [
    ['bia', 'É sério isso? De novo?! Mais quatro anos?!', { ex: 'angry', g: 'none', style: 'shout', dur: 3500 }],
  ], { extra: (s) => { s.fx('shake', 400, 600, 0.4); } });
  convo(B, 'Caíque: "quatro anos de férias"', 'sala', S({ caique: 'mocking' }), ['medium', 'caique', { dx: 60 }], [
    ['caique', 'Pelo menos o prefeito conseguiu mais quatro anos de férias.', { ex: 'mocking', g: 'gesture', side: 'R', dur: 4000 }],
  ]);
  convo(B, 'Rafael: "praticamente metade votou no adversário"', 'sala', S({ rafa: 'thinking' }), ['medium', 'rafa', { dx: -80 }], [
    ['rafa', 'Praticamente metade da cidade votou no outro. Foram dois ponto seis por cento de diferença.', { ex: 'thinking', g: 'none', dur: 5600 }],
  ], { extra: (s) => s.look('rafa', 0, 'bia') });
  convo(B, 'Larissa prevê que as discussões continuarão', 'sala', S({ lari: 'worried' }), ['medium', 'lari', { dx: 50 }], [
    ['lari', 'Pode apostar que essas discussões vão continuar até a próxima eleição.', { ex: 'worried', g: 'shrug', dur: 4600 }],
  ], { extra: (s) => s.look('lari', 0, 'bia') });
  convo(B, 'Samuca: "o importante é quem vai cuidar da cidade"', 'sala', S({ samuca: 'happy' }), ['medium', 'samuca', { dx: 150 }], [
    ['samuca', 'Eu acho que o importante é quem vai cuidar da cidade.', { ex: 'happy', g: 'none', dur: 3600 }],
  ], { extra: (s) => s.look('samuca', 0, 'bia') });
  B.shot('Todos concordam com o Samuca', 'sala', 2800, (s) => {
    sala(s, SALL, { tv: tvAp(false), ex: { bia: 'neutral', lari: 'happy', rafa: 'happy', caique: 'happy', samuca: 'happy' }, look: { bia: 'samuca', lari: 'samuca', rafa: 'samuca', caique: 'samuca' } });
    s.cam0({ x: 150, y: 40, zoom: 1.25 });
    for (const [k, t] of [['bia', 300], ['rafa', 450], ['lari', 600], ['caique', 750]] as const) s.act(k, 'nod', t, { dur: 900, intensity: 0.9 });
    s.dur(2800);
  });
  convo(B, 'Samuca: "Senhor Prefeito Gaivota?"', 'sala', S({ samuca: 'thinking' }), ['medium', 'samuca', { dx: 150 }], [
    ['samuca', 'Mas... se o Gaivota é o prefeito, por que ninguém chama ele de Senhor Prefeito Gaivota?', { ex: 'confused', g: 'point', side: 'R', dur: 6000 }],
  ], { extra: (s) => s.look('samuca', 0, { x: -400, y: 100 }) });
  B.shot('Bia sem reação; Rafael ri', 'sala', 4200, (s) => {
    sala(s, SALL, { tv: tvAp(false), ex: { bia: 'bored', lari: 'laughing', rafa: 'laughing', caique: 'laughing', samuca: 'curious' as never }, look: { bia: 'cam' as never, lari: 'samuca', rafa: 'samuca', caique: 'samuca' } });
    s.frame('two', ['bia', 'rafa'], { dx: 70, zoom: 1.2 });
    s.k('bia', 'blinkMode', [[0, 'open', 'hold'], [1300, 'closed', 'hold'], [1500, 'open', 'hold'], [2900, 'closed', 'hold'], [3100, 'open', 'hold']]);
    s.look('bia', 0, { x: 190, y: -80 });
    s.act('rafa', 'laugh', 600, { dur: 2600, intensity: 0.8 });
    s.dur(4200);
  });
}

/* ----------------------------------- VITÓRIA ----------------------------------- */
function confete(s: Shot, n: number, dur: number) {
  const cols = ['#e98f4e', '#f2c95c', '#d63b3b', '#3b6fb6', '#58a56d', '#fff7e6'];
  for (let i = 0; i < n; i++) {
    const x0 = -900 + ((i * 163) % 1800);
    const d = dur * (0.7 + ((i * 37) % 30) / 100);
    const k = `confete${i}`;
    s.shape(k, 'rect', { x: x0, y: -620, w: 22, h: 12, fill: cols[i % cols.length]!, sw: 2 });
    const t0 = (i * 211) % 1800;
    s.k(k, 'transform.y', [[0, -620, 'hold'], [t0, -620, 'linear'], [t0 + d, 640, 'linear']]);
    s.k(k, 'transform.x', [[t0, x0, 'linear'], [t0 + d * 0.5, x0 + (i % 2 ? 60 : -60), 'easeInOut'], [t0 + d, x0 + (i % 2 ? -30 : 30), 'easeInOut']]);
    s.k(k, 'transform.rotationDeg', [[t0, 0, 'linear'], [t0 + d, 540 * (i % 2 ? 1 : -1), 'linear']]);
  }
}
const palanque = (s: Shot, o: { cartaz?: boolean; ex?: string } = {}) => {
  s.prop('palanque', 'obj_palanque', { x: 0, y: 330, scale: 0.85, noShadow: true });
  s.actor('gaivota', 'gaivota', { x: 0, y: 260, scale: 0.6, look: 'cam', ex: o.ex ?? 'proud', headStrength: 0.15 });
  s.prop('pulpito', 'obj_pulpito_vitoria', { x: 0, y: 262, scale: 0.7, noShadow: true });
  const spec: Array<[string, 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6', 'G' | 'P', number, number]> = [['e1', 'e1', 'G', -620, 470], ['e2', 'e2', 'G', -380, 500], ['e3', 'e3', 'P', -150, 480], ['e4', 'e4', 'P', 160, 495], ['e5', 'e5', 'G', 400, 470], ['e6', 'e6', 'P', 640, 500]];
  for (const [k, w, side, x, y] of spec) figurante(s, k, w, side, x, y, 0.66, { look: 'gaivota', ex: side === 'G' ? 'happy' : 'bored' });
  if (o.cartaz) s.prop('cartaz-rua', 'obj_cartaz_rua', { x: 0, y: 0, scale: 0.7, held: 'e3:R', noShadow: true });
  else s.prop('cartaz-g', 'obj_cartaz_g', { x: 0, y: 0, scale: 0.6, held: 'e1:R', noShadow: true });
};
const PX = { gaivota: 'gaivota' };
void PX;

export function seq10(B: Builder) {
  B.seq = 'S10 · Vitória do Gaivota';
  B.shot('Palanque: o prefeito reeleito diante da multidão', 'praca', 9400, (s) => {
    palanque(s);
    confete(s, 22, 4200);
    s.cam0({ x: 0, y: 40, zoom: 1.0 }); s.cam(0, { x: 0, y: 140, zoom: 1.2 }, 9200, 'linear');
    s.t = 600;
    s.say('gaivota', 'Povo de Vila Torta! Esta vitória é de vocês!', { ex: 'excited', g: 'gesture', side: 'R', style: 'shout', dur: 3400 });
    s.say('gaivota', 'Vamos continuar o trabalho que iniciamos no meu primeiro mandato!', { ex: 'proud', g: 'gesture', side: 'L', dur: 4600 });
    s.act('e1', 'jump', 700, { dur: 700, intensity: 0.7 }); s.act('e5', 'jump', 900, { dur: 700, intensity: 0.7 });
    s.dur(9400);
  });
  convo(B, 'Pessoa da multidão com o cartaz da rua asfaltada', 'praca', (s) => palanque(s, { cartaz: true }), ['medium', 'e3', { dy: 30 }], [
    ['e3', 'Cadê a rua asfaltada que o senhor prometeu?!', { ex: 'angry', g: 'none', style: 'shout', dur: 3300 }],
  ], { extra: (s) => { s.look('e3', 0, 'gaivota'); confete(s, 8, 3000); } });
  convo(B, 'Outra pessoa grita', 'praca', (s) => palanque(s, { cartaz: true }), ['medium', 'e6', { dy: 30 }], [
    ['e6', 'E O QUE O SENHOR COMEÇOU, EXATAMENTE?!', { ex: 'angry', g: 'point', side: 'L', style: 'shout', dur: 3200 }],
  ], { extra: (s) => { s.look('e6', 0, 'gaivota'); confete(s, 8, 3000); } });
  convo(B, 'Gaivota finge que não ouviu', 'praca', (s) => palanque(s, { ex: 'worried' }), ['medium', 'gaivota', { dy: 20 }], [
    ['gaivota', 'Obrigado! Obrigado! Esse microfone tá falhando!', { ex: 'worried', g: 'none', dur: 3300 }],
  ], { extra: (s) => { confete(s, 14, 3500); s.k('gaivota', 'rig.headTilt', [[800, 0, 'linear'], [1200, -6, 'easeOut'], [2200, 0, 'easeInOut']]); }, pad: 700 });

  // comitê do Pinote
  const comite = (s: Shot, ex = 'angry') => {
    s.actor('pinote', 'pinote', { x: -120, y: 440, scale: 0.78, look: 'cam', ex });
    s.actor('ass', 'assessora', { x: 330, y: 432, scale: 0.68, look: 'pinote', ex: 'tired' });
  };
  convo(B, 'Comitê do Pinote: "Perdemos uma batalha"', 'comite', (s) => comite(s, 'proud'), ['medium', 'pinote', { dx: 60 }], [
    ['pinote', 'Perdemos uma batalha, mas não perdemos a guerra!', { ex: 'proud', g: 'gesture', side: 'R', style: 'shout', dur: 3900 }],
  ], { extra: (s) => { s.look('pinote', 0, 'cam'); } });
  convo(B, 'Assessora: "Doutor, acabou a eleição"', 'comite', (s) => comite(s), ['two', ['ass', 'pinote']], [
    ['ass', 'Doutor, acabou a eleição.', { ex: 'tired', g: 'none', dur: 2200 }],
    ['pinote', 'Eu sei. Já podemos começar a campanha da próxima?', { ex: 'excited', g: 'point', side: 'R', dur: 3800, gapBefore: 700 }],
  ], { extra: (s) => { s.look('ass', 0, 'pinote'); s.look('pinote', 0, 'ass'); }, pad: 900 });

  // dona Marta comemora na rua do buraco
  const marta = (s: Shot, ks: Array<'marta' | 'agenor'>) => {
    ruaSet(s);
    s.prop('portao', 'door', { x: -330, y: 232, scale: 0.55, noShadow: false });
    s.prop('placa-casa', 'obj_placa_secao', { x: -520, y: 215, scale: 0.0001, vis: false });
    const v = vehicle(s, 'Carro', 'car', { x: -1300, y: RUA.roadY, gs: RUA.gs }); void v;
    if (ks.includes('marta')) s.actor('marta', 'marta', { x: -190, y: 242, scale: 0.62, look: 'agenor', ex: 'excited', shirt: '#d27ba6' });
    if (ks.includes('agenor')) s.actor('agenor', 'agenor', { x: 70, y: 262, scale: 0.6, look: 'marta', ex: 'angry' });
    if (ks.includes('marta')) s.prop('bandeira', 'obj_bandeira_g', { x: 0, y: 0, scale: 0.35, held: 'marta:R', noShadow: true });
  };
  convo(B, 'Marta comemora e provoca o Agenor', 'rua', (s) => marta(s, ['marta', 'agenor']), ['two', ['marta', 'agenor'], { zoom: 1.05 }], [
    ['marta', 'Ganhou o meu candidato, seu Agenor! Mais quatro anos!', { ex: 'excited', g: 'gesture', side: 'L', style: 'shout', dur: 3600 }],
    ['agenor', 'Mais quatro anos de buracos, dona Marta!', { ex: 'angry', g: 'point', side: 'R', dur: 3000 }],
  ], { extra: (s) => { s.act('marta', 'jump', 400, { dur: 700, intensity: 0.5 }); s.look('marta', 0, 'agenor'); } });
  B.shot('Marta olha para o buraco diante da própria casa', 'rua', 6000, (s) => {
    marta(s, ['marta']);
    s.frame('two', ['marta', 'buraco'], { zoom: 1.15, dy: 30 });
    s.look('marta', 0, 'agenor');
    s.look('marta', 1600, { x: 150, y: 398 });
    s.ex('marta', 1600, 'confused'); s.ex('marta', 2800, 'disgusted');
    s.say('marta', '...É, esse buraco tá uma merda mesmo.', { at: 3200, dur: 2600, ex: 'tired', g: 'none' });
    s.cam(3000, { x: 40, y: 250, zoom: 1.5 }, 2600, 'easeInOut');
    s.dur(6200);
  });
}

/* ------------------------------ PÓS-CRÉDITOS: A PLACA ------------------------------ */
export function seq11(B: Builder) {
  B.seq = 'S11 · Pós-créditos: a placa';
  const gx = RUA.carFinalX; const Y = RUA.roadY;
  /** Carro avariado do dia anterior: mesma posição e mesmo estado (roda dianteira fora, nariz caído). */
  const carroAvariado = (s: Shot) => {
    const v = vehicle(s, 'Carro', 'car', { x: gx, y: Y, gs: RUA.gs, bodyTilt: 8.5, frontDip: 26 });
    s.k(v.sf, 'transform.scaleY', [[0, 2.6, 'linear']]); s.k(v.wf, 'transform.x', [[0, 1500, 'linear']]); s.k(v.body, 'transform.y', [[0, 30, 'linear']]);
    return v;
  };
  const base = (s: Shot) => { ruaSet(s); return carroAvariado(s); };

  B.shot('Manhã seguinte: o mesmo buraco, o mesmo carro', 'rua', 4400, (s) => {
    base(s);
    s.actor('mot', 'motorista', { x: -430, y: 450, scale: 0.7, look: { x: 170, y: 340 }, ex: 'angry', pose: 'hips' });
    s.text('legenda', 'NO DIA SEGUINTE', { x: 0, y: -430, size: 52, color: '#fff7e6', sw: 9 });
    s.k('legenda', 'opacity', [[0, 0, 'linear'], [400, 1, 'easeOut'], [3000, 1, 'linear'], [3800, 0, 'easeIn']]);
    s.walk('mot', 600, -430, -330, { dur: 1100, speed: 0.8 }); s.walk('mot', 1900, -330, -450, { dur: 1100, speed: 0.8 });
    s.act('mot', 'shakeHead', 3000, { dur: 1000, intensity: 0.6 });
    s.cam0({ x: -30, y: 90, zoom: 1.12 }); s.cam(0, { x: 20, zoom: 1.18 }, 4200, 'linear');
    s.dur(4400);
  });
  B.shot('O caminhão da prefeitura chega', 'rua', 5200, (s) => {
    base(s);
    s.actor('mot', 'motorista', { x: -430, y: 450, scale: 0.7, look: { x: -900, y: 300 }, ex: 'tired' });
    const tv = vehicle(s, 'Caminhão', 'truck', { x: -1500, y: 505, gs: 0.8 });
    const r = drive(s, tv, 0, 3600, -1500, 560, { ease: 'out', steps: 14 }); void r;
    s.ex('mot', 1300, 'surprised'); s.ex('mot', 3000, 'happy');
    s.look('mot', 1300, 'Caminhão');
    s.cam0({ x: -150, y: 110, zoom: 1.12 }); s.cam(0, { x: 260, y: 120, zoom: 1.12 }, 4400, 'easeInOut');
    s.dur(5200);
  });
  convo(B, 'Motorista: "Até que enfim!"', 'rua', (s) => { base(s); s.actor('mot', 'motorista', { x: -430, y: 450, scale: 0.7, look: { x: 560, y: 380 }, ex: 'happy', pose: 'hands-up' }); const tv = vehicle(s, 'Caminhão', 'truck', { x: 560, y: 505, gs: 0.8 }); void tv; }, ['medium', 'mot', { dx: 90 }], [
    ['mot', 'Até que enfim! Vão tapar essa buraqueira!', { ex: 'excited', g: 'none', dur: 3000 }],
  ], { pad: 400 });

  // os funcionários descem e retiram a placa (embrulhada: a placa só será vista depois de instalada)
  B.shot('Funcionários retiram a placa da carroceria', 'rua', 6400, (s) => {
    base(s);
    s.actor('mot', 'motorista', { x: -430, y: 450, scale: 0.7, look: 'func1', ex: 'happy' });
    const tv = vehicle(s, 'Caminhão', 'truck', { x: 560, y: 505, gs: 0.8 }); void tv;
    s.actor('func1', 'func1', { x: 470, y: 540, scale: 0.6, look: { x: 150, y: 380 }, ex: 'bored' });
    s.actor('func2', 'func2', { x: 640, y: 548, scale: 0.6, look: 'func1', ex: 'tired' });
    s.prop('placa', 'obj_placa_buraco', { x: 560, y: 520, scale: 0.4, noShadow: true });
    s.shape('papel', 'rect', { x: 560, y: 520 - 330 * 0.4, w: 440 * 0.4 * 1.06, h: 300 * 0.4 * 1.1, fill: '#b08a5e', sw: 3 });
    s.group('Placa', ['placa', 'papel'], { x: 0, y: 0 });
    s.walk('func2', 200, 640, 430, { dur: 1700, speed: 0.9 });
    s.walk('func1', 400, 470, 300, { dur: 1600, speed: 0.9 });
    s.k('Placa', 'transform.x', [[0, 0, 'hold'], [2300, 0, 'linear'], [4800, -440, 'easeInOut']]);
    s.k('Placa', 'transform.y', [[2300, 0, 'linear'], [2600, -60, 'easeOut'], [4800, -50, 'linear']]);
    s.k('func1', 'transform.x', [[2000, 300, 'hold'], [4800, -160, 'easeInOut']]);
    s.k('func2', 'transform.x', [[2000, 430, 'hold'], [4800, -40, 'easeInOut']]);
    s.act('func1', 'walk', 2500, { dur: 2300 }); s.act('func2', 'walk', 2500, { dur: 2300 });
    s.cam0({ x: 150, y: 140, zoom: 1.2 }); s.cam(0, { x: 120, y: 150, zoom: 1.25 }, 6000, 'linear');
    s.dur(6400);
  });
  B.shot('Instalação: plantam a placa ao lado do buraco', 'rua', 5200, (s) => {
    base(s);
    s.actor('mot', 'motorista', { x: -560, y: 450, scale: 0.7, look: 'func1', ex: 'worried' });
    s.prop('placa', 'obj_placa_buraco', { x: 90, y: 480, scale: 0.7, noShadow: true });
    s.shape('papel', 'rect', { x: 90, y: 480 - 330 * 0.7, w: 440 * 0.7 * 1.06, h: 300 * 0.7 * 1.1, fill: '#b08a5e', sw: 4 });
    s.shape('papel-fita', 'rect', { x: 90, y: 480 - 330 * 0.7, w: 440 * 0.7 * 1.06, h: 14, fill: '#e9e4d8', sw: 0 });
    s.group('Placa', ['placa', 'papel', 'papel-fita'], { x: 0, y: 0 });
    s.actor('func1', 'func1', { x: -240, y: 545, scale: 0.6, look: { x: 150, y: 400 }, ex: 'tired' });
    s.actor('func2', 'func2', { x: 430, y: 550, scale: 0.6, look: 'func1', ex: 'bored' });
    // sobe do chão: enfiam o poste
    s.k('Placa', 'transform.y', [[0, -90, 'hold'], [900, -90, 'linear'], [1300, 0, 'bounceOut']]);
    puff(s, 'terra1', 90, 478, 1250, { size: 100, rise: 70, dx: -30 }); puff(s, 'terra2', 110, 480, 1350, { size: 80, rise: 60, dx: 40 });
    s.act('func1', 'pick', 800, { dur: 900, side: 'R' }); s.act('func2', 'pick', 900, { dur: 900, side: 'L' });
    s.act('func1', 'gesture', 2800, { dur: 1200, side: 'L', intensity: 0.5 });
    s.cam0({ x: 60, y: 200, zoom: 1.35 }); s.cam(0, { x: 80, y: 190, zoom: 1.4 }, 5000, 'linear');
    s.dur(5200);
  });
  B.shot('A placa é revelada: ATENÇÃO: BURACO', 'rua', 6600, (s) => {
    base(s);
    s.actor('mot', 'motorista', { x: -560, y: 450, scale: 0.7, look: { x: 90, y: 330 }, ex: 'confused' });
    s.prop('placa', 'obj_placa_buraco', { x: 90, y: 480, scale: 0.7, noShadow: true });
    s.shape('papel', 'rect', { x: 90, y: 480 - 330 * 0.7, w: 440 * 0.7 * 1.06, h: 300 * 0.7 * 1.1, fill: '#b08a5e', sw: 4 });
    s.group('Placa', ['placa', 'papel'], { x: 0, y: 0 });
    s.actor('func1', 'func1', { x: -240, y: 545, scale: 0.6, look: 'func2', ex: 'proud' });
    s.actor('func2', 'func2', { x: 430, y: 550, scale: 0.6, look: 'func1', ex: 'proud' });
    // func1 puxa o papel: ele voa para a esquerda, girando
    s.k('papel', 'transform.x', [[0, 90, 'hold'], [1200, 90, 'linear'], [1900, -110, 'easeIn'], [2300, -320, 'easeIn']]);
    s.k('papel', 'transform.rotationDeg', [[1200, 0, 'linear'], [2300, -40, 'easeIn']]);
    s.k('papel', 'opacity', [[0, 1, 'hold'], [1800, 1, 'linear'], [2300, 0, 'easeIn']]);
    s.act('func1', 'gesture', 1000, { dur: 900, side: 'L', intensity: 1 });
    s.cam0({ x: 0, y: 220, zoom: 1.2 }); s.cam(1200, { x: 90, y: 230, zoom: 1.45 }, 1800, 'easeInOut'); s.cam(4300, { x: 0, y: 230, zoom: 1.2 }, 1500, 'easeInOut');
    s.dur(6600);
  });
  const fim = (s: Shot, mex = 'confused') => {
    base(s);
    s.prop('placa', 'obj_placa_buraco', { x: 90, y: 480, scale: 0.7, noShadow: true });
    s.actor('mot', 'motorista', { x: -560, y: 450, scale: 0.7, look: 'func1', ex: mex });
    s.actor('func1', 'func1', { x: -240, y: 545, scale: 0.6, look: 'mot', ex: 'proud' });
    s.actor('func2', 'func2', { x: 430, y: 550, scale: 0.6, look: 'mot', ex: 'proud' });
  };
  convo(B, 'Motorista: "Por que não taparam o buraco?"', 'rua', (s) => fim(s, 'angry'), ['two', ['mot', 'func1'], { zoom: 1.15, dy: 20 }], [
    ['mot', 'Mas... vocês não vão tapar o buraco?', { ex: 'confused', g: 'point', side: 'R', dur: 3000 }],
  ], { pad: 200 });
  convo(B, 'Funcionário: "Agora ninguém pode dizer que a prefeitura não avisou"', 'rua', (s) => fim(s, 'angry'), ['medium', 'func1', { dx: 60 }], [
    ['func1', 'Agora ninguém pode dizer que a prefeitura não avisou.', { ex: 'proud', g: 'shrug', dur: 4000 }],
  ], { extra: (s) => s.look('func1', 0, 'mot'), pad: 600 });
  B.shot('Os funcionários vão embora', 'rua', 5400, (s) => {
    base(s);
    s.prop('placa', 'obj_placa_buraco', { x: 90, y: 480, scale: 0.7, noShadow: true });
    s.actor('mot', 'motorista', { x: -560, y: 450, scale: 0.7, look: 'func1', ex: 'angry' });
    s.actor('func1', 'func1', { x: -240, y: 545, scale: 0.6, look: { x: 700, y: 400 }, ex: 'bored' });
    s.actor('func2', 'func2', { x: 430, y: 550, scale: 0.6, look: { x: 700, y: 400 }, ex: 'bored' });
    s.walk('func1', 300, -240, 520, { dur: 2300 }); s.walk('func2', 300, 430, 640, { dur: 1100 });
    const tv = vehicle(s, 'Caminhão', 'truck', { x: 560, y: 505, gs: 0.8 });
    drive(s, tv, 2800, 5200, 560, 1700, { ease: 'in', steps: 12 });
    s.k('func1', 'visible', [[0, true, 'hold'], [2300, false, 'hold']]); s.k('func2', 'visible', [[0, true, 'hold'], [2100, false, 'hold']]);
    s.cam0({ x: 220, y: 130, zoom: 1.15 }); s.cam(0, { x: 260, y: 130, zoom: 1.15 }, 5200, 'linear');
    s.dur(5400);
  });
  B.shot('Motorista olha a placa e o buraco', 'rua', 5600, (s) => {
    base(s);
    s.prop('placa', 'obj_placa_buraco', { x: 90, y: 480, scale: 0.7, noShadow: true });
    s.actor('mot', 'motorista', { x: -560, y: 450, scale: 0.7, look: { x: 90, y: 300 }, ex: 'neutral' });
    s.frame('two', ['mot', 'placa'], { zoom: 1.35, dy: 10 });
    s.look('mot', 2400, { x: 170, y: 395 });
    s.ex('mot', 2400, 'tired'); s.ex('mot', 3700, 'angry');
    s.say('mot', '...Filhos da puta.', { at: 3500, dur: 1900, ex: 'angry', g: 'none' });
    s.cam(0, { x: -90, y: 230, zoom: 1.45 }, 5400, 'linear');
    s.dur(5600);
  });
  B.shot('Corte seco para preto', 'neutro', 1500, (s) => {
    s.shape('preto', 'rect', { x: 0, y: 0, w: 4000, h: 2400, fill: '#000000', sw: 0 });
    s.dur(1500);
  });
}
