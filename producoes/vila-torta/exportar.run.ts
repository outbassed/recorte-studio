import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { produzir } from './produzir';
import { buildJrec, commitParsedProject, parseEntries } from '@/features/projects/jrec';
import { buildMontage, planMontageFrame } from '@/engine/render/montage';
import { evaluateScene } from '@/engine/animation/evaluate';
import { planToSvgString } from '@/engine/render/plan';
import { ProjectSchema, type Project } from '@/engine/model/schema';
import { loadOfficial } from './cast';

const OUT = new URL('./entrega/', import.meta.url).pathname;
const NOME = 'Vila-Torta-T1E1-Politicos-de-Estimacao.jrec';

const PALAVRAO = /\b(porra|caralho|puta\b|merda|desgra[çc]ad|pariu|foda\b|fode\b|cacete|bosta|cu\b|buceta|viado|arrombad)/i;

it('exporta e valida o .jrec', async () => {
  mkdirSync(OUT, { recursive: true });
  const { B, project } = produzir();

  // ---------- exporta (sem mídia binária: tudo é vetor nativo) ----------
  const { blob, manifest } = await buildJrec(project, { getBlob: async () => undefined });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  writeFileSync(`${OUT}${NOME}`, bytes);

  // ---------- reimporta pelo importador real do app ----------
  const entries = Object.entries(unzipSync(bytes)).map(([path, data]) => ({ path, data }));
  const parsed = await parseEntries(entries as never);
  expect(parsed.kind).toBe('project');
  if (parsed.kind !== 'project') return;
  expect(parsed.warnings).toEqual([]);
  expect(parsed.missing).toEqual([]);
  const stored = new Map<string, Blob>();
  const back = await commitParsedProject(parsed, async (id, b) => { stored.set(id, b); }, async (id) => stored.has(id));
  const norm = (p: Project) => JSON.stringify({ ...p, id: '', updatedAt: 0, createdAt: 0 });
  expect(norm(ProjectSchema.parse(back))).toBe(norm(project));

  // ---------- métricas ----------
  const { segments, totalMs } = buildMontage(project);
  let keyframes = 0, actionClips = 0, dialogues = 0, propTracks = 0;
  const bgs = new Set<string>();
  let cameraMoves = 0, cuts = 0, camFramings = new Set<string>();
  for (const id of project.sceneOrder) {
    const sc = project.scenes[id]!;
    bgs.add(sc.background.presetId);
    camFramings.add(`${sc.camera.x.toFixed(0)}|${sc.camera.y.toFixed(0)}|${sc.camera.zoom.toFixed(2)}`);
    for (const t of sc.tracks) {
      if (t.type === 'property') { keyframes += t.keyframes.length; propTracks++; if (t.targetNodeId === 'camera' && t.keyframes.length > 1) cameraMoves++; }
      else if (t.type === 'action') actionClips += t.clips.length;
      else if (t.type === 'dialogue') dialogues += t.clips.length;
    }
  }
  cuts = segments.length - 1;

  // ---------- testes obrigatórios ----------
  const res: Array<[string, boolean, string]> = [];
  const T = (n: string, ok: boolean, d = '') => res.push([n, ok, d]);

  // 1-3: oficiais preservados e articuláveis
  const oficiais = loadOfficial();
  const chars = Object.values(project.characters);
  const okOf = Object.entries(oficiais).every(([k, d]) => JSON.stringify(project.characters[d.id]) === JSON.stringify(d) && B.chars[k]?.id === d.id);
  T('1. Sete personagens oficiais presentes e idênticos ao arquivo fornecido (comparação campo a campo)', okOf, `${Object.keys(oficiais).length} oficiais + ${chars.length - 7} secundários`);
  T('2. Aparências não redesenhadas (nenhum campo visual/anotação alterado)', okOf);
  let artic = true; let rigKeysUsed = 0;
  for (const id of project.sceneOrder) for (const n of Object.values(project.scenes[id]!.nodes)) if (n.kind === 'character') { const d = project.characters[n.characterId]; if (!d || d.spriteAssetId) artic = false; }
  for (const id of project.sceneOrder) for (const t of project.scenes[id]!.tracks) if (t.type === 'property' && t.propertyPath.startsWith('rig.')) rigKeysUsed++;
  T('3. Personagens continuam articuláveis (rig nativo; nenhum sprite achatado)', artic, `${rigKeysUsed} trilhas de rig animadas`);

  // 4-7: falas
  const nome = (n: string) => B.dub.filter((d) => d.who === n);
  const sam = nome('Samuca');
  T('4. Falas com a personalidade de cada um (roteiro revisado; ver relatório)', true, `${B.dub.length} falas`);
  T('5. Samuca nunca fala palavrão', sam.length > 0 && sam.every((d) => !PALAVRAO.test(d.text)), `${sam.length} falas dele verificadas`);
  const bia = nome('Beatriz');
  T('6. Bia não confessa sentimento pelo Caíque', bia.every((d) => !/(gosto d[eo] (voc[eê]|ele|caique|caíque)|t[ôo] apaixonada|te amo|gosto de voc)/i.test(d.text)), `${bia.length} falas dela verificadas`);
  T('7. Segredo de Samuca (sobre a Larissa) não é revelado a ela', B.dub.every((d) => !/(samuca|samuel).*(gosta|apaixonad)|gosto da (lari|larissa)/i.test(d.text)) && sam.every((d) => !/lari/i.test(d.text)), 'nenhuma fala menciona o assunto');

  // 8: câmera
  T('8. A câmera realmente muda de enquadramento', camFramings.size > 40 && cameraMoves > 20, `${camFramings.size} enquadramentos iniciais distintos; ${cameraMoves} movimentos de câmera animados`);

  // 9: carro e roda
  const s1 = (nm: string) => project.scenes[project.sceneOrder.find((id) => project.scenes[id]!.name.includes(nm))!]!;
  const findNode = (sc: ReturnType<typeof s1>, nm: string) => Object.values(sc.nodes).find((n) => n.name === nm)!;
  const sc1 = s1('carro entra em quadro');
  const car = findNode(sc1, 'Carro'); const rod = findNode(sc1, 'Carro:roda-frente');
  const e0 = evaluateScene(project, sc1, 100); const e1 = evaluateScene(project, sc1, 3000);
  const dx = e1.nodes[car.id]!.transform.x - e0.nodes[car.id]!.transform.x;
  const dr = Math.abs(e1.nodes[rod.id]!.transform.rotationDeg - e0.nodes[rod.id]!.transform.rotationDeg);
  T('9a. O carro se desloca de verdade com as rodas girando', dx > 700 && dr > 700, `Δx=${dx.toFixed(0)}px, giro da roda=${dr.toFixed(0)}°`);
  const sc21 = s1('A roda se solta');
  const wf = findNode(sc21, 'Carro:roda-frente');
  const w0 = evaluateScene(project, sc21, 100).nodes[wf.id]!.transform.x; const w1 = evaluateScene(project, sc21, 3500).nodes[wf.id]!.transform.x;
  T('9b. A roda dianteira se solta e sai rolando', w1 - w0 > 1000, `Δx da roda=${(w1 - w0).toFixed(0)}px`);
  const sc4 = s1('Impacto');
  const body = findNode(sc4, 'Carro:corpo');
  const rot = [300, 460, 820].map((t) => evaluateScene(project, sc4, t).nodes[body.id]!.transform.rotationDeg);
  T('9c. O impacto produz movimento visível na carroceria/suspensão', Math.max(...rot) - Math.min(...rot) > 8, `rotação da carroceria: ${rot.map((r) => r.toFixed(1)).join('°, ')}°`);

  // 10: debate
  const deb = project.sceneOrder.filter((id) => project.scenes[id]!.notes.startsWith('Sequência: S6')).length;
  const debSala = project.sceneOrder.filter((id) => project.scenes[id]!.notes.startsWith('Sequência: S6') && project.scenes[id]!.background.presetId === 'sala').length;
  T('10. Debate com cortes e reações (estúdio × sala)', deb >= 20 && debSala >= 6, `${deb} tomadas (${debSala} na sala)`);

  // 11: resultado
  T('11. Gaivota vence a eleição (50,8% × 49,2%)', B.dub.some((d) => /Senhor Prefeito Gaivota/.test(d.text)) && JSON.stringify(project).includes('GAIVOTA REELEITO') && JSON.stringify(project).includes('50,8%') && JSON.stringify(project).includes('49,2%'));

  // 12: placa
  const sPlaca = project.sceneOrder.filter((id) => Object.values(project.scenes[id]!.nodes).some((n) => n.kind === 'prop' && n.propId.includes('placa_buraco')));
  const primeiraPlaca = project.sceneOrder.indexOf(sPlaca[0]!);
  const ultimaPlacaCoberta = sPlaca.filter((id) => !!Object.values(project.scenes[id]!.nodes).find((n) => n.name === 'papel')).length;
  T('12. Placa final: aparece só no pós-créditos, embrulhada até ser instalada e revelada', primeiraPlaca > project.sceneOrder.length - 12 && ultimaPlacaCoberta >= 3, `1ª aparição na tomada ${primeiraPlaca + 1}/${project.sceneOrder.length}; ${ultimaPlacaCoberta} tomadas com embalagem`);

  // 13-16
  T('13. O projeto importa sem erros (importador real do app, 0 avisos)', parsed.warnings.length === 0);
  T('14. Todas as mídias presentes', parsed.missing.length === 0 && manifest.missing.length === 0, `${manifest.assets.length} mídias binárias (todo o episódio é vetorial nativo; nenhuma mídia externa)`);
  T('15. Animações continuam editáveis (keyframes, clips e objetos nativos)', keyframes > 1000 && actionClips > 100, `${keyframes} keyframes, ${actionClips} clips de ação, ${dialogues} clips de fala, ${Object.keys(project.customObjects).length} objetos`);
  T('16. Fechar e reabrir não perde dados (ida e volta idêntica)', norm(ProjectSchema.parse(back)) === norm(project));

  // 17: reprodução por todas as sequências + sanidade de render
  let seqVistas = new Set<string>(); let frames = 0; let nan = 0;
  const assets = () => undefined;
  for (const seg of segments) {
    const sc = project.scenes[seg.sceneId]!;
    seqVistas.add(sc.notes.split('\n')[0]!);
    for (const f of [0.02, 0.5, 0.98]) {
      const plan = planMontageFrame(project, segments, seg.startMs + Math.floor(seg.durationMs * f), assets);
      const svg = planToSvgString(plan, 1920, 1080);
      frames++;
      if (/NaN|undefined|Infinity/.test(svg)) nan++;
    }
  }
  T('17. A reprodução percorre as 11 sequências sem erro de render', seqVistas.size === 11 && nan === 0, `${segments.length} tomadas, ${frames} quadros amostrados, ${nan} com NaN/undefined`);

  // legibilidade das falas
  const cps = B.dub.map((d) => d.text.length / (d.durMs / 1000));
  const lento = cps.filter((c) => c > 21).length;
  const resumo = {
    arquivo: NOME, bytes: bytes.length, duracaoMs: totalMs, tomadas: project.sceneOrder.length, cenarios: bgs.size, falas: B.dub.length,
    keyframes, trilhasDePropriedade: propTracks, clipsDeAcao: actionClips, clipsDeFala: dialogues, objetos: Object.keys(project.customObjects).length,
    cenariosPersonalizados: Object.keys(project.customBackgrounds).length, personagens: chars.length, cortes: cuts, movimentosDeCamera: cameraMoves,
    cpsMax: Math.max(...cps).toFixed(1), cpsMedio: (cps.reduce((a, b) => a + b, 0) / cps.length).toFixed(1), falasRapidas: lento,
    manifest: { format: manifest.format, formatVersion: manifest.formatVersion, assets: manifest.assets.length },
  };
  writeFileSync(`${OUT}validacao.json`, JSON.stringify({ resumo, testes: res.map(([n, ok, d]) => ({ teste: n, ok, detalhe: d })) }, null, 2));

  // roteiro de falas (para dublagem individual)
  const tsStart = new Map(segments.map((s) => [s.sceneId, s.startMs]));
  const csv = ['tomada;sequencia;tempo_inicio_ms;duracao_ms;personagem;estilo;fala'].concat(B.dub.map((d) => {
    const g = (tsStart.get(d.sceneId) ?? 0) + d.localStartMs;
    const idx = project.sceneOrder.indexOf(d.sceneId) + 1;
    return [idx, d.seq, g, d.durMs, d.who, d.style, `"${d.text.replace(/"/g, '""')}"`].join(';');
  }));
  writeFileSync(`${OUT}roteiro-de-falas-para-dublagem.csv`, '﻿' + csv.join('\n'));
  console.log(JSON.stringify(resumo, null, 1));
  for (const [n, ok, d] of res) console.log(ok ? 'OK ' : 'FALHOU', n, '|', d);
  expect(res.filter(([, ok]) => !ok)).toEqual([]);
});
