/** SEQUÊNCIA 1 — O BURACO DA DISCÓRDIA */
import type { Builder } from '../lib';
import { vehicle, drive } from '../vehicles';
import { puff, sfx, ruaSet, RUA } from './common';

const SW = 210; // distância entre o eixo traseiro e o dianteiro do carro (px do objeto)

export function seq1(B: Builder) {
  B.seq = 'S1 · O buraco da discórdia';
  const gx = RUA.carFinalX;
  const Y = RUA.roadY;

  // 1.01 plano geral: a rua vazia, o buraco ao fundo, o carro entra e anda de verdade
  B.shot('Rua das Mangueiras: carro entra em quadro (plano geral)', 'rua', 3600, (s) => {
    ruaSet(s);
    const v = vehicle(s, 'Carro', 'car', { x: -1250, y: Y, gs: RUA.gs });
    drive(s, v, 0, 3300, -1250, -420, { ease: 'linear', steps: 14 });
    s.text('legenda', 'RUA DAS MANGUEIRAS · 7h42', { x: -520, y: -430, size: 40, color: '#fff7e6', sw: 8, align: 'start' });
    s.k('legenda', 'opacity', [[0, 0, 'linear'], [500, 1, 'easeOut'], [2600, 1, 'linear'], [3200, 0, 'easeIn']]);
    s.cam0({ x: 0, y: 0, zoom: 1 });
    s.cam(0, { x: 80, zoom: 1.08 }, 3400, 'linear');
    s.dur(3600);
  });

  // 1.02 detalhe: a roda dianteira rolando em direção ao buraco (câmera baixa acompanhando)
  B.shot('Detalhe: a roda dianteira rola até o buraco', 'rua', 2200, (s) => {
    ruaSet(s);
    const v = vehicle(s, 'Carro', 'car', { x: -330, y: Y, gs: RUA.gs });
    drive(s, v, 0, 1900, -330, -50, { ease: 'linear', steps: 10 });
    s.cam0({ x: -190 + SW * 0.8 + 0, y: 330, zoom: 2.3 });
    s.cam(0, { x: 20 + SW * 0.8, y: 330, zoom: 2.3 }, 2100, 'linear');
    s.dur(2200);
  });

  // 1.03 interior: motorista relaxado, o tranco
  B.shot('Interior do carro: motorista distraído, tranco', 'carro', 2600, (s) => {
    s.actor('mot', 'motorista', { x: 0, y: 460, scale: 1.05, look: { x: 400, y: -120 }, ex: 'bored', headStrength: 0.3 });
    s.frame('medium', ['mot']);
    s.act('mot', 'nod', 300, { dur: 900, intensity: 0.5, speed: 0.6 });
    s.ex('mot', 1500, 'worried');
    s.k('mot', 'rig.bodyY', [[0, 0, 'linear'], [1599, 0, 'hold'], [1700, -26, 'easeOut'], [1900, 8, 'easeIn'], [2200, 0, 'easeOut']]);
    s.k('mot', 'rig.headNod', [[1600, 0, 'linear'], [1700, -16, 'easeOut'], [2200, 0, 'easeOut']]);
    s.fx('shake', 1650, 800, 0.9);
    s.dur(2600);
  });

  // 1.04 impacto: a roda entra no buraco — a suspensão sofre o tranco
  B.shot('Impacto: roda dianteira entra no buraco (plano médio)', 'rua', 3800, (s) => {
    ruaSet(s);
    const v = vehicle(s, 'Carro', 'car', { x: -120, y: Y, gs: RUA.gs });
    const tI = 300;
    drive(s, v, 0, tI, -120, -18, { ease: 'linear', steps: 3 });
    drive(s, v, tI, 2200, -18, gx, { ease: 'out', steps: 10, rot0: ((-18 - -120) / (60 * RUA.gs)) * (180 / Math.PI) });
    // roda dianteira desce, carroceria cabeceia (tranco) e assenta torta
    s.k(v.wf, 'transform.y', [[0, -60, 'hold'], [tI, -60, 'linear'], [tI + 160, -26, 'easeIn'], [tI + 520, -60, 'easeOut'], [tI + 900, -30, 'easeIn'], [tI + 1500, -34, 'easeOut']]);
    s.k(v.body, 'transform.rotationDeg', [[0, 0, 'hold'], [tI, 0, 'linear'], [tI + 160, 7, 'easeIn'], [tI + 520, -4, 'easeOut'], [tI + 900, 6, 'easeIn'], [tI + 1500, 4, 'easeOut']]);
    s.k(v.body, 'transform.y', [[tI, 0, 'linear'], [tI + 160, 18, 'easeIn'], [tI + 520, -14, 'easeOut'], [tI + 900, 12, 'easeIn'], [tI + 1500, 8, 'easeOut']]);
    s.k(v.sf, 'transform.scaleY', [[tI, 1, 'linear'], [tI + 160, 1.5, 'easeIn'], [tI + 520, 0.55, 'easeOut'], [tI + 900, 1.35, 'easeIn'], [tI + 1500, 1.2, 'easeOut']]);
    s.k(v.sr, 'transform.scaleY', [[tI, 1, 'linear'], [tI + 160, 0.8, 'easeIn'], [tI + 520, 1.15, 'easeOut'], [tI + 1500, 1, 'easeOut']]);
    s.k(v.g, 'transform.y', [[tI, Y, 'linear'], [tI + 160, Y + 5, 'easeIn'], [tI + 520, Y - 6, 'easeOut'], [tI + 1500, Y, 'easeOut']]);
    puff(s, 'poeira1', 120, 395, tI + 120, { size: 110, rise: 80, dx: -60 });
    puff(s, 'poeira2', 200, 392, tI + 200, { size: 90, rise: 100, dx: 50 });
    puff(s, 'poeira3', 160, 400, tI + 350, { size: 130, rise: 70, dx: 10 });
    sfx(s, 'estalo', 'CRAC!', 60, 60, tI + 150, { size: 100, hold: 1300 });
    s.fx('shake', tI + 120, 1200, 1.4);
    s.cam0({ x: 40, y: 190, zoom: 1.35 });
    s.cam(tI, { x: 110, y: 235, zoom: 1.7 }, 1600, 'easeOut');
    s.dur(3800);
  });

  // 1.05 detalhe: a roda no buraco, a mola esticada, o estalo
  B.shot('Detalhe: suspensão estalando', 'rua', 2400, (s) => {
    ruaSet(s);
    const v = vehicle(s, 'Carro', 'car', { x: gx, y: Y, gs: RUA.gs, bodyTilt: 4, frontDip: 26 });
    s.k(v.sf, 'transform.scaleY', [[0, 1.2, 'linear'], [600, 1.5, 'easeInOut'], [900, 1.1, 'easeOut'], [1500, 1.45, 'easeInOut'], [2300, 1.3, 'linear']]);
    s.k(v.wf, 'transform.rotationDeg', [[0, 0, 'linear'], [700, 6, 'easeInOut'], [1000, -4, 'easeInOut'], [1700, 5, 'easeInOut'], [2300, 0, 'easeInOut']]);
    sfx(s, 'estalo2', 'TCHÁC!', 120, 215, 500, { size: 42, hold: 1100, rot: 6 });
    s.cam0({ x: 200, y: 290, zoom: 3.0 });
    s.cam(0, { x: 215, y: 300, zoom: 3.3 }, 2300, 'linear');
    s.dur(2400);
  });

  // 1.06 interior: o grito
  B.shot('Interior: "Puta que pariu! Quebrei a suspensão!"', 'carro', 3200, (s) => {
    s.actor('mot', 'motorista', { x: 0, y: 460, scale: 1.05, look: { x: 400, y: -120 }, ex: 'astonished', headStrength: 0.3 });
    s.frame('close', ['mot'], { dy: 90 });
    s.t = 350;
    s.say('mot', 'PUTA QUE PARIU! QUEBREI A SUSPENSÃO!', { dur: 2500, ex: 'angry', g: 'none' });
    s.k('mot', 'rig.headNod', [[350, 0, 'linear'], [700, -10, 'easeOut'], [1000, 6, 'easeInOut'], [1500, -8, 'easeInOut'], [2800, 0, 'easeOut']]);
    s.fx('shake', 350, 500, 0.5);
    s.dur(3200);
  });

  // 1.07 o motorista já fora do carro, olhando o estrago
  B.shot('Motorista olha o estrago (plano geral)', 'rua', 3000, (s) => {
    ruaSet(s);
    const v = vehicle(s, 'Carro', 'car', { x: gx, y: Y, gs: RUA.gs, bodyTilt: 4, frontDip: 26 });
    s.k(v.sf, 'transform.scaleY', [[0, 1.25, 'linear']]);
    s.actor('mot', 'motorista', { x: -430, y: 450, scale: 0.7, look: 'Carro', ex: 'angry', pose: 'hands-up' });
    s.pose('mot', 700, 'hips', 400);
    s.k('mot', 'gaze.mode', [[0, 'point', 'hold']]);
    s.k('mot', 'gaze.x', [[0, 170, 'hold']]);
    s.k('mot', 'gaze.y', [[0, 330, 'hold']]);
    s.act('mot', 'shakeHead', 1200, { dur: 1100, intensity: 0.8 });
    s.cam0({ x: -40, y: 40, zoom: 1.15 });
    s.dur(3000);
  });

  // Estado da rua para a discussão: Marta e Agenor na calçada, motorista ao lado do carro
  const rua = (s: import('../lib').Shot, who: string[], tilt = true) => {
    ruaSet(s);
    const v = vehicle(s, 'Carro', 'car', { x: gx, y: Y, gs: RUA.gs, bodyTilt: tilt ? 4 : 0, frontDip: tilt ? 26 : 0 });
    s.k(v.sf, 'transform.scaleY', [[0, 1.25, 'linear']]);
    const A = { marta: { x: -560, y: 215, scale: 0.6, look: 'agenor', ex: 'neutral' }, agenor: { x: -330, y: 215, scale: 0.6, look: 'marta', ex: 'neutral' }, mot: { x: -430, y: 450, scale: 0.7, look: 'Carro', ex: 'angry' } } as const;
    if (who.includes('mot')) s.actor('mot', 'motorista', { ...A.mot });
    if (who.includes('marta')) s.actor('marta', 'marta', { ...A.marta });
    if (who.includes('agenor')) s.actor('agenor', 'agenor', { ...A.agenor });
    return v;
  };

  // 1.08 Agenor reclama (plano médio)
  B.shot('Seu Agenor: "A rua parece a superfície da Lua"', 'rua', 5200, (s) => {
    rua(s, ['marta', 'agenor']);
    s.frame('two', ['marta', 'agenor']);
    s.ex('agenor', 0, 'angry'); s.t = 400;
    s.say('agenor', 'É isso aí! Quatro anos de Gaivota e a rua tá parecendo a superfície da Lua!', { g: 'gesture', side: 'R' });
    s.ex('marta', 2800, 'irritated');
    s.cam(0, { zoom: 1.35 }, 5000, 'easeInOut');
    s.end(300);
  });

  // 1.09 reação da Marta
  B.shot('Dona Marta reage', 'rua', 4000, (s) => {
    rua(s, ['marta', 'agenor']);
    s.frame('medium', ['marta'], { dx: 60 });
    s.act('marta', 'crossArms', 0, { dur: 800 });
    s.ex('marta', 0, 'mocking'); s.t = 500;
    s.say('marta', 'E você acha que esse Pinote vai resolver alguma merda?', { g: 'point', side: 'L', ex: 'angry' });
    s.end(300);
  });

  // 1.10-1.14 campo e contracampo rápido
  B.shot('Agenor: "Pelo menos ele vai fazer alguma coisa!"', 'rua', 2500, (s) => {
    rua(s, ['marta', 'agenor']); s.frame('close', ['agenor']);
    s.ex('agenor', 0, 'angry'); s.t = 250; s.say('agenor', 'Pelo menos ele vai fazer alguma coisa!', { g: 'none' }); s.end(150);
  });
  B.shot('Marta: "O quê?"', 'rua', 1500, (s) => {
    rua(s, ['marta', 'agenor']); s.frame('close', ['marta']);
    s.ex('marta', 0, 'suspicious'); s.t = 200; s.say('marta', 'O quê?', { g: 'none', dur: 900 }); s.end(250);
  });
  B.shot('Agenor: "Vai tirar esse desgraçado daí!"', 'rua', 2700, (s) => {
    rua(s, ['marta', 'agenor']); s.frame('medium', ['agenor'], { dx: -40 });
    s.ex('agenor', 0, 'angry'); s.t = 250; s.say('agenor', 'Vai tirar esse desgraçado daí!', { g: 'point', side: 'R', dur: 1900 }); s.end(300);
  });
  B.shot('Marta: "E depois?"', 'rua', 1700, (s) => {
    rua(s, ['marta', 'agenor']); s.frame('close', ['marta']);
    s.ex('marta', 0, 'mocking'); s.t = 250; s.say('marta', 'E depois?', { g: 'none', dur: 1000 }); s.end(450);
  });
  B.shot('Agenor trava; "Depois a gente vê, caralho!"', 'rua', 3000, (s) => {
    rua(s, ['marta', 'agenor']); s.frame('close', ['agenor']);
    s.ex('agenor', 0, 'confused'); s.t = 900; s.ex('agenor', 900, 'angry');
    s.say('agenor', 'Depois a gente vê, caralho!', { g: 'none', dur: 1800, style: 'shout' });
    s.k('agenor', 'rig.headNod', [[900, 0, 'linear'], [1100, -9, 'easeOut'], [2000, 0, 'easeInOut']]);
    s.end(250);
  });

  // 1.15 reação do motorista ignorado
  B.shot('O motorista, ignorado, olha a roda', 'rua', 3000, (s) => {
    rua(s, ['mot']); s.frame('medium', ['mot'], { dx: 90 });
    s.ex('mot', 0, 'tired');
    s.k('mot', 'gaze.mode', [[0, 'point', 'hold']]); s.k('mot', 'gaze.x', [[0, 160, 'hold']]); s.k('mot', 'gaze.y', [[0, 340, 'hold']]);
    s.act('mot', 'shrug', 800, { dur: 1100 });
    s.ex('mot', 1900, 'sad');
    s.dur(3000);
  });

  // 1.16 Rafael e Caíque passam pela calçada (travelling lateral)
  B.shot('Rafael e Caíque passam pela calçada (travelling)', 'rua', 5200, (s) => {
    ruaSet(s);
    const v = vehicle(s, 'Carro', 'car', { x: gx, y: Y, gs: RUA.gs, bodyTilt: 4, frontDip: 26 });
    s.k(v.sf, 'transform.scaleY', [[0, 1.25, 'linear']]);
    s.actor('marta', 'marta', { x: -560, y: 215, scale: 0.6, look: 'agenor', ex: 'angry' });
    s.actor('agenor', 'agenor', { x: -330, y: 215, scale: 0.6, look: 'marta', ex: 'angry' });
    s.actor('mot', 'motorista', { x: -430, y: 450, scale: 0.7, look: 'Carro', ex: 'tired' });
    s.actor('rafa', 'rafa', { x: -1100, y: 240, scale: 0.6, look: { x: 900, y: -120 }, ex: 'neutral' });
    s.actor('caique', 'caique', { x: -1240, y: 240, scale: 0.6, look: 'rafa', ex: 'happy' });
    s.walk('rafa', 0, -1100, -60, { dur: 4600 });
    s.walk('caique', 0, -1240, -190, { dur: 4600 });
    s.t = 700; s.say('caique', 'O pão da dona Cida sai quentinho às oito.', { g: 'none', dur: 2400 });
    s.say('rafa', 'Anda logo, que a Bia me mata se eu demorar.', { g: 'none', dur: 2300, ex: 'neutral' });
    s.cam0({ x: -500, y: 20, zoom: 1.25 });
    s.cam(0, { x: -120, zoom: 1.25 }, 4900, 'linear');
    s.dur(5200);
  });

  // 1.17 Agenor intercepta
  B.shot('Agenor chama os garotos', 'rua', 3000, (s) => {
    rua(s, ['marta', 'agenor']);
    s.actor('rafa', 'rafa', { x: -60, y: 240, scale: 0.6, look: 'agenor' });
    s.actor('caique', 'caique', { x: -190, y: 240, scale: 0.6, look: 'agenor', ex: 'happy' });
    s.look('agenor', 0, 'rafa');
    s.frame('medium', ['agenor'], { dx: 100 });
    s.ex('agenor', 0, 'angry'); s.t = 300;
    s.say('agenor', 'Ei, vocês dois! Em quem vocês votariam?', { g: 'point', side: 'R', dur: 2300 });
    s.end(200);
  });

  // 1.18 Rafael: "A gente tá indo comprar pão"
  B.shot('Rafael: "A gente tá indo comprar pão"', 'rua', 3400, (s) => {
    rua(s, ['marta', 'agenor']);
    s.actor('rafa', 'rafa', { x: -60, y: 240, scale: 0.6, look: 'agenor' });
    s.actor('caique', 'caique', { x: -190, y: 240, scale: 0.6, look: 'agenor', ex: 'happy' });
    s.frame('two', ['rafa', 'caique'], { dy: -60 });
    s.ex('rafa', 0, 'tired'); s.t = 400;
    s.say('rafa', 'A gente tá indo comprar pão, seu Agenor.', { g: 'shrug', dur: 2500 });
    s.end(200);
  });

  // 1.19 Caíque e a cratera
  B.shot('Caíque: "...antes que descubram petróleo"', 'rua', 5000, (s) => {
    const v = rua(s, ['marta', 'agenor']); void v;
    s.actor('rafa', 'rafa', { x: -60, y: 240, scale: 0.6, look: 'caique' });
    s.actor('caique', 'caique', { x: -190, y: 240, scale: 0.6, look: { x: 150, y: 400 }, ex: 'mocking' });
    s.frame('medium', ['caique'], { dx: 120 });
    s.t = 400;
    s.say('caique', 'Eu sou a favor de tapar essa cratera antes que descubram petróleo aí dentro.', { g: 'point', side: 'R', dur: 4200 });
    s.ex('rafa', 2400, 'laughing');
    s.end(300);
  });

  // 1.20 pausa cômica: todos olham para ele
  B.shot('Pausa: Marta e Agenor encaram o Caíque', 'rua', 2600, (s) => {
    rua(s, ['marta', 'agenor']);
    s.actor('rafa', 'rafa', { x: -60, y: 240, scale: 0.6, look: 'caique', ex: 'tired' });
    s.actor('caique', 'caique', { x: -190, y: 240, scale: 0.6, look: 'agenor', ex: 'happy' });
    s.look('marta', 0, 'caique'); s.look('agenor', 0, 'caique');
    s.frame('wide', []); s.cam0({ x: -330, y: 60, zoom: 1.75 });
    s.ex('marta', 0, 'suspicious'); s.ex('agenor', 0, 'confused');
    s.dur(2600);
  });

  // 1.21 a roda se solta: detalhe + plano geral com panorâmica
  B.shot('A roda se solta e sai rolando (panorâmica)', 'rua', 5200, (s) => {
    ruaSet(s);
    const v = vehicle(s, 'Carro', 'car', { x: gx, y: Y, gs: RUA.gs, bodyTilt: 4, frontDip: 26 });
    s.k(v.sf, 'transform.scaleY', [[0, 1.25, 'linear'], [700, 1.9, 'easeIn'], [1200, 2.6, 'easeOut']]);
    s.actor('mot', 'motorista', { x: -430, y: 450, scale: 0.7, look: 'Carro', ex: 'tired' });
    s.actor('marta', 'marta', { x: -560, y: 215, scale: 0.6, look: 'Carro', ex: 'astonished' });
    s.actor('agenor', 'agenor', { x: -330, y: 215, scale: 0.6, look: 'Carro', ex: 'astonished' });
    s.actor('rafa', 'rafa', { x: -60, y: 240, scale: 0.6, look: 'Carro', ex: 'surprised' });
    s.actor('caique', 'caique', { x: -190, y: 240, scale: 0.6, look: 'Carro', ex: 'astonished' });
    // estala, a roda treme e se solta
    s.k(v.wf, 'transform.rotationDeg', [[0, 0, 'linear'], [250, 12, 'easeInOut'], [450, -10, 'easeInOut'], [650, 14, 'easeInOut'], [900, 0, 'linear'], [900, 0, 'linear'], [2800, 720, 'easeOut']]);
    // sai do eixo: rola para a direita com quiques e o carro cai de nariz
    s.k(v.wf, 'transform.x', [[0, 210, 'hold'], [900, 210, 'linear'], [1100, 330, 'easeOut'], [2800, 1500, 'easeOut']]);
    s.k(v.wf, 'transform.y', [[0, -34, 'hold'], [900, -34, 'linear'], [1100, -170, 'easeOut'], [1350, -60, 'easeIn'], [1650, -110, 'easeOut'], [1900, -60, 'easeIn'], [2200, -80, 'easeOut'], [2450, -60, 'easeIn'], [2800, -60, 'linear']]);
    s.k(v.body, 'transform.rotationDeg', [[0, 4, 'linear'], [900, 4, 'linear'], [1250, 11, 'easeIn'], [1500, 8.5, 'easeOut']]);
    s.k(v.body, 'transform.y', [[900, 0, 'linear'], [1250, 36, 'easeIn'], [1500, 30, 'easeOut']]);
    puff(s, 'poeira-nariz', 190, 400, 1250, { size: 140, rise: 60, dx: 40 });
    sfx(s, 'pop', 'POC!', 140, 190, 900, { size: 70, hold: 1000, rot: -12 });
    s.fx('shake', 1250, 700, 0.8);
    s.cam0({ x: -150, y: 80, zoom: 1.3 });
    s.cam(1000, { x: 300, y: 130, zoom: 1.25 }, 1900, 'easeInOut');
    s.cam(3200, { x: -250, y: 60, zoom: 1.2 }, 1800, 'easeInOut');
    s.dur(5200);
  });

  // 1.22 último grito do motorista (corte seco para a abertura em seguida)
  B.shot('Motorista grita de novo', 'rua', 3000, (s) => {
    ruaSet(s);
    const v = vehicle(s, 'Carro', 'car', { x: gx, y: Y, gs: RUA.gs, bodyTilt: 8.5, frontDip: 26 }); void v;
    s.k(v.sf, 'transform.scaleY', [[0, 2.6, 'linear']]);
    s.k(v.wf, 'transform.x', [[0, 1500, 'linear']]); s.k(v.body, 'transform.y', [[0, 30, 'linear']]);
    s.actor('mot', 'motorista', { x: -430, y: 450, scale: 0.7, look: { x: 900, y: 360 }, ex: 'astonished', pose: 'hands-up' });
    s.frame('close', ['mot'], { dy: 40 });
    s.t = 300; s.say('mot', 'A RODA! A RODA SAIU, CARALHO!', { dur: 2000, ex: 'angry', g: 'none' });
    s.k('mot', 'rig.headNod', [[300, 0, 'linear'], [600, -12, 'easeOut'], [1400, 4, 'easeInOut'], [2300, 0, 'easeOut']]);
    s.fx('shake', 300, 700, 0.6);
    s.dur(3000);
  });
}
