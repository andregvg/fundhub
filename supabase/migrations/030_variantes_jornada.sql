-- ============================================================
-- 030 - Variantes de jornada (o revezamento do TDC)
-- Spec: docs/superpowers/specs/2026-09-06-variantes-de-jornada-design.md
--
-- Em dia de TDC a escola tem DUAS configurações do mesmo dia, e nunca
-- se sabe qual vale numa data. As duas não são intercambiáveis: cada
-- uma tem a própria cobertura. `variante` é o segundo eixo do dia;
-- `conduz` marca as linhas de quem conduz o TDC naquela variante.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================

alter table horario_bloco add column if not exists variante smallint not null default 1;
alter table horario_bloco add column if not exists conduz   boolean  not null default false;

-- Toda jornada já gravada é a variante 1. O CHECK só garante que
-- ninguém grave 0 ou negativo - não há teto: uma escola com três
-- gestores em rodízio grava três.
--
-- `conname` não é único no banco inteiro (é único por schema, e nomes
-- de constraint se repetem entre tabelas), então a busca é escopada à
-- tabela - senão uma constraint homônima em outra tabela faria esta
-- migration achar que já rodou.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'horario_variante_positiva'
       and conrelid = 'horario_bloco'::regclass
  ) then
    alter table horario_bloco add constraint horario_variante_positiva check (variante >= 1);
  end if;
end $$;

-- A grade lê por (unidade, dia, escala, variante); o índice existente
-- cobre os três primeiros. Sem índice novo: a leitura já é por unidade
-- e o volume por unidade é de dezenas de linhas.

-- ── D10: Supervisor(a) sai da equipe gestora ──
-- Supervisor(a) é cargo da SME: visita as unidades, não compõe a gestão
-- de nenhuma delas, e não entra na grade nem no cálculo de cobertura de
-- escola alguma. A tabela é editável pela Gerência (configuração de
-- rede desde o Bloco G), então a remoção é só da linha semeada.
delete from cargo_gestao where cargo = 'Supervisor(a)';

select registrar_migration('030', 'Variantes de jornada (horario_bloco.variante, .conduz)');
