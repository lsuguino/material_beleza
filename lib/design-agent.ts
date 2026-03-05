import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

/** Tema com cores e tipografia do curso */
export interface TemaDesign {
  primary: string;
  primaryLight?: string;
  primaryDark?: string;
  accent?: string;
  name?: string;
}

/** Conteúdo estruturado (páginas geradas pelo agente 1) */
export type ConteudoEstruturado = Record<string, unknown>;

const SYSTEM_PROMPT = `Você é um designer gráfico especializado em materiais didáticos visuais. Receberá um JSON com conteúdo estruturado de uma aula e um tema visual com cores. Deve definir o layout visual de cada página.

REGRAS:
1. Retorne APENAS um JSON válido. Sem texto antes ou depois.
2. Para cada página do conteúdo, adicione os campos de design.
3. Varie os layouts para tornar o material visualmente interessante.
4. Calcule contraste automaticamente: fundo escuro = texto branco; fundo claro = texto escuro.

CAMPOS DE DESIGN A ADICIONAR EM CADA PÁGINA:
- layout_tipo: 'header_destaque' | 'dois_colunas' | 'citacao_grande' | 'lista_icones' | 'dados_grafico' | 'imagem_lateral'
- cor_fundo_principal: (hex - use as cores do tema)
- cor_fundo_destaque: (hex - use a cor de destaque do tema)
- cor_texto_principal: (hex - calculado por contraste)
- cor_texto_destaque: (hex - calculado por contraste)
- icone_sugerido: (nome descritivo de um ícone relevante ao conteúdo)
- proporcao_colunas: '60/40' | '50/50' | '70/30' (apenas para layout dois_colunas)`;

/**
 * Gera o layout visual (campos de design) para cada página do conteúdo.
 * Retorna o JSON completo com os campos de design adicionados em cada página.
 */
export async function generateDesign(
  conteudo: ConteudoEstruturado,
  tema: TemaDesign
): Promise<Record<string, unknown>> {
  const userContent = `Tema visual (cores e referência de estilo):
${JSON.stringify(
  {
    primary: tema.primary,
    primaryLight: tema.primaryLight,
    primaryDark: tema.primaryDark,
    accent: tema.accent,
    name: tema.name,
  },
  null,
  2
)}

Conteúdo estruturado (adicione os campos de design em cada página):
${JSON.stringify(conteudo, null, 2)}

Retorne o mesmo conteúdo com os campos de design adicionados em cada página. Apenas JSON válido, sem markdown.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const block = message.content.find((b) => b.type === 'text');
  const raw = block && 'text' in block ? String(block.text).trim() : '';
  if (!raw) {
    throw new Error('Resposta vazia do modelo de design.');
  }

  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  return JSON.parse(jsonStr) as Record<string, unknown>;
}
