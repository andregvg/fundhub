-- ============================================================
-- 013 — Atas de Atendimento
-- Rode no SQL Editor. Leitura por allowlist, escrita por admin.
-- Auditada pelo trigger da 011 (religado no fim).
--
-- `numero` é uma sequência anual legível (ex.: 12/2026), gerada no
-- insert por trigger — cada ano recomeça em 1. É o número que vai
-- impresso no papel timbrado.
-- ============================================================

create table if not exists ata_atendimento (
  id             uuid primary key default gen_random_uuid(),
  numero         int,                  -- sequencial no ano (preenchido por trigger)
  ano            int not null default extract(year from current_date),
  data           date not null default current_date,
  hora           time,
  local          text,
  tipo           text not null default 'gestor',   -- gestor | coordenador | servidor | municipe | outro
  participantes  text,                 -- quem esteve presente
  assunto        text not null,
  deliberacoes   text,                 -- o corpo da ata
  encaminhamentos text,
  redator        text,                 -- quem redigiu (criado_por)
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists idx_ata_data on ata_atendimento(data desc);
create unique index if not exists idx_ata_numero_ano on ata_atendimento(ano, numero);

-- Numeração sequencial por ano, atribuída no insert.
create or replace function fn_ata_numero() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.numero is null then
    select coalesce(max(numero), 0) + 1 into new.numero
      from ata_atendimento where ano = new.ano;
  end if;
  return new;
end $$;

drop trigger if exists trg_ata_numero on ata_atendimento;
create trigger trg_ata_numero before insert on ata_atendimento
  for each row execute function fn_ata_numero();

alter table ata_atendimento enable row level security;
alter table ata_atendimento force row level security;

drop policy if exists ata_sel on ata_atendimento;
drop policy if exists ata_ins on ata_atendimento;
drop policy if exists ata_upd on ata_atendimento;
drop policy if exists ata_del on ata_atendimento;
create policy ata_sel on ata_atendimento for select using (is_autorizado());
create policy ata_ins on ata_atendimento for insert with check (is_admin());
create policy ata_upd on ata_atendimento for update using (is_admin()) with check (is_admin());
create policy ata_del on ata_atendimento for delete using (is_admin());

grant select, insert, update, delete on ata_atendimento to authenticated;

-- Auditoria (fn_audit vem da 011).
drop trigger if exists trg_audit on ata_atendimento;
create trigger trg_audit after insert or update or delete on ata_atendimento
  for each row execute function fn_audit();
