# MAPEAMENTO CONTEÚDO → TEMPLATE VISUAL

## Regra: O conteúdo determina o layout automaticamente

O sistema analisa o conteúdo de cada página e seleciona o template do Figma mais adequado.
NÃO precisa de IA para decidir layout — é determinístico.

## Tabela de mapeamento

| Conteúdo da página | Template selecionado | Por quê |
|---|---|---|
| Primeira página do capítulo | A4_1_abertura | Header teal grande com título |
| Página com 3+ itens/etapas | A4_3_sidebar_steps | Sidebar teal com passos numerados |
| Página com gráfico/tabela/imagem | A4_4_magazine | Área visual + texto + conceito |
| Página com destaques + citação | A4_2_conteudo_misto | Callout topo + corpo + callout base |
| Página de texto corrido | A4_7_sidebar_conteudo | Sidebar 225px + corpo rico |
| Página de continuação | A4_2_continuacao | Barra teal topo/base + texto |

## Regra de anti-repetição

Nunca usar o mesmo layout em páginas consecutivas.
Se o mapeamento daria o mesmo layout, trocar para o próximo da sequência randomizada.

## Sequência de fallback (quando conteúdo não é claro)

A sequência é randomizada (Fisher-Yates shuffle) a cada geração:
[A4_1_abertura, A4_2_conteudo_misto, A4_3_sidebar_steps, A4_4_magazine, A4_7_sidebar_conteudo]

## Cores (VTSD — sempre fixas, sem decisão de IA)

```
cor_fundo_principal: #FFFFFF
cor_fundo_destaque: #025468
cor_texto_principal: #383838
cor_texto_destaque: #FFFFFF
icone_sugerido: 'article'
proporcao_colunas: '60/40'
```
