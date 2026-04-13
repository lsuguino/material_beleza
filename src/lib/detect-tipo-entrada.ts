/**
 * Identifica se o arquivo é transcrição/legendas (fluxo com IA de conteúdo)
 * ou texto já estruturado para diagramação (parser / resumo do organizado).
 */

const TIMESTAMP_CUE =
  /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/;

function looksLikeTranscricaoOuLegenda(raw: string): boolean {
  const sample = raw.slice(0, 120_000);
  if (/^\s*WEBVTT/im.test(sample)) return true;
  const cues = sample.match(new RegExp(TIMESTAMP_CUE.source, 'g'));
  if (cues && cues.length >= 2) return true;
  // SRT: blocos com índice + timestamp
  const lines = sample.split(/\r?\n/);
  let numericThenTs = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\d+$/.test(lines[i].trim()) && TIMESTAMP_CUE.test(lines[i + 1]?.trim() || '')) {
      numericThenTs += 1;
      if (numericThenTs >= 2) return true;
    }
  }
  return false;
}

function looksLikeTextoOrganizado(raw: string, fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return true;

  const sample = raw.slice(0, 100_000);
  const lines = sample.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const headings = lines.filter((l) => /^#{1,3}\s+\S/.test(l));
  if (headings.length >= 2) return true;

  const hasSeparator = /\n-{3,}\n/.test(sample);
  if (headings.length >= 1 && (lines.length > 18 || hasSeparator)) return true;

  const listLines = lines.filter((l) => /^[-*•]\s+\S|^\d+[.)]\s+\S/.test(l)).length;
  if (headings.length >= 1 && listLines >= 5) return true;

  return false;
}

/**
 * @param rawText — texto bruto do arquivo (antes de `parseVTT`), ou texto extraído do PDF
 * @param fileName — nome do arquivo (extensão e contexto)
 * @param isPdf — quando true, não há cues VTT no arquivo; usa só estrutura (# títulos etc.)
 */
export function detectTipoEntrada(
  rawText: string,
  fileName: string,
  isPdf: boolean
): 'transcricao' | 'organizado' {
  if (!rawText || typeof rawText !== 'string') return 'transcricao';

  if (isPdf) {
    const h = (rawText.match(/^#{1,3}\s+.+$/gm) || []).length;
    if (h >= 2) return 'organizado';
    return 'transcricao';
  }

  if (looksLikeTranscricaoOuLegenda(rawText)) return 'transcricao';
  if (looksLikeTextoOrganizado(rawText, fileName)) return 'organizado';

  return 'transcricao';
}
