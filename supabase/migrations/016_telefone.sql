-- ============================================================
-- 016 — Telefones (tabela dedicada; multi por escola E por servidor)
-- Rode no SQL Editor, depois de todas as anteriores.
--
-- Por que uma tabela dedicada em vez de campo/array por entidade:
--   • escolas já eram multi (unidade_escolar.telefones text[]), mas
--     servidores tinham UM telefone só — a real limitação. Gestores,
--     coordenadores e supervisores SÃO servidores, então herdavam isso.
--   • Uma tabela única dá multi-telefone rotulado + "principal" a
--     escolas E pessoas sem duplicar lógica de array por entidade.
--   • FKs SEPARADAS e nullable (servidor_id | unidade_id) + CHECK de
--     "exatamente um dono" preservam integridade referencial real e
--     cascade — um par polimórfico (tipo,id) perderia as duas coisas.
--   • A RLS do FundHub é uniforme (ler = is_autorizado, escrever =
--     is_admin), então a tabela compartilhada NÃO complica a RLS.
--
-- Colunas legadas (unidade_escolar.telefones/whatsapp, servidor.telefone)
-- ficam DEPRECADAS: são backfilladas uma vez aqui e usadas só como
-- fallback de leitura na view. Drop fica para uma migration futura.
-- ============================================================

create table if not exists telefone (
  id          uuid primary key default gen_random_uuid(),
  servidor_id uuid references servidor(id)        on delete cascade,
  unidade_id  uuid references unidade_escolar(id) on delete cascade,
  tipo        text not null default 'fixo' check (tipo in ('fixo','celular','whatsapp')),
  rotulo      text,
  numero      text not null,
  principal   boolean not null default false,
  obs         text,
  criado_em   timestamptz not null default now(),
  -- exatamente um dono: escola OU servidor, nunca ambos, nunca nenhum
  constraint telefone_um_dono check (
    (servidor_id is not null)::int + (unidade_id is not null)::int = 1
  )
);
create index if not exists idx_tel_servidor on telefone(servidor_id);
create index if not exists idx_tel_unidade  on telefone(unidade_id);

-- ── Backfill (idempotente: só popula se a tabela estiver vazia) ──
-- Roda ANTES de habilitar a RLS; no SQL Editor você é superuser (bypassa
-- RLS de qualquer forma), mas manter a ordem deixa a intenção clara.
do $$
begin
  if not exists (select 1 from telefone) then
    -- escolas: cada item do array vira uma linha (o 1º é o principal)
    insert into telefone (unidade_id, tipo, numero, principal)
    select u.id, 'fixo', trim(t.numero), (t.ord = 1)
    from unidade_escolar u,
         lateral unnest(u.telefones) with ordinality as t(numero, ord)
    where coalesce(trim(t.numero), '') <> '';

    -- escolas: whatsapp (se houver) vira uma linha tipo whatsapp
    insert into telefone (unidade_id, tipo, numero, principal)
    select u.id, 'whatsapp', trim(u.whatsapp), false
    from unidade_escolar u
    where coalesce(trim(u.whatsapp), '') <> '';

    -- servidores: o telefone único vira o principal
    insert into telefone (servidor_id, tipo, numero, principal)
    select s.id, 'celular', trim(s.telefone), true
    from servidor s
    where coalesce(trim(s.telefone), '') <> '';
  end if;
end $$;

-- ── RLS + grants (padrão do FundHub) ─────────────────────────
alter table telefone enable row level security;
alter table telefone force  row level security;
drop policy if exists telefone_sel on telefone;
drop policy if exists telefone_ins on telefone;
drop policy if exists telefone_upd on telefone;
drop policy if exists telefone_del on telefone;
create policy telefone_sel on telefone for select using (is_autorizado());
create policy telefone_ins on telefone for insert with check (is_admin());
create policy telefone_upd on telefone for update using (is_admin()) with check (is_admin());
create policy telefone_del on telefone for delete using (is_admin());
grant select, insert, update, delete on telefone to authenticated;

-- ── View da equipe gestora: passa a exibir o telefone PRINCIPAL da
-- tabela nova, com fallback no campo legado servidor.telefone. Assim
-- Escolas → "equipe gestora" continua correto sem dual-write. ──
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
join servidor s on s.id = v.servidor_id;

-- ── Auditoria (fn_audit vem da 011) ──────────────────────────
drop trigger if exists trg_audit on telefone;
create trigger trg_audit after insert or update or delete on telefone
  for each row execute function fn_audit();
