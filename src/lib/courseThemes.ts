/**
 * Temas por curso: cor primária, estilo de diagramação e identidade visual.
 * Ao escolher um curso, o app aplica essas variáveis no header, upload e material gerado.
 */
export type CourseId = 'geral' | 'marketing' | 'beleza' | 'saude' | 'design' | 'tecnologia';

/**
 * Curso que usa o design system VTSD (Figma / `vtsd-design-system.ts`, diagramação A4, cores da marca).
 * Todo o fluxo de geração de materiais “editorial” está calibrado para este ID.
 */
export const VTSD_COURSE_ID = 'geral' as const satisfies CourseId;

/** Capa oficial VTSD (arte A4 595×842), sem texto dinâmico — use com overlay no preview/PDF */
export const CAPA_PADRAO_VTSD = '/capas/venda-todo-santo-dia/capa.svg';

/** Referência de diagramação: mesma arte com títulos/aula na posição correta (só referência visual) */
export const CAPA_VTSD_REFERENCIA_INFORMACOES = '/capas/venda-todo-santo-dia/capa-com-informacoes.svg';

/** Página de boas-vindas (arte sem texto — conteúdo em HTML sobreposto; ver `vtsd-fixed-copy`) */
export const PAGINA_BOAS_VINDAS_VTSD = '/capas/venda-todo-santo-dia/pagina-boas-vindas.svg';

/** Referência com texto já diagramado (só referência visual / alinhamento) */
export const PAGINA_BOAS_VINDAS_VTSD_REFERENCIA = '/capas/venda-todo-santo-dia/pagina-boas-vindas-referencia-com-texto.svg';

/** Verdadeiro para o curso Venda Todo Santo Dia (`geral` ou nome do tema). */
export function isVendaTodoSantoDiaCourse(courseId: string, temaName?: string): boolean {
  if (courseId === VTSD_COURSE_ID) return true;
  return (temaName || '').toLowerCase().includes('venda todo santo dia');
}

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
    /** Tokens alinhados a `@/lib/vtsd-design-system` (único curso com DS editorial completo). */
    primary: '#0599A8',
    primaryLight: '#03DFE6',
    primaryDark: '#025468',
    backgroundColor: '#FFFFFF',
    layoutClass: 'theme-geral',
    accent: '#B4F8FB',
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

export type GenerationMode = 'full' | 'summary';

export const GENERATION_MODES: { id: GenerationMode; label: string; shortLabel: string; description: string }[] = [
  { id: 'full', label: 'Material completo', shortLabel: 'Completo', description: 'Apostila completa com resumo, seções e diagramação editorial' },
  { id: 'summary', label: 'Material resumido', shortLabel: 'Resumido', description: 'Versão condensada para revisão rápida' },
];
