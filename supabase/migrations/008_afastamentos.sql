-- ============================================================
-- 008 — Afastamentos de servidores (gestores/coordenadores/supervisores)
-- Rode no SQL Editor. Leitura por allowlist (is_autorizado), escrita por
-- admin (is_admin). Integra-se a servidor e unidade_escolar.
-- ============================================================

create table if not exists afastamento (
  id          uuid primary key default gen_random_uuid(),
  servidor_id uuid references servidor(id) on delete cascade,
  tipo        text not null,     -- Férias | Licença Saúde (LTS) | Licença Maternidade | Licença Prêmio | Atestado | Afastamento SME | Outro
  inicio      date not null,
  fim         date,              -- nulo = em aberto
  unidade_id  uuid references unidade_escolar(id),
  motivo      text,
  criado_por  text,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_afast_servidor on afastamento(servidor_id);
create index if not exists idx_afast_periodo  on afastamento(inicio, fim);

alter table afastamento enable row level security;
alter table afastamento force row level security;

drop policy if exists afast_sel on afastamento;
drop policy if exists afast_ins on afastamento;
drop policy if exists afast_upd on afastamento;
drop policy if exists afast_del on afastamento;
create policy afast_sel on afastamento for select using (is_autorizado());
create policy afast_ins on afastamento for insert with check (is_admin());
create policy afast_upd on afastamento for update using (is_admin()) with check (is_admin());
create policy afast_del on afastamento for delete using (is_admin());

grant select, insert, update, delete on afastamento to authenticated;
