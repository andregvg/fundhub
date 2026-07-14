# FundHub — Configuração e Segurança do Supabase

Projeto: `uwkroffzjyzbjslepjnh` · API: `https://uwkroffzjyzbjslepjnh.supabase.co`

## Modelo de segurança (por que nada vaza)

- **RLS (Row Level Security) em todas as tabelas, _default-deny_.** Sem policy, ninguém lê nada.
- **Nenhum acesso anônimo.** Toda leitura exige sessão autenticada com e-mail `@educacao.pmrp.sp.gov.br` (`is_institucional()`). A `anon key`, mesmo sendo pública, não devolve dado nenhum sem login.
- **Escrita só para admin** (`is_admin()`, via tabela `perfil`).
- **`service_role key` nunca é usada no front nem versionada.** Só no painel (SQL Editor) ou no seu PC. Nunca compartilhe essa chave.
- Dados pessoais de servidores só são visíveis para usuários institucionais logados (nunca via `anon`).

## Passo a passo (você, no painel do Supabase)

### 1. Criar as tabelas e políticas
SQL Editor → cole e rode **`supabase/schema.sql`** (deste repositório).

### 2. Carregar os dados (seed) — sem versionar nada
O seed fica **fora do repositório** (é dado sensível). No seu PC ele está em
`_private/seed_unidades.sql` (gerado localmente, gitignored).
SQL Editor → cole o conteúdo desse arquivo e rode. Ele bypassa o RLS por ser
executado como `service_role` no editor.

### 3. Cadastrar você como admin
SQL Editor → rode (troque pelo seu e-mail institucional):
```sql
insert into perfil (email, nome, papel)
values ('SEU.EMAIL@educacao.pmrp.sp.gov.br', 'André', 'admin_sme')
on conflict (email) do update set papel = 'admin_sme', ativo = true;
```

### 4. Configurar a autenticação (magic link)
Authentication → **Providers → Email**: mantenha habilitado.
Authentication → **URL Configuration**:
- **Site URL:** `https://andregvg.github.io/fundhub/`
- **Redirect URLs:** adicione `https://andregvg.github.io/fundhub/**`
  (e, para testes locais, `http://127.0.0.1:*/**`).

> Observação: o e-mail padrão do Supabase tem limite baixo de envios/hora.
> Para uso real, configure um SMTP próprio em Authentication → SMTP.

### 5. Conectar o front
Project Settings → **API** → copie a **anon public** key para
`assets/js/config.js` (`supabaseAnonKey`). A URL já está preenchida.
Ao publicar, o app passa a exigir login institucional e lê os dados via RLS.

## Login com Google (opcional, além do magic link)

Para habilitar o botão "Entrar com conta Google":
1. **Google Cloud Console** → crie um *OAuth 2.0 Client ID* (tipo *Web application*).
   - *Authorized redirect URI:* `https://uwkroffzjyzbjslepjnh.supabase.co/auth/v1/callback`
2. **Supabase → Authentication → Providers → Google:** habilite e cole o *Client ID* e *Client secret*.
3. Pronto — o botão já existe no app. O login Google não substitui o magic link; os dois convivem.

> Restrição de acesso: mesmo entrando por Google, só lê quem estiver na allowlist
> (`perfil`). O parâmetro `hd` apenas sugere ao Google a conta do domínio.

## Verificação de que está fechado

- Deslogado, a aba Escolas deve aparecer **vazia/entrar em login** — nunca mostrar dados.
- Um e-mail fora do domínio institucional não deve conseguir ler nada (o app recusa no login e o RLS recusa no banco).
