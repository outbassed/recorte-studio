import type { PackSource } from '../lib';
import { CHARACTER_SOURCES_1 } from './characters';
import { CHARACTER_SOURCES_2 } from './characters2';
import { BODY_POSE_SOURCES } from './corpos-poses';
import { CASA_SOURCES } from './objetos-casa';
import { VIDA_SOURCES } from './objetos-vida';
import { VILA_TORTA_SOURCES } from './vila-torta';

/** Todos os pacotes oficiais, na ordem em que aparecem no índice. */
export const SOURCES: Array<() => Promise<PackSource>> = [...CHARACTER_SOURCES_1, ...CHARACTER_SOURCES_2, ...BODY_POSE_SOURCES, ...CASA_SOURCES, ...VIDA_SOURCES, ...VILA_TORTA_SOURCES];
