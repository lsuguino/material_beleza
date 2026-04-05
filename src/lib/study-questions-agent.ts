import { getOpenRouterModelForTask, openRouterChat } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';

/**
 * Gera 3 perguntas de estudo/reflexão sobre o tema, com base no texto da aula.
 * Usado na primeira etapa de geração quando o usuário opta por incluir perguntas.
 */
export async function generateThreeStudyQuestions(input: {
  titulo: string;
  subtituloCurso?: string;
  textoBase: string;
}): Promise<string[]> {
  const excerpt = input.textoBase.slice(0, 14_000);
  const user = `Com base no tema e no texto abaixo, gere exatamente 3 perguntas de estudo ou reflexão em português (uma frase cada), alinhadas ao conteúdo. As perguntas devem ajudar o aluno a fixar e aplicar o que foi visto. Não invente fatos que não apareçam no texto.

Título: ${input.titulo}
Curso/disciplina: ${input.subtituloCurso?.trim() || '—'}

Trecho do material (transcrição ou texto):
---
${excerpt}
---

Responda APENAS com JSON válido neste formato, sem texto antes ou depois e sem markdown:
{"perguntas":["primeira pergunta","segunda pergunta","terceira pergunta"]}`;

  const raw = await openRouterChat({
    system:
      'Você é professor e cria perguntas pedagógicas curtas. Responda somente com o JSON pedido, sem cercas ```.',
    user,
    max_tokens: 600,
    temperature: 0.35,
    model: getOpenRouterModelForTask('text_material'),
  });

  const parsed = parseJsonFromAI(raw) as { perguntas?: unknown };
  const arr = parsed?.perguntas;
  if (!Array.isArray(arr)) {
    throw new Error('Resposta da IA sem lista "perguntas"');
  }
  const out = arr.map((x) => String(x).trim()).filter(Boolean);
  if (out.length === 0) {
    throw new Error('Nenhuma pergunta retornada');
  }
  const fallbacks = [
    'Quais foram as ideias principais que você reteve deste conteúdo?',
    'Como você aplicaria na prática o que foi apresentado?',
    'Que pontos você ainda gostaria de aprofundar?',
  ];
  for (let i = out.length; i < 3; i += 1) {
    out.push(fallbacks[i] ?? fallbacks[0]);
  }
  return out.slice(0, 3);
}
