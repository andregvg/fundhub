-- ============================================================
-- 018 — Afastamentos: soft-delete (status), processo e reforços
-- Rode no SQL Editor, depois das anteriores.
--
-- Traz para o FundHub o que o Apps Script "afastamentos-gestores" já
-- fazia: ciclo de vida com status (ativo | cancelado — o cancelado
-- preserva o histórico e a auditoria, em vez de sumir), número de
-- processo com detecção de duplicata, e nº de dias (calculado na tela).
--
-- afastamento já é auditada (trigger religado na 011); acrescentar
-- colunas não exige religar nada.
-- ============================================================

alter table afastamento
  add column if not exists status   text not null default 'ativo',  -- ativo | cancelado
  add column if not exists processo text;

create index if not exists idx_afast_status   on afastamento(status);
create index if not exists idx_afast_processo on afastamento(processo) where processo is not null;
