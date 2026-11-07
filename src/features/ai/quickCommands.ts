/**
 * "Comandos rápidos": interpretador por REGRAS, offline. Não é IA e o app diz isso.
 * Reconhece um vocabulário limitado e gera o mesmo Plano estruturado dos adaptadores.
 */
import { ACTIONS } from '@/engine/animation/actions';
import { ACCESSORIES, TOPS, PATTERNS } from '@/engine/character/catalog';
import { EXPRESSIONS } from '@/engine/character/expressions';
import { HAIR_STYLES } from '@/engine/character/hair';
import { BACKGROUNDS } from '@/engine/world/backgrounds';
import { PROPS } from '@/engine/world/props';
import { normalizeText as norm } from '@/features/library/search';
import type { Project, Scene } from '@/engine/model/schema';
import type { Appearance, Plan, PlanAction } from './plan';

const COLORS: Array<[string, string]> = [
  ['branc', '#f4f1ea'], ['grisalh', '#b6b4b9'], ['prat', '#c9ccd2'], ['pret', '#17141a'], ['castanh', '#5c3b28'], ['marrom', '#6a4a33'], ['loir', '#e6c478'], ['ruiv', '#b5502f'],
  ['vermelh', '#d65f5f'], ['azul', '#5b8dbe'], ['verde', '#6dad6f'], ['amarel', '#f2c95c'], ['rosa', '#d27ba6'], ['rox', '#8e6fc1'], ['laranja', '#e98f4e'], ['cinza', '#9aa3ad'],
];
const SKIN: Array<[string, string]> = [['clara', '#fbe0c8'], ['branca', '#f2c9a5'], ['morena', '#b97f55'], ['parda', '#d49a6e'], ['escura', '#7a4a30'], ['negra', '#5a3524']];

const colorIn = (text: string): string | undefined => COLORS.find(([k]) => text.includes(k))?.[1];

const NUM_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5 };

function parseSeconds(t: string): number | undefined {
  const m = t.match(/(?:segundo|aos|no segundo|em)\s*(\d+(?:[.,]\d+)?)\s*(?:s\b|seg|segundos?)?/) ?? t.match(/(\d+(?:[.,]\d+)?)\s*(?:s\b|seg|segundos?)/);
  return m ? parseFloat(m[1]!.replace(',', '.')) * 1000 : undefined;
}

function appearanceFromText(t: string): Appearance {
  const a: Appearance = {};
  const hairColor = t.match(/cabelos?\s+(?:\w+\s+){0,2}?(branc\w*|grisalh\w*|pret\w*|castanh\w*|loir\w*|ruiv\w*|vermelh\w*|azul|verde|ros\w*|rox\w*|prat\w*)/);
  if (hairColor) a.hairColor = colorIn(hairColor[1]!);
  for (const st of [...HAIR_STYLES].sort((x, y) => Math.max(...y.keywords.map((k) => k.length)) - Math.max(...x.keywords.map((k) => k.length)))) {
    if (st.keywords.some((k) => t.includes(norm(k)))) {
      a.hairStyle = st.id;
      break;
    }
  }
  if (/\bbigod/.test(t)) a.mustache = /\bbigodao|grosso/.test(t) ? 'thick' : 'thick';
  if (/\bbarb(a|udo)/.test(t)) a.beard = /longa/.test(t) ? 'long' : /por fazer|rala/.test(t) ? 'stubble' : 'full';
  if (/cavanhaque/.test(t)) a.beard = 'goatee';
  if (/baixinh|baixa\b|baixo\b/.test(t)) a.height = 0.8;
  if (/\balt[oa]\b/.test(t) && !/para o alto/.test(t)) a.height = 1.15;
  if (/gordinh|robust|fort[ea]\b|gordo|gorda/.test(t)) {
    a.build = 1.3;
    a.belly = 0.7;
  }
  if (/magr[oa]/.test(t)) a.build = 0.78;
  if (/idos|senhor|velh|vovo|avo\b/.test(t)) a.age = 'elder';
  if (/crianc|menin|alun/.test(t)) a.age = 'child';
  if (/adolescent|jovem/.test(t)) a.age = 'teen';
  const skin = t.match(/pele\s+(\w+)/);
  if (skin) a.skin = SKIN.find(([k]) => skin[1]!.startsWith(k.slice(0, 4)))?.[1];
  for (const top of [...TOPS].sort((x, y) => (y.keywords?.[0]?.length ?? 0) - (x.keywords?.[0]?.length ?? 0))) {
    const hit = top.keywords?.find((k) => new RegExp(`\\b${norm(k)}\\b`).test(t));
    if (hit) {
      a.top = top.id;
      const after = t.slice(t.indexOf(norm(hit)));
      const col = after.split(/[,.]| e /)[0] ?? '';
      const c = colorIn(col.slice(norm(hit).length));
      if (c) a.topColor = c;
      for (const pat of PATTERNS) {
        if (pat.keywords?.some((k) => col.includes(norm(k)))) a.topPattern = pat.id as Appearance['topPattern'];
      }
      break;
    }
  }
  const acc = ACCESSORIES.filter((o) => o.keywords?.some((k) => new RegExp(`\\b${norm(k)}\\b`).test(t))).map((o) => o.id);
  const uniqueGlasses = acc.includes('sunglasses') ? acc.filter((x) => x !== 'glasses') : acc;
  if (uniqueGlasses.length) a.accessories = uniqueGlasses;
  return a;
}

function findNamedNodes(scene: Scene | undefined, t: string): Array<{ name: string; at: number }> {
  if (!scene) return [];
  const out: Array<{ name: string; at: number }> = [];
  for (const n of Object.values(scene.nodes)) {
    const at = t.indexOf(norm(n.name));
    if (at >= 0) out.push({ name: n.name, at });
  }
  return out.sort((a, b) => a.at - b.at);
}

function findBackground(t: string): string | undefined {
  const scored = BACKGROUNDS.flatMap((b) => b.keywords.map((k) => ({ id: b.id, k: norm(k) }))).filter(({ k }) => new RegExp(`\\b${k}\\b`).test(t)).sort((a, b) => b.k.length - a.k.length);
  return scored[0]?.id;
}

function findProp(t: string): (typeof PROPS)[number] | undefined {
  const scored = PROPS.flatMap((p) => p.keywords.map((k) => ({ p, k: norm(k) }))).filter(({ k }) => new RegExp(`\\b${k}\\b`).test(t)).sort((a, b) => b.k.length - a.k.length);
  return scored[0]?.p;
}

const quotes = (raw: string) => [...raw.matchAll(/["“']([^"”']{2,300})["”']/g)].map((m) => m[1]!);

export function parseQuickCommand(raw: string, project: Project, sceneId: string, selectedName?: string): Plan {
  const t = norm(raw);
  const scene = project.scenes[sceneId];
  const actions: PlanAction[] = [];
  const named = findNamedNodes(scene, t);
  const speech = quotes(raw);
  const first = named[0]?.name ?? selectedName;
  const second = named[1]?.name;

  // 7. "Crie uma cena vertical de 15 segundos para TikTok"
  const createsScene = /(cri[ea]|adicione|nova|monte|faca)\b.*\bcena\b/.test(t) || /\bnova cena\b/.test(t);
  const wantsVertical = /vertical|tiktok|reels|shorts|9[:x ]16/.test(t);
  const secondsForScene = t.match(/(\d+)\s*(?:s\b|seg|segundos?)/);
  let refScene = false;
  if (createsScene) {
    const bg = findBackground(t);
    const dur = secondsForScene ? parseInt(secondsForScene[1]!, 10) * 1000 : 8000;
    const quoted = speech[0];
    const name = quoted ?? (bg ? `Cena: ${BACKGROUNDS.find((b) => b.id === bg)?.label}` : wantsVertical ? 'Cena vertical' : 'Nova cena');
    actions.push({ type: 'createScene', name, background: bg, durationMs: dur });
    refScene = true;
  }
  if (wantsVertical) actions.push({ type: 'setFormat', aspect: '9:16' });

  // 3. "... com 3 alunos e professor"
  const alunos = t.match(/(\d+|um|uma|dois|duas|tres|quatro|cinco)\s+alun[oa]s?/);
  if (alunos) {
    const qty = /\d/.test(alunos[1]!) ? parseInt(alunos[1]!, 10) : NUM_WORDS[alunos[1]!] ?? 1;
    const cast = ['Caio', 'Luma', 'Bia', 'Rafa', 'Caio'];
    const xs = [-470, 0, 470, -230, 230];
    for (let i = 0; i < Math.min(qty, 5); i++) actions.push({ type: 'addCharacter', character: cast[i]!, x: xs[i] });
  }
  if (/professor/.test(t)) {
    actions.push({ type: 'addCharacter', character: 'Dra. Marta', x: -640, scale: 1 });
    actions.push({ type: 'note', text: 'Usei a personagem Dra. Marta como professora. Você pode trocar a roupa no Criador.' });
  }

  // Criar personagem: "Crie um senhor baixinho, cabelo branco..."
  const createsCharacter = /(cri[ea]|faca|adicione|novo|nova)\s+(um|uma|o|a)?\s*(senhor|senhora|personagem|menino|menina|homem|mulher|idos[oa]|rapaz|moca|velho|velha|crianca|garot[oa])/.test(t);
  let actor = first;
  if (createsCharacter && !alunos) {
    const named2 = raw.match(/(?:chamad[oa]|nome(?: de)?)\s+([A-ZÀ-Ý][\wÀ-ÿ]+)/);
    const noun = t.match(/(senhora|senhor|menina|menino|homem|mulher|idosa|idoso|rapaz|moca|velha|velho|crianca|garota|garoto)/)?.[1];
    const name = named2?.[1] ?? (noun ? noun[0]!.toUpperCase() + noun.slice(1) : 'Novo personagem');
    const app = appearanceFromText(t.split(/\bfaca\b|\be faca\b/)[0] ?? t);
    actions.push({ type: 'createCharacter', ref: name, name, appearance: app, addToScene: true });
    actor = name;
    // Honestidade: o que o pedido citou e a biblioteca não tem.
  } else if (!createsScene && /\bcabelo|\bcabelos|\bbigod|\bbarb|\bcamisa|\bcamiseta|\bvestido|\bjaqueta|\boculos|\bchapeu|\bbone\b/.test(t) && !/faca .*falar/.test(t)) {
    // 1. "Coloque cabelo branco na Nina" → identidade da biblioteca
    if (actor) {
      const app = appearanceFromText(t);
      if (Object.keys(app).length) actions.push({ type: 'updateCharacter', character: actor, appearance: app });
    } else {
      actions.push({ type: 'note', text: 'Selecione um personagem ou cite o nome dele para alterar a aparência.' });
    }
  }

  // Cenário sem criar cena: "mude o cenário para praia"
  if (!createsScene && /cenario|fundo/.test(t)) {
    const bg = findBackground(t);
    if (bg) actions.push({ type: 'setBackground', background: bg, variant: /noite|noturn/.test(t) ? 'night' : undefined });
  }

  // 8. "Troque a expressão de bravo para surpreso no segundo 4"
  if (/express|fica|fique|ficar|cara de/.test(t)) {
    const para = t.split(/\bpara\b/).pop() ?? t;
    const scope = /\bpara\b/.test(t) ? para : t;
    const hit = EXPRESSIONS.find((e) => [e.label, ...e.keywords].some((k) => new RegExp(`\\b${norm(k)}\\b`).test(scope)));
    if (hit && (actor || /express/.test(t))) {
      actions.push({ type: 'expression', node: actor ?? 'selecionado', expression: hit.id, atMs: parseSeconds(t) });
    }
  }

  // 5. "Aumente a mesa para 120% e traga ela para frente da Nina"
  const pct = t.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const prop = findProp(t);
  const existingProp = prop && scene ? Object.values(scene.nodes).find((n) => n.kind === 'prop' && n.propId === prop.id) : undefined;
  const propName = existingProp?.name ?? (prop ? prop.label : undefined);
  if (pct && /aument|diminu|escala|tamanho|reduz/.test(t)) {
    const who = propName ?? actor;
    if (who) actions.push({ type: 'transform', node: who, scale: parseFloat(pct[1]!.replace(',', '.')) / 100 });
  }
  if (/(adicione|coloque|ponha|inclua)\b/.test(t) && prop && !existingProp) {
    actions.push({ type: 'addProp', prop: prop.id, ref: prop.label });
  }
  if (/(para|pra|na)\s+(a\s+)?frente\s+d[aeo]/.test(t) || /(atras|por tras)\s+d[aeo]/.test(t)) {
    const behind = /(atras|por tras)\s+d[aeo]/.test(t);
    const moved = propName ?? named[0]?.name;
    const relative = named.find((n) => n.name !== moved)?.name;
    if (moved && relative) actions.push({ type: 'layer', node: moved, position: behind ? 'behind' : 'inFrontOf', relativeTo: relative });
  }

  // 2. "Faça Zeca olhar para Nina e virar o nariz na direção dela"
  const refNode = actor ?? selectedName;
  if (/\bolh(ar|a|e)\b/.test(t) && refNode) {
    const target = named.find((n) => n.name !== refNode)?.name ?? (second && second !== refNode ? second : undefined);
    if (target) actions.push({ type: 'look', node: refNode, target, turnHead: !/so os olhos|somente os olhos/.test(t), atMs: parseSeconds(t) });
    else if (/olhar para a camera|olhe para a camera/.test(t)) actions.push({ type: 'note', text: 'O olhar para a câmera é o padrão: nada a alterar.' });
  }

  // 6. "Deixe a câmera aproximar lentamente durante a fala"
  if (/camera/.test(t) && /(aproxim|zoom|afast)/.test(t)) {
    let start: number | undefined = 0;
    let dur = /lent/.test(t) ? 4000 : 1500;
    if (/durante a fala/.test(t) && scene) {
      const clip = scene.tracks.flatMap((x) => (x.type === 'dialogue' ? x.clips : []))[0];
      if (clip) {
        start = clip.startMs;
        dur = clip.durationMs;
      } else {
        actions.push({ type: 'note', text: 'Não há fala nesta cena: apliquei a aproximação a partir de 0 s.' });
      }
    }
    actions.push({ type: 'camera', zoom: /afast/.test(t) ? 0.85 : 1.35, atMs: start, durationMs: dur });
  }

  // 4 e pedido do senhor: sequências de ações na ordem do texto
  const subject = actor ?? selectedName;
  if (subject && !createsScene || (subject && refScene && !alunos)) {
    let cursor = parseSeconds(t) ?? 300;
    const steps: Array<{ at: number; run: () => void }> = [];
    const verb = (re: RegExp, run: () => void) => {
      const m = t.match(re);
      if (m?.index !== undefined) steps.push({ at: m.index, run });
    };
    const advance = (ms: number) => { cursor += ms; };
    verb(/\b(entr(ar|a|e)|cheg(ar|a|ue))\b/, () => {
      const fromRight = /direita/.test(t) ? true : /esquerda/.test(t) ? false : undefined;
      actions.push({ type: 'action', node: subject, action: 'enter', atMs: cursor, durationMs: 2000, fromRight, targetX: fromRight === false ? -300 : fromRight ? 300 : undefined });
      advance(2100);
    });
    verb(/\b(andar|caminhar|ande|anda)\b(?!\s+de)/, () => {
      const dest = findProp(t);
      const node = dest && scene ? Object.values(scene.nodes).find((n) => n.kind === 'prop' && n.propId === dest.id) : undefined;
      const relative = named.find((n) => n.name !== subject)?.name;
      actions.push({ type: 'action', node: subject, action: 'walk', atMs: cursor, durationMs: 1800, targetNode: node?.name ?? relative, targetX: node || relative ? undefined : 200 });
      advance(1900);
    });
    verb(/\b(correr|corre|corra)\b/, () => {
      actions.push({ type: 'action', node: subject, action: 'run', atMs: cursor, durationMs: 1500, targetX: 500 });
      advance(1600);
    });
    for (const a of ACTIONS) {
      if (['walk', 'run', 'gesture', 'phone'].includes(a.id)) continue;
      const re = new RegExp(`\\b(${a.keywords.map(norm).join('|')})\\b`);
      verb(re, () => {
        actions.push({ type: 'action', node: subject, action: a.id, atMs: cursor });
        advance(a.duration + 80);
      });
    }
    verb(/\b(fal(ar|a|e)|diz(er)?|respond(er|e)|pergunt(ar|a))\b/, () => {
      const text = speech[0] ?? 'Olá!';
      actions.push({ type: 'say', node: subject, text, atMs: cursor });
      if (!speech[0]) actions.push({ type: 'note', text: 'Sem texto entre aspas: usei "Olá!" como fala.' });
      advance(Math.max(1000, text.length * 62 + 400));
    });
    steps.sort((a, b) => a.at - b.at).forEach((s) => s.run());
  }

  if (actions.length === 0) {
    actions.push({ type: 'note', text: 'Não reconheci esse comando. Os Comandos rápidos entendem pedidos simples sobre aparência, olhar, câmera, camadas, ações e novas cenas. Para frases livres, conecte uma IA em Direção → Configurar.' });
  }
  return { summary: 'Plano gerado por regras locais (sem IA).', actions };
}
