# Como subir o projeto no GitHub

Siga os passos na ordem. Se algo der erro, veja a seção **Problemas comuns** no final.

---

## 1. Instalar o Git

Se ao rodar `git --version` no CMD der erro "não reconhecido":

- Baixe: **https://git-scm.com/download/win**
- Instale (deixe marcado "Add Git to PATH")
- **Feche e abra de novo** o CMD ou o terminal

---

## 2. Autenticação no GitHub (importante)

O GitHub **não usa mais senha** para push. Você precisa de um **Personal Access Token (PAT)**.

### Criar o token

1. Acesse: **https://github.com/settings/tokens**
2. Clique em **"Generate new token"** → **"Generate new token (classic)"**
3. Dê um nome (ex.: `design-beleza`)
4. Marque a permissão **`repo`** (acesso total a repositórios)
5. Clique em **"Generate token"**
6. **Copie o token** e guarde em lugar seguro (ele não aparece de novo)

### Usar o token

Quando o Git pedir **Password**, **cole o token** (não a senha da sua conta).

Para não digitar sempre, você pode salvar:

```bat
git config --global credential.helper store
```

Depois do primeiro `git push` com o token, ele fica salvo.

---

## 3. Comandos no CMD (copie e cole)

Abra o **CMD** (Win+R → digite `cmd` → Enter) e rode **um bloco por vez**:

```bat
cd /d e:\design_beleza
```

```bat
git init
git branch -M main
```

```bat
git add .
git status
```
(Confira se os arquivos aparecem. Não deve listar .env.local.)

```bat
git commit -m "Design Beleza - versão completa"
```

```bat
git remote add origin https://github.com/lsuguino/design_beleza.git
```
(Se aparecer "remote origin already exists": use `git remote set-url origin https://github.com/lsuguino/design_beleza.git`)

```bat
git push -u origin main
```

Quando pedir **Username**: seu usuário do GitHub (`lsuguino`).  
Quando pedir **Password**: **cole o token** que você criou no passo 2.

---

## 4. Se o repositório já tiver conteúdo (primeira vez unindo)

Se der erro tipo "refusing to merge unrelated histories":

```bat
git pull origin main --allow-unrelated-histories --no-edit
git push -u origin main
```

Se abrir o editor para mensagem de merge: salve e feche (no Vim: `:wq` e Enter).

---

## Problemas comuns

| Erro | O que fazer |
|------|---------------------|
| `git não é reconhecido` | Instale o Git e adicione ao PATH. Feche e abra o CMD. |
| `Authentication failed` ou `Support for password authentication was removed` | Use um **Personal Access Token** no lugar da senha (passo 2). |
| `remote origin already exists` | Rode: `git remote set-url origin https://github.com/lsuguino/design_beleza.git` |
| `failed to push some refs` / `rejected` | Rode primeiro: `git pull origin main --allow-unrelated-histories --no-edit` e depois `git push -u origin main` |
| Abre o Vim e não sai | Digite `:wq` e Enter para salvar e sair. |

---

Repositório: **https://github.com/lsuguino/design_beleza**
