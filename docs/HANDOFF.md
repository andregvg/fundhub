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
├── shared/       SEM DOMÍNIO: dom.js · format.js · ui/{drawer,toast,feedback}.js
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

## 5. Banco de dados — migrations (rodar no SQL Editor, em ordem)

`supabase/schema.sql` → `002_leitura_allowlist.sql` → `003_grants.sql` → `004_sate.sql` → `005_solicitacao_extra.sql` → `006_realtime.sql` → `007_calendario.sql` → `008_afastamentos.sql`

Seeds (gitignored, em `_private/` — rodar após as migrations correspondentes):
`seed_unidades.sql`, `seed_atividades.sql`, `seed_calendario.sql`.

> Gerador dos seeds: script Python que lê os TSV/xlsx originais (em Downloads) e escreve em `_private/`. Ver histórico da conversa. NUNCA commitar `_private/`.

Tabelas: `regional`, `servidor`, `unidade_escolar`, `vinculo`, `perfil`, `atividade_extraclasse`, `oferta_onibus`, `solicitacao_transporte`, `dia_calendario`, `afastamento`; view `vw_escola_pessoas`; funções `auth_email()`, `is_institucional()`, `is_autorizado()`, `is_admin()`.

## 6. O que JÁ está implementado

| Módulo | Status | Observações |
|---|---|---|
| Login | ✅ | Magic link + botão Google (provider Google precisa ser configurado no painel). Restrito a `@educacao.pmrp.sp.gov.br` + allowlist. |
| Dashboard do dia | ✅ | Stats + painéis Extraclasse, Afastamentos **e Calendário** do dia (o placeholder saiu). Compõe os models dos outros módulos; não tem model próprio. |
| Escolas | ✅ | Leitura + busca/filtros + detalhe com equipe gestora + **CRUD admin**. |
| SATE (Transporte) | ✅ | Abas em `sate/views/`: Solicitações (lista+validação admin), Nova (catálogo **ou** atividade livre, adaptado/cadeirante, cálculo de ônibus, validações de antecedência/mínimo/**bloqueio de data do calendário**), Frota (oferta×saldo, checagem ao confirmar), Catálogo (**CRUD de atividades**). |
| Programação de Viagens | ✅ | Confirmadas do dia (origem→destino, horários, alunos, ônibus, contato), imprimível. (NÃO chamar de "romaneio".) Lê de `sate.model.js`; não tem model próprio. |
| Calendário Escolar | ✅ | Grade mensal, eventos, bloqueios (extraclasse/afastamento); admin edita cada dia. |
| Afastamentos | ✅ | Lista+filtros + CRUD admin (servidor×tipo×período×unidade). |
| Notificações | ✅ | Realtime (sino + badge + toasts) para solicitações. É um **serviço** (`servico: true`): sem rota, iniciado pelo `main.js` no login, parado no logout. |
| **Documentação** | ✅ | **Novo.** Rota `#/docs`, **só admin**. Explica arquitetura, camadas, regras de import, segurança/RLS, banco, deploy e o passo a passo para criar um módulo. Conteúdo em `src/modules/docs/docs.content.js` (acrescentar uma seção = acrescentar um objeto no array). |

## 7. O que FALTA implementar (backlog priorizado)

### A. Depende de decisão sua (API externa)
1. **Cálculo de rota e horário sugerido** — usando lat/long da escola e do destino, estimar tempo de trajeto, sugerir embarque/retorno e permanência (inspirado no `Geo.js` do `agendamentos-fil`, sem alterá-lo). **Requer escolha de API:** Google Maps Platform (precisa API key, tem custo) OU OpenRouteService/Nominatim (grátis, key gratuita). Também exige popular `latitude`/`longitude` das escolas (há coords no TSV do agendamentos-fil para ~34 EMEFs).

### B. Não depende de API (podem ser feitos já)
2. **Ocorrências** — registro de atendimentos telefônicos das recepcionistas, ligado à escola (tabela `ocorrencia`; CRUD; filtros por escola/data).
3. **Atas de Atendimento** — redigir e compilar atas (gestores/coordenadores/servidores/munícipes), com **impressão em papel timbrado** (CSS de impressão + template).
4. **Relatórios de Visita Técnica** — registro das visitas às escolas pela equipe de acompanhamento (tabela `relatorio_visita`; CRUD; possivelmente fotos via Storage).
5. **Usuários & Acessos** — tela admin para gerir a tabela `perfil` (adicionar/remover e-mails da allowlist, definir papel). Hoje isso é feito por SQL manual.
6. **Gestores & Coordenadores** — hoje aparecem embutidos em Escolas; falta uma tela dedicada de servidores/vínculos e o módulo de **Horários de trabalho** (jornada semanal com validação: ≤8h/dia, ≤6h contínuas, cobertura 7h–18h20; barra gráfica de horário).
7. **Notificações de afastamentos** — estender o Realtime/toasts para a tabela `afastamento` (hoje só solicitações).
8. **Relatórios/Exportações** — relatório anual de projetos, exportações (CSV/PDF).

### C. Depende de infra (Edge Function)
9. **Camada do professor (sem login) por token** — link com token para o professor preencher os dados da turma de uma solicitação, sem acessar o resto do sistema. Requer **Edge Function** (service role) validando o token + página pública fora do gate de login. Desenhar com cuidado (é o único ponto de acesso anônimo controlado).
10. **Sync com Google Calendar** — sincronizar `dia_calendario`/eventos com as agendas do Google (OAuth + API). 
11. **Projetos & Pesquisas** — portal externo do proponente (envio + acompanhamento por token), carta de anuência gerada, manifestação de interesse das escolas. (Grande; parte externa depende de Edge Function/token.)

## 8. Restrições e contexto

- **NÃO alterar nenhum código dos Apps Script** existentes (`projects/agendamentos-fil`, `projects/SME Apps/apps/afastamentos-gestores` etc.). Eles seguem em produção em paralelo e servem **só de inspiração**.
- Migrar/generalizar ideias do `agendamentos-fil` (SATE é a generalização dele; a Feira do Livro/FIL vira uma atividade).
- Insumos disponíveis (na pasta Downloads do André): `Agenda Extraclasse 2026.xlsx`, `Agenda Pedagógica 2026.xlsx`, `Projetos e Visitas 2026.xlsx`, TSVs de unidades e do agendamentos-fil, `Junho.xlsx` (formato do romaneio→programação de viagens), `Total de alunos - Fundamental 2026.xlsx` (matrículas/turmas), relatório de projetos 2025 (PDF).
- Preferir PT-BR. Manter elegância e modularidade do código; testar cada entrega no browser (dev-local) antes de commitar; commitar na `dev`.

## 9. Sugestão de próximo passo

Atacar o **bloco B (sem API)** na ordem: **Ocorrências → Atas (timbrado) → Relatórios de Visita → Usuários & Acessos**.

As "vagas" desses módulos já existem: `src/modules/{ocorrencias,atas,visitas,usuarios,horarios,projetos}/module.js` estão criados com `ativo: false` (aparecem como tile "em breve"). **Implementar um deles = 5 passos** (a receita completa, com código, está em `#/docs` → "Como criar um novo módulo"):

1. `supabase/migrations/009_<x>.sql` — tabela + RLS (`select` por `is_autorizado()`, escrita por `is_admin()`) + grants. Rodar no SQL Editor.
2. `src/modules/<x>/<x>.model.js` — só banco, nunca DOM; toda função começa com `if (!hasSupabase())`.
3. `src/modules/<x>/<x>.view.js` — exporta `render(app, ctx)`; usa `ctx.perfil` (já vem do roteador, **não** chamar `getPerfilAtual()` de novo).
4. `module.js` — virar `ativo: true` e acrescentar `rota`, `nav` e `load: () => import('./<x>.view.js')`.
5. Se tiver CSS próprio: `<x>.css` na pasta + um `@import` em `src/styles/main.css`.

Testar em dev-local (inclusive **em tela estreita**), conferir o console, `git diff --cached` procurando dado real, e commitar na `dev`.
