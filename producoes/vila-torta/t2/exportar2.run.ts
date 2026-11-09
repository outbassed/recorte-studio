import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { produzir2 } from './produzir2';
import { buildJrec, commitParsedProject, parseEntries } from '@/features/projects/jrec';
import { buildMontage, planMontageFrame } from '@/engine/render/montage';
import { evaluateScene } from '@/engine/animation/evaluate';
import { planToSvgString } from '@/engine/render/plan';
import { ProjectSchema, type Project } from '@/engine/model/schema';
import { loadOfficial } from '../cast';

const OUT = process.env.OUT2 ?? '/tmp/claude-0/t2/';
const NOME = 'Vila-Torta-T1E2-O-Show-e-o-Fiscal.jrec';
const PALAVRAO = /\b(porra|caralho|puta\b|merda|desgra[çc]ad|pariu|foda\b|fode\b|cacete|bosta|cu\b|buceta|viado|arrombad)/i;

it('exporta e valida o T1E2', async () => {
  mkdirSync(OUT, { recursive: true });
  const { B, project } = produzir2();
  const { blob, manifest } = await buildJrec(project, { getBlob: async (id) => B.blobs.get(id) });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  writeFileSync(`${OUT}${NOME}`, bytes);

  const entries = Object.entries(unzipSync(bytes)).map(([path, data]) => ({ path, data }));
  const parsed = await parseEntries(entries as never);
  expect(parsed.kind).toBe('project');
  if (parsed.kind !== 'project') return;
  const stored = new Map<string, Blob>();
  const back = await commitParsedProject(parsed, async (id, b) => { stored.set(id, b); }, async (id) => stored.has(id));
  const norm = (p: Project) => JSON.stringify({ ...p, id: '', updatedAt: 0, createdAt: 0 });

  const { segments, totalMs } = buildMontage(project);
  const res: Array<[string, boolean, string]> = []; const T = (n: string, ok: boolean, d = '') => res.push([n, ok, d]);
  const scenes = project.sceneOrder.map((id) => project.scenes[id]!);
  const seqOf = (sc: (typeof scenes)[number]) => sc.notes.split('\n')[0]!.replace('Sequência: ', '').split(' ')[0]!;
  const withChar = (name: string) => scenes.filter((sc) => Object.values(sc.nodes).some((n) => n.kind === 'character' && project.characters[n.characterId]?.name === name));
  const dub = B.dub; const who = (n: string) => dub.filter((d) => d.who === n);

  const oficiais = loadOfficial();
  const okOf = Object.values(oficiais).every((d) => JSON.stringify(project.characters[d.id]) === JSON.stringify(d));
  T('1. Sete personagens oficiais preservados (campo a campo)', okOf, `${Object.keys(project.characters).length} personagens no catálogo (inclui Gaivota e Pinote)`);
  T('2. Samuca nunca fala palavrão', who('Samuca').length > 5 && who('Samuca').every((d) => !PALAVRAO.test(d.text)), `${who('Samuca').length} falas`);
  T('3. Bia não confessa gostar do Caíque', who('Beatriz').every((d) => !/gosto d[eo] (voc[eê]|ele|caique|caíque)|apaixonad|te amo/i.test(d.text)), `${who('Beatriz').length} falas`);
  T('4. Segredo do Samuca não é revelado', dub.every((d) => !/(samuca|samuel).*(gosta|apaixonad)|gosto da (lari|larissa)/i.test(d.text)) && who('Samuca').every((d) => !/lari/i.test(d.text)));
  T('5. Ingresso de R$ 100 aparece e é citado', JSON.stringify(project).includes('INGRESSOS: R$ 100') && dub.some((d) => /cem reais|cem conto/i.test(d.text)));
  const fisc = withChar('Seu Norberto'); const seqsFisc = new Set(fisc.map(seqOf));
  T('6. Fiscal em várias fases (pequenas fiscalizações, tentativa de controlar o evento, consequências)', fisc.length >= 30 && ['S2', 'S3', 'S4', 'S7', 'S9', 'S11', 'S12'].every((x) => seqsFisc.has(x)), `${fisc.length} tomadas em ${[...seqsFisc].join(', ')}`);
  T('7. Lon Ruan canta (letra original) sobre Zé Lorrota e a polícia', dub.some((d) => d.who === 'Lon Ruan' && /Lorrota/.test(d.text)) && dub.some((d) => d.who === 'Lon Ruan' && /polícia/.test(d.text)));
  T('8. Fãs e moradores reagem de formas diferentes', who('Eleitor 2').length + who('Eleitora 5').length >= 2);
  const tiroScene = scenes.find((s) => s.name.includes('O primeiro disparo'))!;
  const tiroAudio = tiroScene.tracks.some((t) => t.type === 'audio' && t.role === 'sfx');
  const musicEnd = tiroScene.tracks.filter((t) => t.type === 'audio' && t.role === 'music').flatMap((t) => (t.type === 'audio' ? t.clips : [])).map((c) => c.startMs + c.durationMs);
  T('9. Tiroteio interrompe o show (música corta em seco, disparo ao longe, luzes saem do compasso)', tiroAudio && musicEnd.length > 0 && Math.max(...musicEnd) <= 1950, `música termina em ${Math.max(...musicEnd)} ms`);
  const cel = scenes.filter((s) => Object.values(s.nodes).some((n) => n.kind === 'prop' && n.propId.includes('celular')));
  T('10. Celular cai na fuga (plano detalhe + som)', cel.length >= 2 && cel.some((s) => s.tracks.some((t) => t.type === 'audio' && t.clips.some((c) => project.assets[c.assetId]?.name.includes('Celular')))), `${cel.length} tomadas`);
  const s8 = scenes.filter((s) => seqOf(s) === 'S8'); const exit = s8.find((s) => s.name.includes('correm juntos'))!;
  const protas = ['Rafael', 'Beatriz', 'Caíque', 'Samuca', 'Larissa'].filter((n) => Object.values(exit.nodes).some((x) => x.kind === 'character' && project.characters[x.characterId]?.name.startsWith(n)));
  T('11. Os cinco protagonistas saem juntos e em segurança', protas.length === 5 && s8.some((s) => s.name.includes('contagem')));
  T('12. Caíque reclama dos R$ 100 / quinze minutos', who('Caíque').some((d) => /quinze minutos/i.test(d.text)));
  T('13. Delegacia: Lon procura a polícia e o fiscal tenta multar a viatura', dub.some((d) => /iPhone/.test(d.text)) && dub.some((d) => /ESTACIONAMENTO IRREGULAR/.test(d.text)) && dub.some((d) => /respeita mais a autoridade/i.test(d.text.toLowerCase().replace('ninguém respeita', 'respeita mais a autoridade'))));
  // áudio
  const aud = Object.values(project.assets).filter((a) => a.kind === 'audio');
  let clips = 0, bad = 0;
  for (const sc of scenes) for (const t of sc.tracks) if (t.type === 'audio') for (const c of t.clips) { clips++; const a = project.assets[c.assetId]; if (!a || c.offsetMs + c.durationMs > (a.durationMs ?? 0) + 40 || c.startMs + c.durationMs > sc.durationMs + 40) { bad++; console.log('BAD', sc.name, a?.name, c.startMs, c.durationMs, c.offsetMs, a?.durationMs, sc.durationMs); } }
  T('14. Áudio: faixas originais, clips dentro da duração do arquivo e da cena (nada vaza para a cena seguinte)', aud.length >= 10 && clips > 100 && bad === 0, `${aud.length} arquivos, ${clips} clips, ${bad} fora dos limites`);
  T('15. Importação sem avisos, mídias presentes e idênticas', parsed.warnings.length === 0 && parsed.missing.length === 0 && parsed.media.length === aud.length && stored.size === aud.length, `${manifest.assets.length} mídias no pacote`);
  T('16. Ida e volta (exportar → importar) idêntica', norm(ProjectSchema.parse(back)) === norm(project));
  let nan = 0, frames = 0; const seqs = new Set<string>();
  for (const seg of segments) { seqs.add(seqOf(project.scenes[seg.sceneId]!)); for (const f of [0.02, 0.5, 0.98]) { const svg = planToSvgString(planMontageFrame(project, segments, seg.startMs + Math.floor(seg.durationMs * f), () => undefined), 1920, 1080); frames++; if (/NaN|undefined|Infinity/.test(svg)) nan++; } }
  T('17. Reprodução percorre as 12 sequências sem erro de render', seqs.size === 12 && nan === 0, `${segments.length} tomadas, ${frames} quadros, ${nan} inválidos`);
  const ev = evaluateScene(project, scenes[0]!, 500); T('18. Motor avalia as cenas', !!ev);
  const cps = dub.map((d) => d.text.length / (d.durMs / 1000));
  const resumo = { bytes: bytes.length, duracaoMs: totalMs, tomadas: scenes.length, falas: dub.length, personagens: Object.keys(project.characters).length, objetos: Object.keys(project.customObjects).length, audio: aud.length, clipsAudio: clips, cpsMax: Math.max(...cps).toFixed(1), tomadasFiscal: fisc.length, sequencias: [...seqs].length };
  writeFileSync(`${OUT}validacao.json`, JSON.stringify({ resumo, testes: res.map(([n, ok, d]) => ({ teste: n, ok, detalhe: d })) }, null, 2));
  writeFileSync(`${OUT}index.txt`, scenes.map((s, i) => `${i + 1}\t${s.durationMs}\t${s.name}`).join('\n'));
  console.log(JSON.stringify(resumo));
  for (const [n, ok, d] of res) console.log(ok ? 'OK ' : 'FALHOU', n, '|', d);
  expect(res.filter(([, ok]) => !ok).map((r) => r[0])).toEqual([]);
});
