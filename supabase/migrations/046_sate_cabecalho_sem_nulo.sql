-- ============================================================
-- 046 - SATE: o cabecalho da viagem nao recusa pedido por valor ausente
--
-- criar_viagem() monta a linha de solicitacao_transporte com
-- jsonb_populate_record(null::solicitacao_transporte, ...). Coluna que o
-- cliente nao manda entra como NULL EXPLICITO - o DEFAULT da coluna nao
-- vale nesse caminho. `qtd_cadeirante` (005) e `qtd_vans` (035) sao
-- NOT NULL DEFAULT 0, e o formulario deixou de mandar `qtd_cadeirante` no
-- cabecalho quando ele virou cache das participacoes (037): o pedido era
-- recusado com 23502, "campo obrigatorio em branco", por um dado que NAO
-- e obrigatorio para ninguem - sem cadeirante, o valor e zero.
--
-- O front voltou a mandar o valor (0.40.0), mas a regra tem de valer no
-- banco (R15): um gatilho BEFORE INSERT troca o nulo pelo zero antes de a
-- restricao NOT NULL ser conferida. Vale para qualquer caminho de
-- insercao, e nao exige reescrever criar_viagem().
--
-- O nome comeca com `trg_sate_a_`: gatilhos BEFORE disparam em ordem
-- alfabetica, e este precisa rodar antes dos demais (guarda, periodo).
--
-- Idempotente.
-- ============================================================

create or replace function fn_sate_cabecalho_sem_nulo() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.qtd_cadeirante := coalesce(new.qtd_cadeirante, 0);
  new.qtd_vans       := coalesce(new.qtd_vans, 0);
  return new;
end $$;

drop trigger if exists trg_sate_a_cabecalho_sem_nulo on solicitacao_transporte;
create trigger trg_sate_a_cabecalho_sem_nulo
  before insert on solicitacao_transporte
  for each row execute function fn_sate_cabecalho_sem_nulo();

select religar_auditoria();

select registrar_migration('046',
  'SATE: cabecalho da viagem troca nulo por zero em qtd_cadeirante e qtd_vans antes do NOT NULL');
