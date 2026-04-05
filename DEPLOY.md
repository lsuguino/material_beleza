# Colocar o site no ar (Vercel)

O projeto já está no GitHub. Siga os passos para deixá-lo online na **Vercel** (grátis e ideal para Next.js).

## 1. Criar conta na Vercel

- Acesse **[vercel.com](https://vercel.com)** e clique em **Sign Up**.
- Faça login com **GitHub** (recomendado).

## 2. Importar o projeto

- No dashboard da Vercel, clique em **Add New…** → **Project**.
- Em **Import Git Repository**, selecione **lsuguino/design_beleza** (ou conecte sua conta GitHub se o repositório não aparecer).
- Clique em **Import**.

## 3. Configurar variáveis de ambiente

Antes de dar **Deploy**, em **Environment Variables** adicione:

| Nome                 | Valor                    | Observação                          |
|----------------------|--------------------------|-------------------------------------|
| `ANTHROPIC_API_KEY`  | sua-chave-anthropic      | Obrigatório (geração de conteúdo)  |
| `OPENAI_API_KEY`     | sua-chave-openai         | Opcional (imagens DALL-E no material) |

- **ANTHROPIC:** [console.anthropic.com](https://console.anthropic.com/) → API Keys.
- **OPENAI:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

Marque para **Production**, **Preview** e **Development** e salve.

## 4. Fazer o deploy

- Clique em **Deploy**.
- Aguarde o build (alguns minutos). Ao terminar, a Vercel mostra uma URL, por exemplo:  
  `https://design-beleza-xxx.vercel.app`

## 5. Usar o site

- Acesse a URL fornecida pela Vercel.
- Faça upload de um VTT, escolha o curso e o modo, e clique em **Geração Inteligente**.
- O material será gerado e poderá ser visto no preview e na página de preview completo.

## Observações

- **PDF (Download PDF):** Em ambiente serverless (Vercel), a geração de PDF via Puppeteer pode falhar. O restante do site (geração de material e preview) funciona normalmente. Para PDF em produção, é possível usar depois um serviço externo ou “Imprimir” no navegador.
- **Atualizações:** Novos pushes na branch `main` do GitHub disparam um novo deploy automático na Vercel.
- **Domínio próprio:** Na Vercel, em **Settings → Domains**, você pode adicionar seu próprio domínio.
