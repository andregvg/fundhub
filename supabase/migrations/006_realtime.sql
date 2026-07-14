-- ============================================================
-- 006 — Realtime para notificações de solicitações
-- Rode no SQL Editor. Habilita broadcast de mudanças na tabela
-- solicitacao_transporte (o RLS continua valendo: cada usuário só
-- recebe eventos das linhas que tem permissão de ler).
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'solicitacao_transporte'
  ) then
    alter publication supabase_realtime add table solicitacao_transporte;
  end if;
end $$;
