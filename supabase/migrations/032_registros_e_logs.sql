-- ============================================================
-- 032 - Registros e logs
-- Spec: docs/superpowers/specs/2026-09-07-registros-e-logs-design.md
-- Rode no SQL Editor, depois da 031.
--
-- TRES coisas, nesta ordem:
--   1. evento_log + registrar_evento() - o que ACONTECEU no sistema
--      (login, exportacao, mudanca de permissao, acesso negado). E o
--      complemento do audit_log, que registra o que MUDOU no dado.
--      Tabela separada de proposito: o audit_log so e prova porque
--      NINGUEM escreve nele; abrir insert ali para o front gravar
--      evento permitiria forjar linha de auditoria.
--   2. religar_auditoria() - a auditoria passa a ser por EXCLUSAO.
--      Ate aqui a lista de tabelas auditaveis era um array escrito a
--      mao, redeclarado na 011, na 019 e na 026: esquecer de somar uma
--      tabela falhava em silencio - e ja falhou, `papel` e
--      `papel_permissao` nunca foram auditadas. Agora o padrao e
--      auditado e a lista curta e a de ISENCAO.
--   3. podar_logs() + saude_logs() - retencao a vista do admin. O
--      plano gratuito do Supabase da 500 MB, e estourar derruba o
--      servico inteiro, nao so o log.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================

-- ============================================================
-- 1. evento_log - eventos de aplicacao
-- ============================================================

create table if not exists evento_log (
  id         bigint generated always as identity primary key,
  tipo       text not null,
  autor      text,                                    -- auth_email(), posto pela funcao
  contexto   jsonb not null default '{}'::jsonb,      -- metadado pequeno, NUNCA conteudo
  criado_em  timestamptz not null default now()
);

comment on table evento_log is
  'Eventos de aplicacao (login, exportacao, permissao, acesso negado). '
  'Escrito so por registrar_evento(); lido so por admin. O que MUDOU no '
  'dado fica em audit_log, nao aqui.';
comment on column evento_log.contexto is
  'Metadado do evento: quantidade, formato, alvo. Nunca o conteudo '
  'exportado nem dado pessoal - o log e publico para todo admin.';

-- Lista fechada de tipos. A funcao valida para dar erro legivel; o CHECK
-- e a barreira que nao se contorna pelo console (R15 - validacao em dois
-- niveis). Acrescentar tipo aqui E em core/eventos.js.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'evento_log_tipo') then
    alter table evento_log add constraint evento_log_tipo
      check (tipo in ('acesso', 'exportacao', 'permissao', 'acesso_negado'));
  end if;
end $$;

create index if not exists idx_evento_criado on evento_log (criado_em desc);
create index if not exists idx_evento_tipo   on evento_log (tipo, criado_em desc);
create index if not exists idx_evento_autor  on evento_log (autor);

-- RLS: so admin LE; ninguem escreve direto. Mesma postura do audit_log -
-- a unica porta de entrada e a funcao SECURITY DEFINER abaixo.
alter table evento_log enable row level security;
drop policy if exists evento_sel on evento_log;
create policy evento_sel on evento_log for select using (is_admin());
grant select on evento_log to authenticated;   -- sem insert/update/delete de proposito

-- A UNICA porta de escrita.
--
-- `autor` e `criado_em` sao postos AQUI, nunca pelo chamador: o front nao
-- forja identidade nem retrodata evento. Mesmo principio do fn_audit().
--
-- O teto de 2 KB no contexto existe porque o banco tem 500 MB e um
-- chamador distraido (ou mal-intencionado, mas autorizado) poderia
-- despejar payload inteiro aqui. Metadado nao passa de 2 KB.
create or replace function registrar_evento(p_tipo text, p_contexto jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_tipo not in ('acesso', 'exportacao', 'permissao', 'acesso_negado') then
    raise exception 'tipo de evento desconhecido: %', p_tipo
      using hint = 'Tipos validos: acesso, exportacao, permissao, acesso_negado.';
  end if;

  if pg_column_size(coalesce(p_contexto, '{}'::jsonb)) > 2000 then
    raise exception 'contexto do evento excede 2 KB'
      using hint = 'O contexto guarda metadado (quantidade, formato, alvo), nunca conteudo.';
  end if;

  insert into evento_log (tipo, autor, contexto)
  values (p_tipo, auth_email(), coalesce(p_contexto, '{}'::jsonb));
end $$;

grant execute on function registrar_evento(text, jsonb) to authenticated;

-- ============================================================
-- 2. Auditoria por EXCLUSAO
-- ============================================================

-- A lista curta. Todo o resto de `public` e auditado.
--
-- Cada linha tem motivo, porque isencao sem motivo e so a checagem
-- silenciada. Espelhada em .claude/scripts/verificar_arquitetura.py
-- (checagem 13) - mudou aqui, mude la; a checagem cobra a divergencia.
create or replace function _audit_isentas() returns text[]
  language sql immutable as $$ select array[
    'audit_log',            -- auditar o log e recursao sem valor
    'evento_log',           -- idem
    'preferencia_usuario',  -- preferencia pessoal de tela; ruido puro
    'schema_migrations'     -- metadado de infraestrutura, nao cadastro
  ] $$;

-- Religa trg_audit em TODA tabela base de `public` que nao esteja isenta.
--
-- A inversao e o ponto: ate a 026 a lista era de INCLUSAO e esquecer uma
-- tabela deixava um buraco invisivel. Por exclusao, esquecer significa
-- auditar demais - falha ruidosa, que o painel de saude mostra - nunca
-- de menos.
--
-- Sem grant para `authenticated`: e manutencao de SQL Editor. Uma funcao
-- SECURITY DEFINER que cria trigger, exposta ao cliente, seria escalada
-- de privilegio.
create or replace function religar_auditoria() returns int
language plpgsql security definer set search_path = public as $$
declare
  t      text;
  v_qtd  int := 0;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'                       -- so tabela base: view e particao ficam de fora
       and not c.relname = any(_audit_isentas())
     order by c.relname
  loop
    execute format('drop trigger if exists trg_audit on %I', t);
    execute format(
      'create trigger trg_audit after insert or update or delete on %I
         for each row execute function fn_audit()', t);
    v_qtd := v_qtd + 1;
  end loop;

  raise notice 'Auditoria religada em % tabela(s).', v_qtd;
  return v_qtd;
end $$;

-- Roda agora. Efeito imediato: `papel` e `papel_permissao` passam a ser
-- auditadas - mudar o que um papel pode fazer e alteracao de seguranca e
-- ate aqui nao deixava rastro nenhum.
select religar_auditoria();

-- ============================================================
-- 3. Retencao e saude
-- ============================================================

-- Poda a vista do admin, nao cron escondido: apagar prova sem ninguem
-- ver e o oposto do que uma auditoria deve fazer. Quem chama e o painel
-- da engrenagem do modulo Auditoria, que mostra o tamanho antes.
--
-- Padroes conservadores: 180 dias de evento (observabilidade), 730 de
-- auditoria (prova).
create or replace function podar_logs(p_dias_evento int default 180,
                                      p_dias_audit  int default 730)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ev int := 0;
  v_au int := 0;
begin
  if not is_admin() then
    raise exception 'so administrador poda os registros';
  end if;
  if p_dias_evento < 30 or p_dias_audit < 90 then
    raise exception 'retencao minima: 30 dias de evento, 90 de auditoria';
  end if;

  delete from evento_log where criado_em < now() - make_interval(days => p_dias_evento);
  get diagnostics v_ev = row_count;

  delete from audit_log  where criado_em < now() - make_interval(days => p_dias_audit);
  get diagnostics v_au = row_count;

  return jsonb_build_object('eventos_apagados', v_ev, 'auditoria_apagada', v_au);
end $$;

grant execute on function podar_logs(int, int) to authenticated;

-- O numero que o admin ve antes de decidir podar. `pg_database_size`
-- contra os 500 MB do plano gratuito e o que importa: estourar o limite
-- derruba o FundHub inteiro, nao so o log.
create or replace function saude_logs() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'so administrador consulta a saude dos registros';
  end if;

  return jsonb_build_object(
    'audit_linhas',    (select count(*) from audit_log),
    'audit_bytes',     pg_total_relation_size('audit_log'),
    'audit_mais_antigo', (select min(criado_em) from audit_log),
    'evento_linhas',   (select count(*) from evento_log),
    'evento_bytes',    pg_total_relation_size('evento_log'),
    'evento_mais_antigo', (select min(criado_em) from evento_log),
    'banco_bytes',     pg_database_size(current_database()),
    'banco_limite',    500 * 1024 * 1024
  );
end $$;

grant execute on function saude_logs() to authenticated;

-- ── Opcional: automatizar a poda ─────────────────────────────
-- Se um dia o volume justificar, habilite pg_cron no painel do Supabase
-- (Database > Extensions) e agende:
--   select cron.schedule('podar-logs', '0 4 1 * *', $$ select podar_logs(); $$);
-- Fica como opcao, nao como padrao - ver D9 na spec.

select registrar_migration('032', 'Registros e logs: evento_log, auditoria por exclusao, poda');
