# OTIMIZAÇÃO DE TOKENS — Gerar mais rápido sem perder qualidade

## Princípio: As referências do Figma definem TUDO sobre o visual

O design system já está implementado nos componentes React.
A IA NÃO precisa decidir layout, cores ou tipografia — isso é programático.
A IA só precisa gerar o CONTEÚDO TEXTUAL de qualidade.

## Fluxo otimizado (VTSD)

### ANTES (3+ chamadas de IA):
1. Content-agent (14K tokens) → texto + estrutura
2. Design-agent (8K tokens) → layout + cores ← DESNECESSÁRIO para VTSD
3. Image refinement (2K tokens) → refinar prompts
4. Study questions (2K tokens) → opcional
**Total: ~26K tokens, ~90s**

### DEPOIS (1-2 chamadas de IA):
1. Content-agent (12K tokens) → texto + estrutura
2. Layout selection → PROGRAMÁTICO (0 tokens)
3. Image generation → direto (sem refinamento)
**Total: ~12K tokens, ~40s**

## Como funciona

### Layout selection programático (sem IA)
Para VTSD, o layout é determinado pelo CONTEÚDO:
- Página com `itens` ≥ 3 → `A4_3_sidebar_steps`
- Página com `sugestao_grafico` → `A4_4_magazine`
- Página com `citacao` + `destaques` → `A4_2_conteudo_misto`
- Primeira página de capítulo → `A4_1_abertura`
- Demais → round-robin randomizado dos 5 layouts base

### Cores programáticas (sem IA)
VTSD sempre usa as mesmas cores:
- cor_fundo_principal: #FFFFFF
- cor_fundo_destaque: #025468
- cor_texto_principal: #383838
- cor_texto_destaque: #FFFFFF

### Image prompts diretos (sem refinamento)
O content-agent já gera `sugestao_imagem` em português.
Não precisa de chamada extra para refinar — usar direto.
