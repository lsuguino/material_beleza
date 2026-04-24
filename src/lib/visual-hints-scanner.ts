import { openRouterChatByTask } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';

/** Tipo de elemento visual detectado na transcrição. */
export type HintTipo =
  | 'passo_a_passo'
  | 'dados_numericos'
  | 'hierarquia'
  | 'comparacao'
  | 'faq'
  | 'timeline';

/** Formato sugerido de renderização no material final. */
export type RenderSugerido = 'mermaid' | 'chart' | 'tabela' | 'lista_numerada';

/**
 * Hint visual detectado na transcrição.
 * Cada hint representa uma oportunidade pedagógica de virar um bloco visual
 * (fluxograma, gráfico, tabela, etc.) em vez de texto corrido.
 */
export interface VisualHint {
  tipo: HintTipo;
  /** Curto — o que o elemento representa (usado como título do bloco). */
  titulo_sugerido: string;
  /** Trecho literal do VTT que sustenta o hint — serve pra localizar a página no material. */
  trecho_vtt: string;
  /**
   * Itens/elementos do hint, já ordenados. Formato varia por tipo:
   * - passo_a_passo: ["Etapa 1", "Etapa 2", ...]
   * - dados_numericos: ["Topo: 100%", "Meio: 30%", "Fim: 10%"]
   * - hierarquia: ["Gerente Geral", "Supervisor: Vendas", "Supervisor: SDR", ...]
   * - comparacao: ["Método A | vantagem X | desvantagem Y", "Método B | ..."]
   * - faq: ["Pergunta: X? | Resposta: Y", ...]
   * - timeline: ["2020 | evento X", "2022 | evento Y"]
   */
  elementos: string[];
  render_sugerido: RenderSugerido;
}

interface ScanResult {
  hints: VisualHint[];
}

const SYSTEM_PROMPT = `Você é um scanner de conteúdo didático. Analise a transcrição de aula e identifique TRECHOS que naturalmente se representariam como elementos visuais estruturados (gráfico, fluxograma, organograma, tabela, timeline, FAQ) em vez de texto corrido.

TIPOS DE HINT (detecte APENAS os que existirem explicitamente):

1. passo_a_passo — sequência ordenada de ações/etapas
   Gatilhos: "primeiro... depois... por fim", listas numeradas, passo X de Y
   render_sugerido: "mermaid" (fluxograma) ou "lista_numerada"

2. dados_numericos — números, percentuais, quantidades comparáveis, estatísticas
   Gatilhos: percentuais citados, quantidades específicas, comparações numéricas
   render_sugerido: "chart"

3. hierarquia — estrutura em níveis (equipe, categorias, sub-divisões)
   Gatilhos: "acima dele", "reporta pra", "sub-categorias", "divide em X tipos"
   render_sugerido: "mermaid" (organograma)

4. comparacao — 2+ opções/abordagens comparadas lado a lado
   Gatilhos: "antes vs depois", "método antigo/novo", "tipo A vs tipo B"
   render_sugerido: "tabela"

5. faq — perguntas comuns antecipadas e respondidas
   Gatilhos: "as pessoas perguntam", "é comum questionarem"
   render_sugerido: "lista_numerada"

6. timeline — eventos em ordem cronológica
   Gatilhos: datas específicas, marcos temporais, evolução ao longo do tempo
   render_sugerido: "mermaid" ou "tabela"

REGRAS CRÍTICAS:
- Use APENAS informações EXPLÍCITAS da transcrição. NUNCA invente dados.
- Cada hint DEVE ter um trecho_vtt que cite literalmente a fala que o sustenta (até 200 caracteres).
- Se não houver hint claro de um tipo, omita. Melhor array vazio que hints inventados.
- Limite: até 10 hints no total. Priorize os com mais impacto pedagógico.
- O campo "elementos" deve ser um array de strings, já ordenadas. Cada string carrega a informação do item — para comparação/FAQ/timeline, use separador " | " entre colunas.

FORMATO DE RETORNO (JSON puro, sem markdown, sem cercas de código):
{
  "hints": [
    {
      "tipo": "passo_a_passo",
      "titulo_sugerido": "Processo de qualificação de leads",
      "trecho_vtt": "primeiro você qualifica o lead com BANT, depois agenda uma call, apresenta a proposta e fecha",
      "elementos": ["Qualificar lead com BANT", "Agendar call", "Apresentar proposta", "Fechar"],
      "render_sugerido": "mermaid"
    }
  ]
}

Se não encontrar nenhum hint claro, retorne {"hints": []}.`;

/**
 * Escaneia a transcrição com Haiku em busca de hints visuais (trechos que
 * naturalmente se representariam como gráfico/fluxograma/tabela/etc.).
 *
 * Gracioso em falha: se Haiku falhar ou o JSON vier malformado, retorna [].
 * Nunca quebra o pipeline principal.
 */
export async function scanVisualHints(transcricao: string): Promise<VisualHint[]> {
  if (!transcricao || transcricao.trim().length < 200) return [];

  // Haiku aceita até 200k tokens, mas transcrições longas custam mais.
  // 80k chars é suficiente pra capturar os principais hints.
  const transcricaoLimitada = transcricao.slice(0, 80000);

  try {
    const raw = await openRouterChatByTask('design', {
      system: SYSTEM_PROMPT,
      user: `Transcrição da aula:\n\n${transcricaoLimitada}`,
      max_tokens: 3000,
      temperature: 0.1,
    });

    if (!raw) {
      console.warn('[visual-hints-scanner] Resposta vazia do modelo');
      return [];
    }

    const parsed = parseJsonFromAI<ScanResult>(raw);
    const hints = Array.isArray(parsed?.hints) ? parsed.hints : [];

    // Valida/filtra hints malformados
    const tiposValidos = new Set<HintTipo>([
      'passo_a_passo',
      'dados_numericos',
      'hierarquia',
      'comparacao',
      'faq',
      'timeline',
    ]);
    const rendersValidos = new Set<RenderSugerido>([
      'mermaid',
      'chart',
      'tabela',
      'lista_numerada',
    ]);

    const clean = hints.filter(
      (h) =>
        h &&
        typeof h.tipo === 'string' &&
        tiposValidos.has(h.tipo as HintTipo) &&
        typeof h.titulo_sugerido === 'string' &&
        h.titulo_sugerido.trim().length > 0 &&
        typeof h.trecho_vtt === 'string' &&
        Array.isArray(h.elementos) &&
        h.elementos.length > 0 &&
        typeof h.render_sugerido === 'string' &&
        rendersValidos.has(h.render_sugerido as RenderSugerido),
    );

    console.log(
      `[visual-hints-scanner] ${clean.length} hint(s) detectados`,
      clean.map((h) => `${h.tipo}:${h.titulo_sugerido}`).join(', '),
    );

    return clean.slice(0, 10); // teto de 10
  } catch (err) {
    console.error('[visual-hints-scanner] Falha ao escanear hints:', err);
    return [];
  }
}

/**
 * Formata os hints pra injeção no prompt do content-agent como seção
 * obrigatória (hard instruction).
 */
export function formatHintsForPrompt(hints: VisualHint[]): string {
  if (!hints || hints.length === 0) return '';

  const blocks = hints.map((h, i) => {
    const elementos = h.elementos.map((e, j) => `    ${j + 1}. ${e}`).join('\n');
    return `Hint ${i + 1} — [${h.tipo}] "${h.titulo_sugerido}"
  Trecho VTT: "${h.trecho_vtt.slice(0, 200)}"
  Render sugerido: ${h.render_sugerido}
  Elementos:
${elementos}`;
  });

  return `
HINTS VISUAIS OBRIGATÓRIOS (detectados em pré-scan da transcrição):

Os elementos visuais listados abaixo DEVEM aparecer como content_blocks no material gerado. Cada hint vira UM content_block na página cujo titulo_bloco seja mais relacionado ao trecho_vtt. Se nenhuma página existente encaixar, CRIE uma nova página dedicada ao hint.

${blocks.join('\n\n')}

REGRAS DE CONVERSÃO HINT → content_block:
- render_sugerido="mermaid" → content_block { "type": "mermaid", "content": "<código Mermaid.js em PT-BR>" }
- render_sugerido="chart" → content_block { "type": "chart", "content": "{\\"tipo\\":\\"barra|pizza|linha\\", \\"titulo\\":\\"...\\", \\"labels\\":[...], \\"valores\\":[...]}" }
- render_sugerido="tabela" → campo sugestao_tabela na página { "titulo": "...", "colunas": [...], "linhas": [[...], ...] }
- render_sugerido="lista_numerada" → campo itens na página (array de strings)

IMPORTANTE:
- NÃO invente dados além dos elementos já listados nos hints.
- Use SOMENTE o conteúdo do trecho_vtt + elementos. Se precisar de mais contexto, busque na transcrição, nunca externamente.
- Cada hint gera EXATAMENTE um elemento visual. Não duplique.
`;
}
