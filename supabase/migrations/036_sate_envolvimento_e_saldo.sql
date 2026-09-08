-- ============================================================
-- 036 - SATE: a regra de visibilidade e o saldo que ela quebrava
-- Rode no SQL Editor do Supabase (apos a 035).
--
-- DUAS COISAS, e a segunda so apareceu por causa da primeira.
--
-- 1. A REGRA canonica de visibilidade passa a ser:
--
--       A escola ve os agendamentos em que ELA ESTA ENVOLVIDA.
--
--    Envolvida = e a escola do pedido (tanto faz se ela mesma pediu ou
--    se alguem com escrita no SATE pediu POR ela), ou e um ponto de
--    embarque da viagem. Substitui "a escola so ve o que ela mesma
--    solicitou", que nao dava conta do onibus que passa em duas escolas.
--
--    O comportamento de `ve_solicitacao` ja era este desde a 035; o que
--    muda aqui e a regra ficar dita com precisao, e a funcao ganhar o
--    caso que faltava - quem PEDIU nao importa, so quem ESTA no pedido.
--
-- 2. O SALDO estava errado para a escola, e a regra 1 e que revelou.
--
--    `usoDoDia` somava `solicitacao_transporte` pelo cliente. Com RLS,
--    uma escola le so as linhas em que esta envolvida - entao ela somava
--    so os PROPRIOS onibus e via "9 de 9 livres" num dia lotado. A tela
--    que existe para avisar que as vagas acabaram dizia o contrario.
--
--    Agregado nao vaza nada: "3 de 9 livres em 15/10" nao diz quem
--    reservou os outros 6, e e exatamente o que a escola precisa saber
--    antes de pedir. Por isso a conta vira uma funcao `security definer`
--    que devolve SO NUMEROS - nunca linhas.
--
-- Idempotente: create or replace.
-- ============================================================

-- ── 1. A regra de envolvimento ───────────────────────────────
create or replace function ve_solicitacao(p_solicitacao uuid, p_unidade uuid)
  returns boolean
  language sql stable security definer set search_path = public as $$
    select case nivel_modulo('sate')
      when 'oculto'   then false
      -- 'proprios' = a escola. Ela ve o agendamento em que esta
      -- ENVOLVIDA: como escola do pedido, ou como ponto de embarque.
      -- Note que quem CRIOU o pedido nao entra na conta - um pedido
      -- feito pela Gerencia de Transporte para a escola X e da escola X,
      -- e ela precisa ve-lo tanto quanto se o tivesse feito.
      when 'proprios' then
        p_unidade in (select minhas_unidades())
        or exists (select 1 from solicitacao_embarque e
                    where e.solicitacao_id = p_solicitacao
                      and e.unidade_id in (select minhas_unidades()))
      -- 'leitura' e 'escrita' veem a rede inteira.
      else true
    end
  $$;

grant execute on function ve_solicitacao(uuid, uuid) to authenticated;

-- ── 2. O saldo do dia, em agregado ───────────────────────────
-- `security definer` para escapar do RLS de propósito, e o guarda de
-- `pode_ver('sate')` na primeira linha é o que impede isso de virar um
-- buraco: quem nao enxerga o modulo nao recebe numero nenhum.
--
-- Devolve SO CONTAGEM. Nenhuma escola, nenhuma atividade, nenhum
-- horario - nada que identifique de quem e a reserva.
--
--   { "onibus":       { "manha": {"total":9,"uso":2}, "tarde": …, "noite": … },
--     "van_adaptada": { … } }
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

-- Conferencia:
--   select saldo_transporte(current_date);
--   -- logado como gestor escolar, o total precisa bater com o do admin

select registrar_migration('036',
  'SATE: regra de envolvimento e saldo agregado por funcao (o RLS filtrava a conta)');
