-- ============================================================
-- 033 - O mapa do admin passa a ser um curinga
-- Rode no SQL Editor, depois da 032.
--
-- O BUG: `meu_mapa_permissoes()` montava a lista do admin a partir de
-- `select distinct modulo from papel_permissao`. Modulo que nenhum
-- papel recebe nunca aparece ali - entao um modulo SO DE ADMIN nascia
-- `oculto` para o proprio admin, e o roteador respondia "Acesso
-- restrito" a quem pode tudo.
--
-- `usuarios` so escapava porque estava escrito a mao no literal ao
-- lado. `auditoria` (migration 032) caiu direto na armadilha, e todo
-- modulo administrativo futuro cairia tambem.
--
-- A CORRECAO: admin nao tem lista. `is_admin()` significa "tudo", e o
-- mapa passa a dizer exatamente isso - `{"*": "escrita"}`. O front
-- (core/permissoes.js) le `*` como padrao quando o modulo nao tem
-- entrada propria. Nao ha mais lista para alguem esquecer de atualizar.
--
-- ISTO NAO E CONTROLE DE ACESSO (R6). Este mapa decide o que APARECE;
-- quem barra continua sendo o RLS, via `nivel_modulo()`, que ja trata
-- admin por conta propria (`if is_admin() then return 'escrita'`,
-- migration 021) e nao depende desta funcao. Um nao-admin nao ganha
-- nada aqui: o ramo `else` esta intocado.
--
-- Idempotente: create or replace.
-- ============================================================

create or replace function meu_mapa_permissoes() returns jsonb
  language sql stable security definer set search_path = public as $$
    select case
      when is_admin() then
        -- Curinga: vale para todo modulo, inclusive os que ainda nao
        -- existem. Ver core/permissoes.js -> nivel().
        '{"*":"escrita"}'::jsonb
      else
        coalesce(
          (select jsonb_object_agg(pp.modulo, pp.nivel::text)
             from papel_permissao pp
             join perfil p on p.papel = pp.papel
            where p.email = auth_email() and p.ativo),
          '{}'::jsonb)
        || coalesce((select permissoes from perfil where email = auth_email() and ativo), '{}'::jsonb)
        || '{"meus_dados":"escrita","modulos":"leitura","configuracoes":"escrita","ajuda":"escrita"}'::jsonb
    end
  $$;

grant execute on function meu_mapa_permissoes() to authenticated;

-- Conferencia: logado como admin, tem de devolver {"*": "escrita"}.
--   select meu_mapa_permissoes();

select registrar_migration('033', 'Mapa do admin vira curinga (corrige modulo admin oculto para admin)');
