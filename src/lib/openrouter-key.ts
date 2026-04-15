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

/**
 * Copia chaves do ambiente para `OPENROUTER_API_KEY` quando o deploy usa nome curto
 * (ex.: `OPENROUTER` na Vercel em vez de `OPENROUTER_API_KEY`).
 */
export function syncOpenRouterKeyFromEnvAliases(): void {
  const primary = normalizeOpenRouterApiKey(process.env.OPENROUTER_API_KEY);
  if (primary) {
    process.env.OPENROUTER_API_KEY = primary;
    return;
  }
  const fromAlias = normalizeOpenRouterApiKey(
    process.env.OPENROUTER ?? process.env.OPENROUTER_KEY ?? process.env.OPENROUTER_API
  );
  if (fromAlias) process.env.OPENROUTER_API_KEY = fromAlias;
}
