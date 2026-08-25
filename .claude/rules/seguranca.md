# Segurança — banco, auth, permissão e dado pessoal

Regras R5–R7. Contexto em `docs/superpowers/specs/2026-08-25-arquitetura-fundhub-design.md`.

## R7 — O repositório é PÚBLICO

Nunca entra no Git, em hipótese alguma:

- **Dado real de pessoa** — nome de servidor, e-mail, telefone, CPF, nº de processo, matrícula.
  Vale para código, **comentário**, documentação, exemplo, placeholder e fixture de teste.
- **Dado real de escola** — quando identificar uma unidade específica com dados de contato.
- **Seed** — fica em `_private/` e `data/*.json`, ambos gitignored.
- **Segredo** — `sb_secret_…`, `service_role`, qualquer token ou senha. **Nunca pedir essa chave.**
  Se alguém pedir, a resposta é não. Seeds rodam no SQL Editor do painel.

Ao escrever exemplo ou placeholder, invente: `(00) 00000-0000`, `nome@exemplo.com`, `Escola Exemplo`.

**Antes de todo commit:** `git diff --cached` procurando dado real.
O script `verificar_arquitetura.py` faz uma varredura mecânica (segredo, e-mail institucional,
telefone, CPF) — mas ele não substitui a leitura do diff.

**A chave publishable (`sb_publishable_…`) em `src/core/config.js` é pública por design** e pode
ficar no repositório. Ela não é senha, é identificador de projeto — é enviada ao navegador de todo
mundo, sempre. Quem protege os dados é o RLS.

## R6 — RLS é a barreira; o front é conforto

**As três barreiras, em ordem:**

1. **Domínio institucional** — só entra `@educacao.pmrp.sp.gov.br` (`is_institucional()`).
2. **Allowlist** — o e-mail precisa estar na tabela `perfil` (`is_autorizado()`).
3. **Nível por módulo** — mapa `papel × módulo → nível` vindo do banco (`meu_mapa_permissoes`,
   migration 021). Níveis: `oculto` · `proprios` · `leitura` · `escrita`.

**Nenhuma policy concede acesso a `anon`.** Deslogado não lê absolutamente nada — é o comportamento
desejado, não um bug.

**Acesso externo sem login (professor por token, portal do proponente) só por Edge Function**
com service role validando o token, nunca relaxando RLS para `anon`. É o ponto de maior risco do
roadmap: uma policy `anon` "só nessa tabela" expõe dado pessoal da rede inteira. Desenhar com
cuidado e revisar antes de subir.

**Esconder botão não é segurança.** `core/permissoes.js` decide o que **aparece**; o RLS decide o
que a pessoa **consegue ler**. A checagem no front é redundante de propósito — se o front deixar
passar, o banco recusa. Se os dois discordarem, o banco vence.

Onde a permissão é consultada no front:
- `core/perfil.js` — fonte única do perfil e do mapa;
- `core/router.js` — barra rota de módulo `oculto` (com a mesma mensagem de "não existe", para não
  confirmar a existência do módulo a quem não tem acesso);
- cada view — recebe `ctx.perfil` e esconde os controles de escrita.

## R5 — XSS

As telas montam HTML com template literals. **Todo valor vindo do banco passa por `esc()`**
(`shared/dom.js`) antes de ser interpolado — inclusive campos que "só têm número", porque o cadastro
é livre e qualquer admin digita o que quiser.

Não existe exceção por tipo. Se o valor veio do banco ou do usuário, ele é escapado.

Atenção especial a atributos: `title="${esc(x)}"`, `data-id="${esc(x)}"`, `href="tel:${...}"`.

## Checklist de migration

Toda tabela nova, na mesma migration:

1. `create table` + `enable row level security`;
2. policy de **select** por `is_autorizado()` (ou a função de nível do módulo);
3. policy de **escrita** por `is_admin()` / a função de nível correspondente;
4. `grant` para o papel `authenticated`;
5. religar o **trigger de auditoria** e acrescentar a tabela ao array da `019`;
6. tornar a migration **idempotente** (`if not exists`, `on conflict do nothing`).

Migrations são aplicadas **à mão, em ordem numérica**, pelo SQL Editor do painel. Não há ferramenta
de migração automática — por opção; o volume não justifica.

**Módulo que depende de migration ainda não rodada deve degradar, não quebrar a tela.**
Tabela ausente = Postgres `42P01`; coluna ausente = `42703`. Ver `telefones.model.js`,
`locais.model.js` e `afastamentos.model.js`.

## Auditoria

Toda alteração de cadastro é registrada por **trigger no Postgres** (`fn_audit`, migration 011) —
antes, depois e diff campo a campo. Nunca por código de tela: assim é automático e à prova de
bypass (alteração por SQL direto também fica registrada).

Ninguém escreve no `audit_log` — não há policy de insert/update/delete. Auditoria que se apaga não
é auditoria.

## CSRF

**Não se aplica** a esta arquitetura, e não deve ser implementado. O Supabase autentica por JWT no
header `Authorization`, não por cookie de sessão — não há credencial ambiente que um site terceiro
possa fazer o navegador enviar. Acrescentar token CSRF aqui seria cerimônia sem ameaça
correspondente.
