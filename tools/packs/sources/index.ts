import type { PackSource } from '../lib';
import { VILA_TORTA_SOURCES } from './vila-torta';

/** Todos os pacotes oficiais, na ordem em que aparecem no índice. */
export const SOURCES: Array<() => Promise<PackSource>> = [...VILA_TORTA_SOURCES];
