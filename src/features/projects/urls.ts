/** Endereços exclusivos por projeto, sem exigir servidor de rotas ou conta. */
import type { Project } from '@/engine/model/schema';

type ProjectIdentity = Pick<Project, 'id' | 'title'>;
export type RouteMode = 'push' | 'replace' | 'none';

export function projectSlug(title: string): string {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'projeto';
}

/** Parâmetros no endereço não expõem os dados do projeto (salvos no IndexedDB). */
export function getProjectIdFromUrl(url = window.location.href): string | null {
  const id = new URL(url).searchParams.get('projeto');
  return id && id.length <= 200 ? id : null;
}

export function projectLink(project: ProjectIdentity, fromUrl = window.location.href): string {
  const url = new URL(fromUrl);
  url.searchParams.set('projeto', project.id);
  url.searchParams.set('nome', projectSlug(project.title));
  url.hash = '';
  return url.toString();
}

export function projectsLink(fromUrl = window.location.href): string {
  const url = new URL(fromUrl);
  url.searchParams.delete('projeto');
  url.searchParams.delete('nome');
  url.hash = '';
  return url.toString();
}

function navigate(url: string, mode: RouteMode) {
  if (mode === 'none' || url === window.location.href) return;
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
}

export function updateProjectUrl(project: ProjectIdentity, mode: RouteMode = 'push'): void {
  navigate(projectLink(project), mode);
}

export function updateProjectsUrl(mode: RouteMode = 'push'): void {
  navigate(projectsLink(), mode);
}

export function copyProjectLink(project: ProjectIdentity): Promise<void> {
  return navigator.clipboard.writeText(projectLink(project));
}
