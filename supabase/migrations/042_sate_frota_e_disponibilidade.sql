-- ============================================================
-- 042 - SATE: frota por rotulo e disponibilidade por horario
-- Rode no SQL Editor do Supabase (apos a 041).
-- Spec: docs/superpowers/specs/2026-09-26-sate-frota-e-disponibilidade-design.md
--
-- EM UMA FRASE: cada viagem ocupa os seus veiculos do embarque ate a
-- volta + tempo de viagem + intervalo minimo (a da noite, ate o meio-dia
-- seguinte), e um pedido so cabe se houver veiculo livre em TODO o
-- intervalo dele.
--
-- O que muda:
--   1. uma frota em aberto por ROTULO e tipo (antes: por tipo);
--   2. ocupacao_transporte(): a ocupacao anonima de um intervalo de dias;
--   3. vagas_transporte(): quantos veiculos cabem num intervalo - a mesma
--      conta que o front faz em disponibilidade.model.js;
--   4. criar_viagem(): para a ESCOLA, a barreira passa a existir no banco
--      (R15), com trava por TODOS os dias que o pedido toca;
--   5. decidir_com_frota(): a frota extra de um pedido da noite cobre o
--      dia seguinte, que a viagem tambem ocupa;
--   6. gatilhos de guarda em solicitacao_transporte e
--      solicitacao_participacao fecham o atalho pela API direto - sem
--      eles a barreira do item 4 seria so decorativa (spec D7).
--
-- `solicitado` passa a OCUPAR vaga (spec D6): o pedido da escola reserva
-- no instante em que nasce.
--
-- Idempotente: drop/create if exists e create or replace.
-- ============================================================

-- ── 1. Uma frota em aberto por rotulo e tipo ─────────────────
-- Frotas de origens diferentes (contratos, parcerias) coexistem abertas
-- e somam. "A partir de marco a Regular tem 12" continua sendo um gesto
-- so: abrir outra Regular encerra a Regular anterior.
drop index if exists idx_frota_uma_aberta;
create unique index if not exists idx_frota_aberta_por_rotulo
  on frota (rotulo_id, tipo) where fim is null;

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
   where rotulo_id = p_rotulo_id and tipo = p_tipo and fim is null and inicio < p_inicio;

  -- Uma aberta do mesmo rotulo que comece no MESMO dia ou depois nao pode
  -- ser "encerrada na vespera" (daria fim < inicio): e substituida.
  delete from frota
   where rotulo_id = p_rotulo_id and tipo = p_tipo and fim is null and inicio >= p_inicio;

  insert into frota (rotulo_id, tipo, quantidade, inicio, fim, observacao, criado_por)
  values (p_rotulo_id, p_tipo, p_quantidade, p_inicio, null, p_observacao, auth_email())
  returning * into v_nova;

  return v_nova;
end $$;
grant execute on function abrir_frota(uuid, int, date, text, text) to authenticated;

-- ── 2. Auxiliares puras ──────────────────────────────────────
-- "07:30" -> 450. Nulo para o que nao e hora.
create or replace function _sate_min(p text) returns int
  language sql immutable set search_path = public as $$
    select case when p ~ '^\d{1,2}:\d{2}'
                then split_part(p, ':', 1)::int * 60 + substr(split_part(p, ':', 2), 1, 2)::int
           end
  $$;

-- Numero de configuracao do SATE (config_modulo), com padrao. Valor que
-- nao e numero cai no padrao, como em sate.config.js.
create or replace function _sate_conf_int(p_chave text, p_padrao int) returns int
  language sql stable security definer set search_path = public as $$
    select coalesce(
      (select case when jsonb_typeof(valor) = 'number'
                   then greatest(0, round((valor::text)::numeric)::int) end
         from config_modulo where modulo = 'sate' and chave = p_chave),
      p_padrao)
  $$;

-- O intervalo que uma viagem ocupa, em minutos desde 00:00 do dia dela.
-- ESPELHO de intervaloDaViagem() em disponibilidade.model.js - mudou
-- aqui, mude la (e o teste tests/sate-disponibilidade.test.mjs).
--   manha/tarde: embarque ate retorno + trajeto + intervalo
--   noite:       idem, mas nunca antes das 12:00 do dia seguinte (2160)
--   sem horario: a janela do periodo (manha 0-720, tarde 720-1080,
--                noite 1080-2160)
create or replace function _sate_intervalo(
  p_periodo text, p_emb int, p_ret int, p_trajeto int, p_intervalo int,
  out ini int, out fim int)
  language plpgsql immutable set search_path = public as $$
declare
  j_ini int := case p_periodo when 'manha' then 0   when 'tarde' then 720  else 1080 end;
  j_fim int := case p_periodo when 'manha' then 720 when 'tarde' then 1080 else 2160 end;
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

-- Quantos veiculos cabem em [p_ini, p_fim), dadas a frota por dia e as
-- ocupacoes (mesmo formato de ocupacao_transporte). PURA: e o que torna a
-- conta conferivel com os casos da spec (ver o fim deste arquivo).
--
-- livres = min sobre t de (frota do dia de t - ocupados em t). Basta
-- avaliar t no inicio do pedido, em cada inicio de ocupacao dentro dele e
-- em cada virada de dia - os unicos pontos em que o valor pode cair.
-- ESPELHO de livresPara() em disponibilidade.model.js.
create or replace function _sate_livres(p_frota jsonb, p_ocup jsonb, p_ini int, p_fim int)
  returns jsonb language plpgsql immutable set search_path = public as $$
declare
  t int;
  v_tot_o int; v_tot_v int; v_oc_o int; v_oc_v int;
  v_min_o int; v_min_v int;
begin
  for t in
    select p_ini
    union
    select (e->>'dia')::int * 1440 + (e->>'ini')::int
      from jsonb_array_elements(coalesce(p_ocup, '[]'::jsonb)) e
     where (e->>'dia')::int * 1440 + (e->>'ini')::int > p_ini
       and (e->>'dia')::int * 1440 + (e->>'ini')::int < p_fim
    union
    select g * 1440
      from generate_series(floor(p_ini / 1440.0)::int + 1, floor((p_fim - 1) / 1440.0)::int) g
  loop
    select coalesce(sum((f->>'onibus')::int), 0), coalesce(sum((f->>'vans')::int), 0)
      into v_tot_o, v_tot_v
      from jsonb_array_elements(coalesce(p_frota, '[]'::jsonb)) f
     where (f->>'dia')::int = floor(t / 1440.0)::int;
    select coalesce(sum((e->>'onibus')::int), 0), coalesce(sum((e->>'vans')::int), 0)
      into v_oc_o, v_oc_v
      from jsonb_array_elements(coalesce(p_ocup, '[]'::jsonb)) e
     where (e->>'dia')::int * 1440 + (e->>'ini')::int <= t
       and t < (e->>'dia')::int * 1440 + (e->>'fim')::int;
    v_min_o := least(coalesce(v_min_o, v_tot_o - v_oc_o), v_tot_o - v_oc_o);
    v_min_v := least(coalesce(v_min_v, v_tot_v - v_oc_v), v_tot_v - v_oc_v);
  end loop;
  return jsonb_build_object('onibus', coalesce(v_min_o, 0), 'vans', coalesce(v_min_v, 0));
end $$;

grant execute on function _sate_min(text) to authenticated;
grant execute on function _sate_conf_int(text, int) to authenticated;
grant execute on function _sate_intervalo(text, int, int, int, int) to authenticated;
grant execute on function _sate_livres(jsonb, jsonb, int, int) to authenticated;

-- ── 3. Ocupacao anonima ──────────────────────────────────────
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
    cfg as (select _sate_conf_int('intervalo_min_periodos', 120) as intervalo),
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
      select (s.data - p_de) as dia, s.periodo, s.trajeto_min,
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

-- ── 4. Vagas num intervalo ───────────────────────────────────
create or replace function vagas_transporte(p_data date, p_ini int, p_fim int, p_excluir uuid default null)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o jsonb;
begin
  o := ocupacao_transporte(p_data, p_data, p_excluir);
  if o is null then return jsonb_build_object('onibus', 0, 'vans', 0); end if;
  return _sate_livres(o->'frota', o->'ocupacoes', p_ini, p_fim);
end $$;
grant execute on function vagas_transporte(date, int, int, uuid) to authenticated;

-- ── 5. Criar viagem: a barreira da escola no banco ───────────
-- Para quem ESCREVE no SATE nada muda: passar do limite e aviso, e a
-- frota extra nasce na confirmacao (040). Para a escola:
--   - horarios obrigatorios (sem eles nao ha intervalo a conferir);
--   - veiculos RECALCULADOS aqui - o numero da tela nao vale;
--   - trava por TODOS os dias que o intervalo do pedido toca (a noite
--     trava tambem o dia seguinte): dois pedidos que se cruzam entram em
--     fila, e o segundo ja enxerga o primeiro (que, desde esta migration,
--     reserva);
--   - falta de onibus recusa; falta de van nao (a Gerencia providencia).
--
-- Sem `security definer`: as insercoes continuam passando pelas policies
-- (e pelos gatilhos de guarda da secao 7 - a marca de transacao que abre
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
    v_per  := p_viagem->>'periodo';
    v_emb  := _sate_min(p_viagem->>'horario_embarque');
    v_ret  := _sate_min(p_viagem->>'horario_retorno');
    if v_emb is null or v_ret is null then
      raise exception 'Informe o horario de embarque e o de retorno.' using errcode = '23502';
    end if;

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

    select i.ini, i.fim into v_ini, v_fim
      from _sate_intervalo(v_per, v_emb, v_ret, (p_viagem->>'trajeto_min')::int,
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

-- ── 6. Frota extra da noite cobre o dia seguinte ─────────────
create or replace function decidir_com_frota(
  p_solicitacao uuid, p_status text, p_rotulo uuid, p_onibus int, p_vans int
) returns solicitacao_transporte
  language plpgsql volatile set search_path = public as $$
declare
  v solicitacao_transporte;
  v_fim date;
begin
  if p_status is not null
     and p_status not in ('confirmado', 'aguardando_transporte_adaptado') then
    raise exception 'Status invalido para decidir com frota: %', p_status using errcode = '22023';
  end if;
  if coalesce(p_onibus, 0) < 0 or coalesce(p_vans, 0) < 0 then
    raise exception 'Quantidade de veiculos negativa' using errcode = '22023';
  end if;
  if coalesce(p_onibus, 0) + coalesce(p_vans, 0) > 0 and p_rotulo is null then
    raise exception 'A frota extra precisa de um rotulo' using errcode = '23502';
  end if;

  select * into v from solicitacao_transporte where id = p_solicitacao;
  if not found then
    raise exception 'Solicitacao nao encontrada' using errcode = 'P0002';
  end if;

  -- A viagem da noite ocupa a manha seguinte (spec B, D5): um lote so da
  -- data deixaria faltando la.
  v_fim := case when v.periodo = 'noite' then v.data + 1 else v.data end;

  if coalesce(p_onibus, 0) > 0 then
    insert into frota (rotulo_id, tipo, quantidade, inicio, fim, observacao, solicitacao_id, criado_por)
    values (p_rotulo, 'onibus', p_onibus, v.data, v_fim, 'Frota extra do dia', v.id, auth_email());
  end if;
  if coalesce(p_vans, 0) > 0 then
    insert into frota (rotulo_id, tipo, quantidade, inicio, fim, observacao, solicitacao_id, criado_por)
    values (p_rotulo, 'van_adaptada', p_vans, v.data, v_fim, 'Frota extra do dia', v.id, auth_email());
  end if;

  if p_status is not null then
    update solicitacao_transporte
       set status = p_status, decidido_por = auth_email(), decidido_em = now(), atualizado_em = now()
     where id = v.id
    returning * into v;
  end if;

  return v;
end $$;
grant execute on function decidir_com_frota(uuid, text, uuid, int, int) to authenticated;

-- ── 7. Sem atalho pela API ────────────────────────────────────
-- R15: a barreira so vale por inteiro se nao houver outro caminho. A
-- escola tem INSERT/UPDATE via RLS em solicitacao_transporte (035) e
-- solicitacao_participacao (037) - ela precisa disso para abrir e
-- cancelar o proprio pedido -, o que deixaria criar_viagem() como um
-- atalho a mais, nao a unica porta. Os gatilhos abaixo fecham essa
-- brecha para PEDIDO DE USUARIO LOGADO PELA API que nao escreve no SATE
-- (spec D7). A guarda e so para isso: o SQL Editor do painel e uma
-- Edge Function futura com service_role nao carregam um JWT de usuario
-- final (claim `role` <> 'authenticated') e passam direto, como
-- manutencao confiavel - senao toda migration antiga que faz UPDATE
-- idempotente nessas tabelas (037:49/75/97, 017:68) pararia de rodar.
-- Quem escreve no SATE (`pode_escrever`) tambem segue livre, inclusive
-- por SQL direto, porque a frota extra dela e aviso, e e assim que tem
-- que ser.
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
  -- pedido (nome e endereco inclusos - sem eles a guarda deixava o destino
  -- passar). qtd_alunos/qtd_cadeirante ficam de fora de proposito: quem os
  -- escreve e o gatilho definer de totais (fn_sincronizar_totais_viagem,
  -- 037), que roda com o JWT da escola ainda ativo na sessao.
  if (new.data, new.periodo, new.horario_embarque, new.horario_retorno,
      new.qtd_onibus, new.qtd_vans, new.trajeto_min, new.unidade_id,
      new.atividade_id, new.local_id, new.destino_nome, new.destino_endereco)
     is distinct from
     (old.data, old.periodo, old.horario_embarque, old.horario_retorno,
      old.qtd_onibus, old.qtd_vans, old.trajeto_min, old.unidade_id,
      old.atividade_id, old.local_id, old.destino_nome, old.destino_endereco) then
    raise exception 'A escola nao altera data, horario, destino nem veiculos de um pedido.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_sate_guarda_escola on solicitacao_transporte;
create trigger trg_sate_guarda_escola
  before insert or update on solicitacao_transporte
  for each row execute function fn_sate_guarda_escola();

-- Mesma ideia na participacao: acrescentar parada e decisao da Gerencia
-- (035, D8); a excecao e a propria escola criando a PROPRIA linha no
-- pedido que abriu, dentro de criar_viagem().
create or replace function fn_sate_guarda_participacao() returns trigger
  language plpgsql set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;
  if pode_escrever('sate') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(current_setting('sate.criar_viagem', true), '') <> '1' then
      raise exception 'Parada so e acrescentada pela Gerencia ou pelo formulario do SATE.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Uma cancelada so volta pela Gerencia: reativar por conta propria
  -- desfaria a decisao de quem cancelou e inflaria qtd_alunos do
  -- cabecalho (gatilho de totais, 037) sem os onibus terem sido
  -- recontados.
  if old.status = 'cancelada' and new.status is distinct from 'cancelada' then
    raise exception 'Participacao cancelada so volta pela Gerencia.' using errcode = '42501';
  end if;

  -- UPDATE: o fluxo "Sair da viagem" da escola (participacoes.model.js,
  -- mover()) muda so status e motivo - cota, parada e ordem sao da
  -- Gerencia.
  if (new.solicitacao_id, new.unidade_id, new.local_id, new.ordem,
      new.horario, new.qtd_alunos, new.qtd_cadeirante)
     is distinct from
     (old.solicitacao_id, old.unidade_id, old.local_id, old.ordem,
      old.horario, old.qtd_alunos, old.qtd_cadeirante) then
    raise exception 'A escola so pede para sair da viagem; cota e parada sao da Gerencia.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_sate_guarda_participacao on solicitacao_participacao;
create trigger trg_sate_guarda_participacao
  before insert or update on solicitacao_participacao
  for each row execute function fn_sate_guarda_participacao();

-- ── 8. Conferencia (rodar a parte, depois da migration) ──────
-- Os casos da spec B. Cada linha deve devolver `ok = true`.
--
-- select caso, (_sate_livres(f::jsonb, o::jsonb, ini, fim)->>'onibus')::int = esperado as ok
--   from (values
--     ('vazio',            '[{"dia":0,"onibus":9,"vans":0}]', '[]', 780, 1020, 9),
--     ('manha volta tarde','[{"dia":0,"onibus":9,"vans":0}]', '[{"dia":0,"ini":420,"fim":850,"onibus":6,"vans":0}]', 780, 1020, 3),
--     ('manha ja voltou',  '[{"dia":0,"onibus":9,"vans":0}]', '[{"dia":0,"ini":420,"fim":850,"onibus":6,"vans":0}]', 850, 1020, 9),
--     ('degrau',           '[{"dia":0,"onibus":9,"vans":0}]', '[{"dia":0,"ini":420,"fim":850,"onibus":6,"vans":0},{"dia":0,"ini":900,"fim":1140,"onibus":2,"vans":0}]', 870, 1080, 7),
--     ('noite ocupa manha','[{"dia":0,"onibus":9,"vans":0},{"dia":1,"onibus":9,"vans":0}]', '[{"dia":0,"ini":1140,"fim":2160,"onibus":3,"vans":0}]', 1920, 2100, 6),
--     ('frota muda',       '[{"dia":0,"onibus":9,"vans":0},{"dia":1,"onibus":4,"vans":0}]', '[]', 1140, 2160, 4)
--   ) as c(caso, f, o, ini, fim, esperado);
--
-- select * from _sate_intervalo('tarde', 780, 1020, 30, 120);   -- 780 | 1170
-- select * from _sate_intervalo('noite', 1140, 1320, 30, 120);  -- 1140 | 2160
-- select * from _sate_intervalo('manha', null, null, null, 120); -- 0 | 720
--
-- O 7o caso da tabela da spec ("proprio pedido excluido") passa por
-- p_excluir, nao por _sate_livres - confere com vagas_transporte direto:
--   select vagas_transporte('<data>', 480, 720, '<id do proprio pedido>');

select religar_auditoria();

select registrar_migration('042',
  'SATE: frota aberta por rotulo, ocupacao por horario (ocupacao_transporte, vagas_transporte) e barreira da escola em criar_viagem');
