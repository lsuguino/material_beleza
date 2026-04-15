# REGRAS DO MATERIAL — O que DEVE ter

## Identidade Visual (Curso VTSD — Venda Todo Santo Dia)

### Tipografia obrigatória (escala Perfect Fourth 1.333)
- **Display** — Sora Bold 96px, LH 100% — número decorativo de capítulo (01, 02...)
- **H1** — Sora Bold 32px, LH 110% — título de página/capítulo
- **H2** — Sora Bold 22px, LH 120% — subtítulo, seção, sidebar (usar em sidebars ≤250px)
- **H3** — Sora Bold 16px, LH 130% — card title, conceito, etapa
- **Body** — Inter Regular 13px, LH 170% — texto principal de corpo
- **Label** — Inter Semi Bold 11px, LH 140% — overline, tags, letter-spacing 1px
- **Quote** — Inter Italic 13px, LH 170% — citações em bloco
- **Badge** — Inter Semi Bold 11px — número da página

### Cores obrigatórias
- Teal Dark: #025468 (headers, sidebars, callouts)
- Teal Accent: #0599A8 (badges, destaques, ícones)
- Cyan Light: #5DECF2 (subtítulos sobre teal, labels)
- Dark Text: #1A1A1A (títulos sobre branco)
- Gray Text: #666666 (corpo de texto)
- White: #FFFFFF (fundo de página, texto sobre teal)
- Light BG: #F5F5F5 (cards, áreas de destaque)

### Espaçamentos obrigatórios
- Margem lateral: 50px em ambos os lados
- Margem topo: 50px (conteúdo começa em y=50px)
- Margem base: 50px (conteúdo termina em y=792px)
- Espaço entre blocos: 20px
- Espaço título→corpo: 12px
- Espaço entre itens de lista: 16px

### Badge de página
- Tamanho: 40×36px
- Cor: #0599A8 com texto branco
- Posição: centralizado, colado na borda inferior
- Arredondamento: 8px no topo, reto na base
- Presente em TODAS as páginas de miolo

## Estrutura do Material

### Sequência obrigatória de páginas
1. **Capa** — fixa, SVG do VTSD
2. **Boas-Vindas** — fixa, texto institucional VTSD
3. **Sumário** — gerado automaticamente com capítulos
4. **Abertura de capítulo** — para cada novo assunto
5. **Páginas de miolo** — conteúdo variado
6. **Contra-Capa** — fixa, texto de encerramento VTSD

### Cada página de miolo DEVE ter
- Header teal com título OU sidebar teal OU barra lateral colorida
- Texto formatado com hierarquia visual (H1, H2, H3, Body)
- Badge de número de página no rodapé
- Margens respeitadas (50px em todos os lados)
- overflow: hidden para não vazar conteúdo

### Variação visual obrigatória
- NUNCA repetir o mesmo layout em 2 páginas consecutivas
- Usar NO MÍNIMO 3 layouts diferentes a cada material gerado
- Alternar entre: sidebar, full-width, duas colunas, magazine
- A cada geração, a sequência de layouts deve ser DIFERENTE (randomizada)
- Inserir pelo menos 1 página de destaque (citação, nota, frase) a cada 4 páginas

### Imagens
- Máximo 2 imagens por material
- Estilo: fotografia profissional realista (não ilustrações)
- Sem molduras, sem bordas — imagem preenche todo o quadro (object-cover)
- Prompt em português
- Geradas via Nano Banana (OpenRouter primário, Gemini fallback)

### Conteúdo textual
- Fidelidade 100% ao VTT/texto original
- Texto corrido em parágrafos desenvolvidos (não bullet points)
- Mínimo 220 palavras por página (modo completo: 300)
- Citações em Inter Italic com barra lateral teal
- Itens numerados com círculos teal (máximo 4 por página)
- Destaques em callouts teal (faixas escuras com texto branco)

## Layouts disponíveis (renderizadores implementados)

| Layout | Visual | Quando usar |
|--------|--------|-------------|
| A4_1_abertura | Header teal grande + corpo abaixo | Abertura de capítulo |
| A4_2_conteudo_misto | Callout topo + corpo + citação + callout base | Teoria + prática |
| A4_3_sidebar_steps | Sidebar teal 370px + passos numerados | Processos, tutoriais |
| A4_4_magazine | Título + imagem/gráfico + conceito-chave | Dados visuais |
| A4_7_sidebar_conteudo | Sidebar 225px + corpo + pullquote + steps | Conteúdo rico |
