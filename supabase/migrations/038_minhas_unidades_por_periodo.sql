-- ============================================================
-- 038 - minhas_unidades() volta a funcionar
--
-- O DEFEITO: a função nasceu na 021, quando o vínculo era por ANO LETIVO
-- (`v.ativo` e `v.ano = ano corrente`). A 023 trocou o vínculo por
-- PERÍODO (ingresso/fim) e dropou a coluna `ativo` - mas não reescreveu
-- esta função. Desde então toda chamada falha com 42703 (coluna
-- inexistente), e o PostgREST responde 400 ao `rpc/minhas_unidades` que
-- core/perfil.js faz no login.
--
-- O QUE ISSO QUEBRAVA: o nível `proprios`. `ve_unidade`,
-- `escreve_unidade`, `ve_solicitacao` e as policies de participação do
-- SATE perguntam "esta unidade é minha?" por esta função. Para quem tem
-- `escrita` ou `leitura` o CASE nem chega a chamá-la - por isso o admin
-- não percebeu nada além do 400 no console.
--
-- A REGRA: vínculo aberto = SEM data de fim. É a mesma de
-- `vinculosAbertos()` em servidores.model.js - uma regra, um lugar em
-- cada lado da fronteira.
--
-- Idempotente: create or replace, mesma assinatura.
-- ============================================================

create or replace function minhas_unidades() returns setof uuid
  language sql stable security definer set search_path = public as $$
    select v.unidade_id
      from vinculo v
     where v.servidor_id = meu_servidor_id()
       and v.fim is null
  $$;

grant execute on function minhas_unidades() to authenticated;

select registrar_migration('038',
  'minhas_unidades() por periodo - a 023 dropou vinculo.ativo e a funcao seguia lendo a coluna');
