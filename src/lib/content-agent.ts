import Anthropic from '@anthropic-ai/sdk';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const SYSTEM_PROMPT_BASE = `Você é um especialista em redação didática e construção de materiais educacionais para cursos online. Sua tarefa é transformar a transcrição de aula fornecida em conteúdo estruturado para estudo E sugerir elementos visuais (imagens, gráficos, fluxogramas, tabelas, ícones) sempre que o texto justificar. Essas sugestões serão usadas pela IA de design na diagramação final.

REGRAS OBRIGATÓRIAS:
1. Use EXCLUSIVAMENTE o conteúdo da transcrição fornecida. Não adicione informações externas. Fidelidade 100%.
2. Reescreva com linguagem de livro didático: clara, objetiva e envolvente.
3. Estruture em blocos com os tipos: titulo_principal, subtitulo, texto_corrido, lista_bullets, citacao_destaque, dado_numerico.
4. Retorne APENAS um JSON válido. Sem texto antes ou depois do JSON.
5. PÁGINAS NUNCA VAZIAS: Cada página de conteúdo DEVE estar bem preenchida. NUNCA crie páginas com pouco texto.
   - bloco_principal: no MÍNIMO 120 palavras por página (modo resumido) e 180 palavras (modo completo). Texto corrido desenvolvido, não apenas uma frase.
   - Inclua SEMPRE destaques (lista de 2 a 5 pontos) ou lista de tópicos quando fizer sentido, para preencher visualmente a página.
   - Prefira MENOS páginas bem preenchidas a MUITAS páginas vazias ou com só título. Consolide o conteúdo em páginas completas.
   - Cada página deve ter: titulo_bloco + bloco_principal (parágrafo(s) desenvolvido(s)) + destaques OU citacao OU dado_numerico quando couber. Nunca apenas título e uma linha.
6. Limite por página: no máximo 300 palavras no bloco_principal para não sobrecarregar; o mínimo garante que a página não fique vazia.
7. SUGESTÕES VISUAIS (obrigatório quando fizer sentido com o texto):
   - sugestao_imagem, prompt_imagem, sugestao_grafico, sugestao_fluxograma, sugestao_tabela, sugestao_icone conforme o conteúdo.

8. MAPEAMENTO TIPO DE CONTEÚDO → FERRAMENTA (obrigatório em content_blocks):
   - FOTOS / FUNDOS / CENÁRIOS VISUAIS → Ferramenta: OpenAI API (DALL-E 3). Crie type "image" em content_blocks. content = IMAGE_PROMPT em inglês, hiperdetalhado, estilo Corporate Photography ou Abstract 3D Renders. Integração: placeholder será preenchido por DALL-E 3.
   - FLUXOGRAMAS / PROCESSOS / ETAPAS / SEQUÊNCIAS → Ferramenta: Mermaid.js. Crie type "mermaid" em content_blocks. content = código Mermaid.js (flowchart, graph LR/TB). O navegador renderiza como gráfico profissional.
   - GRÁFICOS DE DADOS / NÚMEROS / PERCENTUAIS / COMPARAÇÕES → Ferramenta: Chart.js. Crie type "chart" em content_blocks. content = JSON: {"tipo":"barra"|"pizza"|"linha","titulo":"Título do Gráfico","labels":["A","B","C"],"valores":[10,20,30]}. Dados SOMENTE da transcrição. Estilo relatório corporativo (barras, pizzas dinâmicas).

9. content_blocks (ordem de exibição):
   - Intercale type "text", "image", "mermaid" e "chart" conforme o tipo de conteúdo visual solicitado pelo contexto da transcrição.
   - image = IMAGE_PROMPT (DALL-E 3). mermaid = código Mermaid (fluxogramas). chart = JSON do gráfico (Chart.js).

ESTRUTURA DO JSON DE RETORNO:
{
  "titulo": "título da aula",
  "subtitulo_curso": "nome do curso",
  "paginas": [
    {
      "tipo": "capa",
      "titulo": "título",
      "subtitulo": "subtítulo",
      "sugestao_imagem": "descrição para capa"
    },
    {
      "tipo": "conteudo",
      "titulo_bloco": "título do bloco",
      "bloco_principal": "texto corrido... (use quando não usar content_blocks)",
      "content_blocks": [
        { "type": "text", "content": "Parágrafo ou grupo de parágrafos." },
        { "type": "image", "content": "Hyperdetailed English prompt for DALL-E 3: Corporate Photography or Abstract 3D." },
        { "type": "mermaid", "content": "flowchart LR\n  A[Start] --> B[Step 1]\n  B --> C[Step 2]" },
        { "type": "chart", "content": "{\"tipo\":\"barra\",\"titulo\":\"Título\",\"labels\":[\"A\",\"B\"],\"valores\":[10,20]}" }
      ],
      "destaques": ["ponto 1", "ponto 2"],
      "citacao": "frase marcante (se houver)",
      "dado_numerico": "número (se houver)",
      "sugestao_imagem": "descrição",
      "prompt_imagem": "prompt curto",
      "sugestao_icone": "ícone",
      "sugestao_grafico": { "tipo": "barra"|"pizza"|"linha", "titulo": "...", "labels": [], "valores": [] },
      "sugestao_fluxograma": { "titulo": "...", "etapas": [] },
      "sugestao_tabela": { "titulo": "...", "colunas": [], "linhas": [] }
    }
  ]
}
Use content_blocks conforme o tipo de conteúdo: image → DALL-E 3 (fotos/fundos), mermaid → Mermaid.js (fluxogramas), chart → Chart.js (gráficos de dados). Mantenha bloco_principal para páginas sem content_blocks.

IMPORTANTE: O material impresso/PDF não pode ter páginas vazias ou quase vazias. Toda página de conteúdo deve ter texto corrido desenvolvido (mínimo de palavras respeitado), destaques ou listas, e sugestões visuais. Se a transcrição for curta, use menos páginas e preencha cada uma bem; se for longa, distribua em mais páginas mantendo cada uma recheada.

CONFERÊNCIA OBRIGATÓRIA (antes de retornar o JSON): Ao final da geração do material escrito, faça uma CONFERÊNCIA: confira se TODO o assunto falado no VTT está presente no material. Percorra mentalmente os tópicos, exemplos e informações da transcrição e verifique se cada um foi coberto em alguma página. Se algo importante do VTT estiver faltando no material, INCLUA em uma página apropriada (nova ou existente). Só retorne o JSON quando tiver certeza de que o material cobre 100% do conteúdo da transcrição. O design do material só será gerado depois desta conferência; portanto o conteúdo deve estar completo.`;

export type ModoContent = 'completo' | 'resumido';

/** Sugestão de gráfico (dados da transcrição) */
export interface SugestaoGrafico {
  tipo: 'barra' | 'pizza' | 'linha';
  titulo: string;
  labels: string[];
  valores: number[];
}

/** Sugestão de fluxograma */
export interface SugestaoFluxograma {
  titulo: string;
  etapas: string[];
}

/** Sugestão de tabela/planilha */
export interface SugestaoTabela {
  titulo: string;
  colunas: string[];
  linhas: string[][];
}

/** Bloco de conteúdo: texto, imagem (DALL-E 3), fluxograma (Mermaid) ou gráfico (Chart.js) */
export interface ContentBlock {
  type: 'text' | 'image' | 'mermaid' | 'chart';
  content: string;
}

/** Objeto retornado pelo content-agent (estrutura do JSON) */
export interface ContentAgentResult {
  titulo: string;
  subtitulo_curso: string;
  paginas: Array<{
    tipo: string;
    titulo?: string;
    subtitulo?: string;
    titulo_bloco?: string;
    bloco_principal?: string;
    /** Ordem de exibição: text, image (IMAGE_PROMPT), mermaid (código Mermaid.js) */
    content_blocks?: ContentBlock[];
    destaques?: string[];
    citacao?: string;
    dado_numerico?: string;
    sugestao_imagem?: string;
    prompt_imagem?: string;
    sugestao_icone?: string;
    sugestao_grafico?: SugestaoGrafico;
    sugestao_fluxograma?: SugestaoFluxograma;
    sugestao_tabela?: SugestaoTabela;
    [key: string]: unknown;
  }>;
}

/**
 * Gera conteúdo estruturado a partir da transcrição do VTT.
 * @param transcricao - Texto limpo do VTT
 * @param modo - 'completo' | 'resumido'
 * @param nomeCurso - Nome do curso
 * @returns Objeto com titulo, subtitulo_curso e paginas
 */
const MODE_INSTRUCTIONS: Record<ModoContent, string> = {
  completo:
    'Material COMPLETO: desenvolva bem cada tópico. Cada página deve ter bloco_principal com pelo menos 180 palavras (parágrafos bem desenvolvidos), mais destaques ou lista. Não deixe páginas com pouco texto.',
  resumido:
    'Material RESUMIDO: priorize os pontos essenciais, mas CADA PÁGINA deve estar BEM PREENCHIDA. bloco_principal com no mínimo 120 palavras por página (resumos objetivos mas desenvolvidos) e sempre destaques (2 a 5 itens). Nada de páginas com só título e uma frase.',
};

/** Limite de caracteres da transcrição por modo (menor = resposta mais rápida) */
const TRANSCRIPTION_LIMIT: Record<ModoContent, number> = {
  resumido: 55000,
  completo: 75000,
};

export async function generateContent(
  transcricao: string,
  modo: ModoContent,
  nomeCurso: string
): Promise<ContentAgentResult> {
  const systemPrompt = `${SYSTEM_PROMPT_BASE} ${modo}.`;
  const modeInstruction = MODE_INSTRUCTIONS[modo];
  const limit = TRANSCRIPTION_LIMIT[modo];
  const transcricaoEnviada = transcricao.slice(0, limit);

  const userContent = `Transcrição da aula (use EXCLUSIVAMENTE este conteúdo):

${transcricaoEnviada}

---
Modo: ${modo}. Curso: ${nomeCurso}.
${modeInstruction}
Retorne APENAS o JSON puro, sem cercas de código (sem \`\`\`json ou \`\`\`). Nenhuma página vazia.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const block = message.content.find((b) => b.type === 'text');
    const raw = block && 'text' in block ? String(block.text).trim() : '';
    if (!raw) {
      throw new Error('Resposta vazia do modelo.');
    }

    return parseJsonFromAI<ContentAgentResult>(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        'Resposta do modelo não pôde ser interpretada como JSON. Tente gerar o material novamente.'
      );
    }
    throw err;
  }
}
