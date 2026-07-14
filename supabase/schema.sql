-- ============================================================
-- FundHub — schema.sql  (Fase 1: Cadastros núcleo) — SEGURO
-- Postgres / Supabase. Rode este arquivo antes de seed_unidades.sql
-- (no SQL Editor do Supabase). Todas as tabelas com RLS default-deny:
--   • Leitura: SOMENTE usuários logados com e-mail institucional
--     (@educacao.pmrp.sp.gov.br). Anônimo não enxerga NADA.
--   • Escrita: SOMENTE admin (definido na tabela perfil).
-- A anon key é pública por design — quem protege os dados é o RLS.
-- ============================================================

create extension if not exists pgcrypto;

-- ── Helpers de identidade/autorização ────────────────────────
-- E-mail do requisitante (claim do JWT emitido pelo Supabase Auth).
create or replace function auth_email() returns text
  language sql stable as $$ select nullif(auth.jwt() ->> 'email', '') $$;

-- É um usuário autenticado do domínio institucional?
create or replace function is_institucional() returns boolean
  language sql stable as $$
    select coalesce(auth_email(), '') like '%@educacao.pmrp.sp.gov.br'
  $$;

-- ── Perfis / papéis ──────────────────────────────────────────
create table if not exists perfil (
  email      text primary key,
  nome       text,
  papel      text not null default 'leitor',   -- admin_sme | transporte | leitor
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- SECURITY DEFINER: lê perfil ignorando RLS (evita recursão de policy).
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (
      select 1 from perfil
      where email = auth_email() and papel = 'admin_sme' and ativo
    )
  $$;

-- Allowlist de LEITURA: só lê quem está cadastrado em perfil (ativo).
-- Não basta ter e-mail institucional — o acesso é liberado manualmente
-- inserindo o e-mail na tabela perfil.
create or replace function is_autorizado() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from perfil where email = auth_email() and ativo)
  $$;

-- ── Regionais ────────────────────────────────────────────────
create table if not exists regional (
  id    serial primary key,
  nome  text not null unique
);

-- ── Servidor (pessoa: gestor, coordenador, supervisor) ───────
create table if not exists servidor (
  id          uuid primary key default gen_random_uuid(),
  chave       text not null unique,
  nome        text not null,
  email       text,
  telefone    text,
  apelido     text,
  cpf         text,
  rg          text,
  inicio_rede date,
  criado_em   timestamptz not null default now()
);

-- ── Unidade escolar ──────────────────────────────────────────
create table if not exists unidade_escolar (
  id             uuid primary key default gen_random_uuid(),
  numero         int unique,
  nome           text not null,
  nome_oficial   text,
  apelido        text,
  segmento       text,
  endereco       text,
  telefones      text[] not null default '{}',
  email          text,
  regional_id    int references regional(id),
  tem_transporte boolean not null default false,
  oferta         text,
  tem_eja        boolean not null default false,
  inep           text,
  pdde           text,
  site_apm       text,
  drive_id       text,
  latitude       double precision,
  longitude      double precision,
  maps_url       text,
  whatsapp       text,
  link_prestacao_contas text,
  atualizado_em  timestamptz not null default now()
);

-- ── Vínculo: pessoa × escola × papel × ano (temporal) ────────
create table if not exists vinculo (
  id          uuid primary key default gen_random_uuid(),
  servidor_id uuid not null references servidor(id) on delete cascade,
  unidade_id  uuid not null references unidade_escolar(id) on delete cascade,
  papel       text not null,
  ano         int  not null default 2026,
  ativo       boolean not null default true,
  ingresso    date,
  fim         date,
  criado_em   timestamptz not null default now(),
  unique (servidor_id, unidade_id, papel, ano)
);
create index if not exists idx_vinculo_unidade  on vinculo(unidade_id);
create index if not exists idx_vinculo_servidor on vinculo(servidor_id);

-- ── RLS (default-deny) ───────────────────────────────────────
alter table perfil          enable row level security;
alter table regional        enable row level security;
alter table servidor        enable row level security;
alter table unidade_escolar enable row level security;
alter table vinculo         enable row level security;
-- Força RLS inclusive para o dono das tabelas (defesa em profundidade).
alter table servidor        force row level security;
alter table unidade_escolar force row level security;
alter table vinculo         force row level security;
alter table regional        force row level security;

-- Aplica um par de policies (leitura institucional / escrita admin) a uma tabela.
do $$
declare t text;
begin
  foreach t in array array['regional','servidor','unidade_escolar','vinculo'] loop
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

-- perfil: cada um vê o próprio; admin vê/gere todos.
drop policy if exists perfil_sel on perfil;
drop policy if exists perfil_all on perfil;
create policy perfil_sel on perfil for select
  using (email = auth_email() or is_admin());
create policy perfil_all on perfil for all
  using (is_admin()) with check (is_admin());

-- ── View: escola com pessoas (herda RLS das tabelas base) ────
create or replace view vw_escola_pessoas
  with (security_invoker = true) as
select u.id as unidade_id, u.numero, u.nome, v.papel, v.ano,
       s.nome as pessoa_nome, s.apelido, s.email, s.telefone
from unidade_escolar u
join vinculo v  on v.unidade_id = u.id
join servidor s on s.id = v.servidor_id;

-- ── PASSO MANUAL: cadastre-se como admin (troque pelo seu e-mail) ──
-- insert into perfil (email, nome, papel)
-- values ('SEU.EMAIL@educacao.pmrp.sp.gov.br', 'André', 'admin_sme')
-- on conflict (email) do update set papel = 'admin_sme', ativo = true;
