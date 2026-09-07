# Registros e logs — design

> Data: 07/09/2026 · Status: aprovado para implementação
> Regras afetadas: R1, R2, R6, R7, R11, R15

## O problema

O FundHub já registra **mudança de dado** desde a migration 011: um trigger genérico
no Postgres grava, para toda escrita em tabela de cadastro, o que era antes, o que
ficou depois e o diff campo a campo. Isso funciona e não muda aqui.

Faltam três coisas:

1. **Evento de aplicação não é mudança de tabela** e por isso não deixa rastro:
   quem entrou, quem exportou uma lista, quem teve acesso negado.
2. **A cobertura da auditoria depende de disciplina humana.** A lista de tabelas
   auditáveis é um array escrito à mão, redeclarado em 011 → 019 → 026. Esquecer de
   acrescentar uma tabela falha em silêncio — e já falhou: `papel` e
   `papel_permissao` não estão auditadas, ou seja, mudar o que um papel pode fazer
   não deixa rastro nenhum.
3. **O leitor mora no lugar errado.** A aba "Auditoria" está dentro de
   Usuários & Acessos, acoplada por acidente histórico à gestão da allowlist.

## Restrição que governa o desenho

Supabase no plano gratuito: **500 MB de banco**, 5 GB de egress/mês, sem backup.
Estourar o limite derruba o serviço inteiro (402 até virar o mês), não só o log.

Estimativa atual: `audit_log` cresce ~0,5–2 KB por registro (guarda a linha inteira
antes e depois, comprimida pelo TOAST). Num dia movimentado da gerência, algumas
centenas de escritas → ordem de 100–200 MB/ano no pior caso. Eventos de aplicação
são bem mais leves (~200–400 bytes) mas podem ter volume maior.

Conclusão: **retenção é parte do desenho, não um cuidado posterior.**

## Decisões

### D1 — Duas tabelas, não uma

O que garante a integridade do `audit_log` hoje é a ausência de policy de INSERT:
**ninguém escreve, nem admin**; só o trigger `SECURITY DEFINER` entra. Se o front
gravasse eventos de aplicação na mesma tabela, seria preciso abrir insert para
`authenticated` — e qualquer usuário poderia forjar linha de auditoria. Isso
contaminaria a prova.

| | `audit_log` (existe) | `evento_log` (novo) |
|---|---|---|
| Registra | mudança de dado (INSERT/UPDATE/DELETE) | evento de aplicação |
| Escreve | só o trigger `fn_audit()` | só a função `registrar_evento()` |
| Forma | `dados_antes` / `dados_depois` / `alteracoes` | `tipo` + `contexto` pequeno |
| Retenção | 730 dias | 180 dias |
| Lê | `is_admin()` | `is_admin()` |

Volume e vacuum também ficam isolados, o que é bônus — mas a razão é a de segurança.

### D2 — Quatro tipos de evento, lista fechada

`acesso` · `exportacao` · `permissao` · `acesso_negado`

O enum é validado **dentro** de `registrar_evento()`: o front não inventa tipo, e um
erro de digitação estoura na hora em vez de virar lixo silencioso.

Ficaram de fora, deliberadamente: notificação enviada e sincronização de
afastamentos. Entram quando houver necessidade concreta (regra de três).

O erro clássico neste tipo de sistema é instrumentar demais — cada navegação, cada
filtro — e explodir o volume. A lista curta é o desenho, não uma etapa inicial.

| Tipo | Dispara em | `contexto` |
|---|---|---|
| `acesso` | `core/perfil.js`, junto do `registrar_acesso()` que já existe — só em sessão nova, nunca em renovação de token | `{}` |
| `exportacao` | onde houver botão de exportar lista | `{lista, formato, linhas}` |
| `permissao` | ao salvar mudança de papel/nível em `usuarios` | `{alvo, de, para, modulo?}` |
| `acesso_negado` | `core/router.js`, ao barrar rota `oculto` | `{rota}` |

Hoje não existe exportação no FundHub: o gancho de `exportacao` nasce junto com a
primeira feature que exporte. O tipo já existe para que ela não tenha desculpa.

`permissao` duplica em parte o que o `audit_log` grava (a linha de `perfil` /
`papel_permissao`). Não é redundância acidental: o `audit_log` guarda o diff cru,
o evento guarda a **frase legível** que um admin lê sem traduzir uuid.

### D3 — O front nunca espera o log

```js
sb().rpc('registrar_evento', { p_tipo: 'exportacao', p_contexto: {...} });
// sem await — se falhar, falha calado
```

Log é observabilidade, não caminho crítico. Nenhuma tela fica mais lenta por causa
dele, e nenhuma ação do usuário falha porque o log falhou.

### D4 — `autor` e `criado_em` são da função, não do app

`registrar_evento()` é `SECURITY DEFINER` e preenche `autor` com `auth_email()` e
`criado_em` com `now()`. O chamador não consegue forjar identidade nem retrodatar.
Mesmo princípio do `fn_audit()`.

### D5 — Auditoria por exclusão, não por inclusão

**Esta é a decisão central.** O array de tabelas auditáveis some. No lugar:

```sql
create or replace function _audit_isentas() returns text[] ...
-- audit_log, evento_log, preferencia_usuario, schema_migrations

create or replace function religar_auditoria() returns int ...
-- religa trg_audit em TODA tabela base de `public` que não esteja isenta
```

O padrão passa a ser **auditado**. Esquecer significa auditar demais, nunca de
menos — a falha vira ruído visível em vez de buraco invisível. Tabela nova entra
sozinha na próxima execução de `religar_auditoria()`.

Efeito imediato: `papel` e `papel_permissao` passam a ser auditadas.

Risco assumido: uma tabela futura de alto volume precisa ser acrescentada a
`_audit_isentas()`, senão infla o `audit_log`. É um esquecimento que **aparece** (o
banco cresce, o painel de saúde mostra), ao contrário do esquecimento anterior.

A instrução em `modulo-novo.md` deixa de ser "acrescente ao array da 019" e passa a
ser uma linha: `select religar_auditoria();`.

### D6 — 13ª checagem no verificador

Espelha a isenção do SQL e cobra o que sobra:

| | Situação | Severidade |
|---|---|---|
| a | tabela criada em migration, não isenta, sem cobertura | bloqueia |
| b | tabela auditada sem rótulo em `TABELAS` | aviso |
| c | `_audit_isentas()` no SQL diverge da lista da checagem | bloqueia |

(c) existe porque duas listas que devem concordar e não são conferidas sempre
divergem. Sem ela, a checagem envelheceria em silêncio — o mesmo mal que ela cura.

Sem skill dedicada: a disciplina de auditoria nunca falhou por falta de aviso, e
sim por falta de mecanismo. A checagem transforma "disciplina que pode falhar" em
"commit que não passa" — que é o ganho real. Regra de três: skill só se a checagem
se mostrar insuficiente.

### D7 — Módulo próprio `auditoria`

O assunto tem peso próprio; o acoplamento com gestão de usuários é histórico, não
conceitual. `evento_log` é dado próprio dele, então é módulo **completo** — não
agregador.

```
src/modules/auditoria/
  module.js            manifesto · grupo admin · doc: true · config
  auditoria.model.js   leitura do audit_log      ← movido de usuarios/
  eventos.model.js     leitura do evento_log     ← novo
  auditoria.view.js    casca com 2 abas
  views/mudancas.js    ← movido de usuarios/views/auditoria.js
  views/atividade.js   novo
  auditoria.config.js  engrenagem: saúde do log e poda
  auditoria.css        ← regras .au-* movidas de usuarios.css
```

Admin-only sai de graça: nenhum papel recebe `auditoria` no preset, então
`nivel_modulo()` devolve `oculto` para todo não-admin e o roteador barra. É como
`usuarios` já funciona.

Descartada a aba "Acessos" (último acesso por pessoa): `usuarios` já mostra esse
dado e o login passa a aparecer na aba Atividade. Seriam três lugares para o mesmo
fato.

`usuarios` encolhe: sem a segunda aba sobra uma superfície só, a `tabbar` some e
`views/lista.js` (297 linhas) volta para dentro de `usuarios.view.js` (~317 linhas,
dentro do teto de 400 da R11). A pasta `views/` do módulo deixa de existir.

### D8 — Emissor no kernel, leitor no módulo

O emissor precisa estar disponível ao próprio kernel: `core/router.js` emite
`acesso_negado` e `core/perfil.js` emite `acesso`. E o kernel não importa módulo
(R1). Logo:

- `core/eventos.js` — expõe **só** `registrarEvento(tipo, contexto)`. É a API de
  instrumentação, como um logger.
- `modules/auditoria/eventos.model.js` — só leitura.

Não é dono dividido: logger e visualizador de log são coisas diferentes, e o
contrato entre elas é a tabela mais a função. `core/eventos.js` fica em `core/` e
não em `shared/` porque guarda estado de sessão (não emitir `acesso` duas vezes na
mesma sessão) e porque é irmão conceitual de `perfil.js`.

### D9 — Retenção visível, não automática e escondida

`podar_logs(dias_evento int, dias_audit int)`, `SECURITY DEFINER`, só admin.
Padrões: 180 dias para eventos, 730 para auditoria.

Exposta na **engrenagem do módulo** (`auditoria.config.js`), junto da saúde do log:
nº de linhas por tabela, tamanho ocupado, tamanho total do banco contra os 500 MB, e
o botão de podar.

Por que não `pg_cron` como mecanismo principal: poda automática de trilha de
auditoria é uma decisão de política, não de infraestrutura, e apagar prova sem
ninguém ver é o oposto do que uma auditoria deve fazer. O admin vê o número e
decide. `pg_cron` fica documentado como opção para quem quiser automatizar depois.

### D10 — Sem particionamento

Para 500 MB, `delete` por data é mais simples e suficiente. Partição só se um dia
migrar para Pro e o volume justificar — regra de três.

## O que NÃO muda

- `audit_log`, `fn_audit()`, `_audit_campos_ruido()`: nenhuma alteração de esquema.
  Os dados existentes continuam válidos e visíveis.
- `registrar_acesso()` e `perfil.ultimo_acesso`: continuam como estão.
- A forma da tela de auditoria: a view é movida, não reescrita.

## Entregáveis

1. `supabase/migrations/032_registros_e_logs.sql` — `evento_log`,
   `registrar_evento()`, `_audit_isentas()`, `religar_auditoria()`, `podar_logs()`,
   funções de saúde do log; idempotente.
2. `src/core/eventos.js` — o emissor.
3. Ganchos em `core/perfil.js`, `core/router.js`, `usuarios.model.js`.
4. `src/modules/auditoria/` — módulo novo (8 arquivos), registrado em
   `core/registry.js` e com `@import` em `styles/main.css`.
5. `src/modules/usuarios/` — encolhido; `auditoria.model.js`, `views/` e as regras
   `.au-*` removidos.
6. `.claude/scripts/verificar_arquitetura.py` — 13ª checagem.
7. `docs/modulos/auditoria.md` novo; `docs/modulos/usuarios.md` atualizado.
8. `.claude/rules/modulo-novo.md` e `.claude/rules/seguranca.md` — a instrução do
   array vira `select religar_auditoria();`.
9. `CLAUDE.md` — "Doze checagens" → "Treze checagens".
10. `CONFIG.versao` = `0.22.0` + `CHANGELOG.md`.

## Adendo (07/09/2026) — o módulo admin invisível para o admin

Ao subir o módulo, `#/auditoria` respondeu **"Acesso restrito" ao próprio
administrador**. Não era erro do módulo: era um defeito latente no mapa de
permissões, que o primeiro módulo só-de-admin depois de `usuarios` ia
inevitavelmente revelar.

**A causa.** O ramo de admin de `meu_mapa_permissoes()` montava a lista de
módulos assim:

```sql
select distinct modulo from papel_permissao
```

Módulo que **nenhum papel** recebe nunca aparece nessa consulta. Como
`auditoria` é só de admin, ela não estava lá — e o admin, que pode tudo,
recebia `oculto`. `usuarios` só escapava porque estava **escrito à mão** num
literal ao lado. Ou seja: a lista era uma armadilha armada para o próximo.

**A correção errada (migration 033).** Devolver `{"*": "escrita"}`. Funciona,
mas é um **valor-sentinela**: uma chave que não é um módulo, dentro de um objeto
cujo tipo é "módulo → nível". Quem lesse o mapa em outro lugar precisaria saber
de um segredo que o formato não conta. Foi corretamente rejeitada pelo André.

**A correção certa (migration 034).** O fato real nunca foi "existe um módulo
chamado `*`". É que todo sistema de permissão tem um **nível padrão** — o que
vale para módulo sem regra própria. Esse conceito **já existia** no FundHub;
estava escondido num `return OCULTO` dentro de `core/permissoes.js`, ou seja: a
política morava no JavaScript, longe do banco que decide todo o resto.

```json
{ "padrao": "escrita", "modulos": {} }                    ← admin
{ "padrao": "oculto",  "modulos": { "escolas": "leitura" } }
```

O payload passa a se explicar sozinho, e a política "oculto por omissão" vira
dado do banco — a mesma fonte que manda no resto (R6). Admin não tem lista, e
módulo administrativo novo não precisa de nada.

**A lição, que vale além deste caso:** quando a saída pede um valor especial
dentro de uma estrutura, quase sempre falta um **campo** na estrutura. O
sentinela é o sintoma; o campo ausente é a doença. Aqui o campo era `padrao`, e
ele já vivia escondido no código — como costuma acontecer.

`definirMapa()` aceita os três formatos (034, o sentinela da 033 e o plano
anterior) porque migrations são aplicadas à mão: entre o deploy do JS e a
execução do SQL o banco ainda responde no formato velho. Nível desconhecido cai
em `oculto` — falha segura. Verificado nos sete casos, incluindo lixo vindo do
banco.

## Riscos

| Risco | Mitigação |
|---|---|
| Migration aplicada à mão; janela entre deploy e SQL | Módulo degrada: `42P01` na leitura de `evento_log` mostra estado vazio com aviso; `registrarEvento` falha calado |
| `religar_auditoria()` auditar tabela de alto volume por engano | Painel de saúde mostra crescimento; `_audit_isentas()` é a válvula |
| Poda apaga prova por engano | Só admin, confirmação explícita, padrões conservadores (730 dias na auditoria) |
| Evento com PII no `contexto` | Convenção documentada: `contexto` guarda metadado (quantidade, formato, alvo), nunca conteúdo |
