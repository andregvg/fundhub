-- ============================================================
-- 041 - Realtime para as escolas de cada viagem do SATE
-- Rode no SQL Editor do Supabase (apos a 040).
--
-- O sino avisava de mudanca no PEDIDO, mas nao na PARTICIPACAO - e o
-- evento que mais importa a quem aprova e dela: "a escola pediu para
-- sair da viagem". Sem a tabela na publicacao, esse pedido so aparecia
-- para quem abrisse a viagem por acaso.
--
-- O RLS continua valendo: cada pessoa so recebe eventos das linhas que
-- ja poderia ler (part_sel, migration 037).
--
-- Idempotente: so acrescenta se ainda nao estiver na publicacao.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'solicitacao_participacao'
  ) then
    alter publication supabase_realtime add table solicitacao_participacao;
  end if;
end $$;

select registrar_migration('041',
  'Realtime: solicitacao_participacao na publicacao (avisos de saida de escola no sino)');
