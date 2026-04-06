# Processo — Venda Todo Santo Dia (VTSD)

Documento de referência na raiz do repositório: capa, boas-vindas, design system e variáveis estáticas.

## Curso e design system

- **ID do curso:** `geral` — constante `VTSD_COURSE_ID` em `src/lib/courseThemes.ts`.
- **Detecção:** `isVendaTodoSantoDiaCourse(courseId, temaName?)` — `geral` ou nome contendo “venda todo santo dia”.
- **Tokens e regras A4:** `src/lib/vtsd-design-system.ts` (margens, cores Figma, layouts `A4_*`).
- **Agente de design:** `src/lib/design-agent.ts` usa o bloco VTSD quando `isVendaTodoSantoDiaCourse` é verdadeiro.

## Arte em `public/capas/venda-todo-santo-dia/`

| Ficheiro | Uso |
|----------|-----|
| `capa.svg` | Capa oficial (sem texto dinâmico). Overlay de título/aula no código. |
| `capa-com-informacoes.svg` | Só referência visual de posição do texto. |
| `pagina-boas-vindas.svg` | Página de boas-vindas (fundo; texto em HTML). |
| `pagina-boas-vindas-referencia-com-texto.svg` | Referência com texto diagramado (ficheiro pesado; alinhamento/revisão). |

Constantes em `courseThemes.ts`: `CAPA_PADRAO_VTSD`, `CAPA_VTSD_REFERENCIA_INFORMACOES`, `PAGINA_BOAS_VINDAS_VTSD`, `PAGINA_BOAS_VINDAS_VTSD_REFERENCIA`.

## Fluxo no código

1. **Capa (preview/PDF):** `PageCoverEditorial` (`variant="vtsd"`) — fundo `capa.svg` + texto.
2. **Boas-vindas:** texto fixo em `src/lib/vtsd-fixed-copy.ts`; corpo reutilizável em `src/components/pages/VtsdWelcomeBody.tsx`; `PageIntro` com `vtsdWelcome` + imagem `PAGINA_BOAS_VINDAS_VTSD`; estilos em `src/app/print-editorial.css` (classe `vtsd-welcome-page--svg`).
3. **MaterialViewer (layout livro):** mesma arte e `VtsdWelcomeBody` com `variant="web"`.
4. **API generate-material (material tipo livro):** `VTSD_COVER_IMAGE` aponta para `capa.svg` em `src/app/api/generate-material/route.ts`.

## OpenRouter / ambiente

- Chaves: `OPENROUTER_API_KEY` (normalização e leitura `.env` / `.env.local` em `src/lib/ensure-env.ts` e `src/lib/openrouter-key.ts`).
- Cabeçalhos OpenRouter: `src/lib/openrouter.ts` (`HTTP-Referer`, `X-Title`, `X-OpenRouter-Title`).

## Atualizar arte no futuro

1. Substituir os `.svg` na pasta acima (manter nomes ou atualizar constantes em `courseThemes.ts`).
2. Ajustar overlay em `PageCoverEditorial` / `PageIntro` se mudar a área útil do SVG.
3. Ajustar texto institucional só em `vtsd-fixed-copy.ts` (e, se necessário, espaçamentos em `print-editorial.css`).

---

*Última consolidação: processo VTSD (capa, boas-vindas, DS e caminhos públicos).*
