-- ============================================================
-- 022 — Controle de migrations
-- Rode no SQL Editor, depois da 021.
--
-- Até aqui não havia registro de quais migrations tinham sido
-- aplicadas. A única forma de saber era inspecionar o schema e
-- inferir — o que já custou caro duas vezes:
--
--   • a 019 apareceu como "FALTA" por semanas porque o critério de
--     verificação procurava uma coluna que ela não cria (e que não
--     existe em lugar nenhum);
--   • a 018/019/020 ficaram pendentes sem ninguém perceber, até
--     alguém tropeçar nelas por acaso.
--
-- O erro não foi de atenção: é que "inferir do schema" exige escrever
-- um critério correto para cada migration, à mão, e um critério errado
-- mente com a mesma confiança de um certo. Registrar o fato elimina a
-- categoria inteira do problema.
--
-- Daqui em diante: TODA migration nova termina com
--     select registrar_migration('023');
-- e a pergunta "o que falta rodar?" vira um select.
-- ============================================================

create table if not exists schema_migrations (
  versao       text primary key,          -- '021', '022'… (o prefixo do arquivo)
  descricao    text,
  aplicada_em  timestamptz not null default now(),
  aplicada_por text default current_user
);

comment on table schema_migrations is
  'Migrations aplicadas neste banco. Preenchida por registrar_migration(), '
  'chamada na última linha de cada arquivo em supabase/migrations/.';

-- Idempotente de propósito: rodar a mesma migration duas vezes só
-- atualiza o carimbo, nunca falha por chave duplicada. Migration que
-- explode na segunda execução vira armadilha na hora do reparo.
create or replace function registrar_migration(p_versao text, p_descricao text default null)
  returns void
  language sql security definer set search_path = public as $$
    insert into schema_migrations (versao, descricao, aplicada_por)
    values (p_versao, p_descricao, current_user)
    on conflict (versao) do update
      set aplicada_em = now(), aplicada_por = current_user,
          descricao = coalesce(excluded.descricao, schema_migrations.descricao);
  $$;

-- ── RLS ──────────────────────────────────────────────────────
-- Todo autorizado LÊ (a tela de Documentação vai querer mostrar o
-- estado do banco); só admin escreve. Na prática quem escreve é a
-- função acima, rodando como definer no SQL Editor.
alter table schema_migrations enable row level security;
alter table schema_migrations force  row level security;

drop policy if exists schema_migrations_sel on schema_migrations;
drop policy if exists schema_migrations_wr  on schema_migrations;
create policy schema_migrations_sel on schema_migrations for select using (is_autorizado());
create policy schema_migrations_wr  on schema_migrations for all
  using (is_admin()) with check (is_admin());

grant select on schema_migrations to authenticated;
grant execute on function registrar_migration(text, text) to authenticated;

-- ── Backfill ─────────────────────────────────────────────────
-- As migrations abaixo já estão aplicadas neste banco — confirmado
-- pelo verificar_migrations.sql, que checou o artefato de cada uma e
-- devolveu OK nas 19. O carimbo de data é o de AGORA, não o da
-- aplicação real (essa informação se perdeu, e inventá-la seria pior
-- do que assumir a lacuna).
--
-- 001 e 003 não constam: o schema inicial vive em supabase/schema.sql
-- e a 003 é só grants. Registrados aqui para a sequência ficar honesta.
insert into schema_migrations (versao, descricao, aplicada_por) values
  ('000', 'schema.sql — schema inicial (perfil, servidor, unidade_escolar, vinculo)', 'backfill'),
  ('002', 'Leitura por allowlist — is_autorizado()',                'backfill'),
  ('003', 'Grants',                                                  'backfill'),
  ('004', 'SATE — atividades, oferta de ônibus, solicitações',       'backfill'),
  ('005', 'Solicitação: campos extras de destino e horário',         'backfill'),
  ('006', 'Realtime para solicitacao_transporte',                    'backfill'),
  ('007', 'Calendário escolar',                                      'backfill'),
  ('008', 'Afastamentos',                                            'backfill'),
  ('009', 'Horários de trabalho',                                    'backfill'),
  ('010', 'Ocorrências',                                             'backfill'),
  ('011', 'Auditoria — audit_log, fn_audit(), registrar_acesso()',   'backfill'),
  ('012', 'Relatórios de visita',                                    'backfill'),
  ('013', 'Atas de atendimento',                                     'backfill'),
  ('014', 'Realtime para afastamento e ocorrencia',                  'backfill'),
  ('015', 'Projetos e interesse das escolas',                        'backfill'),
  ('016', 'Telefones — tabela dedicada para escolas e servidores',   'backfill'),
  ('017', 'Locais / destinos do SATE',                               'backfill'),
  ('018', 'Afastamento: status e processo',                          'backfill'),
  ('019', 'Auditoria: religa trg_audit em todas as tabelas',         'backfill'),
  ('020', 'Afastamento: sincronização por chave_externa',            'backfill'),
  ('021', 'Permissões por módulo, segmentos e perfil↔servidor',      'backfill')
on conflict (versao) do nothing;

-- Esta migration se registra por último — é o padrão a seguir daqui
-- em diante, e serve de exemplo vivo.
select registrar_migration('022', 'Controle de migrations (schema_migrations)');

-- ── Como usar ────────────────────────────────────────────────
-- O que já rodou:
--   select versao, descricao, aplicada_em from schema_migrations order by versao;
--
-- O que falta rodar: compare com os arquivos de supabase/migrations/.
-- O verificar_migrations.sql continua útil como AUDITORIA independente
-- — ele checa o efeito no schema, não o que o banco diz de si mesmo.
-- Os dois discordarem é sinal de que alguém mexeu à mão.
