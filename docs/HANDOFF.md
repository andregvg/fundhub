# FundHub — Prompt de Continuação (handoff entre sessões)

> Cole este documento (ou aponte para ele) ao iniciar uma nova sessão para continuar o desenvolvimento do FundHub.

## 1. O que é

**FundHub** — "Hub de Ferramentas do Ensino Fundamental": hub de aplicações gerenciais da Gerência de Ensino Fundamental da SME (Secretaria Municipal da Educação) de Ribeirão Preto. Substitui um mosaico de planilhas Google + Apps Scripts por uma base integrada, com acompanhamento em tempo real das 144 escolas.

- **Repo local:** `C:\Users\andre\Programacao\AppScripts\projects\fundhub`
- **Repo remoto (PÚBLICO):** github.com/andregvg/fundhub
- **Produção (main):** https://andregvg.github.io/fundhub/
- **Dev (branch dev):** https://andregvg.github.io/fundhub/dev/

## 2. Stack e arquitetura

- **Front:** SPA estática (HTML/CSS/JS puro, sem build, roteador por hash `#/rota`), servida pelo **GitHub Pages** sob base `/fundhub` (para migrar a domínio próprio depois — futuro `fundhub.andregvg.com.br` — só reapontando DNS).
- **Back:** **Supabase** (Postgres + Auth + RLS + Realtime + Storage + Edge Functions). Projeto `uwkroffzjyzbjslepjnh` (`https://uwkroffzjyzbjslepjnh.supabase.co`). Chave publishable já no `src/core/config.js` (é pública por design).
- **Arquitetura: fatias verticais (uma pasta por módulo) sobre um kernel.** MVC adaptado — `*.model.js` = Model, `*.view.js` = View, `core/router.js` = Controller. (PSR é PHP-FIG; não se aplica a JS.)

```
src/
├── main.js       bootstrap: gate de login → moldura → roteador → serviços de fundo
├── core/         KERNEL (não conhece módulo algum, só os manifestos)
│   config.js · supabase.js · auth.js · perfil.js · registry.js · router.js
├── shell/        MOLDURA: chrome.js (topo/nav/usuário) · home.js (tiles, gerados do registry)
├── shared/       SEM DOMÍNIO: dom.js · format.js · realtime.js
│                 ui/{drawer,toast,feedback,phones}.js   ← phones = editor de telefones
├── modules/      UMA PASTA POR FERRAMENTA
│   └── <modulo>/ module.js (manifesto) · <modulo>.model.js · <modulo>.view.js · <modulo>.css
│                 views/<aba>.js — só quando o módulo é grande (ver sate/)
└── styles/       main.css (@imports) · tokens.css · base.css · components.css
```

- **Manifesto (`module.js`)** — `{ id, ico, nome, desc, navNome?, rota?, nav?, ativo, admin?, servico?, load() }`.
  A view é carregada sob demanda (`load: () => import('./x.view.js')`, que exporta `render(app, ctx)`).
  Registrar em `core/registry.js` faz o tile, a rota e o item de nav aparecerem sozinhos.
- **Regras de import (o que impede o novelo):**
  1. Kernel não importa módulo (só os `module.js`).
  2. Módulo importa `shared/` e `core/` à vontade.
  3. Módulo pode importar o **model** de outro módulo (é a API pública); **nunca a view**.
  4. Model nunca toca no DOM; view nunca fala com o Supabase.
- **Visual: mobile-first de verdade** — base = celular, `@media (min-width:)` acrescenta. Cortes: 560 / 720 / 900 / 1100px. Navegação vira menu ☰ abaixo de 1100px. Tokens em `styles/tokens.css` — nunca escrever cor fixa num módulo.

## 3. Segurança (REGRAS INVIOLÁVEIS — repo é público)

1. **Nenhum dado sensível ou seed no repositório, em hipótese alguma.** Dados reais só no Supabase. Seeds gerados localmente em `_private/` e `data/*.local.json` (ambos **gitignored**). Sempre conferir `git diff --cached` antes de commitar.
2. **RLS default-deny em todas as tabelas.** Leitura só para quem está na **allowlist** (tabela `perfil`, função `is_autorizado()`); escrita só admin (`is_admin()`). `anon` (deslogado) não acessa nada — isso é o desejado.
3. **`service_role` / `sb_secret_…` nunca no front nem no repo.** Nunca pedir essa chave. Seeds rodam no SQL Editor.
4. Dados pessoais de servidores ficam atrás de autenticação (nunca via `anon`).

## 4. Fluxo de trabalho e deploy

- **Trabalhar sempre na branch `dev`**; validar na URL de dev; só então **merge `dev → main`** para publicar.
- Deploy via GitHub Actions (`.github/workflows/pages.yml`, Pages build_type=workflow): publica `main` na raiz e `dev` em `/dev/`. `concurrency cancel-in-progress: false`.
- **No merge**, os pushes de dev+main disparam 2 runs; se a raiz do main ficar obsoleta, re-disparar: `gh workflow run "Deploy Pages (main + dev)" --ref main`.
- **Teste local sem login** (dev-local): rodar `python -m http.server` na raiz e, para simular admin, editar TEMPORARIAMENTE (e reverter antes do commit):
  - `src/core/config.js`: `supabaseAnonKey` → `''` (ativa modo dev-local, sem gate)
  - `src/core/perfil.js`: no ramo `if (!hasSupabase())` retornar `{ email:'dev@local', papel:'admin_sme', isAdmin:true }`
  - Reverter ambos antes de commitar (conferir que a key voltou e que `dev@local` sumiu de `src/core/`).
- ⚠️ **Armadilha do teste local:** a navegação por hash (`#/x`) **não recarrega os módulos ES** — o browser mantém o `.model.js` que já estava em memória. Depois de editar um model já carregado, dê **`location.reload()`** (F5) antes de testar, senão aparece um enganoso *"does not provide an export named …"* que não existe no código.
- **Módulo novo que depende de migration:** faça a leitura **degradar** em vez de quebrar a tela (tabela ausente = Postgres `42P01`; coluna ausente = `42703`). Ver `telefones.model.js`, `locais.model.js` e `afastamentos.model.js` — assim o módulo continua de pé entre o deploy e o momento em que a migration roda.

## 5. Banco de dados — migrations (rodar no SQL Editor, em ordem)

`… 011_auditoria.sql` → `012_visitas.sql` → `013_atas.sql` → `014_realtime_extra.sql` → `015_projetos.sql` → **`016_telefone.sql`** → **`017_local.sql`** → **`018_afastamento_extra.sql`** → **`019_auditoria_completa.sql`**

> ✅ **Rodadas confirmadas até a 015.**
> ⚠️ **Faltam rodar, em ordem: `016` → `017` → `018` → `019`.** Todas são idempotentes; a 016 e a 017 fazem o **backfill** sozinhas.
> - **016** cria `telefone` e migra os telefones legados; sem ela, Escolas/Gestores carregam mas **sem telefones** (degradam de propósito).
> - **017** cria `local` e vincula os destinos; sem ela, o SATE funciona mas a aba Locais fica vazia.
> - **018** dá `status`/`processo` aos afastamentos; sem ela, o módulo lista normalmente mas **não conhece cancelados** e as escritas avisam "exige a migration 018".
> - **019** é rede de segurança: religa o trigger de auditoria em todas as tabelas auditáveis (idempotente).

Seeds (gitignored, em `_private/` — rodar após as migrations correspondentes):
`seed_unidades.sql`, `seed_atividades.sql`, `seed_calendario.sql`.

> Gerador dos seeds: script Python que lê os TSV/xlsx originais (em Downloads) e escreve em `_private/`. Ver histórico da conversa. NUNCA commitar `_private/`.
> O Calendário agora tem **importação pela tela** (colar TSV/CSV) — não depende mais de gerar seed para atualizar dias.

Tabelas: `regional`, `servidor`, `unidade_escolar`, `vinculo`, `perfil` (com `ultimo_acesso`), **`telefone`**, **`local`**, `atividade_extraclasse`, `oferta_onibus`, `solicitacao_transporte`, `dia_calendario`, `afastamento` (com `status`/`processo`), `horario_bloco`, `ocorrencia`, `relatorio_visita`, `ata_atendimento`, `projeto`, `projeto_interesse`, `audit_log`; view `vw_escola_pessoas` (lê o telefone principal de `telefone`, com fallback no legado); funções `auth_email()`, `is_institucional()`, `is_autorizado()`, `is_admin()`, `fn_audit()` (trigger de auditoria), `registrar_acesso()`, `fn_ata_numero()`.

### Decisões de modelagem (por que assim)

- **Telefones em tabela dedicada** (`telefone`), não em campo/array por entidade: escolas já eram multi (`text[]`), mas servidores tinham **um** telefone — e gestores/coordenadores/supervisores *são* servidores. A tabela usa **duas FKs nullable** (`servidor_id` | `unidade_id`) + CHECK de "exatamente um dono": preserva integridade referencial real e cascade, que um par polimórfico `(tipo,id)` perderia. Como a RLS do FundHub é uniforme (ler = `is_autorizado`, escrever = `is_admin`), a tabela compartilhada **não** complica a RLS. Colunas legadas (`unidade_escolar.telefones/whatsapp`, `servidor.telefone`) estão **deprecadas** — backfilladas uma vez e usadas só como fallback de leitura na view. Drop numa migration futura.
- **Endereços: catálogo só para DESTINOS** (`local`), não uma tabela genérica de endereços. O endereço da **escola é atributo 1:1 intrínseco** — extrair só somaria join sem ganho. Já os destinos são entidade **compartilhada e geocodável**: antes o mesmo lugar era redigitado em cada atividade/solicitação e não dava para geocodar uma vez. É o padrão do `Locais.js` do `agendamentos-fil` e a **fundação do cálculo de rota/tempo** (backlog A).

## 6. O que JÁ está implementado

| Módulo | Status | Observações |
|---|---|---|
| Login | ✅ | Magic link + botão Google (provider Google precisa ser configurado no painel). Restrito a `@educacao.pmrp.sp.gov.br` + allowlist. |
| Dashboard do dia | ✅ | Stats + painéis Extraclasse, Afastamentos **e Calendário** do dia (o placeholder saiu). Compõe os models dos outros módulos; não tem model próprio. |
| Escolas | ✅ | Leitura + busca/filtros + detalhe com equipe gestora + **CRUD admin**. |
| SATE (Transporte) | ⏸️ **PAUSADO** | Funciona: Solicitações, Nova (catálogo **ou** atividade livre, adaptado/cadeirante, cálculo de ônibus, antecedência/mínimo/**bloqueio do calendário**), Frota, Catálogo, **Locais**. **O André pediu para PAUSAR a evolução do SATE** (estava indo em direção diferente da ideal). Não retomar sem o aval dele. |
| **Telefones** | ✅ | **Novo.** Tabela `telefone` (fonte única) + editor reusável `shared/ui/phones.js` com tipo/rótulo/**principal**. Escolas **e** servidores passam a ter vários telefones. Não é rota — é model + componente, consumido por Escolas e Gestores. **Requer `016`.** |
| **Locais (destinos)** | ✅ | **Novo.** Catálogo de destinos (nome, endereço, **ponto de desembarque**, lat/long, maps). Vive como **aba admin dentro do SATE** (não virou rota — a nav já é longa e destino é assunto de transporte). Nova/Catálogo do SATE usam o seletor. **Requer `017`.** |
| Programação de Viagens | ✅ | Confirmadas do dia (origem→destino, horários, alunos, ônibus, contato), imprimível. (NÃO chamar de "romaneio".) Lê de `sate.model.js`; não tem model próprio. |
| **Calendário Escolar** | ✅ **finalizado** | Grade mensal, eventos, bloqueios; admin edita cada dia. **Novo:** edição por **INTERVALO** ("aplicar até" — recesso/feriados/semana de provas de uma vez) e **IMPORTAÇÃO** colando TSV/CSV com cabeçalho (`data`, `letivo`, `tipo`, `evento`, `bloqueia_extraclasse`/`afastamento`, `obs`; datas em `aaaa-mm-dd` ou `dd/mm/aaaa`). Sem migration nova. |
| **Afastamentos** | ✅ **finalizado** | Lista+filtros + CRUD admin. **Novo (do Apps Script `afastamentos-gestores`):** **soft-delete** (`status` ativo\|cancelado — cancelar ≠ excluir; reativar/excluir-definitivo na visão Cancelados), campo **`processo`**, **detecção de duplicata** (servidor+início; processo), **nº de dias**, busca, e **VISÃO CALENDÁRIO** mensal com chips por dia (cor por tipo; só admin edita pelo chip). Integra com o Calendário: **avisa** ao gravar em dia marcado "não conceder afastamentos". **Requer `018`.** |
| Notificações | ✅ | Realtime (sino + badge + toasts) para solicitações. É um **serviço** (`servico: true`): sem rota, iniciado pelo `main.js` no login, parado no logout. |
| **Gestores & Coordenadores** | ✅ | **Novo.** Rota `#/gestores`. CRUD de `servidor` + CRUD de `vinculo` (servidor × escola × papel × ano). Busca (inclusive por nome de escola), filtros por papel e “sem vínculo”. Encerrar vínculo (preserva histórico) ≠ excluir. Sem migration nova — usa o `schema.sql`. |
| **Horários de Trabalho** | ✅ | **Novo.** Rota `#/horarios`. Escolhe-se a escola → cobertura 7h–18h20 com lacunas + jornada semanal de cada servidor vinculado, em barras. Regras em `horarios.model.js`: ≤8h/dia e sem sobreposição são **erro** (bloqueiam); >6h contínuas e lacuna de cobertura são **aviso**. **Requer a migration `009_horarios.sql`.** |
| **Ocorrências** | ✅ | **Novo.** Rota `#/ocorrencias`. CRUD dos atendimentos telefônicos da recepção, ligados (opcionalmente) a uma escola. Filtros por período (padrão: últimos 30 dias), escola e status; busca livre. Campo "encaminhado para" aparece só quando status = encaminhada. **Requer a migration `010_ocorrencias.sql`.** |
| **Relatórios de Visita** | ✅ | **Novo.** Rota `#/visitas`. CRUD das visitas técnicas (escola, tipo, pauta, constatações, encaminhamentos, prazo, status). Marca "prazo vencido". **Requer `012_visitas.sql`.** |
| **Atas de Atendimento** | ✅ | **Novo.** Rota `#/atas`. Redação + **impressão em papel timbrado** (folha montada em `atas.view.js`, isolada por `@media print`). Numeração sequencial por ano (trigger no banco). **Requer `013_atas.sql`.** |
| **Usuários & Acessos** | ✅ | **Novo.** Rota `#/usuarios`, **só admin**. Duas abas: allowlist (CRUD de `perfil` + último acesso de cada um) e **Auditoria** (visualizador do `audit_log`, com o diff de-para). Substitui o SQL manual. **Requer `011_auditoria.sql`.** |
| **Menu de usuário + auditoria** | ✅ | **Novo.** O topo direito virou um dropdown (ícone de usuário) com e-mail, papel, **último acesso (fuso America/Sao_Paulo)**, origem dos dados e Sair. Toda alteração de cadastro é auditada por trigger no banco (antes/depois/diff), à prova de bypass. **Requer `011_auditoria.sql`.** |
| **Projetos & Pesquisas** | ✅ **finalizado** | Rota `#/projetos`. CRUD dos projetos/pesquisas ofertados às escolas + manifestação de interesse de cada unidade (na gaveta do projeto). **Requer `015_projetos.sql`.** O André avaliou em 15/07/2026 e **considerou o módulo pronto como está** (relatório/exportação e contador de interesse foram oferecidos e dispensados). A parte EXTERNA (proponente envia por token) segue no backlog C — depende de Edge Function. |
| **Notificações (estendidas)** | ✅ | **Atualizado.** O sino/toasts agora cobrem 3 tabelas: solicitações (SATE), **afastamentos** e **ocorrências**, via `shared/realtime.js`. **Requer `014_realtime_extra.sql`.** |
| **Documentação** | ✅ | **Novo.** Rota `#/docs`, **só admin**. Explica arquitetura, camadas, regras de import, segurança/RLS, banco, auditoria, deploy e o passo a passo para criar um módulo. Conteúdo em `src/modules/docs/docs.content.js`. |

## 7. O que FALTA implementar (backlog priorizado)

### 0. PAUSADO por decisão do André (15/07/2026)
0. **SATE — evolução das regras.** O André pediu para **pausar**: "está evoluindo em um sentido diferente do ideal". Ficou **por fazer** (desenhado, não implementado): janela de horários por período (Manhã 07:00–11:10, Tarde 13:00–17:30, Noite 19:00–22:00), **vagas por atividade** + indicador "esgotada", **compartilhar ônibus**, aviso de ano mínimo de participação (2º ano) — tudo do `regras-de-negocio.md` do `agendamentos-fil`. **Não retomar sem o aval dele.**

### A. Depende de decisão sua (API externa)
1. **Cálculo de rota e horário sugerido** — usando lat/long da escola e do destino, estimar tempo de trajeto, sugerir embarque/retorno e permanência (inspirado no `Geo.js` do `agendamentos-fil`, sem alterá-lo). **Requer escolha de API:** Google Maps Platform (precisa API key, tem custo) OU OpenRouteService/Nominatim (grátis, key gratuita). ✅ **Metade do caminho já está feita:** o catálogo `local` (migration 017) dá o lugar para geocodar cada destino **uma vez**. Falta a API + popular `latitude`/`longitude` das escolas (há coords no TSV do agendamentos-fil para ~34 EMEFs).

### B. Não depende de API (podem ser feitos já)
2. ~~**Ocorrências**~~ — ✅ **feito** (`010`).
3. ~~**Atas de Atendimento**~~ — ✅ **feito** (`013`), com impressão em papel timbrado.
4. ~~**Relatórios de Visita Técnica**~~ — ✅ **feito** (`012`). *Fotos via Storage* ainda não — fica para uma próxima (exige bucket + policies de Storage).
5. ~~**Usuários & Acessos**~~ — ✅ **feito** (`011`), com auditoria e último acesso.
6. ~~**Gestores & Coordenadores** e **Horários de trabalho**~~ — ✅ **feitos** (`009`).
7. ~~**Notificações de afastamentos**~~ — ✅ **feito** (`014`), junto com ocorrências.
8. ~~**Telefones e Locais**~~ — ✅ **feitos** (`016`/`017`).
9. ~~**Afastamentos e Calendário finalizados**~~ — ✅ **feitos** (`018`).
10. **Validação de duração por tipo de afastamento** — o Apps Script trava durações (Abonada = 1 dia; Férias ∈ {10,15,20,30}). **Não implementado de propósito:** o vocabulário de tipos do FundHub é outro (Férias, LTS, Maternidade, Prêmio, Atestado, SME, Outro) e inventar regra seria chute. **Depende do André informar as durações válidas por tipo.**
11. **Relatórios/Exportações** — exportações (CSV/PDF). *Obs.: o relatório de Projetos foi oferecido e o André dispensou.*
12. **Migrar a equipe gestora de Escolas para Gestores** — a tela de Escolas já linka para `#/gestores`; falta decidir se para de repetir os dados da view `vw_escola_pessoas` e passa a só apontar. Baixa prioridade.
13. **Fotos nos Relatórios de Visita** — anexos via Supabase Storage (exige bucket + policies).
14. **Drop das colunas legadas de telefone** — depois de validar a 016 em produção, remover `unidade_escolar.telefones`/`whatsapp` e `servidor.telefone` (hoje só fallback de leitura na view).

### C. Depende de infra (Edge Function / integração)
15. **Camada do professor (sem login) por token** — link com token para o professor preencher os dados da turma de uma solicitação, sem acessar o resto do sistema. Requer **Edge Function** (service role) validando o token + página pública fora do gate de login. Desenhar com cuidado (é o único ponto de acesso anônimo controlado).
16. **Importação de afastamentos por Google Forms** — no Apps Script, os gestores lançam o afastamento por formulário e o sistema importa, deduplicando por carimbo de tempo + e-mail, casando o gestor por nome normalizado e marcando o registro como `importado` (que o admin confirma). No FundHub isso exige o formulário + uma Edge Function (ou rotina agendada) para ler as respostas. O ciclo de vida (`status`) já está pronto na `018` — bastaria acrescentar o estado `importado`.
17. **Sync com Google Calendar** — sincronizar `dia_calendario`/eventos com as agendas do Google (OAuth + API). *Obs.: a importação por colar TSV/CSV já cobre o caso mais urgente.*
18. **Projetos & Pesquisas — portal externo** — a parte INTERNA já está feita (`015`). Falta o portal do proponente (envio + acompanhamento por token) e a carta de anuência gerada. Depende de Edge Function/token, como a camada do professor.

## 8. Restrições e contexto

- **NÃO alterar nenhum código dos Apps Script** existentes (`projects/agendamentos-fil`, `projects/SME Apps/apps/afastamentos-gestores` etc.). Eles seguem em produção em paralelo e servem **só de inspiração**.
- Migrar/generalizar ideias do `agendamentos-fil` (SATE é a generalização dele; a Feira do Livro/FIL vira uma atividade).
- Insumos disponíveis (na pasta Downloads do André): `Agenda Extraclasse 2026.xlsx`, `Agenda Pedagógica 2026.xlsx`, `Projetos e Visitas 2026.xlsx`, TSVs de unidades e do agendamentos-fil, `Junho.xlsx` (formato do romaneio→programação de viagens), `Total de alunos - Fundamental 2026.xlsx` (matrículas/turmas), relatório de projetos 2025 (PDF).
- Preferir PT-BR. Manter elegância e modularidade do código; testar cada entrega no browser (dev-local) antes de commitar; commitar na `dev`.

## 9. Onde paramos e próximo passo

**Estado em 15/07/2026** — branch `dev` (tudo pushado; produção `main` ainda **sem** estas entregas):

| Commit | O que entrou |
|---|---|
| `00d60bd` | Telefones — tabela `telefone` + editor multi-telefone (migration **016**) |
| `bd86ec3` | Locais — catálogo de destinos + seletor no SATE (migration **017**) |
| `72d46f2` | Afastamentos e Calendário **finalizados** (migration **018**) |
| `8a7e454` | Correções: gate de admin nos chips do calendário + resiliência à 018 |

**Próximo passo, em ordem:**

1. **Rodar `016` → `017` → `018` → `019`** no SQL Editor (nenhuma foi rodada ainda).
2. **Validar na dev logado**: telefones em Escolas/Gestores; aba Locais no SATE; Afastamentos (visão Calendário, cancelar/reativar, processo, duplicata); Calendário (aplicar-até, importar).
3. **Merge `dev → main`** para publicar.
4. Só então escolher o próximo item do backlog. Lembrar que **o SATE está pausado** (item 0) e que a **validação de duração por tipo** (item 10) está travada esperando o André informar as regras.

> O que **não** dá para testar em dev-local (exige banco): duplicata, soft-delete/reativar, chips com dados reais, o `upsert` do intervalo e da importação, e o aviso de "não conceder afastamentos".

### Receita: criar um módulo novo

**Implementar um módulo = 5 passos** (a receita completa, com código, está em `#/docs` → "Como criar um novo módulo"):

1. `supabase/migrations/020_<x>.sql` — **a próxima livre é a 020** — tabela + RLS (`select` por `is_autorizado()`, escrita por `is_admin()`) + grants + religar o trigger de auditoria (e acrescentar a tabela ao array da `019`). Rodar no SQL Editor.
2. `src/modules/<x>/<x>.model.js` — só banco, nunca DOM; toda função começa com `if (!hasSupabase())`.
3. `src/modules/<x>/<x>.view.js` — exporta `render(app, ctx)`; usa `ctx.perfil` (já vem do roteador, **não** chamar `getPerfilAtual()` de novo).
4. `module.js` — virar `ativo: true` e acrescentar `rota`, `nav` e `load: () => import('./<x>.view.js')`.
5. Se tiver CSS próprio: `<x>.css` na pasta + um `@import` em `src/styles/main.css`.

Testar em dev-local (inclusive **em tela estreita**), conferir o console, `git diff --cached` procurando dado real, e commitar na `dev`.
