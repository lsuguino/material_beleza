/**
 * Temas por curso: cor primária, estilo de diagramação e identidade visual.
 * Ao escolher um curso, o app aplica essas variáveis no header, upload e material gerado.
 */
export type CourseId = 'geral' | 'marketing' | 'beleza' | 'saude' | 'design' | 'tecnologia';

/** Caminho da capa padrão para o curso Venda Todo Santo Dia (geral) */
export const CAPA_PADRAO_VTSD = '/capas/venda-todo-santo-dia.png';

export interface CourseTheme {
  id: CourseId;
  name: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  /** Cor de fundo das páginas (clara) para contraste com texto escuro */
  backgroundColor?: string;
  /** Classe Tailwind/CSS para layout do material (ex: book-layout, minimal-layout) */
  layoutClass: string;
  /** Cor de destaque para ícones e badges */
  accent: string;
}

export const COURSE_THEMES: Record<CourseId, CourseTheme> = {
  geral: {
    id: 'geral',
    name: 'Venda Todo Santo Dia',
    primary: '#2A2A2A',
    primaryLight: '#4a4a4a',
    primaryDark: '#1a1a1a',
    backgroundColor: '#F1F1F1',
    layoutClass: 'theme-geral',
    accent: '#55B8A1',
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing & Tráfego',
    primary: '#7c3aed',
    primaryLight: '#8b5cf6',
    primaryDark: '#5b21b6',
    backgroundColor: '#F5F3FF',
    layoutClass: 'theme-marketing',
    accent: '#a78bfa',
  },
  beleza: {
    id: 'beleza',
    name: 'Beleza & Estética',
    primary: '#db2777',
    primaryLight: '#ec4899',
    primaryDark: '#be185d',
    backgroundColor: '#FDF2F8',
    layoutClass: 'theme-beleza',
    accent: '#f472b6',
  },
  saude: {
    id: 'saude',
    name: 'Saúde & Bem-estar',
    primary: '#059669',
    primaryLight: '#10b981',
    primaryDark: '#047857',
    backgroundColor: '#ECFDF5',
    layoutClass: 'theme-saude',
    accent: '#34d399',
  },
  design: {
    id: 'design',
    name: 'Design & Criativo',
    primary: '#ea580c',
    primaryLight: '#f97316',
    primaryDark: '#c2410c',
    backgroundColor: '#FFF7ED',
    layoutClass: 'theme-design',
    accent: '#fb923c',
  },
  tecnologia: {
    id: 'tecnologia',
    name: 'Tecnologia',
    primary: '#0891b2',
    primaryLight: '#06b6d4',
    primaryDark: '#0e7490',
    backgroundColor: '#ECFEFF',
    layoutClass: 'theme-tecnologia',
    accent: '#22d3ee',
  },
};

export type GenerationMode = 'full' | 'summary' | 'mindmap';

export const GENERATION_MODES: { id: GenerationMode; label: string; shortLabel: string; description: string }[] = [
  { id: 'full', label: 'Material completo', shortLabel: 'Completo', description: 'Apostila completa com resumo, seções e diagramação editorial' },
  { id: 'summary', label: 'Material resumido', shortLabel: 'Resumido', description: 'Versão condensada para revisão rápida' },
  { id: 'mindmap', label: 'Mapa mental', shortLabel: 'Mapa mental', description: 'Apenas o mapa mental do conteúdo do VTT' },
];
