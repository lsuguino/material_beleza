# PROIBIÇÕES DO MATERIAL — O que NÃO pode acontecer

## Design e Layout

### PROIBIDO: Página branca sem design
- Nenhuma página pode sair sem elementos visuais do design system
- Toda página de conteúdo DEVE ter: header teal, sidebar teal OU barra lateral colorida
- Se o layout não for reconhecido, usar A4_2_conteudo_misto como fallback

### PROIBIDO: Texto corrido puro (sem diagramação)
- Não gerar páginas com apenas parágrafos de texto sem hierarquia visual
- Todo texto deve ter título (H1/H2/H3) antes do corpo
- Não colocar texto diretamente no topo da página sem margem

### PROIBIDO: Repetição de layout
- Nunca usar o mesmo layout_tipo em 2 páginas consecutivas
- Nunca gerar material com menos de 3 layouts diferentes
- Nunca usar a mesma sequência de layouts entre gerações

### PROIBIDO: Label "CONTINUAÇÃO"
- Não exibir a palavra "CONTINUAÇÃO" como título ou label em páginas
- Páginas que continuam um capítulo devem manter a identidade visual do capítulo sem rótulo explícito

### PROIBIDO: Conteúdo fora das margens (REGRA ABSOLUTA)
- ZONA PROIBIDA TOPO: y < 50px — NENHUM conteúdo
- ZONA PROIBIDA BASE: y > 792px — NENHUM conteúdo (reservado para badge)
- ZONA PROIBIDA ESQUERDA: x < 50px (exceto sidebar teal)
- ZONA PROIBIDA DIREITA: x > 545px
- overflow: hidden OBRIGATÓRIO em todos os containers
- Se o texto ultrapassar a área disponível, DEVE ser criada uma nova página

### PROIBIDO: Texto excedendo a área do layout
- Páginas com sidebar 370px: máximo 600 caracteres na coluna de texto
- Páginas com sidebar 225px: máximo 900 caracteres
- Páginas full width com header: máximo 950 caracteres
- Páginas de citação/impacto: máximo 200 caracteres
- bloco_principal NUNCA pode ter mais de 1800 caracteres (~350 palavras)

### PROIBIDO: Páginas com muito espaço em branco
- Se mais de 30% do corpo está vazio, adicionar itens numerados, citação ou destaque
- Toda página DEVE ter bloco_principal + pelo menos 1 elemento complementar

### PROIBIDO: "Dica do Autor" e "Exercício Prático" inventados
- "Dica do Autor" só aparece se o professor deu uma dica EXPLÍCITA na transcrição
- "Exercício Prático" só aparece se o professor propôs um exercício EXPLÍCITO
- Não inventar dicas genéricas como "Reflita sobre como conectar estes conceitos"
- Não inventar exercícios genéricos como "Qual ideia desta página você vai testar primeiro?"
- Se não há dica/exercício na transcrição, o campo destaques deve ser []

### PROIBIDO: Badge com frame na abertura de capítulo
- Páginas de abertura de capítulo (fundo teal escuro) devem ter SÓ o número branco
- Sem retângulo/quadrado teal ao redor do número
- O badge com frame teal só aparece em páginas de miolo com fundo branco

### PROIBIDO: Badge quadrado
- Badge de página DEVE ter arredondamento (8px no topo)
- Badge DEVE estar colado na borda inferior (flush bottom)
- Badge NUNCA dentro da área de conteúdo

## Tipografia

### PROIBIDO: Fontes erradas
- Nunca usar fontes além de Sora (títulos) e Inter (corpo)
- Nunca usar Lora, Lexend, Manrope em materiais A4
- Nunca usar font-size 14px para body (deve ser 13px)
- Nunca usar font-size 40px para H1 (deve ser 32px)
- Nunca usar font-size 20px para H3 (deve ser 16px)
- Nunca usar line-height 15px (deve ser 22px para body)

### PROIBIDO: Texto justificado sem hyphens
- Texto justificado deve SEMPRE ter hyphens: auto
- Evitar rivers (caminhos brancos) no texto justificado

## Imagens

### PROIBIDO: Imagens em inglês
- Prompts de geração de imagem devem ser em português
- Não usar prefixo "Educational illustration" ou termos em inglês

### PROIBIDO: Imagens com molduras
- Não usar rounded-xl, rounded-lg ou qualquer borda arredondada em imagens
- Imagens devem preencher 100% do container (object-cover)
- Sem padding ou margem interna na área de imagem

### PROIBIDO: Mais de 2 imagens por material
- Máximo absoluto: 2 imagens geradas por material
- Priorizar qualidade sobre quantidade

### PROIBIDO: Ilustrações genéricas
- Não gerar ilustrações clipart ou cartoon
- Estilo obrigatório: fotografia profissional realista
- Cenas com pessoas reais em contextos profissionais

## Conteúdo

### PROIBIDO: Inventar dados
- Nunca criar números, estatísticas ou dados não presentes na transcrição
- Gráficos e tabelas devem usar APENAS dados mencionados na aula
- Fluxogramas devem seguir EXATAMENTE as etapas descritas

### PROIBIDO: Transformar teoria em bullet points
- Conceitos e explicações devem ser em parágrafos desenvolvidos
- Campo "itens" limitado a 3-4 frases curtas acionáveis
- Mínimo 85% do texto em parágrafos, não em listas

### PROIBIDO: Páginas vazias ou rasas
- Toda página deve ter mínimo 220 palavras (modo completo: 300)
- Não gerar seções compostas apenas por tópicos
- Não deixar grandes espaços em branco no conteúdo

### PROIBIDO: Duplicar texto entre campos
- "citacao" deve ser diferente de "bloco_principal"
- "itens" não devem copiar parágrafos do corpo
- "destaques" devem ser distintos dos "itens"

## Estrutura

### PROIBIDO: Material sem capa ou contra-capa
- Capa VTSD é obrigatória e fixa
- Contra-capa VTSD é obrigatória e fixa
- Boas-vindas é obrigatória e fixa

### PROIBIDO: Sumário sem correspondência
- Todos os capítulos no sumário devem existir no material
- Números de página no sumário devem ser corretos
