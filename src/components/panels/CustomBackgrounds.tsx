/** Seção "Meus cenários": cada cenário tem só os horários que o usuário cadastrar. */
import { useEffect, useRef, useState } from 'react';
import { newScenery, openSceneCreator } from '@/state/creatorActions';
import { Wand2 } from 'lucide-react';
import { BookmarkPlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { TIMES_OF_DAY, type CustomBackground, type Project, type TimeOfDay } from '@/engine/model/schema';
import { applyCustomBackground, availableTimes, createCustomBackground, customBackgroundUsage, deleteCustomBackground, TIME_LABELS } from '@/engine/world/customBackgrounds';
import { sceneOf } from '@/engine/model/ops';
import { deepClone, uid } from '@/engine/model/ids';
import { IMAGE_ACCEPT, importImageFile, previewAssetUrl, registerAssetBlob } from '@/features/library/assets';
import { commit, currentProject, useCurrentScene, useProject } from '@/state/projectStore';
import { confirmDialog, promptDialog, toast } from '@/state/uiStore';
import { repo, type LibraryRecord } from '@/storage/db';
import { IconButton } from '../controls/fields';

async function addVariantImage(cbId: string, time: TimeOfDay, file: File): Promise<void> {
  try {
    const { asset, report } = await importImageFile(file);
    const blob = await repo.getBlob(asset.id);
    if (blob) registerAssetBlob(asset.id, blob);
    commit(`Imagem de ${TIME_LABELS[time]}`, (d) => {
      d.assets[asset.id] = asset;
      const cb = (d as Project).customBackgrounds[cbId];
      if (cb) cb.variants[time] = { assetId: asset.id, fit: cb.variants[time]?.fit ?? 'cover' };
    });
    toast(report[0] ?? `${TIME_LABELS[time]}: imagem definida.`, report.length ? 'info' : 'success');
  } catch (e) {
    toast(`Não foi possível usar a imagem: ${e instanceof Error ? e.message : ''}`, 'error');
  }
}

export function CustomBackgroundsSection() {
  const project = useProject();
  const scene = useCurrentScene();
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<{ id: string; time: TimeOfDay } | null>(null);
  const [lib, setLib] = useState<LibraryRecord[]>([]);
  useEffect(() => { void repo.listLibrary('background').then(setLib); }, []);
  if (!project || !scene) return null;
  const list = Object.values(project.customBackgrounds);

  const create = async () => {
    const name = await promptDialog('Novo cenário', 'Nome do cenário', 'Meu cenário');
    if (!name) return;
    commit('Criar cenário', (d) => void createCustomBackground(d as Project, name));
    toast('Cenário criado. Escolha os horários e importe uma imagem para cada um que quiser.');
  };

  const card = (cb: CustomBackground) => {
    const times = availableTimes(cb);
    const active = scene.background.presetId === `custom:${cb.id}`;
    return (
      <div key={cb.id} className={`cbg-card${active ? ' is-active' : ''}`} data-testid="custom-bg" data-name={cb.name}>
        <div className="cbg-head">
          <strong>{cb.name}</strong>
          <IconButton label={`Renomear ${cb.name}`} onClick={async () => {
            const v = await promptDialog('Renomear cenário', 'Nome', cb.name);
            if (v) commit('Renomear cenário', (d) => { const c = (d as Project).customBackgrounds[cb.id]; if (c) c.name = v; });
          }}><Pencil size={13} /></IconButton>
          <IconButton label={`Salvar ${cb.name} na minha biblioteca`} disabled={!times.length} onClick={async () => {
            const assets = Object.fromEntries(times.map((t) => [cb.variants[t]!.assetId, deepClone(currentProject().assets[cb.variants[t]!.assetId])]));
            await repo.putLibrary({ id: uid('lib'), kind: 'background', name: cb.name, favorite: 0, createdAt: Date.now(), data: { background: deepClone(cb), assets } });
            setLib(await repo.listLibrary('background'));
            toast('Cenário salvo na sua biblioteca, para outros projetos.', 'success');
          }}><BookmarkPlus size={13} /></IconButton>
          <IconButton label={`Excluir ${cb.name}`} danger onClick={async () => {
            const used = customBackgroundUsage(currentProject(), cb.id);
            const ok = await confirmDialog({ title: 'Excluir cenário', message: used ? `"${cb.name}" é usado em ${used} cena(s); elas voltarão ao cenário neutro. Ctrl+Z desfaz.` : `Excluir "${cb.name}"? Ctrl+Z desfaz.`, confirmLabel: 'Excluir', danger: true });
            if (ok) commit('Excluir cenário', (d) => void deleteCustomBackground(d as Project, cb.id));
          }}><Trash2 size={13} /></IconButton>
        </div>
        <div className="cbg-times" role="group" aria-label={`Horários de ${cb.name}`}>
          {TIMES_OF_DAY.map((t) => {
            const v = cb.variants[t];
            const url = v ? previewAssetUrl(v.assetId) : undefined;
            return (
              <div key={t} className={`cbg-slot${v ? ' has-img' : ''}`}>
                <button type="button" className="cbg-slot-btn" data-testid={`cbg-slot-${t}`} aria-label={v ? `Trocar imagem de ${TIME_LABELS[t]}` : `Adicionar imagem de ${TIME_LABELS[t]}`} onClick={() => {
                  target.current = { id: cb.id, time: t };
                  fileRef.current?.click();
                }}>
                  {url ? <img src={url} alt="" /> : <Plus size={14} />}
                </button>
                <small>{TIME_LABELS[t]}</small>
                {v && <button type="button" className="cbg-remove" aria-label={`Remover ${TIME_LABELS[t]}`} onClick={() => commit(`Remover ${TIME_LABELS[t]}`, (d) => { const c = (d as Project).customBackgrounds[cb.id]; if (c) delete c.variants[t]; })}><X size={11} /></button>}
              </div>
            );
          })}
        </div>
        <button type="button" className="btn btn-sm btn-block" data-testid="scenery-open" onClick={() => openSceneCreator(cb.id, scene.background.presetId === `custom:${cb.id}` && scene.background.timeOfDay ? scene.background.timeOfDay : 'day')}><Wand2 size={13} /> Abrir no Criador de Cenários</button>
        <button type="button" className="btn btn-sm btn-block" data-testid="custom-bg-apply" disabled={!times.length} onClick={() => {
          commit('Usar cenário', (d) => {
            const c = (d as Project).customBackgrounds[cb.id];
            if (c) applyCustomBackground(sceneOf(d as Project, scene.id), c);
          });
        }}>{times.length ? (active ? 'Em uso nesta cena' : 'Usar nesta cena') : 'Adicione ao menos um horário'}</button>
      </div>
    );
  };

  const fromLib = lib.filter((r) => !project.customBackgrounds[(r.data as { background: CustomBackground }).background?.id]);
  return (
    <div className="cbg-section" data-testid="custom-bgs">
      <div className="cbg-title">
        <h3 className="group-title">Meus cenários</h3>
        <button type="button" className="btn btn-sm" data-testid="custom-bg-new" onClick={() => void create()}><Plus size={13} /> Por imagem</button>
        <button type="button" className="btn btn-sm btn-primary" data-testid="scenery-new" onClick={() => void newScenery()}><Wand2 size={13} /> Criar no estúdio</button>
      </div>
      {list.length === 0 && <p className="hint">Importe imagens PNG, JPG, WebP ou SVG. Cada cenário pode ter só os horários que você quiser.</p>}
      {list.map(card)}
      {fromLib.length > 0 && (
        <>
          <h3 className="group-title">Da minha biblioteca</h3>
          {fromLib.map((r) => (
            <div key={r.id} className="lib-row">
              <span className="lib-main"><strong>{r.name}</strong></span>
              <button type="button" className="btn btn-sm" onClick={async () => {
                const data = r.data as { background: CustomBackground; assets: Record<string, Project['assets'][string]> };
                for (const id of Object.keys(data.assets)) {
                  if (!(await repo.hasBlob(id))) {
                    toast('Algumas imagens desse cenário não estão mais neste navegador.', 'error');
                    return;
                  }
                  const blob = await repo.getBlob(id);
                  if (blob) registerAssetBlob(id, blob);
                }
                commit('Trazer cenário', (d) => {
                  Object.assign(d.assets, deepClone(data.assets));
                  (d as Project).customBackgrounds[data.background.id] = deepClone(data.background);
                });
              }}>Trazer</button>
            </div>
          ))}
        </>
      )}
      <input ref={fileRef} hidden type="file" accept={IMAGE_ACCEPT} data-testid="cbg-input" onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f && target.current) void addVariantImage(target.current.id, target.current.time, f);
      }} />
    </div>
  );
}
