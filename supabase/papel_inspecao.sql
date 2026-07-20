-- ============================================================
-- FundHub — papel_inspecao.sql
-- Cria um papel de banco que enxerga a FORMA do schema (tabelas,
-- colunas, policies, triggers, funções) e NENHUM dado das tabelas.
--
-- Para que serve: dar a um assistente/ferramenta externa a capacidade
-- de conferir o schema sem nunca ver CPF, RG, motivo de licença ou
-- qualquer dado pessoal de servidor.
--
-- A motivação é concreta. Dois erros reais foram cometidos por não se
-- conferir a forma do schema:
--   • uma policy criada sobre `oferta_onibus.unidade_id`, coluna que
--     não existe — a migration 021 abortou no meio;
--   • um verificador que procurava `audit_log.diff`, coluna que não
--     existe em lugar nenhum — a migration 019 aparecia como pendente
--     mesmo depois de rodada.
-- Os dois seriam pegos por uma consulta ao information_schema. Nenhum
-- dos dois exigia ler uma única linha de dado real.
--
-- É por isso que este papel é de SCHEMA, e não "somente leitura":
-- somente leitura ainda enxergaria os 144 cadastros e os documentos
-- dos servidores. O acesso deve ser do tamanho do problema.
--
-- COMO USAR
--   1. Troque a senha abaixo por uma gerada aleatoriamente.
--   2. Rode no SQL Editor.
--   3. A string de conexão fica:
--      postgresql://fundhub_inspetor:SENHA@<host>:5432/postgres
--      (Project Settings → Database → Connection string)
--   4. Guarde essa string FORA do repositório (o repo é público).
--
-- PARA REVOGAR, a qualquer momento:
--   drop owned by fundhub_inspetor;  drop role fundhub_inspetor;
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'fundhub_inspetor') then
    -- TROQUE A SENHA antes de rodar.
    create role fundhub_inspetor with login password 'TROQUE-ESTA-SENHA'
      nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end $$;

-- Conectar ao banco e enxergar que o schema `public` existe.
grant connect on database postgres to fundhub_inspetor;
grant usage   on schema public   to fundhub_inspetor;

-- Nada de dados. Explícito, e não por omissão: se alguém no futuro
-- rodar um "grant select on all tables", estas linhas documentam que
-- foi uma decisão revertida, não um esquecimento.
revoke select on all tables    in schema public from fundhub_inspetor;
revoke all    on all functions in schema public from fundhub_inspetor;
revoke all    on all sequences in schema public from fundhub_inspetor;

-- E que tabelas criadas DEPOIS disto também nasçam invisíveis.
alter default privileges in schema public
  revoke select on tables from fundhub_inspetor;

-- O catálogo do Postgres (pg_catalog e information_schema) já é
-- legível por qualquer papel — é ele que descreve a forma do schema.
-- Não é preciso conceder nada: basta NÃO conceder o resto.

-- ── Conferência ──────────────────────────────────────────────
-- Rode como fundhub_inspetor para confirmar o comportamento:
--
--   -- deve FUNCIONAR (forma):
--   select table_name, column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'servidor';
--
--   -- deve FALHAR com "permission denied for table servidor" (dados):
--   select * from servidor limit 1;
