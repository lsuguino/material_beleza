/**
 * Estrutura do material didático (apostila) gerado a partir do VTT.
 */
export interface MaterialBlock {
  type:
    | 'paragraph'
    | 'heading'
    | 'list'
    | 'quote'
    | 'image_placeholder'
    | 'key_point'
    | 'example'
    | 'mind_map'
    | 'flowchart'
    | 'chart';
  content: string;
  items?: string[];
  imagePrompt?: string; // para gerar ou buscar imagem depois
  imageUrl?: string; // URL da imagem de referência
  /** Legenda editorial (ex: "Fig 1.0 — Descrição") */
  caption?: string;
  /** Layout da imagem: "full" (largura total), "side" (ao lado do texto), "grid" (duas pequenas) */
  imageLayout?: 'full' | 'side' | 'grid';
  /** Contexto opcional do exemplo (ex: "citado na aula", "caso prático") */
  source?: string;
  /** Nó central do mapa mental (título do tema) */
  center?: string;
  /** Passos do fluxograma (ordem sequencial) */
  steps?: string[];
  /** Tipo de gráfico: bar, line, pie */
  chartType?: 'bar' | 'line' | 'pie';
  /** Rótulos do gráfico (eixos ou categorias) */
  chartLabels?: string[];
  /** Valores numéricos do gráfico */
  chartValues?: number[];
  /** Título do gráfico ou fluxograma */
  diagramTitle?: string;
}

export interface MaterialSection {
  title: string;
  blocks: MaterialBlock[];
}

export interface TeachingMaterial {
  title: string;
  subtitle?: string;
  summary?: string;
  /** Imagem da capa (data URL ou URL) — opcional */
  coverImageUrl?: string;
  sections: MaterialSection[];
  createdAt: string;
}
