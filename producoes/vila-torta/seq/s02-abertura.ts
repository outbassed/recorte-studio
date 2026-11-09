/** SEQUÊNCIA 2 — ABERTURA DA SÉRIE (vinheta ≈ 10 s, só com recursos nativos) */
import type { Builder } from '../lib';

export function seq2(B: Builder) {
  B.seq = 'S2 · Abertura da série';

  B.shot('Abertura: a cidade', 'centro', 1700, (s) => {
    s.cam0({ x: -260, y: 20, zoom: 1.1 });
    s.cam(0, { x: 260, zoom: 1.2 }, 1700, 'linear');
    s.text('selo', 'UMA SÉRIE ORIGINAL', { x: 0, y: 440, size: 34, color: '#fff7e6', sw: 7 });
    s.k('selo', 'opacity', [[0, 0, 'linear'], [350, 1, 'easeOut'], [1300, 1, 'linear'], [1700, 0, 'easeIn']]);
    s.dur(1700);
  });

  B.shot('Abertura: a escola', 'patio', 1500, (s) => {
    s.cam0({ x: 0, y: 330, zoom: 1.0 });
    s.cam(0, { y: -150, zoom: 1.12 }, 1500, 'easeInOut');
    s.dur(1500);
  });

  const cards: Array<[string, string, string, string, string]> = [
    ['bia', 'BIA', 'irritated', 'crossArms', '#3d4a66'],
    ['rafa', 'RAFA', 'happy', 'wave', '#2f7a6e'],
    ['caique', 'CAÍQUE', 'mocking', 'point', '#d6623c'],
    ['samuca', 'SAMUCA', 'excited', 'hold', '#c58a45'],
    ['lari', 'LARI', 'laughing', 'jump', '#c75c8c'],
  ];
  for (const [who, nome, ex, act, cor] of cards) {
    B.shot(`Abertura: apresentação — ${nome}`, 'patio', who === 'lari' ? 800 : 700, (s) => {
      s.shape('faixa', 'rect', { x: 0, y: 0, w: 2400, h: 1300, fill: cor, sw: 0, opacity: 0.92, bottom: true });
      s.actor(who, who, { x: 0, y: 470, scale: 0.9, look: 'cam', ex, headStrength: 0.2 });
      s.frame('medium', [who], { dy: 10 });
      s.act(who, act, 60, { dur: 650, intensity: 1, side: 'R' });
      s.text('nome', nome, { x: 0, y: 330, size: 96, color: '#fff7e6', sw: 12, rot: -3 });
      s.k('nome', 'transform.scaleX', [[0, 0.2, 'linear'], [180, 1, 'backOut']]);
      s.k('nome', 'transform.scaleY', [[0, 0.2, 'linear'], [180, 1, 'backOut']]);
      if (who === 'samuca') s.prop('garrafa', 'obj_garrafa', { x: 0, y: 0, scale: 0.9, held: 'samuca:R', noShadow: true });
      if (who === 'lari') s.prop('bola', 'obj_bola_volei', { x: 0, y: 0, scale: 1, held: 'lari:R', noShadow: true });
      s.dur(who === 'lari' ? 800 : 700);
    });
  }

  B.shot('Abertura: título VILA TORTA', 'neutro', 3400, (s) => {
    s.shape('fundo', 'rect', { x: 0, y: 0, w: 2400, h: 1300, fill: '#1c2447', sw: 0, bottom: true });
    s.shape('raios', 'burst', { x: 0, y: 40, w: 2600, h: 1700, fill: '#2d3a7a', sw: 0, opacity: 0.8, bottom: false });
    s.k('raios', 'transform.rotationDeg', [[0, 0, 'linear'], [3400, 24, 'linear']]);
    const who = ['bia', 'rafa', 'caique', 'samuca', 'lari'] as const;
    who.forEach((w, i) => {
      s.actor(w, w, { x: -640 + i * 320, y: 560 + (i % 2) * 20, scale: 0.55, look: 'cam', ex: 'happy', headStrength: 0.1 });
      s.k(w, 'rig.bodyY', [[0, 0, 'hold'], [1900 + i * 80, 0, 'linear'], [2050 + i * 80, 38, 'easeOut'], [2300 + i * 80, 0, 'bounceOut']]);
    });
    // "VILA TORTA": cada letra com uma leve torção (a torta é a vila)
    const word1 = 'VILA'; const word2 = 'TORTA';
    const tilt = [-4, 3, -2, 5, -3, 4, -5, 2, -4];
    let n = 0;
    const lay = (word: string, y: number, size: number, x0: number, step: number, color: string) => {
      [...word].forEach((ch, i) => {
        const key = `letra${n}`;
        const t0 = 300 + n * 130;
        s.text(key, ch, { x: x0 + i * step, y, size, color, sw: 14, rot: tilt[n % tilt.length]!, sx: 0.01, sy: 0.01, opacity: 0 });
        s.k(key, 'opacity', [[0, 0, 'hold'], [t0, 1, 'hold']]);
        s.k(key, 'transform.scaleX', [[t0, 0.05, 'linear'], [t0 + 260, 1, 'backOut']]);
        s.k(key, 'transform.scaleY', [[t0, 0.05, 'linear'], [t0 + 260, 1, 'backOut']]);
        n++;
      });
    };
    lay(word1, -170, 250, -340, 235, '#fff7e6');
    lay(word2, 80, 290, -480, 240, '#f2c95c');
    s.text('episodio', 'Episódio 1 · Políticos de Estimação', { x: 0, y: 270, size: 46, color: '#fff7e6', sw: 8, opacity: 0 });
    s.k('episodio', 'opacity', [[0, 0, 'hold'], [2200, 0, 'linear'], [2700, 1, 'easeOut']]);
    s.dur(3400);
  });
}
