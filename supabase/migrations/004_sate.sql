-- ============================================================
-- 004 — SATE (transporte extraclasse): catálogo, oferta e solicitações
-- Rode no SQL Editor do Supabase (após schema.sql + migrations 002/003).
-- Mantém o padrão: leitura por allowlist (is_autorizado), escrita por
-- admin (is_admin); solicitações podem ser criadas por qualquer autorizado.
-- ============================================================

-- Catálogo de atividades extraclasse (Cauim, Saerp, Fábrica, IFF, PM, Cirem…)
create table if not exists atividade_extraclasse (
  id                 uuid primary key default gen_random_uuid(),
  chave              text unique not null,
  nome               text not null,
  descricao          text,
  publico_alvo       text,
  usa_onibus         boolean not null default true,
  gerida_sme         boolean not null default true,  -- horários próprios (SME) vs. definidos pela escola
  min_participantes  int,
  precisa_declaracao boolean not null default false, -- exige declaração impressa de participantes
  lanche             text,
  local_nome         text,
  local_endereco     text,
  cor                text,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now()
);

-- Oferta de ônibus por dia × período (frota variável ao longo do ano)
create table if not exists oferta_onibus (
  id         uuid primary key default gen_random_uuid(),
  data       date not null,
  periodo    text not null check (periodo in ('manha','tarde','noite')),
  total      int  not null default 0,
  observacao text,
  unique (data, periodo)
);

-- Solicitação de transporte (o pedido da escola já é o pedido de ônibus)
create table if not exists solicitacao_transporte (
  id                uuid primary key default gen_random_uuid(),
  atividade_id      uuid references atividade_extraclasse(id),
  unidade_id        uuid references unidade_escolar(id),
  data              date not null,
  periodo           text check (periodo in ('manha','tarde','noite')),
  turmas            text,
  qtd_alunos        int,
  qtd_onibus        int,
  status            text not null default 'solicitado',
                    -- solicitado | em_analise | confirmado | negado | cancelado
  contato_professor text,
  observacao        text,
  criado_por        text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists idx_solic_data    on solicitacao_transporte(data);
create index if not exists idx_solic_unidade on solicitacao_transporte(unidade_id);

-- RLS
alter table atividade_extraclasse   enable row level security;
alter table oferta_onibus           enable row level security;
alter table solicitacao_transporte  enable row level security;
alter table atividade_extraclasse   force row level security;
alter table oferta_onibus           force row level security;
alter table solicitacao_transporte  force row level security;

do $$
declare t text;
begin
  foreach t in array array['atividade_extraclasse','oferta_onibus'] loop
    execute format('drop policy if exists %I_sel on %I', t, t);
    execute format('drop policy if exists %I_ins on %I', t, t);
    execute format('drop policy if exists %I_upd on %I', t, t);
    execute format('drop policy if exists %I_del on %I', t, t);
    execute format('create policy %I_sel on %I for select using (is_autorizado())', t, t);
    execute format('create policy %I_ins on %I for insert with check (is_admin())', t, t);
    execute format('create policy %I_upd on %I for update using (is_admin()) with check (is_admin())', t, t);
    execute format('create policy %I_del on %I for delete using (is_admin())', t, t);
  end loop;
end $$;

drop policy if exists solic_sel on solicitacao_transporte;
drop policy if exists solic_ins on solicitacao_transporte;
drop policy if exists solic_upd on solicitacao_transporte;
drop policy if exists solic_del on solicitacao_transporte;
create policy solic_sel on solicitacao_transporte for select using (is_autorizado());
create policy solic_ins on solicitacao_transporte for insert with check (is_autorizado());
create policy solic_upd on solicitacao_transporte for update using (is_admin()) with check (is_admin());
create policy solic_del on solicitacao_transporte for delete using (is_admin());

grant select, insert, update, delete
  on atividade_extraclasse, oferta_onibus, solicitacao_transporte to authenticated;
