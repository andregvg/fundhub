-- ============================================================
-- 037 - SATE: a participacao como unidade
-- Rode no SQL Editor do Supabase (apos a 036).
-- Spec: docs/superpowers/specs/2026-09-08-sate-participacao-design.md
--
-- EM UMA FRASE: uma viagem com tres escolas nao e de uma delas - e das
-- tres. O cabecalho parava de eleger uma como dona, e cada escola passa
-- a ser uma LINHA, com cota e situacao proprias.
--
-- O que isso destrava, e que o modelo antigo nao tinha como expressar:
-- uma escola cancelar a PROPRIA participacao, com as outras seguindo; e
-- o aprovador por outra escola no lugar e reordenar as paradas.
--
-- Idempotente: guardas em tudo, e o backfill so cria o que falta.
-- ============================================================

-- ── 1. `solicitacao_embarque` vira `solicitacao_participacao` ─
-- Nao e tabela nova: e a mesma, renomeada e completada. "Embarque"
-- descrevia um ponto no mapa; a linha virou um VINCULO com dono, cota e
-- situacao - e o nome passa a dizer isso.
do $$ begin
  if to_regclass('public.solicitacao_embarque') is not null
     and to_regclass('public.solicitacao_participacao') is null then
    alter table solicitacao_embarque rename to solicitacao_participacao;
  end if;
end $$;

create table if not exists solicitacao_participacao (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references solicitacao_transporte(id) on delete cascade,
  ordem          int  not null default 1,
  unidade_id     uuid references unidade_escolar(id) on delete set null,
  local_id       uuid references local(id) on delete set null,
  horario        text,
  qtd_alunos     int,
  criado_em      timestamptz not null default now()
);

alter table solicitacao_participacao
  add column if not exists qtd_cadeirante int not null default 0,
  add column if not exists status         text not null default 'ativa',
  add column if not exists motivo         text,
  add column if not exists decidido_por   text,
  add column if not exists decidido_em    timestamptz;

-- `qtd_alunos` nasceu anulavel na 035 (era so uma parada); agora e a
-- cota da escola e precisa de um numero.
alter table solicitacao_participacao alter column qtd_alunos set default 0;
update solicitacao_participacao set qtd_alunos = 0 where qtd_alunos is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'part_status_check') then
    alter table solicitacao_participacao add constraint part_status_check
      check (status in ('ativa', 'pendente_cancelamento', 'cancelada'));
  end if;
  -- Mesma regra da viagem, no mesmo lugar em que a viagem a tem: sair
  -- exige dizer por que. `not valid` para nao invalidar linha antiga.
  if not exists (select 1 from pg_constraint where conname = 'part_motivo_check') then
    alter table solicitacao_participacao add constraint part_motivo_check
      check (status = 'ativa'
             or (motivo is not null and length(trim(motivo)) > 0)) not valid;
  end if;
end $$;

create index if not exists idx_part_solic   on solicitacao_participacao (solicitacao_id);
create index if not exists idx_part_unidade on solicitacao_participacao (unidade_id);
-- A ordem e unica DENTRO da viagem: duas paradas com o mesmo numero
-- deixariam a ficha do motorista ambigua.
create unique index if not exists idx_part_ordem
  on solicitacao_participacao (solicitacao_id, ordem);

-- ── 2. Backfill: toda viagem existente ganha sua participacao ─
-- O cabecalho ja tinha escola, alunos, cadeirantes e horario - e essa
-- linha e exatamente a participacao que estava implicita nele.
insert into solicitacao_participacao
  (solicitacao_id, ordem, unidade_id, qtd_alunos, qtd_cadeirante, horario, status)
select s.id, 1, s.unidade_id, coalesce(s.qtd_alunos, 0), coalesce(s.qtd_cadeirante, 0),
       s.horario_embarque,
       -- Viagem ja encerrada nasce com a participacao no mesmo estado,
       -- senao o historico diria que a escola seguia dentro de algo que
       -- foi negado.
       case when s.status in ('negado', 'cancelado') then 'cancelada' else 'ativa' end
  from solicitacao_transporte s
 where s.unidade_id is not null
   and not exists (select 1 from solicitacao_participacao p
                    where p.solicitacao_id = s.id and p.unidade_id = s.unidade_id);

-- A constraint de motivo e `not valid`, entao as canceladas do backfill
-- (sem motivo) passam - mas deixar o campo vazio esconderia o porque.
update solicitacao_participacao p
   set motivo = coalesce(p.motivo, s.motivo, 'Encerrada junto com a viagem.')
  from solicitacao_transporte s
 where s.id = p.solicitacao_id and p.status = 'cancelada' and p.motivo is null;

-- As paradas que existiam como "embarque" viram participacoes da ordem
-- 2 em diante - a 1 e a escola que abriu.
update solicitacao_participacao set ordem = ordem + 1
 where ordem = 1
   and id <> (select p2.id from solicitacao_participacao p2
               where p2.solicitacao_id = solicitacao_participacao.solicitacao_id
               order by p2.criado_em limit 1);

-- ── 3. Cabecalho: derivadas mantidas por gatilho ─────────────
-- A VERDADE e a participacao. `qtd_alunos`/`qtd_cadeirante` no cabecalho
-- viram cache, porque saldo_transporte(), o Dashboard e o modulo Viagens
-- somam por VIAGEM - e nenhum deles deveria aprender a fazer join para
-- responder "quantos alunos vao".
create or replace function fn_sincronizar_totais_viagem() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_solic uuid;
begin
  v_solic := coalesce(new.solicitacao_id, old.solicitacao_id);
  update solicitacao_transporte s
     set qtd_alunos = coalesce((select sum(p.qtd_alunos) from solicitacao_participacao p
                                 where p.solicitacao_id = v_solic and p.status = 'ativa'), 0),
         qtd_cadeirante = coalesce((select sum(p.qtd_cadeirante) from solicitacao_participacao p
                                     where p.solicitacao_id = v_solic and p.status = 'ativa'), 0)
   where s.id = v_solic;
  return null;
end $$;

drop trigger if exists trg_totais_viagem on solicitacao_participacao;
create trigger trg_totais_viagem
  after insert or update or delete on solicitacao_participacao
  for each row execute function fn_sincronizar_totais_viagem();

-- Uma passada agora, para o cache nascer certo nas viagens antigas.
update solicitacao_transporte s
   set qtd_alunos = coalesce((select sum(p.qtd_alunos) from solicitacao_participacao p
                               where p.solicitacao_id = s.id and p.status = 'ativa'), 0),
       qtd_cadeirante = coalesce((select sum(p.qtd_cadeirante) from solicitacao_participacao p
                                   where p.solicitacao_id = s.id and p.status = 'ativa'), 0)
 where exists (select 1 from solicitacao_participacao p where p.solicitacao_id = s.id);

-- `unidade_id` deixa de ser "a escola dona" e passa a ser "a escola que
-- ABRIU o pedido" - nula quando foi a Gerencia que montou a viagem. Ela
-- sobrevive porque a policy de insert precisa decidir no momento em que
-- a linha nasce, e as participacoes so existem depois.
comment on column solicitacao_transporte.unidade_id is
  'Escola que ABRIU o pedido (nula quando a Gerencia montou a viagem). Nao e dona: posse, visibilidade e cancelamento vem de solicitacao_participacao.';
alter table solicitacao_transporte alter column unidade_id drop not null;

-- ── 4. Envolvimento vira ESTRUTURA, nao mais uma regra ───────
-- Antes: "e a escola do cabecalho OU tem um embarque". A pergunta
-- existia porque havia dois lugares dizendo a mesma coisa.
create or replace function ve_solicitacao(p_solicitacao uuid, p_unidade uuid)
  returns boolean
  language sql stable security definer set search_path = public as $$
    select case nivel_modulo('sate')
      when 'oculto'   then false
      -- Participacao CANCELADA tambem enxerga: a escola que desistiu
      -- precisa continuar vendo que o agendamento dela foi cancelado.
      when 'proprios' then
        exists (select 1 from solicitacao_participacao p
                 where p.solicitacao_id = p_solicitacao
                   and p.unidade_id in (select minhas_unidades()))
        -- A escola que abriu ve desde o primeiro instante, antes de a
        -- participacao existir - senao ela perderia a propria linha
        -- entre o insert do cabecalho e o da participacao.
        or p_unidade in (select minhas_unidades())
      else true
    end
  $$;
grant execute on function ve_solicitacao(uuid, uuid) to authenticated;

-- ── 5. RLS da participacao ───────────────────────────────────
alter table solicitacao_participacao enable row level security;
alter table solicitacao_participacao force row level security;

drop policy if exists emb_sel on solicitacao_participacao;
drop policy if exists emb_ins on solicitacao_participacao;
drop policy if exists emb_upd on solicitacao_participacao;
drop policy if exists emb_del on solicitacao_participacao;
drop policy if exists part_sel on solicitacao_participacao;
drop policy if exists part_ins on solicitacao_participacao;
drop policy if exists part_upd on solicitacao_participacao;
drop policy if exists part_del on solicitacao_participacao;

create policy part_sel on solicitacao_participacao for select
  using (exists (select 1 from solicitacao_transporte s
                  where s.id = solicitacao_id and ve_solicitacao(s.id, s.unidade_id)));

-- Acrescentar escola a uma viagem e decisao da Gerencia. A excecao e a
-- escola criando a PROPRIA participacao no pedido que ela mesma abriu -
-- que e o caminho normal de uma solicitacao de escola.
create policy part_ins on solicitacao_participacao for insert
  with check (pode_escrever('sate')
              or (unidade_id in (select minhas_unidades())
                  and exists (select 1 from solicitacao_transporte s
                               where s.id = solicitacao_id
                                 and s.unidade_id in (select minhas_unidades()))));

-- A escola so mexe na PROPRIA linha, e so para pedir para sair.
create policy part_upd on solicitacao_participacao for update
  using (pode_escrever('sate') or unidade_id in (select minhas_unidades()))
  with check (pode_escrever('sate')
              or (unidade_id in (select minhas_unidades())
                  and status in ('ativa', 'pendente_cancelamento')));

create policy part_del on solicitacao_participacao for delete using (pode_escrever('sate'));

grant select, insert, update, delete on solicitacao_participacao to authenticated;

-- ── 6. Saldo: so participacao ATIVA conta ────────────────────
-- O cabecalho ja e mantido pelo gatilho, entao a conta de onibus nao
-- muda - mas a de vans passa a somar as participacoes ativas.
create or replace function saldo_transporte(p_data date) returns jsonb
  language sql stable security definer set search_path = public as $$
    with permitido as (select pode_ver('sate') as ok),
    total as (
      select f.tipo, sum(f.quantidade)::int as qtd
        from frota f
       where f.inicio <= p_data and (f.fim is null or f.fim >= p_data)
       group by f.tipo
    ),
    uso as (
      select s.periodo,
             sum(coalesce(s.qtd_onibus, 0))::int as onibus,
             sum(coalesce(s.qtd_vans, 0))::int   as vans
        from solicitacao_transporte s
       where s.data = p_data
         and s.status in ('em_analise', 'aguardando_transporte_adaptado', 'confirmado')
       group by s.periodo
    )
    select case when (select ok from permitido) then
      jsonb_build_object(
        'onibus', (
          select jsonb_object_agg(p.periodo, jsonb_build_object(
            'total', coalesce((select qtd from total where tipo = 'onibus'), 0),
            'uso',   coalesce((select onibus from uso where uso.periodo = p.periodo), 0)))
          from (values ('manha'), ('tarde'), ('noite')) as p(periodo)),
        'van_adaptada', (
          select jsonb_object_agg(p.periodo, jsonb_build_object(
            'total', coalesce((select qtd from total where tipo = 'van_adaptada'), 0),
            'uso',   coalesce((select vans from uso where uso.periodo = p.periodo), 0)))
          from (values ('manha'), ('tarde'), ('noite')) as p(periodo))
      )
    else null end
  $$;
grant execute on function saldo_transporte(date) to authenticated;

-- ── 7. Criar viagem + participacao numa transacao ────────────
-- Uma escola pedindo transporte e UM ato, e ele nasce em duas tabelas.
-- Em duas chamadas do PostgREST, uma falha no meio deixaria uma viagem
-- sem ninguem dentro - visivel so para quem escreve, com zero alunos, e
-- sem nada na tela explicando de onde veio.
--
-- Sem `security definer`: as duas insercoes passam pelas policies, que e
-- o ponto. A escola so consegue criar a participacao dela porque
-- `part_ins` deixa, nao porque a funcao contorna.
--
-- jsonb em vez de 17 parametros posicionais: a lista de colunas da
-- solicitacao muda, e uma assinatura com 17 argumentos quebra a cada
-- coluna nova.
create or replace function criar_viagem(p_viagem jsonb, p_participacao jsonb)
  returns solicitacao_transporte
  language plpgsql volatile set search_path = public as $$
declare v solicitacao_transporte;
begin
  insert into solicitacao_transporte
  select * from jsonb_populate_record(null::solicitacao_transporte,
    p_viagem || jsonb_build_object(
      'id', gen_random_uuid(),
      'status', 'solicitado',
      'criado_por', auth_email(),
      'criado_em', now(),
      'atualizado_em', now()))
  returning * into v;

  insert into solicitacao_participacao
  select * from jsonb_populate_record(null::solicitacao_participacao,
    p_participacao || jsonb_build_object(
      'id', gen_random_uuid(),
      'solicitacao_id', v.id,
      'ordem', 1,
      'status', 'ativa',
      'criado_em', now()));

  -- O gatilho de totais ja rodou; rele para devolver os numeros certos.
  select * into v from solicitacao_transporte where id = v.id;
  return v;
end $$;

grant execute on function criar_viagem(jsonb, jsonb) to authenticated;

-- ── 8. Auditoria ─────────────────────────────────────────────
select religar_auditoria();

select registrar_migration('037',
  'SATE: participacao como unidade - cancelamento por escola, ordem e envolvimento estrutural');
