export type CoursePickerId =
  | 'geral'
  | 'master-fluxo'
  | 'lightcopy'
  | 'stories-10x'
  | 'super-ads'
  | 'automacoes-inteligentes';

export type CoursePickerOption = {
  id: CoursePickerId;
  /** `null` = sem logo; exibir rótulo em texto */
  logoSrc: string | null;
  enabled: boolean;
  ariaLabel: string;
};

/** Ordem de exibição; apenas `geral` (Venda Todo Santo Dia) pode ser selecionado para geração. */
export const COURSE_PICKER_OPTIONS: CoursePickerOption[] = [
  { id: 'geral', logoSrc: '/cursos/venda-todo-santo-dia.svg', enabled: true, ariaLabel: 'Venda Todo Santo Dia' },
  { id: 'master-fluxo', logoSrc: '/cursos/master-fluxo.svg', enabled: false, ariaLabel: 'Master Fluxo' },
  { id: 'lightcopy', logoSrc: '/cursos/lightcopy.svg', enabled: false, ariaLabel: 'Lightcopy' },
  { id: 'stories-10x', logoSrc: '/cursos/stories-10x.svg', enabled: false, ariaLabel: 'Stories 10x' },
  { id: 'super-ads', logoSrc: '/cursos/super-ads.svg', enabled: false, ariaLabel: 'Super Ads' },
  { id: 'automacoes-inteligentes', logoSrc: '/cursos/automacoes-inteligentes.svg', enabled: false, ariaLabel: 'Automações inteligentes' },
];
