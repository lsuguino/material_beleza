/**
 * Edição via API: remove data URLs (base64) do payload para caber no limite ~4,5MB da Vercel,
 * depois mescla de volta os binários da página original quando o servidor não devolve nova mídia.
 */

function isDataImageUrl(s: string): boolean {
  return s.startsWith('data:image/');
}

/** Clona e zera strings data:image em profundidade (objetos e arrays). */
export function stripDataImageUrlsForEditApi<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (v === null || v === undefined) return v;
    if (typeof v === 'string') return isDataImageUrl(v) ? '' : v;
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o)) {
        out[k] = walk(o[k]);
      }
      return out;
    }
    return v;
  };
  let base: unknown;
  try {
    base = structuredClone(value);
  } catch {
    base = JSON.parse(JSON.stringify(value));
  }
  return walk(base) as T;
}

/**
 * Reaplica imagens em base64 da página original quando a resposta da API as omitiu
 * (porque o envio foi sem data URL). Preserva URLs http(s) novas vindas do servidor.
 */
export function mergeEditedPageRestoringMedia(
  originalPage: Record<string, unknown>,
  serverPage: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...serverPage };

  const restoreTopLevel = (key: string) => {
    const ov = originalPage[key];
    const sv = serverPage[key];
    if (typeof ov !== 'string' || !isDataImageUrl(ov)) return;
    if (typeof sv === 'string' && /^https?:\/\//i.test(sv.trim())) {
      merged[key] = sv;
      return;
    }
    if (typeof sv === 'string' && isDataImageUrl(sv) && sv.length > 1000) {
      merged[key] = sv;
      return;
    }
    if (sv === undefined || sv === null || (typeof sv === 'string' && sv.trim() === '')) {
      merged[key] = ov;
    }
  };

  for (const key of ['imagem_url', 'imagemUrl', 'url_imagem', 'hero_image', 'cover_image']) {
    if (key in originalPage) restoreTopLevel(key);
  }

  const ob = originalPage.content_blocks;
  const sb = serverPage.content_blocks;
  if (Array.isArray(ob) && Array.isArray(sb)) {
    merged.content_blocks = sb.map((block, i) => {
      if (typeof block !== 'object' || block === null) return block;
      const oblock = ob[i];
      if (typeof oblock !== 'object' || oblock === null) return block;
      const out = { ...(block as Record<string, unknown>) };
      const orec = oblock as Record<string, unknown>;
      for (const key of ['imageUrl', 'imagem_url', 'url', 'src', 'image_url']) {
        const ov = orec[key];
        const sv = out[key];
        if (typeof ov !== 'string' || !isDataImageUrl(ov)) continue;
        if (typeof sv === 'string' && /^https?:\/\//i.test(sv.trim())) continue;
        if (typeof sv === 'string' && isDataImageUrl(sv) && sv.length > 1000) continue;
        if (sv === undefined || sv === null || (typeof sv === 'string' && sv.trim() === '')) {
          out[key] = ov;
        }
      }
      return out;
    });
  }

  return merged;
}

/**
 * Prepara página para POST /api/edit-page: sem data URLs; merge depois com mergeEditedPageRestoringMedia.
 */
export function prepareExistingPageForEditApi(page: Record<string, unknown>): Record<string, unknown> {
  const stripped = stripDataImageUrlsForEditApi(page);
  return stripped as Record<string, unknown>;
}
