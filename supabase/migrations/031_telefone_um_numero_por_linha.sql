-- ============================================================
-- 031 - Um numero de telefone por linha
--
-- A 016 trouxe os telefones do seed de julho como texto livre, e ali
-- havia campo com DOIS numeros no mesmo registro, separados por barra.
-- A escada de conversao da 029 decide pelo TAMANHO em digitos (13, 11,
-- 10, 9, 8), e dois numeros concatenados dao 22 - nenhum degrau casa,
-- entao a linha atravessou a 029 intacta. Foi o `not valid` do CHECK
-- `telefone_e164` que impediu a migration de abortar por causa dela.
--
-- Esta migration corrige a CLASSE, nao o caso: qualquer campo com
-- separador vira uma linha por numero, e o que sobrar fora de E.164
-- passa pela mesma escada da 029. Nao ha id nem numero aqui - o
-- repositorio e publico (R7), e de todo modo a regra e que precisa
-- sobreviver a um rebuild, nao a linha.
--
-- Depois desta migration o CHECK pode ser validado:
--   alter table telefone validate constraint telefone_e164;
--
-- Idempotente: ao fim nenhuma linha tem separador, entao rodar de novo
-- nao insere nem altera nada.
-- ============================================================

do $$
declare
  n_partes int;
  n_fora   int;
begin
  -- ── 1. Um numero por linha ────────────────────────────────
  -- A PRIMEIRA parte fica na linha original: preserva o id, o
  -- `principal` e qualquer coisa que aponte para ela. As demais nascem
  -- como linhas novas, herdando dono, tipo, rotulo e observacao - e
  -- NUNCA principais, senao o dono acabaria com dois telefones
  -- principais (nada no banco impede isso; quem garante um so e a tela).
  with extras as (
    select t.servidor_id, t.unidade_id, t.tipo, t.rotulo, t.obs, p.parte
      from telefone t
      cross join lateral regexp_split_to_table(t.numero, '[/;]')
                    with ordinality as p(parte, ord)
     where t.numero ~ '[/;]'
       and p.ord > 1
       -- pedaco sem digito nenhum (barra sobrando no fim) nao vira linha
       and regexp_replace(p.parte, '[^0-9]', '', 'g') <> ''
  )
  insert into telefone (servidor_id, unidade_id, tipo, rotulo, numero, principal, obs)
  select servidor_id, unidade_id, tipo, rotulo, btrim(parte), false, obs from extras;

  get diagnostics n_partes = row_count;

  update telefone
     set numero = btrim((regexp_split_to_array(numero, '[/;]'))[1])
   where numero ~ '[/;]';

  if n_partes > 0 then
    raise notice '% telefone(s) extraidos de campos com mais de um numero.', n_partes;
  end if;

  -- ── 2. A mesma escada de E.164 da 029 ─────────────────────
  -- Repetida aqui de proposito: as linhas criadas acima nasceram com o
  -- texto original (mascara e tudo) e nunca passaram pela 029. Rodar a
  -- escada de novo tambem e inofensivo para quem ja esta em E.164 - o
  -- filtro `numero !~ '^\+'` deixa esses de fora.
  update telefone t set numero = '+' || d.digitos
    from (select id, regexp_replace(numero, '[^0-9]', '', 'g') as digitos from telefone) d
   where t.id = d.id
     and t.numero !~ '^\+'
     and length(d.digitos) between 12 and 13
     and d.digitos like '55%';

  update telefone t set numero = '+55' || d.digitos
    from (select id, regexp_replace(numero, '[^0-9]', '', 'g') as digitos from telefone) d
   where t.id = d.id
     and t.numero !~ '^\+'
     and length(d.digitos) in (10, 11);

  -- So os digitos locais: assume DDD 16 (Ribeirao Preto e regiao), o
  -- mesmo palpite que o cadastro ja fazia na tela.
  update telefone t set numero = '+5516' || d.digitos
    from (select id, regexp_replace(numero, '[^0-9]', '', 'g') as digitos from telefone) d
   where t.id = d.id
     and t.numero !~ '^\+'
     and length(d.digitos) in (8, 9);

  select count(*) into n_fora from telefone where numero !~ '^\+[1-9][0-9]{7,14}$';
  if n_fora > 0 then
    raise notice 'ATENCAO: % telefone(s) ainda fora de E.164 - rode a consulta do fim deste arquivo.', n_fora;
  else
    raise notice 'Todos os telefones em E.164. Pode validar o CHECK.';
  end if;
end $$;

-- O que sobrou fora do formato (deve vir vazio):
--   select id, numero from telefone where numero !~ '^\+[1-9][0-9]{7,14}$';
--
-- Vindo vazia, o CHECK que a 029 criou como `not valid` passa a valer
-- para o legado tambem:
--   alter table telefone validate constraint telefone_e164;

-- telefone ja esta na auditoria da 019 - nada a religar.
-- Nenhuma policy, nenhuma coluna: esta migration so redistribui dado.

select registrar_migration('031', 'Um numero de telefone por linha (separa campo com mais de um numero)');
