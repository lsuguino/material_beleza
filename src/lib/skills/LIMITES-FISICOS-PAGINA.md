# LIMITES FÍSICOS DA PÁGINA A4 — REGRAS ABSOLUTAS

## Área da página
- Largura total: 595px
- Altura total: 842px

## Zonas proibidas (NENHUM texto ou conteúdo pode existir aqui)
- y < 50px (margem topo)
- y > 792px (margem base — reservada para badge)
- x < 50px (margem esquerda, exceto sidebar)
- x > 545px (margem direita)

## Badge de página
- Posição: y = 806px (colado na base)
- Tamanho: 40 × 36px
- Zona reservada: y = 792px até y = 842px — NENHUM conteúdo pode existir aqui

## Área útil de TEXTO por tipo de layout

### Full width (sem header, sem sidebar)
- Largura: 495px (595 - 50 - 50)
- Altura: 742px (842 - 50 - 50)
- Máx caracteres: ~1200 (13px × 170% LH = 22px por linha, ~33 linhas × ~37 chars)

### Com header teal (pad 40/50/30/50)
- Header ocupa: ~130px de altura
- Corpo disponível: 742 - 130 = 612px de altura
- Largura corpo: 495px
- Máx caracteres corpo: ~950

### Com header teal + footer teal
- Header: ~110px, Footer: ~110px
- Corpo: 742 - 110 - 110 = 522px
- Máx caracteres corpo: ~800

### Sidebar GRANDE (370px) + coluna texto
- Sidebar: 370px largura
- Coluna texto: 225px largura - 50px margens = 175px útil
- Altura texto: 742px
- Máx caracteres: ~600 (coluna estreita, ~15 chars/linha)

### Sidebar PEQUENA (225px) + coluna texto
- Sidebar: 225px largura
- Coluna texto: 370px largura - 20px - 50px = 300px útil
- Altura texto: 742px
- Máx caracteres: ~900

### Sidebar FINA (60px) + coluna texto
- Sidebar: 60px
- Coluna texto: 535px - 30px - 50px = 455px útil
- Altura texto: 742px
- Máx caracteres: ~1100

### Citação destaque (teal full, texto grande)
- Texto 36px com LH 130% = 47px/linha
- Altura disponível: ~500px (com aspas e margem)
- Máx: ~10 linhas × ~20 chars = ~200 caracteres

### Frase de impacto (48px)
- ~7 linhas disponíveis
- Máx: ~150 caracteres

## REGRA DE OVERFLOW: O que fazer quando o texto excede o limite

1. O sistema DEVE verificar o tamanho do texto ANTES de renderizar
2. Se excede: criar nova página de continuação com layout `A4_2_continuacao`
3. A continuação herda o capítulo (capitulo_seq) mas NÃO tem título próprio
4. Barra teal fina (6px) no topo e rodapé identifica visualmente

## REGRA DE PREENCHIMENTO: O que fazer quando sobra espaço em branco

Se a página tem mais de 30% de espaço vazio no corpo:
1. Verificar se há `citacao` não usada → adicionar como bloco de citação
2. Verificar se há `itens` não usados → adicionar como passos numerados
3. Verificar se há `destaques` → adicionar como callout teal
4. Se nada disso existe → o content-agent DEVE gerar mais texto para preencher
5. Última opção: reduzir budget da página anterior para empurrar texto para esta

## REGRA DO CONTENT-AGENT: Gerar texto na medida certa

O content-agent DEVE gerar:
- Mínimo 220 palavras por página (modo resumido: 180)
- Máximo 400 palavras por página (modo completo: 350 para sidebar)
- Cada parágrafo: 3-5 frases
- Cada página: 2-4 parágrafos
- Campos opcionais que ajudam a preencher: itens (3-4), destaques (1-2), citacao (1)
