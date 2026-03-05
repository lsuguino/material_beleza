import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { TeachingMaterial } from '@/types/material';
import type { CourseId, GenerationMode } from '@/lib/courseThemes';
import { parseJsonFromAI } from '@/lib/parse-json-from-ai';

// Tempo máximo da rota (segundos). Aumentado para transcrições longas (ex.: Vercel Pro permite até 300).
export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

/** Usa o Claude para refinar o prompt de imagem: mais detalhado e adequado para material didático. */
async function refineImagePromptWithClaude(originalPrompt: string): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: `You are an expert at writing prompts for AI image generation. Given a short prompt for an educational or didactic illustration, return ONLY one improved, detailed prompt in English (1-2 sentences). The result must be professional, clear, suitable for study handouts. Style: clean, illustrative, easy to understand. No explanation or quotes—output only the prompt.`,
      messages: [{ role: 'user', content: originalPrompt.slice(0, 500) }],
    });
    const block = msg.content.find((b) => b.type === 'text');
    const text = block && 'text' in block ? String(block.text).trim() : '';
    return text.length > 0 ? text : originalPrompt;
  } catch (e) {
    console.error('refineImagePromptWithClaude error:', e);
    return originalPrompt;
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

/** Gera a imagem: primeiro tenta Hugging Face (FLUX), depois OpenAI. */
async function generateImageDataUrl(prompt: string): Promise<string | null> {
  const fromHF = await generateImageWithHuggingFace(prompt);
  if (fromHF) return fromHF;
  return generateImageWithOpenAI(prompt);
}

/** Refina o prompt com Claude e preenche imageUrl em todos os image_placeholder. */
async function fillImagePlaceholders(material: TeachingMaterial): Promise<void> {
  if (!material.sections) return;
  for (const section of material.sections) {
    if (!section.blocks) continue;
    for (const block of section.blocks) {
      if (block.type !== 'image_placeholder' || block.imageUrl) continue;
      if (!block.imagePrompt?.trim()) continue;
      const refinedPrompt = await refineImagePromptWithClaude(block.imagePrompt.trim());
      const dataUrl = await generateImageDataUrl(refinedPrompt);
      if (dataUrl) block.imageUrl = dataUrl;
    }
  }
}

/** Gera imagem da capa temática (ex.: tráfego pago = workspace, ads, gráficos). */
async function generateCoverImage(material: TeachingMaterial): Promise<void> {
  const theme = [material.title, material.subtitle, material.summary].filter(Boolean).join('. ').slice(0, 500);
  if (!theme.trim()) return;
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 220,
      system: `You write a single, detailed prompt in English for an AI image generator. The image will be the COVER of a study handout (apostila).

Rules:
- The image must be THEMATIC and CONCRETE: it should show a real scene that represents the subject, not an abstract symbol (no generic book or lightbulb).
- For digital marketing, paid traffic, ads, Meta/Facebook, pixel, campaigns: describe a professional workspace — e.g. hands on laptop and smartphone, holographic or floating UI elements (charts, "Ads" panel, metrics, dashboards), modern office, dynamic and inviting. Think "digital marketer at work".
- For other topics: suggest a concrete scene that a student would associate with that subject (tools, environment, action).
- Style: professional, modern, clean, suitable for education. Soft lighting. No long paragraphs of text in the image; icons, numbers and short labels (e.g. "Ads", "114K") are OK.
- Output ONLY the prompt, 1-3 sentences, no quotes or explanation.`,
      messages: [{
        role: 'user',
        content: `Theme of the study material:\n${theme}\n\nWrite a detailed image prompt for the cover that depicts a concrete, thematic scene (e.g. for "tráfego pago": professional workspace with laptop, smartphone, ads dashboard, charts and metrics, holographic UI, modern).`,
      }],
    });
    const block = msg.content.find((b) => b.type === 'text');
    const text = block && 'text' in block ? String(block.text).trim() : '';
    if (!text) return;
    // Usar prompt temático direto (sem refino) para manter cena concreta (ex.: tráfego pago = workspace, ads, gráficos)
    const dataUrl = await generateImageDataUrl(text);
    if (dataUrl) material.coverImageUrl = dataUrl;
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
Tipos: heading, paragraph, key_point, list, quote, example, mind_map, image_placeholder, flowchart, chart.
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
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada. Adicione em .env.local' },
      { status: 503 }
    );
  }
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

    const systemPromptFull = `Você é um expert em didática e design instrucional. Sua tarefa é transformar a transcrição de uma aula (arquivo .vtt) em uma APOSTILA DE ESTUDOS para alunos.

REGRA CRÍTICA — USE SOMENTE O VTT:
- Todo o conteúdo deve vir EXCLUSIVAMENTE da transcrição do arquivo .vtt que você recebe.
- NÃO faça pesquisa externa. NÃO invente dados, estatísticas, exemplos ou conceitos que não estejam no texto da transcrição.
- Se algo não estiver no VTT, não inclua no material.

OBJETIVO DA APOSTILA:
- O aluno deve conseguir aplicar o ensino e estudar apenas com este material — ou seja, o conteúdo deve ser completo o suficiente para aprender e revisar sem precisar reassistir à aula.
- O texto pode e deve ser resumido em relação à fala (mais direto e organizado), mas sem perder conceitos essenciais, definições e conclusões.
- Inclua SEMPRE os exemplos citados pelo professor em aula: casos práticos, exercícios comentados, ilustrações e situações que ele mencionou. Esses exemplos são fundamentais para o estudo.

Regras obrigatórias:
1. CONTEÚDO: Resuma de forma didática — conceitos claros, definições, passos quando houver, e conclusões. O aluno lendo a apostila deve conseguir entender e aplicar o que foi ensinado.
2. EXEMPLOS DO PROFESSOR: Toda vez que o professor citar um exemplo, caso, exercício ou situação na aula, inclua no material com o tipo de block "example". Transcreva o exemplo de forma completa (números, nomes, contexto), para o aluno poder estudar e revisar como foi dado em aula.
3. ESTRUTURA: Organize em seções com títulos. Use "key_point" para ideias centrais, listas para enumerações e "quote" para citações literais do professor quando relevante.
4. MAPA MENTAL: Em seções que forem um "resumo da estratégia completa", "visão geral", "síntese" ou equivalente, inclua SEMPRE um block "mind_map" com "center" e "items" (4 a 8 ramos). Os "items" devem ser os pontos realmente abordados na aula, não inventados.

DADOS FIDEDIGNOS — NADA INVENTADO (CRÍTICO):
5. GRÁFICOS (chart): Só use "chart" quando a transcrição mencionar EXPLICITAMENTE números, percentuais, etapas com quantidades ou comparações. chartLabels e chartValues devem ser EXATAMENTE os dados citados na aula (ex.: se o professor disse "100% no topo, 30% consideram comprar, 10% fecham", use ["Topo", "Consideram", "Fecham"] e [100, 30, 10]). PROIBIDO inventar números ou rótulos. Se não houver dados numéricos na fala, NÃO inclua gráfico.
6. FLUXOGRAMAS (flowchart): Só use "flowchart" quando a aula descrever uma sequência real de passos ou etapas. "steps" deve ser a ordem EXATA e as frases MENCIONADAS na aula (ex.: se o professor listou "conhecer, considerar, decidir, comprar", use esses termos). PROIBIDO inventar etapas. diagramTitle e content devem refletir o que foi dito.
7. IMAGENS (image_placeholder): Use apenas quando a aula descrever algo visual concreto (esquema, exemplo visual, cenário). "content" e "imagePrompt" devem descrever O QUE FOI DITO na aula, não conceitos genéricos. Para processos ou dados numéricos, prefira flowchart ou chart (com dados reais) em vez de imagem. Não crie image_placeholder para "funil", "ciclo" ou "gráfico" — use chart/flowchart com dados da transcrição.
8. LINGUAGEM: Clara, objetiva e em português.
9. DESTAQUE: Para dar ênfase visual a termos importantes (conceitos, nomes de etapas, metodologias), envolva-os em **termo** no content — ex.: "os **4 tipos** de anúncio", "**descoberta**, **relacionamento**, **conversão** e **remarketing**". Use com moderação (2 a 5 termos por parágrafo quando fizer sentido). Esses termos aparecerão em azul na apostila.

Resumo executivo (summary): 4 a 6 frases com os principais pontos da aula, para o aluno ter uma visão geral antes de estudar cada seção. Pode usar **termo** para destacar conceitos-chave.

LEMBRE-SE: Gráficos, fluxogramas e imagens devem refletir APENAS o que foi dito na transcrição. Em dúvida, omita o bloco em vez de inventar dados.
${materialSchema}`;

    const systemPromptSummary = `Você é um expert em didática. Transforme a transcrição de uma aula (.vtt) em um MATERIAL RESUMIDO para revisão rápida.

REGRA CRÍTICA — USE SOMENTE O VTT:
- Todo o conteúdo deve vir EXCLUSIVAMENTE da transcrição do arquivo .vtt. NÃO faça pesquisa externa. NÃO invente dados ou exemplos que não estejam no texto.

Regras:
- Estrutura enxuta: poucas seções (3 a 5), parágrafos curtos, muitas listas e key_point.
- Inclua só os conceitos essenciais, definições e conclusões. Menos texto, mais tópicos.
- Use **termo** para destacar conceitos-chave.
- NÃO inclua image_placeholder, chart ou flowchart a menos que seja essencial e esteja explícito na transcrição.
- Resumo executivo (summary): 2 a 4 frases.
${materialSchema}`;

    const systemPromptMindmap = `Você é um expert em síntese. Use SOMENTE o conteúdo da transcrição do .vtt — sem pesquisa externa. Analise a transcrição e extraia APENAS um mapa mental: o conceito central e os 6 a 12 ramos (tópicos principais) realmente mencionados. Nada inventado.
${mindmapSchema}`;

    const systemPrompt = isMindmap
      ? systemPromptMindmap
      : isSummary
        ? systemPromptSummary
        : systemPromptFull;

    const userPrompt = isMindmap
      ? `Transcrição da aula:\n\n${transcript.slice(0, 80000)}`
      : `Transcrição da aula:\n\n${transcript.slice(0, 120000)}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: isMindmap ? 2048 : 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const raw = textBlock && 'text' in textBlock ? String(textBlock.text).trim() : '';
    if (!raw) {
      return NextResponse.json({ error: 'Resposta vazia do modelo.' }, { status: 502 });
    }

    const parsed = parseJsonFromAI<Omit<TeachingMaterial, 'createdAt'>>(raw);
    const material: TeachingMaterial = {
      ...parsed,
      createdAt: new Date().toISOString(),
    };

    if (!isMindmap) {
      await fillImagePlaceholders(material);
      await generateCoverImage(material);
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
