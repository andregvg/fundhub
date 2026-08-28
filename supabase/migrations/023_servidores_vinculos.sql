-- ============================================================
-- 023 - Servidor, vínculo e a SME como local de lotação
-- Rode no SQL Editor, depois da 022.
--
-- O princípio: o VÍNCULO é a fonte única do "onde" e do "como" de uma
-- pessoa. Cargo, lotação e período deixam de ser atributos do servidor
-- e passam a ser atributos da designação. Ver
-- docs/superpowers/specs/2026-08-25-servidores-escolas-horarios-design.md
--
-- Idempotente: pode rodar duas vezes sem quebrar.
-- ============================================================

-- ── 1. Data de nascimento ────────────────────────────────────
alter table servidor add column if not exists nascimento date;

-- ── 2. A SME como unidade ────────────────────────────────────
-- Um vínculo com a sede tem a mesma forma de um vínculo com escola.
-- Uma tabela separada obrigaria `vinculo` a apontar para dois destinos,
-- e esse polimorfismo apareceria em todo model e em toda tela.
alter table unidade_escolar add column if not exists tipo text not null
  default 'escola';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'unidade_tipo_valido') then
    alter table unidade_escolar add constraint unidade_tipo_valido
      check (tipo in ('escola', 'sede'));
  end if;
end $$;
create index if not exists idx_unidade_tipo on unidade_escolar(tipo);

-- numero = 0 é reservado: acha a linha sem depender do nome exibido.
insert into unidade_escolar (numero, nome, apelido, tipo, segmento)
values (0, 'SME - Sede', 'SME', 'sede', null)
on conflict (numero) do update
  set tipo = 'sede', segmento = null;

-- ── 3. Vínculo: de "ano letivo" para período ─────────────────
-- 3a. Fecha o que estava marcado como inativo sem data de fim. Esse
-- estado não significa nada e existe na base: `ativo=false` sem `fim`.
-- O guarda é o que torna o arquivo re-executável: 3e dropa `ativo`, e
-- sem ele a segunda execução morreria aqui com 42703.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'vinculo'
                and column_name = 'ativo') then
    update vinculo set fim = make_date(ano, 12, 31)
     where ativo = false and fim is null;
  end if;
end $$;

-- 3a2. Sob o esquema antigo, "renovar o vínculo" era criar uma linha nova
-- por ano sem fechar a anterior - normal sob unique(...,ano), agora
-- colide com o índice único parcial abaixo. Fecha os duplicados abertos,
-- mantendo aberto só o de ingresso mais recente por (servidor, unidade,
-- papel); os demais recebem fim = 31/12 do próprio ano, no mesmo padrão
-- de 3a.
with duplicados as (
  select id, row_number() over (
    partition by servidor_id, unidade_id, papel
    order by ano desc, ingresso desc nulls last, criado_em desc
  ) as rn
  from vinculo
  where fim is null
)
update vinculo v
   set fim = make_date(v.ano, 12, 31)
  from duplicados d
 where v.id = d.id and d.rn > 1;

-- 3b. Cargo vira texto livre. Os três papéis fixos viram os rótulos
-- que a tela já exibia - a partir daqui o valor gravado É o rótulo.
update vinculo set papel = 'Gestor(a)'       where papel = 'gestor';
update vinculo set papel = 'Coordenador(a)'  where papel = 'coordenador';
update vinculo set papel = 'Supervisor(a)'   where papel = 'supervisor';

-- 3c. Quem é da sede não tinha vínculo: a lotação vivia solta em
-- servidor.lotacao + servidor.cargo, sem período. Passa a ter.
-- Guardado por coluna E por "não tem vínculo aberto": na segunda
-- execução ninguém é duplicado.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'servidor'
                and column_name = 'lotacao') then
    insert into vinculo (servidor_id, unidade_id, papel, ano, ingresso)
    select s.id,
           (select id from unidade_escolar where numero = 0),
           btrim(s.cargo),
           coalesce(extract(year from s.inicio_rede)::int, extract(year from now())::int),
           s.inicio_rede
      from servidor s
     where s.lotacao = 'sede'
       and coalesce(btrim(s.cargo), '') <> ''
       and not exists (select 1 from vinculo v where v.servidor_id = s.id and v.fim is null);
  end if;
end $$;

-- 3d. O unique por ano impedia sair da escola e voltar no mesmo ano
-- com o mesmo cargo. O que importa garantir é outra coisa: não existem
-- dois vínculos ABERTOS iguais. Histórico fica livre.
alter table vinculo drop constraint if exists vinculo_servidor_id_unidade_id_papel_ano_key;
create unique index if not exists vinculo_aberto_unico
  on vinculo (servidor_id, unidade_id, papel)
  where fim is null;

-- 3e. Aberto = fim is null. Duas fontes de verdade para o mesmo fato
-- é o que produzia o estado impossível corrigido em 3a.
alter table vinculo drop column if exists ativo;

-- ── 4. A view da equipe gestora ──────────────────────────────
-- Equipe = quem está lá AGORA. E `papel` já vem legível (3b).
create or replace view vw_escola_pessoas
  with (security_invoker = true) as
select u.id as unidade_id, u.numero, u.nome, v.papel, v.ano,
       s.nome as pessoa_nome, s.apelido, s.email,
       coalesce(
         (select t.numero from telefone t
            where t.servidor_id = s.id
            order by t.principal desc, t.criado_em
            limit 1),
         s.telefone
       ) as telefone
from unidade_escolar u
join vinculo v  on v.unidade_id = u.id
join servidor s on s.id = v.servidor_id
where v.fim is null;

-- ── 5. Auditoria ─────────────────────────────────────────────
-- servidor, vinculo e unidade_escolar já estão no array da 019 e o
-- trigger continua válido: nenhuma tabela nova foi criada aqui.

select registrar_migration('023', 'Servidor, vinculo por periodo, cargo livre e SME como unidade');
