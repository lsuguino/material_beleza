/**
 * Injeta páginas de abertura (A4_1_abertura) antes de cada novo tópico
 * (mudança de titulo_bloco nas páginas de conteúdo, ignorando continuações).
 *
 * Regras:
 * - Sempre insere opener antes do PRIMEIRO tópico também.
 * - Sempre insere opener para TODO tópico (mesmo os curtos).
 * - Opener herda cores do tema da página de conteúdo pra manter coesão.
 * - Opener recebe `capituloNumero` sequencial (1, 2, 3…) pra variações rotacionarem.
 */

export function injectTopicOpeners(
  conteudo: Record<string, unknown>,
): Record<string, unknown> {
  const paginas = conteudo.paginas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(paginas) || paginas.length === 0) return conteudo;

  const out: Array<Record<string, unknown>> = [];
  let lastTituloBloco: string | undefined = undefined;
  let topicNumber = 0;

  for (const p of paginas) {
    const tipo = String(p.tipo ?? '');
    const continuacao = Boolean(p.continuacao);
    const tituloBloco = String(p.titulo_bloco ?? '').trim();

    const isNewTopic =
      tipo === 'conteudo' &&
      !continuacao &&
      tituloBloco.length > 0 &&
      tituloBloco !== lastTituloBloco;

    if (isNewTopic) {
      topicNumber += 1;
      const subtitulo = String(p.subtitulo ?? '').trim();
      const opener: Record<string, unknown> = {
        tipo: 'conteudo',
        layout_tipo: 'A4_1_abertura',
        titulo_bloco: tituloBloco,
        /** TemplateAberturaCapitulo lê `titulo` (não `titulo_bloco`), duplico aqui. */
        titulo: tituloBloco,
        subtitulo,
        capitulo_seq: topicNumber,
        /** Número usado pelo dispatcher das 8 variações do opener. */
        capituloNumero: topicNumber,
        /** Flag pra identificar no preview/pagination que essa página é um opener injetado. */
        _isTopicOpener: true,
        /** Herda cores do tema da página de conteúdo pra manter coesão visual. */
        cor_fundo_principal: p.cor_fundo_principal,
        cor_fundo_destaque: p.cor_fundo_destaque,
        cor_texto_principal: p.cor_texto_principal,
        cor_texto_destaque: p.cor_texto_destaque,
      };
      out.push(opener);
      lastTituloBloco = tituloBloco;
    } else if (tipo === 'conteudo' && !continuacao && tituloBloco.length > 0) {
      lastTituloBloco = tituloBloco;
    }

    out.push(p);
  }

  return { ...conteudo, paginas: out };
}
