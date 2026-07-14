-- ============================================================
-- FundHub — schema.sql  (Fase 1: Cadastros núcleo)
-- Postgres / Supabase. Rode este arquivo antes de seed_unidades.sql.
-- ============================================================
-- Contexto: normaliza o CSV de "Unidades Escolares" em:
--   regional · servidor (pessoa) · unidade_escolar · vinculo (pessoa×escola×papel×ano)
-- O vínculo temporal resolve gestores/coordenadores que mudam de escola ao
-- longo dos anos (e podem estar em mais de uma no mesmo ano).

create extension if not exists pgcrypto;

-- ── Regionais ────────────────────────────────────────────────
create table if not exists regional (
  id    serial primary key,
  nome  text not null unique
);

-- ── Servidor (pessoa: gestor, coordenador, supervisor) ───────
create table if not exists servidor (
  id         uuid primary key default gen_random_uuid(),
  chave      text not null unique,          -- email (minúsculo) ou 'serv:<slug-do-nome>'
  nome       text not null,
  email      text,
  telefone   text,
  apelido    text,
  cpf        text,
  rg         text,
  inicio_rede date,
  criado_em  timestamptz not null default now()
);

-- ── Unidade escolar ──────────────────────────────────────────
create table if not exists unidade_escolar (
  id             uuid primary key default gen_random_uuid(),
  numero         int unique,                -- índice da planilha (1..144), chave natural do seed
  nome           text not null,
  nome_oficial   text,
  apelido        text,
  segmento       text,                      -- EMEF, EMEI, ...
  endereco       text,
  telefones      text[] not null default '{}',
  email          text,
  regional_id    int references regional(id),
  tem_transporte boolean not null default false,  -- transporte regular de alunos
  oferta         text,                      -- EF1/EF2 etc.
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
  papel       text not null,                -- gestor | coordenador | supervisor
  ano         int  not null default 2026,
  ativo       boolean not null default true,
  ingresso    date,
  fim         date,
  criado_em   timestamptz not null default now(),
  unique (servidor_id, unidade_id, papel, ano)
);

create index if not exists idx_vinculo_unidade on vinculo(unidade_id);
create index if not exists idx_vinculo_servidor on vinculo(servidor_id);

-- ── RLS ──────────────────────────────────────────────────────
-- Fase 1: diretório de escolas é leitura pública (anon + autenticado).
-- Escrita fica bloqueada por ausência de policy — só via service_role
-- (SQL editor/seed). Policies de escrita por perfil entram na Fase de Admin.
alter table regional        enable row level security;
alter table servidor        enable row level security;
alter table unidade_escolar enable row level security;
alter table vinculo         enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='regional' and policyname='regional_read') then
    create policy regional_read on regional for select using (true); end if;
  if not exists (select 1 from pg_policies where tablename='servidor' and policyname='servidor_read') then
    create policy servidor_read on servidor for select using (true); end if;
  if not exists (select 1 from pg_policies where tablename='unidade_escolar' and policyname='unidade_read') then
    create policy unidade_read on unidade_escolar for select using (true); end if;
  if not exists (select 1 from pg_policies where tablename='vinculo' and policyname='vinculo_read') then
    create policy vinculo_read on vinculo for select using (true); end if;
end $$;

-- ── View de conveniência: escola com suas pessoas do ano ─────
create or replace view vw_escola_pessoas as
select u.id as unidade_id, u.numero, u.nome, v.papel, v.ano,
       s.nome as pessoa_nome, s.apelido, s.email, s.telefone
from unidade_escolar u
join vinculo v on v.unidade_id = u.id
join servidor s on s.id = v.servidor_id;
