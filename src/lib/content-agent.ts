import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const SYSTEM_PROMPT_BASE = `Você é um especialista em redação didática e construção de materiais educacionais para cursos online. Sua tarefa é transformar a transcrição de aula fornecida em conteúdo estruturado para estudo E sugerir elementos visuais (imagens, gráficos, fluxogramas, tabelas, ícones) sempre que o texto justificar. Essas sugestões serão usadas pela IA de design na diagramação final.

REGRAS OBRIGATÓRIAS:
1. Use EXCLUSIVAMENTE o conteúdo da transcrição fornecida. Não adicione informações externas. Fidelidade 100%.
2. Reescreva com linguagem de livro didático: clara, objetiva e envolvente.
3. Estruture em blocos com os tipos: titulo_principal, subtitulo, texto_corrido, lista_bullets, citacao_destaque, dado_numerico.
4. Retorne APENAS um JSON válido. Sem texto antes ou depois do JSON.
5. Cada página deve ter no máximo 300 palavras de texto corrido.
6. SUGESTÕES VISUAIS (obrigatório quando fizer sentido com o texto):
   - sugestao_imagem: em CADA página de conteúdo, descreva uma imagem/ilustração que reforça o texto (cenário, conceito visual, diagrama). Use também prompt_imagem: descrição curta em português para geração de imagem.
   - Quando a transcrição citar NÚMEROS, PERCENTUAIS ou COMPARAÇÕES: preencha sugestao_grafico com { "tipo": "barra"|"pizza"|"linha", "titulo": "...", "labels": ["..."], "valores": [números] }. Dados devem vir SOMENTE do texto.
   - Quando a transcrição descrever PROCESSO, ETAPAS ou SEQUÊNCIA: preencha sugestao_fluxograma com { "titulo": "...", "etapas": ["etapa 1", "etapa 2", ...] }.
   - Quando houver LISTAS, COMPARAÇÕES ou DADOS TABULARES: preencha sugestao_tabela com { "titulo": "...", "colunas": ["Col1", "Col2"], "linhas": [["a","b"], ...] } ou sugestao_planilha com descrição do que deve aparecer.
   - sugestao_icone: em cada página, sugira um ícone descritivo (ex.: "gráfico crescendo", "checklist", "lampada") que represente o conteúdo.

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
      "bloco_principal": "texto corrido...",
      "destaques": ["ponto 1", "ponto 2"],
      "citacao": "frase marcante (se houver)",
      "dado_numerico": "número ou estatística (se houver)",
      "sugestao_imagem": "descrição do elemento visual",
      "prompt_imagem": "prompt curto para gerar essa imagem",
      "sugestao_icone": "nome do ícone sugerido",
      "sugestao_grafico": { "tipo": "barra"|"pizza"|"linha", "titulo": "...", "labels": [], "valores": [] },
      "sugestao_fluxograma": { "titulo": "...", "etapas": [] },
      "sugestao_tabela": { "titulo": "...", "colunas": [], "linhas": [] }
    }
  ]
}
Inclua sugestao_grafico, sugestao_fluxograma e sugestao_tabela APENAS quando o conteúdo da transcrição tiver dados/processos que justifiquem. Mantenha sugestao_imagem e sugestao_icone em toda página de conteúdo.

MODO DE GERAÇÃO:`;

export type ModoContent = 'completo' | 'resumido' | 'mapa_mental';

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
 * @param modo - 'completo' | 'resumido' | 'mapa_mental'
 * @param nomeCurso - Nome do curso
 * @returns Objeto com titulo, subtitulo_curso e paginas
 */
export async function generateContent(
  transcricao: string,
  modo: ModoContent,
  nomeCurso: string
): Promise<ContentAgentResult> {
  const systemPrompt = `${SYSTEM_PROMPT_BASE} ${modo}.`;

  const userContent = `Transcrição da aula (use EXCLUSIVAMENTE este conteúdo):

${transcricao.slice(0, 120000)}

---
Modo selecionado: ${modo}
Nome do curso: ${nomeCurso}

Retorne o JSON com a estrutura definida. Apenas JSON válido, sem markdown.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const block = message.content.find((b) => b.type === 'text');
    const raw = block && 'text' in block ? String(block.text).trim() : '';
    if (!raw) {
      throw new Error('Resposta vazia do modelo.');
    }

    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    return JSON.parse(jsonStr) as ContentAgentResult;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('Resposta do modelo não é um JSON válido.');
    }
    throw err;
  }
}
