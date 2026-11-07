/** Entrada única de importação de JSON. Só interpreta dados: nunca executa nada. */
import { ProjectSchema, SCHEMA_VERSION, type Project } from '@/engine/model/schema';
import { uid } from '@/engine/model/ids';
import { migrate04, Project04Schema, type MigrationReport } from './from04';

export type { MigrationReport };

export const MAX_PROJECT_JSON_BYTES = 200 * 1024 * 1024;

export interface ImportResult {
  project: Project;
  report: MigrationReport | null;
}

export class ImportError extends Error {}

export function importProjectJson(text: string): ImportResult {
  if (text.length > MAX_PROJECT_JSON_BYTES) throw new ImportError('Arquivo grande demais (limite de 200 MB).');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('O arquivo não é um JSON válido.');
  }
  return importProjectData(data);
}

export function importProjectData(data: unknown): ImportResult {
  if (data === null || typeof data !== 'object') throw new ImportError('Conteúdo desconhecido.');
  const obj = data as Record<string, unknown>;
  if (obj.format === 'recorte-studio' || typeof obj.schemaVersion === 'number') {
    if (typeof obj.schemaVersion === 'number' && obj.schemaVersion > SCHEMA_VERSION) {
      throw new ImportError(`Este projeto foi criado em uma versão mais nova (schema ${obj.schemaVersion}). Atualize o Recorte Studio.`);
    }
    const parsed = ProjectSchema.safeParse(obj);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ImportError(`Projeto inválido em "${first?.path.join('.')}": ${first?.message}`);
    }
    // Referências internas precisam existir: uma ordem quebrada não pode corromper o app.
    const p = parsed.data;
    p.sceneOrder = p.sceneOrder.filter((id) => p.scenes[id]);
    if (p.sceneOrder.length === 0) throw new ImportError('O projeto não tem cenas válidas.');
    for (const s of Object.values(p.scenes)) s.layerOrder = s.layerOrder.filter((id) => s.nodes[id]);
    if (!p.currentSceneId || !p.scenes[p.currentSceneId]) p.currentSceneId = p.sceneOrder[0]!;
    return { project: p, report: null };
  }
  if (Project04Schema.safeParse(obj).success) {
    return migrate04(obj);
  }
  throw new ImportError('Formato não reconhecido. Use um JSON do Recorte Studio (0.3, 0.4 ou 1.0) ou um pacote .zip.');
}

/** Ao importar, gera novo id para não sobrescrever um projeto que já existe. */
export function withFreshProjectId(p: Project): Project {
  return { ...p, id: uid('proj'), updatedAt: Date.now() };
}
