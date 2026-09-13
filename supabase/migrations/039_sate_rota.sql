-- ============================================================
-- 039 - SATE: trajeto, distancia e tempo de viagem
-- Rode no SQL Editor do Supabase (apos a 038).
-- Spec: docs/superpowers/specs/2026-09-13-sate-rota-design.md
--
-- DUAS COISAS:
--
-- 1. O RETRATO do trajeto na solicitacao (D4). Os minutos sao gravados,
--    nao recalculados a cada leitura: mudar a velocidade media vale para
--    os PROXIMOS agendamentos, igual ao intervalo entre periodos.
--
-- 2. O CACHE de trechos (D3). A distancia entre dois pontos, com as
--    coordenadas arredondadas a 5 casas como chave. Trecho e nao rota
--    inteira: "Escola A -> Museu" se repete; "A, B e C nesta ordem ate o
--    Museu" quase nunca.
--
-- A distancia vem do OpenStreetMap (OSRM), consultado pelo navegador.
-- Nenhuma chave, nenhuma conta, nenhum custo.
--
-- Idempotente: if not exists / drop policy if exists.
-- ============================================================

-- ── 1. Retrato do trajeto na solicitacao ─────────────────────
alter table solicitacao_transporte
  add column if not exists trajeto_km     numeric(7,1),
  add column if not exists trajeto_min    int,
  add column if not exists trajeto_status text,
  add column if not exists trajeto_em     timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sol_trajeto_status_check') then
    -- Nulo = nunca calculado (as viagens de antes deste bloco).
    alter table solicitacao_transporte add constraint sol_trajeto_status_check
      check (trajeto_status is null
             or trajeto_status in ('ok', 'sem_coordenada', 'sem_destino', 'sem_rota', 'erro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sol_trajeto_valores_check') then
    alter table solicitacao_transporte add constraint sol_trajeto_valores_check
      check ((trajeto_km is null or trajeto_km >= 0) and (trajeto_min is null or trajeto_min >= 0));
  end if;
end $$;

comment on column solicitacao_transporte.trajeto_min is
  'Tempo da IDA em minutos, das paradas ao destino. A volta refaz as paradas no sentido inverso e usa o mesmo valor.';

-- ── 2. Cache de trechos ──────────────────────────────────────
create table if not exists trecho (
  id        uuid primary key default gen_random_uuid(),
  de_lat    numeric(8,5) not null,
  de_lng    numeric(8,5) not null,
  para_lat  numeric(8,5) not null,
  para_lng  numeric(8,5) not null,
  km        numeric(7,2) not null check (km >= 0),
  fonte     text not null default 'osrm',
  criado_em timestamptz not null default now()
);

-- Indice unico SIMPLES (sem where): o upsert do PostgREST nao infere
-- indice parcial (.claude/rules/dados.md).
create unique index if not exists idx_trecho_pontos
  on trecho (de_lat, de_lng, para_lat, para_lng);

alter table trecho enable row level security;

drop policy if exists trecho_sel on trecho;
drop policy if exists trecho_ins on trecho;
drop policy if exists trecho_upd on trecho;
drop policy if exists trecho_del on trecho;

-- Todo mundo que enxerga o SATE le: a escola precisa da distancia para
-- ver o tempo de viagem do proprio pedido.
create policy trecho_sel on trecho for select using (pode_ver('sate'));

-- So quem tem escrita GRAVA. O trecho e compartilhado pela rede inteira:
-- uma distancia errada gravada pelo console mudaria o tempo de viagem de
-- todo mundo. A escola que calcula um trecho novo usa o resultado no
-- proprio pedido sem gravar aqui (spec D3).
create policy trecho_ins on trecho for insert with check (pode_escrever('sate'));
create policy trecho_upd on trecho for update using (pode_escrever('sate')) with check (pode_escrever('sate'));
create policy trecho_del on trecho for delete using (pode_escrever('sate'));

grant select, insert, update, delete on trecho to authenticated;

-- ── 3. Auditoria ─────────────────────────────────────────────
select religar_auditoria();

select registrar_migration('039',
  'SATE: trajeto na solicitacao (km, minutos, status) e cache de trechos do OpenStreetMap');

-- Conferencia:
--   select trajeto_km, trajeto_min, trajeto_status from solicitacao_transporte
--    order by criado_em desc limit 5;
--   select count(*) from trecho;
