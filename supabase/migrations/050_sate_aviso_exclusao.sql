-- ============================================================
-- 050 - SATE: aviso de EXCLUSAO de solicitacao
--
-- O aviso comum (solicitacao_aviso) some junto com a solicitacao (cascata),
-- entao nao serve para avisar que ela foi excluida. Aqui o fato guarda um
-- retrato minimo (data, destino, escolas envolvidas) SEM chave estrangeira,
-- e fica no sino ate a pessoa dispensar (solicitacao_exclusao_visto).
-- Nenhum dado pessoal: so data, nome do destino e ids de escolas.
-- Quem ve: a escola envolvida na viagem e quem tem leitura/escrita no SATE.
-- O aviso nunca impede a exclusao (bloco protegido). Idempotente.
-- ============================================================
create table if not exists solicitacao_exclusao (
  id             bigint generated always as identity primary key,
  solicitacao_id uuid not null,
  unidades       uuid[] not null default '{}',
  unidade_id     uuid,
  data           date,
  destino_nome   text,
  autor          text,
  em             timestamptz not null default now()
);
create index if not exists idx_solic_exclusao_em on solicitacao_exclusao(em desc);

alter table solicitacao_exclusao enable row level security;
drop policy if exists solic_exclusao_sel on solicitacao_exclusao;
create policy solic_exclusao_sel on solicitacao_exclusao for select to authenticated
  using (case nivel_modulo('sate')
           when 'oculto'   then false
           when 'proprios' then unidades && array(select minhas_unidades())
           else true end);
grant select on solicitacao_exclusao to authenticated;   -- so gatilho escreve

create table if not exists solicitacao_exclusao_visto (
  email       text not null,
  exclusao_id bigint not null references solicitacao_exclusao(id) on delete cascade,
  visto_em    timestamptz not null default now(),
  primary key (email, exclusao_id)
);
alter table solicitacao_exclusao_visto enable row level security;
alter table solicitacao_exclusao_visto force row level security;
drop policy if exists solic_exclusao_visto_sel on solicitacao_exclusao_visto;
drop policy if exists solic_exclusao_visto_ins on solicitacao_exclusao_visto;
create policy solic_exclusao_visto_sel on solicitacao_exclusao_visto for select using (email = auth_email());
create policy solic_exclusao_visto_ins on solicitacao_exclusao_visto for insert with check (email = auth_email());
grant select, insert on solicitacao_exclusao_visto to authenticated;

-- O gatilho: ANTES de apagar, enquanto as participacoes ainda existem.
create or replace function fn_sate_aviso_exclusao() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into solicitacao_exclusao (solicitacao_id, unidades, unidade_id, data, destino_nome, autor)
    values (old.id,
            array(select distinct u from (
                    select p.unidade_id u from solicitacao_participacao p where p.solicitacao_id = old.id
                    union select old.unidade_id) q where u is not null),
            old.unidade_id, old.data, old.destino_nome, auth_email());
  exception when others then
    raise warning 'SATE: aviso de exclusao nao registrado: %', sqlerrm;
  end;
  return old;
end $$;

drop trigger if exists trg_sate_aviso_exclusao on solicitacao_transporte;
create trigger trg_sate_aviso_exclusao
  before delete on solicitacao_transporte
  for each row execute function fn_sate_aviso_exclusao();

-- O que esta por ver, para QUEM PERGUNTA (RLS decide quem enxerga).
create or replace function exclusoes_por_ver(p_id bigint default null)
  returns table (id bigint, solicitacao_id uuid, unidade_id uuid, data date,
                 destino_nome text, autor text, em timestamptz)
  language sql stable set search_path = public as $$
    select e.id, e.solicitacao_id, e.unidade_id, e.data, e.destino_nome, e.autor, e.em
      from solicitacao_exclusao e
     where (p_id is null or e.id = p_id)
       and e.autor is distinct from auth_email()
       and e.em >= now() - interval '60 days'
       and not exists (select 1 from solicitacao_exclusao_visto v
                        where v.exclusao_id = e.id and v.email = auth_email())
     order by e.em desc
     limit 100
  $$;
grant execute on function exclusoes_por_ver(bigint) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public'
                    and tablename = 'solicitacao_exclusao') then
    alter publication supabase_realtime add table solicitacao_exclusao;
  end if;
end $$;

-- Auditoria: as duas ficam de fora (o fato ja e auditado na origem).
-- Espelhada em ISENTAS_AUDITORIA (.claude/scripts/verificar_arquitetura.py).
create or replace function _audit_isentas() returns text[]
  language sql immutable as $$ select array[
    'audit_log',            -- auditar o log e recursao sem valor
    'evento_log',           -- idem
    'preferencia_usuario',  -- preferencia pessoal de tela; ruido puro
    'schema_migrations',    -- metadado de infraestrutura, nao cadastro
    'solicitacao_aviso',    -- log de um fato ja auditado na origem (a solicitacao)
    'solicitacao_visto',    -- estado pessoal de leitura; ruido puro
    'solicitacao_exclusao', -- idem solicitacao_aviso, para a exclusao
    'solicitacao_exclusao_visto'  -- estado pessoal de leitura; ruido puro
  ] $$;
drop trigger if exists trg_audit on solicitacao_exclusao;
drop trigger if exists trg_audit on solicitacao_exclusao_visto;

select religar_auditoria();

select registrar_migration('050', 'SATE: aviso persistente de exclusao de solicitacao');
