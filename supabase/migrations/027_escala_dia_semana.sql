-- ============================================================
-- 027 - Dia da semana da escala
-- Rode no SQL Editor, depois da 025 (escala_tipo) e da 026.
--
-- Uma escala com dia_semana definido entra na gaveta de jornada
-- MESMO com o calendário do ano ainda vazio (problema 1 do Bloco G):
-- em janeiro, antes de o calendário escolar ser lançado, já dá para
-- registrar o horário de TDC de um gestor.
--
-- O calendário continua mandando na resolução data-a-data: dia_semana
-- diz só QUANDO o TDC costuma cair. 1 = segunda … 5 = sexta.
-- ============================================================

alter table escala_tipo add column if not exists dia_semana smallint
  check (dia_semana is null or dia_semana between 1 and 5);

select registrar_migration('027', 'Dia da semana da escala (escala_tipo.dia_semana)');
