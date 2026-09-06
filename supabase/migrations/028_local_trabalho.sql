-- ============================================================
-- 028 - Locais de trabalho não-escolares
-- Rode no SQL Editor, depois da 027 (ou da 026 se a 027 ainda não
-- entrou - são independentes).
--
-- Uma gerência ou subsecretaria da SME é um LOCAL DE TRABALHO, mas
-- não uma escola. Em vez de uma tabela nova (que obrigaria `vinculo`
-- a apontar para dois destinos), é uma linha de unidade_escolar com
-- tipo = 'interno' - o mesmo discriminador que a 023 criou para a
-- "SME - Sede".
--
-- getUnidades() (tela de Escolas) continua filtrando tipo = 'escola',
-- então uma gerência não aparece lá. getLocais() (seletor de local de
-- trabalho) passa a trazer os três tipos.
-- ============================================================

alter table unidade_escolar drop constraint if exists unidade_tipo_valido;
alter table unidade_escolar add constraint unidade_tipo_valido
  check (tipo in ('escola', 'sede', 'interno'));

-- unidade_escolar já está na auditoria da 019 e no realtime; nada a
-- religar. Os nomes dos locais internos os cadastra o admin pela tela
-- (painel de configuração de Escolas) - nenhum dado real nesta migration.

select registrar_migration('028', 'Locais de trabalho nao-escolares (unidade_escolar.tipo = interno)');
