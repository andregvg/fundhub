-- ============================================================
-- 048 - SATE: avisos que ficam ate serem abertos
--
-- Spec: 2026-10-10-sate-notificacoes-design.md.
--
-- Ate aqui o aviso do sino era um eco do Realtime: nascia no navegador de
-- quem estava online, a partir da linha crua que mudou, e morria ao
-- recarregar. Para "ficar ate ser aberto" ele precisa existir no banco, e
-- para "nao avisar quem fez" o banco precisa saber QUEM fez.
--
-- Duas coisas guardadas, e so duas:
--   solicitacao_aviso  o FATO ("aconteceu X na solicitacao Y, feito por Z").
--                      Um por fato, nao um por destinatario. So gatilho
--                      escreve: ninguem forja aviso.
--   solicitacao_visto  quando cada pessoa ABRIU cada solicitacao. Nao lido =
--                      aviso mais novo que o visto dela naquela solicitacao.
--
-- A leitura do "por ver" e a funcao avisos_por_ver (secao 2): o banco faz a
-- conta (tipos que a pessoa quer, nao feitos por ela, mais novos que o
-- visto), em vez de o navegador filtrar os N fatos mais recentes.
--
-- QUEM RECEBE nao e gravado: recebe quem pode ver a solicitacao (o RLS
-- decide na leitura), menos quem fez. Sem lista de destinatarios para
-- manter, e mudar a permissao de alguem vale no mesmo instante.
--
-- O aviso NUNCA impede a acao: a insercao fica num bloco protegido. Se
-- falhar, a decisao e gravada do mesmo jeito e o banco registra um alerta.
--
-- Idempotente.
-- ============================================================

-- ── 1. O fato ────────────────────────────────────────────────
create table if not exists solicitacao_aviso (
  id             bigint generated always as identity primary key,
  solicitacao_id uuid not null references solicitacao_transporte(id) on delete cascade,
  tipo           text not null,
  unidade_id     uuid references unidade_escolar(id) on delete set null,  -- a escola da parada, nos avisos de parada
  autor          text,                                                    -- auth_email() de quem fez
  em             timestamptz not null default now()
);
create index if not exists idx_solic_aviso_em    on solicitacao_aviso(em desc);
create index if not exists idx_solic_aviso_solic on solicitacao_aviso(solicitacao_id);

-- Lista FECHADA de tipos. Os sete status entram todos (inclusive
-- `solicitado`, que hoje nenhuma transicao produz) para que um status
-- gravado por qualquer via nunca caia fora da lista.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solic_aviso_tipo_check') then
    alter table solicitacao_aviso add constraint solic_aviso_tipo_check
      check (tipo in ('nova', 'solicitado', 'em_analise', 'aguardando_transporte_adaptado',
                      'confirmado', 'negado', 'cancelado', 'pendente_cancelamento',
                      'reaberta', 'editada',
                      'parada_acrescentada', 'saida_pedida', 'saida_confirmada'));
  end if;
end $$;

-- RLS habilitado mas NAO forcado, como em audit_log (011): o gatilho e
-- SECURITY DEFINER e roda como dono da tabela, que e isento - o insert do
-- gatilho passa e o usuario comum nao escreve. Le quem enxerga a
-- solicitacao: a subconsulta passa pelo RLS da propria solicitacao.
alter table solicitacao_aviso enable row level security;
drop policy if exists solic_aviso_sel on solicitacao_aviso;
create policy solic_aviso_sel on solicitacao_aviso for select to authenticated
  using (exists (select 1 from solicitacao_transporte s
                  where s.id = solicitacao_aviso.solicitacao_id));
grant select on solicitacao_aviso to authenticated;   -- sem insert/update/delete de proposito

-- ── 2. O visto ───────────────────────────────────────────────
create table if not exists solicitacao_visto (
  email          text not null,
  solicitacao_id uuid not null references solicitacao_transporte(id) on delete cascade,
  visto_em       timestamptz not null default now(),
  primary key (email, solicitacao_id)
);

alter table solicitacao_visto enable row level security;
alter table solicitacao_visto force  row level security;
drop policy if exists solic_visto_sel on solicitacao_visto;
drop policy if exists solic_visto_ins on solicitacao_visto;
drop policy if exists solic_visto_upd on solicitacao_visto;
create policy solic_visto_sel on solicitacao_visto for select using (email = auth_email());
create policy solic_visto_ins on solicitacao_visto for insert with check (email = auth_email());
create policy solic_visto_upd on solicitacao_visto for update using (email = auth_email())
  with check (email = auth_email());
grant select, insert, update on solicitacao_visto to authenticated;

-- A hora do visto e a do BANCO, nao a do navegador: o aviso e carimbado
-- com now() pelo gatilho, e comparar com um relogio de cliente adiantado
-- ou atrasado marcaria como lido o que nao foi (ou o contrario). Sem
-- `security definer`: passa pelas policies acima, e so grava a propria linha.
create or replace function marcar_solicitacao_vista(p_solicitacao uuid) returns timestamptz
  language sql volatile set search_path = public as $$
    insert into solicitacao_visto (email, solicitacao_id, visto_em)
    values (auth_email(), p_solicitacao, now())
    on conflict (email, solicitacao_id) do update set visto_em = excluded.visto_em
    returning visto_em
  $$;
grant execute on function marcar_solicitacao_vista(uuid) to authenticated;

-- O que esta por ver, para QUEM PERGUNTA. A conta e do banco, e nao do
-- navegador: quem aprova enxerga a rede inteira, e ler "os N fatos mais
-- recentes" para filtrar na tela deixaria cair, em silencio, o aviso de
-- uma solicitacao nova ainda nao aberta - e a regra e que ele so some
-- quando a pessoa abre a solicitacao.
--
-- Sai so: os tipos que a pessoa quer (p_tipos - quem monta e o front, a
-- partir do nivel dela e das preferencias); o que NAO foi ela que fez; e o
-- que e mais novo que o "visto" dela naquela solicitacao. Ja vem com os
-- dados da solicitacao para o texto do aviso.
--
-- Sem `security definer`: passa pelo RLS das tres tabelas - a pessoa so
-- recebe aviso de solicitacao que enxerga. p_id (opcional) pergunta por UM
-- aviso: e o que o front usa quando ele chega pelo Realtime.
create or replace function avisos_por_ver(p_tipos text[], p_id bigint default null)
  returns table (
    id bigint, solicitacao_id uuid, tipo text, unidade_id uuid, autor text, em timestamptz,
    solic_data date, solic_destino text, solic_atividade text, solic_unidade uuid)
  language sql stable set search_path = public as $$
    select a.id, a.solicitacao_id, a.tipo, a.unidade_id, a.autor, a.em,
           s.data, s.destino_nome, s.atividade_livre, s.unidade_id
      from solicitacao_aviso a
      join solicitacao_transporte s on s.id = a.solicitacao_id
      left join solicitacao_visto v
        on v.solicitacao_id = a.solicitacao_id and v.email = auth_email()
     where a.tipo = any(p_tipos)
       and (p_id is null or a.id = p_id)
       and a.autor is distinct from auth_email()
       and a.em > coalesce(v.visto_em, '-infinity'::timestamptz)
       and a.em >= now() - interval '60 days'
     order by a.em desc
     limit 300
  $$;
grant execute on function avisos_por_ver(text[], bigint) to authenticated;

-- ── 3. Os gatilhos que registram o fato ──────────────────────
-- Funcao de gatilho nao pode ser chamada por RPC: o unico caminho para uma
-- linha de aviso e uma mudanca REAL na solicitacao ou na participacao.
--
-- O que NAO gera aviso, de proposito:
--   - o recalculo dos totais do cabecalho (cache das participacoes, 037);
--   - a troca de destino ao conferir um local (para a escola, o lugar e o mesmo);
--   - turma, responsavel, observacao.
create or replace function fn_sate_aviso_solic() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_tipo text;
begin
  if tg_op = 'INSERT' then
    v_tipo := 'nova';
  elsif new.status is distinct from old.status then
    v_tipo := case when new.status = 'em_analise' and old.status in ('confirmado', 'negado', 'cancelado')
                   then 'reaberta' else new.status end;
  elsif (new.data, new.horario_embarque, new.horario_retorno)
        is distinct from (old.data, old.horario_embarque, old.horario_retorno) then
    v_tipo := 'editada';
  end if;

  if v_tipo is not null then
    begin
      insert into solicitacao_aviso (solicitacao_id, tipo, autor)
      values (new.id, v_tipo, auth_email());
    exception when others then
      raise warning 'SATE: aviso "%" nao registrado: %', v_tipo, sqlerrm;
    end;
  end if;
  return null;
end $$;

drop trigger if exists trg_sate_aviso_solic on solicitacao_transporte;
create trigger trg_sate_aviso_solic
  after insert or update on solicitacao_transporte
  for each row execute function fn_sate_aviso_solic();

-- A primeira participacao nasce junto com a viagem (criar_viagem acende a
-- marca de transacao `sate.criar_viagem`): o aviso `nova` ja diz tudo, e
-- um `parada_acrescentada` a mais seria ruido.
create or replace function fn_sate_aviso_part() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_tipo text;
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('sate.criar_viagem', true), '') <> '1' then
      v_tipo := 'parada_acrescentada';
    end if;
  elsif new.status is distinct from old.status then
    v_tipo := case new.status when 'pendente_cancelamento' then 'saida_pedida'
                              when 'cancelada'             then 'saida_confirmada' end;
  end if;

  if v_tipo is not null then
    begin
      insert into solicitacao_aviso (solicitacao_id, tipo, unidade_id, autor)
      values (new.solicitacao_id, v_tipo, new.unidade_id, auth_email());
    exception when others then
      raise warning 'SATE: aviso "%" nao registrado: %', v_tipo, sqlerrm;
    end;
  end if;
  return null;
end $$;

drop trigger if exists trg_sate_aviso_part on solicitacao_participacao;
create trigger trg_sate_aviso_part
  after insert or update on solicitacao_participacao
  for each row execute function fn_sate_aviso_part();

-- ── 4. Realtime ──────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'solicitacao_aviso'
  ) then
    alter publication supabase_realtime add table solicitacao_aviso;
  end if;
end $$;

-- ── 5. Auditoria: as duas tabelas ficam de fora ──────────────
-- Espelhada em ISENTAS_AUDITORIA (.claude/scripts/verificar_arquitetura.py).
create or replace function _audit_isentas() returns text[]
  language sql immutable as $$ select array[
    'audit_log',            -- auditar o log e recursao sem valor
    'evento_log',           -- idem
    'preferencia_usuario',  -- preferencia pessoal de tela; ruido puro
    'schema_migrations',    -- metadado de infraestrutura, nao cadastro
    'solicitacao_aviso',    -- log de um fato ja auditado na origem (a solicitacao)
    'solicitacao_visto'     -- estado pessoal de leitura; ruido puro
  ] $$;

-- religar_auditoria() so CRIA o gatilho nas nao isentas; se uma execucao
-- anterior ja o tiver posto nestas duas, sai aqui.
drop trigger if exists trg_audit on solicitacao_aviso;
drop trigger if exists trg_audit on solicitacao_visto;

select religar_auditoria();

select registrar_migration('048',
  'SATE: avisos persistentes (solicitacao_aviso por gatilho) e leitura por pessoa (solicitacao_visto)');

-- ── Conferencia (rodar a mao, se quiser) ─────────────────────
-- Pelo APP (precisa do login - no SQL Editor auth_email() e nulo): crie um
-- pedido de teste, negue, reabra e mude a data. Depois, aqui:
--   select tipo, autor is not null as tem_autor, em
--     from solicitacao_aviso order by em desc limit 10;
-- Esperado, do mais novo para o mais antigo: editada, reaberta, negado, nova.
