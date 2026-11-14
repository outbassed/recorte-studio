/**
 * Pacotes de Vila Torta: itens REAIS dos episódios T1E1 e T1E2, exatamente como estão nos .jrec (IDs, desenhos e
 * notas preservados; ver data/provenance.json). Nenhum desenho novo foi criado aqui.
 * Personagens ainda sem aprovação (Ramires, Valentina, Rodrigues, pais dos protagonistas) NÃO estão em nenhum pacote.
 */
import { CharacterDefinitionSchema } from '@/engine/model/schema';
import type { BuildItem } from '@/features/packs/format';
import type { BackgroundBundle, ObjectBundle } from '@/features/library/bundles';
import type { PackSource } from '../../lib';
import backgrounds from './data/backgrounds.json';
import characters from './data/characters.json';
import objects from './data/objects.json';

const LICENSE = 'Vila Torta — obra original do autor do Recorte Studio. Uso nos seus projetos; licença de redistribuição pendente de definição do autor.';
const AUTHOR = 'Vila Torta';
const COLLECTION = 'Vila Torta';
const BASE = { author: AUTHOR, license: LICENSE, collection: COLLECTION, tags: ['vila torta', 'série'], dependencies: [] as Array<{ id: string; version: string }> };

const chars = (characters as unknown[]).map((c) => CharacterDefinitionSchema.parse(c));
const byName = (n: string) => {
  const c = chars.find((x) => x.name === n);
  if (!c) throw new Error(`Personagem de Vila Torta não encontrado: ${n}`);
  return c;
};

/** Campos "**Campo:** valor" das notas do personagem (texto original, sem reescrever). */
function noteFields(notes: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of notes.matchAll(/\*\*([^*:]+):\*\*\s*([^\n*]+)/g)) out[m[1]!.trim()] = m[2]!.trim();
  return out;
}
function describe(notes: string): string {
  const f = noteFields(notes);
  if (f['Nome completo']) {
    const parts = [f['Nome completo'], f['Apelido'] ? `apelido ${f['Apelido']}` : '', f['Cargo'] ?? '', f['Situação política'] ?? '', f['Idade'] ?? ''].filter(Boolean);
    return parts.join(' · ').slice(0, 300);
  }
  return notes.replace(/\s+/g, ' ').trim().slice(0, 300);
}
const AGE: Record<string, string> = { child: 'criança', teen: 'adolescente', adult: 'adulto', elder: 'idoso' };

const charItem = (name: string, sub: string, extra: string[] = []): BuildItem => {
  const c = byName(name);
  return { id: c.id, kind: 'character', name: c.name, data: c, meta: { category: 'Personagens', subcategory: sub, tags: ['vila torta', AGE[c.body.age] ?? '', ...extra].filter(Boolean), description: describe(c.notes) } };
};

/* Objetos: categoria e subcategoria por ID (os desenhos e IDs são os do episódio). */
type Meta = [category: string, subcategory: string, ...tags: string[]];
const OBJ_META: Record<string, Meta> = {
  obj_carro_corpo: ['Veículos', 'Carros', 'carro'], obj_carro_preto: ['Veículos', 'Carros', 'carro', 'fuga'], obj_viatura_corpo: ['Veículos', 'Viaturas', 'polícia', 'carro'],
  obj_caminhao: ['Veículos', 'Caminhões', 'prefeitura'], obj_roda: ['Veículos', 'Peças', 'roda'], obj_mola: ['Veículos', 'Peças', 'suspensão'],
  obj_bandeira_g: ['Política e campanha', 'Bandeiras', 'gaivota', 'animado'], obj_bandeira_p: ['Política e campanha', 'Bandeiras', 'pinote', 'animado'],
  obj_cartaz_g: ['Política e campanha', 'Cartazes', 'gaivota'], obj_cartaz_p: ['Política e campanha', 'Cartazes', 'pinote'],
  obj_poster_g: ['Política e campanha', 'Cartazes', 'gaivota', 'gráfica'], obj_poster_p: ['Política e campanha', 'Cartazes', 'pinote', 'gráfica'],
  obj_panfleto_g: ['Política e campanha', 'Panfletos', 'gaivota'], obj_panfleto_p: ['Política e campanha', 'Panfletos', 'pinote'],
  obj_cartaz_rua: ['Política e campanha', 'Cartazes', 'protesto'], obj_palanque: ['Política e campanha', 'Palanques e púlpitos', 'vitória'],
  obj_pulpito_g: ['Política e campanha', 'Palanques e púlpitos', 'gaivota', 'debate'], obj_pulpito_p: ['Política e campanha', 'Palanques e púlpitos', 'pinote', 'debate'],
  obj_pulpito_vitoria: ['Política e campanha', 'Palanques e púlpitos', 'vitória'], obj_painel_debate: ['Política e campanha', 'Debate', 'painel'],
  obj_bancada: ['Política e campanha', 'Debate', 'apresentador'], obj_urna: ['Política e campanha', 'Votação', 'eleição'],
  obj_cabine: ['Política e campanha', 'Votação', 'eleição'], obj_placa_secao: ['Política e campanha', 'Votação', 'placa', 'eleição'],
  obj_tv: ['Eletrônicos', 'Televisões', 'tv'], obj_tv_debate: ['Eletrônicos', 'Televisões', 'tv', 'debate', 'animado'],
  obj_celular: ['Eletrônicos', 'Celulares', 'celular'], obj_caixa_som: ['Eletrônicos', 'Som', 'show', 'animado'],
  obj_impressora: ['Eletrônicos', 'Gráfica', 'impressão', 'animado'],
  obj_coreto: ['Cenografia', 'Praça', 'coreto'], obj_palco: ['Cenografia', 'Palcos', 'show'], obj_bastidor_cortina: ['Cenografia', 'Palcos', 'cortina', 'bastidor'],
  obj_barraca_cafe: ['Cenografia', 'Barracas', 'café'], obj_barraca_hotdog: ['Cenografia', 'Barracas', 'comida'], obj_carrinho_vendedor: ['Cenografia', 'Barracas', 'vendedor'],
  obj_pilha_papel: ['Cenografia', 'Gráfica', 'papel'], obj_letreiro_grafica: ['Cenografia', 'Gráfica', 'letreiro'],
  obj_buraco: ['Urbano', 'Rua', 'asfalto'], obj_placa_buraco: ['Urbano', 'Placas', 'rua'], obj_placa_praca: ['Urbano', 'Placas', 'praça'],
  obj_salgado: ['Alimentos', 'Lanches', 'salgado'], obj_cachorro_quente: ['Alimentos', 'Lanches', 'cachorro-quente'],
  obj_cachorro: ['Animais', 'Cães', 'cachorro', 'animado'],
  obj_garrafa: ['Objetos pessoais', 'Garrafas', 'samuca'], obj_bola_volei: ['Objetos pessoais', 'Esportes', 'larissa', 'vôlei'],
  obj_ingresso: ['Objetos pessoais', 'Show', 'ingresso'], obj_cartaz_show: ['Política e campanha', 'Cartazes', 'show', 'lon ruan'], obj_faixa_show: ['Política e campanha', 'Cartazes', 'show', 'lon ruan'],
  obj_fita_metrica: ['Objetos pessoais', 'Fiscal da rua', 'seu norberto'], obj_multa: ['Objetos pessoais', 'Fiscal da rua', 'seu norberto'],
  obj_cracha: ['Objetos pessoais', 'Fiscal da rua', 'seu norberto'], obj_apito: ['Objetos pessoais', 'Fiscal da rua', 'seu norberto'],
  obj_copos: ['Objetos pessoais', 'Lixo e restos', 'evento'],
};

const objBundles = objects as unknown as ObjectBundle[];
const objItem = (id: string): BuildItem => {
  const b = objBundles.find((x) => x.object.id === id);
  const m = OBJ_META[id];
  if (!b || !m) throw new Error(`Objeto de Vila Torta sem dados ou sem categoria: ${id}`);
  const [category, subcategory, ...tags] = m;
  return { id, kind: 'object', name: b.object.name, data: b, meta: { category, subcategory, tags: ['vila torta', ...tags], description: '' } };
};

const bgBundles = backgrounds as unknown as BackgroundBundle[];
const bgItem = (name: string, description: string): BuildItem => {
  const b = bgBundles.find((x) => x.background.name === name);
  if (!b) throw new Error(`Cenário de Vila Torta não encontrado: ${name}`);
  return { id: b.background.id, kind: 'background', name, data: b, meta: { category: 'Cenários', subcategory: 'Vila Torta', tags: ['vila torta'], description } };
};

const GROUPS = {
  assets1: ['obj_bandeira_g', 'obj_bandeira_p', 'obj_cartaz_g', 'obj_cartaz_p', 'obj_poster_g', 'obj_poster_p', 'obj_panfleto_g', 'obj_panfleto_p', 'obj_cartaz_rua', 'obj_palanque', 'obj_pulpito_g', 'obj_pulpito_p', 'obj_pulpito_vitoria', 'obj_painel_debate', 'obj_bancada', 'obj_urna', 'obj_cabine', 'obj_placa_secao', 'obj_tv', 'obj_tv_debate', 'obj_impressora', 'obj_pilha_papel', 'obj_letreiro_grafica', 'obj_buraco', 'obj_placa_buraco', 'obj_placa_praca'],
  assets2: ['obj_cartaz_show', 'obj_faixa_show', 'obj_ingresso', 'obj_palco', 'obj_bastidor_cortina', 'obj_caixa_som', 'obj_celular', 'obj_barraca_cafe', 'obj_barraca_hotdog', 'obj_carrinho_vendedor', 'obj_coreto', 'obj_salgado', 'obj_cachorro_quente', 'obj_cachorro', 'obj_garrafa', 'obj_bola_volei', 'obj_fita_metrica', 'obj_multa', 'obj_cracha', 'obj_apito', 'obj_copos'],
  veiculos1: ['obj_carro_corpo', 'obj_carro_preto', 'obj_viatura_corpo', 'obj_caminhao', 'obj_roda', 'obj_mola'],
};

export const VILA_TORTA_SOURCES: Array<() => Promise<PackSource>> = [
  async () => ({
    meta: { ...BASE, id: 'vila-torta-personagens-1', name: 'Vila Torta · Personagens 1 (protagonistas e política)', version: '1.0.0', category: 'Personagens', volume: 1, description: 'Os cinco protagonistas e os dois políticos de Vila Torta, com o desenho e as fichas originais dos episódios T1E1 e T1E2.' },
    items: [charItem('Rafael', 'Protagonistas'), charItem('Beatriz', 'Protagonistas'), charItem('Caíque', 'Protagonistas'), charItem('Samuca', 'Protagonistas'), charItem('Larissa', 'Protagonistas'), charItem('Senhor Gaivota', 'Política', ['político', 'prefeito']), charItem('Doutor Pinote', 'Política', ['político', 'oposição'])],
    cover: 'vt-rafa',
  }),
  async () => ({
    meta: { ...BASE, id: 'vila-torta-personagens-2', name: 'Vila Torta · Personagens 2 (secundários)', version: '1.0.0', category: 'Personagens', volume: 2, description: 'Secundários com nome e função nos episódios: moradores, assessores, o apresentador, o cantor Lon Ruan e o Seu Norberto (o Fiscal da Rua).' },
    items: ['Dona Marta', 'Seu Agenor', 'Motorista', 'Assessor do Gaivota', 'Assessora do Pinote', 'Apresentador', 'Dono da gráfica', 'Funcionário da prefeitura A', 'Funcionário da prefeitura B', 'Vendedor ambulante', 'Lon Ruan', 'Seu Norberto', 'Dona Zefa', 'Rapaz da bicicleta', 'Dono do cachorro', 'Produtor do show', 'Repórter local'].map((n) => charItem(n, 'Secundários')),
  }),
  async () => ({
    meta: { ...BASE, id: 'vila-torta-personagens-3', name: 'Vila Torta · Personagens 3 (figurantes)', version: '1.0.0', category: 'Personagens', volume: 3, description: 'Eleitores, seguranças, policiais e as silhuetas dos grupos que aparecem de longe nos episódios.' },
    items: ['Eleitora 1', 'Eleitor 2', 'Eleitora 3', 'Eleitor 4', 'Eleitora 5', 'Eleitor 6', 'Segurança A', 'Segurança B', 'Policial A', 'Policial B', 'Integrante do grupo vermelho', 'Integrante do grupo cinza'].map((n) => charItem(n, 'Figurantes', ['figurante'])),
  }),
  async () => ({
    meta: { ...BASE, id: 'vila-torta-assets-1', name: 'Vila Torta · Assets 1 (campanha, debate e gráfica)', version: '1.0.0', category: 'Objetos', volume: 1, description: 'Bandeiras (animadas), cartazes, panfletos, púlpitos, urna, cabine, TV do debate, máquina de impressão e sinalização de rua do T1E1.' },
    items: GROUPS.assets1.map(objItem),
  }),
  async () => ({
    meta: { ...BASE, id: 'vila-torta-assets-2', name: 'Vila Torta · Assets 2 (o show e o fiscal)', version: '1.0.0', category: 'Objetos', volume: 2, description: 'Palco, caixa de som e cachorro animados, barracas, coreto, ingresso, crachá e bloco de multas do T1E2, mais itens pessoais dos protagonistas.' },
    items: GROUPS.assets2.map(objItem),
  }),
  async () => ({
    meta: { ...BASE, id: 'vila-torta-veiculos-1', name: 'Vila Torta · Veículos 1', version: '1.0.0', category: 'Veículos', volume: 1, description: 'O carro, o carro preto, a viatura e o caminhão da prefeitura, com as rodas e molas da suspensão como peças separadas.' },
    items: GROUPS.veiculos1.map(objItem),
  }),
  async () => ({
    meta: { ...BASE, id: 'vila-torta-cenarios-1', name: 'Vila Torta · Cenários 1', version: '1.0.0', category: 'Cenários', volume: 1, description: 'Os seis cenários dos episódios: pátio escolar, os dois camarins, a gráfica, o comitê do Pinote e os bastidores do palco.' },
    items: [bgItem('Pátio escolar', ''), bgItem('Camarim do Gaivota', ''), bgItem('Camarim do Pinote', ''), bgItem('Gráfica', ''), bgItem('Comitê do Pinote', ''), bgItem('Bastidores do palco', '')],
  }),
];
