-- ============================================================
-- 005 — Solicitação: atividade livre, destino, horários e adaptado
-- Rode no SQL Editor (após 004). Amplia solicitacao_transporte para
-- cobrir pedidos de ônibus para atividades organizadas pela própria
-- escola (fora do catálogo) e transporte adaptado (cadeirantes),
-- inspirado no agendamentos-fil (qtd_cadeirante, horario_embarque).
-- ============================================================

alter table solicitacao_transporte
  add column if not exists atividade_livre  text,   -- nome, quando não é do catálogo
  add column if not exists destino_nome     text,
  add column if not exists destino_endereco text,
  add column if not exists horario_embarque text,   -- "HH:MM"
  add column if not exists horario_retorno  text,
  add column if not exists qtd_cadeirante   int not null default 0;

-- atividade_id já é nullable: pedido livre usa atividade_livre no lugar.
