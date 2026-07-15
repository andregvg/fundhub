-- ============================================================
-- 015 — Projetos & Pesquisas (parte interna)
-- Rode no SQL Editor. Leitura por allowlist, escrita por admin.
-- Auditada pelo trigger da 011 (religado no fim).
--
-- Escopo desta migration: o cadastro interno dos projetos/pesquisas
-- e a manifestação de interesse das escolas. O PORTAL EXTERNO do
-- proponente (envio e acompanhamento por token, sem login) fica para
-- uma etapa futura — depende de Edge Function (service role) validando
-- o token fora do gate. Ver docs/HANDOFF.md § C.
-- ============================================================

create table if not exists projeto (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  proponente     text,                 -- pesquisador(a) ou instituição
  tipo           text not null default 'pesquisa',  -- pesquisa | projeto | programa | outro
  descricao      text,
  publico_alvo   text,
  inicio         date,
  fim            date,
  status         text not null default 'proposto',
  -- proposto | em_analise | aprovado | em_andamento | concluido | indeferido
  anuencia       boolean not null default false,     -- carta de anuência emitida?
  anuencia_data  date,
  contato        text,
  observacoes    text,
  criado_por     text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists idx_projeto_status on projeto(status);

-- Manifestação de interesse das escolas por um projeto.
create table if not exists projeto_interesse (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references projeto(id)          on delete cascade,
  unidade_id  uuid not null references unidade_escolar(id)  on delete cascade,
  interesse   boolean not null default true,
  observacao  text,
  criado_por  text,
  criado_em   timestamptz not null default now(),
  unique (projeto_id, unidade_id)
);
create index if not exists idx_interesse_projeto on projeto_interesse(projeto_id);
create index if not exists idx_interesse_unidade on projeto_interesse(unidade_id);

alter table projeto           enable row level security;
alter table projeto           force row level security;
alter table projeto_interesse enable row level security;
alter table projeto_interesse force row level security;

do $$
declare t text;
begin
  foreach t in array array['projeto','projeto_interesse'] loop
    execute format('drop policy if exists %I_sel on %I', t, t);
    execute format('drop policy if exists %I_ins on %I', t, t);
    execute format('drop policy if exists %I_upd on %I', t, t);
    execute format('drop policy if exists %I_del on %I', t, t);
    execute format('create policy %I_sel on %I for select using (is_autorizado())', t, t);
    execute format('create policy %I_ins on %I for insert with check (is_admin())', t, t);
    execute format('create policy %I_upd on %I for update using (is_admin()) with check (is_admin())', t, t);
    execute format('create policy %I_del on %I for delete using (is_admin())', t, t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    -- Auditoria (fn_audit vem da 011).
    execute format('drop trigger if exists trg_audit on %I', t);
    execute format('create trigger trg_audit after insert or update or delete on %I for each row execute function fn_audit()', t);
  end loop;
end $$;
