-- ============================================================
-- 040 - SATE: decidir um pedido criando a frota extra do dia
-- Rode no SQL Editor do Supabase (apos a 039).
-- Spec: docs/superpowers/specs/2026-09-13-sate-ciclo-de-aprovacao-design.md
--
-- Quem aprova pode passar do limite da frota; quando passa, nasce um
-- lote so para aquele dia, ligado ao pedido (spec do modelo, D2). Lote e
-- decisao sao UM ato: em duas chamadas, uma falha no meio deixaria uma
-- frota orfa nascida de erro de rede, ou um pedido confirmado sem veiculo.
--
-- p_status:
--   'confirmado'                     confirma
--   'aguardando_transporte_adaptado' reserva os onibus e aguarda a van
--   null                             so cria o lote (remanejamento)
--
-- Sem `security definer`: o insert em `frota` e o update do pedido passam
-- pelas policies de escrita do SATE. Quem nao aprova nao chega a lugar
-- nenhum por aqui.
--
-- Idempotente: create or replace.
-- ============================================================

create or replace function decidir_com_frota(
  p_solicitacao uuid, p_status text, p_rotulo uuid, p_onibus int, p_vans int
) returns solicitacao_transporte
  language plpgsql volatile set search_path = public as $$
declare
  v solicitacao_transporte;
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

  if coalesce(p_onibus, 0) > 0 then
    insert into frota (rotulo_id, tipo, quantidade, inicio, fim, observacao, solicitacao_id, criado_por)
    values (p_rotulo, 'onibus', p_onibus, v.data, v.data, 'Frota extra do dia', v.id, auth_email());
  end if;
  if coalesce(p_vans, 0) > 0 then
    insert into frota (rotulo_id, tipo, quantidade, inicio, fim, observacao, solicitacao_id, criado_por)
    values (p_rotulo, 'van_adaptada', p_vans, v.data, v.data, 'Frota extra do dia', v.id, auth_email());
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

select religar_auditoria();

select registrar_migration('040',
  'SATE: decidir pedido criando a frota extra do dia numa transacao (decidir_com_frota)');
