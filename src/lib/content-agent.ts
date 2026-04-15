import { TRANSCRIPTION_MAX_CHARS } from '@/lib/api-payload-limits';
import { openRouterChatByTask } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';
import { getSkillsSummaryForPrompt } from '@/lib/skills/load-skills';
import { getFewShotSuffixForScriboContent } from '@/lib/training-few-shot';

/** Regra de idioma compartilhada entre todos os prompts de geração. */
const IDIOMA_RULE = `TODO conteúdo DEVE estar em PORTUGUÊS BRASILEIRO. EXCEÇÃO: termos técnicos de marketing digital, negócios e produtos digitais que são usados em inglês no cotidiano brasileiro devem ser MANTIDOS em inglês, exatamente como o professor falou na transcrição. Exemplos: lead, copy, headline, landing page, VSL, CTA, upsell, downsell, funnel, follow-up, e-mail marketing, opt-in, webinar, masterclass, feedback, briefing, brainstorming, branding, storytelling, pitch, insight, mindset, networking, ROI, KPI, SEO, CPC, ROAS, LTV, CAC, churn, dropshipping, e-commerce, marketplace, infoproduto, Facebook Ads, Google Ads, pixel, remarketing, retargeting, lookalike, criativo, thumbnail, reels, dashboard, analytics, template, framework, script, hook, offer, closer, setter, onboarding, mockup, layout, UI, UX, MVP, SaaS, API, startup, upgrade, premium, freemium, launch, entre outros. Na dúvida, se o professor usou o termo em inglês na transcrição, mantenha em inglês.`;

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
3.1 EXEMPLOS E PREENCHIMENTO POR PÁGINA (miolo):
   - Em **cada** página de conteúdo, privilegie ilustrar o tópico com **exemplos, casos, situações ou falas** que o professor citou no VTT (integrados em parágrafos no bloco_principal, ou em **citacao** se for trecho fiel curto, ou versão telegráfica em **itens**).
   - **Não** deixe páginas “vazias” no sentido didático: evite folha só com título + uma ou duas frases — reúna mais material fiel do VTT na mesma página ou estenda o raciocínio com outro detalhe do mesmo assunto.
   - Se o professor não deu exemplo explícito para aquele ponto, desenvolva o conceito com o máximo de nuance **extraída da transcrição** (sem inventar fatos externos).
   - O sistema de layout **continua** páginas longas automaticamente (continuação): **não** comprima nem corte ideias para caber — prefira **nova página** com o restante do texto.
4. O conteúdo deve ser estruturado, limpo e navegável, mantendo a sequência do vídeo.
5. Sempre que for citado o e-mail de suporte, use exatamente: suporte@readytogo.com.br
6. TÍTULO DA AULA: extraia do VTT. Se não houver explícito, crie um título curto fiel ao tema.

REGRAS TÉCNICAS:
7. Use EXCLUSIVAMENTE o conteúdo da transcrição. Não adicione informações externas.
8. Retorne APENAS JSON válido, sem texto antes ou depois, sem cercas de código.
9. PÁGINAS COM PROFUNDIDADE E RESPIRO VISUAL:
   - **REGRA FUNDAMENTAL DE PREENCHIMENTO**: Cada página deve ocupar NO MÁXIMO 80% da área útil. NUNCA encha texto até colidir com bordas ou rodapé no desenho mental — margens generosas, espaçamento entre blocos. Conteúdo que não couber vira **página seguinte** (continuação), nunca letras cortadas nas laterais.
   - bloco_principal: mínimo 180 palavras e MÁXIMO 280 palavras (~1500 caracteres) por página. Se exceder, crie uma NOVA PÁGINA com o restante do conteúdo — NUNCA corte ou comprima texto para forçá-lo a caber.
   - Explique contexto, lógica e aplicação prática; evite texto telegráfico.
   - Prefira MAIS páginas bem espaçadas a poucas páginas lotadas. Cada página deve parecer uma lâmina editorial profissional, não um bloco de texto corrido.
   - Pelo menos ~70% das **palavras** da página devem estar no bloco_principal (parágrafos). O restante pode concentrar-se em “itens” e “destaques” (frases curtas).
   - “itens”: 3 ou 4 por página de conteúdo (vide item 3). Use [] só se a transcrição **realmente** não oferecer nenhum passo ou take-away aplicável naquela página (caso raro).
   - “destaques”: só quando fizer sentido para callouts (pode ser []). Não use “destaques” para substituir “itens”.
   - PENSE PÁGINA POR PÁGINA: gere cada página individualmente, como uma lâmina independente. Não pense no material como um bloco contínuo — cada página tem seu próprio equilíbrio visual.
10. PÁGINAS DE INTRODUÇÃO DE MÓDULO/CAPÍTULO:
    - Páginas que introduzem um novo módulo, capítulo ou seção devem ser BREVES e visuais.
    - Use apenas: titulo_bloco (título do módulo), subtitulo (frase de contexto, máx. 15 palavras) e opcionalmente uma citação curta ou sugestão de imagem.
    - bloco_principal em páginas de introdução: MÁXIMO 80 palavras (2-3 frases de apresentação do tema, não desenvolvimento).
    - O desenvolvimento do conteúdo DEVE ficar nas páginas SEGUINTES, não na página de abertura.
11. SUGESTÕES VISUAIS (quando fizer sentido):
    sugestao_grafico, sugestao_fluxograma, sugestao_tabela, sugestao_icone.
    IMAGENS: inclua sugestao_imagem em pelo menos 3 páginas de conteúdo (além da capa). Escolha as páginas onde uma imagem ilustrativa ajudaria a compreensão — processos, exemplos visuais, cenários práticos. Descreva a imagem de forma objetiva e em PORTUGUÊS no campo sugestao_imagem (ex: “Fotografia profissional de uma reunião de equipe de vendas discutindo estratégias em um escritório moderno”). Quando a imagem for inserida, o layout reserva espaço para ela.
    GRÁFICOS E ORGANOGRAMAS: inclua pelo menos 1 gráfico (sugestao_grafico) OU 1 fluxograma (content_blocks com type “mermaid”) quando a transcrição mencionar dados numéricos, processos ou etapas.
12. TIPOS EM content_blocks — use SOMENTE: “text” | “mermaid” | “chart”.
    - NÃO use type “image”. Não gere prompts de imagem.
    - FLUXOGRAMAS / ORGANOGRAMAS → type “mermaid” com código Mermaid válido. Use sempre que houver processos, etapas, hierarquias ou fluxos na transcrição. OBRIGATÓRIO: todos os textos dentro do código Mermaid (nomes de nós, labels de setas, títulos) devem estar em PORTUGUÊS. Nunca use “Start”, “End”, “Step” — use “Início”, “Fim”, “Etapa”, etc.
    - GRÁFICOS DE DADOS → type “chart” com JSON (só dados da transcrição). Use sempre que houver números, comparações ou estatísticas. OBRIGATÓRIO: títulos e labels dos gráficos devem estar em PORTUGUÊS.
    - IDIOMA: ${IDIOMA_RULE}
13. SEM CLONAR TEXTO: “citacao”, “destaques” e cada linha de “itens” devem estar redigidos de forma **não idêntica** a um único parágrafo inteiro de bloco_principal (citação pode ser trecho fiel curto; itens = frases sintéticas próprias).

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
        { "type": "mermaid", "content": "flowchart LR\n  A[Início] --> B[Etapa 1]\n  B --> C[Etapa 2]" },
        { "type": "chart", "content": "{\"tipo\":\"barra\",\"titulo\":\"Título\",\"labels\":[\"Item A\",\"Item B\"],\"valores\":[10,20]}" }
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

IMPORTANTE — EQUILÍBRIO VISUAL:
- O material impresso/PDF não pode ter páginas vazias, MAS TAMBÉM não pode ter páginas lotadas que cortam nas extremidades.
- Cada página deve parecer uma lâmina de revista editorial: conteúdo bem distribuído, com espaço para respirar, nunca ultrapassando 80% da área.
- Se o conteúdo ultrapassa o limite de uma página, CRIE UMA NOVA PÁGINA para o restante — jamais comprima.
- Páginas de abertura/introdução de módulo: breves e visuais (título grande + 2-3 frases + sugestão de imagem).
- Páginas de conteúdo: texto corrido equilibrado + itens + citação + elementos visuais (gráficos, fluxogramas, imagens).
- Pense em cada página INDIVIDUALMENTE como uma peça gráfica autônoma.

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
    'Material COMPLETO: bloco_principal com texto corrido (mín. 200, máx. 280 palavras por página). Se o conteúdo não cabe em uma página, CRIE OUTRA — nunca comprima. Em cada página de miolo, inclua exemplos/casos do VTT quando existirem na transcrição. Preencha "itens" com 3 ou 4 tópicos curtos e acionáveis, só com base no VTT. Use "destaques" para exemplos ou dicas de callout. Não troque parágrafos por listas. LEMBRE: cada página deve usar no máximo 80% da área — prefira mais páginas arejadas a poucas lotadas. Páginas de abertura de módulo devem ser BREVES (máx. 80 palavras no bloco_principal).',
  resumido:
    'Material RESUMIDO: mín. 150, máx. 220 palavras por página em parágrafos. Inclua exemplos citados pelo professor quando houver no VTT. Inclua "itens" com 2 ou 3 tópicos curtos quando o VTT tiver passos. "destaques" para exemplos pontuais. Cada página no máximo 80% preenchida; evite página só com título. Páginas de abertura: apenas título + frase curta.',
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
  const fewShot = await getFewShotSuffixForScriboContent();
  const systemPrompt = `${SYSTEM_PROMPT_BASE} ${modo}.\n\n${skills}${fewShot}`;
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
      const minAvgWords = modo === 'completo' ? 180 : 130;
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
- Cada página deve parecer completa: integre exemplos do texto-fonte quando existirem; não deixe páginas só com título.
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

  const fewShot = await getFewShotSuffixForScriboContent();
  const raw = await openRouterChatByTask('text_material', {
    system: `${PROMPT_RESUMO_ORGANIZADO}${fewShot}`,
    user: userContent,
    max_tokens: 4096,
  });
  if (!raw) throw new Error('Resposta vazia do modelo.');

  return parseJsonFromAI<ContentAgentResult>(raw);
}

/**
 * Extrai todo o texto principal de uma página (bloco_principal + content_blocks do tipo text).
 */
export function extractPageText(page: Record<string, unknown>): string {
  const parts: string[] = [];
  const bloco = String(page.bloco_principal ?? '').trim();
  if (bloco) parts.push(bloco);

  const blocks = Array.isArray(page.content_blocks) ? page.content_blocks : [];
  for (const b of blocks) {
    const block = b as Record<string, unknown>;
    if (block.type === 'text' && typeof block.content === 'string') {
      const t = block.content.trim();
      if (t && t !== bloco) parts.push(t);
    }
  }
  return parts.join('\n\n');
}

/**
 * Extrai elementos visuais (mermaid, chart) de uma página.
 */
export function extractVisualBlocks(page: Record<string, unknown>): Array<Record<string, unknown>> {
  const blocks = Array.isArray(page.content_blocks) ? page.content_blocks : [];
  return blocks.filter((b) => {
    const block = b as Record<string, unknown>;
    return block.type === 'mermaid' || block.type === 'chart';
  }) as Array<Record<string, unknown>>;
}

/**
 * Extrai metadados visuais de uma página (imagem, gráfico, fluxograma, tabela).
 */
export function extractVisualMeta(page: Record<string, unknown>): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (page.sugestao_imagem) meta.sugestao_imagem = page.sugestao_imagem;
  if (page.imagem_url) meta.imagem_url = page.imagem_url;
  if (page.sugestao_grafico) meta.sugestao_grafico = page.sugestao_grafico;
  if (page.sugestao_fluxograma) meta.sugestao_fluxograma = page.sugestao_fluxograma;
  if (page.sugestao_tabela) meta.sugestao_tabela = page.sugestao_tabela;
  return meta;
}

/**
 * Enriquece o conteúdo de uma página consultando a transcrição original.
 * NÃO reescreve — mantém o texto existente e ADICIONA informações
 * que o professor mencionou sobre o mesmo tópico mas que não foram incluídas.
 * Retorna o bloco_principal enriquecido + itens/destaques atualizados.
 */
export async function enrichPageFromTranscription(
  existingText: string,
  tituloBloco: string,
  transcricao: string,
  modo: ModoContent,
): Promise<{
  bloco_principal: string;
  itens: string[];
  destaques: string[];
  citacao: string;
}> {
  const transcricaoEnviada = transcricao.slice(0, 60000);
  const modeInstruction = MODE_INSTRUCTIONS[modo];

  const systemPrompt = `Você é um especialista em materiais didáticos. Sua tarefa é ENRIQUECER o conteúdo de uma página de material didático.

REGRAS FUNDAMENTAIS:
1. Use EXCLUSIVAMENTE o conteúdo da transcrição fornecida. NÃO adicione informações externas.
2. MANTENHA o texto existente como base — não descarte nem reescreva o que já existe.
3. ADICIONE informações que o professor falou sobre o tópico "${tituloBloco}" mas que não foram incluídas na versão atual.
4. Procure na transcrição: exemplos adicionais, explicações complementares, dicas práticas, contexto extra — tudo que o professor disse sobre este assunto específico.
5. O resultado deve ser um texto corrido (parágrafos), não listas.
6. ${modeInstruction}
7. IDIOMA: ${IDIOMA_RULE}
8. Se a transcrição não tiver mais conteúdo relevante sobre este tópico além do que já existe, retorne o texto existente sem alterações.

ESTRUTURA DO JSON DE RETORNO:
{
  "bloco_principal": "texto existente + novos parágrafos integrados de forma fluida",
  "itens": ["3-4 tópicos curtos e acionáveis extraídos do VTT sobre este tema"],
  "destaques": ["dica ou exercício explícito do professor, se houver"],
  "citacao": "trecho fiel e curto do VTT sobre este tópico (diferente do bloco_principal)"
}

Retorne APENAS JSON válido, sem texto antes ou depois, sem cercas de código.`;

  const userContent = `Transcrição completa da aula (consulte para encontrar mais conteúdo sobre o tópico):

${transcricaoEnviada}

---
Tópico da página: "${tituloBloco}"

Conteúdo ATUAL da página (mantenha e enriqueça):
${existingText}

---
Enriqueça o conteúdo desta página consultando a transcrição acima. Adicione informações que o professor mencionou sobre "${tituloBloco}" mas que não estão no texto atual. NÃO invente nada — use SOMENTE o que está na transcrição.`;

  const raw = await openRouterChatByTask('text_material', {
    system: systemPrompt,
    user: userContent,
    max_tokens: 4096,
  });
  if (!raw) {
    return {
      bloco_principal: existingText,
      itens: [],
      destaques: [],
      citacao: '',
    };
  }

  try {
    return parseJsonFromAI<{
      bloco_principal: string;
      itens: string[];
      destaques: string[];
      citacao: string;
    }>(raw);
  } catch {
    return {
      bloco_principal: existingText,
      itens: [],
      destaques: [],
      citacao: '',
    };
  }
}

/**
 * Aplica uma instrução pontual do usuário a uma página existente.
 * Usa a transcrição como única fonte de informação adicional.
 * Retorna a página modificada conforme a instrução.
 */
export async function applyPageInstruction(
  existingPage: Record<string, unknown>,
  instruction: string,
  transcricao: string | undefined,
  modo: ModoContent,
): Promise<Record<string, unknown>> {
  const tituloBloco = String(existingPage.titulo_bloco ?? '');
  const currentText = extractPageText(existingPage);
  const currentItens = Array.isArray(existingPage.itens) ? existingPage.itens : [];
  const currentDestaques = Array.isArray(existingPage.destaques) ? existingPage.destaques : [];
  const currentCitacao = String(existingPage.citacao ?? '');
  const transcricaoEnviada = transcricao ? transcricao.slice(0, TRANSCRIPTION_MAX_CHARS) : '';

  const systemPrompt = `Você é um especialista em materiais didáticos. O usuário quer fazer uma alteração pontual em uma página de material didático.

REGRAS:
1. Aplique EXATAMENTE a instrução do usuário sobre o conteúdo da página.
2. Use SOMENTE o conteúdo da transcrição fornecida como fonte adicional. NÃO invente informações externas.
3. Mantenha a estrutura da página (titulo_bloco, tipo, etc.) — altere apenas o que a instrução pede.
4. IDIOMA: ${IDIOMA_RULE}
5. Retorne APENAS JSON válido, sem texto antes ou depois, sem cercas de código.
6. Se a instrução pede algo que não pode ser feito com o material disponível, mantenha o conteúdo atual.

ESTRUTURA DO JSON DE RETORNO (página completa):
{
  "tipo": "conteudo",
  "titulo_bloco": "${tituloBloco}",
  "subtitulo": "...",
  "bloco_principal": "texto modificado conforme instrução...",
  "itens": ["..."],
  "destaques": ["..."],
  "citacao": "..."
}`;

  const userContent = `${transcricaoEnviada ? `Transcrição da aula (consulte se necessário):\n\n${transcricaoEnviada}\n\n---\n` : ''}Conteúdo ATUAL da página:
- Título: ${tituloBloco}
- Texto: ${currentText}
- Itens: ${JSON.stringify(currentItens)}
- Destaques: ${JSON.stringify(currentDestaques)}
- Citação: ${currentCitacao}

---
INSTRUÇÃO DO USUÁRIO: ${instruction}

Aplique a instrução acima ao conteúdo da página. Retorne o JSON completo da página modificada.`;

  const raw = await openRouterChatByTask('text_material', {
    system: systemPrompt,
    user: userContent,
    max_tokens: 4096,
  });
  if (!raw) throw new Error('Resposta vazia do modelo.');

  const result = parseJsonFromAI<Record<string, unknown>>(raw);

  // Merge: preservar campos de design e visuais do original
  return {
    ...existingPage,
    ...result,
    tipo: existingPage.tipo || 'conteudo',
    titulo_bloco: result.titulo_bloco || tituloBloco,
  };
}
