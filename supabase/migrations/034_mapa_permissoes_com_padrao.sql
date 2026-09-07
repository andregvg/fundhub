-- ============================================================
-- 034 - O mapa de permissoes passa a declarar o proprio padrao
-- Rode no SQL Editor, depois da 033.
--
-- POR QUE ESTA MIGRATION EXISTE (e a 033 nao bastou)
--
-- A 033 consertou o bug certo pelo caminho errado. O bug: modulo so de
-- admin nascia `oculto` para o proprio admin, porque a lista vinha de
-- `select distinct modulo from papel_permissao` e modulo que nenhum
-- papel recebe nunca esta la. A correcao da 033 foi devolver
-- `{"*":"escrita"}` - um VALOR-SENTINELA: uma chave que nao e um modulo,
-- dentro de um objeto cujo tipo e "modulo -> nivel". Quem lesse o mapa
-- em outro lugar precisaria saber de um segredo que o formato nao conta.
--
-- O fato real nunca foi "existe um modulo chamado *". E que todo sistema
-- de permissao tem um NIVEL PADRAO: o que vale para modulo sem regra
-- propria. Esse conceito ja existia no FundHub - estava escondido numa
-- linha de JavaScript (`return OCULTO` em core/permissoes.js), longe do
-- banco que decide todo o resto. Para admin o padrao e `escrita`; para
-- os demais, `oculto`.
--
-- Agora o payload declara isso, e se explica sozinho:
--
--   { "padrao": "escrita", "modulos": {} }                    <- admin
--   { "padrao": "oculto",  "modulos": {"escolas":"leitura"} } <- os demais
--
-- Ganho concreto alem da clareza: a politica "oculto por omissao" deixa
-- de ser constante em JS e passa a ser dado do banco - a mesma fonte que
-- manda em todo o resto (R6).
--
-- ISTO NAO E CONTROLE DE ACESSO. Este mapa decide o que APARECE; quem
-- barra e o RLS, via nivel_modulo(), que trata admin sozinho
-- (`if is_admin() then return 'escrita'`, migration 021) e nao depende
-- desta funcao. Um nao-admin nao ganha nada aqui.
--
-- Idempotente: create or replace.
-- ============================================================

create or replace function meu_mapa_permissoes() returns jsonb
  language sql stable security definer set search_path = public as $$
    select case
      when is_admin() then
        -- Admin nao tem lista de modulos: `is_admin()` quer dizer tudo,
        -- inclusive os modulos que ainda nao existem. O padrao carrega
        -- esse significado inteiro.
        jsonb_build_object('padrao', 'escrita', 'modulos', '{}'::jsonb)
      else
        jsonb_build_object(
          -- Segura por omissao: modulo sem regra propria nao aparece.
          'padrao', 'oculto',
          'modulos',
            coalesce(
              (select jsonb_object_agg(pp.modulo, pp.nivel::text)
                 from papel_permissao pp
                 join perfil p on p.papel = pp.papel
                where p.email = auth_email() and p.ativo),
              '{}'::jsonb)
            -- Excecoes individuais sobrepoem o preset do papel.
            || coalesce((select permissoes from perfil
                          where email = auth_email() and ativo), '{}'::jsonb)
            -- Os `publico: true` do registry: sem dados proprios, esconder
            -- nao protegeria nada. Ver core/registry.js -> nivelEfetivo().
            || '{"meus_dados":"escrita","modulos":"leitura","configuracoes":"escrita","ajuda":"escrita"}'::jsonb
        )
    end
  $$;

grant execute on function meu_mapa_permissoes() to authenticated;

-- Conferencia:
--   logado como admin      -> {"padrao": "escrita", "modulos": {}}
--   logado como nao-admin  -> {"padrao": "oculto",  "modulos": {...}}
--   select meu_mapa_permissoes();

select registrar_migration('034', 'Mapa de permissoes declara o proprio padrao (substitui o sentinela da 033)');
