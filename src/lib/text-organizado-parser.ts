/**
 * Converte texto já organizado (markdown, seções, listas) em estrutura de material didático.
 * Usado quando o usuário indica que o texto NÃO é transcrição — pula a etapa da IA de conteúdo.
 */

export interface PaginaConteudo {
  tipo: string;
  titulo?: string;
  subtitulo?: string;
  titulo_bloco?: string;
  bloco_principal?: string;
  destaques?: string[];
  [key: string]: unknown;
}

export interface ConteudoEstruturado {
  titulo: string;
  subtitulo_curso: string;
  paginas: PaginaConteudo[];
}

/** Detecta e extrai itens de lista (bullets, números) de um bloco de texto */
function extrairLista(texto: string): { corpo: string; itens?: string[] } {
  const linhas = texto.split(/\r?\n/);
  const itens: string[] = [];
  const corpoLinhas: string[] = [];

  for (const linha of linhas) {
    const trimmed = linha.trim();
    const matchBullet = trimmed.match(/^[-*•]\s+(.+)$/);
    const matchNum = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (matchBullet) {
      itens.push(matchBullet[1].trim());
    } else if (matchNum) {
      itens.push(matchNum[1].trim());
    } else if (trimmed) {
      corpoLinhas.push(trimmed);
    }
  }

  return {
    corpo: corpoLinhas.join('\n\n').trim(),
    ...(itens.length > 0 && { itens }),
  };
}

/** Divide texto em seções por headers markdown (##, ###) ou separadores (---) */
function dividirEmSecoes(texto: string): Array<{ titulo?: string; conteudo: string }> {
  const normalized = texto.replace(/\r\n/g, '\n').trim();
  const secoes: Array<{ titulo?: string; conteudo: string }> = [];

  // Split por ## ou ### (headers) mantendo o header na linha
  const partes = normalized.split(/(?=^#{1,3}\s+.+$)/gm);

  for (const parte of partes) {
    const trimmed = parte.trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(/^#{1,3}\s+(.+?)(?:\n|$)/);
    if (headerMatch) {
      const titulo = headerMatch[1].trim();
      const conteudo = trimmed.slice(headerMatch[0].length).trim();
      secoes.push({ titulo, conteudo });
    } else {
      // Sem header — pode ser bloco inicial (título geral) ou seção por ---
      const porSeparador = trimmed.split(/\n---+\n/);
      if (porSeparador.length > 1) {
        for (const bloco of porSeparador) {
          const b = bloco.trim();
          if (b) secoes.push({ conteudo: b });
        }
      } else {
        secoes.push({ conteudo: trimmed });
      }
    }
  }

  return secoes;
}

/** Extrai título principal (primeira linha # ou primeira linha significativa) */
function extrairTituloPrincipal(texto: string): { titulo: string; resto: string } {
  const linhas = texto.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].trim().match(/^#\s+(.+)$/);
    if (m) {
      return {
        titulo: m[1].trim(),
        resto: linhas.slice(i + 1).join('\n').trim(),
      };
    }
  }
  // Primeira linha não-vazia como título
  const primeira = linhas.find((l) => l.trim().length > 0);
  if (primeira) {
    const titulo = primeira.trim().replace(/^#+\s*/, '');
    const idx = linhas.findIndex((l) => l.trim().length > 0);
    return {
      titulo,
      resto: linhas.slice(idx + 1).join('\n').trim(),
    };
  }
  return { titulo: 'Material', resto: texto };
}

/**
 * Converte texto já organizado na estrutura esperada pelo design-agent.
 */
export function parseTextoOrganizado(
  texto: string,
  nomeCurso: string
): ConteudoEstruturado {
  const { titulo: tituloGeral, resto } = extrairTituloPrincipal(texto);
  const secoes = dividirEmSecoes(resto || texto);

  const paginas: PaginaConteudo[] = [];

  // Capa
  paginas.push({
    tipo: 'capa',
    titulo: tituloGeral,
    subtitulo: nomeCurso,
  });

  // Páginas de conteúdo
  for (const sec of secoes) {
    if (!sec.conteudo.trim()) continue;

    const { corpo, itens } = extrairLista(sec.conteudo);
    const tituloBloco = sec.titulo || (corpo ? corpo.split(/\n/)[0]?.slice(0, 80) : 'Conteúdo');
    const blocoPrincipal = corpo || sec.conteudo;

    paginas.push({
      tipo: 'conteudo',
      titulo_bloco: tituloBloco.length > 80 ? tituloBloco.slice(0, 77) + '...' : tituloBloco,
      bloco_principal: blocoPrincipal,
      destaques: itens?.length ? itens : undefined,
    });
  }

  // Se só temos a capa (nenhuma seção de conteúdo), cria uma página com o resto
  if (paginas.length === 1 && (resto || texto).trim()) {
    const { corpo, itens } = extrairLista(resto || texto);
    paginas.push({
      tipo: 'conteudo',
      titulo_bloco: tituloGeral,
      bloco_principal: corpo || resto || texto,
      destaques: itens?.length ? itens : undefined,
    });
  }

  return {
    titulo: tituloGeral,
    subtitulo_curso: nomeCurso,
    paginas,
  };
}
