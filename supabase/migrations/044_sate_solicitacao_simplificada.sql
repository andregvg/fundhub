-- ============================================================
-- 044 - SATE: solicitacao simplificada (spec 2026-09-27)
-- Destino em partes, responsavel pela visita, acessibilidade por
-- escola, periodo derivado dos horarios (com 'integral' = manha e
-- tarde) e tempo de viagem provisorio para local a conferir.
-- Pre-requisito: 042 e 043. Idempotente.
-- ============================================================

alter table solicitacao_transporte
  add column if not exists destino_numero     text,
  add column if not exists destino_bairro     text,
  add column if not exists professor_nome     text,
  add column if not exists professor_telefone text;

alter table solicitacao_participacao
  add column if not exists qtd_surdo              int     not null default 0,
  add column if not exists necessidade_especifica boolean not null default false;

alter table local
  add column if not exists numero text,
  add column if not exists bairro text;

-- O CHECK de periodo nasceu inline na 004 (nome gerado pelo Postgres).
-- Derruba qualquer CHECK de solicitacao_transporte que fale de periodo e
-- recria com 'integral'.
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'solicitacao_transporte'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%periodo%' loop
    execute format('alter table solicitacao_transporte drop constraint %I', c);
  end loop;
end $$;
alter table solicitacao_transporte
  add constraint solicitacao_transporte_periodo_check
  check (periodo in ('manha', 'tarde', 'noite', 'integral'));

-- ── Periodo calculado (D4) ────────────────────────────────────
-- ESPELHO de periodoDe() (regras.model.js). Mudou aqui, mude la.
create or replace function _sate_periodo(p_emb int, p_ret int) returns text
  language sql immutable set search_path = public as $$
    select case
      when p_emb is null  then null
      when p_emb >= 1080  then 'noite'
      when p_emb >= 720   then 'tarde'
      when p_ret is not null and p_ret > 720 then 'integral'
      else 'manha' end
  $$;
grant execute on function _sate_periodo(int, int) to authenticated;

-- O intervalo que uma viagem ocupa, em minutos desde 00:00 do dia dela.
-- ESPELHO de intervaloDaViagem() em disponibilidade.model.js - mudou
-- aqui, mude la (e o teste tests/sate-disponibilidade.test.mjs).
--   manha/integral/tarde: embarque ate retorno + trajeto + intervalo
--   noite:       idem, mas nunca antes das 12:00 do dia seguinte (2160)
--   sem horario: a janela do periodo (manha 0-720, integral 0-1080,
--                tarde 720-1080, noite 1080-2160)
create or replace function _sate_intervalo(
  p_periodo text, p_emb int, p_ret int, p_trajeto int, p_intervalo int,
  out ini int, out fim int)
  language plpgsql immutable set search_path = public as $$
declare
  j_ini int := case p_periodo when 'manha' then 0   when 'integral' then 0    when 'tarde' then 720  else 1080 end;
  j_fim int := case p_periodo when 'manha' then 720 when 'integral' then 1080 when 'tarde' then 1080 else 2160 end;
  r int := p_ret;
begin
  ini := coalesce(p_emb, j_ini);
  if r is null then
    fim := j_fim;
  else
    if p_periodo = 'noite' and r < ini then r := r + 1440; end if;
    if r <= ini then fim := j_fim;
    else fim := r + coalesce(p_trajeto, 0) + coalesce(p_intervalo, 0);
    end if;
  end if;
  if p_periodo = 'noite' then fim := greatest(fim, 2160); end if;
  if fim <= ini then fim := ini + 1; end if;
end $$;

-- O periodo e CALCULADO (spec D4): a escola nao informa, e quem aprova
-- nao consegue gravar um periodo que contradiga os horarios. Sem
-- embarque (pedido antigo), fica o que estava.
create or replace function fn_sate_periodo() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.horario_embarque is not null then
    new.periodo := _sate_periodo(_sate_min(new.horario_embarque), _sate_min(new.horario_retorno));
  end if;
  return new;
end $$;

drop trigger if exists trg_sate_periodo on solicitacao_transporte;
create trigger trg_sate_periodo
  before insert or update of horario_embarque, horario_retorno, periodo on solicitacao_transporte
  for each row execute function fn_sate_periodo();

-- (Gatilhos BEFORE disparam em ordem alfabetica: trg_sate_guarda_escola
-- roda antes de trg_sate_periodo. A escola nao altera horarios, entao a
-- guarda nao e afetada.)

-- ── Ocupacao anonima: trajeto provisorio para local a conferir ──
-- `security definer` pelo mesmo motivo do saldo_transporte (036): a escola
-- so le os pedidos em que esta envolvida, e somar pelo cliente daria a
-- ela o proprio uso e mais nada. Devolve SO quando e quanto - nem id, nem
-- escola, nem destino.
--
-- Cobre de p_de - 1 (a noite anterior ocupa a manha de p_de) a p_ate + 1
-- (um pedido da noite de p_ate ocupa a manha seguinte).
-- O intervalo pedido e limitado a 62 dias (a pagina pede 7, o formulario 1):
-- sem o limite, um p_ate menor que p_de ou um intervalo enorme faria o
-- generate_series e a agregacao abaixo custarem sem necessidade. Fora do
-- limite a funcao devolve null - lerOcupacao() (disponibilidade.model.js)
-- ja trata null como falha e cai na aproximacao por periodo.
create or replace function ocupacao_transporte(p_de date, p_ate date, p_excluir uuid default null)
  returns jsonb language sql stable security definer set search_path = public as $$
    with permitido as (
      select (pode_ver('sate') and p_ate >= p_de and (p_ate - p_de) <= 62) as ok
    ),
    cfg as (select _sate_conf_int('intervalo_min_periodos', 120) as intervalo,
                    _sate_conf_int('trajeto_provisorio_min', 60) as provisorio),
    dias as (
      select d::date as data, (d::date - p_de) as dia
        from generate_series(p_de - 1, p_ate + 1, interval '1 day') d
    ),
    frota_dia as (
      select dd.dia,
             coalesce(sum(f.quantidade) filter (where f.tipo = 'onibus'), 0)::int       as onibus,
             coalesce(sum(f.quantidade) filter (where f.tipo = 'van_adaptada'), 0)::int as vans
        from dias dd
        left join frota f on f.inicio <= dd.data and (f.fim is null or f.fim >= dd.data)
       group by dd.dia
    ),
    viagens as (
      select (s.data - p_de) as dia, s.periodo,
             -- Local a conferir (sem local_id) e sem trajeto: tempo de
             -- viagem provisorio, cauteloso (spec D6) - a vaga fica
             -- superestimada ate a SME conferir o local.
             coalesce(s.trajeto_min,
                      case when s.local_id is null then (select provisorio from cfg) end) as trajeto_min,
             _sate_min(s.horario_retorno) as ret,
             -- O embarque e o MAIS CEDO entre o cabecalho e as paradas
             -- ativas: o onibus sai para a primeira parada.
             least(_sate_min(s.horario_embarque),
                   (select min(_sate_min(p.horario)) from solicitacao_participacao p
                     where p.solicitacao_id = s.id and p.status = 'ativa')) as emb,
             coalesce(s.qtd_onibus, 0) as onibus, coalesce(s.qtd_vans, 0) as vans
        from solicitacao_transporte s
       where s.data between p_de - 1 and p_ate + 1
         and s.status in ('solicitado', 'em_analise', 'aguardando_transporte_adaptado', 'confirmado')
         and (p_excluir is null or s.id <> p_excluir)
    )
    select case when (select ok from permitido) then jsonb_build_object(
      'intervalo_min', (select intervalo from cfg),
      'frota', coalesce((select jsonb_agg(jsonb_build_object(
                 'dia', dia, 'onibus', onibus, 'vans', vans) order by dia) from frota_dia), '[]'::jsonb),
      'ocupacoes', coalesce((select jsonb_agg(jsonb_build_object(
                 'dia', v.dia, 'ini', i.ini, 'fim', i.fim, 'onibus', v.onibus, 'vans', v.vans))
                 from viagens v
                 cross join lateral _sate_intervalo(v.periodo, v.emb, v.ret, v.trajeto_min,
                                                    (select intervalo from cfg)) i
                where v.onibus + v.vans > 0), '[]'::jsonb)
    ) else null end
  $$;
grant execute on function ocupacao_transporte(date, date, uuid) to authenticated;

-- ── Criar viagem: periodo derivado e trajeto provisorio ──────
-- Para quem ESCREVE no SATE nada muda: passar do limite e aviso, e a
-- frota extra nasce na confirmacao (040). Para a escola:
--   - horarios obrigatorios (sem eles nao ha intervalo a conferir);
--   - veiculos RECALCULADOS aqui - o numero da tela nao vale;
--   - trava por TODOS os dias que o intervalo do pedido toca (a noite
--     trava tambem o dia seguinte): dois pedidos que se cruzam entram em
--     fila, e o segundo ja enxerga o primeiro (que, desde a 042, reserva);
--   - falta de onibus recusa; falta de van nao (a Gerencia providencia).
--
-- Sem `security definer`: as insercoes continuam passando pelas policies
-- (e pelos gatilhos de guarda da 042 - a marca de transacao que abre
-- passagem por eles nasce aqui, logo no comeco da funcao).
create or replace function criar_viagem(p_viagem jsonb, p_participacao jsonb)
  returns solicitacao_transporte
  language plpgsql volatile set search_path = public as $$
declare
  v solicitacao_transporte;
  v_data date; v_per text; v_emb int; v_ret int;
  v_usa boolean := true; v_onibus int; v_vans int;
  v_ini int; v_fim int; v_vagas jsonb; d int;
begin
  -- Marca de transacao que so esta funcao acende (spec D7, "Sem atalho
  -- pela API"): e o que fn_sate_guarda_escola()/fn_sate_guarda_participacao()
  -- exigem para deixar passar o insert de quem nao escreve no SATE. O
  -- PostgREST nao expoe set_config - a escola nao tem como forjar a marca
  -- chamando a tabela direto. Local da transacao (terceiro argumento
  -- true): nao vaza para a proxima chamada na mesma conexao.
  perform set_config('sate.criar_viagem', '1', true);

  if not pode_escrever('sate') then
    v_data := (p_viagem->>'data')::date;
    v_emb  := _sate_min(p_viagem->>'horario_embarque');
    v_ret  := _sate_min(p_viagem->>'horario_retorno');
    if v_emb is null or v_ret is null then
      raise exception 'Informe o horario de embarque e o de retorno.' using errcode = '23502';
    end if;
    -- O periodo gravado vem do gatilho trg_sate_periodo (D4) - aqui e so
    -- para calcular o intervalo que a barreira de vagas confere.
    v_per := _sate_periodo(v_emb, v_ret);

    -- Mesmo criterio de ocupacao_transporte: o embarque e o MAIS CEDO
    -- entre o cabecalho e a participacao (least ignora nulo) - senao o
    -- intervalo calculado aqui divergiria do usado depois para contar a
    -- ocupacao deste proprio pedido. O obrigatorio continua sendo o
    -- campo do cabecalho, ja conferido acima.
    v_emb := least(v_emb, _sate_min(p_participacao->>'horario'));

    if (p_viagem->>'atividade_id') is not null then
      select coalesce(a.usa_onibus, true) into v_usa
        from atividade_extraclasse a where a.id = (p_viagem->>'atividade_id')::uuid;
    end if;
    v_onibus := case when coalesce(v_usa, true)
      then ceil(coalesce((p_participacao->>'qtd_alunos')::int, 0)::numeric
                / greatest(1, _sate_conf_int('capacidade_onibus', 44)))::int
      else 0 end;
    v_vans := ceil(coalesce((p_participacao->>'qtd_cadeirante')::int, 0)::numeric
                   / greatest(1, _sate_conf_int('capacidade_van', 2)))::int;
    p_viagem := p_viagem || jsonb_build_object('qtd_onibus', v_onibus, 'qtd_vans', v_vans);

    -- Local a conferir (sem local_id) e sem trajeto informado: tempo de
    -- viagem provisorio, cauteloso (spec D6) - a vaga fica superestimada
    -- ate a SME conferir o local.
    select i.ini, i.fim into v_ini, v_fim
      from _sate_intervalo(v_per, v_emb, v_ret,
                           coalesce((p_viagem->>'trajeto_min')::int,
                                    case when p_viagem->>'local_id' is null
                                         then _sate_conf_int('trajeto_provisorio_min', 60) end),
                           _sate_conf_int('intervalo_min_periodos', 120)) i;

    -- Trava TODOS os dias que o intervalo do pedido toca, em ordem
    -- crescente - sem deadlock (spec D7, "A trava cobre todos os dias").
    -- Um pedido da noite ocupa tambem a manha seguinte (D5): travar so a
    -- data deixaria dois pedidos da mesma noite passarem juntos pelo dia
    -- extra.
    for d in 0 .. floor((v_fim - 1) / 1440.0)::int loop
      perform pg_advisory_xact_lock(hashtext('sate-vagas'), ((v_data + d) - date '2000-01-01'));
    end loop;

    v_vagas := vagas_transporte(v_data, v_ini, v_fim, null);
    if v_onibus > coalesce((v_vagas->>'onibus')::int, 0) then
      raise exception 'Sem onibus livres para este horario.' using errcode = 'P0001';
    end if;
  end if;

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

  select * into v from solicitacao_transporte where id = v.id;
  return v;
end $$;
grant execute on function criar_viagem(jsonb, jsonb) to authenticated;

-- ── Guarda da escola: destino em partes tambem e travado ──────
-- R15: a barreira so vale por inteiro se nao houver outro caminho. A
-- escola tem INSERT/UPDATE via RLS em solicitacao_transporte (035) e
-- solicitacao_participacao (037) - ela precisa disso para abrir e
-- cancelar o proprio pedido -, o que deixaria criar_viagem() como um
-- atalho a mais, nao a unica porta. O gatilho abaixo fecha essa brecha
-- para PEDIDO DE USUARIO LOGADO PELA API que nao escreve no SATE (spec
-- D7). A guarda e so para isso: o SQL Editor do painel e uma Edge
-- Function futura com service_role nao carregam um JWT de usuario final
-- (claim `role` <> 'authenticated') e passam direto, como manutencao
-- confiavel. Quem escreve no SATE (`pode_escrever`) tambem segue livre,
-- inclusive por SQL direto, porque a frota extra dela e aviso, e e assim
-- que tem que ser.
create or replace function fn_sate_guarda_escola() returns trigger
  language plpgsql set search_path = public as $$
begin
  -- So vale para requisicao de usuario final pela API (anon nem chega
  -- aqui - RLS ja barra). SQL Editor / service_role nao tem esse claim.
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;
  if pode_escrever('sate') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(current_setting('sate.criar_viagem', true), '') <> '1' then
      raise exception 'Pedido de transporte so nasce pelo formulario do SATE.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: a escola so muda situacao e motivo (cancelar, pedir
  -- cancelamento) - nunca data, horario, veiculo, trajeto ou destino do
  -- pedido (nome e endereco em partes inclusos - sem eles a guarda
  -- deixava o destino passar). qtd_alunos/qtd_cadeirante ficam de fora de
  -- proposito: quem os escreve e o gatilho definer de totais
  -- (fn_sincronizar_totais_viagem, 037), que roda com o JWT da escola
  -- ainda ativo na sessao.
  if (new.data, new.periodo, new.horario_embarque, new.horario_retorno,
      new.qtd_onibus, new.qtd_vans, new.trajeto_min, new.unidade_id,
      new.atividade_id, new.local_id, new.destino_nome, new.destino_endereco,
      new.destino_numero, new.destino_bairro)
     is distinct from
     (old.data, old.periodo, old.horario_embarque, old.horario_retorno,
      old.qtd_onibus, old.qtd_vans, old.trajeto_min, old.unidade_id,
      old.atividade_id, old.local_id, old.destino_nome, old.destino_endereco,
      old.destino_numero, old.destino_bairro) then
    raise exception 'A escola nao altera data, horario, destino nem veiculos de um pedido.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_sate_guarda_escola on solicitacao_transporte;
create trigger trg_sate_guarda_escola
  before insert or update on solicitacao_transporte
  for each row execute function fn_sate_guarda_escola();

select religar_auditoria();

select registrar_migration('044',
  'SATE: destino em partes, responsavel, acessibilidade por escola, periodo derivado (integral) e trajeto provisorio');
