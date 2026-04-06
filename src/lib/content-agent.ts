import { openRouterChatByTask } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';

const SYSTEM_PROMPT_BASE = `Você é um expert em redação e construção de materiais didáticos, com ampla experiência na elaboração de conteúdos claros, envolventes e pedagógicos para cursos online. Seu domínio da linguagem escrita é voltado para facilitar o aprendizado, mantendo a estrutura dos textos acessível, didática e alinhada com objetivos educacionais. Você entende profundamente sobre metodologias de ensino, técnicas de comunicação instrucional e adaptação de conteúdo para diferentes perfis de alunos.

Você deve reprocessar a aula cujo conteúdo está no arquivo .vtt fornecido, utilizando exclusivamente:
- As linhas fornecidas nesta requisição
- As linhas anteriores já compartilhadas (caso o conteúdo esteja separado em 2 ou mais partes)

INSTRUÇÕES OBRIGATÓRIAS:
1. Garanta 100% de fidelidade ao texto original do VTT anexo.
2. ESTRUTURA POR ASSUNTO — REGRA FUNDAMENTAL:
   - Identifique os pontos lógicos principais da aula (tópicos, temas, seções).
   - Cada assunto principal vira UMA página separada, com seu próprio título (titulo_bloco).
   - O título do assunto deve ser a PRIMEIRA coisa da página — nunca inicie uma página com texto sem apresentar o título do tópico antes.
   - Os títulos de cada página formam o SUMÁRIO do material. Escolha-os como se fossem itens de um índice: claros, diretos e descritivos do conteúdo daquela seção.
   - Quando um assunto terminar, a próxima página inicia com o novo título/tópico.
3. Formatação textual (obrigatório):
   - Conceitos, definições, partes do método, raciocínio do professor e explicações didáticas: **sempre em texto corrido** (parágrafos desenvolvidos em bloco_principal e/ou blocos “text”). **PROIBIDO** transformar teoria em lista de bullets.
   - Bullet points e campo “destaques”: **somente** para exemplos concretos citados na aula (caso prático, pergunta-modelo, diálogo, mini-cenário). Um bullet por exemplo.
   - Use h1 (titulo_bloco) para pontos lógicos principais; use subtitulo para divisões complementares do mesmo assunto.
   - Formate citações ou falas marcantes no campo “citacao” (aspas/itálico no layout).
4. O conteúdo deve ser estruturado, limpo e navegável, mantendo a sequência do vídeo.
5. Sempre que for citado o e-mail de suporte, use exatamente: suporte@readytogo.com.br
6. TÍTULO DA AULA: extraia do VTT. Se não houver explícito, crie um título curto fiel ao tema.

REGRAS TÉCNICAS:
7. Use EXCLUSIVAMENTE o conteúdo da transcrição. Não adicione informações externas.
8. Retorne APENAS JSON válido, sem texto antes ou depois, sem cercas de código.
9. PÁGINAS COM PROFUNDIDADE:
   - bloco_principal: mínimo 220 palavras por página (resumido) e 300 palavras (completo).
   - Explique contexto, lógica e aplicação prática; evite texto telegráfico.
   - Prefira menos páginas bem preenchidas a muitas páginas vazias.
   - No mínimo 85% do texto deve ser parágrafos. No máximo 15% pode ser lista (só exemplos).
   - “destaques”: só para exemplos citados (um por item). Deixe [] se não houver.
10. SUGESTÕES VISUAIS (quando fizer sentido):
    sugestao_imagem, prompt_imagem, sugestao_grafico, sugestao_fluxograma, sugestao_tabela, sugestao_icone.
11. TIPOS EM content_blocks — use SOMENTE: “text” | “image” | “mermaid” | “chart”.
    - FOTOS/CENÁRIOS → type “image” com prompt em inglês (DALL-E 3).
    - FLUXOGRAMAS → type “mermaid” com código Mermaid válido.
    - GRÁFICOS DE DADOS → type “chart” com JSON (só dados da transcrição).
12. SEM CLONAR TEXTO: “citacao” e “destaques” devem ser trechos distintos de bloco_principal.

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
      "titulo_bloco": "OBRIGATÓRIO — título do assunto desta página (curto, direto, máx. 8 palavras). Vira item do sumário. NUNCA deixe vazio.",
      "subtitulo": "OBRIGATÓRIO — frase curta complementar ao título (máx. 12 palavras). Aparece em destaque abaixo do título no bloco colorido do layout.",
      "bloco_principal": "texto corrido... (use quando não usar content_blocks)",
      "content_blocks": [
        { "type": "text", "content": "Parágrafo ou grupo de parágrafos." },
        { "type": "image", "content": "Hyperdetailed English prompt for DALL-E 3: Corporate Photography or Abstract 3D." },
        { "type": "mermaid", "content": "flowchart LR\n  A[Start] --> B[Step 1]\n  B --> C[Step 2]" },
        { "type": "chart", "content": "{\"tipo\":\"barra\",\"titulo\":\"Título\",\"labels\":[\"A\",\"B\"],\"valores\":[10,20]}" }
      ],
      "destaques": [] ou um item por exemplo citado (nunca conceitos em bullet),
      "citacao": "outro trecho fiel do VTT (frase ou parágrafo curto), OBRIGATORIAMENTE diferente de qualquer parágrafo em bloco_principal na mesma página — nunca copie ou reescreva o mesmo texto do corpo; se não houver segundo trecho marcante, omita citacao ou use string vazia",
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
    'Material COMPLETO: cada página com bloco_principal denso em TEXTO CORRIDO (mín. 300 palavras de conceito, explicação, contexto e aplicação). Bullets/destaques APENAS para exemplos que o professor citou (um item por exemplo). Nunca use lista para substituir parágrafos teóricos.',
  resumido:
    'Material RESUMIDO: mín. 220 palavras por página em parágrafos (conceitos em texto corrido, com contexto e explicação prática). Só use destaques/bullets para exemplos citados na fala. Proibido condensar teoria em tópicos.',
};

/** Limite de caracteres da transcrição por modo (menor = resposta mais rápida) */
const TRANSCRIPTION_LIMIT: Record<ModoContent, number> = {
  resumido: 70000,
  completo: 75000,
};

function contentResultChars(result: ContentAgentResult): number {
  let total = 0;
  total += result.titulo?.length ?? 0;
  total += result.subtitulo_curso?.length ?? 0;
  for (const pagina of result.paginas || []) {
    total += pagina.titulo?.length ?? 0;
    total += pagina.subtitulo?.length ?? 0;
    total += pagina.titulo_bloco?.length ?? 0;
    total += pagina.bloco_principal?.length ?? 0;
    total += pagina.citacao?.length ?? 0;
    total += pagina.dado_numerico?.length ?? 0;
    for (const d of pagina.destaques || []) total += d.length;
    for (const block of pagina.content_blocks || []) total += block.content?.length ?? 0;
  }
  return total;
}

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

  const minCharsTarget = modo === 'resumido'
    ? Math.floor(transcricaoEnviada.length * 0.72)
    : Math.min(Math.floor(transcricaoEnviada.length * 0.75), 42000);

  const userContentBase = `Transcrição da aula (use EXCLUSIVAMENTE este conteúdo):

${transcricaoEnviada}

---
Modo: ${modo}. Curso: ${nomeCurso}.
${modeInstruction}
${capaInstruction}
Retorne APENAS o JSON puro, sem cercas de código (sem \`\`\`json ou \`\`\`). Nenhuma página vazia.
Mínimo de caracteres de conteúdo textual no JSON final: ${minCharsTarget}.`;

  const maxTokens = modo === 'resumido' ? 10000 : 12000;
  let lastSyntaxErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const userContent =
      attempt === 0
        ? userContentBase
        : `${userContentBase}

ATENÇÃO: a tentativa anterior ficou curta para estudo autossuficiente.
- Expanda explicações, contexto e exemplos já citados no VTT.
- Garanta que TODOS os exemplos citados pelo professor foram incluídos (em "example" e/ou bullets quando necessário), sem inventar nada.
- Mantenha fidelidade absoluta ao VTT (sem inventar nada).
- Garanta no mínimo ${minCharsTarget} caracteres de conteúdo textual total no JSON.`;
    try {
      const raw = await openRouterChatByTask('text_material', {
        system: systemPrompt,
        user: userContent,
        max_tokens: maxTokens,
      });
      if (!raw) {
        throw new Error('Resposta vazia do modelo.');
      }

      const parsed = parseJsonFromAI<ContentAgentResult>(raw);
      const chars = contentResultChars(parsed);
      if (chars >= minCharsTarget || attempt === 2) {
        return parsed;
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        lastSyntaxErr = err;
        if (attempt === 2) {
          throw new Error(
            'Resposta do modelo não pôde ser interpretada como JSON. Tente gerar o material novamente.'
          );
        }
        continue;
      }
      if (attempt === 2) throw err;
    }
  }
  if (lastSyntaxErr) {
    throw new Error(
      'Resposta do modelo não pôde ser interpretada como JSON. Tente gerar o material novamente.'
    );
  }
  throw new Error('Não foi possível gerar conteúdo com densidade adequada.');
}

/** Prompt para condensar texto já organizado em resumo */
const PROMPT_RESUMO_ORGANIZADO = `Você é um especialista em redação didática. O texto abaixo JÁ ESTÁ ORGANIZADO (com títulos, seções, listas).
Sua tarefa: CONDENSAR o conteúdo em um resumo. Mantenha a estrutura (títulos, seções) mas resuma cada bloco para os pontos essenciais.
Use EXCLUSIVAMENTE o conteúdo fornecido. Não adicione informações externas.
Retorne APENAS um JSON válido. Sem texto antes ou depois.
Estrutura JSON: { "titulo": "...", "subtitulo_curso": "nome do curso", "paginas": [ { "tipo": "capa", "titulo": "...", "subtitulo": "..." }, { "tipo": "conteudo", "titulo_bloco": "...", "bloco_principal": "texto resumido em PARÁGRAFOS (texto corrido)...", "destaques": ["exemplo 1 citado", "exemplo 2 citado"] } ] }
REGRAS IMPORTANTES:
- Conceitos/teoria/explicações: SEMPRE em texto corrido no "bloco_principal" (parágrafos).
- "destaques" é OPCIONAL e só deve ser usado para EXEMPLOS concretos citados pelo professor, variações listadas explicitamente, ou passos enumerados na fala. Se não houver, omita o campo ou use [].
- PROIBIDO transformar o resumo em bullet points.
Cada página de conteúdo deve ter "bloco_principal" com pelo menos 140 palavras (resumo objetivo, mas didático e explicativo).`;

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

  const raw = await openRouterChatByTask('text_material', {
    system: PROMPT_RESUMO_ORGANIZADO,
    user: userContent,
    max_tokens: 4096,
  });
  if (!raw) throw new Error('Resposta vazia do modelo.');

  return parseJsonFromAI<ContentAgentResult>(raw);
}
