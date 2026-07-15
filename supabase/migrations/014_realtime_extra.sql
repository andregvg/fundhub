-- ============================================================
-- 014 — Realtime para afastamentos e ocorrências
-- Rode no SQL Editor. Estende as notificações em tempo real (sino +
-- toasts) para além do SATE: agora afastamento e ocorrencia também
-- disparam avisos. O RLS continua valendo — cada usuário só recebe
-- eventos das linhas que tem permissão de ler.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['afastamento','ocorrencia'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
