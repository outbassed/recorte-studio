import type { PackSource } from '../lib';
import { CHARACTER_SOURCES_1 } from './characters';
import { CHARACTER_SOURCES_2 } from './characters2';
import { BODY_POSE_SOURCES } from './corpos-poses';
import { VILA_TORTA_SOURCES } from './vila-torta';

/** Todos os pacotes oficiais, na ordem em que aparecem no índice. */
export const SOURCES: Array<() => Promise<PackSource>> = [...CHARACTER_SOURCES_1, ...CHARACTER_SOURCES_2, ...BODY_POSE_SOURCES, ...VILA_TORTA_SOURCES];
