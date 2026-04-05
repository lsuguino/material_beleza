/**
 * Mapeamento: Tipo de Conteúdo Visual → Ferramenta/API
 * Usado pelo content-agent para escolher o bloco correto em content_blocks.
 */

export const VISUAL_TOOLS_MAP = {
  /** Fotos, fundos, cenários → OpenAI DALL-E 3. content_blocks type "image". */
  fotos_fundos: {
    tipo: 'image' as const,
    ferramenta: 'OpenAI API (DALL-E 3)',
    vantagem: 'Integração fácil via Node.js; gera imagens com alta aderência ao prompt.',
  },
  /** Fluxogramas, processos, etapas → Mermaid.js. content_blocks type "mermaid". */
  fluxogramas: {
    tipo: 'mermaid' as const,
    ferramenta: 'Mermaid.js',
    vantagem: 'A IA gera um texto simples e o navegador renderiza como gráfico profissional.',
  },
  /** Gráficos de dados, números, comparações → Chart.js. content_blocks type "chart". */
  graficos_dados: {
    tipo: 'chart' as const,
    ferramenta: 'Chart.js',
    vantagem: 'Perfeito para barras e pizzas dinâmicas com cara de relatório corporativo.',
  },
} as const;

export type VisualContentType = keyof typeof VISUAL_TOOLS_MAP;
