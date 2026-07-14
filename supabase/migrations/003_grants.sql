-- ============================================================
-- 003 — Privilégios de tabela (rode no SQL Editor do Supabase)
-- Corrige "permission denied for table ...": o papel `authenticated`
-- precisa de GRANT nas tabelas. O RLS continua no comando —
-- leitura por is_autorizado(), escrita por is_admin().
-- O papel `anon` permanece SEM privilégios: deslogado não acessa nada.
-- ============================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Tabelas/sequências criadas no futuro também acessíveis ao authenticated.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
