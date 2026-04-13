/**
 * Carrega as skills (regras e proibições) para injetar nos prompts dos agentes.
 * As skills definem o padrão de qualidade do material didático.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
// Icons available but not auto-inserted — kept for future manual use

const SKILLS_DIR = join(process.cwd(), 'src', 'lib', 'skills');

let _regrasCache: string | null = null;
let _proibicoesCache: string | null = null;

function loadFile(filename: string): string {
  try {
    return readFileSync(join(SKILLS_DIR, filename), 'utf-8');
  } catch {
    console.warn(`[skills] Arquivo ${filename} não encontrado em ${SKILLS_DIR}`);
    return '';
  }
}

/** Regras positivas — o que o material DEVE ter */
export function getRegrasDoMaterial(): string {
  if (_regrasCache === null) {
    _regrasCache = loadFile('REGRAS-DO-MATERIAL.md');
  }
  return _regrasCache;
}

/** Proibições — o que NÃO pode acontecer */
export function getProibicoesMaterial(): string {
  if (_proibicoesCache === null) {
    _proibicoesCache = loadFile('PROIBICOES-MATERIAL.md');
  }
  return _proibicoesCache;
}

/**
 * Resumo compacto das skills para injetar em prompts de IA.
 * Formato reduzido para não consumir muitos tokens.
 */
export function getSkillsSummaryForPrompt(): string {
  return `
REGRAS OBRIGATÓRIAS DO MATERIAL:
- Tipografia: H1=Sora Bold 32px (LH 110%), H2=22px (LH 120%), H3=16px (LH 130%), Body=Inter 13px (LH 170%), Label=11px (LH 140%)
- Cores: teal escuro #025468, teal accent #0599A8, cyan #5DECF2, texto #1A1A1A/#666666, fundo #FFFFFF
- Margens: 50px todos os lados. Badge: 40×36px, arredondado topo, colado na base
- Variação: NUNCA repetir layout consecutivo. Mínimo 3 layouts diferentes por material
- Imagens: máximo 2, fotografia profissional realista (não ilustrações), sem molduras, object-cover
- Texto: mínimo 220 palavras/página, 85% em parágrafos (não bullet points)
- Cada página de miolo DEVE ter header teal OU sidebar teal OU barra colorida

PROIBIÇÕES:
- PROIBIDO: página branca sem design, texto corrido sem título, layout repetido consecutivo
- PROIBIDO: label "CONTINUAÇÃO", fontes 14px/40px/20px, line-height 15px
- PROIBIDO: imagens em inglês, com molduras, mais de 2 por material
- PROIBIDO: inventar dados, transformar teoria em bullet points, páginas vazias
- PROIBIDO: conteúdo fora das margens (y<50 ou y>792)

LIMITES FÍSICOS DE TEXTO POR PÁGINA (CRÍTICO — respeitar para não vazar):
- bloco_principal: MÁXIMO 350 palavras (~1800 caracteres) por página
- Para páginas com sidebar (coluna estreita): MÁXIMO 250 palavras (~1200 caracteres)
- Cada parágrafo: 3-5 frases (não mais)
- Cada página: 2-4 parágrafos no bloco_principal
- Se o conteúdo for maior, DIVIDA em mais páginas (prefira mais páginas curtas a poucas longas)
- itens: 3-4 frases curtas (máx 22 palavras cada)
- destaques: 1-2 frases para callouts
- citacao: 1 frase marcante (máx 2 linhas)

PREENCHIMENTO DE ESPAÇO (evitar páginas com muito branco):
- Toda página DEVE ter: bloco_principal + pelo menos 1 de: itens, destaques ou citacao
- Se o texto é curto, adicione mais itens práticos ou uma citação relevante
- sugestao_imagem ajuda a preencher espaço visual (máximo 2 por material)


OTIMIZAÇÃO (content-agent):
- NÃO gere campos de design (layout_tipo, cor_*, icone_sugerido) — o sistema adiciona automaticamente
- Foque APENAS em: titulo_bloco, subtitulo, bloco_principal, itens, destaques, citacao, sugestao_imagem
- sugestao_imagem deve ser em PORTUGUÊS e descrever uma fotografia profissional realista
- Inclua sugestao_imagem em no máximo 2 páginas de conteúdo
`.trim();
}
