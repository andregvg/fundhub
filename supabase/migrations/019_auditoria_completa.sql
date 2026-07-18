-- ============================================================
-- 019 — Auditoria: religa o trigger em TODAS as tabelas auditáveis
-- Rode no SQL Editor, depois da 018.
--
-- Não introduz nada novo: cada migration já religa o trigger da sua
-- própria tabela (011 no lote inicial, 012/013/015/016/017 nas suas).
-- Esta é a REDE DE SEGURANÇA e a lista canônica num lugar só — pega
-- qualquer tabela que tenha nascido sem trigger (ou perdido o dele) e
-- é idempotente: pode rodar quantas vezes quiser.
--
-- Ao criar uma tabela auditável nova: religue o trigger na migration
-- dela E acrescente o nome ao array abaixo.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    -- cadastros núcleo
    'unidade_escolar','regional','servidor','vinculo','perfil','telefone',
    -- SATE / transporte
    'atividade_extraclasse','solicitacao_transporte','oferta_onibus','local',
    -- rotina da gerência
    'dia_calendario','afastamento','horario_bloco','ocorrencia',
    'relatorio_visita','ata_atendimento','projeto','projeto_interesse'
  ] loop
    -- só age se a tabela existir (o banco pode estar em migration parcial)
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit on %I', t);
      execute format(
        'create trigger trg_audit after insert or update or delete on %I
           for each row execute function fn_audit()', t);
    end if;
  end loop;
end $$;

-- Conferência rápida: lista as tabelas auditáveis SEM trigger (deve vir vazio).
-- select c.relname
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind = 'r'
--    and c.relname in ('unidade_escolar','servidor','telefone','local','afastamento')
--    and not exists (select 1 from pg_trigger g
--                     where g.tgrelid = c.oid and g.tgname = 'trg_audit');
