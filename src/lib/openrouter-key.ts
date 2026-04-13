/**
 * Normaliza a chave OpenRouter para uso em Authorization: Bearer …
 * Evita 401 por cópia com espaços, "Bearer " duplicado, quebras de linha ou zero-width space.
 */
export function normalizeOpenRouterApiKey(raw: string | undefined | null): string {
  if (raw == null) return '';
  let s = String(raw).replace(/^\uFEFF/, '').trim();
  s = s.replace(/^Bearer\s+/i, '');
  s = s.replace(/[\s\u200b\uFEFF]/g, '');
  return s;
}

/** Prefixo típico das chaves em https://openrouter.ai/keys (não só sk-or-v1-). */
export function isPlausibleOpenRouterKeyShape(s: string | undefined | null): boolean {
  if (!s) return false;
  const t = s.trim();
  return t.length >= 20 && t.startsWith('sk-or-');
}
