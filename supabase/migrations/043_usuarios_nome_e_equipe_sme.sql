-- ============================================================
-- 043 - Usuarios: nome de exibicao em caixa alta e Equipe SME leitora
-- Rode no SQL Editor do Supabase (apos a 042).
-- Spec: docs/superpowers/specs/2026-09-26-usuarios-ajustes-design.md
--
-- 1. Todo nome de exibicao e gravado em MAIUSCULAS - pelo gatilho, e nao
--    so pela tela: vale para a edicao em Meus dados e para SQL direto.
-- 2. Equipe SME passa de escrita para leitura em sete modulos. Vale para
--    TODOS os Equipe SME, inclusive os existentes (decisao de 26/09/2026):
--    o padrao do papel e consultado ao vivo, nao copiado. Quem precisar
--    escrever recebe excecao individual.
--
-- Idempotente.
-- ============================================================

create or replace function fn_perfil_nome_maiusculo() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.nome := nullif(upper(btrim(coalesce(new.nome, ''))), '');
  return new;
end $$;

drop trigger if exists trg_perfil_nome_maiusculo on perfil;
create trigger trg_perfil_nome_maiusculo before insert or update on perfil
  for each row execute function fn_perfil_nome_maiusculo();

-- Os nomes que ja existem. O `where` evita reescrever linha que ja esta
-- certa (e gerar linha de auditoria a toa).
update perfil set nome = nullif(upper(btrim(nome)), '')
 where nome is not null and nome is distinct from nullif(upper(btrim(nome)), '');

update papel_permissao set nivel = 'leitura'
 where papel = 'equipe_sme'
   and modulo in ('sate', 'viagens', 'afastamentos', 'projetos', 'ocorrencias', 'atas', 'visitas')
   and nivel <> 'leitura';

select religar_auditoria();

select registrar_migration('043',
  'Usuarios: nome de exibicao em maiusculas (gatilho) e Equipe SME com leitura em sete modulos');
