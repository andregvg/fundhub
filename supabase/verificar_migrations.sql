-- ============================================================
-- FundHub — verificar_migrations.sql  (diagnóstico, não altera nada)
--
-- O projeto não tem tabela de controle de migrations: elas são
-- rodadas à mão no SQL Editor. Este script infere quais rodaram
-- procurando o ARTEFATO característico de cada uma (a tabela, a
-- coluna ou a função que ela cria).
--
-- Rode no SQL Editor do Supabase. É só leitura — pode rodar quantas
-- vezes quiser, em qualquer ordem, sem efeito colateral.
--
-- Leia o resultado assim:
--   OK        — o artefato existe; a migration rodou.
--   FALTA     — não existe; rode essa migration.
-- Se aparecer FALTA no meio de uma sequência de OK, rode da primeira
-- que falta em diante, na ordem numérica.
--
-- CUIDADO ao acrescentar linhas aqui: o critério tem que ser um efeito
-- que a migration REALMENTE produz. A primeira versão deste arquivo
-- procurava uma coluna `audit_log.diff` para a 019 — coluna que não
-- existe em lugar nenhum, e que a 019 nem tentaria criar (ela só
-- religa triggers). O resultado era um FALTA permanente e falso.
-- Confira na migration antes de escrever a checagem.
-- ============================================================

with checagem(ordem, migration, o_que_cria, existe) as (
  values
    (2,  '002_leitura_allowlist',   'função is_autorizado()',
         to_regprocedure('public.is_autorizado()') is not null),

    (4,  '004_sate',                'tabela solicitacao_transporte',
         to_regclass('public.solicitacao_transporte') is not null),

    (5,  '005_solicitacao_extra',   'solicitacao_transporte.destino_nome',
         exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='solicitacao_transporte'
                    and column_name='destino_nome')),

    (6,  '006_realtime',            'publicação realtime de solicitacao_transporte',
         exists (select 1 from pg_publication_tables
                  where pubname='supabase_realtime' and tablename='solicitacao_transporte')),

    (7,  '007_calendario',          'tabela dia_calendario',
         to_regclass('public.dia_calendario') is not null),

    (8,  '008_afastamentos',        'tabela afastamento',
         to_regclass('public.afastamento') is not null),

    (9,  '009_horarios',            'tabela horario_bloco',
         to_regclass('public.horario_bloco') is not null),

    (10, '010_ocorrencias',         'tabela ocorrencia',
         to_regclass('public.ocorrencia') is not null),

    (11, '011_auditoria',           'tabela audit_log + registrar_acesso()',
         to_regclass('public.audit_log') is not null
         and to_regprocedure('public.registrar_acesso()') is not null),

    (12, '012_visitas',             'tabela relatorio_visita',
         to_regclass('public.relatorio_visita') is not null),

    (13, '013_atas',                'tabela ata_atendimento',
         to_regclass('public.ata_atendimento') is not null),

    (14, '014_realtime_extra',      'publicação realtime de afastamento',
         exists (select 1 from pg_publication_tables
                  where pubname='supabase_realtime' and tablename='afastamento')),

    (15, '015_projetos',            'tabelas projeto + projeto_interesse',
         to_regclass('public.projeto') is not null
         and to_regclass('public.projeto_interesse') is not null),

    (16, '016_telefone',            'tabela telefone',
         to_regclass('public.telefone') is not null),

    (17, '017_local',               'tabela local + solicitacao.local_id',
         to_regclass('public.local') is not null),

    (18, '018_afastamento_extra',   'afastamento.status',
         exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='afastamento'
                    and column_name='status')),

    -- A 019 não cria tabela nem coluna: ela RELIGA o trigger trg_audit
    -- em todas as tabelas auditáveis (é rede de segurança, idempotente).
    -- Então o que se verifica é o efeito: nenhuma tabela auditável que
    -- exista pode estar sem o trigger.
    (19, '019_auditoria_completa',  'trg_audit em todas as tabelas auditáveis',
         not exists (
           select 1
             from unnest(array[
               'unidade_escolar','regional','servidor','vinculo','perfil','telefone',
               'atividade_extraclasse','solicitacao_transporte','oferta_onibus','local',
               'dia_calendario','afastamento','horario_bloco','ocorrencia',
               'relatorio_visita','ata_atendimento','projeto','projeto_interesse'
             ]) as t(nome)
            where to_regclass('public.' || t.nome) is not null
              and not exists (
                select 1 from pg_trigger g
                 where g.tgrelid = to_regclass('public.' || t.nome)
                   and g.tgname = 'trg_audit'
                   and not g.tgisinternal)
         )),

    (20, '020_afastamento_sync',    'afastamento.chave_externa',
         exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='afastamento'
                    and column_name='chave_externa')),

    (21, '021_permissoes_segmentos','tabela papel_permissao + perfil.segmentos',
         to_regclass('public.papel_permissao') is not null
         and exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='perfil'
                        and column_name='segmentos'))
)
select
  migration,
  o_que_cria                              as "artefato verificado",
  case when existe then 'OK' else 'FALTA' end as situacao
from checagem
order by ordem;
