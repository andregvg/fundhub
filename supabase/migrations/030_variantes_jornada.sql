-- ============================================================
-- 030 - Variantes de jornada (o revezamento do TDC)
-- Spec: docs/superpowers/specs/2026-09-06-variantes-de-jornada-design.md
--
-- Em dia de TDC a escola tem DUAS configuracoes do mesmo dia, e nunca
-- se sabe qual vale numa data. As duas nao sao intercambiaveis: cada
-- uma tem a propria cobertura. `variante` e o segundo eixo do dia;
-- `conduz` marca as linhas de quem conduz o TDC naquela variante.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================

alter table horario_bloco add column if not exists variante smallint not null default 1;
alter table horario_bloco add column if not exists conduz   boolean  not null default false;

-- Toda jornada ja gravada e a variante 1. O CHECK so garante que
-- ninguem grave 0 ou negativo - nao ha teto: uma escola com tres
-- gestores em rodizio grava tres.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'horario_variante_positiva') then
    alter table horario_bloco add constraint horario_variante_positiva check (variante >= 1);
  end if;
end $$;

-- A grade le por (unidade, dia, escala, variante); o indice existente
-- cobre os tres primeiros. Sem indice novo: a leitura ja e por unidade
-- e o volume por unidade e de dezenas de linhas.

-- ── D10: Supervisor(a) sai da equipe gestora ──
-- Supervisor(a) e cargo da SME: visita as unidades, nao compoe a gestao
-- de nenhuma delas, e nao entra na grade nem no calculo de cobertura de
-- escola alguma. A tabela e editavel pela Gerencia (configuracao de
-- rede desde o Bloco G), entao a remocao e so da linha semeada.
delete from cargo_gestao where cargo = 'Supervisor(a)';

select registrar_migration('030', 'Variantes de jornada (horario_bloco.variante, .conduz)');
