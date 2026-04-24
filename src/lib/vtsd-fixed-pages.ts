/**
 * Conteúdo fixo das páginas que não mudam no curso "Venda Todo Santo Dia".
 *
 * Capa, Boas-Vindas e Contra-Capa são inseridas automaticamente em todo
 * material gerado para o curso VTSD (tema.id === 'geral').
 *
 * O sistema NÃO deve substituir esses textos — eles são institucionais.
 */

export const VTSD_FIXED_PAGES = {
  /** Página de capa — usa SVG em /public/capas/venda-todo-santo-dia/ */
  capa: {
    tipo: 'capa' as const,
    templateId: 'capa',
    svgPath: '/capas/venda-todo-santo-dia/capa.svg',
    /** O título da aula é dinâmico (vem do conteúdo gerado) */
    dynamicFields: ['titulo_aula', 'subtitulo'],
  },

  /** Página de boas-vindas — texto institucional fixo */
  boasVindas: {
    tipo: 'boas-vindas' as const,
    templateId: 'boas-vindas',
    titulo: 'Bem-vindo(a) ao\nVenda Todo\nSanto Dia',
    corpo: [
      'Você tem em mãos um dos métodos mais validados do mercado para vender todo santo dia. O VTSD 2.0 foi atualizado com ferramentas de Inteligência Artificial que vão facilitar sua implementação e acelerar seus resultados. A proposta? Eficácia na criação e comercialização de produtos, seja você iniciante ou veterano no digital.',
      'Nesta apostila, você vai encontrar uma estrutura prática, dividida em módulos que cobrem da concepção do produto até tráfego, copy, conteúdo e vendas. Prepare-se para alguns tapas na cara, ajustes de rota e verdades que podem doer, como descobrir que seu produto lindo talvez só pareça bonito... pra você. Mas calma, a gente resolve.',
      'E por último, mas não menos importante, se você estava esperando um empurrãozinho para virar o jogo, está com o curso certo na mão. A metodologia do VTSD não é para assistir deitadão no sofá como se fosse Netflix. É para implementar. É execução. Agora, é com você. Lembre-se que coisas boas acontecem no caminho de quem está no caminho. Aguardo seu print no meu direct. Boas Vendas!',
    ],
    assinatura: 'Abraços,\nLeandro Ladeira, Vitor Albuquerque e Ruy Guimarães',
    logoPath: '/capas/venda-todo-santo-dia/logo.svg',
  },

  /** Contra-capa — texto de encerramento fixo */
  contraCapa: {
    tipo: 'contra-capa' as const,
    templateId: 'contra-capa',
    corpo: 'Este material não foi feito para ser guardado na gaveta, mas para ser o combustível da sua execução diária. O VTSD 2.0, agora potencializado por Inteligência Artificial, entrega a estrutura necessária para que você saia da inércia e transforme conhecimento em vendas constantes. Lembre-se: o resultado não vem do que você sabe, mas do que você implementa no caminho. Agora, a rota está traçada; tire do plano do papel, ajuste o que for preciso e esteja pronto para ver as coisas acontecerem. Boas vendas!',
    svgPath: '/capas/venda-todo-santo-dia/contra-capa.svg',
    logoPath: '/capas/venda-todo-santo-dia/logo.svg',
  },
} as const;

/** Tipo para as páginas fixas */
export type VtsdFixedPageKey = keyof typeof VTSD_FIXED_PAGES;

/**
 * Retorna a lista ordenada de páginas fixas que devem envolver o conteúdo gerado.
 * Capa e Boas-Vindas no início, Contra-Capa no final.
 */
export function getVtsdFixedPagesOrder(): { before: VtsdFixedPageKey[]; after: VtsdFixedPageKey[] } {
  return {
    before: ['capa', 'boasVindas'],
    after: ['contraCapa'],
  };
}
