/** Monta o projeto completo (elenco, objetos, cenários e as 11 sequências). */
import { Builder } from './lib';
import { buildObjects } from './objects';
import { buildBackgrounds } from './backgrounds';
import { loadOfficial, secondaryCast } from './cast';
import { seq1 } from './seq/s01-buraco';
import { seq2 } from './seq/s02-abertura';
import { seq3 } from './seq/s03-patio';
import { seq4, seq5 } from './seq/s04-s05';
import { seq6 } from './seq/s06-debate';
import { seq7, seq8 } from './seq/s07-s08';
import { seq9, seq10, seq11 } from './seq/s09-s11';

export const TITLE = 'Vila Torta · T1E1 · Políticos de Estimação';

export function produzir() {
  const B = new Builder(TITLE);
  B.project.metadata.description = 'Vila Torta, temporada 1, episódio 1 — "Políticos de Estimação". Classificação indicativa: 18 anos (linguagem adulta e sátira política). Animação 2D por recortes feita 100% com o motor nativo do Recorte Studio.';
  B.objects = buildObjects();
  B.project.customObjects = B.objects;
  for (const [k, d] of Object.entries(loadOfficial())) B.addCharacter(k, d);
  for (const [k, d] of Object.entries(secondaryCast())) B.addCharacter(k, d);
  B.bgs = buildBackgrounds(B.project);
  seq1(B); seq2(B); seq3(B); seq4(B); seq5(B); seq6(B); seq7(B); seq8(B); seq9(B); seq10(B); seq11(B);
  return { B, project: B.finish() };
}
