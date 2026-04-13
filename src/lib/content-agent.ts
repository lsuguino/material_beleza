import { openRouterChatByTask } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';
import { getSkillsSummaryForPrompt } from '@/lib/skills/load-skills';

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
   - Conceitos, definições, partes do método, raciocínio do professor e explicações didáticas: **sempre em texto corrido** (parágrafos desenvolvidos em bloco_principal e/ou blocos “text”). **PROIBIDO** transformar a teoria inteira em lista no lugar dos parágrafos.
   - Campo **“itens”** (tópicos numerados no material impresso): em **cada página de conteúdo**, inclua **3 ou 4** frases **curtas** (no máximo ~22 palavras cada), com tom **acionável** — passos, lembretes ou conclusões práticas que o professor **deixou explícito** no VTT (priorize listas “primeiro… segundo…”, recomendações do tipo “faça…”, “evite…”, ou ideias que você já desenvolveu no bloco_principal). **Nada de inventar:** só o que está sustentado na transcrição. **Não copie** um parágrafo inteiro do bloco_principal dentro de “itens”; reformule de forma telegráfica.
   - Campo **”destaques”**: use SOMENTE quando o professor der uma dica explícita (“minha dica é...”, “uma coisa importante...”, “tente fazer...”) ou propor um exercício prático (“faça isso...”, “teste...”). Não invente dicas nem exercícios genéricos. Se a transcrição não tem dica ou exercício explícito, use array vazio []. O primeiro destaque vira “Dica do Autor”, o segundo vira “Exercício Prático” — ambos só aparecem se existirem.
   - Use h1 (titulo_bloco) para pontos lógicos principais; use subtitulo para divisões complementares do mesmo assunto.
   - Formate citações ou falas marcantes no campo “citacao” (caixa com aspas no layout).
4. O conteúdo deve ser estruturado, limpo e navegável, mantendo a sequência do vídeo.
5. Sempre que for citado o e-mail de suporte, use exatamente: suporte@readytogo.com.br
6. TÍTULO DA AULA: extraia do VTT. Se não houver explícito, crie um título curto fiel ao tema.

REGRAS TÉCNICAS:
7. Use EXCLUSIVAMENTE o conteúdo da transcrição. Não adicione informações externas.
8. Retorne APENAS JSON válido, sem texto antes ou depois, sem cercas de código.
9. PÁGINAS COM PROFUNDIDADE:
   - bloco_principal: mínimo 220 palavras e MÁXIMO 350 palavras (~1800 caracteres) por página. Se exceder, divida em outra página.
   - Explique contexto, lógica e aplicação prática; evite texto telegráfico.
   - Prefira menos páginas bem preenchidas a muitas páginas vazias.
   - Pelo menos ~75% das **palavras** da página devem estar no bloco_principal (parágrafos). O restante pode concentrar-se em “itens” e “destaques” (frases curtas).
   - “itens”: 3 ou 4 por página de conteúdo (vide item 3). Use [] só se a transcrição **realmente** não oferecer nenhum passo ou take-away aplicável naquela página (caso raro).
   - “destaques”: só quando fizer sentido para callouts (pode ser []). Não use “destaques” para substituir “itens”.
10. SUGESTÕES VISUAIS (quando fizer sentido):
    sugestao_grafico, sugestao_fluxograma, sugestao_tabela, sugestao_icone.
    IMAGENS: inclua sugestao_imagem em pelo menos 2 páginas de conteúdo (além da capa). Escolha as páginas onde uma imagem ilustrativa ajudaria a compreensão — processos, exemplos visuais, cenários práticos. Descreva a imagem de forma objetiva no campo sugestao_imagem (ex: "Diagrama mostrando o ciclo de vendas em 4 etapas"). Quando a imagem for inserida, o layout deve reservar espaço para ela (o design-agent escolherá A4_2_texto_imagem ou A4_4_magazine).
11. TIPOS EM content_blocks — use SOMENTE: “text” | “mermaid” | “chart”.
    - NÃO use type “image”. Não gere prompts de imagem.
    - FLUXOGRAMAS / ORGANOGRAMAS → type “mermaid” com código Mermaid válido. Use sempre que houver processos, etapas, hierarquias ou fluxos na transcrição.
    - GRÁFICOS DE DADOS → type “chart” com JSON (só dados da transcrição). Use sempre que houver números, comparações ou estatísticas.
12. SEM CLONAR TEXTO: “citacao”, “destaques” e cada linha de “itens” devem estar redigidos de forma **não idêntica** a um único parágrafo inteiro de bloco_principal (citação pode ser trecho fiel curto; itens = frases sintéticas próprias).

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
        { "type": "mermaid", "content": "flowchart LR\n  A[Start] --> B[Step 1]\n  B --> C[Step 2]" },
        { "type": "chart", "content": "{\"tipo\":\"barra\",\"titulo\":\"Título\",\"labels\":[\"A\",\"B\"],\"valores\":[10,20]}" }
      ],
      "destaques": [] ou itens curtos para faixas/callouts (exemplos, dicas pontuais),
      "itens": ["3 a 4 tópicos curtos e acionáveis extraídos do VTT", "..."],
      "citacao": "outro trecho fiel do VTT (frase ou parágrafo curto), OBRIGATORIAMENTE diferente de qualquer parágrafo em bloco_principal na mesma página — nunca copie ou reescreva o mesmo texto do corpo; se não houver segundo trecho marcante, omita citacao ou use string vazia",
      "dado_numerico": "número (se houver)",
      "sugestao_icone": "ícone (opcional, raramente usado)",
      "sugestao_grafico": { "tipo": "barra"|"pizza"|"linha", "titulo": "...", "labels": [], "valores": [] },
      "sugestao_fluxograma": { "titulo": "...", "etapas": [] },
      "sugestao_tabela": { "titulo": "...", "colunas": [], "linhas": [] }
    }
  ]
}
Use content_blocks conforme o tipo de conteúdo: mermaid → Mermaid.js (fluxogramas, organogramas, hierarquias), chart → Chart.js (gráficos de dados, comparações numéricas). Priorize criar diagramas mermaid e gráficos chart sempre que a transcrição mencionar processos, etapas, fluxos, hierarquias ou dados numéricos. Mantenha bloco_principal para páginas sem content_blocks.

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
    /** Tópicos numerados no layout (passos / takeaways do VTT) */
    itens?: string[];
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
    'Material COMPLETO: bloco_principal denso em texto corrido (mín. 380 palavras de conceito, explicação e aplicação). Em quase TODAS as páginas de conteúdo, preencha "itens" com 3 ou 4 tópicos curtos e acionáveis, só com base no VTT (layout numerado). Use "destaques" para exemplos ou dicas de callout. Não troque parágrafos por listas: teoria permanece no bloco_principal. PROIBIDO resumir o curso inteiro só em bullets.',
  resumido:
    'Material RESUMIDO: mín. 220 palavras por página em parágrafos. Inclua "itens" com 2 ou 3 tópicos curtos quando o VTT tiver passos ou conclusões claras. "destaques" para exemplos pontuais. Proibido substituir toda a teoria por listas.',
};

/** Limite de caracteres da transcrição por modo (menor = resposta mais rápida) */
const TRANSCRIPTION_LIMIT: Record<ModoContent, number> = {
  resumido: 70000,
  completo: 95000,
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
    for (const item of pagina.itens || []) total += item.length;
    for (const block of pagina.content_blocks || []) total += block.content?.length ?? 0;
  }
  return total;
}

function wordsInText(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function averageWordsPerContentPage(result: ContentAgentResult): number {
  const pages = (result.paginas || []).filter((p) => p.tipo === 'conteudo');
  if (pages.length === 0) return 0;
  const totalWords = pages.reduce((acc, p) => acc + wordsInText(String(p.bloco_principal ?? '')), 0);
  return totalWords / pages.length;
}

export async function generateContent(
  transcricao: string,
  modo: ModoContent,
  nomeCurso: string
): Promise<ContentAgentResult> {
  const skills = getSkillsSummaryForPrompt();
  const systemPrompt = `${SYSTEM_PROMPT_BASE} ${modo}.\n\n${skills}`;
  const modeInstruction = MODE_INSTRUCTIONS[modo];
  const limit = TRANSCRIPTION_LIMIT[modo];
  const transcricaoEnviada = transcricao.slice(0, limit);

  const isResumoPalestra = nomeCurso.toLowerCase().includes('resumo de palestra') || nomeCurso.toLowerCase().includes('master fluxo');
  const capaInstruction = isResumoPalestra
    ? `CAPA (Resumo de Palestra): titulo = "Resumo" + nome do palestrante (ex: "Resumo — Rodrigo Tadewald"); subtitulo = tema da palestra (ex: "VSL e Metrificação de Funil"); se houver frase de impacto na transcrição, inclua como terceira linha no subtitulo ou em campo separado.`
    : '';

  const minCharsTarget = modo === 'resumido'
    ? Math.floor(transcricaoEnviada.length * 0.72)
    : Math.min(Math.floor(transcricaoEnviada.length * 0.82), 56000);

  const userContentBase = `Transcrição da aula (use EXCLUSIVAMENTE este conteúdo):

${transcricaoEnviada}

---
Modo: ${modo}. Curso: ${nomeCurso}.
${modeInstruction}
${capaInstruction}
Retorne APENAS o JSON puro, sem cercas de código (sem \`\`\`json ou \`\`\`). Nenhuma página vazia.
Mínimo de caracteres de conteúdo textual no JSON final: ${minCharsTarget}.
${modo === 'completo' ? 'MODO COMPLETO: não resuma. Desenvolva explicações completas e preserve a profundidade do VTT.' : ''}`;

  const maxTokens = modo === 'resumido' ? 10000 : 14000;
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
      const avgWords = averageWordsPerContentPage(parsed);
      const minAvgWords = modo === 'completo' ? 320 : 180;
      if ((chars >= minCharsTarget && avgWords >= minAvgWords) || attempt === 2) {
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
