-- ============================================================
-- 009 — Horários de trabalho da equipe gestora
-- Rode no SQL Editor, depois de schema.sql (servidor, vinculo e
-- unidade_escolar já precisam existir). Leitura por allowlist
-- (is_autorizado), escrita por admin (is_admin).
--
-- Modelo: a jornada de um servidor num dia é um conjunto de BLOCOS
-- (não um par entrada/saída). Isso é o que permite representar a
-- regra das 6h contínuas: quem cumpre 8h num dia precisa partir a
-- jornada em dois blocos com intervalo entre eles.
--
-- As regras de negócio (≤8h/dia, ≤6h contínuas, cobertura 7h–18h20)
-- são validadas na aplicação, em modules/horarios/horarios.model.js.
-- Aqui garantimos só a integridade estrutural: fim > início.
-- ============================================================

create table if not exists horario_bloco (
  id          uuid primary key default gen_random_uuid(),
  servidor_id uuid not null references servidor(id)        on delete cascade,
  unidade_id  uuid not null references unidade_escolar(id) on delete cascade,
  ano         int  not null default 2026,
  dia_semana  smallint not null,          -- 1=segunda … 5=sexta
  inicio      time not null,
  fim         time not null,
  obs         text,
  criado_por  text,
  criado_em   timestamptz not null default now(),

  constraint horario_dia_valido  check (dia_semana between 1 and 5),
  constraint horario_fim_apos_inicio check (fim > inicio)
);

create index if not exists idx_horario_servidor on horario_bloco(servidor_id, ano);
create index if not exists idx_horario_unidade  on horario_bloco(unidade_id, ano, dia_semana);

alter table horario_bloco enable row level security;
alter table horario_bloco force row level security;

drop policy if exists horario_sel on horario_bloco;
drop policy if exists horario_ins on horario_bloco;
drop policy if exists horario_upd on horario_bloco;
drop policy if exists horario_del on horario_bloco;
create policy horario_sel on horario_bloco for select using (is_autorizado());
create policy horario_ins on horario_bloco for insert with check (is_admin());
create policy horario_upd on horario_bloco for update using (is_admin()) with check (is_admin());
create policy horario_del on horario_bloco for delete using (is_admin());

grant select, insert, update, delete on horario_bloco to authenticated;
