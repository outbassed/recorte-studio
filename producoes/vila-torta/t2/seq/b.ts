/** S4 A cidade se prepara · S5 A discussão sobre Lon Ruan · S6 O show começa · S7 O fiscal quer interromper */
import type { Builder, Shot } from '../../lib';
import { convo } from '../../seq/common';
import { A, H } from './util';
import { norb } from './a';

type K = 'rafa' | 'bia' | 'caique' | 'samuca' | 'lari';
const ALL: K[] = ['caique', 'rafa', 'bia', 'lari', 'samuca'];

/** Raios de luz do palco, pulsando no ritmo (92 bpm ≈ 652 ms por tempo). */
function raios(s: Shot, x: number, y: number, t0: number, t1: number, o: { freeze?: number } = {}) {
  const cols = ['#ff4fa3', '#4fd1ff', '#ffe14f'];
  cols.forEach((c, i) => {
    const k = `raio${i}`;
    s.shape(k, 'triangle', { x: x + (i - 1) * 260, y, w: 340, h: 760, fill: c, sw: 0, opacity: 0.22, rot: (i - 1) * 16, pivot: [0, -380] });
    const keys: Array<[number, number, 'easeInOut']> = []; const rk: Array<[number, number, 'easeInOut']> = [];
    const end = o.freeze ?? t1;
    for (let t = t0, n = 0; t < end; t += 326, n++) { keys.push([t, n % 2 ? 0.12 : 0.34, 'easeInOut']); rk.push([t, (i - 1) * 16 + (n % 2 ? -9 : 9), 'easeInOut']); }
    if (keys.length) { s.k(k, 'opacity', keys); s.k(k, 'transform.rotationDeg', rk); }
    if (o.freeze !== undefined) s.k(k, 'opacity', [[o.freeze, 0.22, 'hold'], [o.freeze + 150, 0.0, 'hold'], [o.freeze + 300, 0.3, 'hold'], [o.freeze + 450, 0.0, 'hold'], [o.freeze + 700, 0.1, 'hold']]);
  });
}
const quica = (s: Shot, k: string, t0: number, t1: number, amp = 14) => { const ks: Array<[number, number, 'easeInOut']> = []; for (let t = t0, n = 0; t < t1; t += 326, n++) ks.push([t, n % 2 ? 0 : amp, 'easeInOut']); if (ks.length) s.k(k, 'rig.bodyY', ks); };

/* ------------------------------- S4: A CIDADE SE PREPARA ------------------------------- */
const PT = { caique: [-300, 450, 0.68], rafa: [-120, 425, 0.66], bia: [60, 452, 0.68], lari: [230, 430, 0.66], samuca: [400, 446, 0.66] } as Record<K, [number, number, number]>;
function praca4(s: Shot, ks: K[], o: { fiscal?: number; ing?: boolean; look?: Partial<Record<K, string>>; ex?: Partial<Record<K, string>> } = {}) {
  s.prop('palco', 'obj_palco', { x: 330, y: 300, scale: 0.55, noShadow: true, bottom: true });
  s.prop('coreto', 'obj_coreto', { x: -520, y: 220, scale: 0.5, noShadow: true, bottom: true });
  s.prop('barraca', 'obj_barraca_hotdog', { x: -700, y: 330, scale: 0.6 });
  s.prop('caixa1', 'obj_caixa_som', { x: -80, y: 330, scale: 0.42 });
  A(s, 'vend', -610, 350, 0.55, 'fiscal', 'neutral', { who: 'vendedor' });
  A(s, 'ambul', -800, 350, 0.55, 'vend', 'neutral', { who: 'e4', shirt: '#d63b3b' });
  if (o.fiscal !== undefined) norb(s, o.fiscal, 360, 0.6, 'angry');
  for (const k of ks) A(s, k, PT[k][0], PT[k][1], PT[k][2], o.look?.[k] ?? 'fiscal', o.ex?.[k] ?? 'neutral');
  if (o.ing !== false) for (const k of ks) H(s, `ing-${k}`, 'obj_ingresso', `${k}:R`, 0.2);
}
export function seqB4(B: Builder) {
  B.seq = 'S4 · A cidade se prepara';
  B.shot('Praça do Coreto: montagem do palco (panorâmica)', 'pracaTarde', 7200, (s) => {
    s.prop('palco', 'obj_palco', { x: 330, y: 300, scale: 0.55, noShadow: true, bottom: true });
    s.prop('coreto', 'obj_coreto', { x: -520, y: 220, scale: 0.5, noShadow: true, bottom: true });
    s.prop('barraca', 'obj_barraca_hotdog', { x: -700, y: 330, scale: 0.6 });
    s.prop('faixa', 'obj_faixa_show', { x: 330, y: 20, scale: 0.7, noShadow: true });
    s.prop('caixa1', 'obj_caixa_som', { x: -80, y: 330, scale: 0.42 }); s.prop('caixa2', 'obj_caixa_som', { x: 760, y: 330, scale: 0.42 });
    A(s, 'vend', -610, 350, 0.55, 'ambul', 'happy', { who: 'vendedor' });
    A(s, 'ambul', -800, 350, 0.55, 'vend', 'neutral', { who: 'e4', shirt: '#d63b3b' });
    A(s, 'op1', 520, 380, 0.52, 'palco', 'tired', { who: 'e2', shirt: '#14141c' }); A(s, 'op2', 640, 395, 0.52, 'op1', 'neutral', { who: 'e6', shirt: '#14141c' });
    s.act('op1', 'pick', 900, { dur: 900, side: 'R' }); s.act('op2', 'point', 1400, { dur: 1200, side: 'L' }); s.act('op1', 'gesture', 3200, { dur: 1600, side: 'R', intensity: 0.5 });
    // fila se formando
    A(s, 'f1', -1300, 420, 0.55, { x: 900, y: 300 }, 'excited', { who: 'e1', shirt: '#7b2fbf' }); s.walk('f1', 600, -1300, -240, { dur: 5500 });
    A(s, 'f2', -1500, 440, 0.55, { x: 900, y: 300 }, 'happy', { who: 'e3', shirt: '#c2185b' }); s.walk('f2', 900, -1500, -340, { dur: 5600 });
    A(s, 'f3', 1300, 430, 0.55, { x: -900, y: 300 }, 'happy', { who: 'e5', shirt: '#14081f' }); s.walk('f3', 300, 1300, 140, { dur: 5800 });
    s.snd('rua', 0, 0.35, { dur: 6000 });
    s.cam0({ x: -520, y: 60, zoom: 1.15 }); s.cam(0, { x: 560, zoom: 1.15 }, 7000, 'easeInOut');
    s.dur(7200);
  });
  B.shot('Detalhe: trabalhadores instalam as luzes', 'pracaTarde', 3600, (s) => {
    s.prop('palco', 'obj_palco', { x: 0, y: 560, scale: 1.1, noShadow: true });
    A(s, 'op1', -230, 500, 0.8, { x: -400, y: 130 }, 'tired', { who: 'e2', shirt: '#14141c' });
    s.act('op1', 'gesture', 300, { dur: 2600, side: 'L', intensity: 0.8 });
    s.shape('luz', 'ellipse', { x: -600, y: -130, w: 80, h: 80, fill: '#ff4fa3', sw: 0, opacity: 0 });
    s.k('luz', 'opacity', [[0, 0, 'hold'], [1800, 0.9, 'hold'], [2200, 0.2, 'hold'], [2500, 0.9, 'hold']]);
    s.cam0({ x: -200, y: 100, zoom: 1.2 }); s.cam(0, { x: -360, y: 50, zoom: 1.6 }, 3500, 'easeInOut');
    s.dur(3600);
  });
  convo(B, 'Fiscal reclama da fila e das barracas', 'pracaTarde', (s) => praca4(s, [], { fiscal: 300 }), ['two', ['fiscal', 'vend'], { dx: -120 }], [
    ['fiscal', 'Essa fila está três centímetros fora do alinhamento regulamentar!', { ex: 'angry', g: 'point', side: 'R', style: 'shout', dur: 4600 }],
    ['vend', 'Regulamentar de onde?', { ex: 'suspicious', g: 'none', dur: 1900 }],
    ['fiscal', 'Do regulamento!', { ex: 'angry', g: 'gesture', side: 'R', style: 'shout', dur: 1800 }],
  ], { extra: (s) => { s.look('fiscal', 0, 'vend'); s.look('vend', 0, 'fiscal'); s.snd('apito', 5200, 0.5); } });
  B.shot('O fiscal mede o tamanho de um cartaz', 'pracaTarde', 4200, (s) => {
    praca4(s, [], { fiscal: 300 });
    s.prop('cartaz', 'obj_cartaz_show', { x: 40, y: 380, scale: 0.5 }); s.prop('fita', 'obj_fita_metrica', { x: 0, y: 0, scale: 0.6, held: 'fiscal:R', noShadow: true });
    s.look('fiscal', 0, 'cartaz'); s.act('fiscal', 'point', 500, { dur: 1400, side: 'R' }); s.act('fiscal', 'gesture', 2200, { dur: 1600, side: 'R', intensity: 0.5 });
    s.say('fiscal', 'Oitenta e dois... e meio. ISSO AQUI NÃO PODE!', { at: 1600, dur: 2400, g: 'none', ex: 'angry' });
    s.frame('two', ['fiscal', 'cartaz'], { zoom: 1.3 });
    s.dur(4200);
  });
  B.shot('Caíque e os amigos chegam; Caíque vê o fiscal', 'pracaTarde', 5200, (s) => {
    praca4(s, [], { fiscal: 300 });
    const sp: Array<[K, number]> = [['caique', -300], ['rafa', -120], ['bia', 60], ['lari', 230], ['samuca', 400]];
    sp.forEach(([k, x], i) => { A(s, k, x - 1200, PT[k][1], PT[k][2], 'fiscal', 'neutral'); H(s, `ing-${k}`, 'obj_ingresso', `${k}:R`, 0.2); s.walk(k, i * 120, x - 1200, x, { dur: 3500 }); });
    s.ex('caique', 3000, 'tired'); s.look('caique', 3000, 'fiscal');
    s.say('caique', 'Puta que pariu, é aquele velho de novo.', { at: 3300, dur: 2200, g: 'none', ex: 'disgusted' });
    s.cam0({ x: -500, y: 80, zoom: 1.15 }); s.cam(0, { x: -50, zoom: 1.15 }, 4500, 'easeInOut');
    s.dur(5400);
  });
  convo(B, 'Fiscal: "Mostre seu ingresso!"', 'pracaTarde', (s) => praca4(s, ALL, { fiscal: 20, look: { caique: 'fiscal' } }), ['two', ['fiscal', 'caique'], { dx: -100 }], [
    ['fiscal', 'VOCÊ! Mostre seu ingresso!', { ex: 'angry', g: 'point', side: 'L', style: 'shout', dur: 2100 }],
    ['caique', 'Tá aqui.', { ex: 'bored', g: 'hold', side: 'R', dur: 1100 }],
  ], { extra: (s) => { s.look('fiscal', 0, 'caique'); s.act('caique', 'hold', 2400, { dur: 900, side: 'R' }); } });
  B.shot('Detalhe: os cinco ingressos válidos de R$ 100', 'neutro', 4000, (s) => {
    s.shape('fundo', 'rect', { x: 0, y: 0, w: 2400, h: 1300, fill: '#4a3a66', sw: 0, bottom: true });
    [-540, -270, 0, 270, 540].forEach((x, i) => s.prop(`t${i}`, 'obj_ingresso', { x, y: 250 + (i % 2) * 60, scale: 0.62, noShadow: true, rot: (i - 2) * 5 }));
    ['CAÍQUE', 'RAFA', 'BIA', 'LARI', 'SAMUCA'].forEach((n, i) => s.text(`n${i}`, n, { x: [-540, -270, 0, 270, 540][i]!, y: 340 + (i % 2) * 60, size: 34, color: '#fff7e6', sw: 6 }));
    s.cam0({ x: 0, y: 190, zoom: 1.0 }); s.cam(0, { x: 60, y: 190, zoom: 1.1 }, 3900, 'linear');
    s.dur(4000);
  });
  convo(B, 'Fiscal: "E a autorização para portar esse ingresso?"', 'pracaTarde', (s) => praca4(s, ALL, { fiscal: 20 }), ['two', ['fiscal', 'caique'], { dx: -100 }], [
    ['fiscal', 'E a autorização para portar esse ingresso?', { ex: 'proud', g: 'gesture', side: 'L', dur: 3000 }],
  ], { extra: (s) => { s.look('fiscal', 0, 'caique'); s.ex('caique', 0, 'confused'); }, pad: 700 });
  convo(B, 'Caíque: "A autorização pra quê, caralho?!"', 'pracaTarde', (s) => praca4(s, ALL, { fiscal: 20 }), ['close', 'caique'], [
    ['caique', 'A AUTORIZAÇÃO PRA QUÊ, CARALHO?!', { ex: 'angry', g: 'none', style: 'shout', dur: 2700 }],
  ], { extra: (s) => { s.look('caique', 0, 'fiscal'); s.fx('shake', 250, 600, 0.5); } });
  convo(B, 'Rafael intervém', 'pracaTarde', (s) => praca4(s, ALL, { fiscal: 20 }), ['two', ['rafa', 'caique'], { dx: -60 }], [
    ['rafa', 'Calma, Caíque. Respira. A gente já vai entrar.', { ex: 'tired', g: 'hold', side: 'L', dur: 3300 }],
    ['rafa', 'Desculpa, seu Norberto, ele tá ansioso com o show.', { ex: 'worried', g: 'shrug', dur: 3500 }],
  ], { extra: (s) => { s.look('rafa', 0, 'caique'); s.look('caique', 0, 'fiscal'); s.act('rafa', 'hold', 200, { dur: 1200, side: 'L' }); } });
  convo(B, 'O fiscal anota algo na prancheta', 'pracaTarde', (s) => praca4(s, ALL, { fiscal: 20 }), ['medium', 'fiscal', { dx: -60 }], [
    ['fiscal', 'Vou registrar essa insolência. Vocês estão sendo observados.', { ex: 'proud', g: 'point', side: 'R', dur: 4200 }],
  ], { extra: (s) => s.look('fiscal', 0, 'caique') });
}

/* ------------------------------- S5: A DISCUSSÃO SOBRE LON RUAN ------------------------------- */
const ENT = 'pracaTarde';
function entrada(s: Shot, ks: K[], o: { ex?: Partial<Record<K, string>>; look?: Partial<Record<K, string>> } = {}) {
  s.prop('palco', 'obj_palco', { x: 560, y: 300, scale: 0.5, noShadow: true, bottom: true });
  s.prop('faixa', 'obj_faixa_show', { x: -100, y: -40, scale: 0.9, noShadow: true });
  s.prop('cartaz', 'obj_cartaz_show', { x: -620, y: 340, scale: 0.55 });
  A(s, 'fa', -140, 350, 0.62, 'morador', 'excited', { who: 'e5', shirt: '#7b2fbf' });
  A(s, 'morador', 20, 352, 0.62, 'fa', 'angry', { who: 'e2', shirt: '#6b7580' });
  const P: Record<K, [number, number, number]> = { caique: [-300, 450, 0.7], rafa: [-80, 462, 0.68], bia: [170, 452, 0.68], lari: [340, 438, 0.66], samuca: [500, 448, 0.66] };
  for (const k of ks) A(s, k, P[k][0], P[k][1], P[k][2], o.look?.[k] ?? 'morador', o.ex?.[k] ?? 'neutral');
}
export function seqB5(B: Builder) {
  B.seq = 'S5 · A discussão sobre Lon Ruan';
  convo(B, 'Um fã defende o cantor', ENT, (s) => entrada(s, ALL), ['two', ['fa', 'morador']], [
    ['fa', 'O Lon Ruan é injustiçado! Ele só fala o que o povo sente!', { ex: 'excited', g: 'gesture', style: 'shout', dur: 4000 }],
    ['morador', 'O que o povo sente? A minha família sofreu com o Zé Lorrota. Não tem graça glorificar esse tipo de gente.', { ex: 'angry', g: 'point', side: 'R', dur: 6200 }],
  ], { extra: (s) => { s.look('fa', 0, 'morador'); s.look('morador', 0, 'fa'); } });
  convo(B, 'Caíque defende o ídolo', ENT, (s) => entrada(s, ALL), ['close', 'caique'], [
    ['caique', 'O cara só tá fazendo música, porra!', { ex: 'angry', g: 'none', style: 'shout', dur: 2600 }],
  ], { extra: (s) => s.look('caique', 0, 'morador') });
  convo(B, 'Morador: "Fácil falar quando não foi sua família"', ENT, (s) => entrada(s, ALL), ['medium', 'morador', { dx: -120 }], [
    ['morador', 'Fácil falar quando não foi sua família que sofreu.', { ex: 'sad', g: 'none', dur: 3300 }],
  ], { extra: (s) => s.look('morador', 0, 'caique'), pad: 500 });
  B.shot('Caíque perde o sorriso', ENT, 3600, (s) => {
    entrada(s, ALL, { ex: { caique: 'happy', rafa: 'neutral' }, look: { caique: 'morador', rafa: 'caique' } });
    s.frame('close', ['caique']); s.ex('caique', 800, 'worried'); s.ex('caique', 1500, 'sad'); s.look('caique', 1500, { x: -300, y: 600 });
    s.cam(0, { zoom: 2.3 }, 3500, 'linear');
    s.dur(3600);
  });
  B.shot('Rafael percebe a mudança', ENT, 2400, (s) => {
    entrada(s, ALL, { look: { rafa: 'caique' } }); s.frame('close', ['rafa']); s.ex('rafa', 0, 'worried'); s.ex('rafa', 1200, 'thinking');
    s.dur(2400);
  });
  convo(B, 'Rafael: "Não precisa gostar da polícia..."', ENT, (s) => entrada(s, ALL, { look: { rafa: 'caique' } }), ['two', ['rafa', 'caique'], { dx: -30 }], [
    ['rafa', 'Não precisa gostar da polícia pra achar errado elogiar um criminoso.', { ex: 'thinking', g: 'none', dur: 4700 }],
    ['caique', 'Vocês querem transformar tudo numa discussão!', { ex: 'angry', g: 'gesture', side: 'R', dur: 3200 }],
  ], { extra: (s) => { s.look('caique', 0, 'rafa'); } });
  convo(B, 'Bia: "Foi VOCÊ que começou a discutir!"', ENT, (s) => entrada(s, ALL, { look: { bia: 'caique' } }), ['close', 'bia'], [
    ['bia', 'Foi VOCÊ que começou a discutir!', { ex: 'angry', g: 'none', style: 'shout', dur: 2400 }],
  ], { extra: (s) => s.look('bia', 0, 'caique'), pad: 400 });
  convo(B, 'Larissa tenta encerrar o assunto', ENT, (s) => entrada(s, ALL, { look: { lari: 'caique' } }), ['medium', 'lari', { dx: 80 }], [
    ['lari', 'Gente, calma. A gente veio pra se divertir, não pra brigar.', { ex: 'worried', g: 'hold', side: 'L', dur: 3800 }],
  ], { extra: (s) => s.act('lari', 'hold', 300, { dur: 1500, side: 'L' }) });
  convo(B, 'Samuca: "O show já vai começar?"', ENT, (s) => entrada(s, ALL, { look: { samuca: 'palco' as never } }), ['medium', 'samuca', { dx: 120 }], [
    ['samuca', 'Gente... o show já vai começar?', { ex: 'thinking', g: 'point', side: 'R', dur: 2500 }],
  ], { extra: (s) => { s.ex('samuca', 0, 'happy'); s.look('samuca', 0, 'palco'); }, pad: 600 });
  B.shot('Tensão: olhares entre fãs e moradores', ENT, 3200, (s) => {
    entrada(s, ALL, { ex: { caique: 'angry', bia: 'irritated', rafa: 'worried', lari: 'worried', samuca: 'happy' }, look: { caique: 'morador', bia: 'caique', rafa: 'caique', lari: 'morador' } });
    s.ex('fa', 0, 'angry'); s.ex('morador', 0, 'sad'); s.look('fa', 0, 'morador'); s.look('morador', 0, { x: -500, y: 400 });
    s.cam0({ x: 60, y: 60, zoom: 1.1 }); s.cam(0, { x: -40, zoom: 1.35 }, 3000, 'easeInOut');
    s.dur(3200);
  });
}

/* ------------------------------- S6: O SHOW COMEÇA ------------------------------- */
const NIGHT = 'pracaNoite';
const PL: Record<K, [number, number, number]> = { caique: [-230, 520, 0.72], bia: [-50, 500, 0.7], rafa: [120, 480, 0.68], lari: [300, 505, 0.7], samuca: [-420, 485, 0.68] };
export function show(s: Shot, ks: K[], o: { lon?: number | false; lonPose?: string; ex?: Partial<Record<K, string>>; look?: Partial<Record<K, string>>; t0?: number; t1?: number; lights?: boolean; freeze?: number } = {}) {
  s.prop('palco', 'obj_palco', { x: 0, y: 190, scale: 0.92, noShadow: true });
  s.prop('caixaE', 'obj_caixa_som', { x: -760, y: 240, scale: 0.6, noShadow: true }); s.prop('caixaD', 'obj_caixa_som', { x: 760, y: 240, scale: 0.6, noShadow: true });
  if (o.lights !== false) raios(s, 0, -150, o.t0 ?? 0, o.t1 ?? 6000, { freeze: o.freeze });
  if (o.lon !== false) A(s, 'lon', typeof o.lon === 'number' ? o.lon : 0, 75, 0.56, 'cam', 'excited', { who: 'lon', pose: o.lonPose });
  const fans: Array<[string, 'e1' | 'e3' | 'e5' | 'e6', number, number, string]> = [['p1', 'e1', -650, 540, '#7b2fbf'], ['p2', 'e3', -120, 548, '#c2185b'], ['p3', 'e5', 430, 545, '#14081f'], ['p4', 'e6', 640, 535, '#f2c95c']];
  for (const [k, w, x, y, c] of fans) { A(s, k, x, y, 0.64, 'lon', 'excited', { who: w, shirt: c, pose: 'hands-up' }); }
  for (const k of ks) A(s, k, PL[k][0], PL[k][1], PL[k][2], o.look?.[k] ?? 'lon', o.ex?.[k] ?? 'excited');
  for (const f of ['p1', 'p2', 'p3', 'p4']) quica(s, f, o.t0 ?? 0, Math.min(o.t1 ?? 4000, 4800), 10);
}
const LIRICA = ['♪ Zé Lorrota é o chefe, ninguém segura! ♪', '♪ A polícia vem na pista, mas só chega na procissão! ♪', '♪ Hoje a noite é nossa, Vila Torta no refrão! ♪'];
export function seqB6(B: Builder) {
  B.seq = 'S6 · O show começa';
  B.shot('Show: a plateia espera, o telão acende (plano geral)', NIGHT, 5200, (s) => {
    show(s, ALL, { lon: false, t0: 1800, t1: 5200 });
    s.cam0({ x: 0, y: 140, zoom: 1.35 }); s.cam(0, { x: 0, y: 40, zoom: 1.0 }, 5000, 'easeInOut');
    s.snd('gritaria', 3200, 0.5);
    s.dur(5200);
  });
  B.shot('Entrada de Lon Ruan no palco', NIGHT, 5800, (s) => {
    show(s, ALL, { lon: false, t0: 0, t1: 5800 });
    A(s, 'lon', 700, 75, 0.56, 'cam', 'excited', { who: 'lon' }); H(s, 'mic', 'microphone', 'lon:R', 0.7);
    s.walk('lon', 400, 700, 0, { dur: 2600 });
    s.say('lon', 'BOA NOITE, VILA TORTAAAA!', { at: 3200, dur: 2400, g: 'gesture', style: 'shout', ex: 'laughing' });
    s.snd('gritaria', 3000, 0.7); s.fx('flash', 3050, 220, 0.5);
    s.cam0({ x: 150, y: 90, zoom: 1.3 }); s.cam(0, { x: 0, y: 90, zoom: 1.25 }, 5500, 'easeInOut');
    s.dur(5800);
  });
  convo(B, 'Caíque: "É ELE! É ELE, PORRA!"', NIGHT, (s) => { show(s, ALL, { t0: 0, t1: 2800 }); s.snd('gritaria', 0, 0.5); }, ['close', 'caique'], [
    ['caique', 'É ELE! É ELE, PORRA!', { ex: 'excited', g: 'none', style: 'shout', dur: 2200 }],
  ], { extra: (s) => { s.look('caique', 0, 'lon'); s.act('caique', 'jump', 300, { dur: 800, intensity: 0.5 }); } });
  convo(B, 'Bia protege os ouvidos', NIGHT, (s) => { show(s, ALL, { ex: { bia: 'irritated' }, look: { bia: 'caique' }, t0: 0, t1: 3000 }); }, ['close', 'bia'], [
    ['bia', 'EU TÔ DO TEU LADO, IDIOTA!', { ex: 'angry', g: 'none', style: 'shout', dur: 2400 }],
  ], { extra: (s) => { s.look('bia', 0, 'caique'); s.k('bia', 'rig.armLUpper', [[0, 0, 'linear'], [400, 150, 'easeOut']]); s.k('bia', 'rig.armLLower', [[0, 0, 'linear'], [400, 140, 'easeOut']]); s.k('bia', 'rig.armRUpper', [[0, 0, 'linear'], [400, 150, 'easeOut']]); s.k('bia', 'rig.armRLower', [[0, 0, 'linear'], [400, 140, 'easeOut']]); } });
  const verso = (n: number, name: string, fr: Parameters<typeof convo>[4]) => convo(B, name, NIGHT, (s) => { show(s, ALL, { t0: 0, t1: 4600, ex: { caique: 'excited' } }); }, fr, [
    ['lon', LIRICA[n]!, { ex: 'excited', g: 'gesture', side: n % 2 ? 'L' : 'R', dur: 4200 }],
  ], { extra: (s) => { if (n === 1) s.k('lon', 'rig.torsoLean', [[0, 0, 'linear'], [600, 8, 'easeInOut'], [1500, -6, 'easeInOut'], [2600, 6, 'easeInOut']]); } });
  verso(0, 'Lon Ruan, verso 1: Zé Lorrota é o chefe', ['medium', 'lon', { dy: 30 }]);
  convo(B, 'Caíque canta junto', NIGHT, (s) => { show(s, ALL, { t0: 0, t1: 4000 }); }, ['close', 'caique'], [
    ['caique', '♪ Zé Lorrota é o chefe, ninguém segura! ♪', { ex: 'laughing', g: 'none', dur: 3800 }],
  ], { extra: (s) => { s.look('caique', 0, 'lon'); s.k('caique', 'rig.headNod', [[0, 0, 'linear'], [326, 8, 'easeInOut'], [652, 0, 'easeInOut'], [978, 8, 'easeInOut'], [1304, 0, 'easeInOut'], [1630, 8, 'easeInOut'], [1956, 0, 'easeInOut'], [2282, 8, 'easeInOut'], [2608, 0, 'easeInOut'], [2934, 8, 'easeInOut'], [3260, 0, 'easeInOut']]); } });
  convo(B, 'Rafael e Bia notam a letra', NIGHT, (s) => { show(s, ALL, { t0: 0, t1: 5000, ex: { bia: 'confused', rafa: 'worried' }, look: { bia: 'rafa', rafa: 'lon' } }); }, ['two', ['rafa', 'bia'], { dx: -30 }], [
    ['bia', 'Peraí... ele tá elogiando o Zé Lorrota?', { ex: 'confused', g: 'point', side: 'R', dur: 3100 }],
    ['rafa', 'E xingando a polícia. Em cima de um palco, com a praça lotada.', { ex: 'worried', g: 'none', dur: 3800 }],
  ]);
  verso(1, 'Lon Ruan, verso 2: a polícia só chega na procissão', ['medium', 'lon', { dx: 60, dy: 30 }]);
  B.shot('Reações da plateia ao verso (fãs vibram, moradores se afastam)', NIGHT, 5200, (s) => {
    show(s, ALL, { t0: 0, t1: 4800, ex: { lari: 'worried', bia: 'disgusted', rafa: 'worried', caique: 'excited' } });
    A(s, 'mor1', -820, 540, 0.62, { x: -1200, y: 500 }, 'sad', { who: 'e2', shirt: '#6b7580' }); s.walk('mor1', 900, -820, -1300, { dur: 3800, speed: 0.8 });
    s.look('lari', 0, 'mor1'); s.snd('gritaria', 300, 0.4);
    s.cam0({ x: -100, y: 190, zoom: 1.5 }); s.cam(0, { x: -330, zoom: 1.7 }, 5000, 'easeInOut');
    s.dur(5200);
  });
  convo(B, 'Larissa observa o desconforto de parte do público', NIGHT, (s) => { show(s, ALL, { t0: 0, t1: 4000, look: { lari: 'p3' } }); }, ['medium', 'lari', { dx: 100 }], [
    ['lari', 'Nem todo mundo tá curtindo essa parte, né?', { ex: 'worried', g: 'shrug', dur: 3000 }],
  ], { extra: (s) => s.look('lari', 0, { x: -800, y: 450 }) });
  B.shot('Samuca se distrai com o vendedor de cachorro-quente', NIGHT, 7000, (s) => {
    show(s, ['caique', 'bia', 'rafa', 'lari'], { t0: 0, t1: 5000 });
    s.prop('hotdog', 'obj_barraca_hotdog', { x: 700, y: 400, scale: 0.55 }); A(s, 'vend', 760, 405, 0.55, 'samuca', 'happy', { who: 'vendedor' });
    A(s, 'samuca', -420, 485, 0.68, 'vend', 'excited'); s.walk('samuca', 500, -420, 560, { dur: 3500 });
    s.say('samuca', 'Moço, o cachorro-quente vem com purê?', { at: 4200, dur: 2400, g: 'none', ex: 'thinking' });
    s.say('vend', 'Vem com tudo. Doze reais.', { at: 6700, dur: 1800, g: 'none', ex: 'happy' });
    s.cam0({ x: -100, y: 220, zoom: 1.3 }); s.cam(0, { x: 330, y: 280, zoom: 1.35 }, 6800, 'easeInOut');
    s.end(500);
  });
  verso(2, 'Lon Ruan, verso 3: refrão', ['medium', 'lon', { dy: 20 }]);
  B.shot('Lon Ruan domina o palco (plano aberto com mudança de enquadramento)', NIGHT, 6800, (s) => {
    show(s, ALL, { t0: 0, t1: 6800 });
    s.walk('lon', 0, 0, -380, { dur: 1800, speed: 0.8 }); s.walk('lon', 2200, -380, 380, { dur: 3000, speed: 0.8 }); s.act('lon', 'dance', 600, { dur: 5600, intensity: 0.5 }); s.snd('gritaria', 2500, 0.4);
    s.cam0({ x: 0, y: 90, zoom: 1.2 }); s.cam(0, { x: -200, y: 120, zoom: 1.35 }, 2200, 'easeInOut'); s.cam(2300, { x: 220, y: 120, zoom: 1.35 }, 3000, 'easeInOut');
    s.dur(6800);
  });
}

/* ------------------------------- S7: O FISCAL QUER INTERROMPER ------------------------------- */
function barreira(s: Shot) {
  s.prop('palco', 'obj_palco', { x: 150, y: 250, scale: 0.7, noShadow: true, bottom: true });
  s.shape('grade', 'rect', { x: 90, y: 410, w: 900, h: 70, fill: '#8a8a99', sw: 4, radius: 8 });
  s.text('grade-txt', 'ÁREA RESTRITA', { x: 90, y: 410, size: 40, color: '#14141c', sw: 0 });
  A(s, 'seg', 120, 380, 0.7, 'fiscal', 'neutral', { who: 'seg1' }); A(s, 'seg2', 360, 385, 0.7, 'fiscal', 'neutral', { who: 'seg2' });
  A(s, 'fiscal', -330, 470, 0.62, 'seg', 'angry', { who: 'norberto' }); H(s, 'prancheta', 'book', 'fiscal:L', 0.7);
}
export function seqB7(B: Builder) {
  B.seq = 'S7 · O fiscal quer interromper';
  B.shot('Fiscal avança até o palco', NIGHT, 4200, (s) => {
    s.prop('palco', 'obj_palco', { x: 150, y: 250, scale: 0.7, noShadow: true, bottom: true });
    A(s, 'fiscal', -1000, 480, 0.62, { x: 150, y: 300 }, 'angry', { who: 'norberto' }); H(s, 'prancheta', 'book', 'fiscal:L', 0.7); H(s, 'apito', 'obj_apito', 'fiscal:R', 0.6);
    for (const [k, w, x, c] of [['p1', 'e1', -500, '#7b2fbf'], ['p2', 'e3', -260, '#c2185b'], ['p3', 'e5', 40, '#14081f']] as const) { A(s, k, x, 500, 0.62, 'lon', 'excited', { who: w, shirt: c, pose: 'hands-up' }); quica(s, k, 0, 4000, 10); }
    s.walk('fiscal', 0, -1000, -330, { dur: 3800 });
    s.say('fiscal', 'ISSO AQUI É UMA VIOLAÇÃO GRAVÍSSIMA!', { at: 2200, dur: 2000, g: 'none', style: 'shout' });
    s.cam0({ x: -500, y: 120, zoom: 1.2 }); s.cam(0, { x: -150, zoom: 1.2 }, 4000, 'easeInOut');
    s.dur(4200);
  });
  convo(B, 'Segurança: "O senhor trabalha na organização?"', NIGHT, barreira, ['two', ['seg', 'fiscal'], { dx: -60 }], [
    ['seg', 'O senhor trabalha na organização?', { ex: 'suspicious', g: 'none', dur: 2500 }],
    ['fiscal', 'EU SOU O FISCAL DA RUA!', { ex: 'proud', g: 'gesture', side: 'R', style: 'shout', dur: 2200 }],
    ['seg', 'Que rua?', { ex: 'confused', g: 'none', dur: 1000 }],
    ['fiscal', 'DE TODAS!', { ex: 'angry', g: 'point', side: 'R', style: 'shout', dur: 1300 }],
  ], { extra: (s) => { s.look('seg', 0, 'fiscal'); s.look('fiscal', 0, 'seg'); s.snd('apito', 5200, 0.5); } });
  convo(B, 'Segurança pede a identificação oficial', NIGHT, barreira, ['medium', 'seg', { dx: -80 }], [
    ['seg', 'Preciso da sua identificação oficial.', { ex: 'bored', g: 'hold', side: 'R', dur: 2900 }],
  ], { extra: (s) => s.look('seg', 0, 'fiscal') });
  B.shot('Fiscal mostra o crachá improvisado', NIGHT, 4000, (s) => {
    barreira(s); s.prop('cracha', 'obj_cracha', { x: 0, y: 0, scale: 0.2, held: 'fiscal:R', noShadow: true });
    s.act('fiscal', 'hold', 300, { dur: 2600, side: 'R' }); s.look('fiscal', 0, 'seg'); s.ex('fiscal', 0, 'proud');
    s.frame('two', ['fiscal', 'seg'], { dx: -100, zoom: 1.5 });
    s.dur(4000);
  });
  convo(B, 'Segurança fica em silêncio — e pergunta da impressora', NIGHT, barreira, ['close', 'seg'], [
    ['seg', 'Isso aqui foi feito numa impressora doméstica?', { ex: 'suspicious', g: 'none', dur: 3400, gapBefore: 1600 }],
  ], { extra: (s) => { s.look('seg', 0, 'prancheta' as never); s.ex('seg', 0, 'bored'); s.ex('seg', 1500, 'suspicious'); } });
  convo(B, 'Fiscal: "A qualidade da impressão não invalida minha autoridade!"', NIGHT, barreira, ['medium', 'fiscal', { dx: -60 }], [
    ['fiscal', 'A QUALIDADE DA IMPRESSÃO NÃO INVALIDA MINHA AUTORIDADE!', { ex: 'angry', g: 'gesture', side: 'R', style: 'shout', dur: 4300 }],
  ], { extra: (s) => { s.look('fiscal', 0, 'seg'); s.fx('shake', 400, 500, 0.3); } });
  convo(B, 'Segurança manda o fiscal se afastar', NIGHT, barreira, ['two', ['seg', 'fiscal'], { dx: -60 }], [
    ['seg', 'Senhor, saia da área restrita. Agora.', { ex: 'angry', g: 'point', side: 'L', dur: 3000 }],
  ], { extra: (s) => { s.look('seg', 0, 'fiscal'); s.walk('fiscal', 1500, -330, -520, { dur: 1600, speed: 0.8 }); s.ex('fiscal', 1500, 'worried'); } });
  B.shot('Corte para a apresentação: o show continua', NIGHT, 2400, (s) => {
    show(s, ALL, { t0: 0, t1: 2400 }); s.cam0({ x: 0, y: 130, zoom: 1.25 });
    s.dur(2400);
  });
}
