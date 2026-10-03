-- ============================================================
-- 045 - Funcao do gestor (Gestor 1 / Gestor 2) e supervisao fora da
--       equipe gestora
-- Spec: docs/superpowers/specs/2026-10-03-formularios-tema-e-equipe-da-escola-design.md
--       (D12, D14, D17)
--
-- A funcao e parte do VINCULO: o periodo da funcao e o periodo do
-- vinculo. Trocar de funcao com data encerra um periodo e abre outro
-- (feito pelo app) - nao ha tabela de historico nova.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================

alter table vinculo add column if not exists funcao smallint;

-- So 1 ou 2 - e so no cargo de gestor. A regra tambem esta na tela, mas
-- a que vale e esta (R15).
alter table vinculo drop constraint if exists vinculo_funcao_valor;
alter table vinculo add constraint vinculo_funcao_valor
  check (funcao is null or funcao in (1, 2));

alter table vinculo drop constraint if exists vinculo_funcao_so_gestor;
alter table vinculo add constraint vinculo_funcao_so_gestor
  check (funcao is null or papel = 'Gestor(a)');

comment on column vinculo.funcao is
  'Funcao do gestor na unidade: 1 = Gestor 1, 2 = Gestor 2. Nulo = nao definida, ou cargo sem funcao.';

-- Supervisao nao e equipe da escola: sai da lista de cargos que compoem a
-- grade de horarios e a cobertura. O app ja a ignora; isto limpa a
-- configuracao que a 024 semeou.
delete from cargo_gestao where cargo = 'Supervisor(a)';

select religar_auditoria();

select registrar_migration('045',
  'Vinculo: funcao do gestor (1 ou 2); supervisao fora da equipe gestora');
