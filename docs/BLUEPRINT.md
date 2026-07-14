# FundHub — Blueprint de Arquitetura

> Documento vivo. Registra as decisões e o modelo do sistema. Atualizar a cada fase.

## 1. Objetivo

Hub de aplicações gerenciais para a Gerência de Ensino Fundamental da SME (Ribeirão Preto),
substituindo o mosaico atual de planilhas Google + Apps Scripts por uma base integrada,
rápida e escalável, com acompanhamento em tempo real das 144 escolas da rede.

## 2. Stack e decisões

| Tema | Decisão | Porquê |
|---|---|---|
| Hospedagem | GitHub Pages (estático) sob base `/fundhub` | Sem custo/servidor. Base isolada → migrar para domínio próprio é só reapontar DNS. |
| URL hoje | `andregvg.github.io/fundhub` | No ar imediatamente; migra para `fundhub.andregvg.com.br` depois. |
| Back-end | Supabase (Postgres + Auth + RLS + Realtime + Storage + Edge Functions) | Banco relacional real, autenticação, tempo real e regras de acesso sem manter servidor. |
| Roteamento | SPA com hash router (`#/rota`) | Funciona no Pages sob qualquer base, sem rewrite. |
| Autenticação interna | Google OAuth restrito a `@educacao.pmrp.sp.gov.br` | Login com conta institucional. RLS decide o que cada perfil enxerga. |
| Camada externa (sem login) | Links assinados / magic-token + Edge Functions | Professores (dados da turma no SATE) e proponentes (envio/acompanhamento de projeto) acessam só a própria linha. |
| Progressão de dados | Fonte é o Supabase; em dev, `data/unidades.local.json` (gitignored). Sem `config.js` e sem arquivo local → estado vazio. | Ir ao ar antes do banco sem versionar dado real. |
| **Segurança (repo público)** | **Nenhum dado sensível ou seed no repositório, em hipótese alguma.** Dados só no Supabase (RLS); seeds gerados localmente em `_private/` (gitignored). Dados pessoais (e-mail/telefone/CPF de servidores) atrás de autenticação — nunca via `anon`. | Repo é público no GitHub Pages. |

## 3. Modelo de domínio (contextos)

**Cadastros** — `regional`, `unidade_escolar`, `turma`, `servidor`, `vinculo` (pessoa×escola×papel×ano, temporal), `horario_trabalho`. As ~34 EMEFs (que usam extraclasse) trazem coordenadas e contagem de alunos por segmento/período (fonte: escolas do `agendamentos-fil`). `turma` vem do relatório de matrículas (aba *Consulta Matrícula*): código da turma, série, período, capacidade física, matriculados, ativos.
**Calendário** — `dia_calendario` (letivo?, evento, bloqueios), sincronizado ao Google Calendar.
**SATE (Transporte extraclasse)** — `atividade_extraclasse` (catálogo com regras), `oferta_onibus` (capacidade dia×período, variável no ano), `solicitacao_transporte` (o pedido da escola já é o pedido de ônibus; multi-parada Cirem; workflow de status; validações), e a **saída = programação de viagens** do dia para a empresa de transporte (ver `Junho.xlsx`: por dia, cada viagem com ORIGEM escola→DESTINO local, Ida/Retorno com horários, nº de alunos, tipo de veículo Ônibus/Van ADP, contato do professor). Absorve o antigo `agendamentos-fil` (a FIL vira uma atividade com frota extra).
**Afastamentos** — `afastamento` integrado a `servidor`/`vinculo`/calendário; ícones no Google Contacts.
**Projetos & Pesquisas** — `projeto`, `anuencia` (gera carta), `manifestacao_interesse`; portal externo do proponente.
**Operação diária** — `ocorrencia`, `ata`, `relatorio_visita`, `notificacao`, e o Dashboard do dia (extraclasse + afastamentos + calendário em tempo real).
**Admin** — `usuario`, `perfil`, `acesso`, relatórios.

## 4. Perfis de acesso

`admin_sme`, `transporte`, `gestor_escola`, `coordenador`, `supervisor`, e externos sem login
(`professor` e `proponente`, via token). Herança/refino dos perfis já usados no `agendamentos-fil`
(`admin_sme / escola / professor / fil / transporte`).

## 5. Roteiro por fases

- **Fase 0** — Casca do hub no Pages + login institucional. *(base)*
- **Fase 1** — Cadastros: Escolas (import TSV) ✅, Gestores/Vínculos/Horários, Turmas/Matrículas. **← atual**
- **Fase 2** — Calendário Escolar (import Agenda Pedagógica) + sync Google Calendar + catálogo de atividades + oferta de ônibus.
- **Fase 3** — SATE completo (generaliza `agendamentos-fil`): solicitação→validação→confirmação, camada professor por token, Cirem multi-parada, declarações impressas.
- **Fase 4** — Afastamentos (migração + Contacts) + Projetos/Pesquisas (portal + anuência + manifestação).
- **Fase 5** — Ocorrências, Atas (timbrado), Relatórios de visita, Notificações realtime, Relatórios anuais.

## 6. Regras de negócio a preservar (do sistema atual)

- Capacidade de ônibus (44 lugares); cálculo de ônibus por passageiros.
- Janela de horários por período (manhã/tarde/noite) com pisos e limites.
- Oferta de frota variável: base ~9; +3 no Cirem (40 dias letivos); +16 na FIL (bloqueia demais agendamentos).
- Antecedência mínima da escola (~5 dias); last-minute só para `transporte`/`admin` até horário-limite da véspera.
- Atividades com mínimo de participantes (ex.: Cauim) e horários próprios (SME) vs. definidos pela escola.
- Atividades que exigem declaração impressa de participantes.
- Bloqueios do calendário (provas VUNESP/SARESP/OBMEP; “não conceder afastamentos em”).
- Horário de trabalho do gestor: ≤8h/dia, ≤6h contínuas, cobertura 7h–18h20; homologação por ofício.

## 7. Não alterar os Apps Script

Os sistemas em Apps Script (`agendamentos-fil`, `afastamentos-gestores` etc.) **seguem em produção em paralelo e não devem ser modificados**. Servem apenas de inspiração/fonte de dados e regras para o FundHub.

## 8. Insumos recebidos (para as próximas fases)

- `Junho.xlsx` — programação de viagens de ônibus (formato de saída do SATE). ✅
- Relatório de Projetos 2025 (PDF, com imagens) — referência do relatório anual. ✅ (relatórios costumam ter imagens associadas → prever Storage no Supabase).
- `Total de alunos - Fundamental 2026.xlsx` — matrículas/salas/capacidade por turma. ✅
- Escolas do `agendamentos-fil` (TSV) — coordenadas + alunos por período das ~34 EMEFs. ✅
