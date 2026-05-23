# Deploy — Sistema ROF™

## Pré-requisitos
- Conta gratuita no [Supabase](https://supabase.com)
- Conta gratuita no [Netlify](https://netlify.com)
- Conta gratuita no [GitHub](https://github.com)
- Chave da [Anthropic API](https://console.anthropic.com) (para Júlia IA)

---

## PASSO 1 — Configurar o Supabase

> **Supabase já criado:** `https://dhgfoxdxihjkhzmctaea.supabase.co`
> Pule para **1.2** se o schema ainda não foi aplicado.

### 1.1 Criar projeto (já feito)
1. Acesse [supabase.com](https://supabase.com) → **New project**
2. Nome: `sistema-rof`
3. Database Password: anote em local seguro
4. Region: `South America (São Paulo)`
5. Clique **Create new project** (aguarda ~2 min)

### 1.2 Aplicar o schema
1. No painel Supabase → **SQL Editor** → **New query**
2. Cole o conteúdo de `supabase/schema.sql`
3. Clique **Run** (deve retornar "Success")

### 1.3 Criar bucket de arquivos
1. Vá em **Storage** → **New bucket**
2. Nome: `rof-files`
3. **Public bucket**: marcar como SIM (fotos precisam de URL pública)
4. File size limit: `10 MB`
5. Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif, application/pdf`
6. Clique **Create bucket**

### 1.4 Anotar as credenciais
Vá em **Settings → API**:
- `Project URL` → será a `SUPABASE_URL`
- `service_role` (secret) → será a `SUPABASE_SERVICE_KEY`

---

## PASSO 2 — Subir para o GitHub

No terminal (dentro da pasta `C:\ROF system`):

```bash
git init
git add .
git commit -m "feat: sistema ROF™ — versão web com Supabase + Netlify"
```

Crie um repositório privado em github.com e siga as instruções:
```bash
git remote add origin https://github.com/SEU_USUARIO/sistema-rof.git
git branch -M main
git push -u origin main
```

---

## PASSO 3 — Deploy no Netlify

### 3.1 Conectar repositório
1. Acesse [netlify.com](https://netlify.com) → **Add new site → Import an existing project**
2. Escolha **GitHub** → autorize → selecione o repositório `sistema-rof`
3. Build settings (já configurados pelo `netlify.toml`):
   - Build command: `npm install`
   - Publish directory: `.`
4. Clique **Deploy site** (primeiro deploy sem variáveis — vai falhar, isso é esperado)

### 3.2 Configurar variáveis de ambiente
1. No painel Netlify → **Site configuration → Environment variables**
2. Clique **Add a variable** para cada uma:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJhbGciOi...` (service_role key) |
| `JWT_SECRET` | Gere uma string aleatória forte (ex: `openssl rand -hex 32`) |
| `APP_PASSWORD` | `rof2024` (ou outra senha que preferir) |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` (da Anthropic Console) |

### 3.3 Redesploar
1. Após salvar as variáveis → **Deploys → Trigger deploy → Deploy site**
2. Aguarde o build completar (~30-60 segundos)
3. Acesse a URL fornecida pelo Netlify (ex: `https://sistema-rof.netlify.app`)

---

## PASSO 4 — Primeiro acesso

1. Acesse a URL do seu site
2. Na tela de login, use a senha definida em `APP_PASSWORD` (ex: `rof2024`)
3. O sistema vai sincronizar os dados com o Supabase automaticamente
4. O indicador **"● Nuvem"** (verde) aparece na barra lateral quando sincronizado
5. Quando offline aparece **"○ Offline"** — os dados ficam salvos localmente e sincronizam quando a internet voltar

---

## PASSO 5 — Migrar dados existentes (opcional)

Se você já usou o `Sistema-ROF.html` localmente e tem dados no navegador:

1. Abra o `Sistema-ROF.html` no mesmo navegador onde usava
2. Abra o DevTools (F12) → Console
3. Execute para exportar:
```javascript
console.log(JSON.stringify({
  pts: JSON.parse(localStorage.getItem('rof_pts')||'[]'),
  apts: JSON.parse(localStorage.getItem('rof_apts')||'[]'),
  stk: JSON.parse(localStorage.getItem('rof_stk')||'[]'),
  procs: JSON.parse(localStorage.getItem('rof_procs')||'[]'),
  caixa: JSON.parse(localStorage.getItem('rof_caixa')||'[]')
}));
```
4. Copie o JSON resultante
5. No Supabase → **SQL Editor**, execute um INSERT para cada coleção:
```sql
INSERT INTO rof_store (key, data) VALUES ('rof_pts',  '[ JSON_DE_PACIENTES ]') ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO rof_store (key, data) VALUES ('rof_apts', '[ JSON_DE_AGENDA ]')    ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO rof_store (key, data) VALUES ('rof_stk',  '[ JSON_DE_ESTOQUE ]')   ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO rof_store (key, data) VALUES ('rof_procs','[ JSON_DE_PROCS ]')     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO rof_store (key, data) VALUES ('rof_caixa','[ JSON_FINANCEIRO ]')   ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data;
```

---

## Domínio personalizado (opcional)

1. No Netlify → **Domain management → Add custom domain**
2. Ex: `sistema.clinicaROF.com.br`
3. Configure o DNS no seu provedor apontando para o Netlify
4. O certificado SSL é automático e gratuito

---

## Limites do plano gratuito

| Serviço | Limite Free | Estimativa para ROF |
|---------|------------|---------------------|
| Netlify Functions | 125.000 invocações/mês | ~5.000 ações/mês ✓ |
| Netlify Bandwidth | 100 GB/mês | Suficiente ✓ |
| Supabase DB | 500 MB | ~200 pacientes com fotos ✓ |
| Supabase Storage | 1 GB | ~500 fotos clínicas ✓ |
| Anthropic API | Pay-as-you-go | ~$0,01/mensagem Júlia |

---

## Suporte
Em caso de dúvidas, abra o DevTools (F12) → Console para ver mensagens de erro detalhadas.
