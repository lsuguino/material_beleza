/**
 * Loader tipado da fonte oficial do gerador A4.
 * Importa docs/figma-source-of-truth.json, valida em tempo de módulo e
 * re-exporta com tipos exatos. Use este arquivo em vez de importar o JSON direto.
 *
 *     import { FIGMA_A4 } from '@/lib/figma-source-of-truth';
 *     FIGMA_A4.allowedLayouts // readonly LayoutId[]
 */

import raw from '../../docs/figma-source-of-truth.json';
import {
  assertFigmaSourceOfTruth,
  type FigmaSourceOfTruth,
} from './figma-a4-schema';

assertFigmaSourceOfTruth(raw);

/** Fonte de verdade validada — read-only. */
export const FIGMA_A4: FigmaSourceOfTruth = raw as FigmaSourceOfTruth;

export type { FigmaSourceOfTruth, LayoutId, Template, FrameMapping } from './figma-a4-schema';
export { ALLOWED_LAYOUTS, isLayoutId, isFigmaNodeId } from './figma-a4-schema';
