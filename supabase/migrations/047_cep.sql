-- ============================================================
-- 047 - CEP em escolas, locais e no destino digitado do pedido
--
-- Spec: 2026-10-10-sate-endereco-e-cep-design.md, D2.
--
-- Opcional nos tres lugares. Formato canonico: 8 digitos, sem hifen (o
-- mesmo criterio de CPF e telefone - o banco guarda o dado, a tela poe a
-- mascara). O CHECK e o que vale; a mascara do formulario e conforto.
--
-- criar_viagem() NAO muda: ela monta a linha por jsonb_populate_record,
-- que carrega `destino_cep` sozinho agora que a coluna existe.
--
-- Nenhuma tabela nova: sem policy a criar. O gatilho de auditoria ja
-- registra a coluna nova (fn_audit compara a linha inteira).
--
-- Idempotente.
-- ============================================================

alter table local                  add column if not exists cep text;
alter table unidade_escolar        add column if not exists cep text;
alter table solicitacao_transporte add column if not exists destino_cep text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'local_cep_check') then
    alter table local add constraint local_cep_check
      check (cep is null or cep ~ '^[0-9]{8}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'unidade_cep_check') then
    alter table unidade_escolar add constraint unidade_cep_check
      check (cep is null or cep ~ '^[0-9]{8}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'solic_destino_cep_check') then
    alter table solicitacao_transporte add constraint solic_destino_cep_check
      check (destino_cep is null or destino_cep ~ '^[0-9]{8}$');
  end if;
end $$;

select religar_auditoria();

select registrar_migration('047',
  'CEP (8 digitos) em local, unidade_escolar e no destino digitado da solicitacao');
