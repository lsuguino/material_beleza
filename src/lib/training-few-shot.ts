import { readTrainingFeedbackRecords, type TrainingFeedbackRecord } from '@/lib/training-feedback-store';

async function getRejectHintsSuffix(): Promise<string> {
  const all = await readTrainingFeedbackRecords();
  const notes = all
    .filter(
      (r) => r.verdict === 'reject' && typeof r.note === 'string' && r.note.trim().length > 0
    )
    .slice(-8)
    .map((r) => r.note!.trim());
  if (notes.length === 0) return '';
  const merged = notes.join('\n—\n');
  return `\n\n=== FEEDBACK NEGATIVO (reprovações com comentário — evite repetir estes problemas) ===\n${merged.slice(0, 2_800)}\n=== FIM DO FEEDBACK NEGATIVO ===\n`;
}

const MAX_SCRIBO_EXAMPLES = 3;
const MAX_TEACHING_EXAMPLES = 2;
const MAX_JSON_CHARS_SCRIBO = 4_200;
const MAX_JSON_CHARS_TEACHING = 5_500;

function safeJsonSlice(obj: unknown, maxChars: number): string {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}… [truncado]`;
  } catch {
    return '{}';
  }
}

/** Extrai trecho didático do preview Scribo para few-shot (poucas páginas). */
function scriboExcerptFromPreview(previewData: Record<string, unknown>): Record<string, unknown> {
  const conteudo = previewData.conteudo as Record<string, unknown> | undefined;
  const design = previewData.design as Record<string, unknown> | undefined;
  const titulo = (conteudo?.titulo ?? design?.titulo ?? '') as string;
  const subtitulo_curso = (conteudo?.subtitulo_curso ?? design?.subtitulo_curso ?? '') as string;
  const rawPaginas = (conteudo?.paginas ?? design?.paginas) as unknown[] | undefined;
  const paginas = Array.isArray(rawPaginas) ? rawPaginas : [];
  const slice = paginas.slice(0, 5).map((p) => {
    const page = p as Record<string, unknown>;
    return {
      tipo: page.tipo,
      titulo: page.titulo,
      subtitulo: page.subtitulo,
      titulo_bloco: page.titulo_bloco,
      bloco_principal:
        typeof page.bloco_principal === 'string'
          ? page.bloco_principal.slice(0, 4_000)
          : page.bloco_principal,
      content_blocks: page.content_blocks,
      destaques: page.destaques,
      itens: page.itens,
      citacao: page.citacao,
    };
  });
  return {
    titulo,
    subtitulo_curso,
    paginas: slice,
  };
}

/** Trecho de apostila (sections) para few-shot. */
function teachingExcerpt(material: Record<string, unknown>): Record<string, unknown> {
  const sections = Array.isArray(material.sections) ? material.sections : [];
  const head = sections.slice(0, 4).map((s) => {
    const sec = s as Record<string, unknown>;
    const blocks = Array.isArray(sec.blocks) ? sec.blocks : [];
    const slimBlocks = blocks.slice(0, 8).map((b) => {
      const bl = b as Record<string, unknown>;
      const content =
        typeof bl.content === 'string' && bl.content.length > 3_500
          ? `${bl.content.slice(0, 3_500)}…`
          : bl.content;
      return { type: bl.type, content, items: bl.items, caption: bl.caption };
    });
    return { title: sec.title, blocks: slimBlocks };
  });
  return {
    title: material.title,
    subtitle: material.subtitle,
    summary: typeof material.summary === 'string' ? material.summary.slice(0, 1_200) : material.summary,
    sections: head,
  };
}

/**
 * Bloco de texto para anexar ao system prompt da geração Scribo (JSON paginas).
 * Usa só materiais aprovados; conteúdo factual da nova aula continua vindo só do VTT.
 */
export async function getFewShotSuffixForScriboContent(): Promise<string> {
  const all = await readTrainingFeedbackRecords();
  const approved = all
    .filter((r) => r.verdict === 'approve' && r.format === 'scribo' && r.previewData)
    .slice(-MAX_SCRIBO_EXAMPLES);

  const negative = await getRejectHintsSuffix();
  if (approved.length === 0) {
    return negative;
  }

  const parts: string[] = [];
  for (let i = 0; i < approved.length; i += 1) {
    const rec = approved[i] as TrainingFeedbackRecord;
    const excerpt = scriboExcerptFromPreview(rec.previewData as Record<string, unknown>);
    parts.push(
      `--- Referência aprovada ${i + 1} (estilo/estrutura; NÃO copie fatos deste exemplo — use só a transcrição atual) ---\n${safeJsonSlice(excerpt, MAX_JSON_CHARS_SCRIBO)}`
    );
  }

  const positive = `\n\n=== MATERIAIS DE REFERÊNCIA (APROVADOS PELO USUÁRIO) ===
Os trechos abaixo mostram tom, densidade, organização e formato JSON que o usuário já validou. Replique esse PADRÃO de qualidade e estrutura.
REGRA: todo fato, exemplo e número da NOVA aula deve vir EXCLUSIVAMENTE da transcrição desta requisição — não reproduza tópicos dos exemplos.
${parts.join('\n\n')}
=== FIM DAS REFERÊNCIAS ===\n`;
  return `${positive}${negative}`;
}

/**
 * Few-shot para rota generate-material (TeachingMaterial / sections).
 */
export async function getFewShotSuffixForTeachingMaterial(): Promise<string> {
  const all = await readTrainingFeedbackRecords();
  const approved = all
    .filter((r) => r.verdict === 'approve' && r.format === 'teaching' && r.teachingMaterial)
    .slice(-MAX_TEACHING_EXAMPLES);

  const negative = await getRejectHintsSuffix();
  if (approved.length === 0) {
    return negative;
  }

  const parts: string[] = [];
  for (let i = 0; i < approved.length; i += 1) {
    const rec = approved[i] as TrainingFeedbackRecord;
    const excerpt = teachingExcerpt(rec.teachingMaterial as Record<string, unknown>);
    parts.push(
      `--- Apostila aprovada ${i + 1} (estrutura; fatos só do VTT atual) ---\n${safeJsonSlice(excerpt, MAX_JSON_CHARS_TEACHING)}`
    );
  }

  const positive = `\n\n=== REFERÊNCIAS DE APOSTILAS APROVADAS ===
Use como guia de estilo, profundidade e organização em sections/blocks. Não copie conteúdo dos exemplos.
${parts.join('\n\n')}
=== FIM ===\n`;
  return `${positive}${negative}`;
}
