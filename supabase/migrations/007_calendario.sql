-- ============================================================
-- 007 — Calendário Escolar
-- Rode no SQL Editor (após as migrations anteriores). Um registro por
-- dia: se é letivo, evento, tipo (agenda) e bloqueios que o SATE e os
-- Afastamentos consultam (ex.: dia de prova bloqueia extraclasse).
-- Leitura por allowlist (is_autorizado), escrita por admin (is_admin).
-- ============================================================

create table if not exists dia_calendario (
  data                 date primary key,
  letivo               boolean not null default true,
  tipo                 text,            -- calendário escolar | evento pedagógico | cultural | prova | feriado
  evento               text,
  bloqueia_afastamento boolean not null default false,
  bloqueia_extraclasse boolean not null default false,
  obs                  text,
  atualizado_em        timestamptz not null default now()
);
create index if not exists idx_dia_calendario_bloq on dia_calendario(bloqueia_extraclasse) where bloqueia_extraclasse;

alter table dia_calendario enable row level security;
alter table dia_calendario force row level security;

drop policy if exists dia_sel on dia_calendario;
drop policy if exists dia_ins on dia_calendario;
drop policy if exists dia_upd on dia_calendario;
drop policy if exists dia_del on dia_calendario;
create policy dia_sel on dia_calendario for select using (is_autorizado());
create policy dia_ins on dia_calendario for insert with check (is_admin());
create policy dia_upd on dia_calendario for update using (is_admin()) with check (is_admin());
create policy dia_del on dia_calendario for delete using (is_admin());

grant select, insert, update, delete on dia_calendario to authenticated;
