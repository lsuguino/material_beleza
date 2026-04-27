/**
 * Remove travessões (— em-dash U+2014, – en-dash U+2013) de qualquer string textual,
 * substituindo por vírgula. Rede de segurança contra clichê de IA — o prompt
 * já proíbe, mas o modelo às vezes escapa.
 *
 * Aplicar em todos os campos de texto e arrays de strings das páginas geradas.
 */

const TRAVESSAO_RE = /\s*[—–]\s*/g;

export function stripTravessao(text: string): string {
  if (!text) return text;
  let out = text.replace(TRAVESSAO_RE, ', ');
  // Limpa artefatos: vírgulas duplas, espaço antes de vírgula, vírgula antes de ponto/final
  out = out.replace(/,\s*,/g, ',');
  out = out.replace(/\s+,/g, ',');
  out = out.replace(/,\s+([.!?])/g, '$1');
  out = out.replace(/^\s*,\s*/, ''); // remove vírgula no início
  out = out.replace(/\s*,\s*$/, ''); // remove vírgula solta no fim
  // Espaços duplos / triplos viram um só
  out = out.replace(/[ \t]{2,}/g, ' ');
  return out;
}

const STRING_FIELDS = [
  'titulo',
  'subtitulo',
  'titulo_bloco',
  'bloco_principal',
  'citacao',
  'sugestao_imagem',
] as const;

const ARRAY_FIELDS = ['itens', 'destaques'] as const;

function cleanStringFieldsInPlace(obj: Record<string, unknown>): void {
  for (const field of STRING_FIELDS) {
    const v = obj[field];
    if (typeof v === 'string') obj[field] = stripTravessao(v);
  }
  for (const field of ARRAY_FIELDS) {
    const v = obj[field];
    if (Array.isArray(v)) {
      obj[field] = v.map((s) => (typeof s === 'string' ? stripTravessao(s) : s));
    }
  }
  // content_blocks: limpa só os de tipo "text"
  if (Array.isArray(obj.content_blocks)) {
    obj.content_blocks = (obj.content_blocks as Array<Record<string, unknown>>).map((b) => {
      if (b && typeof b === 'object' && b.type === 'text' && typeof b.content === 'string') {
        return { ...b, content: stripTravessao(b.content) };
      }
      return b;
    });
  }
}

/**
 * Aplica stripTravessao em todos os campos textuais de cada página + raiz do conteúdo.
 * Retorna NOVO objeto (não muta o input).
 */
export function stripTravessaoFromConteudo(
  conteudo: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...conteudo };

  // Raiz
  if (typeof out.titulo === 'string') out.titulo = stripTravessao(out.titulo);
  if (typeof out.subtitulo_curso === 'string') {
    out.subtitulo_curso = stripTravessao(out.subtitulo_curso);
  }

  const paginas = out.paginas as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(paginas)) {
    out.paginas = paginas.map((p) => {
      const cleaned = { ...p };
      cleanStringFieldsInPlace(cleaned);
      return cleaned;
    });
  }

  return out;
}
