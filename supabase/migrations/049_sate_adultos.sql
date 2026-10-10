-- 049 - SATE: adultos acompanhantes por escola da viagem.
-- Cada parada tem seus estudantes e seus adultos; a coluna e idempotente.
alter table solicitacao_participacao
  add column if not exists qtd_adultos int not null default 0;

alter table solicitacao_participacao drop constraint if exists solicitacao_participacao_qtd_adultos_check;
alter table solicitacao_participacao
  add constraint solicitacao_participacao_qtd_adultos_check check (qtd_adultos >= 0);

select religar_auditoria();
