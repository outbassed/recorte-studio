import { describe, expect, it } from 'vitest';
import { getProjectIdFromUrl, projectLink, projectsLink, projectSlug } from '@/features/projects/urls';

const origin = 'https://recorte-studio.vercel.app/';

describe('URLs individuais dos projetos', () => {
  it('usa o nome legível e um ID exclusivo para cada projeto', () => {
    const a = projectLink({ id: 'proj_abc', title: 'Minha Animação!' }, origin);
    const b = projectLink({ id: 'proj_xyz', title: 'Minha Animação!' }, origin);
    expect(a).not.toBe(b);
    expect(a).toBe(`${origin}?projeto=proj_abc&nome=minha-animacao`);
    expect(b).toContain('projeto=proj_xyz');
  });
  it('conserva o identificador quando o título muda', () => {
    const a = projectLink({ id: 'proj_abc', title: 'Antes' }, origin);
    const b = projectLink({ id: 'proj_abc', title: 'Depois' }, origin);
    expect(getProjectIdFromUrl(a)).toBe(getProjectIdFromUrl(b));
    expect(b).toContain('nome=depois');
  });
  it('volta para a biblioteca removendo só os parâmetros do projeto', () => {
    expect(projectsLink(`${origin}?tema=escuro&projeto=proj_abc&nome=teste`)).toBe(`${origin}?tema=escuro`);
    expect(getProjectIdFromUrl(origin)).toBeNull();
  });
  it('aceita nomes sem acentos e usa um valor padrão para símbolos', () => {
    expect(projectSlug('História da Nina & Zeca')).toBe('historia-da-nina-zeca');
    expect(projectSlug('🎬')).toBe('projeto');
  });
});
