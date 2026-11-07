/** Painel Mídias: biblioteca de áudio (voz, música, efeitos, ambiente) e imagens do projeto. */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BookmarkPlus, ImagePlus, Music, Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { Asset } from '@/engine/model/schema';
import { AUDIO_ACCEPT, IMAGE_ACCEPT, previewAssetUrl, type AudioCategory } from '@/features/library/assets';
import { matchesSearch } from '@/features/library/search';
import { previewAudio } from '@/features/audio/engine';
import { useProject } from '@/state/projectStore';
import { promptDialog } from '@/state/uiStore';
import { importImage } from '@/state/actions';
import {
  AUDIO_CATEGORIES, bringAudioFromUserLibrary, importAudioToLibrary, mediaUsage, relinkMedia, removeMedia, renameMedia, saveMediaToUserLibrary, placeAudioInScene, placeImageInScene,
} from '@/state/mediaActions';
import { repo, type LibraryRecord } from '@/storage/db';
import { IconButton, SearchBox } from '../controls/fields';
import { formatTime } from '../timeline/Timeline';

export function MediaPanel() {
  const project = useProject();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<AudioCategory | 'all' | 'images'>('all');
  const [importCat, setImportCat] = useState<AudioCategory>('voice');
  const [playing, setPlaying] = useState<string | null>(null);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [userLib, setUserLib] = useState<LibraryRecord[]>([]);
  const audioRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const relinkRef = useRef<HTMLInputElement>(null);
  const relinkTarget = useRef<string | null>(null);
  const assets = project ? Object.values(project.assets) : [];
  const ids = assets.map((a) => a.id).join('|');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: Record<string, boolean> = {};
      for (const id of ids.split('|').filter(Boolean)) out[id] = await repo.hasBlob(id);
      if (alive) setPresent(out);
    })();
    void repo.listLibrary('audio').then((r) => alive && setUserLib(r));
    return () => {
      alive = false;
      void previewAudio(null);
    };
  }, [ids]);

  if (!project) return null;
  const audios = assets.filter((a) => a.kind === 'audio');
  const images = assets.filter((a) => a.kind !== 'audio');
  const visibleAudio = audios.filter((a) => (cat === 'all' || a.category === cat || (!a.category && cat === 'sfx')) && matchesSearch(query, a.name));
  const visibleImages = images.filter((a) => (cat === 'all' || cat === 'images') && matchesSearch(query, a.name));
  const missing = assets.filter((a) => present[a.id] === false);

  const toggle = async (id: string) => {
    if (playing === id) {
      await previewAudio(null);
      setPlaying(null);
      return;
    }
    const ok = await previewAudio(id, () => setPlaying(null)).catch(() => false);
    setPlaying(ok ? id : null);
  };

  const row = (a: Asset) => {
    const used = mediaUsage(project, a.id);
    const isMissing = present[a.id] === false;
    return (
      <div key={a.id} className={`media-row${isMissing ? ' is-missing' : ''}`} data-testid="media-row" data-name={a.name}>
        {a.kind === 'audio' ? (
          <IconButton label={playing === a.id ? `Parar ${a.name}` : `Ouvir ${a.name}`} disabled={isMissing} onClick={() => void toggle(a.id)}>{playing === a.id ? <Pause size={15} /> : <Play size={15} />}</IconButton>
        ) : (
          previewAssetUrl(a.id) ? <img src={previewAssetUrl(a.id)} alt="" className="media-thumb" /> : <span className="media-thumb" />
        )}
        <div className="media-info">
          <strong title={a.name}>{a.name}</strong>
          <small>
            {isMissing ? <><AlertTriangle size={11} /> arquivo ausente</> : a.kind === 'audio' ? formatTime(a.durationMs ?? 0).slice(0, 5) : `${a.width ?? '?'}×${a.height ?? '?'}`}
            {' · '}{used ? `em uso ${used}×` : 'sem uso'}
          </small>
        </div>
        <IconButton label={`Usar ${a.name} na cena`} testId="media-use" disabled={isMissing} onClick={() => (a.kind === 'audio' ? placeAudioInScene(a.id) : placeImageInScene(a.id))}><Plus size={15} /></IconButton>
        <IconButton label={`Renomear ${a.name}`} onClick={async () => {
          const v = await promptDialog('Renomear mídia', 'Nome', a.name);
          if (v) renameMedia(a.id, v);
        }}><Pencil size={14} /></IconButton>
        <IconButton label={isMissing ? `Revincular ${a.name}` : `Substituir arquivo de ${a.name}`} testId="media-relink" onClick={() => {
          relinkTarget.current = a.id;
          if (relinkRef.current) {
            relinkRef.current.accept = a.kind === 'audio' ? AUDIO_ACCEPT : IMAGE_ACCEPT;
            relinkRef.current.click();
          }
        }}><RefreshCw size={14} /></IconButton>
        {a.kind === 'audio' && <IconButton label={`Salvar ${a.name} na minha biblioteca`} disabled={isMissing} onClick={() => void saveMediaToUserLibrary(a.id)}><BookmarkPlus size={14} /></IconButton>}
        <IconButton label={`Remover ${a.name}`} danger testId="media-remove" onClick={() => void removeMedia(a.id)}><Trash2 size={14} /></IconButton>
      </div>
    );
  };

  const libAudio = userLib.map((r) => (r.data as { asset?: Asset }).asset).filter((a): a is Asset => !!a && !project.assets[a.id] && matchesSearch(query, a.name));

  return (
    <div className="panel-col" data-testid="media-panel">
      <header className="panel-header"><h2>MÍDIAS DO PROJETO</h2><span className="count">{assets.length}</span></header>
      <div className="panel-sub">
        <div className="media-import">
          <select className="input input-sm" aria-label="Categoria do áudio a importar" data-testid="audio-category" value={importCat} onChange={(e) => setImportCat(e.target.value as AudioCategory)}>
            {AUDIO_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button type="button" className="btn btn-primary btn-sm" data-testid="media-import-audio" onClick={() => audioRef.current?.click()}><Music size={14} /> Importar áudio</button>
          <button type="button" className="btn btn-sm" onClick={() => imageRef.current?.click()}><ImagePlus size={14} /> Imagem</button>
        </div>
        <input ref={audioRef} hidden type="file" multiple accept={AUDIO_ACCEPT} data-testid="media-audio-input" onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void importAudioToLibrary(files, importCat);
        }} />
        <input ref={imageRef} hidden type="file" accept={IMAGE_ACCEPT} onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importImage(f);
        }} />
        <input ref={relinkRef} hidden type="file" data-testid="media-relink-input" onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f && relinkTarget.current) void relinkMedia(relinkTarget.current, f);
        }} />
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar mídia" />
        <div className="chip-row is-wrap" role="group" aria-label="Filtrar mídias">
          {([['all', 'Tudo'], ...AUDIO_CATEGORIES.map((c) => [c.id, c.label]), ['images', 'Imagens']] as Array<[typeof cat, string]>).map(([id, label]) => (
            <button key={id} type="button" className={`chip${cat === id ? ' is-active' : ''}`} aria-pressed={cat === id} onClick={() => setCat(id)}>{label}</button>
          ))}
        </div>
        {missing.length > 0 && <p className="warn-box" role="status" data-testid="media-missing">{missing.length} mídia(s) sem arquivo neste navegador. Use o botão de revincular.</p>}
      </div>
      <div className="panel-scroll">
        {cat !== 'images' && AUDIO_CATEGORIES.filter((c) => cat === 'all' || c.id === cat).map((c) => {
          const list = visibleAudio.filter((a) => (a.category ?? 'sfx') === c.id);
          if (!list.length) return null;
          return <div key={c.id}><h3 className="group-title">{c.label}</h3>{list.map(row)}</div>;
        })}
        {visibleImages.length > 0 && <div><h3 className="group-title">Imagens</h3>{visibleImages.map(row)}</div>}
        {visibleAudio.length === 0 && visibleImages.length === 0 && <p className="empty">Nenhuma mídia ainda. Use "Importar áudio" acima: o arquivo fica na biblioteca e você escolhe quando colocá-lo na cena.</p>}
        {libAudio.length > 0 && (
          <div>
            <h3 className="group-title">Da minha biblioteca (outros projetos)</h3>
            {libAudio.map((a) => (
              <div key={a.id} className="media-row">
                <Music size={15} />
                <div className="media-info"><strong>{a.name}</strong><small>{AUDIO_CATEGORIES.find((c) => c.id === a.category)?.label ?? 'Áudio'}</small></div>
                <button type="button" className="btn btn-sm" onClick={() => void bringAudioFromUserLibrary(a)}>Trazer</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
