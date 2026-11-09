/** Monta o T1E2 "O Show e o Fiscal" (duas tramas paralelas) com o motor nativo do Recorte Studio. */
import { Builder } from '../lib';
import { buildObjects2 } from './objects2';
import { buildBackgrounds2 } from './bg2';
import { loadOfficial } from '../cast';
import { cast2 } from './cast2';
import { registerAudio } from './audio';
import { seqA1, seqA2, seqA3 } from './seq/a';
import { seqB4, seqB5, seqB6, seqB7 } from './seq/b';
import { seqC8, seqC9, seqC10 } from './seq/c';
import { seqD11, seqD12 } from './seq/d';
import type { Piece } from '@/engine/model/schema';

export const TITLE2 = 'Vila Torta · T1E2 · O Show e o Fiscal';

export function produzir2() {
  const B = new Builder(TITLE2);
  B.project.metadata.description = 'Vila Torta, temporada 1, episódio 2 — "O Show e o Fiscal". Duas tramas paralelas (show de Lon Ruan × Seu Norberto, o Fiscal da Rua). Classificação indicativa: 18 anos. Áudio 100% original sintetizado; sem vozes: falas em balões, prontas para dublagem.';
  const objs = buildObjects2();
  for (const [k, d] of Object.entries(loadOfficial())) B.addCharacter(k, d);
  for (const [k, d] of Object.entries(cast2())) B.addCharacter(k, d);
  B.bgs = buildBackgrounds2(B.project);
  registerAudio(B);
  seqA1(B); seqA2(B); seqA3(B); seqB4(B); seqB5(B); seqB6(B); seqB7(B); seqC8(B); seqC9(B); seqC10(B); seqD11(B); seqD12(B);

  // ---- trilha sonora (camas contínuas atravessam os cortes) ----
  const first = (tag: string) => B.scenes.findIndex((s) => s.notes.startsWith(`Sequência: ${tag} `)) + 1;
  const last = (tag: string) => B.scenes.length - [...B.scenes].reverse().findIndex((s) => s.notes.startsWith(`Sequência: ${tag} `));
  const named = (frag: string) => B.scenes.findIndex((s) => s.name.includes(frag)) + 1;
  B.bed('rua', first('S1'), last('S2'), { vol: 0.2, fadeInMs: 800 });
  B.bed('rua', first('S4'), last('S4'), { vol: 0.22 });
  B.bed('plateia', first('S5'), last('S5'), { vol: 0.16 });
  B.bed('beat', first('S6') + 1, last('S7'), { vol: 0.5, role: 'music' });
  B.bed('plateia', first('S6'), last('S7'), { vol: 0.28 });
  const tiro = named('O primeiro disparo');
  B.bed('beat', first('S8'), tiro, { vol: 0.5, role: 'music', endInLastMs: 1900 });
  B.bed('plateia', first('S8'), tiro, { vol: 0.28, endInLastMs: 1900 });
  B.bed('rua', first('S10'), last('S10'), { vol: 0.14 });
  B.bed('rua', first('S11'), last('S11'), { vol: 0.24 });
  B.bed('delegacia', first('S12'), named('Lon espera'), { vol: 0.35 });
  B.bed('rua', named('Lon espera') + 1, last('S12') - 1, { vol: 0.2 });

  // ---- só leva para o projeto os objetos realmente usados ----
  const used = new Set<string>();
  const visit = (id: string) => { if (used.has(id) || !objs[id]) return; used.add(id); const o = objs[id]!; for (const list of [o.pieces, ...o.clips.flatMap((c) => c.frames.map((f) => f.pieces))]) for (const p of list as Piece[]) if (p.kind === 'object' && p.refId) visit(p.refId); };
  for (const sc of B.scenes) for (const n of Object.values(sc.nodes)) if (n.kind === 'prop' && n.propId.startsWith('obj:')) visit(n.propId.slice(4));
  B.project.customObjects = Object.fromEntries([...used].map((id) => [id, objs[id]!]));
  return { B, project: B.finish() };
}
