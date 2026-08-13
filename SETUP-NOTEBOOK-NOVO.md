# Configurar o Sistema ROF™ em um notebook novo (ex: Avell)

Guia rápido para clonar o código pelo GitHub e rodar o Sistema ROF localmente
no notebook novo, conectado ao **mesmo** Supabase de produção. Como os dados
(pacientes, agenda, estoque, caixa) vivem no Supabase — não no computador — o
notebook novo fica automaticamente sincronizado com o notebook antigo assim
que estiver apontando para o mesmo projeto Supabase.

> Se você só precisa **usar** o sistema (sem editar código), não precisa
> deste guia: basta abrir a URL do site publicado no Netlify pelo navegador
> e fazer login. Este guia é para quem quer rodar o projeto localmente.

---

## Pré-requisitos no notebook novo

- [Git](https://git-scm.com/downloads) instalado
- [Node.js](https://nodejs.org) versão 18 ou superior (o projeto usa Node 20)
- Conta no GitHub com acesso a este repositório
- Conta no Netlify com acesso ao site já publicado (para puxar as variáveis
  de ambiente automaticamente — veja Passo 3)

---

## Passo 1 — Clonar o repositório

```bash
git clone https://github.com/drarobf/Rof-systema.git
cd Rof-systema
```

## Passo 2 — Instalar dependências

```bash
npm install
npm install -g netlify-cli
```

O projeto usa **Netlify Functions** (`netlify/functions/api.js` e `ai.js`)
para falar com o Supabase e com a Anthropic API. Um servidor estático comum
não executa essas funções — por isso é preciso o Netlify CLI (`netlify dev`)
para rodar o site e as funções juntos localmente.

## Passo 3 — Configurar as variáveis de ambiente locais

O projeto precisa de 5 variáveis: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`JWT_SECRET`, `APP_PASSWORD`, `ANTHROPIC_API_KEY`.

**Opção A — puxar direto do Netlify (recomendado, mais simples):**

```bash
netlify login
netlify link
netlify env:pull .env
```

O `netlify link` conecta esta pasta ao site já publicado (escolha o site
`sistema-rof` na lista). O `netlify env:pull` baixa as variáveis reais que já
estão configuradas em produção para um arquivo `.env` local — já está no
`.gitignore`, então nunca vai parar no GitHub.

**Opção B — preencher manualmente**, criando um arquivo `.env` na raiz:

```env
SUPABASE_URL=https://dhgfoxdxihjkhzmctaea.supabase.co
SUPABASE_SERVICE_KEY=... (Supabase → Settings → API → service_role)
JWT_SECRET=... (mesmo valor usado no Netlify)
APP_PASSWORD=... (mesma senha usada para logar no site)
ANTHROPIC_API_KEY=... (Anthropic Console, para a Júlia IA)
```

Os valores de `JWT_SECRET`, `APP_PASSWORD` e `ANTHROPIC_API_KEY` precisam ser
**os mesmos** já usados no Netlify de produção (veja em Netlify → Site
configuration → Environment variables), senão o login local não bate com o
token/sessão esperado.

## Passo 4 — Rodar localmente

```bash
netlify dev
```

Isso sobe o site completo (front-end + funções) normalmente em
`http://localhost:8888`.

## Passo 5 — Login

1. Acesse `http://localhost:8888` no navegador do notebook novo.
2. Faça login com o `APP_PASSWORD`.
3. Os dados de pacientes, agenda, estoque e caixa aparecem automaticamente —
   são os mesmos dados do site publicado, porque ambos leem/escrevem no
   mesmo projeto Supabase.
4. O indicador **"● Nuvem"** (verde) na barra lateral confirma que está
   sincronizado.

---

## Importante

- **Não é um Supabase separado por notebook.** Notebook antigo e notebook
  novo compartilham o mesmo banco — editar um paciente em um aparece no
  outro em poucos segundos (há um throttle de sincronização de ~3 min em
  alguns fluxos, ver `git log`).
- **Nunca commite o arquivo `.env`** nem cole as chaves em código — ele já
  está no `.gitignore` por segurança.
- Para publicar alterações de código feitas localmente, use o fluxo normal:
  `git add`, `git commit`, `git push` para uma branch e abra um Pull
  Request — o Netlify faz o deploy automático a partir do GitHub.
