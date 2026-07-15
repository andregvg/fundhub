-- ============================================================
-- 012 — Relatórios de Visita Técnica
-- Rode no SQL Editor, depois de schema.sql (precisa de unidade_escolar).
-- Leitura por allowlist, escrita por admin. Auditado pelo trigger da
-- migration 011 (após rodar esta, religue o trigger — ver o fim).
-- ============================================================

create table if not exists relatorio_visita (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     uuid not null references unidade_escolar(id) on delete cascade,
  data           date not null default current_date,
  responsavel    text,                 -- quem realizou a visita
  tipo           text not null default 'rotina',   -- rotina | acompanhamento | demanda | denuncia | outro
  pauta          text,                 -- o que motivou / o que se foi ver
  constatacoes   text,                 -- o que se encontrou
  encaminhamentos text,                -- o que ficou combinado
  prazo          date,                 -- prazo dos encaminhamentos
  status         text not null default 'aberto',   -- aberto | concluido
  criado_por     text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists idx_visita_unidade on relatorio_visita(unidade_id);
create index if not exists idx_visita_data    on relatorio_visita(data desc);
create index if not exists idx_visita_status  on relatorio_visita(status);

alter table relatorio_visita enable row level security;
alter table relatorio_visita force row level security;

drop policy if exists visita_sel on relatorio_visita;
drop policy if exists visita_ins on relatorio_visita;
drop policy if exists visita_upd on relatorio_visita;
drop policy if exists visita_del on relatorio_visita;
create policy visita_sel on relatorio_visita for select using (is_autorizado());
create policy visita_ins on relatorio_visita for insert with check (is_admin());
create policy visita_upd on relatorio_visita for update using (is_admin()) with check (is_admin());
create policy visita_del on relatorio_visita for delete using (is_admin());

grant select, insert, update, delete on relatorio_visita to authenticated;

-- Auditoria (fn_audit vem da 011). Ligue o trigger nesta tabela também.
drop trigger if exists trg_audit on relatorio_visita;
create trigger trg_audit after insert or update or delete on relatorio_visita
  for each row execute function fn_audit();
