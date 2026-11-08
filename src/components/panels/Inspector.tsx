/**
 * Inspector contextual. Todo campo numérico usa SliderNumberField e o esquema único
 * de propriedades. Se a propriedade tem keyframes, a edição grava um key no tempo atual.
 */
import { Diamond, Layers, Trash2, UserRound, Wand2 } from 'lucide-react';
import { createContext, useContext, useRef, useState } from 'react';
import { HelpLink } from '../manual/HelpLink';
import { customObjectIdOf, isCustomObjectId } from '@/engine/world/pieces';
import { openObjectCreator } from '@/state/creatorActions';
import {
  ACTION_PRESETS, addDialogue, applyBackground, applyPose, bakeActionClip, deleteClip, deleteKeyframe, ensurePropertyTrack, extendToFit, findClip, findPropertyTrack, insertAction, moveLayer, readProperty, sceneOf, setKeyframe, writeProperty,
} from '@/engine/model/ops';
import { BACKGROUNDS, getBackground } from '@/engine/world/backgrounds';
import { getProp } from '@/engine/world/props';
import { getPropertyDef, formatKeyValue } from '@/engine/model/properties';
import { decompose, localMatrix, parentOptions, setParent } from '@/engine/model/hierarchy';

/** Muda o pivô sem o desenho pular: recalcula x/y para a mesma matriz (giro e escala mantidos). */
function movePivot(n: SceneNode, px: number, py: number): void {
  const m = localMatrix(n.transform);
  n.transform.pivotX = px;
  n.transform.pivotY = py;
  const d = decompose(m, px, py);
  n.transform.x = d.x;
  n.transform.y = d.y;
}
import { addSectionKeys, animatablePaths, keyTime, previewRemoveSectionKeys, removeSectionKeys, sectionKeyState, type AddSectionKeysResult, type KeyOwner, type RemoveSectionKeysResult } from '@/engine/model/sectionKeys';
import { CAMERA_TARGET, type AnyClip, type CharacterNode, type KeyValue, type Keyframe, type Project, type PropertyTrack, type Scene, type SceneNode, type Transition } from '@/engine/model/schema';
import { EXPRESSIONS, VISEMES } from '@/engine/character/expressions';
import { POSES } from '@/engine/character/presets';
import { VIEW_LABELS, VIEW_ORDER } from '@/engine/character/views';
import { BUBBLE_STYLES } from '@/engine/render/bubbles';
import { beginGroup, commit, currentProject, endGroup, useCurrentScene, useProject } from '@/state/projectStore';
import { extractSequence, FRAMING_PRESETS, frameCamera, type FramingPreset } from '@/engine/model/ops';
import { applyCustomBackground, availableTimes, customIdOf, isCustomPreset, resolveCustomVariant, TIME_LABELS } from '@/engine/world/customBackgrounds';
import { getAction } from '@/engine/animation/actions';
import { uid } from '@/engine/model/ids';
import { repo } from '@/storage/db';
import type { TimeOfDay } from '@/engine/model/schema';
import { seek, transport, useTransport } from '@/state/transport';
import { confirmDialog, openContextMenu, promptDialog, useUI, toast } from '@/state/uiStore';
import { deleteSelection } from '@/state/actions';
import { ColorField, IconButton, Section, SelectField, TextField, ToggleField, useLongPress } from '../controls/fields';
import { SliderNumberField } from '../controls/SliderNumberField';
import { ScrollStrip } from '../controls/ScrollStrip';

const useTimeMs = () => useTransport((s) => (s.playing ? -1 : s.timeMs));
const nowMs = () => transport.getState().timeMs;

function PropField({ scene, target, kind, path, label, testId }: { scene: Scene; target: string; kind: SceneNode['kind'] | 'camera'; path: string; label?: string; testId?: string }) {
  const def = getPropertyDef(kind, path);
  const t = useTimeMs();
  if (!def) return null;
  const time = t < 0 ? nowMs() : t;
  const value = Number(readProperty(scene, target, path, time) ?? 0);
  const track = findPropertyTrack(scene, target, path);
  const hasKeyHere = !!track?.keyframes.some((k) => k.timeMs === Math.round(time));
  return (
    <SliderNumberField
      label={label ?? def.label}
      value={value}
      min={def.min}
      max={def.max}
      sliderMin={def.sliderMin}
      sliderMax={def.sliderMax}
      step={def.step}
      unit={def.unit}
      display={def.display}
      decimals={def.decimals}
      testId={testId ?? `prop-${path}`}
      onGestureStart={() => beginGroup(`${target}-${path}`)}
      onGestureEnd={endGroup}
      onChange={(v) => commit(`Alterar ${def.label}`, (d) => writeProperty(sceneOf(d as Project, scene.id), target, path, v, nowMs(), def), { coalesce: `${target}-${path}` })}
      extra={<KeyButton scene={scene} target={target} path={path} active={hasKeyHere} animated={!!track?.keyframes.length} label={def.label} />}
    />
  );
}

function KeyButton({ scene, target, path, active, animated, label }: { scene: Scene; target: string; path: string; active: boolean; animated: boolean; label: string }) {
  return (
    <button
      type="button"
      className={`key-btn${active ? ' is-on' : animated ? ' is-animated' : ''}`}
      aria-pressed={active}
      aria-label={`${active ? 'Remover' : 'Criar'} keyframe de ${label} no tempo atual`}
      title={`${active ? 'Remover' : 'Criar'} keyframe no tempo atual`}
      data-testid={`key-${path}`}
      onClick={() => {
        const t = Math.round(nowMs());
        const value = readProperty(scene, target, path, t);
        commit(active ? 'Remover keyframe' : 'Criar keyframe', (d) => {
          const s = sceneOf(d as Project, scene.id);
          const track = ensurePropertyTrack(s, target, path);
          const existing = track.keyframes.find((k) => k.timeMs === t);
          if (existing) deleteKeyframe(s, track.id, existing.id);
          else setKeyframe(track, t, value as KeyValue);
        });
      }}
    >
      <Diamond size={11} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

/**
 * Keyframe universal da seção: cria, no instante atual, os keyframes que faltam em TODAS as propriedades
 * animáveis que a seção mostra. Não remove nada, não duplica e não sobrescreve; é uma única ação no histórico.
 * Só aparece quando a seção tem 2 ou mais propriedades animáveis (com uma só, o botão do campo basta).
 */
function SectionKeys({ id, scene, target, kind, paths }: { id: string; scene: Scene; target: string; kind: KeyOwner; paths: readonly string[] }) {
  const t = useTimeMs();
  const list = animatablePaths(kind, paths);
  // Toque longo abre o menu; o clique que vem ao soltar o dedo não pode criar keyframes.
  const fired = useRef(false);
  const longPress = useLongPress((x, y) => { fired.current = true; menu(x, y); });
  if (list.length < 2) return null;
  const time = t < 0 ? nowMs() : t;
  const st = sectionKeyState(scene, target, list, time);
  const hint = 'Criar keyframes de todas as propriedades desta seção';
  const removeHint = 'Shift+clique (ou toque longo) remove só os keyframes desta seção neste instante';
  const summary = st.status === 'all' ? `as ${st.total} propriedades já têm keyframe neste instante` : st.status === 'partial' ? `${st.withKey} de ${st.total} já têm keyframe neste instante` : 'nenhuma tem keyframe neste instante';
  const secs = (ms: number) => (ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const create = () => {
    const at = keyTime(nowMs());
    if (st.missing.length === 0 && keyTime(time) === at) {
      toast(`Todas as propriedades desta seção já têm keyframe em ${secs(at)} s. Nada foi alterado.`);
      return;
    }
    const out: { r: AddSectionKeysResult | null } = { r: null };
    commit('Criar keyframes da seção', (d) => { out.r = addSectionKeys(sceneOf(d as Project, scene.id), target, kind, list, at); });
    const r = out.r;
    if (!r) return;
    toast(`${r.created.length} keyframe(s) criado(s) em ${secs(at)} s${r.kept.length ? `; ${r.kept.length} já existia(m) e foi(ram) mantido(s)` : ''}.`, 'success');
  };
  const remove = async () => {
    const at = keyTime(nowMs());
    const plan = previewRemoveSectionKeys(currentProject().scenes[scene.id] ?? scene, target, kind, list, at);
    if (!plan.removed.length) {
      toast(plan.locked.length ? `Os keyframes desta seção em ${secs(at)} s estão em faixas trancadas. Nada foi alterado.` : `Nenhuma propriedade desta seção tem keyframe em ${secs(at)} s. Nada foi alterado.`);
      return;
    }
    // Risco: propriedade que perde a animação inteira volta ao valor-base. Pergunta antes.
    if (plan.emptied.length) {
      const ok = await confirmDialog({
        title: 'Remover keyframes da seção',
        message: `${plan.removed.length} keyframe(s) em ${secs(at)} s serão removidos. Em ${plan.emptied.length} propriedade(s) ele é o único keyframe: a animação delas acaba e o valor volta ao valor-base. Ctrl+Z desfaz.`,
        confirmLabel: 'Remover', danger: true,
      });
      if (!ok) return;
    }
    const out: { r: RemoveSectionKeysResult | null } = { r: null };
    commit('Remover keyframes da seção', (d) => { out.r = removeSectionKeys(sceneOf(d as Project, scene.id), target, kind, list, at); });
    const r = out.r;
    if (r) toast(`${r.removed.length} keyframe(s) removido(s) em ${secs(at)} s. Os outros instantes não mudaram.${r.locked.length ? ` ${r.locked.length} em faixa trancada ficou(aram).` : ''}`, 'success');
  };
  const menu = (x: number, y: number) => openContextMenu({ x, y, title: 'Keyframes da seção', items: [
    { label: 'Criar os que faltam neste instante', onSelect: create },
    { label: 'Remover os deste instante', danger: true, disabled: st.withKey === 0, onSelect: () => void remove() },
  ] });
  return (
    <button
      type="button"
      className={`key-btn section-key is-${st.status}${st.animated ? ' is-animated' : ''}`}
      aria-pressed={st.status === 'all' ? 'true' : st.status === 'partial' ? 'mixed' : 'false'}
      aria-label={`${hint}. Neste instante: ${summary}. ${removeHint}.`}
      title={`${hint} (${summary}). ${removeHint}.`}
      data-testid={`section-keys-${id}`}
      data-status={st.status}
      data-count={`${st.withKey}/${st.total}`}
      {...longPress}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); menu(e.clientX, e.clientY); }}
      onClick={(e) => {
        e.stopPropagation();
        if (fired.current) { fired.current = false; return; }
        if (e.shiftKey) void remove();
        else create();
      }}
    >
      <Diamond size={13} fill={st.status === 'none' ? 'none' : 'currentColor'} fillOpacity={st.status === 'partial' ? 0.4 : 1} />
    </button>
  );
}

const TRANSFORM_KEYS = ['transform.x', 'transform.y', 'transform.scaleX', 'transform.scaleY', 'transform.rotationDeg', 'opacity'] as const;
const RIG_KEYS = ['armLUpper', 'armLLower', 'armRUpper', 'armRLower', 'legLUpper', 'legLLower', 'legRUpper', 'legRLower', 'torsoLean', 'headTilt', 'headNod', 'bodyY', 'sit'] as const;
const LIMB_DEPTH_KEYS = ['limbDepth.armL', 'limbDepth.handL', 'limbDepth.armR', 'limbDepth.handR'] as const;

function DiscreteField({ scene, target, path, label, options, testId }: { scene: Scene; target: string; path: string; label: string; options: Array<{ id: string; label: string }>; testId?: string }) {
  const t = useTimeMs();
  const time = t < 0 ? nowMs() : t;
  const value = String(readProperty(scene, target, path, time) ?? '');
  const track = findPropertyTrack(scene, target, path);
  const hasKeyHere = !!track?.keyframes.some((k) => k.timeMs === Math.round(time));
  return (
    <div className="field-with-key">
      <SelectField label={label} value={value} options={options} testId={testId ?? `prop-${path}`} onChange={(v) => commit(`Alterar ${label}`, (d) => writeProperty(sceneOf(d as Project, scene.id), target, path, v, nowMs()))} />
      <KeyButton scene={scene} target={target} path={path} active={hasKeyHere} animated={!!track?.keyframes.length} label={label} />
    </div>
  );
}

function UniformScale({ scene, target, kind }: { scene: Scene; target: string; kind: SceneNode['kind'] }) {
  const def = getPropertyDef(kind, 'transform.scaleX')!;
  const t = useTimeMs();
  const time = t < 0 ? nowMs() : t;
  const v = Number(readProperty(scene, target, 'transform.scaleX', time) ?? 1);
  return (
    <SliderNumberField
      label="Escala"
      value={v}
      min={def.min}
      max={def.max}
      sliderMin={def.sliderMin}
      sliderMax={def.sliderMax}
      step={1}
      unit="%"
      display={100}
      decimals={1}
      testId="prop-scale"
      onGestureStart={() => beginGroup(`${target}-scale`)}
      onGestureEnd={endGroup}
      onChange={(val) => commit('Alterar escala', (d) => {
        const s = sceneOf(d as Project, scene.id);
        const sign = Number(readProperty(s as Scene, target, 'transform.scaleX', nowMs())) < 0 ? -1 : 1;
        writeProperty(s, target, 'transform.scaleX', Math.abs(val) * sign || val, nowMs(), def);
        writeProperty(s, target, 'transform.scaleY', val, nowMs(), def);
      }, { coalesce: `${target}-scale` })}
    />
  );
}

function CommonNodeSections({ scene, node }: { scene: Scene; node: SceneNode }) {
  const set = (label: string, fn: (n: SceneNode) => void) => commit(label, (d) => {
    const n = sceneOf(d as Project, scene.id).nodes[node.id];
    if (n) fn(n);
  });
  const idx = scene.layerOrder.indexOf(node.id);
  const mv = (how: 'up' | 'down' | 'top' | 'bottom') => commit('Mover camada', (d) => void moveLayer(sceneOf(d as Project, scene.id), node.id, how));
  return (
    <>
      <Pane tab="Transformar">
      <Section title="Posição e transformação" testId="sec-transform" actions={<SectionKeys id="transform" scene={scene} target={node.id} kind={node.kind} paths={TRANSFORM_KEYS} />}>
        <PropField scene={scene} target={node.id} kind={node.kind} path="transform.x" />
        <PropField scene={scene} target={node.id} kind={node.kind} path="transform.y" />
        <UniformScale scene={scene} target={node.id} kind={node.kind} />
        <PropField scene={scene} target={node.id} kind={node.kind} path="transform.rotationDeg" />
        <PropField scene={scene} target={node.id} kind={node.kind} path="opacity" />
        <div className="btn-row">
          <button type="button" className="btn btn-sm" onClick={() => commit('Centralizar', (d) => writeProperty(sceneOf(d as Project, scene.id), node.id, 'transform.x', 0, nowMs()))}>Centro horizontal</button>
          <button type="button" className="btn btn-sm" onClick={() => commit('Centralizar', (d) => writeProperty(sceneOf(d as Project, scene.id), node.id, 'transform.y', 0, nowMs()))}>Centro vertical</button>
        </div>
      </Section>
      <Section title="Escala separada e pivô" actions={<SectionKeys id="scale" scene={scene} target={node.id} kind={node.kind} paths={['transform.scaleX', 'transform.scaleY']} />}>
        <PropField scene={scene} target={node.id} kind={node.kind} path="transform.scaleX" />
        <PropField scene={scene} target={node.id} kind={node.kind} path="transform.scaleY" />
        <SliderNumberField label="Pivô X" unit="px" testId="pivot-x" value={node.transform.pivotX} sliderMin={-600} sliderMax={600} onChange={(v) => set('Alterar pivô', (n) => movePivot(n, v, n.transform.pivotY))} />
        <SliderNumberField label="Pivô Y" unit="px" testId="pivot-y" value={node.transform.pivotY} sliderMin={-600} sliderMax={600} onChange={(v) => set('Alterar pivô', (n) => movePivot(n, n.transform.pivotX, v))} />
        <p className="hint">O pivô é o centro de giro e escala{node.kind === 'group' ? ' e o lugar da bolinha laranja que move o grupo no palco' : ''}. Mudar o pivô não mexe no desenho.</p>
      </Section>
      </Pane>
      <Pane tab="Camadas">
      <Section title="Vínculo (grupo pai)" testId="sec-parent">
        <SelectField
          label="Vinculado a"
          testId="node-parent"
          value={node.parentId ?? ''}
          options={[{ id: '', label: 'Nada (solto na cena)' }, ...parentOptions(scene, node.id).map((g) => ({ id: g.id, label: g.name }))]}
          onChange={(v) => {
            let err: string | null = null;
            commit(v ? 'Vincular ao grupo' : 'Desvincular', (d) => { err = setParent(sceneOf(d as Project, scene.id), node.id, v || null); });
            if (err) toast(err, 'error');
            else toast(v ? 'Vinculado: acompanha o grupo (posição, giro, escala e keyframes) e mantém as próprias animações.' : 'Solto na cena, no mesmo lugar.');
          }}
        />
        <p className="hint">Para um barco com passageiros: agrupe o barco (ou anime o grupo) e vincule os personagens a ele. Eles acompanham o balanço e continuam acenando, falando e piscando. Vincular e soltar não muda a posição na tela.</p>
      </Section>
      <Section title="Profundidade, sombra e máscara" actions={<SectionKeys id="depth" scene={scene} target={node.id} kind={node.kind} paths={['parallax', 'blur']} />}>
        <PropField scene={scene} target={node.id} kind={node.kind} path="parallax" />
        <PropField scene={scene} target={node.id} kind={node.kind} path="blur" />
        <ToggleField label="Escala pela profundidade" hint="Quanto mais abaixo no palco, maior (ative na cena)." checked={node.useDepthScale} onChange={(v) => set('Profundidade', (n) => { n.useDepthScale = v; })} />
        <ToggleField label="Sombra no chão" checked={node.shadow.enabled} onChange={(v) => set('Sombra', (n) => { n.shadow.enabled = v; })} />
        {node.shadow.enabled && (
          <>
            <SliderNumberField label="Opacidade da sombra" unit="%" display={100} min={0} max={1} sliderMin={0} sliderMax={100} value={node.shadow.opacity} onChange={(v) => set('Sombra', (n) => { n.shadow.opacity = v; })} />
            <SliderNumberField label="Tamanho da sombra" unit="%" display={100} min={0} max={5} sliderMin={0} sliderMax={300} value={node.shadow.size} onChange={(v) => set('Sombra', (n) => { n.shadow.size = v; })} />
            <SliderNumberField label="Deslocamento da sombra" unit="px" sliderMin={-200} sliderMax={200} value={node.shadow.offsetX} onChange={(v) => set('Sombra', (n) => { n.shadow.offsetX = v; })} />
          </>
        )}
        <ToggleField label="Máscara 2D (recorte)" checked={node.mask.enabled} onChange={(v) => set('Máscara', (n) => { n.mask.enabled = v; })} />
        {node.mask.enabled && (
          <>
            <SelectField label="Forma da máscara" value={node.mask.kind} options={[{ id: 'rect', label: 'Retângulo' }, { id: 'ellipse', label: 'Elipse' }]} onChange={(v) => set('Máscara', (n) => { n.mask.kind = v as 'rect' | 'ellipse'; })} />
            <SliderNumberField label="Máscara X" unit="px" sliderMin={-800} sliderMax={800} value={node.mask.x} onChange={(v) => set('Máscara', (n) => { n.mask.x = v; })} />
            <SliderNumberField label="Máscara Y" unit="px" sliderMin={-1000} sliderMax={500} value={node.mask.y} onChange={(v) => set('Máscara', (n) => { n.mask.y = v; })} />
            <SliderNumberField label="Máscara largura" unit="px" min={1} sliderMin={10} sliderMax={1500} value={node.mask.width} onChange={(v) => set('Máscara', (n) => { n.mask.width = v; })} />
            <SliderNumberField label="Máscara altura" unit="px" min={1} sliderMin={10} sliderMax={1500} value={node.mask.height} onChange={(v) => set('Máscara', (n) => { n.mask.height = v; })} />
          </>
        )}
      </Section>
      <Section title="Camada" testId="sec-layer">
        <TextField label="Nome" value={node.name} testId="node-name" onChange={(v) => set('Renomear', (n) => { n.name = v; })} />
        <div className="btn-row">
          <button type="button" className="btn btn-sm" disabled={idx >= scene.layerOrder.length - 1} onClick={() => mv('up')}>Subir</button>
          <button type="button" className="btn btn-sm" disabled={idx <= 0} onClick={() => mv('down')}>Descer</button>
          <button type="button" className="btn btn-sm" disabled={idx >= scene.layerOrder.length - 1} onClick={() => mv('top')}>Topo</button>
          <button type="button" className="btn btn-sm" disabled={idx <= 0} onClick={() => mv('bottom')}>Fundo</button>
        </div>
        <ToggleField label="Visível" checked={node.visible} onChange={(v) => set('Visibilidade', (n) => { n.visible = v; })} />
        <ToggleField label="Bloqueada" hint="Não move no palco." checked={node.locked} onChange={(v) => set('Bloqueio', (n) => { n.locked = v; })} />
      </Section>
      <button type="button" className="btn btn-danger btn-block" data-testid="delete-node" onClick={() => void deleteSelection()}><Trash2 size={15} /> Excluir camada</button>
      </Pane>
    </>
  );
}

const DEPTH_OPTIONS = [{ id: 'auto', label: 'Automático' }, { id: 'front', label: 'Na frente da cabeça' }, { id: 'behind', label: 'Atrás da cabeça' }];
/** Profundidade de braços e mãos: lados do personagem, não da tela. Animável por keyframes. */
function ArmDepthSection({ scene, node }: { scene: Scene; node: CharacterNode }) {
  return (
    <Section title="Braços e mãos: frente ou atrás da cabeça" testId="sec-limb-depth" actions={<><SectionKeys id="limb-depth" scene={scene} target={node.id} kind="character" paths={LIMB_DEPTH_KEYS} /><HelpLink chapter="poses" label="Ajuda sobre profundidade dos braços" /></>}>
      <p className="hint">Esquerdo e direito são os lados do personagem. No automático, o braço que cruza a cabeça passa na frente dela.</p>
      <DiscreteField scene={scene} target={node.id} path="limbDepth.armL" label="Braço esquerdo" testId="depth-armL" options={DEPTH_OPTIONS} />
      <DiscreteField scene={scene} target={node.id} path="limbDepth.handL" label="Mão esquerda" testId="depth-handL" options={DEPTH_OPTIONS} />
      <DiscreteField scene={scene} target={node.id} path="limbDepth.armR" label="Braço direito" testId="depth-armR" options={DEPTH_OPTIONS} />
      <DiscreteField scene={scene} target={node.id} path="limbDepth.handR" label="Mão direita" testId="depth-handR" options={DEPTH_OPTIONS} />
    </Section>
  );
}

const VIEW_OPTIONS = [{ id: 'auto', label: 'Automática' }, ...VIEW_ORDER.map((v) => ({ id: v, label: VIEW_LABELS[v] }))];

function CharacterSections({ scene, node, project }: { scene: Scene; node: CharacterNode; project: Project }) {
  const set = (label: string, fn: (n: CharacterNode) => void) => commit(label, (d) => {
    const n = sceneOf(d as Project, scene.id).nodes[node.id];
    if (n?.kind === 'character') fn(n);
  });
  const def = project.characters[node.characterId];
  const others = Object.values(scene.nodes).filter((n) => n.id !== node.id);
  const [action, setAction] = useState('wave');
  const [speech, setSpeech] = useState('');
  // Os mesmos campos que a seção mostra agora: alvo e ponto só existem em alguns modos de olhar.
  const gazePaths = ['bodyView', 'headView', 'gaze.mode', ...(node.gaze.mode === 'node' ? ['gaze.targetId'] : []), ...(node.gaze.mode === 'point' || node.gaze.mode === 'manual' ? ['gaze.x', 'gaze.y'] : []), 'gaze.strength', 'gaze.headStrength', 'blinkMode'];
  const hairColor = node.appearanceOverrides.hairColor ?? def?.hair.color ?? '#3a2b28';
  const topColor = node.appearanceOverrides.topColor ?? def?.outfit.topColor ?? '#5b8dbe';
  return (
    <>
      <Pane tab="Rosto">
      <Section title="Personagem" testId="sec-identity">
        <p className="hint">Biblioteca: <strong>{def?.name ?? 'Personagem removido'}</strong>. Editar a biblioteca muda todas as cenas; sobrescrever muda só esta instância.</p>
        <button type="button" className="btn btn-block" data-testid="edit-library" onClick={() => useUI.setState({ dialog: 'creator', creatorCharacterId: node.characterId })}><UserRound size={15} /> Editar personagem da biblioteca</button>
        <details className="details">
          <summary>Sobrescrever nesta cena</summary>
          <ColorField label="Cabelo (só nesta cena)" value={hairColor} onChange={(v) => set('Sobrescrever cor', (n) => { n.appearanceOverrides.hairColor = v; })} />
          <ColorField label="Roupa (só nesta cena)" value={topColor} onChange={(v) => set('Sobrescrever cor', (n) => { n.appearanceOverrides.topColor = v; })} />
          <button type="button" className="btn btn-sm" onClick={() => set('Limpar sobrescritas', (n) => { n.appearanceOverrides = {}; })}>Voltar ao original</button>
        </details>
      </Section>
      <Section title="Orientação e olhar" testId="sec-gaze" actions={<SectionKeys id="gaze" scene={scene} target={node.id} kind="character" paths={gazePaths} />}>
        <DiscreteField scene={scene} target={node.id} path="bodyView" label="Vista do corpo" options={VIEW_OPTIONS} />
        <DiscreteField scene={scene} target={node.id} path="headView" label="Vista da cabeça" options={VIEW_OPTIONS} />
        <DiscreteField scene={scene} target={node.id} path="gaze.mode" label="Olhar" testId="gaze-mode" options={[{ id: 'camera', label: 'Para a câmera' }, { id: 'node', label: 'Para um elemento' }, { id: 'point', label: 'Para um ponto X/Y' }, { id: 'manual', label: 'Manual' }, { id: 'none', label: 'Sem alvo' }]} />
        {node.gaze.mode === 'node' && (
          <DiscreteField scene={scene} target={node.id} path="gaze.targetId" label="Alvo do olhar" options={[{ id: '', label: 'Nenhum' }, ...others.map((o) => ({ id: o.id, label: o.name }))]} />
        )}
        {(node.gaze.mode === 'point' || node.gaze.mode === 'manual') && (
          <>
            <PropField scene={scene} target={node.id} kind="character" path="gaze.x" />
            <PropField scene={scene} target={node.id} kind="character" path="gaze.y" />
          </>
        )}
        <PropField scene={scene} target={node.id} kind="character" path="gaze.strength" />
        <ToggleField label="Cabeça acompanha o alvo" hint="Com a vista da cabeça em automática." testId="follow-head" checked={node.gaze.followHead} onChange={(v) => set('Cabeça acompanha', (n) => { n.gaze.followHead = v; })} />
        <PropField scene={scene} target={node.id} kind="character" path="gaze.headStrength" />
        <DiscreteField scene={scene} target={node.id} path="blinkMode" label="Piscar" options={[{ id: 'auto', label: 'Automático' }, { id: 'open', label: 'Sempre aberto' }, { id: 'closed', label: 'Fechado' }]} />
      </Section>
      <Section title="Expressão e boca" testId="sec-face" actions={<SectionKeys id="face" scene={scene} target={node.id} kind="character" paths={['expression', 'expressionIntensity', 'mouthShape']} />}>
        <DiscreteField scene={scene} target={node.id} path="expression" label="Expressão" testId="expression" options={EXPRESSIONS.map((e) => ({ id: e.id, label: e.label }))} />
        <PropField scene={scene} target={node.id} kind="character" path="expressionIntensity" />
        <DiscreteField scene={scene} target={node.id} path="mouthShape" label="Boca (visema manual)" options={[{ id: 'auto', label: 'Automática (fala ou expressão)' }, ...Object.entries(VISEMES).map(([id, v]) => ({ id, label: v.label }))]} />
      </Section>
      </Pane>
      <Pane tab="Pose">
      <Section title="Movimento natural" testId="sec-secondary">
        <ToggleField label="Respiração, cabeça e olhar vivos" hint="Movimentos sutis e automáticos; diminuem durante ações." testId="secondary-toggle" checked={node.secondary.enabled} onChange={(v) => set('Movimento natural', (n) => { n.secondary.enabled = v; })} />
        {node.secondary.enabled && (
          <>
            <SliderNumberField label="Respiração" unit="%" display={100} min={0} max={1.5} sliderMin={0} sliderMax={100} value={node.secondary.breathing} onChange={(v) => set('Respiração', (n) => { n.secondary.breathing = v; })} />
            <SliderNumberField label="Movimento da cabeça" unit="%" display={100} min={0} max={1.5} sliderMin={0} sliderMax={100} value={node.secondary.headSway} onChange={(v) => set('Cabeça', (n) => { n.secondary.headSway = v; })} />
            <SliderNumberField label="Olhares rápidos" unit="%" display={100} min={0} max={1.5} sliderMin={0} sliderMax={100} value={node.secondary.eyeDarts} onChange={(v) => set('Olhar', (n) => { n.secondary.eyeDarts = v; })} />
            <SliderNumberField label="Troca de postura" unit="%" display={100} min={0} max={1.5} sliderMin={0} sliderMax={100} value={node.secondary.posture} onChange={(v) => set('Postura', (n) => { n.secondary.posture = v; })} />
          </>
        )}
      </Section>
      <ArmDepthSection scene={scene} node={node} />
      <Section title="Pose e rig" testId="sec-rig" actions={<SectionKeys id="rig" scene={scene} target={node.id} kind="character" paths={RIG_KEYS.map((k) => `rig.${k}`)} />}>
        <SelectField label="Pose pronta" value={node.poseId} testId="pose" options={POSES.map((p) => ({ id: p.id, label: p.label }))} onChange={(v) => set('Aplicar pose', (n) => applyPose(n, v))} />
        {RIG_KEYS.map((k) => (
          <PropField key={k} scene={scene} target={node.id} kind="character" path={`rig.${k}`} />
        ))}
        <SelectField label="Mão esquerda" value={node.handL} options={[{ id: 'open', label: 'Aberta' }, { id: 'fist', label: 'Fechada' }, { id: 'point', label: 'Apontando' }]} onChange={(v) => set('Mão', (n) => { n.handL = v as CharacterNode['handL']; })} />
        <SelectField label="Mão direita" value={node.handR} options={[{ id: 'open', label: 'Aberta' }, { id: 'fist', label: 'Fechada' }, { id: 'point', label: 'Apontando' }]} onChange={(v) => set('Mão', (n) => { n.handR = v as CharacterNode['handR']; })} />
      </Section>
      </Pane>
      <Pane tab="Animar">
      <Section title="Animar" testId="sec-animate">
        <TextField label="Fala" value={speech} placeholder="Digite a fala…" testId="speech-text" onChange={setSpeech} />
        <button type="button" className="btn btn-block" data-testid="add-speech" disabled={!speech.trim()} onClick={() => {
          commit('Adicionar fala', (d) => void addDialogue(sceneOf(d as Project, scene.id), node.id, speech.trim(), nowMs()));
          setSpeech('');
          toast('Fala adicionada na timeline.');
        }}>Adicionar fala no tempo atual</button>
        <SelectField label="Ação" value={action} testId="action-select" options={ACTION_PRESETS.filter((a) => a.id !== 'talk' && a.needs !== 'camera').map((a) => ({ id: a.id, label: a.label }))} onChange={setAction} />
        <button type="button" className="btn btn-block" data-testid="add-action" onClick={() => {
          commit('Inserir ação', (d) => void insertAction(d as Project, sceneOf(d as Project, scene.id), node.id, action, nowMs(), { targetX: readProperty(scene, node.id, 'transform.x', nowMs()) as number + 300 }));
          toast('Ação inserida: edite os clips e keys na timeline.');
        }}><Wand2 size={15} /> Inserir na timeline</button>
        <div className="btn-row">
          <button type="button" className="btn btn-sm" data-testid="save-sequence" onClick={async () => {
            const seq = extractSequence(scene, node.id);
            if (!seq) {
              toast('Este personagem ainda não tem ações ou falas para salvar.', 'error');
              return;
            }
            const name = await promptDialog('Salvar sequência', 'Nome da sequência', `Sequência de ${node.name}`);
            if (!name) return;
            await repo.putLibrary({ id: uid('lib'), kind: 'animation', name, favorite: 0, createdAt: Date.now(), data: seq });
            toast('Sequência salva na biblioteca. Aplique em qualquer personagem pela aba Biblioteca.', 'success');
          }}>Salvar sequência</button>
        </div>
      </Section>
      </Pane>
    </>
  );
}

function PropSections({ scene, node }: { scene: Scene; node: Extract<SceneNode, { kind: 'prop' }> }) {
  const def = getProp(node.propId);
  const set = (label: string, fn: (n: typeof node) => void) => commit(label, (d) => {
    const n = sceneOf(d as Project, scene.id).nodes[node.id];
    if (n?.kind === 'prop') fn(n);
  });
  const owners = Object.values(scene.nodes).filter((n) => n.kind === 'character');
  return (
    <Pane tab="Aparência">
    {isCustomObjectId(node.propId) && (
      <Section title="Meu objeto" testId="sec-custom-object">
        <p className="hint">Objeto do Criador de Objetos. Editar muda todas as cópias nas cenas e cenários.</p>
        <button type="button" className="btn btn-block" data-testid="edit-custom-object" onClick={() => openObjectCreator(customObjectIdOf(node.propId))}>Editar no Criador de Objetos</button>
      </Section>
    )}
    {(() => {
      const obj = isCustomObjectId(node.propId) ? currentProject().customObjects[customObjectIdOf(node.propId)] : undefined;
      if (!obj?.clips.length) return null;
      const def0 = obj.clips.find((c) => c.id === obj.defaultClip);
      return (
        <Section title="Animação do objeto" testId="sec-object-anim">
          <p className="hint">Os quadros ficam salvos no objeto. Aqui você escolhe só como ESTA cópia toca: animação, velocidade e defasagem. Trocar a animação com keyframe faz ela começar naquele instante.</p>
          <DiscreteField scene={scene} target={node.id} path="clip" label="Animação" testId="prop-clip" options={[{ id: '', label: def0 ? `Padrão do objeto (${def0.name})` : 'Padrão do objeto (estático)' }, { id: 'static', label: 'Desenho estático' }, ...obj.clips.map((c) => ({ id: c.id, label: `${c.name} · ${c.frames.length} quadro(s)` }))]} />
          <SliderNumberField label="Velocidade" unit="%" display={100} min={0} max={20} sliderMin={0} sliderMax={300} decimals={0} value={node.clipSpeed} testId="prop-clip-speed" onChange={(v) => set('Velocidade da animação', (n) => { n.clipSpeed = Math.max(0, v); })} />
          <SliderNumberField label="Defasagem" unit="ms" min={-600000} max={600000} sliderMin={-2000} sliderMax={2000} decimals={0} value={node.clipOffsetMs} testId="prop-clip-offset" onChange={(v) => set('Defasagem da animação', (n) => { n.clipOffsetMs = Math.round(v); })} />
        </Section>
      );
    })()}
    <Section title="Aparência do objeto" testId="sec-prop" actions={<SectionKeys id="prop" scene={scene} target={node.id} kind="prop" paths={[...(def?.states ? ['state'] : []), ...(def?.handheld ? ['heldBy'] : [])]} />}>
      <ColorField label="Cor principal" value={node.colorA || def?.a || '#888888'} onChange={(v) => set('Cor do objeto', (n) => { n.colorA = v; })} />
      <ColorField label="Cor secundária" value={node.colorB || def?.b || '#888888'} onChange={(v) => set('Cor do objeto', (n) => { n.colorB = v; })} />
      {def?.states && <DiscreteField scene={scene} target={node.id} path="state" label="Estado" options={def.states} testId="prop-state" />}
      {def?.handheld && (
        <DiscreteField scene={scene} target={node.id} path="heldBy" label="Segurado por" testId="prop-held" options={[{ id: '', label: 'Ninguém' }, ...owners.flatMap((o) => [{ id: `${o.id}:L`, label: `${o.name} (mão esq.)` }, { id: `${o.id}:R`, label: `${o.name} (mão dir.)` }])]} />
      )}
      <button type="button" className="btn btn-sm" onClick={() => set('Espelhar', (n) => { n.transform.scaleX = -n.transform.scaleX; })}>Espelhar na horizontal</button>
    </Section>
    </Pane>
  );
}

function SimpleNodeSections({ scene, node }: { scene: Scene; node: SceneNode }) {
  const set = <T extends SceneNode>(label: string, fn: (n: T) => void) => commit(label, (d) => {
    const n = sceneOf(d as Project, scene.id).nodes[node.id];
    if (n) fn(n as T);
  });
  if (node.kind === 'text') {
    return (
      <Pane tab="Aparência">
      <Section title="Texto" testId="sec-text">
        <TextField label="Conteúdo" testId="text-content" multiline value={node.text} onChange={(v) => set<typeof node>('Texto', (n) => { n.text = v; })} />
        <SliderNumberField label="Tamanho da fonte" unit="px" min={4} max={600} sliderMin={10} sliderMax={240} value={node.fontSize} onChange={(v) => set<typeof node>('Fonte', (n) => { n.fontSize = v; })} />
        <SelectField label="Fonte" value={node.fontFamily} options={[{ id: 'sans', label: 'Sem serifa' }, { id: 'serif', label: 'Serifada' }, { id: 'hand', label: 'Manuscrita' }, { id: 'mono', label: 'Monoespaçada' }]} onChange={(v) => set<typeof node>('Fonte', (n) => { n.fontFamily = v as typeof n.fontFamily; })} />
        <SelectField label="Peso" value={node.fontWeight} options={[{ id: '400', label: 'Normal' }, { id: '700', label: 'Negrito' }, { id: '900', label: 'Extra' }]} onChange={(v) => set<typeof node>('Peso', (n) => { n.fontWeight = v as typeof n.fontWeight; })} />
        <ColorField label="Cor" value={node.color} onChange={(v) => set<typeof node>('Cor', (n) => { n.color = v; })} />
        <ColorField label="Contorno" value={node.strokeColor} onChange={(v) => set<typeof node>('Contorno', (n) => { n.strokeColor = v; })} />
        <SliderNumberField label="Espessura do contorno" unit="px" min={0} max={60} sliderMin={0} sliderMax={30} value={node.strokeWidth} onChange={(v) => set<typeof node>('Contorno', (n) => { n.strokeWidth = v; })} />
      </Section>
      </Pane>
    );
  }
  if (node.kind === 'shape') {
    return (
      <Pane tab="Aparência">
      <Section title="Forma" testId="sec-shape">
        <SelectField label="Tipo" value={node.shape} options={[{ id: 'rect', label: 'Retângulo' }, { id: 'ellipse', label: 'Elipse' }, { id: 'triangle', label: 'Triângulo' }, { id: 'star', label: 'Estrela' }, { id: 'burst', label: 'Explosão' }]} onChange={(v) => set<typeof node>('Forma', (n) => { n.shape = v as typeof n.shape; })} />
        <SliderNumberField label="Largura" unit="px" min={1} sliderMin={10} sliderMax={2400} value={node.width} onChange={(v) => set<typeof node>('Tamanho', (n) => { n.width = v; })} />
        <SliderNumberField label="Altura" unit="px" min={1} sliderMin={10} sliderMax={1600} value={node.height} onChange={(v) => set<typeof node>('Tamanho', (n) => { n.height = v; })} />
        <ColorField label="Preenchimento" value={node.fill} onChange={(v) => set<typeof node>('Cor', (n) => { n.fill = v; })} />
        <ColorField label="Contorno" value={node.stroke} onChange={(v) => set<typeof node>('Cor', (n) => { n.stroke = v; })} />
        <SliderNumberField label="Espessura do contorno" unit="px" min={0} sliderMin={0} sliderMax={40} value={node.strokeWidth} onChange={(v) => set<typeof node>('Contorno', (n) => { n.strokeWidth = v; })} />
        <SliderNumberField label="Cantos" unit="px" min={0} sliderMin={0} sliderMax={120} value={node.radius} onChange={(v) => set<typeof node>('Cantos', (n) => { n.radius = v; })} />
      </Section>
      </Pane>
    );
  }
  if (node.kind === 'light') {
    return (
      <Pane tab="Aparência">
      <Section title="Luz ou sombra 2D" testId="sec-light">
        <ColorField label="Cor" value={node.color} onChange={(v) => set<typeof node>('Cor', (n) => { n.color = v; })} />
        <SliderNumberField label="Intensidade" unit="%" display={100} min={0} max={1} sliderMin={0} sliderMax={100} value={node.intensity} onChange={(v) => set<typeof node>('Intensidade', (n) => { n.intensity = v; })} />
        <SliderNumberField label="Largura" unit="px" min={1} sliderMin={50} sliderMax={2400} value={node.width} onChange={(v) => set<typeof node>('Tamanho', (n) => { n.width = v; })} />
        <SliderNumberField label="Altura" unit="px" min={1} sliderMin={50} sliderMax={1600} value={node.height} onChange={(v) => set<typeof node>('Tamanho', (n) => { n.height = v; })} />
        <SelectField label="Mistura" value={node.blend} options={[{ id: 'screen', label: 'Luz (clarear)' }, { id: 'multiply', label: 'Sombra (escurecer)' }, { id: 'normal', label: 'Normal' }]} onChange={(v) => set<typeof node>('Mistura', (n) => { n.blend = v as typeof n.blend; })} />
      </Section>
      </Pane>
    );
  }
  if (node.kind === 'image') {
    return (
      <Pane tab="Imagem">
      <Section title="Imagem" testId="sec-image">
        <SliderNumberField label="Largura" unit="px" min={1} sliderMin={10} sliderMax={2400} value={node.width} onChange={(v) => set<typeof node>('Tamanho', (n) => { n.width = v; })} />
        <SliderNumberField label="Altura" unit="px" min={1} sliderMin={10} sliderMax={1600} value={node.height} onChange={(v) => set<typeof node>('Tamanho', (n) => { n.height = v; })} />
      </Section>
      </Pane>
    );
  }
  return null;
}

function CameraSections({ scene }: { scene: Scene }) {
  const set = (label: string, fn: (s: Scene) => void) => commit(label, (d) => fn(sceneOf(d as Project, scene.id)));
  return (
    <>
      <div className="insp-title"><strong>Câmera 2D</strong><small>Só muda o enquadramento exportado. O zoom do editor é outro.</small></div>
      <Pane tab="Enquadramento">
      <Section title="Enquadramento" testId="sec-camera" actions={<SectionKeys id="camera" scene={scene} target={CAMERA_TARGET} kind="camera" paths={['x', 'y', 'zoom', 'rotationDeg']} />}>
        <PropField scene={scene} target={CAMERA_TARGET} kind="camera" path="x" />
        <PropField scene={scene} target={CAMERA_TARGET} kind="camera" path="y" />
        <PropField scene={scene} target={CAMERA_TARGET} kind="camera" path="zoom" testId="camera-zoom" />
        <PropField scene={scene} target={CAMERA_TARGET} kind="camera" path="rotationDeg" />
      </Section>
      </Pane>
      <Pane tab="Movimento">
      <p className="hint">Enquadramentos prontos criam keyframes da câmera no tempo atual: corte seco ou movimento suave. Para movimentos livres, anime X, Y e zoom com keyframes.</p>
      <Section title="Enquadramento rápido" testId="sec-framing">
        <FramingButtons scene={scene} />
      </Section>
      </Pane>
      <Pane tab="Seguir">
      <Section title="Seguir personagem">
        <SelectField label="Seguir" value={scene.camera.followNodeId ?? ''} options={[{ id: '', label: 'Ninguém' }, ...Object.values(scene.nodes).filter((n) => n.kind === 'character').map((n) => ({ id: n.id, label: n.name }))]} onChange={(v) => set('Seguir', (s) => { s.camera.followNodeId = v || null; if (v && !s.camera.followStrength) s.camera.followStrength = 1; })} />
        <SliderNumberField label="Força de seguir" unit="%" display={100} min={0} max={1} sliderMin={0} sliderMax={100} value={scene.camera.followStrength} onChange={(v) => set('Seguir', (s) => { s.camera.followStrength = v; })} />
        <SliderNumberField label="Suavização" unit="ms" min={0} max={5000} sliderMin={0} sliderMax={2000} step={10} decimals={0} value={scene.camera.followSmoothMs} onChange={(v) => set('Seguir', (s) => { s.camera.followSmoothMs = v; })} />
      </Section>
      </Pane>
    </>
  );
}

function ClipSections({ scene, clipId, project }: { scene: Scene; clipId: string; project: Project }) {
  const f = findClip(scene, clipId);
  if (!f) return <p className="hint">Clip removido.</p>;
  const c = f.clip;
  const set = <T extends AnyClip>(fn: (x: T) => void, label = 'Editar clip') => commit(label, (d) => {
    const s = sceneOf(d as Project, scene.id);
    const r = findClip(s, clipId);
    if (r) {
      fn(r.clip as T);
      extendToFit(s, r.clip.startMs + r.clip.durationMs);
    }
  }, { coalesce: `clip-${clipId}` });
  const characters = Object.values(scene.nodes).filter((n) => n.kind === 'character');
  const audioClips = scene.tracks.flatMap((t) => (t.type === 'audio' ? t.clips : []));
  return (
    <>
      <div className="insp-title"><Layers size={16} /><strong>{f.track.name}</strong><small>Clip da timeline</small></div>
      <Pane tab={c.kind === 'dialogue' ? 'Texto' : 'Tempo'}>
      <Section title="Tempo" testId="sec-clip">
        <SliderNumberField label="Início" unit="s" display={0.001} min={0} step={0.05} decimals={3} sliderMin={0} sliderMax={scene.durationMs / 1000} value={c.startMs} testId="clip-start" onChange={(v) => set((x) => { x.startMs = Math.max(0, Math.round(v)); })} />
        <SliderNumberField label="Duração" unit="s" display={0.001} min={1} step={0.05} decimals={3} sliderMin={0.05} sliderMax={Math.max(2, scene.durationMs / 1000)} value={c.durationMs} testId="clip-duration" onChange={(v) => set((x) => { x.durationMs = Math.max(1, Math.round(v)); })} />
      </Section>
      </Pane>
      {c.kind === 'action' && (
        <Pane tab="Ação">
        <Section title="Parâmetros da ação">
          <SliderNumberField label="Intensidade" unit="%" display={100} min={0} max={3} sliderMin={0} sliderMax={200} value={c.intensity} onChange={(v) => set<typeof c>((x) => { x.intensity = v; })} />
          <SliderNumberField label="Velocidade" unit="×" min={0.05} max={10} step={0.05} decimals={2} sliderMin={0.1} sliderMax={4} value={c.speed} onChange={(v) => set<typeof c>((x) => { x.speed = v; })} />
          <SliderNumberField label="Transição (entrada e saída)" unit="ms" min={0} max={5000} sliderMin={0} sliderMax={1500} step={10} decimals={0} value={c.blendMs ?? getAction(c.action)?.blend ?? 180} testId="clip-blend" onChange={(v) => set<typeof c>((x) => { x.blendMs = Math.round(v); })} />
          <SelectField label="Braço" value={c.side} options={[{ id: 'auto', label: 'Automático (lado do alvo)' }, { id: 'L', label: 'Esquerdo' }, { id: 'R', label: 'Direito' }]} onChange={(v) => set<typeof c>((x) => { x.side = v as typeof x.side; })} />
          <button type="button" className="btn btn-block" data-testid="bake-clip" onClick={() => {
            let count = 0;
            commit('Converter em keyframes', (d) => {
              count = bakeActionClip(sceneOf(d as Project, scene.id), clipId);
            });
            useUI.setState({ timeline: null });
            toast(`Clip convertido em ${count} keyframes editáveis.`);
          }}>Converter em keyframes</button>
        </Section>
        </Pane>
      )}
      {c.kind === 'dialogue' && (
        <>
        <Pane tab="Texto">
        <Section title="Fala">
          <TextField label="Texto" multiline value={c.text} testId="dialogue-text" onChange={(v) => set<typeof c>((x) => { x.text = v; })} />
          <ToggleField label="Mostrar como legenda" checked={c.showSubtitle} onChange={(v) => set<typeof c>((x) => { x.showSubtitle = v; })} />
        </Section>
        </Pane>
        <Pane tab="Balão">
        <Section title="Balão">
          <ToggleField label="Mostrar balão" checked={c.showBubble} onChange={(v) => set<typeof c>((x) => { x.showBubble = v; })} />
          <SelectField label="Estilo do balão" value={c.bubbleStyle} options={BUBBLE_STYLES} onChange={(v) => set<typeof c>((x) => { x.bubbleStyle = v; })} />
          <SliderNumberField label="Tamanho do balão" unit="%" display={100} min={0.2} max={4} sliderMin={40} sliderMax={250} value={c.bubbleScale} onChange={(v) => set<typeof c>((x) => { x.bubbleScale = v; })} />
          <SliderNumberField label="Balão X" unit="px" sliderMin={-800} sliderMax={800} value={c.bubbleOffsetX} onChange={(v) => set<typeof c>((x) => { x.bubbleOffsetX = v; })} />
          <SliderNumberField label="Balão Y" unit="px" sliderMin={-500} sliderMax={500} value={c.bubbleOffsetY} onChange={(v) => set<typeof c>((x) => { x.bubbleOffsetY = v; })} />
        </Section>
        </Pane>
        <Pane tab="Boca">
        <Section title="Boca (lip-sync)">
          <SelectField label="Sincronia da boca" value={c.lipSync} testId="lipsync-mode" options={[{ id: 'text', label: 'Pelo texto (estimativa, sem áudio)' }, { id: 'amplitude', label: 'Pela intensidade do áudio' }, { id: 'manual', label: 'Manual (keyframes de visema)' }, { id: 'off', label: 'Desligada' }]} onChange={(v) => set<typeof c>((x) => { x.lipSync = v as typeof x.lipSync; })} />
          {c.lipSync === 'amplitude' && (
            <>
              <p className="hint">A boca abre conforme o volume. Isto NÃO reconhece fonemas. Vincule o personagem no clip de áudio.</p>
              <SliderNumberField label="Sensibilidade" unit="%" display={100} min={0} max={5} sliderMin={0} sliderMax={300} value={c.sensitivity} testId="dialogue-sens" onChange={(v) => set<typeof c>((x) => { x.sensitivity = v; })} />
              <SelectField label="Clip de áudio" value={c.audioClipId ?? ''} options={[{ id: '', label: 'Nenhum' }, ...audioClips.map((a) => ({ id: a.id, label: project.assets[a.assetId]?.name ?? 'Áudio' }))]} onChange={(v) => set<typeof c>((x) => { x.audioClipId = v || null; })} />
            </>
          )}
        </Section>
        </Pane>
        </>
      )}
      {c.kind === 'audio' && (
        <>
        <Pane tab="Som">
        <Section title="Áudio" testId="sec-audio">
          <p className="hint">{project.assets[c.assetId]?.name}</p>
          <SliderNumberField label="Volume" unit="%" display={100} min={0} max={4} sliderMin={0} sliderMax={200} value={c.volume} testId="audio-volume" onChange={(v) => set<typeof c>((x) => { x.volume = v; })} />
          <SliderNumberField label="Fade in" unit="ms" min={0} sliderMin={0} sliderMax={5000} step={10} decimals={0} value={c.fadeInMs} onChange={(v) => set<typeof c>((x) => { x.fadeInMs = Math.round(v); })} />
          <SliderNumberField label="Fade out" unit="ms" min={0} sliderMin={0} sliderMax={5000} step={10} decimals={0} value={c.fadeOutMs} onChange={(v) => set<typeof c>((x) => { x.fadeOutMs = Math.round(v); })} />
          <SliderNumberField label="Corte no início" unit="ms" min={0} sliderMin={0} sliderMax={Math.max(1000, project.assets[c.assetId]?.durationMs ?? 1000)} step={10} decimals={0} value={c.offsetMs} onChange={(v) => set<typeof c>((x) => { x.offsetMs = Math.round(v); })} />
        </Section>
        </Pane>
        <Pane tab="Sincronização">
        <Section title="Boca pela intensidade do áudio">
          <p className="hint">A boca do personagem escolhido abre conforme o volume deste áudio. Não reconhece fonemas.</p>
          <SelectField label="Boca de (lip-sync por intensidade)" value={c.lipSyncNodeId ?? ''} testId="audio-lipsync" options={[{ id: '', label: 'Ninguém' }, ...characters.map((n) => ({ id: n.id, label: n.name }))]} onChange={(v) => set<typeof c>((x) => { x.lipSyncNodeId = v || null; })} />
          <SliderNumberField label="Sensibilidade do lip-sync" unit="%" display={100} min={0} max={5} sliderMin={0} sliderMax={300} value={c.sensitivity} onChange={(v) => set<typeof c>((x) => { x.sensitivity = v; })} />
        </Section>
        </Pane>
        </>
      )}
      {c.kind === 'subtitle' && (
        <Pane tab="Legenda">
        <Section title="Legenda">
          <TextField label="Texto" multiline value={c.text} onChange={(v) => set<typeof c>((x) => { x.text = v; })} />
          <SelectField label="Posição" value={c.position} options={[{ id: 'bottom', label: 'Embaixo' }, { id: 'center', label: 'Centro' }, { id: 'top', label: 'Em cima' }]} onChange={(v) => set<typeof c>((x) => { x.position = v as typeof x.position; })} />
          <SliderNumberField label="Tamanho" unit="px" min={8} max={200} sliderMin={16} sliderMax={120} value={c.fontSize} onChange={(v) => set<typeof c>((x) => { x.fontSize = v; })} />
          <ColorField label="Cor" value={c.color} onChange={(v) => set<typeof c>((x) => { x.color = v; })} />
          <ToggleField label="Fundo escuro" checked={c.background} onChange={(v) => set<typeof c>((x) => { x.background = v; })} />
        </Section>
        </Pane>
      )}
      {c.kind === 'effect' && (
        <Pane tab="Efeito">
        <Section title="Efeito">
          <SelectField label="Tipo" value={c.effect} options={[{ id: 'shake', label: 'Tremor' }, { id: 'flash', label: 'Flash' }, { id: 'fadeBlack', label: 'Fade para preto' }, { id: 'fadeFromBlack', label: 'Fade do preto' }, { id: 'vignette', label: 'Vinheta' }, { id: 'tint', label: 'Tinta de cor' }]} onChange={(v) => set<typeof c>((x) => { x.effect = v as typeof x.effect; })} />
          <SliderNumberField label="Intensidade" unit="%" display={100} min={0} max={3} sliderMin={0} sliderMax={200} value={c.intensity} onChange={(v) => set<typeof c>((x) => { x.intensity = v; })} />
          <ColorField label="Cor" value={c.color} onChange={(v) => set<typeof c>((x) => { x.color = v; })} />
        </Section>
        </Pane>
      )}
      <button type="button" className="btn btn-danger btn-block" data-testid="delete-clip" onClick={() => {
        commit('Excluir clip', (d) => deleteClip(sceneOf(d as Project, scene.id), clipId));
        useUI.setState({ timeline: null });
      }}><Trash2 size={15} /> Excluir clip</button>
    </>
  );
}

function KeySections({ scene, trackId, keyId }: { scene: Scene; trackId: string; keyId: string }) {
  const track = scene.tracks.find((t) => t.id === trackId) as PropertyTrack | undefined;
  const k = track?.keyframes.find((x) => x.id === keyId);
  if (!track || !k) return <p className="hint">Keyframe removido.</p>;
  const kind = track.targetNodeId === CAMERA_TARGET ? 'camera' : (scene.nodes[track.targetNodeId]?.kind ?? 'character');
  const def = getPropertyDef(kind, track.propertyPath);
  const set = (fn: (kf: Keyframe) => void, label = 'Editar keyframe') => commit(label, (d) => {
    const tr = sceneOf(d as Project, scene.id).tracks.find((x) => x.id === trackId);
    if (tr?.type !== 'property') return;
    const kf = tr.keyframes.find((x) => x.id === keyId);
    if (kf) fn(kf);
    tr.keyframes.sort((a, b) => a.timeMs - b.timeMs);
  }, { coalesce: `key-${keyId}` });
  return (
    <>
      <div className="insp-title"><Diamond size={15} /><strong>{track.name}</strong><small>Keyframe · {formatKeyValue(k.value, def)}</small></div>
      <Section title="Keyframe" testId="sec-key">
        <SliderNumberField label="Tempo" unit="s" display={0.001} min={0} step={0.05} decimals={3} sliderMin={0} sliderMax={scene.durationMs / 1000} value={k.timeMs} testId="key-time" onChange={(v) => { set((kf) => { kf.timeMs = Math.max(0, Math.round(v)); }); seek(v); }} />
        {typeof k.value === 'number' && def && (
          <SliderNumberField label="Valor" unit={def.unit} display={def.display} min={def.min} max={def.max} sliderMin={def.sliderMin} sliderMax={def.sliderMax} step={def.step} decimals={def.decimals} value={k.value} testId="key-value" onChange={(v) => set((kf) => { kf.value = v; })} />
        )}
        {typeof k.value === 'string' && <TextField label="Valor" value={k.value} onChange={(v) => set((kf) => { kf.value = v; })} />}
        <SelectField label="Interpolação até o próximo" value={k.interpolation} testId="key-interp" options={[{ id: 'hold', label: 'Segurar (degrau)' }, { id: 'linear', label: 'Linear' }, { id: 'bezier', label: 'Suave (easing)' }]} onChange={(v) => set((kf) => { kf.interpolation = v as typeof kf.interpolation; })} />
        {k.interpolation === 'bezier' && (
          <SelectField label="Easing" value={k.easing} options={[{ id: 'easeInOut', label: 'Suave nas duas pontas' }, { id: 'easeIn', label: 'Acelera' }, { id: 'easeOut', label: 'Desacelera' }, { id: 'backOut', label: 'Passa e volta' }, { id: 'bounceOut', label: 'Quica' }, { id: 'linear', label: 'Constante' }]} onChange={(v) => set((kf) => { kf.easing = v as typeof kf.easing; })} />
        )}
      </Section>
      <button type="button" className="btn btn-danger btn-block" data-testid="delete-key" onClick={() => {
        commit('Excluir keyframe', (d) => deleteKeyframe(sceneOf(d as Project, scene.id), trackId, keyId));
        useUI.setState({ timeline: null });
      }}><Trash2 size={15} /> Excluir keyframe</button>
    </>
  );
}

const TRANSITIONS: Array<{ id: Transition['kind']; label: string }> = [
  { id: 'cut', label: 'Corte seco' }, { id: 'fade', label: 'Fade por preto' }, { id: 'crossfade', label: 'Dissolver' }, { id: 'wipe', label: 'Cortina' }, { id: 'slide', label: 'Deslizar' },
];

function SceneSections({ scene }: { scene: Scene }) {
  const set = (label: string, fn: (s: Scene) => void, coalesce?: string) => commit(label, (d) => fn(sceneOf(d as Project, scene.id)), coalesce ? { coalesce } : {});
  const bg = scene.background;
  const def = getBackground(bg.presetId);
  const project = currentProject();
  const customOptions = Object.values(project.customBackgrounds).map((c) => ({ id: `custom:${c.id}`, label: `★ ${c.name}` }));
  const custom = isCustomPreset(bg.presetId) ? project.customBackgrounds[customIdOf(bg.presetId)] : undefined;
  const customPick = custom ? resolveCustomVariant(custom, bg.timeOfDay) : null;
  return (
    <>
      <div className="insp-title"><strong>{scene.name}</strong><small>Propriedades da cena</small></div>
      <Pane tab="Cena">
      <Section title="Cena" testId="sec-scene">
        <TextField label="Nome da cena" value={scene.name} testId="scene-name" onChange={(v) => set('Renomear cena', (s) => { s.name = v; }, 'scene-name')} />
        <SliderNumberField label="Duração" unit="s" display={0.001} min={100} max={3_600_000} step={0.5} decimals={2} sliderMin={1} sliderMax={120} value={scene.durationMs} testId="scene-duration" onChange={(v) => set('Duração da cena', (s) => { s.durationMs = Math.max(100, Math.round(v)); }, 'scene-dur')} />
        <TextField label="Anotações" multiline value={scene.notes} onChange={(v) => set('Anotações', (s) => { s.notes = v; }, 'scene-notes')} />
      </Section>
      </Pane>
      <Pane tab="Cenário">
      <Section title="Cenário" testId="sec-bg" actions={<HelpLink chapter="cenarios" />}>
        <SelectField label="Cenário" value={bg.presetId} testId="bg-select" options={[...customOptions, ...BACKGROUNDS.map((b) => ({ id: b.id, label: b.label }))]} onChange={(v) => set('Trocar cenário', (s) => {
          const cb = isCustomPreset(v) ? project.customBackgrounds[customIdOf(v)] : undefined;
          if (cb) applyCustomBackground(s, cb);
          else applyBackground(s, v, { variant: s.background.variant });
        })} />
        {custom ? (
          <>
            <SelectField label="Horário" value={customPick?.time ?? ''} testId="bg-time" options={availableTimes(custom).map((t) => ({ id: t, label: TIME_LABELS[t] }))} onChange={(v) => set('Horário', (s) => { s.background.timeOfDay = v as TimeOfDay; })} />
            {customPick?.fallback && <p className="warn-box" role="status">O horário {TIME_LABELS[bg.timeOfDay!]} não existe neste cenário: usando {TIME_LABELS[customPick.time]}.</p>}
          </>
        ) : (
          <SelectField label="Variante" value={bg.variant} testId="bg-variant" options={[{ id: 'day', label: 'Dia' }, { id: 'night', label: 'Noite' }]} onChange={(v) => set('Variante', (s) => { s.background.variant = v as 'day' | 'night'; })} />
        )}
      </Section>
      </Pane>
      <Pane tab="Visual">
      <Section title="Cores e efeitos do fundo">
        <SelectField label="Tom" value={bg.tone} options={[{ id: 'normal', label: 'Normal' }, { id: 'light', label: 'Claro' }, { id: 'dark', label: 'Escuro' }]} onChange={(v) => set('Tom', (s) => { s.background.tone = v as 'normal' | 'light' | 'dark'; })} />
        <ColorField label="Parede / céu" value={bg.primary || def.wall} onChange={(v) => set('Cor do cenário', (s) => { s.background.primary = v; })} />
        <ColorField label="Destaque" value={bg.secondary || def.accent} onChange={(v) => set('Cor do cenário', (s) => { s.background.secondary = v; })} />
        <ColorField label="Piso" value={bg.floor || def.floor} onChange={(v) => set('Cor do cenário', (s) => { s.background.floor = v; })} />
        <SliderNumberField label="Parallax do fundo" unit="%" display={100} min={-2} max={3} sliderMin={0} sliderMax={100} value={bg.parallax} onChange={(v) => set('Parallax', (s) => { s.background.parallax = v; }, 'bg-par')} />
        <SliderNumberField label="Desfoque do fundo" unit="px" min={0} max={40} sliderMin={0} sliderMax={20} step={0.5} value={bg.blur} onChange={(v) => set('Desfoque', (s) => { s.background.blur = v; }, 'bg-blur')} />
        <ToggleField label="Sem fundo (transparente)" hint="Para exportar PNG com transparência." checked={bg.transparent} onChange={(v) => set('Transparência', (s) => { s.background.transparent = v; })} />
      </Section>
      <Section title="Perspectiva falsa">
        <p className="hint">Elementos com "Escala pela profundidade" crescem conforme descem no palco. É só escala 2D.</p>
        <ToggleField label="Ativar" checked={scene.perspective.enabled} onChange={(v) => set('Perspectiva', (s) => { s.perspective.enabled = v; })} />
        <SliderNumberField label="Linha de referência" unit="px" sliderMin={-200} sliderMax={540} value={scene.perspective.refY} onChange={(v) => set('Perspectiva', (s) => { s.perspective.refY = v; }, 'pers')} />
        <SliderNumberField label="Força" display={1000} decimals={2} step={0.1} min={0} max={0.02} sliderMin={0} sliderMax={5} value={scene.perspective.strength} onChange={(v) => set('Perspectiva', (s) => { s.perspective.strength = v; }, 'pers')} />
      </Section>
      </Pane>
      <Pane tab="Transições">
      <Section title="Transição entre cenas" testId="sec-transition">
        <SelectField label="Entrada" value={scene.transitionIn.kind} testId="transition-in" options={TRANSITIONS} onChange={(v) => set('Transição', (s) => { s.transitionIn.kind = v as Transition['kind']; })} />
        <SliderNumberField label="Duração da entrada" unit="ms" min={0} max={10000} step={50} decimals={0} sliderMin={0} sliderMax={3000} value={scene.transitionIn.durationMs} onChange={(v) => set('Transição', (s) => { s.transitionIn.durationMs = Math.round(v); }, 'tr-in')} />
        <SelectField label="Saída" value={scene.transitionOut.kind === 'fade' ? 'fade' : 'cut'} options={[{ id: 'cut', label: 'Sem efeito' }, { id: 'fade', label: 'Fade para preto' }]} onChange={(v) => set('Transição', (s) => { s.transitionOut.kind = v as Transition['kind']; })} />
        <SliderNumberField label="Duração da saída" unit="ms" min={0} max={10000} step={50} decimals={0} sliderMin={0} sliderMax={3000} value={scene.transitionOut.durationMs} onChange={(v) => set('Transição', (s) => { s.transitionOut.durationMs = Math.round(v); }, 'tr-out')} />
      </Section>
      </Pane>
    </>
  );
}

function FramingButtons({ scene }: { scene: Scene }) {
  const chars = Object.values(scene.nodes).filter((n) => n.kind === 'character');
  const [a, setA] = useState(chars[0]?.id ?? '');
  const [b, setB] = useState(chars[1]?.id ?? '');
  const [smooth, setSmooth] = useState(false);
  const apply = (preset: FramingPreset) => {
    let ok = false;
    commit('Enquadrar câmera', (d) => { ok = frameCamera(d as Project, sceneOf(d as Project, scene.id), preset, preset === 'two-shot' ? [a, b] : [a], nowMs(), smooth ? 1200 : 0); });
    if (!ok) toast('Escolha o(s) personagem(ns) do enquadramento.', 'error');
  };
  return (
    <>
      <SelectField label="Personagem" value={a} options={chars.map((c) => ({ id: c.id, label: c.name }))} onChange={setA} />
      <SelectField label="Segundo personagem" value={b} options={[{ id: '', label: '—' }, ...chars.map((c) => ({ id: c.id, label: c.name }))]} onChange={setB} />
      <ToggleField label="Movimento suave (1,2 s)" hint="Desligado: corte seco no tempo atual." checked={smooth} onChange={setSmooth} />
      <div className="btn-row">
        {FRAMING_PRESETS.map((p) => <button key={p.id} type="button" className="btn btn-sm" data-testid={`frame-${p.id}`} onClick={() => apply(p.id)}>{p.label}</button>)}
      </div>
    </>
  );
}

/* ---------- abas contextuais ---------- */
const NODE_TABS: Record<SceneNode['kind'], string[]> = {
  character: ['Transformar', 'Rosto', 'Pose', 'Animar', 'Camadas'],
  prop: ['Transformar', 'Aparência', 'Camadas'],
  text: ['Transformar', 'Aparência', 'Camadas'],
  shape: ['Transformar', 'Aparência', 'Camadas'],
  light: ['Transformar', 'Aparência', 'Camadas'],
  image: ['Transformar', 'Imagem', 'Camadas'],
  group: ['Transformar', 'Camadas'],
};
const CLIP_TABS: Record<AnyClip['kind'], string[]> = {
  action: ['Tempo', 'Ação'],
  dialogue: ['Texto', 'Balão', 'Boca'],
  audio: ['Tempo', 'Som', 'Sincronização'],
  subtitle: ['Tempo', 'Legenda'],
  effect: ['Tempo', 'Efeito'],
} as Record<AnyClip['kind'], string[]>;

const PaneCtx = createContext<string | null>(null);
/** Conteúdo de uma aba: aparece só quando a aba está ativa (fora de abas, sempre). */
function Pane({ tab, children }: { tab: string; children: React.ReactNode }) {
  const active = useContext(PaneCtx);
  return active === null || active === tab ? <>{children}</> : null;
}
const slug = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
/** Abas horizontais do inspector. A última aba de cada tipo de seleção é lembrada. */
function Tabs({ ctx, tabs, children, help }: { ctx: string; tabs: string[]; children: React.ReactNode; help?: string }) {
  const stored = useUI((s) => s.inspectorTabs[ctx]);
  const active = stored && tabs.includes(stored) ? stored : tabs[0]!;
  const set = (t: string) => useUI.setState((s) => ({ inspectorTabs: { ...s.inspectorTabs, [ctx]: t } }));
  return (
    <>
      <div className="insp-tabs">
        <ScrollStrip className="insp-tabs-row" role="tablist" ariaLabel="Grupos de propriedades" testId="insp-tabs" watch={active}>
        {tabs.map((t, i) => (
          <button key={t} type="button" role="tab" id={`itab-${slug(t)}`} aria-selected={t === active} aria-controls="insp-pane" tabIndex={t === active ? 0 : -1} className={t === active ? 'is-active' : ''} data-testid={`insp-tab-${slug(t)}`}
            onClick={() => set(t)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              e.stopPropagation();
              const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
              set(next);
              (e.currentTarget.parentElement?.querySelector(`#itab-${slug(next)}`) as HTMLElement | null)?.focus();
            }}>{t}</button>
        ))}
        </ScrollStrip>
        {help && <HelpLink chapter={help} label="Ajuda sobre estas propriedades" />}
      </div>
      <div className="insp-pane" role="tabpanel" id="insp-pane" aria-labelledby={`itab-${slug(active)}`} data-tab={active}>
        <PaneCtx.Provider value={active}>{children}</PaneCtx.Provider>
      </div>
    </>
  );
}

export function Inspector() {
  const project = useProject();
  const scene = useCurrentScene();
  const ui = useUI();
  if (!project || !scene) return null;
  const sel = ui.timeline;
  let content: React.ReactNode;
  if (sel?.keyId) content = <KeySections key={sel.keyId} scene={scene} trackId={sel.trackId} keyId={sel.keyId} />;
  else if (sel?.clipId) {
    const kind = findClip(scene, sel.clipId)?.clip.kind ?? 'effect';
    content = <Tabs ctx={`clip-${kind}`} tabs={CLIP_TABS[kind]}><ClipSections key={sel.clipId} scene={scene} clipId={sel.clipId} project={project} /></Tabs>;
  } else if (ui.camera) content = <Tabs ctx="camera" tabs={['Enquadramento', 'Movimento', 'Seguir']} help="camera"><CameraSections scene={scene} /></Tabs>;
  else if (ui.nodeIds.length === 1 && scene.nodes[ui.nodeIds[0]!]) {
    const node = scene.nodes[ui.nodeIds[0]!]!;
    content = (
      <div key={node.id}>
        <div className="insp-title"><strong data-testid="selected-name">{node.name}</strong><small>{({ character: 'Personagem', prop: 'Objeto', image: 'Imagem', text: 'Texto', shape: 'Forma', light: 'Luz', group: 'Grupo' })[node.kind]}</small></div>
        <Tabs ctx={node.kind} tabs={NODE_TABS[node.kind]} help={node.kind === 'character' ? 'propriedades' : 'objetos'}>
          {node.kind === 'character' && <CharacterSections scene={scene} node={node} project={project} />}
          {node.kind === 'prop' && <PropSections scene={scene} node={node} />}
          <SimpleNodeSections scene={scene} node={node} />
          <CommonNodeSections scene={scene} node={node} />
        </Tabs>
      </div>
    );
  } else if (ui.nodeIds.length > 1) {
    content = <MultiSelection scene={scene} />;
  } else content = <Tabs ctx="scene" tabs={['Cena', 'Cenário', 'Visual', 'Transições']} help="cenas"><SceneSections scene={scene} /></Tabs>;
  return <div className="inspector" data-testid="inspector">{content}</div>;
}

function MultiSelection({ scene }: { scene: Scene }) {
  const ids = useUI((s) => s.nodeIds);
  const align = (axis: 'x' | 'y', mode: 'min' | 'center' | 'max') => {
    const t = nowMs();
    const vals = ids.map((id) => readProperty(scene, id, `transform.${axis}`, t) as number);
    const target = mode === 'min' ? Math.min(...vals) : mode === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length;
    commit('Alinhar', (d) => {
      const s = sceneOf(d as Project, scene.id);
      for (const id of ids) writeProperty(s, id, `transform.${axis}`, target, t);
    });
  };
  const distribute = () => {
    const t = nowMs();
    const sorted = [...ids].map((id) => ({ id, x: readProperty(scene, id, 'transform.x', t) as number })).sort((a, b) => a.x - b.x);
    const a = sorted[0]!.x;
    const b = sorted[sorted.length - 1]!.x;
    commit('Distribuir', (d) => {
      const s = sceneOf(d as Project, scene.id);
      sorted.forEach((n, i) => writeProperty(s, n.id, 'transform.x', a + ((b - a) * i) / (sorted.length - 1), t));
    });
  };
  return (
    <>
      <div className="insp-title"><strong>{ids.length} elementos</strong><small>Seleção múltipla</small></div>
      <Section title="Alinhar e distribuir" testId="sec-multi">
        <div className="btn-row">
          <button type="button" className="btn btn-sm" onClick={() => align('x', 'min')}>Esquerda</button>
          <button type="button" className="btn btn-sm" onClick={() => align('x', 'center')}>Centro X</button>
          <button type="button" className="btn btn-sm" onClick={() => align('x', 'max')}>Direita</button>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-sm" onClick={() => align('y', 'min')}>Topo</button>
          <button type="button" className="btn btn-sm" onClick={() => align('y', 'center')}>Centro Y</button>
          <button type="button" className="btn btn-sm" onClick={() => align('y', 'max')}>Base</button>
        </div>
        <button type="button" className="btn btn-block" disabled={ids.length < 3} onClick={distribute}>Distribuir na horizontal</button>
      </Section>
      <button type="button" className="btn btn-danger btn-block" onClick={() => void deleteSelection()}><Trash2 size={15} /> Excluir seleção</button>
    </>
  );
}

export { IconButton };
