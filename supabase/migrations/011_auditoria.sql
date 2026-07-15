-- ============================================================
-- 011 — Auditoria + último acesso
-- Rode no SQL Editor, depois de todas as anteriores.
--
-- DUAS coisas:
--   1. audit_log — histórico de TODA alteração de cadastro, com o
--      valor ANTES, o valor DEPOIS e o diff campo a campo. Feito por
--      um trigger genérico no Postgres: é automático (nenhuma tela
--      precisa lembrar de registrar) e à prova de bypass (roda no
--      banco, não no front — quem alterar por SQL direto também fica
--      logado). É a resposta ao "o que era antes e o que mudou".
--   2. perfil.ultimo_acesso — carimbo do último login de cada usuário,
--      atualizado por uma função SECURITY DEFINER que o próprio usuário
--      pode chamar (sem poder mexer no resto do perfil).
--
-- Por que trigger e não uma coluna "historico" por tabela: centraliza
-- tudo em um lugar, cobre INSERT/UPDATE/DELETE de uma vez, e novas
-- tabelas entram com uma linha no array lá embaixo.
-- ============================================================

-- ── 1. audit_log ─────────────────────────────────────────────
create table if not exists audit_log (
  id           bigint generated always as identity primary key,
  tabela       text not null,
  registro_id  text,                     -- id (ou email) da linha afetada
  operacao     text not null,            -- INSERT | UPDATE | DELETE
  autor        text,                     -- auth_email() de quem fez
  dados_antes  jsonb,                    -- linha inteira antes (UPDATE/DELETE)
  dados_depois jsonb,                    -- linha inteira depois (INSERT/UPDATE)
  alteracoes   jsonb,                    -- { campo: { de, para } } — só UPDATE
  criado_em    timestamptz not null default now()
);
create index if not exists idx_audit_tabela_reg on audit_log(tabela, registro_id);
create index if not exists idx_audit_criado      on audit_log(criado_em desc);
create index if not exists idx_audit_autor       on audit_log(autor);

-- Ruído que não merece virar registro de auditoria (carimbos automáticos).
-- Um UPDATE que só mexeu nesses campos é ignorado.
create or replace function _audit_campos_ruido() returns text[]
  language sql immutable as $$ select array['atualizado_em','ultimo_acesso','criado_em'] $$;

create or replace function fn_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
  v_alt    jsonb := '{}'::jsonb;
  v_id     text;
  k        text;
  v_signif jsonb;
begin
  if tg_op = 'DELETE' then
    v_antes := to_jsonb(old);
    v_id := coalesce(v_antes->>'id', v_antes->>'email');
  elsif tg_op = 'INSERT' then
    v_depois := to_jsonb(new);
    v_id := coalesce(v_depois->>'id', v_depois->>'email');
  else -- UPDATE
    v_antes  := to_jsonb(old);
    v_depois := to_jsonb(new);
    v_id := coalesce(v_depois->>'id', v_depois->>'email');
    for k in select jsonb_object_keys(v_depois) loop
      if (v_antes->k) is distinct from (v_depois->k) then
        v_alt := v_alt || jsonb_build_object(k, jsonb_build_object('de', v_antes->k, 'para', v_depois->k));
      end if;
    end loop;
    -- se só mudaram campos de ruído, não registra
    v_signif := v_alt;
    foreach k in array _audit_campos_ruido() loop
      v_signif := v_signif - k;
    end loop;
    if v_signif = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into audit_log (tabela, registro_id, operacao, autor, dados_antes, dados_depois, alteracoes)
  values (tg_table_name, v_id, tg_op, auth_email(), v_antes, v_depois,
          case when tg_op = 'UPDATE' then v_alt else null end);

  return coalesce(new, old);
end $$;

-- Liga o trigger nas tabelas de cadastro. Para auditar uma tabela nova,
-- acrescente o nome ao array.
do $$
declare t text;
begin
  foreach t in array array[
    'unidade_escolar','regional','servidor','vinculo','perfil',
    'atividade_extraclasse','solicitacao_transporte','oferta_onibus',
    'dia_calendario','afastamento','horario_bloco','ocorrencia'
  ] loop
    execute format('drop trigger if exists trg_audit on %I', t);
    execute format('create trigger trg_audit after insert or update or delete on %I for each row execute function fn_audit()', t);
  end loop;
end $$;

-- RLS: só admin LÊ; ninguém escreve direto. O trigger é SECURITY DEFINER
-- (roda como dono da tabela) e, com RLS habilitado mas NÃO forçado, o dono
-- é isento — então o insert do trigger passa e o usuário comum não escreve.
alter table audit_log enable row level security;
drop policy if exists audit_sel on audit_log;
create policy audit_sel on audit_log for select using (is_admin());
grant select on audit_log to authenticated;   -- sem insert/update/delete de propósito

-- ── 2. Último acesso ─────────────────────────────────────────
alter table perfil add column if not exists ultimo_acesso timestamptz;

-- O usuário atualiza o PRÓPRIO carimbo (e só ele) e recebe de volta o
-- acesso ANTERIOR — que é o que faz sentido exibir ("seu último acesso
-- foi em..."). SECURITY DEFINER porque a policy de escrita do perfil é
-- só admin; esta função abre uma exceção estreita e controlada.
create or replace function registrar_acesso() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_anterior timestamptz;
begin
  select ultimo_acesso into v_anterior from perfil where email = auth_email();
  update perfil set ultimo_acesso = now() where email = auth_email();
  return v_anterior;
end $$;

grant execute on function registrar_acesso() to authenticated;
