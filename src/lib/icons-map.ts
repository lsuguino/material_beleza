/**
 * Mapa de ícones Duotone (RTG Icons) disponíveis para o material didático.
 * Salvos em /public/icons/duotone/{file}.svg
 * Cores: teal dark #025468 (opacity 0.4) + teal accent #0599A8
 *
 * O content-agent usa `icone_sugerido` para indicar qual ícone usar.
 * O sistema renderiza o SVG correspondente no layout da página.
 */

export interface MaterialIcon {
  /** ID do ícone (usado no campo icone_sugerido) */
  id: string;
  /** Nome legível em português */
  name: string;
  /** Caminho do SVG relativo ao public/ */
  path: string;
  /** Quando usar este ícone */
  useWhen: string;
}

export const MATERIAL_ICONS: MaterialIcon[] = [
  { id: 'atencao', name: 'Atenção', path: '/icons/duotone/triangle-exclamation.svg', useWhen: 'Avisos, alertas, cuidados, advertências' },
  { id: 'dica', name: 'Dica', path: '/icons/duotone/lightbulb.svg', useWhen: 'Dicas do autor, sugestões, insights' },
  { id: 'pergunta', name: 'Pergunta', path: '/icons/duotone/circle-question.svg', useWhen: 'Perguntas frequentes, reflexão, FAQ' },
  { id: 'exercicio', name: 'Exercício', path: '/icons/duotone/pencil.svg', useWhen: 'Atividades práticas, exercícios, tarefas' },
  { id: 'checklist', name: 'Checklist', path: '/icons/duotone/check-circle.svg', useWhen: 'Listas de verificação, itens concluídos, validação' },
  { id: 'conceito', name: 'Conceito', path: '/icons/duotone/book-open.svg', useWhen: 'Conceitos-chave, definições, glossário, teoria' },
  { id: 'importante', name: 'Importante', path: '/icons/duotone/circle-exclamation.svg', useWhen: 'Informações críticas, pontos essenciais' },
  { id: 'citacao', name: 'Citação', path: '/icons/duotone/quote-left.svg', useWhen: 'Citações, depoimentos, falas marcantes' },
  { id: 'objetivo', name: 'Objetivo', path: '/icons/duotone/bullseye.svg', useWhen: 'Metas, objetivos do capítulo, foco' },
  { id: 'resumo', name: 'Resumo', path: '/icons/duotone/clipboard-list.svg', useWhen: 'Resumo, takeaways, pontos principais' },
  { id: 'dados', name: 'Dados', path: '/icons/duotone/chart-bar.svg', useWhen: 'Estatísticas, gráficos, números, métricas' },
  { id: 'processo', name: 'Processo', path: '/icons/duotone/arrows-rotate.svg', useWhen: 'Etapas, fluxos, ciclos, processos' },
  { id: 'tempo', name: 'Tempo', path: '/icons/duotone/clock.svg', useWhen: 'Cronograma, timeline, prazos, agenda' },
  { id: 'pessoa', name: 'Pessoa', path: '/icons/duotone/user.svg', useWhen: 'Testemunho, perfil, caso de uso, cliente' },
  { id: 'estrela', name: 'Estrela', path: '/icons/duotone/star.svg', useWhen: 'Destaque, favorito, nota especial, premium' },
  { id: 'info', name: 'Info', path: '/icons/duotone/circle-info.svg', useWhen: 'Informação adicional, nota complementar, saiba mais' },
  { id: 'aprendizado', name: 'Aprendizado', path: '/icons/duotone/graduation-cap.svg', useWhen: 'Educação, aprendizado, formação, curso' },
  { id: 'garantia', name: 'Garantia', path: '/icons/duotone/shield-check.svg', useWhen: 'Segurança, garantia, proteção, certificação' },
  { id: 'discussao', name: 'Discussão', path: '/icons/duotone/comments.svg', useWhen: 'Diálogo, chat, conversa, comunicação' },
  { id: 'imagem', name: 'Imagem', path: '/icons/duotone/image.svg', useWhen: 'Visual, foto, ilustração, mídia' },
];

/** Busca ícone por ID */
export function getIconById(id: string): MaterialIcon | undefined {
  return MATERIAL_ICONS.find(i => i.id === id);
}

/** Busca ícone mais adequado por contexto (palavras-chave) */
export function findBestIcon(context: string): MaterialIcon {
  const lower = context.toLowerCase();
  const scored = MATERIAL_ICONS.map(icon => {
    const keywords = icon.useWhen.toLowerCase().split(/[,\s]+/);
    const score = keywords.filter(k => k.length > 2 && lower.includes(k)).length;
    return { icon, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].icon : MATERIAL_ICONS[15]; // fallback: info
}

/** Lista de IDs de ícones para incluir no prompt do content-agent */
export function getIconIdsForPrompt(): string {
  return MATERIAL_ICONS.map(i => `${i.id} (${i.useWhen.split(',')[0].trim()})`).join(', ');
}
