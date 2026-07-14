-- ============================================================
-- 002 — Leitura por allowlist (rode no SQL Editor do Supabase)
-- Troca a regra de leitura: em vez de "qualquer e-mail institucional",
-- passa a exigir estar cadastrado na tabela perfil (ativo).
-- Você libera acesso inserindo o e-mail em perfil.
-- ============================================================

create or replace function is_autorizado() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from perfil where email = auth_email() and ativo)
  $$;

do $$
declare t text;
begin
  foreach t in array array['regional','servidor','unidade_escolar','vinculo'] loop
    execute format('drop policy if exists %I_sel on %I', t, t);
    execute format('create policy %I_sel on %I for select using (is_autorizado())', t, t);
  end loop;
end $$;

-- Conceder leitura a alguém (sem ser admin):
--   insert into perfil (email, nome, papel)
--   values ('fulano@educacao.pmrp.sp.gov.br', 'Fulano', 'leitor')
--   on conflict (email) do update set ativo = true;
