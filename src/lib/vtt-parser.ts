/**
 * Parse VTT content and return clean plain text (no timestamps, no WEBVTT, no sequence numbers).
 */

/** Regex para linha de timestamp: 00:00:00.000 --> 00:00:00.000 */
const TIMESTAMP_LINE = /^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/;

/**
 * Recebe o conteúdo de um arquivo VTT, remove timestamps, WEBVTT, números de sequência
 * e linhas vazias duplicadas, e retorna o texto corrido limpo.
 */
export function parseVTT(vttContent: string): string {
  if (!vttContent || typeof vttContent !== 'string') return '';

  const lines = vttContent.split(/\r?\n/);
  const cleaned: string[] = [];
  let prevEmpty = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Remove linha "WEBVTT" (e opcionalmente com cabeçalho após)
    if (line.toUpperCase().startsWith('WEBVTT')) continue;

    // Remove linhas de timestamp
    if (TIMESTAMP_LINE.test(line)) continue;

    // Remove linhas vazias duplicadas
    if (line === '') {
      if (prevEmpty) continue;
      prevEmpty = true;
      continue;
    }
    prevEmpty = false;

    // Remove números de sequência (linha que contém apenas um número)
    if (/^\d+$/.test(line)) continue;

    cleaned.push(line);
  }

  // Junte todas as falas em um texto corrido (um espaço entre trechos)
  return cleaned.join(' ').replace(/\s+/g, ' ').trim();
}
