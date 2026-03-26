import { openRouterChat } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';

const SYSTEM_PROMPT_BASE = `Você é um expert em redação e construção de materiais didáticos, com ampla experiência na elaboração de conteúdos claros, envolventes e pedagógicos para cursos online. Seu domínio da linguagem escrita é voltado para facilitar o aprendizado, mantendo a estrutura dos textos acessível, didática e alinhada com objetivos educacionais. Você entende profundamente sobre metodologias de ensino, técnicas de comunicação instrucional e adaptação de conteúdo para diferentes perfis de alunos.

Você deve reprocessar a aula "Fluxo de Assinatura e Produtos de Recorrência" utilizando exclusivamente:
- As linhas fornecidas nesta requisição
- As linhas anteriores já compartilhadas (caso o conteúdo esteja separado em 2 ou mais partes)

INSTRUÇÕES OBRIGATÓRIAS:
1. Garanta 100% de fidelidade ao texto original do VTT anexo.
2. Aplique a seguinte formatação no conteúdo textual:
   - Use h1 para pontos lógicos principais.
   - Use h2 para subtítulos ou divisões menores.
   - Utilize bullet points (•) para listas de itens ou ideias destacadas.
   - Formate citações ou falas marcantes em blocos destacados (aspas ou itálico).
3. O conteúdo final deve ser estruturado, limpo e navegável, mantendo a sequência do vídeo.
4. Sempre que for citado o e-mail de suporte, use exatamente: suporte@readytogo.com.br

REGRAS TÉCNICAS DO APLICATIVO:
5. Use EXCLUSIVAMENTE o conteúdo da transcrição fornecida. Não adicione informações externas.
6. Retorne APENAS um JSON válido. Sem texto antes ou depois do JSON.
7. PÁGINAS NUNCA VAZIAS E COM PROFUNDIDADE:
   - bloco_principal: no mínimo 160 palavras por página (modo resumido) e 260 palavras por página (modo completo).
   - Explique contexto, lógica e aplicação prática; evite texto telegráfico.
   - Prefira menos páginas bem preenchidas a muitas páginas vazias.
8. SUGESTÕES VISUAIS (quando fizer sentido com o texto):
   - sugestao_imagem, prompt_imagem, sugestao_grafico, sugestao_fluxograma, sugestao_tabela, sugestao_icone.
9. MAPEAMENTO TIPO DE CONTEÚDO → FERRAMENTA (em content_blocks):
   - FOTOS/FUNDOS/CENÁRIOS → type "image" com prompt em inglês (DALL-E 3 style).
   - FLUXOGRAMAS/PROCESSOS → type "mermaid" com código Mermaid válido.
   - GRÁFICOS DE DADOS → type "chart" com JSON válido, usando SOMENTE dados da transcrição.

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
    'Material COMPLETO E AUTOSSUFICIENTE: desenvolva cada tópico com profundidade. Cada página deve ter bloco_principal com pelo menos 260 palavras (parágrafos bem desenvolvidos), mais destaques ou lista. Não deixe páginas com pouco texto ou explicações superficiais.',
  resumido:
    'Material RESUMIDO, porém robusto: priorize os pontos essenciais, mas CADA PÁGINA deve estar BEM PREENCHIDA e explicativa. bloco_principal com no mínimo 160 palavras por página e sempre destaques (2 a 5 itens). Nada de páginas com só título e uma frase.',
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

  const isResumoPalestra = nomeCurso.toLowerCase().includes('resumo de palestra') || nomeCurso.toLowerCase().includes('master fluxo');
  const capaInstruction = isResumoPalestra
    ? `CAPA (Resumo de Palestra): titulo = "Resumo" + nome do palestrante (ex: "Resumo — Rodrigo Tadewald"); subtitulo = tema da palestra (ex: "VSL e Metrificação de Funil"); se houver frase de impacto na transcrição, inclua como terceira linha no subtitulo ou em campo separado.`
    : '';

  const userContent = `Transcrição da aula (use EXCLUSIVAMENTE este conteúdo):

${transcricaoEnviada}

---
Modo: ${modo}. Curso: ${nomeCurso}.
${modeInstruction}
${capaInstruction}
Retorne APENAS o JSON puro, sem cercas de código (sem \`\`\`json ou \`\`\`). Nenhuma página vazia.`;

  try {
    const raw = await openRouterChat({
      system: systemPrompt,
      user: userContent,
      max_tokens: 4096,
    });
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

/** Prompt para condensar texto já organizado em resumo */
const PROMPT_RESUMO_ORGANIZADO = `Você é um especialista em redação didática. O texto abaixo JÁ ESTÁ ORGANIZADO (com títulos, seções, listas).
Sua tarefa: CONDENSAR o conteúdo em um resumo. Mantenha a estrutura (títulos, seções) mas resuma cada bloco para os pontos essenciais.
Use EXCLUSIVAMENTE o conteúdo fornecido. Não adicione informações externas.
Retorne APENAS um JSON válido. Sem texto antes ou depois.
Estrutura JSON: { "titulo": "...", "subtitulo_curso": "nome do curso", "paginas": [ { "tipo": "capa", "titulo": "...", "subtitulo": "..." }, { "tipo": "conteudo", "titulo_bloco": "...", "bloco_principal": "texto resumido...", "destaques": ["ponto 1", "ponto 2"] } ] }
Cada página de conteúdo deve ter bloco_principal com pelo menos 80 palavras (resumo objetivo) e destaques quando fizer sentido.`;

/**
 * Condensa texto já organizado em resumo (usa IA para resumir mantendo estrutura).
 */
export async function generateResumoFromOrganizedText(
  texto: string,
  nomeCurso: string
): Promise<ContentAgentResult> {
  const limit = 55000;
  const textoEnviado = texto.slice(0, limit);

  const userContent = `Texto já organizado (condense em resumo mantendo a estrutura):

${textoEnviado}

---
Curso: ${nomeCurso}.
Retorne APENAS o JSON puro, sem cercas de código (sem \`\`\`json ou \`\`\`). Nenhuma página vazia.`;

  const raw = await openRouterChat({
    system: PROMPT_RESUMO_ORGANIZADO,
    user: userContent,
    max_tokens: 4096,
  });
  if (!raw) throw new Error('Resposta vazia do modelo.');

  return parseJsonFromAI<ContentAgentResult>(raw);
}
