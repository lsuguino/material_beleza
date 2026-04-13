/**
 * Evita repetir o mesmo trecho do VTT em callouts, corpo e pull quotes no preview.
 * Comparação normalizada + detecção de trecho quase idêntico dentro de parágrafo maior.
 */
function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Retorna o trecho apenas se não for duplicata (exata ou ~mesmo texto) de nenhuma fonte.
 */
export function excerptDistinctFromSources(excerpt: string | undefined, sources: string[]): string {
  const t = String(excerpt || '').trim();
  if (!t) return '';
  const nt = norm(t);
  for (const src of sources) {
    const s = String(src || '').trim();
    if (!s) continue;
    const ns = norm(s);
    if (!ns) continue;
    if (nt === ns) return '';
    const shortOne = nt.length <= ns.length ? nt : ns;
    const longOne = nt.length > ns.length ? nt : ns;
    if (shortOne.length >= 20 && longOne.includes(shortOne) && shortOne.length / longOne.length >= 0.88) {
      return '';
    }
  }
  return t;
}
