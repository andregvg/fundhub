-- ============================================================
-- 020 — Afastamentos: campos de sincronização com a planilha
-- Rode no SQL Editor, depois da 019.
--
-- CONTEXTO: enquanto o lançamento oficial continua na planilha do Drive
-- (aba "Lançamentos" do Apps Script afastamentos-gestores, que por sua
-- vez importa periodicamente as respostas do formulário dos gestores),
-- o FundHub precisa ESPELHAR aquela aba sem duplicar registro a cada
-- importação. Para isso:
--
--   chave_externa  — identidade do registro NA PLANILHA. É a mesma chave
--                    que o Apps Script usa para se achar:
--                    "tipo|nome_completo|data_inicio|criado_em".
--                    UNIQUE (parcial: só quando preenchida) → reimportar
--                    ATUALIZA em vez de duplicar (upsert idempotente).
--                    Registros criados aqui no FundHub ficam com NULL —
--                    e o índice parcial permite vários NULLs.
--   origem         — manual (criado no FundHub) | formulario | planilha.
--   atualizado_em/por — espelham as colunas homônimas da aba.
--
-- `status` continua text livre e passa a aceitar também 'importado'
-- (lançado, aguardando confirmação da SME) além de ativo|cancelado —
-- mesma semântica da planilha, onde 'excluido' vira 'cancelado' aqui.
-- ============================================================

alter table afastamento
  add column if not exists origem         text not null default 'manual',
  add column if not exists chave_externa  text,
  add column if not exists atualizado_em  timestamptz,
  add column if not exists atualizado_por text;

-- Idempotência do sync: uma linha da planilha = uma linha aqui.
-- Índice único SIMPLES (não parcial) de propósito: no Postgres NULLs são
-- distintos entre si, então os registros manuais (chave_externa NULL)
-- convivem sem conflito — e um índice PARCIAL impediria o
-- `upsert(onConflict:'chave_externa')` do PostgREST de inferir o arbiter.
create unique index if not exists idx_afast_chave_externa
  on afastamento(chave_externa);

create index if not exists idx_afast_origem on afastamento(origem);

-- afastamento já é auditada (trigger religado na 011/019); acrescentar
-- colunas não exige religar nada.
