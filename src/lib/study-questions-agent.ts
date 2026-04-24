import { getOpenRouterModelForTask, openRouterChat } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';

/**
 * Gera 3 perguntas de estudo/reflexão para a página de atividades ao final do material.
 * Prioriza o conteúdo já estruturado (gerado) quando disponível no texto de referência.
 */
export async function generateThreeStudyQuestions(input: {
  titulo: string;
  subtituloCurso?: string;
  textoBase: string;
}): Promise<string[]> {
  const excerpt = input.textoBase.slice(0, 14_000);
  const user = `Com base no material abaixo (conteúdo gerado e/ou texto-fonte), gere exatamente 3 perguntas de estudo ou atividades em português (uma frase cada), alinhadas ao que o material ensina. As perguntas devem ajudar o aluno a fixar e aplicar o conteúdo. Não invente fatos que não apareçam no material.

Título: ${input.titulo}
Curso/disciplina: ${input.subtituloCurso?.trim() || '—'}

Referência (conteúdo gerado e/ou transcrição):
---
${excerpt}
---

Responda APENAS com JSON válido neste formato, sem texto antes ou depois e sem markdown:
{"perguntas":["primeira pergunta","segunda pergunta","terceira pergunta"]}`;

  const raw = await openRouterChat({
    system:
      'Você é professor e cria perguntas para atividades de fixação. Responda somente com o JSON pedido, sem cercas ```.',
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
