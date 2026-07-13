# SMEHub — Blueprint de Arquitetura

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
| Progressão de dados | `config.js` vazio → lê `data/*.json`; preenchido → lê Supabase | Permite ir ao ar antes do banco e trocar sem refatorar as telas. |

## 3. Modelo de domínio (contextos)

**Cadastros** — `regional`, `unidade_escolar`, `turma`, `servidor`, `vinculo` (pessoa×escola×papel×ano, temporal), `horario_trabalho`.
**Calendário** — `dia_calendario` (letivo?, evento, bloqueios), sincronizado ao Google Calendar.
**SATE (Transporte extraclasse)** — `atividade_extraclasse` (catálogo com regras), `oferta_onibus` (capacidade dia×período, variável no ano), `solicitacao_transporte` (o pedido da escola já é o pedido de ônibus; multi-parada Cirem; workflow de status; validações). Absorve o antigo `agendamentos-fil` (a FIL vira uma atividade com frota extra).
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
- **Fase 1** — Cadastros: Escolas (import CSV) ✅, Gestores/Vínculos/Horários. **← atual**
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

## 7. Pendências de insumo

- **`Junho.xlsx`** — planilha de agendamento de ônibus (formato final p/ a empresa). Necessária para modelar a saída do SATE.
- **Relatório de Projetos 2025** — referência do relatório anual do módulo Projetos.
