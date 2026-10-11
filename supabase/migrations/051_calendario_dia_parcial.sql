-- ============================================================
-- 051 - Calendario: dia letivo EM PARTE
--
-- Um dia pode ser letivo so numa faixa de horario: o recesso que vale para
-- parte do dia, ou a reposicao num dia de recesso. A faixa e o trecho em que
-- HA aula (letivo = true + letivo_de/letivo_ate). Sem faixa, o dia segue
-- valendo inteiro, como sempre. Idempotente. Sem tabela nova: a auditoria
-- ja cobre dia_calendario.
-- ============================================================
alter table dia_calendario
  add column if not exists letivo_de  time,
  add column if not exists letivo_ate time;

alter table dia_calendario drop constraint if exists dia_calendario_faixa_check;
alter table dia_calendario
  add constraint dia_calendario_faixa_check check (
    (letivo_de is null and letivo_ate is null)
    or (letivo_de is not null and letivo_ate is not null and letivo_ate > letivo_de));

select registrar_migration('051', 'Calendario: dia letivo em parte (faixa de aula) e tipo recesso');
