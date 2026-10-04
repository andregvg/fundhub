-- ============================================================
-- 045 - Funcao do gestor (Gestor 1 / Gestor 2) e supervisao fora da
--       equipe gestora
-- Spec: docs/superpowers/specs/2026-10-03-formularios-tema-e-equipe-da-escola-design.md
--       (D12, D14, D17)
--
-- A funcao e parte do VINCULO: o periodo da funcao e o periodo do
-- vinculo. Trocar de funcao com data encerra um periodo e abre outro
-- (funcao mudar_funcao_gestor, abaixo) - nao ha tabela de historico nova.
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

-- Troca de funcao COM data: encerra o periodo atual na vespera e abre outro
-- com a funcao nova, na MESMA transacao. Feita no banco, e nao em duas
-- escritas do navegador: se a segunda falhasse, a pessoa ficaria sem local
-- de trabalho atual. Sem `security definer`: quem decide quem pode e o RLS
-- de `vinculo` (escrita em Servidores). As colunas do insert sao as que a
-- tabela exige (schema.sql + 023): servidor_id, unidade_id, papel e ano
-- sao NOT NULL; id e criado_em tem default.
-- current_date e a data do servidor (UTC): perto da meia-noite pode estar um
-- dia a frente de Ribeirao Preto, o que so deixa a regra de "futuro" mais tolerante.
-- O parametro e `int` (nao smallint): o SQL Editor passa o literal 1 como int, e
-- o Postgres nao converte int em smallint na resolucao de funcao - com smallint
-- a chamada `mudar_funcao_gestor('...', 1, '...')` dava "function does not
-- exist". O drop tira a versao smallint, se alguem a aplicou antes: sem ele
-- ficariam duas sobrecargas. A coluna continua smallint (cast no insert).
drop function if exists mudar_funcao_gestor(uuid, smallint, date);

create or replace function mudar_funcao_gestor(p_vinculo uuid, p_funcao int, p_desde date)
  returns vinculo
  language plpgsql
  set search_path = public
as $$
declare
  v    vinculo;
  novo vinculo;
begin
  select * into v from vinculo where id = p_vinculo for update;
  if not found then
    raise exception 'Local de trabalho nao encontrado' using errcode = 'P0002';
  end if;
  if v.fim is not null then
    raise exception 'Local de trabalho ja encerrado' using errcode = 'P0001';
  end if;
  if v.papel <> 'Gestor(a)' then
    raise exception 'Funcao so existe no cargo de gestor' using errcode = 'P0001';
  end if;
  if p_funcao is null or p_funcao not in (1, 2) then
    raise exception 'Funcao invalida' using errcode = 'P0001';
  end if;
  if v.funcao is not distinct from p_funcao then
    raise exception 'Funcao igual a atual' using errcode = 'P0001';
  end if;
  if p_desde is null then
    raise exception 'Data da mudanca obrigatoria' using errcode = 'P0001';
  end if;
  if p_desde > current_date then
    raise exception 'Data da mudanca no futuro' using errcode = 'P0001';
  end if;
  if v.ingresso is not null and p_desde <= v.ingresso then
    raise exception 'Data da mudanca antes do inicio' using errcode = 'P0001';
  end if;

  -- Fecha ANTES de abrir: vinculo_aberto_unico nao aceita dois abertos iguais.
  update vinculo set fim = p_desde - 1 where id = v.id;
  insert into vinculo (servidor_id, unidade_id, papel, ano, ingresso, fim, funcao)
    values (v.servidor_id, v.unidade_id, v.papel, extract(year from p_desde)::int, p_desde, null, p_funcao::smallint)
    returning * into novo;
  return novo;
end $$;

grant execute on function mudar_funcao_gestor(uuid, int, date) to authenticated;

select religar_auditoria();

select registrar_migration('045',
  'Vinculo: funcao do gestor (1 ou 2) e troca datada numa transacao (mudar_funcao_gestor); supervisao fora da equipe gestora');
