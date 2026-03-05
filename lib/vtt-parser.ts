/**
 * Parse VTT content and return clean plain text.
 * - Remove timestamp lines (00:00:00.000 --> 00:00:00.000)
 * - Remove WEBVTT header
 * - Remove duplicate empty lines
 * - Remove sequence numbers (lines with only digits)
 * - Join all speech into a single clean string
 */

/** Regex para linha de timestamp: 00:00:00.000 --> 00:00:00.000 */
const TIMESTAMP_LINE = /^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/;

/**
 * Recebe o conteúdo de um arquivo VTT como string e retorna o texto limpo.
 */
export function parseVTT(vttContent: string): string {
  if (!vttContent || typeof vttContent !== 'string') return '';

  const lines = vttContent.split(/\r?\n/);
  const cleaned: string[] = [];
  let prevEmpty = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 3. Remova a linha "WEBVTT" do início
    if (line.toUpperCase().startsWith('WEBVTT')) continue;

    // 2. Remova todas as linhas de timestamp
    if (TIMESTAMP_LINE.test(line)) continue;

    // 4. Remova linhas vazias duplicadas
    if (line === '') {
      if (prevEmpty) continue;
      prevEmpty = true;
      continue;
    }
    prevEmpty = false;

    // 5. Remova números de sequência (linhas que contêm apenas números)
    if (/^\d+$/.test(line)) continue;

    cleaned.push(line);
  }

  // 6. Junte todas as falas em um texto corrido limpo
  // 7. Retorne o texto limpo como string
  return cleaned.join(' ').replace(/\s+/g, ' ').trim();
}
