/**
 * Extrai e faz parse de JSON da resposta da IA, mesmo com markdown (```json ... ```).
 * Várias estratégias para garantir que a resposta seja parseada mesmo com texto ou cercas.
 */

/**
 * Remove todas as linhas que são apenas cercas de markdown (``` ou ```json etc).
 */
function stripFenceLines(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*```\s*\w*\s*$/.test(line))
    .join('\n');
}

/**
 * Tenta remover vírgulas finais antes de } ou ] (erro comum em JSON gerado por IA).
 */
function repairTrailingCommas(str: string): string {
  return str.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Extrai o primeiro bloco balanceado de abertura openChar até o fechamento closeChar.
 * Respeita strings ("" e '') e escapes.
 */
function extractBalanced(str: string, openChar: string, closeChar: string): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  let quote = '';

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (!inString) {
      if (c === '"' || c === "'") {
        inString = true;
        quote = c;
        continue;
      }
      if (c === openChar) depth++;
      if (c === closeChar) {
        depth--;
        if (depth === 0) return str.slice(0, i + 1);
      }
      continue;
    }
    if (c === quote) inString = false;
  }
  return null;
}

/**
 * Extrai uma string que deve ser JSON a partir do texto bruto.
 * Remove BOM, cercas de markdown, linhas só com ``` e pega o primeiro objeto/array balanceado.
 */
export function extractJsonString(raw: string): string {
  let s = raw.trim();

  if (!s) return s;

  // BOM
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

  // Remove linhas que são só cercas (antes de qualquer outra coisa)
  s = stripFenceLines(s);
  s = s.trim();

  // Remove opening fence no início
  s = s.replace(/^\s*```(?:json)?\s*\n?/i, '');

  // Remove closing fence no final
  s = s.replace(/\n?\s*```\s*$/g, '');

  s = s.trim();

  const objStart = s.indexOf('{');
  const arrStart = s.indexOf('[');
  let start = -1;
  let openChar = '{';
  let closeChar = '}';

  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) {
    start = objStart;
    openChar = '{';
    closeChar = '}';
  } else if (arrStart >= 0) {
    start = arrStart;
    openChar = '[';
    closeChar = ']';
  }

  if (start >= 0) {
    const slice = s.slice(start);
    const extracted = extractBalanced(slice, openChar, closeChar);
    if (extracted !== null) {
      return repairTrailingCommas(extracted);
    }
  }

  return repairTrailingCommas(s);
}

/**
 * Último recurso: percorre todas as posições de { e tenta extrair e parsear um objeto.
 * Retorna o primeiro que der JSON válido.
 */
function tryParseFromEveryBrace(raw: string): unknown {
  const s = stripFenceLines(raw).trim();
  let i = s.indexOf('{');
  while (i >= 0) {
    const slice = s.slice(i);
    const extracted = extractBalanced(slice, '{', '}');
    if (extracted !== null) {
      try {
        const repaired = repairTrailingCommas(extracted);
        return JSON.parse(repaired);
      } catch {
        // continua tentando na próxima {
      }
    }
    i = s.indexOf('{', i + 1);
  }
  return null;
}

/**
 * Parse de string que pode vir com markdown ou texto extra.
 * Usa várias estratégias; em falha, tenta extrair objeto a partir de qualquer {.
 */
export function parseJsonFromAI<T = unknown>(raw: string): T {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Resposta vazia ou inválida.');
  }

  let jsonStr = extractJsonString(raw);

  // Primeira tentativa
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    // ignora e tenta fallbacks
  }

  // Segunda: usar texto bruto sem linhas de cerca e extrair de novo
  const withoutFenceLines = stripFenceLines(raw);
  jsonStr = extractJsonString(withoutFenceLines);
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    // ignora
  }

  // Terceira: remover qualquer coisa antes do primeiro {
  const firstBrace = raw.indexOf('{');
  if (firstBrace >= 0) {
    jsonStr = extractJsonString(raw.slice(firstBrace));
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      // ignora
    }
  }

  // Último recurso: tentar parsear a partir de cada { até achar um JSON válido
  const parsed = tryParseFromEveryBrace(raw);
  if (parsed !== null && typeof parsed === 'object') {
    return parsed as T;
  }

  throw new SyntaxError(
    'Não foi possível extrair JSON válido da resposta. A resposta pode conter markdown (```) ou texto extra.'
  );
}
