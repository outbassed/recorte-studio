/** IDs dos itens padrão do app (elenco, objetos, cenários, animados): um pacote não pode reusar esses IDs. */
import { BUILTIN_CHARACTERS } from '@/engine/character/presets';
import { BACKGROUNDS } from '@/engine/world/backgrounds';
import { PROPS } from '@/engine/world/props';
import { ANIMATED_TEMPLATES } from '@/features/catalog/animatedTemplates';
import type { BuiltinId } from './conflicts';

let cache: BuiltinId[] | null = null;
export function builtinIds(): BuiltinId[] {
  return (cache ??= [
    ...BUILTIN_CHARACTERS.map((c) => ({ id: c.builtinId ?? c.id, kind: 'character', name: c.name })),
    ...PROPS.map((p) => ({ id: p.id, kind: 'prop', name: p.label })),
    ...BACKGROUNDS.map((b) => ({ id: b.id, kind: 'background', name: b.label })),
    ...ANIMATED_TEMPLATES.map((t) => ({ id: t.id, kind: 'object', name: t.label })),
  ]);
}
