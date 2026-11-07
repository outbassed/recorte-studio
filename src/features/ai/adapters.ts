/**
 * Adaptadores plugáveis. Só existem três caminhos e nenhum finge o que não é:
 *  - quick: regras locais, offline (não é IA);
 *  - ollama: servidor local configurado pelo usuário;
 *  - proxy: endpoint OpenAI-compatível do PRÓPRIO usuário, de preferência um backend
 *    que guarda a chave. Nenhum token é embutido no bundle nem salvo pelo app.
 */
import type { Project } from '@/engine/model/schema';
import { BACKGROUNDS } from '@/engine/world/backgrounds';
import { PROPS } from '@/engine/world/props';
import { ACTIONS } from '@/engine/animation/actions';
import { EXPRESSIONS } from '@/engine/character/expressions';
import { HAIR_STYLES } from '@/engine/character/hair';
import { BUILTIN_CHARACTERS } from '@/engine/character/presets';
import { TOPS, BOTTOMS } from '@/engine/character/catalog';
import { PlanSchema, type Plan } from './plan';
import { parseQuickCommand } from './quickCommands';

export interface AIContext { project: Project; sceneId: string; selectedName?: string; timeMs: number }

export interface AIAdapter {
  id: 'quick' | 'ollama' | 'proxy';
  label: string;
  generatePlan(prompt: string, ctx: AIContext, signal?: AbortSignal): Promise<Plan>;
}

export class AIError extends Error {}

export const quickAdapter: AIAdapter = {
  id: 'quick',
  label: 'Comandos rápidos (regras, sem IA)',
  generatePlan: async (prompt, ctx) => parseQuickCommand(prompt, ctx.project, ctx.sceneId, ctx.selectedName),
};

export function buildSystemPrompt(ctx: AIContext): string {
  const scene = ctx.project.scenes[ctx.sceneId];
  const nodes = scene ? Object.values(scene.nodes).map((n) => `${n.name} (${n.kind}, x=${Math.round(n.transform.x)})`) : [];
  return [
    'Você é o copiloto do editor de animação 2D Recorte Studio. Responda SOMENTE com um objeto JSON válido, sem explicações e sem cercas de código.',
    'Formato: {"summary": string, "actions": Action[]}. Nunca gere HTML, SVG, JS ou vídeo: apenas ações estruturadas.',
    'Tipos de Action:',
    '{type:"createCharacter",name,ref?,appearance:{age?:"child"|"teen"|"adult"|"elder",height?,build?,belly?,skin?,hairStyle?,hairColor?,mustache?,beard?,top?,topColor?,topPattern?,bottom?,bottomColor?,accessories?},addToScene?,x?}',
    '{type:"updateCharacter",character,appearance} | {type:"addCharacter",character,x?,scale?}',
    '{type:"createScene",name,background?,durationMs?} | {type:"setBackground",background,variant?:"day"|"night"} | {type:"setFormat",aspect:"16:9"|"9:16"|"1:1"|"4:3"|"3:4"}',
    '{type:"addProp",prop,ref?,x?,y?,scale?} | {type:"transform",node,x?,y?,scale?,rotation?,opacity?}',
    '{type:"layer",node,position:"front"|"back"|"inFrontOf"|"behind",relativeTo?}',
    '{type:"action",node,action,atMs?,durationMs?,targetX?,targetNode?,fromRight?,view?}',
    '{type:"say",node,text,atMs?,durationMs?} | {type:"look",node,target,atMs?,turnHead?} | {type:"expression",node,expression,atMs?}',
    '{type:"camera",zoom?,x?,y?,atMs?,durationMs?} | {type:"note",text}',
    `Cenários: ${BACKGROUNDS.map((b) => b.id).join(', ')}.`,
    `Objetos: ${PROPS.map((p) => p.id).join(', ')}.`,
    `Ações: walk, run, stop, enter, exit, talk, turn, look, lookAway, blink, openDoor, closeDoor, cameraZoom, cameraPan, ${ACTIONS.map((a) => a.id).join(', ')}.`,
    `Expressões: ${EXPRESSIONS.map((e) => e.id).join(', ')}.`,
    `Cabelos: ${HAIR_STYLES.map((h) => h.id).join(', ')}. Roupas de cima: ${TOPS.map((t) => t.id).join(', ')}. De baixo: ${BOTTOMS.map((t) => t.id).join(', ')}.`,
    `Elenco pronto: ${BUILTIN_CHARACTERS.map((c) => c.name).join(', ')}.`,
    'Coordenadas: origem no centro do quadro; X de -960 a 960 em 16:9. Tempos em milissegundos. Cores em hexadecimal #rrggbb.',
    'Se algo não existir nas listas, use a aproximação mais próxima e explique em uma ação "note". Nunca afirme ter criado arte nova.',
    `Cena atual: "${scene?.name}", duração ${scene?.durationMs} ms, cenário ${scene?.background.presetId}. Elementos: ${nodes.join('; ') || 'nenhum'}.`,
    `Tempo atual: ${Math.round(ctx.timeMs)} ms. Selecionado: ${ctx.selectedName ?? 'nada'}. Escreva falas em português do Brasil.`,
  ].join('\n');
}

/** Extrai e valida JSON da resposta. Texto do modelo nunca é executado. */
export function parseModelResponse(text: string): Plan {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AIError('O modelo não devolveu um JSON. Tente reformular o pedido.');
  let data: unknown;
  try {
    data = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new AIError('O modelo devolveu um JSON malformado.');
  }
  const parsed = PlanSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AIError(`O plano do modelo não passou na validação (${issue?.path.join('.')}: ${issue?.message}).`);
  }
  return parsed.data;
}

const connectionHelp = (url: string) =>
  `Não consegui conectar a ${url}. Confira se o serviço está rodando e se permite CORS desta origem (no Ollama: defina OLLAMA_ORIGINS).`;

export interface OllamaConfig { baseUrl: string; model: string }

export function ollamaAdapter(cfg: OllamaConfig, fetcher: typeof fetch = fetch.bind(globalThis)): AIAdapter {
  return {
    id: 'ollama',
    label: `Ollama local · ${cfg.model}`,
    async generatePlan(prompt, ctx, signal) {
      let res: Response;
      try {
        res = await fetcher(`${cfg.baseUrl.replace(/\/$/, '')}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({ model: cfg.model, stream: false, format: 'json', messages: [{ role: 'system', content: buildSystemPrompt(ctx) }, { role: 'user', content: prompt }] }),
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        throw new AIError(connectionHelp(cfg.baseUrl));
      }
      if (!res.ok) throw new AIError(`Ollama respondeu ${res.status}. O modelo "${cfg.model}" está instalado?`);
      const body = (await res.json()) as { message?: { content?: string } };
      return parseModelResponse(body.message?.content ?? '');
    },
  };
}

export async function listOllamaModels(baseUrl: string, fetcher: typeof fetch = fetch.bind(globalThis)): Promise<string[]> {
  let res: Response;
  try {
    res = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/tags`);
  } catch {
    throw new AIError(connectionHelp(baseUrl));
  }
  if (!res.ok) throw new AIError(`Ollama respondeu ${res.status}.`);
  const body = (await res.json()) as { models?: Array<{ name: string }> };
  return (body.models ?? []).map((m) => m.name);
}

export interface ProxyConfig { endpoint: string; model: string }

export function proxyAdapter(cfg: ProxyConfig, fetcher: typeof fetch = fetch.bind(globalThis)): AIAdapter {
  return {
    id: 'proxy',
    label: `Endpoint próprio · ${cfg.model}`,
    async generatePlan(prompt, ctx, signal) {
      let res: Response;
      try {
        res = await fetcher(cfg.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({ model: cfg.model, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: buildSystemPrompt(ctx) }, { role: 'user', content: prompt }] }),
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        throw new AIError(connectionHelp(cfg.endpoint));
      }
      if (!res.ok) throw new AIError(`O endpoint respondeu ${res.status}.`);
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return parseModelResponse(body.choices?.[0]?.message?.content ?? '');
    },
  };
}
