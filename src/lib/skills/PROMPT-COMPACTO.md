# PROMPT COMPACTO — Reduzir tokens do content-agent

## Princípio: Dizer mais com menos

O content-agent recebe um system prompt de ~5K tokens.
Muitas instruções são redundantes ou podem ser compactadas.

## Campos que o content-agent DEVE gerar por página

```json
{
  "titulo_bloco": "Título curto do assunto (max 8 palavras)",
  "subtitulo": "Frase complementar (max 12 palavras)",
  "bloco_principal": "Texto corrido com mínimo 220 palavras...",
  "itens": ["3-4 frases curtas acionáveis"],
  "destaques": ["Frases para callouts/faixas teal"],
  "citacao": "Trecho marcante diferente do corpo",
  "sugestao_imagem": "Descrição em PT para foto profissional (se aplicável)"
}
```

## Campos que NÃO precisa gerar (o sistema adiciona programaticamente)

- layout_tipo → determinado pelo conteúdo
- cor_fundo_* → fixo VTSD
- cor_texto_* → fixo VTSD
- icone_sugerido → fixo 'article'
- proporcao_colunas → fixo '60/40'
- usar_barra_lateral → determinado pelo layout
- usar_faixa_decorativa → determinado pelo layout

## Economia estimada

- Design-agent eliminado para VTSD: -8K tokens (~30% do total)
- Prompt compactado: -2K tokens (~10%)
- Image refinement eliminado: -2K tokens (~10%)
- **Total: ~50% menos tokens, ~50% mais rápido**
