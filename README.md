# Design Beleza — VTT em material didático

Transforme a transcrição da sua aula (arquivo **VTT**) em uma **apostila de estudo** com resumo completo e design de alto nível. Ideal para produtores de conteúdo que querem atualizar e simplificar seus materiais.

## O que o app faz

1. **Upload de VTT** — Você envia o arquivo de legenda/transcrição (.vtt).
2. **Resumo didático** — A IA gera um material completo (não ultra-curto): você consegue ler e aprender tudo que foi dito na aula em menos tempo.
3. **Apostila com design de alto nível** — Layout editorial, tipografia cuidada, pontos-chave, listas e sugestões de gráficos/imagens quando fizer sentido.
4. **Imprimir / PDF** — Botão para imprimir ou salvar como PDF.

## Como rodar

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Crie um arquivo `.env.local` na raiz do projeto com sua chave da Anthropic (Claude):
   ```
   ANTHROPIC_API_KEY=sua-chave-aqui
   ```
   (Obtenha em [console.anthropic.com](https://console.anthropic.com/) → API Keys.)

3. Inicie o servidor:
   ```bash
   npm run dev
   ```

4. Acesse [http://localhost:3000](http://localhost:3000), envie um arquivo .vtt e aguarde a geração do material.

## Estrutura do material gerado

- **Título e resumo** da aula  
- **Seções** organizadas por tema  
- **Parágrafos**, **listas**, **pontos-chave** e **citações**  
- **Placeholders para imagens/gráficos** quando a IA sugerir (com descrição e prompt para geração futura)

## Tecnologias

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Anthropic API** (Claude) para resumo e estruturação do material

---

Feito para produtores que querem materiais simplificados e com visual profissional.
