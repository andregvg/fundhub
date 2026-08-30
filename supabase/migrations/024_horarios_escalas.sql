-- ============================================================
-- 024 - Horários: escalas de calendário, cargos de gestão e
-- configuração de exibição por escola.
-- Rode no SQL Editor, depois da 023.
--
-- ESCALA é o nome de um dia. O horário não é escrito contra datas,
-- é escrito contra nomes de dia - e o calendário diz, para cada data
-- real, qual nome ela tem. É isso que resolve o TDC com revezamento
-- sem inferir nada: "em que fase estamos?" vira consulta.
--
-- Vocabulário inicial: 'normal', 'tdc-a', 'tdc-b'. É `text` e não
-- `enum` porque o vocabulário vai crescer (recesso, plantão) e migrar
-- enum no Postgres é caro. O conjunto válido é validado na aplicação.
--
-- As colunas de escala são criadas aqui mas só passam a ser LIDAS no
-- plano B-2. Coluna ociosa com default não afeta nada; migration
-- pela metade, sim.
-- ============================================================

-- ── Escala do dia, na rede ───────────────────────────────────
alter table dia_calendario add column if not exists escala text;

-- ── Escala do dia, remarcada por uma escola ──────────────────
-- Três estados, deliberadamente distintos:
--   sem linha             -> a escola segue o calendário da rede;
--   linha com escala      -> a escola remarcou;
--   linha com escala nula -> a escola CANCELOU: aqui não há TDC nesta data.
-- Um boolean não distinguiria "não decidiram" de "decidiram que não".
create table if not exists escala_unidade (
  unidade_id uuid not null references unidade_escolar(id) on delete cascade,
  data       date not null,
  escala     text,
  criado_por text,
  criado_em  timestamptz not null default now(),
  primary key (unidade_id, data)
);

-- ── Escala de um bloco de jornada ────────────────────────────
alter table horario_bloco add column if not exists escala text not null default 'normal';
create index if not exists idx_horario_escala
  on horario_bloco(unidade_id, escala, dia_semana);

-- ── Cargos que compõem a equipe gestora ──────────────────────
-- `vinculo.papel` é texto livre e o catálogo É o conjunto dos cargos
-- em uso - então o sistema não sabia responder "esta pessoa é
-- gestora?". Esta tabela é a resposta, e é decidida por gente.
-- Cargo fora da lista NÃO é gestão: ninguém entra na cobertura da
-- escola por acidente.
create table if not exists cargo_gestao (
  cargo      text primary key,
  criado_por text,
  criado_em  timestamptz not null default now()
);

insert into cargo_gestao (cargo) values
  ('Diretor(a)'), ('Vice-diretor(a)'), ('Coordenador(a)'), ('Supervisor(a)')
on conflict (cargo) do nothing;

-- ── Exibição e cobertura por escola ──────────────────────────
-- "O horário da coordenadora conta na cobertura desta escola" é um
-- FATO DA ESCOLA, não preferência de quem está olhando: duas pessoas
-- conferindo a mesma unidade precisam ver a mesma cobertura. Por isso
-- vive no banco e não em localStorage.
-- Sem linha = comportamento padrão (exibe se for cargo de gestão,
-- conta na cobertura, ordem alfabética por cargo e nome).
create table if not exists horario_exibicao (
  unidade_id      uuid not null references unidade_escolar(id) on delete cascade,
  servidor_id     uuid not null references servidor(id)        on delete cascade,
  ordem           int  not null default 0,
  conta_cobertura boolean not null default true,
  atualizado_por  text,
  atualizado_em   timestamptz not null default now(),
  primary key (unidade_id, servidor_id)
);
create index if not exists idx_horario_exibicao_uni on horario_exibicao(unidade_id, ordem);

-- ── RLS ──────────────────────────────────────────────────────
alter table escala_unidade   enable row level security;
alter table escala_unidade   force  row level security;
alter table cargo_gestao     enable row level security;
alter table cargo_gestao     force  row level security;
alter table horario_exibicao enable row level security;
alter table horario_exibicao force  row level security;

drop policy if exists escala_uni_sel on escala_unidade;
drop policy if exists escala_uni_wr  on escala_unidade;
create policy escala_uni_sel on escala_unidade for select using (is_autorizado());
create policy escala_uni_wr  on escala_unidade for all
  using (is_admin()) with check (is_admin());

drop policy if exists cargo_gestao_sel on cargo_gestao;
drop policy if exists cargo_gestao_wr  on cargo_gestao;
create policy cargo_gestao_sel on cargo_gestao for select using (is_autorizado());
create policy cargo_gestao_wr  on cargo_gestao for all
  using (is_admin()) with check (is_admin());

drop policy if exists horario_exib_sel on horario_exibicao;
drop policy if exists horario_exib_wr  on horario_exibicao;
create policy horario_exib_sel on horario_exibicao for select using (is_autorizado());
create policy horario_exib_wr  on horario_exibicao for all
  using (is_admin()) with check (is_admin());

-- Sem grant o RLS nem chega a ser consultado: o Postgres recusa antes.
grant select, insert, update, delete on escala_unidade   to authenticated;
grant select, insert, update, delete on cargo_gestao     to authenticated;
grant select, insert, update, delete on horario_exibicao to authenticated;

-- ── Auditoria ────────────────────────────────────────────────
-- O trigger se chama `trg_audit` em TODAS as tabelas (011, 012, 013,
-- 015, 016, 017 e o array da 019). Nome diferente aqui criaria um
-- SEGUNDO trigger nestas tabelas quando a 019 for reexecutada, e
-- fn_audit() insere uma linha por disparo: cada alteração viraria
-- duas em audit_log.
drop trigger if exists trg_audit on escala_unidade;
drop trigger if exists trg_audit on cargo_gestao;
drop trigger if exists trg_audit on horario_exibicao;
create trigger trg_audit after insert or update or delete on escala_unidade
  for each row execute function fn_audit();
create trigger trg_audit after insert or update or delete on cargo_gestao
  for each row execute function fn_audit();
create trigger trg_audit after insert or update or delete on horario_exibicao
  for each row execute function fn_audit();

select registrar_migration('024', 'Horarios: escalas de calendario, cargos de gestao e exibicao por escola');
