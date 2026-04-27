/**
 * Utilitários compartilhados para geração de imagem:
 * - Tipos e mapa de aspect ratio por layout
 * - Prefixo didático unificado (estilo flexível + PT-BR + composição limpa)
 * - Cap máximo de imagens por material
 */

export type ImageAspectRatio = 'wide' | 'portrait' | 'square';

const ASPECT_RATIO_HINT: Record<ImageAspectRatio, string> = {
  wide: 'wide landscape composition, 16:9 horizontal framing',
  portrait: 'portrait composition, 3:4 vertical framing',
  square: 'square composition, 1:1 framing',
};

/**
 * Mapeia layout_tipo (e tipo de página) para a proporção ideal do slot de imagem.
 * Baseado nas dimensões reais dos templates em FigmaTemplateRenderer.tsx.
 */
export function getAspectRatioForLayout(
  layoutTipo: string | undefined,
  tipo?: string,
): ImageAspectRatio {
  if (tipo === 'capa') return 'portrait';
  switch (layoutTipo) {
    case 'A4_4_magazine':
    case 'A4_2_imagem_texto':
    case 'A4_4_imagem_destaque':
    case 'A4_7_sidebar_conteudo':
    case 'imagem_top':
      return 'wide';
    case 'A4_2_imagem_overlay':
      return 'portrait'; // full A4 background
    case 'A4_2_imagem_flutuante':
      return 'square'; // float-friendly: largura ajustável, square encaixa em ambos lados
    case 'A4_2_texto_imagem':
    case 'imagem_lateral':
      return 'portrait';
    default:
      return 'wide';
  }
}

/**
 * Constrói o prompt final pra geração de imagem: prefixo didático +
 * hint de ratio + instrução PT-BR + user prompt.
 *
 * Estilo NÃO é forçado pra fotorrealista — aceita ilustração editorial
 * quando o tema abstrato pedir. Qualquer texto na imagem deve ser em português.
 */
export function buildImagePrompt(
  userPrompt: string,
  ratio: ImageAspectRatio = 'wide',
): string {
  const prefix =
    'Imagem para material didático impresso em A4. ' +
    'O estilo pode ser fotografia realista OU ilustração editorial — escolha o que melhor comunica o tema: ' +
    'realista para pessoas, lugares, objetos, empresas, produtos, capas de livros, prédios, coisas que existem no mundo; ' +
    'ilustração editorial para conceitos abstratos, processos, ideias, diagramas conceituais. ' +
    'Composição limpa, sem molduras, sem bordas, imagem sangrada que preenche todo o quadro. ' +
    `${ASPECT_RATIO_HINT[ratio]}. ` +
    'IMPORTANTE: qualquer texto dentro da imagem DEVE estar em PORTUGUÊS BRASILEIRO (pt-BR). ' +
    'Evite texto quando possível — priorize comunicar pelo visual.';
  return `${prefix} ${userPrompt.trim()}`.slice(0, 8000);
}

/** Cap rígido de imagens geradas via API por material. */
export const MAX_IMAGES_PER_MATERIAL = 2;
