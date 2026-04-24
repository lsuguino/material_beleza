import { NextRequest, NextResponse } from 'next/server';
import type { MaterialBlock, TeachingMaterial } from '@/types/material';
import type { CourseId, GenerationMode } from '@/lib/courseThemes';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai'; 
import { ensureOpenRouterKey } from '@/lib/ensure-env';
import { generateMaterialImage } from '@/lib/gemini-nano-banana-images'; 
import {
  openRouterChatByTask,
  openRouterGenerateImage,
  verifyOpenRouterApiKeyForCompletions,
} from '@/lib/openrouter';
import { getFewShotSuffixForTeachingMaterial } from '@/lib/training-few-shot'; 

// Tempo máximo da rota (segundos). Aumentado para transcrições longas (ex.: Vercel Pro permite até 300).
export const maxDuration = 300;

const VTSD_COVER_IMAGE = '/capas/venda-todo-santo-dia/capa.svg';
const VTSD_INTRO_IMAGE = '/images/Introducao-padrao-vtsd.png';
const VTSD_SUMMARY_IMAGE = '/images/sumario-vtsd.png';

function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Aplica imagens de referência locais para o curso "Venda Todo Santo Dia" (courseId: geral).
 * Essas referências têm prioridade; o gerador por IA fica como fallback.
 */
function applyVtsdReferenceImages(material: TeachingMaterial, courseId?: CourseId): void {
  if (courseId !== 'geral') return;

  if (!material.coverImageUrl) {
    material.coverImageUrl = VTSD_COVER_IMAGE;
  }

  if (!material.sections) return;
  for (const section of material.sections) {
    const sectionTitle = normalizeText(section.title || '');
    for (const block of section.blocks || []) {
      if (block.type !== 'image_placeholder' || block.imageUrl) continue;

      const rawContext = `${sectionTitle} ${block.content || ''} ${block.caption || ''} ${block.imagePrompt || ''}`;
      const context = normalizeText(rawContext);

      if (context.includes('sumario')) {
        block.imageUrl = VTSD_SUMMARY_IMAGE;
        continue;
      }
      if (context.includes('introducao') || context.includes('apresentacao') || context.includes('boas vindas')) {
        block.imageUrl = VTSD_INTRO_IMAGE;
      }
    }
  }
}

function materialTextChars(material: Omit<TeachingMaterial, 'createdAt'>): number {
  let total = 0;
  total += material.title?.length ?? 0;
  total += material.subtitle?.length ?? 0;
  total += material.summary?.length ?? 0;
  for (const section of material.sections || []) {
    total += section.title?.length ?? 0;
    for (const block of section.blocks || []) {
      total += block.content?.length ?? 0;
      total += block.caption?.length ?? 0;
      total += block.source?.length ?? 0;
      total += block.center?.length ?? 0;
      total += block.diagramTitle?.length ?? 0;
      for (const item of block.items || []) total += item.length;
      for (const step of block.steps || []) total += step.length;
      for (const label of block.chartLabels || []) total += label.length;
    }
  }
  return total;
}

type PedagogicalImageContext = {
  lessonTitle: string;
  lessonSummary?: string;
  sectionTitle: string;
  blockDescription: string;
  caption?: string;
  draftPrompt: string;
};

/** Refina o prompt de imagem com o contexto da aula (título, resumo, seção) para a ilustração apoiar o aprendizado. */
async function refinePedagogicalImagePrompt(ctx: PedagogicalImageContext): Promise<string> {
  const bundle = [
    `Lesson title: ${ctx.lessonTitle}`,
    ctx.lessonSummary ? `Executive summary (for context only): ${ctx.lessonSummary.slice(0, 900)}` : '',
    `Section heading: ${ctx.sectionTitle}`,
    `What this figure must show for the student (from lesson, PT): ${ctx.blockDescription}`,
    ctx.caption ? `Figure caption: ${ctx.caption}` : '',
    `Draft image prompt (EN): ${ctx.draftPrompt}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  try {
    const text = await openRouterChatByTask('text_material', {
      system: `You are an expert at English prompts for AI image generation used INSIDE printed study handouts (A4). Your job is to merge the lesson context with the draft prompt so the picture clearly supports what the student is learning in that section.

Rules:
- Output ONLY the final image prompt in English (2-4 short sentences). No quotes, labels, or preamble.
- The scene must be concrete and didactic: help the reader visualize a key idea or example from the context—not a generic stock scene.
- Style: clean professional educational illustration, readable in print, soft lighting, no long paragraphs of text in the image; short labels only if essential.
- Do not invent facts, numbers, or examples that are not implied by the context provided.`,
      user: bundle.slice(0, 4000),
      max_tokens: 320,
    });
    const t = text.trim();
    return t.length > 0 ? t : ctx.draftPrompt;
  } catch (e) {
    console.error('refinePedagogicalImagePrompt error:', e);
    return ctx.draftPrompt;
  }
}

/** Gera imagem via Hugging Face FLUX e retorna data URL (base64). */
async function generateImageWithHuggingFace(prompt: string): Promise<string | null> {
  const token = process.env.HUGGINGFACE_HUB_TOKEN || process.env.HF_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ inputs: prompt.slice(0, 1000) }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Hugging Face image error:', res.status, err);
      return null;
    }
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.error('generateImageWithHuggingFace error:', e);
    return null;
  }
}

/** Gera imagem via OpenAI DALL-E 2 e retorna data URL (base64). Fallback se HF não estiver configurado. */
async function generateImageWithOpenAI(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-2',
        prompt: prompt.slice(0, 1000),
        n: 1,
        size: '1024x1024',
        response_format: 'url',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('OpenAI images error:', err);
      return null;
    }
    const data = (await res.json()) as { data?: { url?: string }[] };
    const url = data.data?.[0]?.url;
    if (!url) return null;
    const imgRes = await fetch(url);
    if (!imgRes.ok) return null;
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = imgRes.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.error('generateImageWithOpenAI error:', e);
    return null;
  }
}

/**
 * Gera a imagem didática: ordem — Gemini direto (Nano Banana), OpenRouter fallback, FLUX, DALL-E 2.
 * Gemini direto é priorizado por ser mais rápido e sem overhead de proxy.
 */
async function generateImageDataUrl(prompt: string): Promise<string | null> {
  try {
    const fromGemini = await generateMaterialImage(prompt);
    if (fromGemini) return fromGemini;
  } catch (e) {
    console.error('[generate-material] Gemini API direta (Nano Banana) image error:', e);
  }
  try {
    const fromOpenRouter = await openRouterGenerateImage(prompt);
    if (fromOpenRouter) return fromOpenRouter;
  } catch (e) {
    console.error('[generate-material] OpenRouter (Nano Banana) image error:', e);
  }
  try {
    const fromHF = await generateImageWithHuggingFace(prompt);
    if (fromHF) return fromHF;
  } catch (e) {
    console.error('[generate-material] Hugging Face image error:', e);
  }
  try {
    return await generateImageWithOpenAI(prompt);
  } catch (e) {
    console.error('[generate-material] OpenAI image error:', e);
    return null;
  }
}

/** Limite de imagens geradas por API (OpenRouter/Gemini direto/HF/OpenAI) por material. */
const MAX_API_IMAGES_PER_MATERIAL = 2;

type ApiImageBudget = { remaining: number };

/** Refina o prompt com LLM e preenche imageUrl nos image_placeholder até esgotar o orçamento. */
async function fillImagePlaceholders(material: TeachingMaterial, budget: ApiImageBudget): Promise<void> {
  if (!material.sections || budget.remaining <= 0) return;
  for (const section of material.sections) {
    if (!section.blocks) continue;
    for (const block of section.blocks) {
      if (budget.remaining <= 0) return;
      if (block.type !== 'image_placeholder' || block.imageUrl) continue;
      const draft =
        block.imagePrompt?.trim() ||
        (block.content && block.content.trim().length >= 8 ? block.content.trim() : '');
      if (!draft) continue;
      const refinedPrompt = await refinePedagogicalImagePrompt({
        lessonTitle: material.title || 'Aula',
        lessonSummary: material.summary,
        sectionTitle: section.title || '',
        blockDescription: (block.content || '').trim() || draft,
        caption: block.caption,
        draftPrompt: draft,
      });
      const dataUrl = await generateImageDataUrl(refinedPrompt);
      if (dataUrl) {
        block.imageUrl = dataUrl;
        budget.remaining -= 1;
      }
    }
  }
}

function countImagePlaceholders(material: TeachingMaterial): number {
  let n = 0;
  for (const section of material.sections || []) {
    for (const block of section.blocks || []) {
      if (block.type === 'image_placeholder') n += 1;
    }
  }
  return n;
}

/**
 * Garante exatamente um bloco no corpo da apostila para a ilustração didática (quando o modelo não enviou).
 * Só usa trechos da transcrição — o texto auxiliar chama o modelo para redigir content/imagePrompt/caption.
 */
async function ensurePedagogicalImagePlaceholder(
  material: TeachingMaterial,
  transcriptExcerpt: string
): Promise<void> {
  if (countImagePlaceholders(material) > 0) return;
  const section = material.sections?.[0];
  if (!section?.blocks?.length) return;
  const excerpt = transcriptExcerpt.slice(0, 8000);
  if (!excerpt.trim()) return;
  try {
    const raw = await openRouterChatByTask('text_material', {
      system: `Você prepara UMA ilustração para o corpo de uma apostila (não é capa). Responda APENAS com JSON válido, sem markdown, no formato:
{"content":"string curta em PT — o que a figura mostra para o aluno","imagePrompt":"prompt detalhado em inglês para gerador de imagens, cena concreta e didática","caption":"string — legenda tipo Fig. 1 — … em PT"}

Regras:
- Use SOMENTE ideias que apareçam na transcrição; não invente conceitos ou dados.
- A figura deve ajudar a **fixar** um ponto central ou exemplo visual citado na aula.
- imagePrompt: inglês, 2-4 frases, estilo ilustração educacional limpa para apostila impressa.`,
      user: `Transcrição (trecho):\n\n${excerpt}`,
      max_tokens: 500,
    });
    const proposal = parseJsonFromAI<{ content?: string; imagePrompt?: string; caption?: string }>(raw);
    const imagePrompt = proposal.imagePrompt?.trim();
    if (!imagePrompt) return;
    const block: MaterialBlock = {
      type: 'image_placeholder',
      content: proposal.content?.trim() || 'Ilustração da aula',
      imagePrompt,
      caption: proposal.caption?.trim() || 'Fig. 1 — Ilustração',
      imageLayout: 'full',
    };
    const firstPara = section.blocks.findIndex((b) => b.type === 'paragraph');
    const insertAt = firstPara >= 0 ? firstPara + 1 : 0;
    section.blocks.splice(insertAt, 0, block);
  } catch (e) {
    console.error('ensurePedagogicalImagePlaceholder error:', e);
  }
}

/** Gera imagem da capa temática (ex.: tráfego pago = workspace, ads, gráficos). Consome o orçamento de API se gerar. */
async function generateCoverImage(material: TeachingMaterial, budget: ApiImageBudget): Promise<void> {
  if (material.coverImageUrl || budget.remaining <= 0) return;
  const theme = [material.title, material.subtitle, material.summary].filter(Boolean).join('. ').slice(0, 500);
  if (!theme.trim()) return;
  try {
    const text = await openRouterChatByTask('text_material', {
      system: `You write a single, detailed prompt in English for an AI image generator. The image will be the COVER of a study handout (apostila).

Rules:
- The image must be THEMATIC and CONCRETE: it should show a real scene that represents the subject, not an abstract symbol (no generic book or lightbulb).
- For digital marketing, paid traffic, ads, Meta/Facebook, pixel, campaigns: describe a professional workspace — e.g. hands on laptop and smartphone, holographic or floating UI elements (charts, "Ads" panel, metrics, dashboards), modern office, dynamic and inviting. Think "digital marketer at work".
- For other topics: suggest a concrete scene that a student would associate with that subject (tools, environment, action).
- Style: professional, modern, clean, suitable for education. Soft lighting. No long paragraphs of text in the image; icons, numbers and short labels (e.g. "Ads", "114K") are OK.
- Output ONLY the prompt, 1-3 sentences, no quotes or explanation.`,
      user: `Theme of the study material:\n${theme}\n\nWrite a detailed image prompt for the cover that depicts a concrete, thematic scene (e.g. for "tráfego pago": professional workspace with laptop, smartphone, ads dashboard, charts and metrics, holographic UI, modern).`,
      max_tokens: 220,
    });
    if (!text) return;
    // Usar prompt temático direto (sem refino) para manter cena concreta (ex.: tráfego pago = workspace, ads, gráficos)
    const dataUrl = await generateImageDataUrl(text);
    if (dataUrl) {
      material.coverImageUrl = dataUrl;
      budget.remaining -= 1;
    }
  } catch (e) {
    console.error('generateCoverImage error:', e);
  }
}

const materialSchema = `
Responde APENAS com um JSON válido (sem markdown, sem \`\`\`) no formato:
{
  "title": "string",
  "subtitle": "string opcional",
  "summary": "string - resumo executivo em 4-6 frases",
  "sections": [
    {
      "title": "string",
      "blocks": [
        { "type": "heading", "content": "string" },
        { "type": "paragraph", "content": "string" },
        { "type": "key_point", "content": "string" },
        { "type": "list", "content": "", "items": ["item1", "item2"] },
        { "type": "quote", "content": "string" },
        { "type": "example", "content": "texto do exemplo", "source": "opcional" },
        { "type": "mind_map", "center": "título central", "items": ["ramo 1", "ramo 2", ...], "content": "opcional" },
        { "type": "image_placeholder", "content": "Descrição breve", "imagePrompt": "prompt em inglês para ilustração", "caption": "Fig 1.0 — Legenda editorial", "imageLayout": "full" ou "side" ou "grid" },
        { "type": "flowchart", "diagramTitle": "opcional", "steps": ["só passos MENCIONADOS na aula, na ordem"] },
        { "type": "chart", "diagramTitle": "Título", "chartType": "bar"|"line"|"pie", "chartLabels": ["só rótulos da aula"], "chartValues": [só números citados na transcrição], "content": "opcional" }
      ]
    }
  ]
}
Tipos: heading, paragraph, key_point, list, quote, example, mind_map, image_placeholder (no máximo um no documento inteiro), flowchart, chart.
`;

const mindmapSchema = `
Responde APENAS com um JSON válido (sem markdown, sem \`\`\`) no formato:
{
  "title": "string - título do conteúdo da aula",
  "subtitle": "string opcional",
  "summary": "string - 2 a 3 frases resumindo o tema",
  "sections": [
    {
      "title": "Mapa mental",
      "blocks": [
        {
          "type": "mind_map",
          "center": "string - conceito central da aula (2 a 5 palavras)",
          "items": ["ramo 1", "ramo 2", "ramo 3", ...],
          "content": "string opcional - breve explicação"
        }
      ]
    }
  ]
}
Extraia da transcrição os 6 a 12 conceitos/ramos mais importantes. "items" devem ser frases curtas (2 a 6 palavras cada). Nada inventado — só o que foi dito na aula.
`;

export async function POST(request: NextRequest) {
  const apiKey = await ensureOpenRouterKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY não configurada. Adicione em .env.local' },
      { status: 503 }
    );
  }
  if (process.env.OPENROUTER_SKIP_KEY_VERIFY !== '1') {
    const verified = await verifyOpenRouterApiKeyForCompletions(apiKey);
    if (!verified.ok) {
      return NextResponse.json({ error: verified.message }, { status: 401 });
    }
  }
  process.env.OPENROUTER_API_KEY = apiKey;
  try {
    const body = await request.json();
    const { transcript, mode = 'full', courseId } = body as {
      transcript?: string;
      mode?: GenerationMode;
      courseId?: CourseId;
    };
    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Transcrição não enviada.' }, { status: 400 });
    }

    const isMindmap = (mode as string) === 'mindmap';
    const isSummary = mode === 'summary';

    const systemPromptFull = `Você é um expert em didática e design instrucional. Sua tarefa é transformar a transcrição de uma aula (arquivo .vtt) em uma APOSTILA DE ESTUDOS COMPLETA para alunos.

REGRA CRÍTICA — USE SOMENTE O VTT:
- Todo o conteúdo deve vir EXCLUSIVAMENTE da transcrição do arquivo .vtt que você recebe.
- NÃO faça pesquisa externa. NÃO invente dados, estatísticas, exemplos ou conceitos que não estejam no texto da transcrição.
- Se algo não estiver no VTT, não inclua no material.

OBJETIVO DA APOSTILA:
- O aluno deve conseguir aprender, aplicar e revisar apenas com este material, sem precisar reassistir à aula.
- O texto deve ser didático e organizado, porém com PROFUNDIDADE: explique conceitos, contexto, lógica e implicações práticas.
- Evite excesso de síntese. Prefira conteúdo mais desenvolvido a frases curtas e superficiais.
- Inclua SEMPRE os exemplos citados pelo professor em aula: casos práticos, exercícios comentados, ilustrações e situações que ele mencionou. Esses exemplos são fundamentais para o estudo.

Regras obrigatórias:
1. CONTEÚDO: Reescreva de forma didática e abrangente — conceitos claros, definições completas, passos, justificativas e conclusões. O aluno lendo a apostila deve conseguir entender e aplicar o que foi ensinado sem depender do vídeo.
2. EXPLICAÇÃO vs EXEMPLOS: Conceitos, definições e método devem ir em blocks "paragraph" (texto corrido). **Blocks "list" apenas para exemplos concretos citados na aula** (caso, pergunta modelo, diálogo) — um item por exemplo. Opcionalmente um "paragraph" curto antes contextualiza. Um único "example" só se houver um exemplo isolado.
2.1 PROIBIDO usar "list" para resumir teoria ou conceitos em tópicos. PROIBIDO inventar exemplos.
2.2 Não omita exemplos relevantes do VTT.
3. ESTRUTURA: Seções com títulos. "paragraph" desenvolvido para teorias. "key_point" só para ideia central pontual. **Não transforme o material em bullet points**, exceto listas de exemplos conforme item 2.
3.1 PROPORÇÃO: no mínimo 85% dos blocks de texto da seção em "paragraph"; "list" restrito a exemplos citados (ou enumeração explícita que o professor leu como lista de casos).
3.2 Não gere seção composta apenas por tópicos. Cada seção deve ter explicação em parágrafo desenvolvido antes de qualquer lista.
4. MAPA MENTAL: Em seções que forem um "resumo da estratégia completa", "visão geral", "síntese" ou equivalente, inclua SEMPRE um block "mind_map" com "center" e "items" (4 a 8 ramos). Os "items" devem ser os pontos realmente abordados na aula, não inventados.
5. DENSIDADE E RESPIRO VISUAL (OBRIGATÓRIA): cada seção deve conter explicação suficiente, mas NUNCA ultrapassar 80% da área útil da página. Prefira MAIS seções bem espaçadas a poucas seções lotadas. Cada seção deve parecer uma lâmina editorial profissional com espaço para respirar — texto, gráficos e imagens distribuídos harmonicamente.
5.1 PÁGINAS DE INTRODUÇÃO: seções que abrem um novo módulo/capítulo devem ser BREVES — apenas título, subtítulo e 2-3 frases de contexto. O desenvolvimento detalhado fica nas seções SEGUINTES.
5.2 Quando o conteúdo excede o espaço de uma seção, distribua em múltiplas seções com subtítulos — jamais comprima.
5.3 PREENCHIMENTO: cada seção de miolo deve trazer densidade didática — integre exemplos do VTT no texto (paragraph) quando existirem; evite seção só com título e um parágrafo mínimo sem ilustração prática.
6. COBERTURA INTEGRAL (OBRIGATÓRIA): ao final, confira mentalmente a transcrição completa e garanta que todos os tópicos relevantes foram contemplados em alguma seção.

DADOS FIDEDIGNOS — NADA INVENTADO (CRÍTICO):
7. GRÁFICOS (chart): Só use "chart" quando a transcrição mencionar EXPLICITAMENTE números, percentuais, etapas com quantidades ou comparações. chartLabels e chartValues devem ser EXATAMENTE os dados citados na aula (ex.: se o professor disse "100% no topo, 30% consideram comprar, 10% fecham", use ["Topo", "Consideram", "Fecham"] e [100, 30, 10]). PROIBIDO inventar números ou rótulos. Se não houver dados numéricos na fala, NÃO inclua gráfico.
8. FLUXOGRAMAS (flowchart): Só use "flowchart" quando a aula descrever uma sequência real de passos ou etapas. "steps" deve ser a ordem EXATA e as frases MENCIONADAS na aula (ex.: se o professor listou "conhecer, considerar, decidir, comprar", use esses termos). PROIBIDO inventar etapas. diagramTitle e content devem refletir o que foi dito.
9. IMAGENS (image_placeholder): Inclua **exatamente um** bloco image_placeholder no **corpo** da apostila (dentro de uma seção, entre parágrafos de explicação), posicionado onde a figura mais **ajude o aluno a aprender** (conceito-chave, exemplo visual ou cenário que o professor descreveu). Não coloque no mesmo papel que a capa. "content" (PT) e "imagePrompt" (EN) devem refletir o que FOI DITO na aula. imagePrompt deve ser concreto o bastante para gerar uma ilustração didática útil. Para processos só com passos ou só números, prefira flowchart/chart; use imagem quando houver algo visualmente memorável para o estudo. Não crie image_placeholder genérico para "funil/ciclo" se o fluxograma ou gráfico com dados da transcrição for mais fiel.
10. LINGUAGEM: Clara, objetiva e em português.
11. DESTAQUE: Para dar ênfase visual a termos importantes (conceitos, nomes de etapas, metodologias), envolva-os em **termo** no content — ex.: "os **4 tipos** de anúncio", "**descoberta**, **relacionamento**, **conversão** e **remarketing**". Use com moderação (2 a 5 termos por parágrafo quando fizer sentido). Esses termos aparecerão em azul na apostila.

Resumo executivo (summary): 4 a 6 frases com os principais pontos da aula, para o aluno ter uma visão geral antes de estudar cada seção. Pode usar **termo** para destacar conceitos-chave.

LEMBRE-SE: Gráficos, fluxogramas e imagens devem refletir APENAS o que foi dito na transcrição. Em dúvida, omita o bloco em vez de inventar dados.
${materialSchema}`;

    const systemPromptSummary = `Você é um expert em didática. Transforme a transcrição de uma aula (.vtt) em um MATERIAL RESUMIDO para revisão rápida, mas ainda didático e fácil de compreender.

REGRA CRÍTICA — USE SOMENTE O VTT:
- Todo o conteúdo deve vir EXCLUSIVAMENTE da transcrição do arquivo .vtt. NÃO faça pesquisa externa. NÃO invente dados ou exemplos que não estejam no texto.

Regras:
- Estrutura enxuta: poucas seções (3 a 5), porém com EXPLICAÇÃO em texto corrido (paragraph). Evite ficar só em tópicos.
- Texto corrido para conceitos. "list" só para **exemplos citados** na aula (um item por exemplo), não para resumir teoria.
- No mínimo 85% "paragraph" nas seções; listas restritas a exemplos.
- Inclua os conceitos essenciais, definições e conclusões, com contexto suficiente para entendimento (mesmo no resumido).
- DENSIDADE MÍNIMA: cada seção deve ter pelo menos 2 a 4 parágrafos desenvolvidos (evite texto telegráfico).
- Expanda os porquês e o contexto prático de cada conceito; não apenas "o que é".
- Use **termo** para destacar conceitos-chave.
- NÃO inclua image_placeholder, chart ou flowchart a menos que seja essencial e esteja explícito na transcrição.
- Resumo executivo (summary): 2 a 4 frases.
${materialSchema}`;

    const systemPromptMindmap = `Você é um expert em síntese. Use SOMENTE o conteúdo da transcrição do .vtt — sem pesquisa externa. Analise a transcrição e extraia APENAS um mapa mental: o conceito central e os 6 a 12 ramos (tópicos principais) realmente mencionados. Nada inventado.
${mindmapSchema}`;

    const fewShotTeaching = isMindmap ? '' : await getFewShotSuffixForTeachingMaterial();
    const systemPromptBase = isMindmap
      ? systemPromptMindmap
      : isSummary
        ? systemPromptSummary
        : systemPromptFull;
    const systemPrompt = `${systemPromptBase}${fewShotTeaching}`;

    const transcriptForModel = isMindmap ? transcript.slice(0, 80000) : transcript.slice(0, 120000);
    const userPromptBase = `Transcrição da aula:\n\n${transcriptForModel}`;
    const minCharsTarget = isMindmap
      ? 0
      : isSummary
        ? Math.floor(transcriptForModel.length * 0.72)
        : Math.min(Math.floor(transcriptForModel.length * 0.75), 42000);

    let parsed: Omit<TeachingMaterial, 'createdAt'> | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const userPrompt =
        attempt === 0
          ? userPromptBase
          : `${userPromptBase}

ATENÇÃO: a tentativa anterior ficou curta para estudo autossuficiente.
- Expanda o conteúdo com mais detalhes e explicações didáticas, sem inventar dados.
- Inclua TODOS os exemplos citados pelo professor (em blocks "example" e/ou bullets quando necessário), sem inventar exemplos.
- Preserve 100% de fidelidade ao VTT.
- Garanta no mínimo ${minCharsTarget} caracteres de conteúdo textual no JSON final.`;

      const raw = await openRouterChatByTask('text_material', {
        system: systemPrompt,
        user: userPrompt,
        max_tokens: isMindmap ? 2048 : 12000,
      });
      if (!raw) {
        if (attempt === 2) {
          return NextResponse.json({ error: 'Resposta vazia do modelo.' }, { status: 502 });
        }
        continue;
      }

      try {
        const candidate = parseJsonFromAI<Omit<TeachingMaterial, 'createdAt'>>(raw);
        const chars = materialTextChars(candidate);
        if (isMindmap || chars >= minCharsTarget || attempt === 2) {
          parsed = candidate;
          break;
        }
      } catch (parseErr) {
        if (attempt === 2) throw parseErr;
      }
    }
    if (!parsed) {
      return NextResponse.json({ error: 'Não foi possível gerar conteúdo com densidade adequada.' }, { status: 502 });
    }

    const material: TeachingMaterial = {
      ...parsed,
      createdAt: new Date().toISOString(),
    };

    if (!isMindmap) {
      if (!isSummary) {
        await ensurePedagogicalImagePlaceholder(material, transcriptForModel);
      }
      applyVtsdReferenceImages(material, courseId);
      const imageBudget: ApiImageBudget = { remaining: MAX_API_IMAGES_PER_MATERIAL };
      await fillImagePlaceholders(material, imageBudget);
      await generateCoverImage(material, imageBudget);
    }

    return NextResponse.json(material);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao gerar material.' },
      { status: 500 }
    );
  }
}
