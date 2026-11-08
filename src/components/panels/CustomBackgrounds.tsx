/** Editor de um cenário personalizado (horários por imagem), aberto nos detalhes do catálogo. */
import { useRef } from 'react';
import { openSceneCreator } from '@/state/creatorActions';
import { Wand2 } from 'lucide-react';
import { Plus, X } from 'lucide-react';
import { TIMES_OF_DAY, type CustomBackground, type Project, type TimeOfDay } from '@/engine/model/schema';
import { applyCustomBackground, availableTimes, TIME_LABELS } from '@/engine/world/customBackgrounds';
import { sceneOf } from '@/engine/model/ops';
import { IMAGE_ACCEPT, importImageFile, previewAssetUrl, registerAssetBlob } from '@/features/library/assets';
import { commit, useCurrentScene } from '@/state/projectStore';
import { toast } from '@/state/uiStore';
import { repo } from '@/storage/db';

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

export function CustomBackgroundCard({ cb }: { cb: CustomBackground }) {
  const scene = useCurrentScene();
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<TimeOfDay | null>(null);
  if (!scene) return null;
  const times = availableTimes(cb);
  const active = scene.background.presetId === `custom:${cb.id}`;
  return (
    <div className={`cbg-card${active ? ' is-active' : ''}`} data-testid="custom-bg-editor" data-name={cb.name}>
      <div className="cbg-times" role="group" aria-label={`Horários de ${cb.name}`}>
        {TIMES_OF_DAY.map((t) => {
          const v = cb.variants[t];
          const url = v ? previewAssetUrl(v.assetId) : undefined;
          return (
            <div key={t} className={`cbg-slot${v ? ' has-img' : ''}`}>
              <button type="button" className="cbg-slot-btn" data-testid={`cbg-slot-${t}`} aria-label={v ? `Trocar imagem de ${TIME_LABELS[t]}` : `Adicionar imagem de ${TIME_LABELS[t]}`} onClick={() => {
                target.current = t;
                fileRef.current?.click();
              }}>
                {url ? <img src={url} alt="" /> : <Plus size={14} />}
              </button>
              <small>{TIME_LABELS[t]}{cb.compositions[t] ? ' ✎' : ''}</small>
              {v && <button type="button" className="cbg-remove" aria-label={`Remover imagem de ${TIME_LABELS[t]}`} onClick={() => commit(`Remover ${TIME_LABELS[t]}`, (d) => { const c = (d as Project).customBackgrounds[cb.id]; if (c) delete c.variants[t]; })}><X size={11} /></button>}
            </div>
          );
        })}
      </div>
      <p className="hint">Cada horário pode ter uma imagem (PNG, JPG, WebP ou SVG) ou uma composição do Criador de Cenários (✎), que tem prioridade.</p>
      <button type="button" className="btn btn-sm btn-block" data-testid="scenery-open" onClick={() => openSceneCreator(cb.id, active && scene.background.timeOfDay ? scene.background.timeOfDay : times[0] ?? 'day')}><Wand2 size={13} /> Abrir no Criador de Cenários</button>
      <button type="button" className="btn btn-sm btn-block btn-primary" data-testid="custom-bg-apply" disabled={!times.length} onClick={() => {
        commit('Usar cenário', (d) => {
          const c = (d as Project).customBackgrounds[cb.id];
          if (c) applyCustomBackground(sceneOf(d as Project, scene.id), c);
        });
      }}>{times.length ? (active ? 'Em uso nesta cena' : 'Usar nesta cena') : 'Adicione ao menos um horário'}</button>
      <input ref={fileRef} hidden type="file" accept={IMAGE_ACCEPT} data-testid="cbg-input" onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f && target.current) void addVariantImage(cb.id, target.current, f);
      }} />
    </div>
  );
}
