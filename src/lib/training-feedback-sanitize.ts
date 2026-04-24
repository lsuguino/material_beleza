import type { PreviewData } from '@/components/MaterialPreviewBlocks';

const DATA_URL_MAX = 120;

/** Remove data URLs e strings enormes para armazenar snapshots sem estourar disco/API. */
export function stripHeavyMediaFromUnknown(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:') && value.length > DATA_URL_MAX) {
      return '[mídia base64 omitida — treino usa só texto/estrutura]';
    }
    if (value.length > 500_000) {
      return `${value.slice(0, 80_000)}… [truncado]`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((x) => stripHeavyMediaFromUnknown(x));
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      out[k] = stripHeavyMediaFromUnknown(o[k]);
    }
    return out;
  }
  return value;
}

export function stripPreviewDataForTraining(data: PreviewData): PreviewData {
  return stripHeavyMediaFromUnknown(data) as PreviewData;
}

/** Remove imagens pesadas de apostila no formato TeachingMaterial (objeto genérico). */
export function stripTeachingMaterialForTraining(material: Record<string, unknown>): Record<string, unknown> {
  return stripHeavyMediaFromUnknown(material) as Record<string, unknown>;
}
