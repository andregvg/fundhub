-- ============================================================
-- 029 - Documentos e telefones no formato canônico
-- Rode no SQL Editor, depois da 028.
--
-- Máscara é affordance de INTERFACE. O que o banco guarda é o dado, e
-- confundir os dois é o que fazia `servidor.cpf` valer '111.111.111-11'
-- e `telefone.numero` valer '(16) 3333-3333'. Formato de exibição muda
-- com o locale; o dado, não.
--
--   servidor.cpf     11 dígitos, sem pontuação.
--   servidor.rg      caracteres do documento, caixa alta, sem pontuação.
--                    NÃO há padrão nacional de RG - cada estado emite o
--                    seu -, então nada de checar tamanho, e a LETRA fica:
--                    o DV paulista pode ser 'X' e o mineiro traz o prefixo
--                    da UF ('MG…'). Some só o que separa.
--   telefone.numero  E.164 (ITU-T): '+5516999999999'. É o que
--                    libphonenumber, Twilio e WhatsApp usam, e o que o
--                    URI `tel:` (RFC 3966) quer.
--
-- Idempotente: rodar de novo não muda nada, porque o que já está no
-- formato não casa com os filtros.
-- ============================================================

-- ── CPF e RG: só tirar pontuação ─────────────────────────────
-- Sem inferência nenhuma aqui, então dá para travar o invariante já
-- válido de uma vez.
update servidor set cpf = regexp_replace(cpf, '[^0-9]', '', 'g')
 where cpf is not null and cpf ~ '[^0-9]';

update servidor set rg = regexp_replace(upper(rg), '[^0-9A-Z]', '', 'g')
 where rg is not null and upper(rg) ~ '[^0-9A-Z]';

-- Campo que ficou vazio depois da limpeza não é documento, é sujeira.
update servidor set cpf = null where cpf = '';
update servidor set rg  = null where rg  = '';

alter table servidor drop constraint if exists servidor_cpf_sem_mascara;
alter table servidor add  constraint servidor_cpf_sem_mascara
  check (cpf is null or cpf !~ '[^0-9]');

alter table servidor drop constraint if exists servidor_rg_sem_mascara;
alter table servidor add  constraint servidor_rg_sem_mascara
  check (rg is null or rg !~ '[^0-9A-Z]');

-- ── Telefone: E.164 ──────────────────────────────────────────
-- Escada de tamanhos, do mais completo ao menos - a mesma de paraE164()
-- em shared/ui/phones.js. Boa parte da base foi cadastrada sem DDD
-- ('3333-3333'), e é justamente essa ambiguidade que o código do país
-- explícito encerra.
do $$
declare
  n int;
begin
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

  -- Só os dígitos locais: assume DDD 16 (Ribeirão Preto e região), que é
  -- o mesmo palpite que o cadastro já fazia na tela.
  update telefone t set numero = '+5516' || d.digitos
    from (select id, regexp_replace(numero, '[^0-9]', '', 'g') as digitos from telefone) d
   where t.id = d.id
     and t.numero !~ '^\+'
     and length(d.digitos) in (8, 9);

  select count(*) into n from telefone where numero !~ '^\+[1-9][0-9]{7,14}$';
  if n > 0 then
    raise notice 'ATENCAO: % telefone(s) fora de E.164 - rode a consulta do fim deste arquivo e corrija a mao.', n;
  end if;
end $$;

-- NOT VALID de propósito: passa a valer para toda linha nova ou alterada,
-- sem abortar a migration por causa de um resto legado (um "ramal 4"
-- digitado no campo). Depois de limpar o que a consulta abaixo listar:
--   alter table telefone validate constraint telefone_e164;
alter table telefone drop constraint if exists telefone_e164;
alter table telefone add  constraint telefone_e164
  check (numero ~ '^\+[1-9][0-9]{7,14}$') not valid;

-- O que sobrou fora do formato (deve vir vazio):
--   select id, numero from telefone where numero !~ '^\+[1-9][0-9]{7,14}$';

-- servidor e telefone já estão na auditoria da 019 - nada a religar.
-- Nenhum dado real nesta migration: ela só reformata o que já existe.

select registrar_migration('029', 'Documentos e telefones no formato canonico (CPF/RG sem mascara, telefone em E.164)');
