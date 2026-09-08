-- ============================================================
-- 035 - SATE v2: frota com vigencia, ciclo de vida e embarques
-- Rode no SQL Editor do Supabase (apos a 034).
-- Spec: docs/superpowers/specs/2026-09-08-sate-modelo-de-dados-design.md
--
-- O QUE MUDA, EM UMA FRASE: a frota deixa de ser uma cota por dia e
-- periodo (`oferta_onibus`) e passa a ser um lancamento de VEICULOS com
-- vigencia. E a mudanca que permite as duas regras de agendamento
-- existirem, porque as duas falam do MESMO onibus atravessando periodos.
--
-- Idempotente: `if not exists`, `on conflict do nothing`, `drop policy
-- if exists`. Pode rodar duas vezes.
-- ============================================================

-- ── 1. Rotulos de frota ──────────────────────────────────────
-- Serve para explicar de onde vieram os 25 onibus de um dia
-- ("9 Regular + 16 Feira do Livro") e para registrar por que o onibus
-- extra existiu. Tabela, e nao texto livre: "Feira do Livro" e "Feira do
-- livro" seriam dois grupos no relatorio, e o erro e silencioso.
create table if not exists frota_rotulo (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  ativo     boolean not null default true,   -- arquivado = some do combobox
  criado_em timestamptz not null default now()
);

-- Unico por nome NORMALIZADO: e o que impede "Regular" e "regular".
create unique index if not exists idx_frota_rotulo_nome
  on frota_rotulo (lower(trim(nome)));

insert into frota_rotulo (nome) values
  ('Regular'), ('Feira do Livro'), ('Cirem'), ('Migrado da oferta antiga')
on conflict do nothing;

-- ── 2. Frota ─────────────────────────────────────────────────
-- `fim` nulo = EM ABERTO: e a frota vigente. Toda outra tem prazo e SOMA
-- a ela. Ver a spec, D1.
create table if not exists frota (
  id             uuid primary key default gen_random_uuid(),
  rotulo_id      uuid not null references frota_rotulo(id) on delete restrict,
  tipo           text not null default 'onibus'
                 check (tipo in ('onibus', 'van_adaptada')),
  quantidade     int  not null check (quantidade > 0),
  inicio         date not null,
  fim            date,
  observacao     text,
  -- Preenchido quando a frota NASCEU de uma aprovacao que estourou o
  -- limite do dia (spec D2). Se a solicitacao for negada ou cancelada a
  -- frota PERMANECE, orfa, para o aprovador decidir - por isso
  -- `set null` e nao `cascade`.
  solicitacao_id uuid,
  criado_por     text,
  criado_em      timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);

-- A invariante central: no maximo UMA frota em aberto POR TIPO. Por
-- tipo, e nao no total, porque a van adaptada e um recurso separado -
-- com uma so no total, cadastrar a frota de vans encerraria a de onibus.
create unique index if not exists idx_frota_uma_aberta
  on frota (tipo) where fim is null;

create index if not exists idx_frota_vigencia on frota (inicio, fim);
create index if not exists idx_frota_solic    on frota (solicitacao_id);

-- ── 3. Solicitacao: ciclo de vida ────────────────────────────
alter table solicitacao_transporte
  add column if not exists qtd_vans     int  not null default 0,
  add column if not exists motivo       text,
  add column if not exists decidido_por text,
  add column if not exists decidido_em  timestamptz;

-- A FK de frota so pode ser criada agora: solicitacao_transporte ja
-- existia (004), mas frota nasceu acima.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'frota_solicitacao_fk') then
    alter table frota add constraint frota_solicitacao_fk
      foreign key (solicitacao_id) references solicitacao_transporte(id) on delete set null;
  end if;
end $$;

-- `status` era text sem check nenhum desde a 004: negar e cancelar eram
-- indistinguiveis para o banco. Passa a ser lista fechada.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'solic_status_check') then
    alter table solicitacao_transporte add constraint solic_status_check
      check (status in ('solicitado', 'em_analise', 'aguardando_transporte_adaptado',
                        'confirmado', 'pendente_cancelamento', 'negado', 'cancelado'));
  end if;
end $$;

-- Justificativa obrigatoria em negativa e cancelamento (R15: se a regra
-- importa, ela tambem esta no banco). Vale para linhas NOVAS; as antigas
-- nao sao invalidadas porque a constraint entra com `not valid`.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'solic_motivo_check') then
    alter table solicitacao_transporte add constraint solic_motivo_check
      check (status not in ('negado', 'cancelado', 'pendente_cancelamento')
             or (motivo is not null and length(trim(motivo)) > 0)) not valid;
  end if;
end $$;

-- ── 4. Pontos de embarque alem do primeiro ───────────────────
-- A escola solicitante continua em solicitacao_transporte.unidade_id - e
-- ela que define a posse e o escopo do RLS. Aqui ficam as PARADAS a mais,
-- que so quem aprova pode criar (spec D8).
create table if not exists solicitacao_embarque (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references solicitacao_transporte(id) on delete cascade,
  ordem          int  not null default 1,
  unidade_id     uuid references unidade_escolar(id) on delete set null,
  local_id       uuid references local(id) on delete set null,
  horario        text,          -- "HH:MM"
  qtd_alunos     int,
  criado_em      timestamptz not null default now(),
  -- Um ponto e uma escola OU um local do catalogo, nunca os dois nem
  -- nenhum: sem isto a linha nao diz onde o onibus para.
  check (num_nonnulls(unidade_id, local_id) = 1)
);
create unique index if not exists idx_embarque_ordem
  on solicitacao_embarque (solicitacao_id, ordem);
create index if not exists idx_embarque_unidade
  on solicitacao_embarque (unidade_id);

-- ── 5. Abrir frota (sucessao em UMA transacao) ───────────────
-- Encerra a frota aberta do mesmo tipo na vespera do novo inicio e
-- insere a nova. Em duas chamadas do PostgREST isto nao seria atomico:
-- um erro no meio deixaria o dia sem frota nenhuma - e o indice unico
-- acima rejeitaria a insercao antes de o codigo fechar a anterior.
--
-- Sem `security definer`: quem chama precisa passar pelas policies, que
-- e o ponto (R6). Uma funcao definer aqui contornaria o RLS.
create or replace function abrir_frota(
  p_rotulo_id  uuid,
  p_quantidade int,
  p_inicio     date,
  p_tipo       text default 'onibus',
  p_observacao text default null
) returns frota
  language plpgsql volatile set search_path = public as $$
declare v_nova frota;
begin
  update frota
     set fim = p_inicio - 1
   where tipo = p_tipo and fim is null and inicio < p_inicio;

  -- Uma aberta que comece no MESMO dia ou depois nao pode ser "encerrada
  -- na vespera": daria fim < inicio. Ela e substituida.
  delete from frota where tipo = p_tipo and fim is null and inicio >= p_inicio;

  insert into frota (rotulo_id, tipo, quantidade, inicio, fim, observacao, criado_por)
  values (p_rotulo_id, p_tipo, p_quantidade, p_inicio, null, p_observacao, auth_email())
  returning * into v_nova;

  return v_nova;
end $$;

grant execute on function abrir_frota(uuid, int, date, text, text) to authenticated;

-- ── 6. Migracao da oferta antiga ─────────────────────────────
-- Cada dia de `oferta_onibus` vira uma frota de UM dia. O modelo velho
-- tinha um numero por periodo e o novo tem um por dia: pega-se o MAIOR,
-- que preserva a capacidade e nunca a reduz.
--
-- `oferta_onibus` NAO e dropada. Ela sai do codigo, mas apagar dado e
-- irreversivel e manter uma tabela morta custa zero. Uma migration
-- futura a remove, com calma, se ninguem sentir falta.
do $$
declare v_rotulo uuid;
begin
  if to_regclass('public.oferta_onibus') is null then return; end if;

  select id into v_rotulo from frota_rotulo
   where lower(trim(nome)) = 'migrado da oferta antiga';

  insert into frota (rotulo_id, tipo, quantidade, inicio, fim, observacao)
  select v_rotulo, 'onibus', max(o.total), o.data, o.data,
         'Migrado de oferta_onibus na migration 035'
    from oferta_onibus o
   where o.total > 0
   group by o.data
      -- Idempotente: nao reinsere o que ja foi migrado numa rodada anterior.
      on conflict do nothing;
exception when undefined_table or undefined_column then
  null;   -- oferta_onibus nunca existiu neste banco: nada a migrar
end $$;

-- ── 7. RLS ───────────────────────────────────────────────────
alter table frota_rotulo         enable row level security;
alter table frota                enable row level security;
alter table solicitacao_embarque enable row level security;
alter table frota_rotulo         force row level security;
alter table frota                force row level security;
alter table solicitacao_embarque force row level security;

do $$
declare t text;
begin
  foreach t in array array['frota_rotulo', 'frota'] loop
    execute format('drop policy if exists %I_sel on %I', t, t);
    execute format('drop policy if exists %I_ins on %I', t, t);
    execute format('drop policy if exists %I_upd on %I', t, t);
    execute format('drop policy if exists %I_del on %I', t, t);
    -- Ler a frota e ler o SALDO do dia: a escola precisa disso para saber
    -- se ainda ha vaga antes de pedir. Por isso pode_ver, nao ve_tudo.
    execute format('create policy %I_sel on %I for select using (pode_ver(''sate''))', t, t);
    execute format('create policy %I_ins on %I for insert with check (pode_escrever(''sate''))', t, t);
    execute format('create policy %I_upd on %I for update using (pode_escrever(''sate'')) with check (pode_escrever(''sate''))', t, t);
    execute format('create policy %I_del on %I for delete using (pode_escrever(''sate''))', t, t);
  end loop;
end $$;

-- Uma escola ve a solicitacao se for a SOLICITANTE ou um PONTO DE
-- EMBARQUE. A segunda metade e uma decisao registrada na spec (D8):
-- deixar a escola no escuro sobre um onibus que busca os alunos dela
-- seria pior do que a leitura literal de "so ve o que ela mesma pediu".
create or replace function ve_solicitacao(p_solicitacao uuid, p_unidade uuid)
  returns boolean
  language sql stable security definer set search_path = public as $$
    select case nivel_modulo('sate')
      when 'oculto'   then false
      when 'proprios' then
        p_unidade in (select minhas_unidades())
        or exists (select 1 from solicitacao_embarque e
                    where e.solicitacao_id = p_solicitacao
                      and e.unidade_id in (select minhas_unidades()))
      else true
    end
  $$;
grant execute on function ve_solicitacao(uuid, uuid) to authenticated;

drop policy if exists solic_sel on solicitacao_transporte;
drop policy if exists solic_ins on solicitacao_transporte;
drop policy if exists solic_upd on solicitacao_transporte;
drop policy if exists solic_del on solicitacao_transporte;

create policy solic_sel on solicitacao_transporte for select
  using (ve_solicitacao(id, unidade_id));

-- A escola cria para a PROPRIA escola - "so podem fazer solicitacoes
-- para alunos da propria escola" vira esta linha.
create policy solic_ins on solicitacao_transporte for insert
  with check (escreve_unidade('sate', unidade_id));

-- A escola so mexe enquanto o pedido nao foi analisado; aprovar, negar e
-- dar ciencia no cancelamento exigem escrita no modulo.
create policy solic_upd on solicitacao_transporte for update
  using (pode_escrever('sate')
         or (escreve_unidade('sate', unidade_id) and status in ('solicitado', 'confirmado')))
  with check (pode_escrever('sate')
              or (escreve_unidade('sate', unidade_id)
                  and status in ('solicitado', 'cancelado', 'pendente_cancelamento')));

create policy solic_del on solicitacao_transporte for delete
  using (pode_escrever('sate'));

drop policy if exists emb_sel on solicitacao_embarque;
drop policy if exists emb_ins on solicitacao_embarque;
drop policy if exists emb_upd on solicitacao_embarque;
drop policy if exists emb_del on solicitacao_embarque;

create policy emb_sel on solicitacao_embarque for select
  using (exists (select 1 from solicitacao_transporte s
                  where s.id = solicitacao_id and ve_solicitacao(s.id, s.unidade_id)));
-- Juntar escolas num mesmo onibus e decisao de quem aprova (spec D8).
create policy emb_ins on solicitacao_embarque for insert with check (pode_escrever('sate'));
create policy emb_upd on solicitacao_embarque for update
  using (pode_escrever('sate')) with check (pode_escrever('sate'));
create policy emb_del on solicitacao_embarque for delete using (pode_escrever('sate'));

grant select, insert, update, delete
  on frota_rotulo, frota, solicitacao_embarque to authenticated;

-- ── 8. Auditoria ─────────────────────────────────────────────
-- Desde a 032 a cobertura e por exclusao, mas migration e aplicada a
-- mao: sem esta linha as tabelas novas nascem sem gatilho.
select religar_auditoria();

select registrar_migration('035',
  'SATE v2: frota com vigencia por veiculo, ciclo de vida da solicitacao, pontos de embarque');
