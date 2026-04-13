import type { PreviewData } from '@/components/MaterialPreviewBlocks';

export function buildPlainTextFromPreview(data: PreviewData): string {
  const source = data.conteudo || data.design;
  const titulo = source?.titulo || 'Material';
  const subtitulo = source?.subtitulo_curso || data.tema?.name || '';
  const rawPaginas = source?.paginas ?? (source as { pages?: unknown[] })?.pages;
  const paginas = Array.isArray(rawPaginas) ? (rawPaginas as Array<Record<string, unknown>>) : [];

  const lines: string[] = [];
  lines.push(titulo);
  if (subtitulo) lines.push(subtitulo);
  lines.push('');

  let section = 0;
  for (const p of paginas) {
    const tipo = String(p.tipo || '');
    if (tipo === 'atividades_finais') {
      const qs = Array.isArray((p as { perguntas?: string[] }).perguntas)
        ? (p as { perguntas: string[] }).perguntas
        : [];
      lines.push('## Atividades sobre o conteúdo');
      qs.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
      lines.push('');
      lines.push('(Linhas para resposta no material impresso / PDF)');
      lines.push('');
      continue;
    }
    if (tipo !== 'conteudo') continue;
    section += 1;
    const heading = String(p.titulo_bloco || p.titulo || `Seção ${section}`);
    lines.push(`## ${heading}`);

    const blocoPrincipal = String(p.bloco_principal || '').trim();
    if (blocoPrincipal) {
      lines.push(blocoPrincipal);
      lines.push('');
    }

    const blocks = Array.isArray(p.content_blocks) ? (p.content_blocks as Array<Record<string, unknown>>) : [];
    for (const b of blocks) {
      const type = String(b.type || '');
      const content = String(b.content || '').trim();
      if (!content) continue;
      if (type === 'text') lines.push(content);
      if (type === 'chart') lines.push(`[Gráfico sugerido] ${content}`);
      if (type === 'mermaid') lines.push(`[Fluxograma sugerido] ${content}`);
      if (type === 'image') lines.push(`[Imagem sugerida] ${content}`);
    }
    if (blocks.length) lines.push('');

    const destaques = Array.isArray(p.destaques) ? (p.destaques as string[]) : [];
    if (destaques.length) {
      lines.push('Exemplos citados:');
      for (const d of destaques) lines.push(`- ${d}`);
      lines.push('');
    }

    const citacao = String(p.citacao || '').trim();
    if (citacao) {
      lines.push(`Citação: ${citacao}`);
      lines.push('');
    }
  }

  if (data.perguntas?.length) {
    lines.push('');
    lines.push('Perguntas para reflexão');
    for (const q of data.perguntas) {
      lines.push(`• ${q}`);
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
