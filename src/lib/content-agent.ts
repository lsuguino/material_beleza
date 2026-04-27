import { TRANSCRIPTION_MAX_CHARS } from '@/lib/api-payload-limits';
import { openRouterChatByTask } from '@/lib/openrouter';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';
import { getSkillsSummaryForPrompt } from '@/lib/skills/load-skills';
import { getFewShotSuffixForScriboContent } from '@/lib/training-few-shot';
import { formatHintsForPrompt, type VisualHint } from '@/lib/visual-hints-scanner';
import { stripTravessao, stripTravessaoFromConteudo } from '@/lib/strip-travessao';

/** Regra de idioma compartilhada entre todos os prompts de geração. */
const IDIOMA_RULE = `TODO conteúdo DEVE estar em PORTUGUÊS BRASILEIRO. EXCEÇÃO: termos técnicos de marketing digital, negócios e produtos digitais que são usados em inglês no cotidiano brasileiro devem ser MANTIDOS em inglês, exatamente como o professor falou na transcrição. Exemplos: lead, copy, headline, landing page, VSL, CTA, upsell, downsell, funnel, follow-up, e-mail marketing, opt-in, webinar, masterclass, feedback, briefing, brainstorming, branding, storytelling, pitch, insight, mindset, networking, ROI, KPI, SEO, CPC, ROAS, LTV, CAC, churn, dropshipping, e-commerce, marketplace, infoproduto, Facebook Ads, Google Ads, pixel, remarketing, retargeting, lookalike, criativo, thumbnail, reels, dashboard, analytics, template, framework, script, hook, offer, closer, setter, onboarding, mockup, layout, UI, UX, MVP, SaaS, API, startup, upgrade, premium, freemium, launch, entre outros. Na dúvida, se o professor usou o termo em inglês na transcrição, mantenha em inglês.`;

const SYSTEM_PROMPT_BASE = `Você é um redator editorial especializado em material didático. Produz textos que respeitam a voz do professor, variam o ritmo, evitam clichês de IA e seguem uma estrutura pedagógica clara.

## IDENTIFICAÇÃO DO INPUT

Antes de qualquer coisa, classifique o texto recebido:

TRANSCRIÇÃO — fala oral: linguagem coloquial, repetições, frases incompletas, digressões, marcadores ("né", "então", "tipo", "certo?"), possíveis timestamps ou identificação de falantes, possíveis erros de transcrição automática.

TEXTO ELABORADO — estrutura de escrita: parágrafos formados, linguagem escrita, coesão entre ideias, ausência de marcadores orais.

Se misturar características dos dois, trate como TRANSCRIÇÃO.

Se TRANSCRIÇÃO: reescreva com profundidade. Elimine marcadores orais, repetições e digressões. Reorganize a sequência lógica se necessário. Preserve exemplos, analogias e frases de impacto do autor; reformule só o que estiver truncado pela natureza da fala.

Se TEXTO ELABORADO: não reescreva o que já funciona. Reorganize a estrutura se estiver fragmentada, lapide o confuso, aplique a formatação didática. Mantenha ao máximo a voz e as escolhas do autor.

## ANÁLISE ANTES DE ESCREVER

Identifique:
- Tema central, estrutura de raciocínio do professor e subtemas
- Sequência lógica mais eficaz — pode diferir da ordem da aula
- Nível e público implícito (vocabulário, referências, profundidade)
- Exemplos, casos e analogias — são ativos valiosos, preserve
- Frases com formulação precisa, impacto ou beleza de expressão

## ESTRUTURA POR PÁGINA

O material se divide em páginas. Cada assunto principal vira UMA página com seu titulo_bloco. O título é sempre a primeira coisa de cada página. Os títulos de todas as páginas formam o SUMÁRIO — escolha-os como itens de índice: claros, funcionais, com precisão e alguma tensão (nunca "Aula sobre X", "Introdução a Y", "Sobre Z").

Para CADA página de conteúdo:

**titulo_bloco** — título funcional. DEVE fazer sentido lido isoladamente, fora do contexto. Curto, direto, máx 8 palavras. Comunica o tema com precisão e alguma tensão ou curiosidade.

**subtitulo** — frase curta que contextualiza ou provoca (máx 12 palavras).

**bloco_principal** — prosa corrida didática. Siga a progressão **contexto → conceito → exemplo → implicação**. Em muitos casos, apresente o EXEMPLO antes de nomear o conceito — o cérebro reconhece padrão antes de rótulo. Um parágrafo, uma ideia central. Preserve exemplos e analogias do professor. 2-4 parágrafos, 90-170 palavras. Varie comprimento de frase: frase longa de desenvolvimento, frase curta de arremate.

**citacao** — trecho do professor com formulação precisa ou impacto. Integrada ao fluxo narrativo (quando possível já mencionada no bloco_principal com atribuição natural), extraída como campo separado para o layout destacá-la. Só inclua se a frase é marcante; se não, omita.

**itens** — 3-6 frases curtas e acionáveis QUANDO o professor explicitamente listou passos, checklist, "primeiro/depois/por fim", "faça…", "evite…". Não invente. Não copie parágrafos do bloco_principal — reformule telegraficamente.

**destaques** — SOMENTE quando o professor deu dica EXPLÍCITA ("minha dica é...", "uma coisa importante...") ou propôs exercício ("faça isso...", "teste..."). O primeiro vira "Dica do Autor", o segundo "Exercício Prático". Se não houver, use [].

**content_blocks** (type: text | mermaid | chart) — use mermaid para fluxogramas/organogramas quando a fala descrever processos, etapas ou hierarquias. Use chart quando citar dados numéricos. Textos internos em PT-BR ("Início", "Fim", "Etapa", nunca "Start", "End", "Step").

## ABERTURA E ENCERRAMENTO

Primeira página de conteúdo: situa o leitor. Por que o tema importa, que problema resolve, que questão abre. NÃO comece com definição. Comece pelo concreto, pelo contexto ou pela provocação.

Última página de conteúdo: avança, não repete. Pode ser consequência, pergunta aberta, aplicação prática, conexão com o próximo passo. NUNCA inicie com "Portanto", "Em resumo", "Como vimos".

## TOM E LINGUAGEM

- Registro adaptado ao público identificado
- Voz ativa. Verbos que fazem coisas acontecerem
- Varie o comprimento das frases
- Metáforas e analogias bem-vindas quando funcionais — evite clichês
- Personalidade consistente do início ao fim — não mude de registro

## O QUE NÃO FAZER

- **PROIBIDO TRAVESSÃO**: NUNCA use travessão (— em-dash U+2014 nem – en-dash U+2013) em NENHUMA parte do texto. Substitua sempre por vírgula, parênteses, ponto final ou dois-pontos. Travessão é o clichê mais óbvio de IA — qualquer ocorrência será removida automaticamente, então não escreva mesmo.
- Abrir seções/parágrafos com "É importante ressaltar que...", "Nesse contexto...", "Além disso..." como conectores automáticos
- Dar o mesmo tamanho a todas as seções (ideias mais densas merecem mais espaço)
- Encerrar com parágrafo que resume o que acabou de ser dito
- Adjetivos inflados: "extremamente relevante", "profundamente impactante", "absolutamente essencial"
- Transformar conteúdo narrativo em bullets (exceto quando o professor explicitamente listou)
- Incluir referências ao processo: "a partir da transcrição...", "o professor mencionou...", "conforme dito"

## REGRAS TÉCNICAS (INEGOCIÁVEIS)

1. Use EXCLUSIVAMENTE o conteúdo da transcrição. Não pesquise, não invente dados/exemplos/números.
2. Retorne APENAS JSON válido, sem texto antes/depois, sem cercas \`\`\`.
3. Idioma: ${IDIOMA_RULE}
4. E-mail de suporte (quando citado): suporte@readytogo.com.br
5. Área útil ≤ 80% por página. Se conteúdo exceder 170 palavras no bloco_principal, crie NOVA página (continuação automática). Nunca comprima.
6. PASSO A PASSO na transcrição (sequência de ações, "primeiro/depois/por fim"): DEVE gerar itens numerados (mín. 4) E sugestao_tabela de resumo.
7. Gráficos/organogramas: inclua pelo menos 1 (mermaid ou chart) quando a transcrição tiver processos, hierarquias ou dados numéricos.
8. Sem clonar texto: citacao, destaques e itens não podem ser idênticos a parágrafos do bloco_principal.

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
- Páginas de conteúdo: estrutura de apostila prática (parágrafos curtos + itens + passo a passo + citação + elementos visuais).
- Se houver “passo a passo”, a página DEVE trazer simultaneamente itens numerados + sugestao_tabela de resumo do processo.
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
    'MODO COMPLETO — material pronto para o leitor final, sem revisão intermediária. Desenvolva com profundidade: contexto, lógica, aplicação prática, implicação. 2-4 parágrafos por página (90-170 palavras). Preserve TODOS os exemplos e analogias do professor, reformule só o que estiver truncado pela fala oral. Cada seção com peso proporcional à densidade — não equilibre artificialmente. citação inline quando houver frase marcante. itens e destaques só com base explícita no VTT. Varie comprimento de frase: desenvolvimento longo, arremate curto. Voz ativa, registro adaptado ao público.',
  resumido:
    'MODO RESUMIDO — direto para o leitor final, sem revisão intermediária. Comece com frase que ANCORA o leitor no tema (NÃO "neste resumo vamos ver", NÃO "a aula abordou"). Prosa corrida, não bullets. Cada parágrafo: primeira frase entrega o assunto, o restante desenvolve. 1-3 parágrafos por página (70-130 palavras). Tamanho proporcional ao conteúdo — não tem medida fixa, tem DENSIDADE ADEQUADA. Algumas ideias merecem mais espaço. Citação inline quando houver frase precisa do professor. Encerre avançando (consequência, pergunta, aplicação), nunca repetindo. Voz ativa.',
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
  nomeCurso: string,
  hints: VisualHint[] = []
): Promise<ContentAgentResult> {
  const skills = getSkillsSummaryForPrompt();
  const fewShot = await getFewShotSuffixForScriboContent();
  const hintsBlock = formatHintsForPrompt(hints);
  const systemPrompt = `${SYSTEM_PROMPT_BASE} ${modo}.\n\n${skills}${fewShot}${hintsBlock}`;
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
      const minAvgWords = modo === 'completo' ? 105 : 80;
      if ((chars >= minCharsTarget && avgWords >= minAvgWords) || attempt === 2) {
        return stripTravessaoFromConteudo(
          parsed as unknown as Record<string, unknown>,
        ) as unknown as ContentAgentResult;
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

/**
 * Prompt para condensar texto JÁ ORGANIZADO (parágrafos formados, coesão, sem marcadores orais).
 * Não reescreve o que já funciona — lapida, condensa, reorganiza só o fragmentado.
 */
const PROMPT_RESUMO_ORGANIZADO = `Você é redator editorial de material didático. Recebe um texto JÁ ELABORADO (parágrafos formados, linguagem escrita, coesão). Não reescreva o que já funciona — lapide o confuso, reorganize só o fragmentado, condense preservando a voz do autor.

## ANÁLISE ANTES DE ESCREVER

Identifique: tema central, subtemas, nível/público implícito, frases com formulação precisa ou impacto (preserve como citacao).

## COMO ESCREVER

Estrutura
- Comece com frase que ancora o leitor no tema. NÃO use "neste resumo vamos ver", "a aula abordou", definição genérica ou frase grandiloquente.
- Desenvolva os pontos centrais em prosa corrida, agrupando ideias relacionadas em parágrafos coesos.
- Cada parágrafo tem uma ideia central. Primeira frase entrega o assunto; o restante desenvolve.
- Encerre com algo que avança: consequência, pergunta aberta, aplicação. NUNCA repita o que já foi dito.

Citações
- Frases do autor com formulação precisa ou impacto: integre ao fluxo entre aspas com atribuição natural. No JSON, extraia também como campo "citacao".

Tom
- Registro adaptado ao público identificado (técnico p/ especialista, acessível p/ iniciante, nunca condescendente).
- Voz ativa. Varie comprimento de frase: longa de desenvolvimento, curta de arremate.
- Evite muletas de IA: "é importante ressaltar", "nesse contexto", "além disso" como conectores automáticos. Se precisar de transição, construa com sentido real.

## O QUE NÃO FAZER
- Não transforme em lista de tópicos.
- Não abra com definição genérica ou frase grandiloquente.
- Não encerre repetindo.
- **PROIBIDO travessão (— ou –)** em qualquer lugar. Use vírgula, parênteses ou ponto final. Será removido automaticamente.
- Não equilibre artificialmente o peso das ideias: algumas merecem mais espaço.

## REGRAS TÉCNICAS
- Use EXCLUSIVAMENTE o conteúdo fornecido. Não invente dados.
- Idioma: ${IDIOMA_RULE}
- Tamanho: proporcional à densidade do conteúdo — não tem medida fixa.
- Retorne APENAS JSON válido, sem cercas de código.

ESTRUTURA JSON:
{
  "titulo": "...",
  "subtitulo_curso": "nome do curso",
  "paginas": [
    { "tipo": "capa", "titulo": "...", "subtitulo": "..." },
    {
      "tipo": "conteudo",
      "titulo_bloco": "título funcional da seção (faz sentido isolado)",
      "subtitulo": "frase curta complementar",
      "bloco_principal": "prosa corrida em parágrafos",
      "citacao": "frase marcante do autor (opcional)",
      "destaques": ["dica/exercício explícito (opcional)"],
      "itens": ["passos curtos quando houver passo a passo explícito"],
      "sugestao_tabela": { "titulo": "...", "colunas": [], "linhas": [] }
    }
  ]
}

Quando o trecho for passo a passo explícito, inclua itens numerados (4+) e sugestao_tabela de resumo.`;

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

  const parsed = parseJsonFromAI<ContentAgentResult>(raw);
  return stripTravessaoFromConteudo(
    parsed as unknown as Record<string, unknown>,
  ) as unknown as ContentAgentResult;
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
  sugestao_tabela?: SugestaoTabela;
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
5.1 EXCEÇÃO OBRIGATÓRIA: se o tópico tiver formato de passo a passo, mantenha parágrafos curtos e adicione "itens" em sequência lógica + "sugestao_tabela" de resumo das etapas.
6. ${modeInstruction}
7. IDIOMA: ${IDIOMA_RULE}
8. Se a transcrição não tiver mais conteúdo relevante sobre este tópico além do que já existe, retorne o texto existente sem alterações.

ESTRUTURA DO JSON DE RETORNO:
{
  "bloco_principal": "texto existente + novos parágrafos integrados de forma fluida",
  "itens": ["4-6 tópicos curtos e acionáveis extraídos do VTT sobre este tema (quando houver passo a passo, em ordem de execução)"],
  "destaques": ["dica ou exercício explícito do professor, se houver"],
  "citacao": "trecho fiel e curto do VTT sobre este tópico (diferente do bloco_principal)",
  "sugestao_tabela": { "titulo": "...", "colunas": ["Etapa", "Ação", "Resultado esperado"], "linhas": [["1", "...", "..."]] }
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
      sugestao_tabela: undefined,
    };
  }

  try {
    return parseJsonFromAI<{
      bloco_principal: string;
      itens: string[];
      destaques: string[];
      citacao: string;
      sugestao_tabela?: SugestaoTabela;
    }>(raw);
  } catch {
    return {
      bloco_principal: existingText,
      itens: [],
      destaques: [],
      citacao: '',
      sugestao_tabela: undefined,
    };
  }
}

/**
 * Campos de texto que o usuário pode editar via `applyPageInstruction`.
 * Outros campos (tipo, layout_tipo, capitulo_seq, continuacao, content_blocks,
 * sugestao_grafico/fluxograma/tabela) não são alteráveis por instrução.
 */
const ALLOWED_EDIT_FIELDS = [
  'titulo_bloco',
  'subtitulo',
  'bloco_principal',
  'citacao',
  'itens',
  'destaques',
  'sugestao_imagem',
] as const;

type AllowedEditField = typeof ALLOWED_EDIT_FIELDS[number];

const STRING_EDIT_FIELDS = new Set<string>([
  'titulo_bloco',
  'subtitulo',
  'bloco_principal',
  'citacao',
  'sugestao_imagem',
]);
const ARRAY_EDIT_FIELDS = new Set<string>(['itens', 'destaques']);

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/**
 * Valida o objeto `changes` devolvido pela LLM: descarta campos fora da allowlist,
 * rejeita tipos errados, limita tamanho razoável. Nunca joga exceção — só filtra.
 */
function validateEditChanges(raw: unknown): Partial<Record<AllowedEditField, unknown>> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const clean: Partial<Record<AllowedEditField, unknown>> = {};

  for (const field of ALLOWED_EDIT_FIELDS) {
    if (!(field in obj)) continue;
    const v = obj[field];

    if (STRING_EDIT_FIELDS.has(field)) {
      if (typeof v === 'string' && v.length <= 5000) {
        clean[field] = v;
      }
      continue;
    }

    if (ARRAY_EDIT_FIELDS.has(field)) {
      if (isStringArray(v) && v.length <= 20 && v.every((s) => s.length <= 500)) {
        clean[field] = v;
      }
    }
  }

  return clean;
}

/**
 * Reorganiza uma página: ENRIQUECE o conteúdo (mais texto, novos itens, citação),
 * sugere VISUAL estruturado (mermaid/chart/tabela), sugere IMAGEM se útil,
 * e indica layout adequado. Nunca remove conteúdo — só adiciona/sugere.
 *
 * Usado pelo botão "Reorganizar" no editor: transforma uma página magra ou genérica
 * em uma página rica com elementos visuais e densidade pedagógica.
 */
export interface ReorganizePageResult {
  bloco_principal: string;
  itens: string[];
  destaques: string[];
  citacao: string;
  sugestao_tabela?: SugestaoTabela;
  /** Sugestão de imagem (descrição em PT-BR pra geração). Vazio se não recomenda. */
  sugestao_imagem?: string;
  /** Bloco visual estruturado: mermaid (fluxograma/organograma) ou chart (gráfico). */
  content_block_visual?: { type: 'mermaid' | 'chart'; content: string };
  /** Layout sugerido (string do catálogo). Vazio = manter o atual. */
  layout_tipo_sugerido?: string;
}

const LAYOUTS_DISPONIVEIS = [
  'A4_2_conteudo_misto',
  'A4_2_texto_corrido',
  'A4_2_texto_citacao',
  'A4_2_texto_sidebar',
  'A4_3_sidebar_steps',
  'A4_3_processo_etapas',
  'A4_4_magazine',
  'A4_4_imagem_destaque',
  'A4_4_pros_contras',
  'A4_4_comparativo',
  'A4_5_tabela',
  'A4_2_imagem_overlay',
  'A4_7_sidebar_conteudo',
] as const;

export async function reorganizePageRich(
  existingPage: Record<string, unknown>,
  transcricao: string,
  modo: ModoContent,
): Promise<ReorganizePageResult> {
  const tituloBloco = String(existingPage.titulo_bloco ?? existingPage.titulo ?? '').trim();
  const existingText = extractPageText(existingPage);
  const existingItens = Array.isArray(existingPage.itens)
    ? (existingPage.itens as unknown[]).map(String).filter(Boolean)
    : [];
  const existingDestaques = Array.isArray(existingPage.destaques)
    ? (existingPage.destaques as unknown[]).map(String).filter(Boolean)
    : [];
  const existingCitacao = String(existingPage.citacao ?? '').trim();
  const layoutAtual = String(existingPage.layout_tipo ?? '').trim();
  const transcricaoEnviada = transcricao.slice(0, 60000);
  const modeInstruction = MODE_INSTRUCTIONS[modo];

  const systemPrompt = `Você reorganiza uma página de material didático: ENRIQUECE o conteúdo, propõe visual estruturado quando o tema pedir, e sugere layout adequado. Princípio central: NUNCA REMOVER conteúdo — só adicionar e melhorar.

REGRAS:
1. Use EXCLUSIVAMENTE o conteúdo da transcrição fornecida. Não invente.
2. PRESERVE TUDO do conteúdo atual. ADICIONE mais texto, mais itens, mais nuance — extraídos da transcrição.
3. O bloco_principal final deve ser MAIS LONGO que o atual (mais profundidade, mais exemplos), nunca mais curto.
4. Sugira UM visual estruturado (mermaid OU chart) se o tema da página naturalmente pede:
   - mermaid: fluxograma/organograma — quando há processo, etapas, hierarquia
   - chart: gráfico — quando há dados numéricos, comparações de quantidades
   - Se nenhum cabe, omita o campo.
5. Sugira sugestao_tabela se o conteúdo tem natureza tabular (etapas com colunas, comparação multi-coluna).
6. Sugira sugestao_imagem (descrição em PT-BR) APENAS se uma foto/ilustração realmente agrega — pessoas, lugares, objetos concretos. Para conceitos abstratos, prefira visual estruturado.
7. Sugira layout_tipo_sugerido se houver outro layout MAIS adequado pro novo conteúdo enriquecido. Layouts disponíveis: ${LAYOUTS_DISPONIVEIS.join(', ')}. Se o atual (${layoutAtual || 'nenhum'}) ainda é o melhor, omita o campo.
8. ${modeInstruction}
9. IDIOMA: ${IDIOMA_RULE}
10. **PROIBIDO travessão (— ou –)** — use vírgula, parênteses ou ponto.
11. Retorne APENAS JSON válido, sem cercas de código.

ESTRUTURA DE RETORNO:
{
  "bloco_principal": "texto enriquecido (preservou existente + adicionou mais)",
  "itens": ["passos/takeaways acionáveis quando aplicável"],
  "destaques": ["dica/exercício explícito do professor (se houver)"],
  "citacao": "trecho fiel marcante da transcrição (diferente do bloco_principal)",
  "sugestao_tabela": { "titulo": "...", "colunas": [...], "linhas": [[...]] },
  "sugestao_imagem": "descrição da imagem em PT-BR (omita se não agrega)",
  "content_block_visual": { "type": "mermaid", "content": "flowchart LR\\n  A[Início]-->B[Fim]" },
  "layout_tipo_sugerido": "A4_X_xxx (omita se mantém o atual)"
}`;

  const userContent = `Transcrição da aula (fonte exclusiva):

${transcricaoEnviada}

---
Tópico da página: "${tituloBloco || '(sem título)'}"
Layout atual: ${layoutAtual || '(nenhum)'}

Conteúdo ATUAL (preserve e enriqueça):
- bloco_principal: ${JSON.stringify(existingText)}
- itens: ${JSON.stringify(existingItens)}
- destaques: ${JSON.stringify(existingDestaques)}
- citacao: ${JSON.stringify(existingCitacao)}

Reorganize esta página: enriqueça o texto, sugira visual estruturado se cabe, sugira imagem se agrega, sugira layout se houver melhor. Use SÓ a transcrição.`;

  let raw: string;
  try {
    raw = await openRouterChatByTask('text_material', {
      system: systemPrompt,
      user: userContent,
      max_tokens: 4096,
    });
  } catch (err) {
    console.error('[reorganizePageRich] erro OpenRouter:', err);
    return {
      bloco_principal: existingText,
      itens: existingItens,
      destaques: existingDestaques,
      citacao: existingCitacao,
    };
  }
  if (!raw) {
    return {
      bloco_principal: existingText,
      itens: existingItens,
      destaques: existingDestaques,
      citacao: existingCitacao,
    };
  }

  try {
    const parsed = parseJsonFromAI<ReorganizePageResult>(raw);
    // Garantia: nunca encolhe abaixo do que já tinha
    const newText = String(parsed?.bloco_principal ?? '').trim();
    const finalBloco = newText.length >= existingText.length ? newText : existingText;
    return {
      bloco_principal: stripTravessao(finalBloco),
      itens: Array.isArray(parsed?.itens) && parsed.itens.length >= existingItens.length
        ? parsed.itens.map((s) => stripTravessao(String(s)))
        : existingItens.map(stripTravessao),
      destaques: Array.isArray(parsed?.destaques) && parsed.destaques.length >= existingDestaques.length
        ? parsed.destaques.map((s) => stripTravessao(String(s)))
        : existingDestaques.map(stripTravessao),
      citacao: stripTravessao(String(parsed?.citacao ?? existingCitacao)),
      sugestao_tabela: parsed?.sugestao_tabela,
      sugestao_imagem: parsed?.sugestao_imagem
        ? stripTravessao(String(parsed.sugestao_imagem))
        : undefined,
      content_block_visual: parsed?.content_block_visual,
      layout_tipo_sugerido: parsed?.layout_tipo_sugerido,
    };
  } catch (err) {
    console.error('[reorganizePageRich] JSON inválido:', err);
    return {
      bloco_principal: existingText,
      itens: existingItens,
      destaques: existingDestaques,
      citacao: existingCitacao,
    };
  }
}

/**
 * Aplica uma instrução pontual do usuário a uma página existente,
 * fazendo edit CIRÚRGICO por campo: a LLM devolve só o DIFF, o código merge.
 *
 * Proteções:
 * - Campos fora da allowlist são ignorados (não é possível quebrar estrutura/layout via edit)
 * - Tipos errados são descartados
 * - Se nada é alterado, retorna a página original intacta
 * - Erro de parse / resposta vazia → retorna original sem quebrar a request
 */
export async function applyPageInstruction(
  existingPage: Record<string, unknown>,
  instruction: string,
  transcricao: string | undefined,
  modo: ModoContent,
): Promise<Record<string, unknown>> {
  const tituloBloco = String(existingPage.titulo_bloco ?? '');
  const currentSubtitulo = String(existingPage.subtitulo ?? '');
  const currentBloco = String(existingPage.bloco_principal ?? '');
  const currentItens = Array.isArray(existingPage.itens) ? existingPage.itens : [];
  const currentDestaques = Array.isArray(existingPage.destaques) ? existingPage.destaques : [];
  const currentCitacao = String(existingPage.citacao ?? '');
  const currentSugestaoImagem = String(existingPage.sugestao_imagem ?? '');
  const transcricaoEnviada = transcricao ? transcricao.slice(0, TRANSCRIPTION_MAX_CHARS) : '';

  const modeInstruction = MODE_INSTRUCTIONS[modo];

  const systemPrompt = `Você edita UMA página de material didático aplicando EXATAMENTE a instrução do usuário. Princípio central: mudar SÓ o que a instrução pede — nada mais.

REGRAS:
1. Retorne APENAS os campos que mudaram. Campos não alterados NÃO aparecem na resposta.
2. Campos permitidos: titulo_bloco, subtitulo, bloco_principal, citacao, itens, destaques, sugestao_imagem. Ignore outros.
3. Use SOMENTE o conteúdo da transcrição como fonte adicional. Não invente.
4. Idioma: ${IDIOMA_RULE}
5. Se a instrução não pode ser atendida com o material disponível, retorne "changes": {}.
6. ${modeInstruction}

QUALIDADE (quando reescrever texto):
- Voz ativa, registro coerente com a página original.
- Varie comprimento de frase.
- NÃO use "é importante ressaltar", "nesse contexto", "além disso" como conectores automáticos.
- NÃO use adjetivos inflados. NÃO transforme narrativa em bullets.

FORMATO DE RETORNO (JSON puro, sem cercas):
{
  "changes": {
    // apenas campos alterados, ex:
    // "bloco_principal": "novo texto…",
    // "itens": ["passo 1", "passo 2"]
  }
}`;

  const userContent = `${transcricaoEnviada ? `Transcrição da aula (referência se necessário):\n\n${transcricaoEnviada}\n\n---\n\n` : ''}Página ATUAL:
- titulo_bloco: ${JSON.stringify(tituloBloco)}
- subtitulo: ${JSON.stringify(currentSubtitulo)}
- bloco_principal: ${JSON.stringify(currentBloco)}
- citacao: ${JSON.stringify(currentCitacao)}
- itens: ${JSON.stringify(currentItens)}
- destaques: ${JSON.stringify(currentDestaques)}
- sugestao_imagem: ${JSON.stringify(currentSugestaoImagem)}

---
INSTRUÇÃO DO USUÁRIO: ${instruction}

Retorne JSON com apenas os campos alterados dentro de "changes".`;

  let raw: string;
  try {
    raw = await openRouterChatByTask('text_material', {
      system: systemPrompt,
      user: userContent,
      max_tokens: 4096,
    });
  } catch (err) {
    console.error('[applyPageInstruction] Erro no OpenRouter:', err);
    return existingPage;
  }
  if (!raw) return existingPage;

  let parsed: { changes?: unknown };
  try {
    parsed = parseJsonFromAI<{ changes?: unknown }>(raw);
  } catch (err) {
    console.error('[applyPageInstruction] JSON inválido:', err);
    return existingPage;
  }

  const validChanges = validateEditChanges(parsed?.changes);

  if (Object.keys(validChanges).length === 0) {
    console.log('[applyPageInstruction] Nenhuma alteração válida — mantendo página original');
    return existingPage;
  }

  console.log(
    `[applyPageInstruction] ${Object.keys(validChanges).length} campo(s) alterados:`,
    Object.keys(validChanges).join(', '),
  );

  // Aplica strip de travessão nos campos textuais alterados antes do merge
  const cleanedChanges: Partial<Record<AllowedEditField, unknown>> = {};
  for (const [k, v] of Object.entries(validChanges)) {
    if (typeof v === 'string') {
      cleanedChanges[k as AllowedEditField] = stripTravessao(v);
    } else if (Array.isArray(v)) {
      cleanedChanges[k as AllowedEditField] = v.map((s) =>
        typeof s === 'string' ? stripTravessao(s) : s,
      );
    } else {
      cleanedChanges[k as AllowedEditField] = v;
    }
  }

  return {
    ...existingPage,
    ...cleanedChanges,
  };
}
