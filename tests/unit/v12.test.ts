/** Regressões da 1.2. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateStep } from '@/components/timeline/SimpleTimeline';
import { previewAudio, previewState } from '@/features/audio/engine';
import { repo } from '@/storage/db';

describe('modo simples: validação de passos', () => {
  it.each([
    [null, 2, /Início inválido/],
    [Number.NaN, 2, /Início inválido/],
    [-1, 2, /negativo/],
    [0, 0, /maior que zero/],
    [0, -3, /maior que zero/],
    [0, 0.01, /mínima/],
    [1, null, /Duração inválida/],
    [4000, 1, /1 hora/],
  ])('início %s, duração %s → erro', (a, d, re) => {
    expect(validateStep(a as number | null, d as number | null)).toMatch(re);
  });
  it('valores válidos passam', () => {
    expect(validateStep(0, 0.05)).toBeNull();
    expect(validateStep(12.5, 3)).toBeNull();
  });
});

describe('pré-escuta de áudio', () => {
  afterEach(() => vi.restoreAllMocks());
  it('parar ou trocar enquanto o arquivo carrega descarta o carregamento antigo', async () => {
    const plays: string[] = [];
    class FakeAudio {
      paused = true;
      onended: (() => void) | null = null;
      constructor(public src: string) {}
      play() { this.paused = false; plays.push(this.src); return Promise.resolve(); }
      pause() { this.paused = true; }
    }
    vi.stubGlobal('Audio', FakeAudio);
    let n = 0;
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => `blob:${++n}`, revokeObjectURL: () => undefined }));
    const resolvers: Array<(b: Blob) => void> = [];
    vi.spyOn(repo, 'getBlob').mockImplementation(() => new Promise((ok) => resolvers.push(ok as (b: Blob) => void)));
    const first = previewAudio('media_a');
    const stop = previewAudio(null);
    resolvers[0]!(new Blob(['a']));
    expect(await first).toBe(false);
    expect(await stop).toBe(false);
    expect(plays).toEqual([]);
    const a = previewAudio('media_a');
    const b = previewAudio('media_b');
    resolvers[2]!(new Blob(['b']));
    resolvers[1]!(new Blob(['a']));
    expect(await b).toBe(true);
    expect(await a).toBe(false);
    expect(plays).toHaveLength(1);
    expect(previewState().playing).toBe(true);
    await previewAudio(null);
    expect(previewState().playing).toBe(false);
    vi.unstubAllGlobals();
  });
});
