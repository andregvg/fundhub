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
-- Ela tambem VALIDA o CHECK `telefone_e164` que a 029 deixou `not valid`,
-- quando nao sobrar nenhuma linha fora do formato - ver a secao 3.
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

  -- ── 3. Validar o CHECK, quando der ───────────────────────
  -- A 029 criou `telefone_e164` como `not valid` para nao abortar por
  -- causa do legado sujo, e deixou a validacao como passo MANUAL. Passo
  -- manual e o que fica esquecido: ficou, da 029 ate aqui. Pior, num
  -- rebuild a constraint ficaria `not valid` para sempre, porque ninguem
  -- lembra de rodar um comando que nao esta em migration nenhuma.
  --
  -- A migration sabe a condicao, entao ela decide: limpou, valida. Sujo,
  -- avisa e deixa passar - abortar aqui so travaria o rebuild inteiro por
  -- causa de uma linha que alguem precisa olhar.
  select count(*) into n_fora from telefone where numero !~ '^\+[1-9][0-9]{7,14}$';
  if n_fora > 0 then
    raise notice 'ATENCAO: % telefone(s) ainda fora de E.164 - rode a consulta do fim deste arquivo e corrija a mao. O CHECK segue NOT VALID.', n_fora;
  elsif exists (select 1 from pg_constraint
                 where conname = 'telefone_e164'
                   and conrelid = 'telefone'::regclass
                   and not convalidated) then
    alter table telefone validate constraint telefone_e164;
    raise notice 'Todos os telefones em E.164 - CHECK telefone_e164 validado.';
  else
    -- Ou a constraint ja foi validada (rodar de novo nao custa nada), ou a
    -- 029 nao rodou neste banco - em nenhum dos dois casos ha o que fazer
    -- aqui, e nos dois abortar seria pior que seguir.
    raise notice 'Todos os telefones em E.164; CHECK ja validado ou ausente.';
  end if;
end $$;

-- Se o aviso acima disse que sobrou telefone fora do formato, veja quais:
--   select id, numero from telefone where numero !~ '^\+[1-9][0-9]{7,14}$';
-- Corrija a mao e rode esta migration de novo - ela e idempotente, e na
-- segunda passada valida o CHECK sozinha.

-- telefone ja esta na auditoria da 019 - nada a religar.
-- Nenhuma policy, nenhuma coluna: esta migration so redistribui dado.

select registrar_migration('031', 'Um numero de telefone por linha (separa campo com mais de um numero)');
