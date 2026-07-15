-- ============================================================
-- 017 — Catálogo de Locais (destinos das atividades/solicitações)
-- Rode no SQL Editor, depois da 016.
--
-- Por que um catálogo em vez de texto livre por atividade/solicitação:
--   • hoje o destino mora como texto solto em atividade_extraclasse
--     (local_nome/local_endereco) e em solicitacao_transporte
--     (destino_nome/destino_endereco). O MESMO lugar (Theatro Pedro II,
--     Biblioteca Sinhá Junqueira) é redigitado e não pode ser geocodado
--     uma vez só.
--   • Um `local` é entidade COMPARTILHADA e geocodável — é a fundação do
--     cálculo de rota/tempo (backlog): geocoda cada destino uma vez.
--   • É o mesmo padrão do agendamentos-fil (Locais.js): fonte única do
--     endereço + ponto de desembarque, apontado por id.
--   • O endereço da ESCOLA continua inline em unidade_escolar (é 1:1,
--     atributo intrínseco — extrair só somaria join sem ganho).
--
-- atividade_extraclasse.local_id e solicitacao_transporte.local_id
-- apontam para local (nullable). Os campos de texto legados ficam como
-- snapshot/fallback (atividade livre ad-hoc ainda pode usar texto).
-- ============================================================

create table if not exists local (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  endereco    text,
  desembarque text,               -- ponto de desembarque do ônibus (p/ a empresa)
  latitude    double precision,
  longitude   double precision,
  maps_url    text,
  ativo       boolean not null default true,
  obs         text,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_local_nome on local (lower(nome));

alter table atividade_extraclasse  add column if not exists local_id uuid references local(id);
alter table solicitacao_transporte add column if not exists local_id uuid references local(id);

-- ── Backfill (idempotente): cria locais dos textos livres e vincula ──
do $$
begin
  if not exists (select 1 from local) then
    -- locais vindos do catálogo de atividades (local_nome), 1 por nome
    insert into local (nome, endereco)
    select min(trim(local_nome)), min(nullif(trim(coalesce(local_endereco, '')), ''))
    from atividade_extraclasse
    where coalesce(trim(local_nome), '') <> ''
    group by lower(trim(local_nome));

    -- locais vindos das solicitações livres (destino_nome) ainda inexistentes
    insert into local (nome, endereco)
    select min(trim(s.destino_nome)), min(nullif(trim(coalesce(s.destino_endereco, '')), ''))
    from solicitacao_transporte s
    where coalesce(trim(s.destino_nome), '') <> ''
      and not exists (
        select 1 from local l where lower(trim(l.nome)) = lower(trim(s.destino_nome))
      )
    group by lower(trim(s.destino_nome));

    -- vincula atividades e solicitações ao local por nome normalizado
    update atividade_extraclasse a set local_id = l.id
      from local l
     where a.local_id is null
       and coalesce(trim(a.local_nome), '') <> ''
       and lower(trim(l.nome)) = lower(trim(a.local_nome));

    update solicitacao_transporte s set local_id = l.id
      from local l
     where s.local_id is null
       and coalesce(trim(s.destino_nome), '') <> ''
       and lower(trim(l.nome)) = lower(trim(s.destino_nome));
  end if;
end $$;

-- ── RLS + grants (padrão do FundHub) ─────────────────────────
alter table local enable row level security;
alter table local force  row level security;
drop policy if exists local_sel on local;
drop policy if exists local_ins on local;
drop policy if exists local_upd on local;
drop policy if exists local_del on local;
create policy local_sel on local for select using (is_autorizado());
create policy local_ins on local for insert with check (is_admin());
create policy local_upd on local for update using (is_admin()) with check (is_admin());
create policy local_del on local for delete using (is_admin());
grant select, insert, update, delete on local to authenticated;

-- ── Auditoria (fn_audit vem da 011) ──────────────────────────
drop trigger if exists trg_audit on local;
create trigger trg_audit after insert or update or delete on local
  for each row execute function fn_audit();
