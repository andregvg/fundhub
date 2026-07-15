-- ============================================================
-- 010 — Ocorrências (atendimentos telefônicos das recepcionistas)
-- Rode no SQL Editor, depois de schema.sql (precisa de unidade_escolar).
-- Leitura por allowlist (is_autorizado), escrita por admin (is_admin).
--
-- Diferente dos outros módulos, a ESCRITA aqui é o dia a dia das
-- recepcionistas — não é uma tarefa administrativa esporádica. Ainda
-- assim mantemos escrita = is_admin() por ora (a equipe de recepção
-- entra na allowlist como admin_sme); quando existir um papel
-- intermediário ("recepcao"), é aqui que a policy de insert muda.
--
-- A unidade é OPCIONAL: nem toda ligação é sobre uma escola específica.
-- ============================================================

create table if not exists ocorrencia (
  id               uuid primary key default gen_random_uuid(),
  unidade_id       uuid references unidade_escolar(id) on delete set null,
  data             date not null default current_date,
  hora             time,
  canal            text not null default 'telefone',   -- telefone | presencial | whatsapp | email | outro
  solicitante      text,          -- quem procurou (nome)
  solicitante_contato text,       -- telefone/e-mail de retorno
  assunto          text not null,
  relato           text,
  status           text not null default 'aberta',     -- aberta | em_andamento | resolvida | encaminhada
  encaminhado_para text,          -- setor/pessoa, quando status = encaminhada
  criado_por       text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create index if not exists idx_ocorrencia_data    on ocorrencia(data desc);
create index if not exists idx_ocorrencia_unidade on ocorrencia(unidade_id);
create index if not exists idx_ocorrencia_status  on ocorrencia(status);

alter table ocorrencia enable row level security;
alter table ocorrencia force row level security;

drop policy if exists ocorrencia_sel on ocorrencia;
drop policy if exists ocorrencia_ins on ocorrencia;
drop policy if exists ocorrencia_upd on ocorrencia;
drop policy if exists ocorrencia_del on ocorrencia;
create policy ocorrencia_sel on ocorrencia for select using (is_autorizado());
create policy ocorrencia_ins on ocorrencia for insert with check (is_admin());
create policy ocorrencia_upd on ocorrencia for update using (is_admin()) with check (is_admin());
create policy ocorrencia_del on ocorrencia for delete using (is_admin());

grant select, insert, update, delete on ocorrencia to authenticated;
