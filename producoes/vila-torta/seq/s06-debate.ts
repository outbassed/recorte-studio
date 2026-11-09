/** SEQUÊNCIA 6 — O GRANDE DEBATE (estúdio × sala de Rafael e Bia, montagem dinâmica) */
import type { Builder, Shot } from '../lib';
import { convo } from './common';

const ST = 'estudio';
/** Estúdio: Gaivota SEMPRE à esquerda do quadro, Pinote à direita; apresentador ao centro, ao fundo. */
function estudio(s: Shot, ks: Array<'gaivota' | 'pinote' | 'apres'>, o: { red?: number; ex?: Record<string, string>; look?: Record<string, string> } = {}) {
  s.prop('painel', 'obj_painel_debate', { x: 0, y: 150, scale: 0.9, noShadow: true });
  const redSkin = ['#d9ab76', '#e39c78', '#e17c62', '#d65a48', '#c4382f'][Math.min(4, o.red ?? 0)]!;
  if (ks.includes('apres')) s.actor('apres', 'apresentador', { x: 0, y: 372, scale: 0.55, look: 'gaivota', ex: o.ex?.apres ?? 'neutral', skin: redSkin });
  s.prop('bancada', 'obj_bancada', { x: 0, y: 380, scale: 0.55, noShadow: true });
  if (ks.includes('gaivota')) {
    s.actor('gaivota', 'gaivota', { x: -480, y: 470, scale: 0.76, look: 'pinote', ex: o.ex?.gaivota ?? 'proud', headStrength: 0.4 });
    s.prop('pulpito-g', 'obj_pulpito_g', { x: -480, y: 470, scale: 0.85, noShadow: true });
  }
  if (ks.includes('pinote')) {
    s.actor('pinote', 'pinote', { x: 480, y: 470, scale: 0.76, look: 'gaivota', ex: o.ex?.pinote ?? 'angry', headStrength: 0.4 });
    s.prop('pulpito-p', 'obj_pulpito_p', { x: 480, y: 470, scale: 0.85, noShadow: true });
  }
  if (o.look) for (const [k, v] of Object.entries(o.look)) s.look(k, 0, v);
  // ao lado do apresentador, o microfone de mão
  if (ks.includes('apres')) s.prop('mic', 'microphone', { x: 0, y: 0, scale: 0.8, held: 'apres:R', noShadow: true });
}

const SALA = 'sala';
const SP = {
  bia: { x: 190, y: 392, scale: 0.7 }, lari: { x: 330, y: 392, scale: 0.7 }, rafa: { x: 470, y: 392, scale: 0.7 },
  caique: { x: -150, y: 410, scale: 0.7 }, samuca: { x: 10, y: 470, scale: 0.68 },
} as const;
type SK = keyof typeof SP;
/** Sala de Rafael e Bia: TV à esquerda, poltrona, sofá (três sentados) e Samuca no chão. */
export function sala(s: Shot, ks: SK[], o: { ex?: Partial<Record<SK, string>>; tv?: boolean | ((s: Shot) => void); look?: Partial<Record<SK, string>> } = {}) {
  s.prop('quadro', 'picture', { x: 330, y: 80, scale: 1.1, noShadow: true });
  s.prop('sofa', 'sofa', { x: 330, y: 445, scale: 0.9, noShadow: false });
  s.prop('poltrona', 'armchair', { x: -150, y: 440, scale: 0.8 });
  s.prop('tv-rack', 'tvstand', { x: -640, y: 440, scale: 0.9 });
  s.prop('tv', 'obj_tv', { x: -640, y: 345, scale: 0.7, noShadow: true });
  if (typeof o.tv === 'function') o.tv(s);
  else if (o.tv !== false) s.prop('tv-tela', 'obj_tv_debate', { x: -640, y: 345, scale: 0.7, noShadow: true });
  s.prop('mesinha', 'table', { x: 10, y: 470, scale: 0.35 });
  s.prop('lanche', 'mug', { x: 10, y: 430, scale: 0.7, noShadow: true });
  for (const k of ks) {
    const p = SP[k];
    s.actor(k, k, { ...p, look: o.look?.[k] ?? 'tv', ex: o.ex?.[k] ?? 'neutral', pose: k === 'samuca' ? 'crouch' : 'sit' });
  }
  // TV é um nó (para os olhares): referência pelo nome
  if (ks.includes('samuca')) s.prop('garrafa', 'obj_garrafa', { x: 0, y: 0, scale: 0.65, held: 'samuca:L', noShadow: true });
}
const SALL: SK[] = ['bia', 'lari', 'rafa', 'caique', 'samuca'];

export function seq6(B: Builder) {
  B.seq = 'S6 · O grande debate';

  B.shot('Estúdio: plano geral e abertura do debate', ST, 9800, (s) => {
    estudio(s, ['gaivota', 'pinote', 'apres']);
    s.cam0({ x: 0, y: 60, zoom: 1.0 }); s.cam(0, { x: 0, y: 150, zoom: 1.12 }, 9200, 'linear');
    s.t = 700;
    s.say('apres', 'Boa noite, Vila Torta! Começa agora o grande debate entre os candidatos à prefeitura.', { g: 'gesture', side: 'L', dur: 4800 });
    s.say('apres', 'Primeira pergunta, sobre saúde: o que cada um fará pelos hospitais da cidade?', { g: 'point', side: 'R', dur: 4400 });
    s.end(0);
  });
  convo(B, 'Gaivota: desvia e ataca o adversário', ST, (s) => estudio(s, ['gaivota', 'pinote', 'apres']), ['medium', 'gaivota', { dx: 120 }], [
    ['gaivota', 'Antes de tudo, quero agradecer ao povo. E lembrar que meu adversário é uma ameaça! Ele nunca administrou nem uma barraca de pastel!', { ex: 'proud', g: 'gesture', side: 'R', dur: 7000 }],
  ], { extra: (s) => { s.look('gaivota', 0, 'cam'); s.ex('gaivota', 3600, 'mocking'); s.cam(0, { zoom: 1.5 }, 6800, 'easeInOut'); } });
  convo(B, 'Reação do Pinote (indignado)', ST, (s) => estudio(s, ['gaivota', 'pinote', 'apres'], { ex: { pinote: 'angry' } }), ['close', 'pinote', { dy: 10 }], [], {
    dur: 1900, extra: (s) => { s.ex('pinote', 0, 'irritated'); s.ex('pinote', 700, 'angry'); s.look('pinote', 0, 'gaivota'); s.act('pinote', 'shakeHead', 500, { dur: 900, intensity: 0.5 }); },
  });

  convo(B, 'Sala: Bia nota que ninguém falou de hospital', SALA, (s) => sala(s, SALL, { ex: { bia: 'irritated', rafa: 'thinking', caique: 'mocking', lari: 'happy', samuca: 'happy' } }), ['two', ['bia', 'rafa'], { dx: 180 }], [
    ['bia', 'Ele não falou NADA sobre hospital.', { ex: 'irritated', g: 'point', side: 'R', dur: 2400 }],
    ['rafa', 'Falou de barraca de pastel.', { ex: 'thinking', g: 'none', dur: 1900 }],
    ['caique', 'Que, convenhamos, é uma gestão difícil.', { ex: 'laughing', g: 'none', dur: 2600 }],
  ]);

  convo(B, 'Pinote responde criticando os hospitais', ST, (s) => estudio(s, ['gaivota', 'pinote', 'apres']), ['medium', 'pinote', { dx: -120 }], [
    ['pinote', 'Os hospitais estão um caos! Filas, goteiras, falta de remédio! E de quem é a culpa? Dele!', { ex: 'angry', g: 'point', side: 'L', style: 'shout', dur: 6000 }],
  ], { extra: (s) => { s.look('pinote', 0, 'gaivota'); s.cam(0, { zoom: 1.55 }, 5800, 'easeInOut'); } });
  convo(B, 'Gaivota ri, desdenhoso', ST, (s) => estudio(s, ['gaivota', 'pinote', 'apres']), ['close', 'gaivota'], [], {
    dur: 1600, extra: (s) => { s.ex('gaivota', 0, 'mocking'); s.act('gaivota', 'laugh', 200, { dur: 1200, intensity: 0.5 }); s.look('gaivota', 0, 'pinote'); },
  });
  convo(B, 'Apresentador insiste na pergunta', ST, (s) => estudio(s, ['gaivota', 'pinote', 'apres'], { red: 1 }), ['medium', 'apres', { dx: 0 }], [
    ['apres', 'Perdão... mas o que o senhor pretende fazer? Eu perguntei sobre propostas.', { ex: 'worried', g: 'gesture', side: 'R', dur: 4600 }],
  ], { extra: (s) => s.look('apres', 0, 'pinote') });

  B.shot('Os dois fogem da resposta (plano aberto, dois púlpitos)', ST, 8800, (s) => {
    estudio(s, ['gaivota', 'pinote', 'apres'], { red: 1 });
    s.cam0({ x: 0, y: 130, zoom: 1.08 });
    s.t = 400;
    s.say('gaivota', 'Propostas, propostas... eu tenho um coração enorme por esta cidade!', { ex: 'proud', g: 'gesture', side: 'R', dur: 3900 });
    s.say('pinote', 'E eu tenho coragem!', { ex: 'excited', g: 'point', side: 'L', style: 'shout', dur: 1900 });
    s.t += 600;
    s.say('apres', '...Isso não é uma proposta.', { ex: 'tired', g: 'facepalm', side: 'R', dur: 2400 });
    s.cam(5600, { x: 0, y: 200, zoom: 1.45 }, 2600, 'easeInOut');
    s.dur(9000);
  });

  convo(B, 'Sala: "Nenhum dos dois responde!"', SALA, (s) => sala(s, SALL, { ex: { bia: 'angry', rafa: 'neutral', caique: 'mocking', lari: 'surprised', samuca: 'happy' } }), ['close', 'bia'], [
    ['bia', 'PUTA QUE PARIU! NENHUM DOS DOIS RESPONDE!', { ex: 'angry', g: 'none', style: 'shout', dur: 2900 }],
  ], { extra: (s) => { s.fx('shake', 300, 600, 0.4); s.k('bia', 'rig.headNod', [[300, 0, 'linear'], [500, -10, 'easeOut'], [1300, 0, 'easeInOut']]); } });
  convo(B, 'Sala: Rafael e Caíque comentam', SALA, (s) => sala(s, SALL, { look: { caique: 'tv', rafa: 'tv' } }), ['two', ['rafa', 'caique'], { dx: 90, zoom: 1.3 }], [
    ['rafa', 'É impressionante.', { ex: 'astonished', g: 'none', dur: 1800 }],
    ['caique', 'Eu tô começando a achar que eles vão se beijar.', { ex: 'mocking', g: 'none', dur: 3300 }],
  ]);
  convo(B, 'Sala: Bia reclama; Caíque provoca', SALA, (s) => sala(s, SALL, { look: { bia: 'caique', caique: 'bia' } }), ['two', ['bia', 'caique'], { dx: 20, zoom: 1.1 }], [
    ['bia', 'Credo, Caíque! Você consegue ser nojento em qualquer assunto?', { ex: 'disgusted', g: 'gesture', side: 'R', dur: 3500 }],
    ['caique', 'Pô, Bia, a tensão entre eles tá maior que entre nós dois.', { ex: 'mocking', g: 'none', dur: 3600 }],
  ]);
  convo(B, 'Bia: "Não existe tensão entre nós dois!"', SALA, (s) => sala(s, SALL, { look: { bia: 'caique', caique: 'bia' } }), ['close', 'bia'], [
    ['bia', 'NÃO EXISTE TENSÃO ENTRE NÓS DOIS!', { ex: 'angry', g: 'none', style: 'shout', dur: 2600 }],
  ], { extra: (s) => { s.fx('shake', 300, 500, 0.4); s.ex('bia', 2000, 'ashamed'); } , pad: 1200 });
  convo(B, 'Bia fica discretamente vermelha; Lari ri', SALA, (s) => sala(s, SALL, { ex: { bia: 'ashamed', lari: 'laughing' }, look: { bia: 'tv', lari: 'bia' } }), ['two', ['bia', 'lari'], { dx: 20 }], [], {
    dur: 2800, extra: (s) => { s.act('lari', 'laugh', 200, { dur: 2200, intensity: 0.8 }); s.look('bia', 0, 'tv'); s.k('bia', 'rig.headNod', [[0, 4, 'linear']]); },
  });

  convo(B, 'Estúdio: o apresentador vai ficando vermelho', ST, (s) => estudio(s, ['gaivota', 'pinote', 'apres'], { red: 2 }), ['close', 'apres'], [], {
    dur: 2300, extra: (s) => { s.ex('apres', 0, 'worried'); s.ex('apres', 900, 'irritated'); s.look('apres', 0, 'gaivota'); },
  });
  convo(B, 'Sala: Samuca e a curiosidade do sangue', SALA, (s) => sala(s, SALL, { look: { samuca: 'tv' } }), ['medium', 'samuca', { dx: 150 }], [
    ['samuca', 'Sabiam que o corpo humano tem uns cinco litros de sangue? Olha o apresentador: tá ficando vermelho. Deve ser tudo isso subindo pra cabeça.', { ex: 'excited', g: 'gesture', side: 'R', dur: 7500 }],
  ]);
  convo(B, 'Sala: reações ao Samuca', SALA, (s) => sala(s, SALL, { ex: { lari: 'laughing', rafa: 'happy', bia: 'tired', caique: 'laughing' } }), ['wide'], [], {
    dur: 2200, extra: (s) => { s.look('samuca', 0, 'tv'); s.cam0({ x: 150, y: 40, zoom: 1.2 }); s.act('caique', 'laugh', 300, { dur: 1500, intensity: 0.5 }); s.act('bia', 'facepalm', 500, { dur: 1400 }); },
  });

  convo(B, 'Última rodada: apresentador (mais vermelho)', ST, (s) => estudio(s, ['gaivota', 'pinote', 'apres'], { red: 3 }), ['medium', 'apres'], [
    ['apres', 'Última rodada. Qual seria a primeira medida de cada um, se eleito?', { ex: 'irritated', g: 'point', side: 'R', dur: 4600 }],
  ], { extra: (s) => s.look('apres', 0, 'cam') });
  convo(B, 'Gaivota: "Impedir que o Pinote destrua Vila Torta!"', ST, (s) => estudio(s, ['gaivota', 'pinote', 'apres'], { red: 3 }), ['close', 'gaivota', { dy: 10 }], [
    ['gaivota', 'Impedir que o Pinote destrua Vila Torta!', { ex: 'proud', g: 'none', style: 'shout', dur: 3200 }],
  ], { extra: (s) => { s.look('gaivota', 0, 'cam'); s.k('gaivota', 'rig.headNod', [[400, 0, 'linear'], [700, -8, 'easeOut'], [1500, 0, 'easeInOut']]); } });
  convo(B, 'Pinote: "Impedir que o Gaivota continue destruindo Vila Torta!"', ST, (s) => estudio(s, ['gaivota', 'pinote', 'apres'], { red: 3 }), ['close', 'pinote', { dy: 10 }], [
    ['pinote', 'Impedir que o Gaivota continue destruindo Vila Torta!', { ex: 'angry', g: 'none', style: 'shout', dur: 3800 }],
  ], { extra: (s) => { s.look('pinote', 0, 'cam'); s.k('pinote', 'rig.headNod', [[400, 0, 'linear'], [700, -8, 'easeOut'], [1500, 0, 'easeInOut']]); } });
  B.shot('Pausa constrangedora: os dois se encaram', ST, 2800, (s) => {
    estudio(s, ['gaivota', 'pinote', 'apres'], { red: 4, ex: { gaivota: 'suspicious', pinote: 'suspicious', apres: 'tired' } });
    s.cam0({ x: 0, y: 170, zoom: 1.3 });
    s.look('gaivota', 0, 'pinote'); s.look('pinote', 0, 'gaivota');
    s.ex('apres', 1500, 'astonished');
    s.dur(2800);
  });
  convo(B, 'Apresentador: "Eu devia ter virado padeiro"', ST, (s) => estudio(s, ['gaivota', 'pinote', 'apres'], { red: 4 }), ['close', 'apres'], [
    ['apres', 'Eu devia ter virado padeiro, caralho.', { ex: 'angry', g: 'none', style: 'shout', dur: 2700 }],
  ], { extra: (s) => { s.look('apres', 0, 'cam'); s.fx('shake', 400, 700, 0.6); s.k('apres', 'rig.headNod', [[400, 0, 'linear'], [700, -14, 'easeOut'], [2200, 10, 'easeInOut']]); }, pad: 900 });
  convo(B, 'Sala: silêncio e riso', SALA, (s) => sala(s, SALL, { ex: { lari: 'laughing', rafa: 'happy', bia: 'tired', caique: 'laughing', samuca: 'curious' as never } }), ['wide'], [
    ['samuca', 'Eu acho que ele ia gostar de padaria. Tem cheirinho.', { ex: 'happy', g: 'none', dur: 3400, gapBefore: 900 }],
  ], { extra: (s) => { s.cam0({ x: 120, y: 40, zoom: 1.15 }); s.act('caique', 'laugh', 200, { dur: 1700 }); } });
}
