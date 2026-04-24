/** Texto fixo da página de conclusão (VTSD) — também injetado em `bloco_principal` na API. */
export const VTSD_CONCLUSAO_TITULO = 'Conclusão';

export const VTSD_CONCLUSAO_PARAGRAPHS = [
  'Este material não foi feito para ser guardado na gaveta, mas para ser o combustível da sua execução diária.',
  'O VTSD 2.0, agora potencializado por Inteligência Artificial, entrega a estrutura necessária para que você saia da inércia e transforme conhecimento em vendas constantes.',
  'Lembre-se: o resultado não vem do que você sabe, mas do que você implementa no caminho.',
  'Agora, a rota está traçada; tire o plano do papel, ajuste o que for preciso e esteja pronto para ver as coisas acontecerem.',
  'Boas vendas!',
] as const;

export function vtsdConclusaoBlocoPrincipal(): string {
  return VTSD_CONCLUSAO_PARAGRAPHS.join('\n\n');
}
