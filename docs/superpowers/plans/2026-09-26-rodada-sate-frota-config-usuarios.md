# Rodada 0.37.0 - SATE (identidade, frota, disponibilidade), Configurações, Usuários - Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as quatro specs de 26/09/2026 e publicar em `dev`.

**Architecture:** SPA estática sem build + Supabase. Regras de domínio em
`*.model.js` (puras quando possível, testadas com `node --test`), telas em
`*.view.js`/`views/*.js`, barreira no banco (RLS e funções). O SATE passa a
contar veículos por **intervalo de horário** (D5 da spec B): a conta é feita
em JS para mostrar e em SQL para barrar.

**Tech Stack:** JavaScript ES modules no navegador, CSS puro, PostgreSQL
(Supabase), `node --test` para funções puras, `python` para o verificador.

**Specs:**
- A `docs/superpowers/specs/2026-09-26-sate-identidade-propria-design.md`
- B `docs/superpowers/specs/2026-09-26-sate-frota-e-disponibilidade-design.md`
- C `docs/superpowers/specs/2026-09-26-configuracoes-em-blocos-design.md`
- D `docs/superpowers/specs/2026-09-26-usuarios-ajustes-design.md`

## Global Constraints

- Leia `CLAUDE.md` e `.claude/rules/*.md` antes de começar. Todas as regras
  valem (R1-R18). As que mais pegam nesta rodada:
- **Sem npm, sem bundler, sem dependência nova.**
- **PT-BR** em código, comentário, commit e interface. Comentários explicam o
  **porquê**, no tom dos arquivos vizinhos.
- **Nenhum dado real** (nome, e-mail, telefone de pessoa ou escola). Exemplos:
  "Escola Exemplo", `nome@exemplo.com`.
- **Todo valor vindo do banco passa por `esc()`** antes de ir para template literal.
- **View nunca chama `sb()`** nem importa `core/supabase.js`. **Model nunca toca DOM.**
- **Só `*.model.js` atravessa fronteira de módulo.** `src/sate.js` e `src/main.js` são entradas e podem importar qualquer coisa.
- **Datas civis** são strings `yyyy-mm-dd`; formatação só por `shared/format.js`
  (`fmtData`, `hojeISO`, `addDias`, `fmtDataHora`). Módulo não chama `toISOString`/`toLocale*`.
- **Nenhuma cor literal** em `src/modules/**` (só `var(--token)`).
- Limites: view ≤ 400 linhas, model ≤ 250 linhas (R11).
- Modal só via `shared/ui/modal.js`; confirmação só via `shared/ui/confirmar.js`; tabela só via `shared/ui/tabela.js`.
- Migrations: idempotentes, terminam com `select religar_auditoria();` e
  `select registrar_migration('<NNN>', '<descrição>');`. Comentários de SQL **sem acento**
  (padrão das migrations vizinhas).
- Commits na branch **`dev`**, mensagem em PT-BR no formato `tipo(escopo): resumo`,
  terminando com a linha:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Antes de todo commit: `git diff --cached` procurando dado real.
- Testes: `node --test tests/` na raiz. Verificador: `python .claude/scripts/verificar_arquitetura.py`.

---

## Mapa de arquivos

| Arquivo | Task | Responsabilidade |
|---|---|---|
| `supabase/migrations/042_sate_frota_e_disponibilidade.sql` | 1 | frota por rótulo, ocupação/vagas, barreira em `criar_viagem`, frota extra da noite |
| `_private/limpar_sate.sql` | 1 | zerar frota e pedidos (gitignored) |
| `src/modules/sate/disponibilidade.model.js` (novo) | 2 | intervalo de viagem, livres, escada da tarde, leitura por RPC |
| `tests/sate-disponibilidade.test.mjs` (novo) | 2 | tabela de casos da spec B |
| `src/modules/sate/frota.model.js` | 3 | situação, filtro, editar, existeFrota, erros amigáveis |
| `tests/sate-frota.test.mjs` (novo) | 3 | situação, filtro, ehOrfa |
| `src/modules/sate/regras.model.js`, `sate.model.js` | 4 | `avaliarPedido` por intervalo; `STATUS_RESERVA` com `solicitado` |
| `tests/sate-regras.test.mjs` (novo) | 4 | erros e avisos |
| `src/modules/sate/views/frota.js`, `views/frota-form.js` (novo), `sate.css` | 5 | página Frota (cadastro) |
| `src/modules/sate/views/frota-painel.js`, `sate.config.js` | 5 | apagar painel; tirar item de config |
| `src/modules/sate/views/disponibilidade.js` (novo), `sate.view.js`, `sate.css` | 6 | página Disponibilidade |
| `src/modules/sate/views/formulario.js`, `solicitacoes.js`, `detalhe.js`, `remanejar.js`; apagar `saldo.model.js` | 7 | formulário, porta de entrada, decidir/remanejar |
| `src/sate.js`, `sate.html`, `src/shell/chrome.js`, `src/shell/portao.js` | 8 | identidade do SATE, ajuda interna |
| `docs/modulos/sate.md` | 9 | tutorial neutro e atualizado |
| `src/modules/configuracoes/configuracoes.css`, `painel.js` | 10 | configurações em cartões |
| `supabase/migrations/043_usuarios_nome_e_equipe_sme.sql`, `usuarios.view.js`, `usuarios.css`, `meus-dados.view.js` | 11 | nome em caixa alta, campo de permissão, switch, Equipe SME |
| `src/modules/ajuda/markdown.js`, `ajuda.view.js`, `docs/modulos/usuarios.md`, verificador, `documentacao.md`, `tests/markdown.test.mjs` | 12 | tabela de papéis viva |
| `src/core/config.js`, `CHANGELOG.md` | 13 | versão, changelog, verificação, push |

---

### Task 1: Migration 042 e script de limpeza

**Files:**
- Create: `supabase/migrations/042_sate_frota_e_disponibilidade.sql`
- Create: `_private/limpar_sate.sql` (a pasta é gitignored - confira com `git check-ignore _private/limpar_sate.sql`)

**Interfaces:**
- Produces (SQL, usados pelas Tasks 2 e 7):
  - `ocupacao_transporte(p_de date, p_ate date, p_excluir uuid default null) returns jsonb`
    → `{ intervalo_min:int, frota:[{dia,onibus,vans}], ocupacoes:[{dia,ini,fim,onibus,vans}] }`,
    `dia` = deslocamento em dias a partir de `p_de` (de -1 a n+1), `ini`/`fim` em minutos desde 00:00 do `dia`.
  - `vagas_transporte(p_data date, p_ini int, p_fim int, p_excluir uuid default null) returns jsonb` → `{onibus:int, vans:int}` (pode ser negativo)
  - `criar_viagem(jsonb, jsonb)` - mesma assinatura; para quem NÃO escreve no SATE: exige horários (`23502`), recalcula `qtd_onibus`/`qtd_vans` e recusa com errcode `P0001`, mensagem começando com `Sem onibus livres`.
  - `abrir_frota(...)` - mesma assinatura; encerra só a aberta do MESMO rótulo e tipo.

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- 042 - SATE: frota por rotulo e disponibilidade por horario
-- Rode no SQL Editor do Supabase (apos a 041).
-- Spec: docs/superpowers/specs/2026-09-26-sate-frota-e-disponibilidade-design.md
--
-- EM UMA FRASE: cada viagem ocupa os seus veiculos do embarque ate a
-- volta + tempo de viagem + intervalo minimo (a da noite, ate o meio-dia
-- seguinte), e um pedido so cabe se houver veiculo livre em TODO o
-- intervalo dele.
--
-- O que muda:
--   1. uma frota em aberto por ROTULO e tipo (antes: por tipo);
--   2. ocupacao_transporte(): a ocupacao anonima de um intervalo de dias;
--   3. vagas_transporte(): quantos veiculos cabem num intervalo - a mesma
--      conta que o front faz em disponibilidade.model.js;
--   4. criar_viagem(): para a ESCOLA, a barreira passa a existir no banco
--      (R15), com trava por data contra dois pedidos simultaneos;
--   5. decidir_com_frota(): a frota extra de um pedido da noite cobre o
--      dia seguinte, que a viagem tambem ocupa.
--
-- `solicitado` passa a OCUPAR vaga (spec D6): o pedido da escola reserva
-- no instante em que nasce.
--
-- Idempotente: drop/create if exists e create or replace.
-- ============================================================

-- ── 1. Uma frota em aberto por rotulo e tipo ─────────────────
-- Frotas de origens diferentes (contratos, parcerias) coexistem abertas
-- e somam. "A partir de marco a Regular tem 12" continua sendo um gesto
-- so: abrir outra Regular encerra a Regular anterior.
drop index if exists idx_frota_uma_aberta;
create unique index if not exists idx_frota_aberta_por_rotulo
  on frota (rotulo_id, tipo) where fim is null;

create or replace function abrir_frota(
  p_rotulo_id  uuid,
  p_quantidade int,
  p_inicio     date,
  p_tipo       text default 'onibus',
  p_observacao text default null
) returns frota
  language plpgsql volatile set search_path = public as $$
declare v_nova frota;
begin
  update frota
     set fim = p_inicio - 1
   where rotulo_id = p_rotulo_id and tipo = p_tipo and fim is null and inicio < p_inicio;

  -- Uma aberta do mesmo rotulo que comece no MESMO dia ou depois nao pode
  -- ser "encerrada na vespera" (daria fim < inicio): e substituida.
  delete from frota
   where rotulo_id = p_rotulo_id and tipo = p_tipo and fim is null and inicio >= p_inicio;

  insert into frota (rotulo_id, tipo, quantidade, inicio, fim, observacao, criado_por)
  values (p_rotulo_id, p_tipo, p_quantidade, p_inicio, null, p_observacao, auth_email())
  returning * into v_nova;

  return v_nova;
end $$;
grant execute on function abrir_frota(uuid, int, date, text, text) to authenticated;

-- ── 2. Auxiliares puras ──────────────────────────────────────
-- "07:30" -> 450. Nulo para o que nao e hora.
create or replace function _sate_min(p text) returns int
  language sql immutable set search_path = public as $$
    select case when p ~ '^\d{1,2}:\d{2}'
                then split_part(p, ':', 1)::int * 60 + substr(split_part(p, ':', 2), 1, 2)::int
           end
  $$;

-- Numero de configuracao do SATE (config_modulo), com padrao. Valor que
-- nao e numero cai no padrao, como em sate.config.js.
create or replace function _sate_conf_int(p_chave text, p_padrao int) returns int
  language sql stable security definer set search_path = public as $$
    select coalesce(
      (select case when jsonb_typeof(valor) = 'number'
                   then greatest(0, round((valor::text)::numeric)::int) end
         from config_modulo where modulo = 'sate' and chave = p_chave),
      p_padrao)
  $$;

-- O intervalo que uma viagem ocupa, em minutos desde 00:00 do dia dela.
-- ESPELHO de intervaloDaViagem() em disponibilidade.model.js - mudou
-- aqui, mude la (e o teste tests/sate-disponibilidade.test.mjs).
--   manha/tarde: embarque ate retorno + trajeto + intervalo
--   noite:       idem, mas nunca antes das 12:00 do dia seguinte (2160)
--   sem horario: a janela do periodo (manha 0-720, tarde 720-1080,
--                noite 1080-2160)
create or replace function _sate_intervalo(
  p_periodo text, p_emb int, p_ret int, p_trajeto int, p_intervalo int,
  out ini int, out fim int)
  language plpgsql immutable set search_path = public as $$
declare
  j_ini int := case p_periodo when 'manha' then 0   when 'tarde' then 720  else 1080 end;
  j_fim int := case p_periodo when 'manha' then 720 when 'tarde' then 1080 else 2160 end;
  r int := p_ret;
begin
  ini := coalesce(p_emb, j_ini);
  if r is null then
    fim := j_fim;
  else
    if p_periodo = 'noite' and r < ini then r := r + 1440; end if;
    if r <= ini then fim := j_fim;
    else fim := r + coalesce(p_trajeto, 0) + coalesce(p_intervalo, 0);
    end if;
  end if;
  if p_periodo = 'noite' then fim := greatest(fim, 2160); end if;
  if fim <= ini then fim := ini + 1; end if;
end $$;

-- Quantos veiculos cabem em [p_ini, p_fim), dadas a frota por dia e as
-- ocupacoes (mesmo formato de ocupacao_transporte). PURA: e o que torna a
-- conta conferivel com os casos da spec (ver o fim deste arquivo).
--
-- livres = min sobre t de (frota do dia de t - ocupados em t). Basta
-- avaliar t no inicio do pedido, em cada inicio de ocupacao dentro dele e
-- em cada virada de dia - os unicos pontos em que o valor pode cair.
-- ESPELHO de livresPara() em disponibilidade.model.js.
create or replace function _sate_livres(p_frota jsonb, p_ocup jsonb, p_ini int, p_fim int)
  returns jsonb language plpgsql immutable set search_path = public as $$
declare
  t int;
  v_tot_o int; v_tot_v int; v_oc_o int; v_oc_v int;
  v_min_o int; v_min_v int;
begin
  for t in
    select p_ini
    union
    select (e->>'dia')::int * 1440 + (e->>'ini')::int
      from jsonb_array_elements(coalesce(p_ocup, '[]'::jsonb)) e
     where (e->>'dia')::int * 1440 + (e->>'ini')::int > p_ini
       and (e->>'dia')::int * 1440 + (e->>'ini')::int < p_fim
    union
    select g * 1440
      from generate_series(floor(p_ini / 1440.0)::int + 1, floor((p_fim - 1) / 1440.0)::int) g
  loop
    select coalesce(sum((f->>'onibus')::int), 0), coalesce(sum((f->>'vans')::int), 0)
      into v_tot_o, v_tot_v
      from jsonb_array_elements(coalesce(p_frota, '[]'::jsonb)) f
     where (f->>'dia')::int = floor(t / 1440.0)::int;
    select coalesce(sum((e->>'onibus')::int), 0), coalesce(sum((e->>'vans')::int), 0)
      into v_oc_o, v_oc_v
      from jsonb_array_elements(coalesce(p_ocup, '[]'::jsonb)) e
     where (e->>'dia')::int * 1440 + (e->>'ini')::int <= t
       and t < (e->>'dia')::int * 1440 + (e->>'fim')::int;
    v_min_o := least(coalesce(v_min_o, v_tot_o - v_oc_o), v_tot_o - v_oc_o);
    v_min_v := least(coalesce(v_min_v, v_tot_v - v_oc_v), v_tot_v - v_oc_v);
  end loop;
  return jsonb_build_object('onibus', coalesce(v_min_o, 0), 'vans', coalesce(v_min_v, 0));
end $$;

grant execute on function _sate_min(text) to authenticated;
grant execute on function _sate_conf_int(text, int) to authenticated;
grant execute on function _sate_intervalo(text, int, int, int, int) to authenticated;
grant execute on function _sate_livres(jsonb, jsonb, int, int) to authenticated;

-- ── 3. Ocupacao anonima ──────────────────────────────────────
-- `security definer` pelo mesmo motivo do saldo_transporte (036): a escola
-- so le os pedidos em que esta envolvida, e somar pelo cliente daria a
-- ela o proprio uso e mais nada. Devolve SO quando e quanto - nem id, nem
-- escola, nem destino.
--
-- Cobre de p_de - 1 (a noite anterior ocupa a manha de p_de) a p_ate + 1
-- (um pedido da noite de p_ate ocupa a manha seguinte).
create or replace function ocupacao_transporte(p_de date, p_ate date, p_excluir uuid default null)
  returns jsonb language sql stable security definer set search_path = public as $$
    with permitido as (select pode_ver('sate') as ok),
    cfg as (select _sate_conf_int('intervalo_min_periodos', 120) as intervalo),
    dias as (
      select d::date as data, (d::date - p_de) as dia
        from generate_series(p_de - 1, p_ate + 1, interval '1 day') d
    ),
    frota_dia as (
      select dd.dia,
             coalesce(sum(f.quantidade) filter (where f.tipo = 'onibus'), 0)::int       as onibus,
             coalesce(sum(f.quantidade) filter (where f.tipo = 'van_adaptada'), 0)::int as vans
        from dias dd
        left join frota f on f.inicio <= dd.data and (f.fim is null or f.fim >= dd.data)
       group by dd.dia
    ),
    viagens as (
      select (s.data - p_de) as dia, s.periodo, s.trajeto_min,
             _sate_min(s.horario_retorno) as ret,
             -- O embarque e o MAIS CEDO entre o cabecalho e as paradas
             -- ativas: o onibus sai para a primeira parada.
             least(_sate_min(s.horario_embarque),
                   (select min(_sate_min(p.horario)) from solicitacao_participacao p
                     where p.solicitacao_id = s.id and p.status = 'ativa')) as emb,
             coalesce(s.qtd_onibus, 0) as onibus, coalesce(s.qtd_vans, 0) as vans
        from solicitacao_transporte s
       where s.data between p_de - 1 and p_ate + 1
         and s.status in ('solicitado', 'em_analise', 'aguardando_transporte_adaptado', 'confirmado')
         and (p_excluir is null or s.id <> p_excluir)
    )
    select case when (select ok from permitido) then jsonb_build_object(
      'intervalo_min', (select intervalo from cfg),
      'frota', coalesce((select jsonb_agg(jsonb_build_object(
                 'dia', dia, 'onibus', onibus, 'vans', vans) order by dia) from frota_dia), '[]'::jsonb),
      'ocupacoes', coalesce((select jsonb_agg(jsonb_build_object(
                 'dia', v.dia, 'ini', i.ini, 'fim', i.fim, 'onibus', v.onibus, 'vans', v.vans))
                 from viagens v
                 cross join lateral _sate_intervalo(v.periodo, v.emb, v.ret, v.trajeto_min,
                                                    (select intervalo from cfg)) i
                where v.onibus + v.vans > 0), '[]'::jsonb)
    ) else null end
  $$;
grant execute on function ocupacao_transporte(date, date, uuid) to authenticated;

-- ── 4. Vagas num intervalo ───────────────────────────────────
create or replace function vagas_transporte(p_data date, p_ini int, p_fim int, p_excluir uuid default null)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o jsonb;
begin
  o := ocupacao_transporte(p_data, p_data, p_excluir);
  if o is null then return jsonb_build_object('onibus', 0, 'vans', 0); end if;
  return _sate_livres(o->'frota', o->'ocupacoes', p_ini, p_fim);
end $$;
grant execute on function vagas_transporte(date, int, int, uuid) to authenticated;

-- ── 5. Criar viagem: a barreira da escola no banco ───────────
-- Para quem ESCREVE no SATE nada muda: passar do limite e aviso, e a
-- frota extra nasce na confirmacao (040). Para a escola:
--   - horarios obrigatorios (sem eles nao ha intervalo a conferir);
--   - veiculos RECALCULADOS aqui - o numero da tela nao vale;
--   - trava por data: dois pedidos do mesmo dia entram em fila, e o
--     segundo ja enxerga o primeiro (que, desde esta migration, reserva);
--   - falta de onibus recusa; falta de van nao (a Gerencia providencia).
--
-- Sem `security definer`: as insercoes continuam passando pelas policies.
create or replace function criar_viagem(p_viagem jsonb, p_participacao jsonb)
  returns solicitacao_transporte
  language plpgsql volatile set search_path = public as $$
declare
  v solicitacao_transporte;
  v_data date; v_per text; v_emb int; v_ret int;
  v_usa boolean := true; v_onibus int; v_vans int;
  v_ini int; v_fim int; v_vagas jsonb;
begin
  if not pode_escrever('sate') then
    v_data := (p_viagem->>'data')::date;
    v_per  := p_viagem->>'periodo';
    v_emb  := _sate_min(p_viagem->>'horario_embarque');
    v_ret  := _sate_min(p_viagem->>'horario_retorno');
    if v_emb is null or v_ret is null then
      raise exception 'Informe o horario de embarque e o de retorno.' using errcode = '23502';
    end if;

    perform pg_advisory_xact_lock(hashtext('sate-vagas'), (v_data - date '2000-01-01'));

    if (p_viagem->>'atividade_id') is not null then
      select coalesce(a.usa_onibus, true) into v_usa
        from atividade_extraclasse a where a.id = (p_viagem->>'atividade_id')::uuid;
    end if;
    v_onibus := case when coalesce(v_usa, true)
      then ceil(coalesce((p_participacao->>'qtd_alunos')::int, 0)::numeric
                / greatest(1, _sate_conf_int('capacidade_onibus', 44)))::int
      else 0 end;
    v_vans := ceil(coalesce((p_participacao->>'qtd_cadeirante')::int, 0)::numeric
                   / greatest(1, _sate_conf_int('capacidade_van', 2)))::int;
    p_viagem := p_viagem || jsonb_build_object('qtd_onibus', v_onibus, 'qtd_vans', v_vans);

    select i.ini, i.fim into v_ini, v_fim
      from _sate_intervalo(v_per, v_emb, v_ret, (p_viagem->>'trajeto_min')::int,
                           _sate_conf_int('intervalo_min_periodos', 120)) i;
    v_vagas := vagas_transporte(v_data, v_ini, v_fim, null);
    if v_onibus > coalesce((v_vagas->>'onibus')::int, 0) then
      raise exception 'Sem onibus livres para este horario.' using errcode = 'P0001';
    end if;
  end if;

  insert into solicitacao_transporte
  select * from jsonb_populate_record(null::solicitacao_transporte,
    p_viagem || jsonb_build_object(
      'id', gen_random_uuid(),
      'status', 'solicitado',
      'criado_por', auth_email(),
      'criado_em', now(),
      'atualizado_em', now()))
  returning * into v;

  insert into solicitacao_participacao
  select * from jsonb_populate_record(null::solicitacao_participacao,
    p_participacao || jsonb_build_object(
      'id', gen_random_uuid(),
      'solicitacao_id', v.id,
      'ordem', 1,
      'status', 'ativa',
      'criado_em', now()));

  select * into v from solicitacao_transporte where id = v.id;
  return v;
end $$;
grant execute on function criar_viagem(jsonb, jsonb) to authenticated;

-- ── 6. Frota extra da noite cobre o dia seguinte ─────────────
create or replace function decidir_com_frota(
  p_solicitacao uuid, p_status text, p_rotulo uuid, p_onibus int, p_vans int
) returns solicitacao_transporte
  language plpgsql volatile set search_path = public as $$
declare
  v solicitacao_transporte;
  v_fim date;
begin
  if p_status is not null
     and p_status not in ('confirmado', 'aguardando_transporte_adaptado') then
    raise exception 'Status invalido para decidir com frota: %', p_status using errcode = '22023';
  end if;
  if coalesce(p_onibus, 0) < 0 or coalesce(p_vans, 0) < 0 then
    raise exception 'Quantidade de veiculos negativa' using errcode = '22023';
  end if;
  if coalesce(p_onibus, 0) + coalesce(p_vans, 0) > 0 and p_rotulo is null then
    raise exception 'A frota extra precisa de um rotulo' using errcode = '23502';
  end if;

  select * into v from solicitacao_transporte where id = p_solicitacao;
  if not found then
    raise exception 'Solicitacao nao encontrada' using errcode = 'P0002';
  end if;

  -- A viagem da noite ocupa a manha seguinte (spec B, D5): um lote so da
  -- data deixaria faltando la.
  v_fim := case when v.periodo = 'noite' then v.data + 1 else v.data end;

  if coalesce(p_onibus, 0) > 0 then
    insert into frota (rotulo_id, tipo, quantidade, inicio, fim, observacao, solicitacao_id, criado_por)
    values (p_rotulo, 'onibus', p_onibus, v.data, v_fim, 'Frota extra do dia', v.id, auth_email());
  end if;
  if coalesce(p_vans, 0) > 0 then
    insert into frota (rotulo_id, tipo, quantidade, inicio, fim, observacao, solicitacao_id, criado_por)
    values (p_rotulo, 'van_adaptada', p_vans, v.data, v_fim, 'Frota extra do dia', v.id, auth_email());
  end if;

  if p_status is not null then
    update solicitacao_transporte
       set status = p_status, decidido_por = auth_email(), decidido_em = now(), atualizado_em = now()
     where id = v.id
    returning * into v;
  end if;

  return v;
end $$;
grant execute on function decidir_com_frota(uuid, text, uuid, int, int) to authenticated;

-- ── 7. Conferencia (rodar a parte, depois da migration) ──────
-- Os casos da spec B. Cada linha deve devolver `ok = true`.
--
-- select caso, (_sate_livres(f::jsonb, o::jsonb, ini, fim)->>'onibus')::int = esperado as ok
--   from (values
--     ('vazio',            '[{"dia":0,"onibus":9,"vans":0}]', '[]', 780, 1020, 9),
--     ('manha volta tarde','[{"dia":0,"onibus":9,"vans":0}]', '[{"dia":0,"ini":420,"fim":850,"onibus":6,"vans":0}]', 780, 1020, 3),
--     ('manha ja voltou',  '[{"dia":0,"onibus":9,"vans":0}]', '[{"dia":0,"ini":420,"fim":850,"onibus":6,"vans":0}]', 850, 1020, 9),
--     ('degrau',           '[{"dia":0,"onibus":9,"vans":0}]', '[{"dia":0,"ini":420,"fim":850,"onibus":6,"vans":0},{"dia":0,"ini":900,"fim":1140,"onibus":2,"vans":0}]', 870, 1080, 7),
--     ('noite ocupa manha','[{"dia":0,"onibus":9,"vans":0},{"dia":1,"onibus":9,"vans":0}]', '[{"dia":0,"ini":1140,"fim":2160,"onibus":3,"vans":0}]', 1920, 2100, 6),
--     ('frota muda',       '[{"dia":0,"onibus":9,"vans":0},{"dia":1,"onibus":4,"vans":0}]', '[]', 1140, 2160, 4)
--   ) as c(caso, f, o, ini, fim, esperado);
--
-- select * from _sate_intervalo('tarde', 780, 1020, 30, 120);   -- 780 | 1170
-- select * from _sate_intervalo('noite', 1140, 1320, 30, 120);  -- 1140 | 2160
-- select * from _sate_intervalo('manha', null, null, null, 120); -- 0 | 720

select religar_auditoria();

select registrar_migration('042',
  'SATE: frota aberta por rotulo, ocupacao por horario (ocupacao_transporte, vagas_transporte) e barreira da escola em criar_viagem');
```

- [ ] **Step 2: Escrever o script de limpeza** em `_private/limpar_sate.sql`:

```sql
-- Zera frota e pedidos do SATE para comecar do zero. Mantem rotulos,
-- catalogo e locais. Rodar no SQL Editor DEPOIS da 042. Tudo fica no
-- audit_log (DELETE em tabela auditada) - recuperavel se preciso.
begin;
select 'antes' as quando,
  (select count(*) from frota) as frotas,
  (select count(*) from solicitacao_transporte) as pedidos,
  (select count(*) from solicitacao_participacao) as participacoes;

delete from frota;                      -- antes dos pedidos: a FK e `set null`, mas nao ha por que atualizar linha que vai sumir
delete from solicitacao_participacao;
delete from solicitacao_transporte;     -- trecho e participacao caem por cascade onde houver

select 'depois' as quando,
  (select count(*) from frota) as frotas,
  (select count(*) from solicitacao_transporte) as pedidos,
  (select count(*) from solicitacao_participacao) as participacoes;
commit;
```

Antes de gravar, confira no `039_sate_rota.sql` se `trecho` referencia `solicitacao_transporte`
com `on delete cascade`. Se NÃO tiver cascade, acrescente `delete from trecho where solicitacao_id is not null;`
antes do delete de pedidos (só se a coluna existir - leia a 039).

- [ ] **Step 3: Revisar a migration à mão** contra estes pontos (não há Postgres local):
  - todo `create` é `if not exists` ou `create or replace`; o índice antigo cai com `drop index if exists`;
  - `_sate_intervalo` e `_sate_livres` batem, linha a linha, com os comentários "ESPELHO" (as funções JS vêm na Task 2 - quem for implementar a Task 2 lê este arquivo);
  - nenhum acento nos comentários/mensagens SQL.

- [ ] **Step 4: Commit** (o `_private/` não entra)

```bash
git add supabase/migrations/042_sate_frota_e_disponibilidade.sql
git commit -m "feat(sate): migration 042 - frota por rotulo e ocupacao por horario"
```

---

### Task 2: `disponibilidade.model.js` - a conta por horário

**Files:**
- Create: `src/modules/sate/disponibilidade.model.js`
- Test: `tests/sate-disponibilidade.test.mjs`

**Interfaces:**
- Consumes: `paraMin(hhmm) → int|null`, `paraHora(min) → 'HH:MM'` de `regras.model.js` (já existem); RPCs da Task 1.
- Produces (usados pelas Tasks 6 e 7):
  - `DIA = 1440`, `JANELA`, `TIPICO` (objetos `{manha:[ini,fim], tarde:[…], noite:[…]}`)
  - `intervaloDaViagem({ periodo, embarque, retorno, trajetoMin, intervaloMin }) → { ini, fim }` - `embarque`/`retorno` aceitam `'HH:MM'` ou minutos
  - `montarLinha(resp) → Linha` onde `Linha = { frota: Map<dia,{onibus,vans}>, ocup: [{ini,fim,onibus,vans}] (minutos absolutos desde 00:00 do dia 0), intervaloMin:number, aproximado:boolean }`
  - `livresPara(linha, ini, fim, tipo='onibus'|'vans') → number` (pode ser negativo)
  - `totalDoDia(linha, dia, tipo) → number`
  - `livresNoPeriodo(linha, dia, periodo, tipo) → number`
  - `escadaDaTarde(linha, dia, tipo) → [{ aPartirDe:min, livres }]`
  - `proximoHorario(linha, { ini, fim, precisa, periodo, tipo }) → min|null`
  - `faltaParaConfirmar(s, linha) → { onibus, vans }` (`s` = linha de `solicitacao_transporte`)
  - `async lerOcupacao(de, ate = de, { excluir = null } = {}) → Linha`

- [ ] **Step 1: Escrever o teste que falha** `tests/sate-disponibilidade.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  intervaloDaViagem, montarLinha, livresPara, escadaDaTarde, proximoHorario,
  faltaParaConfirmar, livresNoPeriodo, totalDoDia,
} from '../src/modules/sate/disponibilidade.model.js';

const frota = (...porDia) => porDia.map((onibus, dia) => ({ dia, onibus, vans: 0 }));
const oc = (ini, fim, onibus, dia = 0) => ({ dia, ini, fim, onibus, vans: 0 });
const linha = (f, o = [], intervalo_min = 120) => montarLinha({ intervalo_min, frota: f, ocupacoes: o });

// ── A tabela de casos da spec B (a mesma da conferência da 042) ──
test('vazio: toda a frota está livre', () => {
  assert.equal(livresPara(linha(frota(9)), 780, 1020), 9);
});
test('ônibus da manhã que volta tarde bloqueia o embarque cedo', () => {
  assert.equal(livresPara(linha(frota(9), [oc(420, 850, 6)]), 780, 1020), 3);
});
test('intervalo semiaberto: liberado às 14h10 serve o embarque das 14h10', () => {
  assert.equal(livresPara(linha(frota(9), [oc(420, 850, 6)]), 850, 1020), 9);
});
test('degrau: vale o pior momento dentro do pedido', () => {
  assert.equal(livresPara(linha(frota(9), [oc(420, 850, 6), oc(900, 1140, 2)]), 870, 1080), 7);
});
test('a noite ocupa a manhã seguinte', () => {
  assert.equal(livresPara(linha(frota(9, 9), [oc(1140, 2160, 3)]), 1440 + 480, 1440 + 660), 6);
});
test('frota que muda à meia-noite: vale a menor', () => {
  assert.equal(livresPara(linha(frota(9, 4)), 1140, 2160), 4);
});
test('faltaParaConfirmar não conta o próprio pedido (vem excluído do banco)', () => {
  const s = { periodo: 'manha', horario_embarque: '08:00', horario_retorno: '12:00', trajeto_min: 0, qtd_onibus: 9, qtd_vans: 0 };
  assert.deepEqual(faltaParaConfirmar(s, linha(frota(9))), { onibus: 0, vans: 0 });
});
test('faltaParaConfirmar mede o que falta no intervalo do pedido', () => {
  const s = { periodo: 'tarde', horario_embarque: '13:00', horario_retorno: '17:00', trajeto_min: 0, qtd_onibus: 5, qtd_vans: 0 };
  assert.deepEqual(faltaParaConfirmar(s, linha(frota(9), [oc(420, 850, 6)])), { onibus: 2, vans: 0 });
});

// ── intervaloDaViagem (espelho de _sate_intervalo) ──
test('tarde: embarque até retorno + trajeto + intervalo', () => {
  assert.deepEqual(intervaloDaViagem({ periodo: 'tarde', embarque: '13:00', retorno: '17:00', trajetoMin: 30, intervaloMin: 120 }),
    { ini: 780, fim: 1170 });
});
test('noite: nunca libera antes do meio-dia seguinte', () => {
  assert.deepEqual(intervaloDaViagem({ periodo: 'noite', embarque: '19:00', retorno: '22:00', trajetoMin: 30, intervaloMin: 120 }),
    { ini: 1140, fim: 2160 });
});
test('noite com retorno depois da meia-noite', () => {
  assert.deepEqual(intervaloDaViagem({ periodo: 'noite', embarque: '19:00', retorno: '00:30', trajetoMin: 0, intervaloMin: 0 }),
    { ini: 1140, fim: 2160 });
});
test('sem horário: a janela do período', () => {
  assert.deepEqual(intervaloDaViagem({ periodo: 'manha', embarque: null, retorno: null, intervaloMin: 120 }), { ini: 0, fim: 720 });
});
test('retorno antes do embarque (manhã): a janela até o fim do período', () => {
  assert.deepEqual(intervaloDaViagem({ periodo: 'manha', embarque: '10:00', retorno: '09:00', intervaloMin: 120 }), { ini: 600, fim: 720 });
});

// ── Página Disponibilidade ──
test('escada da tarde: só os degraus em que o número sobe', () => {
  const l = linha(frota(9), [oc(420, 850, 6), oc(420, 930, 3)]);
  assert.deepEqual(escadaDaTarde(l, 0), [
    { aPartirDe: 720, livres: 0 }, { aPartirDe: 850, livres: 6 }, { aPartirDe: 930, livres: 9 },
  ]);
});
test('escada de um dia qualquer da semana usa o deslocamento do dia', () => {
  const l = linha(frota(9, 9, 9), [oc(420, 850, 6, 2)]);
  assert.deepEqual(escadaDaTarde(l, 2), [{ aPartirDe: 720, livres: 3 }, { aPartirDe: 850, livres: 9 }]);
});
test('livresNoPeriodo usa a janela típica', () => {
  const l = linha(frota(9), [oc(420, 850, 6)]);
  assert.equal(livresNoPeriodo(l, 0, 'manha'), 3);
  assert.equal(totalDoDia(l, 0), 9);
});
test('proximoHorario acha o primeiro embarque em que cabe', () => {
  const l = linha(frota(9), [oc(420, 850, 6)]);
  assert.equal(proximoHorario(l, { ini: 780, fim: 1020, precisa: 5, periodo: 'tarde' }), 850);
  assert.equal(proximoHorario(l, { ini: 780, fim: 1020, precisa: 10, periodo: 'tarde' }), null);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/sate-disponibilidade.test.mjs`
Expected: FAIL (`Cannot find module …disponibilidade.model.js`)

- [ ] **Step 3: Implementar** `src/modules/sate/disponibilidade.model.js`:

```js
// ============================================================
// FundHub - modules/sate/disponibilidade.model.js
// Quantos veículos estão livres para um pedido - por HORÁRIO.
// Spec: 2026-09-26-sate-frota-e-disponibilidade-design.md § D5-D7.
//
// A regra em uma frase: cada viagem ocupa os seus veículos do embarque
// até a volta + tempo de viagem + intervalo mínimo (a da noite, até o
// meio-dia seguinte), e um pedido só cabe se houver veículo livre em
// TODO o intervalo dele. As duas regras antigas - o intervalo manhã →
// tarde e a folga da noite - são consequências desta, e deixaram de
// existir como código à parte.
//
// A conta é PURA e mora aqui para o formulário, a página Disponibilidade
// e as decisões de quem aprova. O banco refaz a mesma conta para barrar a
// escola (`_sate_livres`/`_sate_intervalo`, migration 042) - são ESPELHOS:
// mudou aqui, mude lá, e o teste tests/sate-disponibilidade.test.mjs tem
// os mesmos casos da conferência da migration.
//
// Substitui `saldo.model.js` (saldo por período), apagado na mesma
// entrega - um caminho só.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { addDias } from '../../shared/format.js';
import { paraMin } from './regras.model.js';

export const DIA = 1440;
// Janelas dos períodos, em minutos desde 00:00. A noite vai até o
// meio-dia seguinte: é quando o veículo volta a estar livre (D5).
export const JANELA = Object.freeze({ manha: [0, 720], tarde: [720, 1080], noite: [1080, 2160] });
// Viagem TÍPICA de cada período - o que a página Disponibilidade supõe
// quando ainda não há horário. O formulário confere o horário exato.
export const TIPICO = Object.freeze({ manha: [420, 720], tarde: [720, 1080], noite: [1140, 2160] });

const CAMPO = { onibus: 'onibus', vans: 'vans', van_adaptada: 'vans' };
const minDe = (x) => (typeof x === 'number' ? x : paraMin(x));

// ESPELHO de _sate_intervalo (042).
export function intervaloDaViagem({ periodo, embarque, retorno, trajetoMin = 0, intervaloMin = 0 }) {
  const [jIni, jFim] = JANELA[periodo] || JANELA.manha;
  const e = minDe(embarque);
  let r = minDe(retorno);
  const ini = e ?? jIni;
  let fim;
  if (r == null) {
    fim = jFim;
  } else {
    if (periodo === 'noite' && r < ini) r += DIA;
    fim = r <= ini ? jFim : r + (Number(trajetoMin) || 0) + (Number(intervaloMin) || 0);
  }
  if (periodo === 'noite') fim = Math.max(fim, JANELA.noite[1]);
  if (fim <= ini) fim = ini + 1;
  return { ini, fim };
}

// A resposta de ocupacao_transporte() num eixo só: minutos desde 00:00
// do primeiro dia pedido (o dia 0). O dia -1 é a véspera.
export function montarLinha(resp) {
  const frota = new Map();
  for (const f of resp?.frota || []) {
    frota.set(Number(f.dia), { onibus: Number(f.onibus) || 0, vans: Number(f.vans) || 0 });
  }
  const ocup = (resp?.ocupacoes || []).map(o => ({
    ini: Number(o.dia) * DIA + Number(o.ini),
    fim: Number(o.dia) * DIA + Number(o.fim),
    onibus: Number(o.onibus) || 0,
    vans: Number(o.vans) || 0,
  }));
  return { frota, ocup, intervaloMin: Number(resp?.intervalo_min ?? 120), aproximado: !!resp?.aproximado };
}

export const totalDoDia = (linha, dia, tipo = 'onibus') => linha.frota.get(dia)?.[CAMPO[tipo] || 'onibus'] || 0;

// livres = min sobre t em [ini, fim) de (frota do dia de t - ocupados em t).
// Só se avalia t onde o valor pode CAIR: o início do pedido, cada início
// de ocupação dentro dele e cada virada de dia. Intervalos semiabertos:
// liberado às 14h10 serve o embarque das 14h10. ESPELHO de _sate_livres.
export function livresPara(linha, ini, fim, tipo = 'onibus') {
  const k = CAMPO[tipo] || 'onibus';
  const pontos = new Set([ini]);
  for (const o of linha.ocup) if (o.ini > ini && o.ini < fim) pontos.add(o.ini);
  for (let d = Math.floor(ini / DIA) + 1; d * DIA < fim; d++) pontos.add(d * DIA);
  let min = Infinity;
  for (const t of pontos) {
    const total = linha.frota.get(Math.floor(t / DIA))?.[k] || 0;
    let usado = 0;
    for (const o of linha.ocup) if (o.ini <= t && t < o.fim) usado += o[k];
    min = Math.min(min, total - usado);
  }
  return min;
}

export function livresNoPeriodo(linha, dia, periodo, tipo = 'onibus') {
  const [a, b] = TIPICO[periodo];
  return livresPara(linha, dia * DIA + a, dia * DIA + b, tipo);
}

// A tarde "enche" conforme os ônibus da manhã são liberados: livres para
// uma viagem que embarca em e e vai até o fim da tarde nunca DIMINUI com
// e. Os degraus são os fins de ocupação dentro da tarde; só entram os que
// aumentam o número - "2 livres · 5 a partir das 14h10".
export function escadaDaTarde(linha, dia, tipo = 'onibus') {
  const base = dia * DIA;
  const [a, b] = TIPICO.tarde;
  const inicios = new Set([base + a]);
  for (const o of linha.ocup) if (o.fim > base + a && o.fim < base + b) inicios.add(o.fim);
  const degraus = [];
  for (const e of [...inicios].sort((x, y) => x - y)) {
    const n = livresPara(linha, e, base + b, tipo);
    if (!degraus.length || n > degraus[degraus.length - 1].livres) degraus.push({ aPartirDe: e - base, livres: n });
  }
  return degraus;
}

// O primeiro embarque, depois de `ini` e ainda no período, em que um
// pedido de MESMA duração cabe. Candidatos: os fins de ocupação - só ali o
// número pode subir. A noite não sugere: ela ocupa até o dia seguinte.
export function proximoHorario(linha, { ini, fim, precisa, periodo, tipo = 'onibus' }) {
  if (periodo === 'noite') return null;
  const limite = JANELA[periodo]?.[1] ?? fim;
  const dur = fim - ini;
  const cand = [...new Set(linha.ocup.map(o => o.fim))].filter(t => t > ini && t < limite).sort((x, y) => x - y);
  for (const e of cand) if (livresPara(linha, e, e + dur, tipo) >= precisa) return e;
  return null;
}

// Quantos veículos FALTAM para o pedido `s` caber. `linha` precisa vir de
// lerOcupacao(s.data, s.data, { excluir: s.id }): o próprio pedido já
// ocupa (D6), e contá-lo de novo criaria frota extra a mais.
export function faltaParaConfirmar(s, linha) {
  const { ini, fim } = intervaloDaViagem({
    periodo: s.periodo, embarque: s.horario_embarque, retorno: s.horario_retorno,
    trajetoMin: s.trajeto_min, intervaloMin: linha.intervaloMin,
  });
  const falta = (tipo, pedido) => (pedido ? Math.max(0, pedido - livresPara(linha, ini, fim, tipo)) : 0);
  return { onibus: falta('onibus', Number(s.qtd_onibus) || 0), vans: falta('vans', Number(s.qtd_vans) || 0) };
}

// ── Leitura ──────────────────────────────────────────────────
// Dev-local: linha vazia (frota zero). Sem a 042, cai no saldo por
// período da 036 e marca `aproximado` - a tela avisa "contagem sem
// horário". QUALQUER falha cai na aproximação, sem relançar: é o mesmo
// raciocínio que saldo.model.js usava (PGRST202 vs 42883).
export async function lerOcupacao(de, ate = de, { excluir = null } = {}) {
  if (!hasSupabase()) return montarLinha(null);
  const { data, error } = await sb().rpc('ocupacao_transporte', { p_de: de, p_ate: ate, p_excluir: excluir });
  if (!error && data) return montarLinha(data);
  if (error) console.warn('[sate] ocupacao_transporte indisponível, contagem por período:', error.message);
  return montarLinha(await aproximarPorPeriodo(de, ate));
}

async function aproximarPorPeriodo(de, ate) {
  const dias = [];
  for (let d = addDias(de, -1), i = -1; d <= addDias(ate, 1); d = addDias(d, 1), i++) dias.push([i, d]);
  const resps = await Promise.all(dias.map(([, d]) =>
    sb().rpc('saldo_transporte', { p_data: d }).then(r => r.data, () => null)));
  const frota = [], ocupacoes = [];
  dias.forEach(([dia], k) => {
    const r = resps[k];
    if (!r) return;
    frota.push({ dia, onibus: r.onibus?.manha?.total || 0, vans: r.van_adaptada?.manha?.total || 0 });
    for (const p of Object.keys(JANELA)) {
      const onibus = r.onibus?.[p]?.uso || 0;
      const vans = r.van_adaptada?.[p]?.uso || 0;
      if (onibus + vans) ocupacoes.push({ dia, ini: JANELA[p][0], fim: JANELA[p][1], onibus, vans });
    }
  });
  return { intervalo_min: 0, frota, ocupacoes, aproximado: true };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/sate-disponibilidade.test.mjs`
Expected: todos PASS. Confira também, lendo lado a lado, que `intervaloDaViagem`/`livresPara`
fazem exatamente o que `_sate_intervalo`/`_sate_livres` da Task 1 fazem.

- [ ] **Step 5: Commit**

```bash
git add src/modules/sate/disponibilidade.model.js tests/sate-disponibilidade.test.mjs
git commit -m "feat(sate): disponibilidade por horario - conta pura espelhada no banco"
```

---

### Task 3: `frota.model.js` - situação, filtro, edição

**Files:**
- Modify: `src/modules/sate/frota.model.js`
- Test: `tests/sate-frota.test.mjs`

**Interfaces:**
- Produces (Task 5 e 7 usam):
  - `SITUACOES = { vigente:'Vigente', futura:'Futura', encerrada:'Encerrada' }`
  - `situacaoDaFrota(f, hoje) → 'vigente'|'futura'|'encerrada'`
  - `filtrarFrotas(lista, { situacao='vigente'|'futura'|'encerrada'|'todas', tipo='', de='', ate='' }, hoje) → lista`
  - `async existeFrota() → boolean`
  - `async editarFrota(id, { rotuloId, tipo, quantidade, inicio, fim, observacao }) → void`
  - `criarLote`, `abrirFrota`, `excluirFrota`, `getFrotas`, `getRotulos`, `criarRotulo`, `arquivarRotulo`, `excluirRotulo`, `getFrotasOrfas`, `manterLote`, `decidirComFrota`, `TIPOS`, `rotulaTipo`, `ehOrfa` - já existem, continuam.
  - **Removidos:** `totalDoDia` (a conta do dia é da Task 2) e `getFrotaAberta` (só o painel apagado usava).

- [ ] **Step 1: Teste que falha** `tests/sate-frota.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situacaoDaFrota, filtrarFrotas, ehOrfa } from '../src/modules/sate/frota.model.js';

const H = '2026-10-10';
const f = (inicio, fim, tipo = 'onibus') => ({ inicio, fim, tipo });

test('situação relativa a hoje', () => {
  assert.equal(situacaoDaFrota(f('2026-10-11', null), H), 'futura');
  assert.equal(situacaoDaFrota(f('2026-01-01', '2026-10-09'), H), 'encerrada');
  assert.equal(situacaoDaFrota(f('2026-01-01', '2026-10-10'), H), 'vigente');
  assert.equal(situacaoDaFrota(f('2026-10-10', null), H), 'vigente');
});

test('filtro por situação, tipo e período de vigência', () => {
  const lista = [f('2026-01-01', null), f('2026-11-01', null), f('2026-01-01', '2026-02-01'), f('2026-01-01', null, 'van_adaptada')];
  assert.equal(filtrarFrotas(lista, { situacao: 'vigente' }, H).length, 2);
  assert.equal(filtrarFrotas(lista, { situacao: 'todas', tipo: 'onibus' }, H).length, 3);
  assert.equal(filtrarFrotas(lista, { situacao: 'todas', de: '2026-03-01', ate: '2026-03-31' }, H).length, 2);
  assert.equal(filtrarFrotas(lista, { situacao: 'encerrada' }, H).length, 1);
});

test('frota extra órfã: pedido negado ou fora da vigência', () => {
  assert.equal(ehOrfa({ inicio: '2026-10-10', fim: '2026-10-10', solicitacao: { status: 'negado', data: '2026-10-10' } }), true);
  assert.equal(ehOrfa({ inicio: '2026-10-10', fim: '2026-10-10', solicitacao: { status: 'confirmado', data: '2026-10-12' } }), true);
  assert.equal(ehOrfa({ inicio: '2026-10-10', fim: '2026-10-11', solicitacao: { status: 'confirmado', data: '2026-10-10' } }), false);
});
```

- [ ] **Step 2:** `node --test tests/sate-frota.test.mjs` → FAIL (`situacaoDaFrota` não exportada).

- [ ] **Step 3: Implementar.** Em `frota.model.js`:
  1. Atualizar o cabeçalho: "`fim` nulo = frota EM ABERTO, **uma por rótulo e tipo** (042)…".
  2. Apagar `getFrotaAberta` e `totalDoDia` (e o comentário "Total do dia"). Confirmar com
     `grep -rn "getFrotaAberta\|frota.model.js.*totalDoDia\|totalDoDia } from './frota" src` que só
     `frota-painel.js` (apagado na Task 5) e `saldo.model.js` (apagado na Task 7) os usam.
  3. Acrescentar, depois de `excluirFrota`:

```js
// ── Situação (pura) ──────────────────────────────────────────
// Sempre relativa a hoje, data civil (R8): comparar yyyy-mm-dd como
// string é comparar datas.
export const SITUACOES = Object.freeze({ vigente: 'Vigente', futura: 'Futura', encerrada: 'Encerrada' });

export function situacaoDaFrota(f, hoje) {
  if (f.inicio > hoje) return 'futura';
  if (f.fim && f.fim < hoje) return 'encerrada';
  return 'vigente';
}

// `de`/`ate`: frotas que valem em ALGUM dia do intervalo. Vazio = sem recorte.
export function filtrarFrotas(lista, { situacao = 'vigente', tipo = '', de = '', ate = '' } = {}, hoje) {
  return (lista || []).filter(f =>
    (situacao === 'todas' || situacaoDaFrota(f, hoje) === situacao)
    && (!tipo || f.tipo === tipo)
    && (!ate || f.inicio <= ate)
    && (!de || !f.fim || f.fim >= de));
}

// Há alguma frota cadastrada? É a porta de entrada da primeira viagem
// (spec B, D4). `head: true` - só a contagem, nenhuma linha trafega.
export async function existeFrota() {
  if (!hasSupabase()) return false;
  const { count, error } = await sb().from('frota').select('id', { count: 'exact', head: true });
  if (error) { if (ausente(error)) return false; throw error; }
  return (count || 0) > 0;
}

// Os erros que o banco devolve ao gravar frota, em português. 23505 = o
// índice de UMA aberta por rótulo e tipo; 23514 = fim antes do início.
function amigavel(error) {
  const msg = error.code === '23505'
    ? 'Já existe uma frota em aberto com este rótulo e tipo. Encerre-a ou use outro rótulo.'
    : error.code === '23514' ? 'A data de fim não pode ser antes do início.' : null;
  if (!msg) return error;
  const e = new Error(msg); e.code = error.code; e.amigavel = true; return e;
}

// Edição direta da linha. Mudar a quantidade de uma frota que já valia
// reescreve o passado - para "a partir de tal dia são 12", a tela oferece
// Nova frota com o mesmo rótulo (abrir_frota encerra a anterior).
export async function editarFrota(id, { rotuloId, tipo, quantidade, inicio, fim = null, observacao = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('frota').update({
    rotulo_id: rotuloId, tipo, quantidade, inicio, fim: fim || null, observacao,
  }).eq('id', id);
  if (error) throw amigavel(error);
  _frotas = null;
}
```

  4. Em `abrirFrota` e `criarLote`, trocar `if (error) throw error;` por `if (error) throw amigavel(error);`.

- [ ] **Step 4:** `node --test tests/sate-frota.test.mjs` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/sate/frota.model.js tests/sate-frota.test.mjs
git commit -m "feat(sate): frota com situacao, filtro e edicao"
```

---

### Task 4: `avaliarPedido` por intervalo e `solicitado` reservando

**Files:**
- Modify: `src/modules/sate/regras.model.js`, `src/modules/sate/sate.model.js:41-45`
- Test: `tests/sate-regras.test.mjs`

**Interfaces:**
- Produces (Task 7 usa):
  `avaliarPedido({ periodo, qtdAlunos, qtdCadeirantes, usaOnibus=true, livres, livresVan, totalDia, proximo=null, diasDeAntecedencia=null, horarioEmbarque, horarioRetorno, capacidadeOnibus, capacidadeVan, antecedenciaMin, aprovador=false }) → { erros:[{codigo,texto}], avisos:[…], onibus, vans }`
  Códigos: `sem_alunos`, `antecedencia`, `sem_horario`, `horarios`, `sem_frota_dia`, `sem_frota`, `sem_van`.
- `STATUS_RESERVA = ['solicitado','em_analise','aguardando_transporte_adaptado','confirmado']`.
- **Removidos:** `intervaloEntreViagens`, `noiteViavel` (a regra única está em `disponibilidade.model.js`).

- [ ] **Step 1: Teste que falha** `tests/sate-regras.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarPedido } from '../src/modules/sate/regras.model.js';

const base = {
  periodo: 'tarde', qtdAlunos: 60, qtdCadeirantes: 0, livres: 9, livresVan: 0, totalDia: 9,
  diasDeAntecedencia: 10, horarioEmbarque: '13:00', horarioRetorno: '17:00',
  capacidadeOnibus: 44, capacidadeVan: 2, antecedenciaMin: 5,
};
const codigos = (l) => l.map(x => x.codigo);

test('cabe: sem erro nem aviso, 2 ônibus', () => {
  const r = avaliarPedido(base);
  assert.deepEqual([r.erros, r.avisos, r.onibus], [[], [], 2]);
});
test('dia sem frota barra a escola E quem aprova', () => {
  assert.deepEqual(codigos(avaliarPedido({ ...base, totalDia: 0, livres: 0 }).erros), ['sem_frota_dia']);
  assert.deepEqual(codigos(avaliarPedido({ ...base, totalDia: 0, livres: 0, aprovador: true }).erros), ['sem_frota_dia']);
});
test('falta de ônibus: erro para a escola, com o próximo horário', () => {
  const r = avaliarPedido({ ...base, livres: 1, proximo: 850 });
  assert.deepEqual(codigos(r.erros), ['sem_frota']);
  assert.match(r.erros[0].texto, /14:10/);
});
test('falta de ônibus: aviso para quem aprova', () => {
  const r = avaliarPedido({ ...base, livres: 1, aprovador: true });
  assert.deepEqual([codigos(r.erros), codigos(r.avisos)], [[], ['sem_frota']]);
});
test('horários obrigatórios', () => {
  assert.ok(codigos(avaliarPedido({ ...base, horarioRetorno: null }).erros).includes('sem_horario'));
});
test('retorno antes do embarque é erro (fora da noite)', () => {
  assert.ok(codigos(avaliarPedido({ ...base, horarioRetorno: '12:00' }).erros).includes('horarios'));
  assert.ok(!codigos(avaliarPedido({ ...base, periodo: 'noite', horarioEmbarque: '19:00', horarioRetorno: '00:30' }).erros).includes('horarios'));
});
test('cadeirante sem van é sempre aviso', () => {
  const r = avaliarPedido({ ...base, qtdCadeirantes: 1, livresVan: 0 });
  assert.deepEqual([codigos(r.erros), codigos(r.avisos)], [[], ['sem_van']]);
});
test('atividade que não usa ônibus não pede frota', () => {
  const r = avaliarPedido({ ...base, usaOnibus: false, totalDia: 0, livres: 0 });
  assert.deepEqual([codigos(r.erros), r.onibus], [[], 0]);
});
test('antecedência só barra a escola', () => {
  assert.ok(codigos(avaliarPedido({ ...base, diasDeAntecedencia: 2 }).erros).includes('antecedencia'));
  assert.ok(!codigos(avaliarPedido({ ...base, diasDeAntecedencia: 2, aprovador: true }).erros).includes('antecedencia'));
});
```

- [ ] **Step 2:** `node --test tests/sate-regras.test.mjs` → FAIL.

- [ ] **Step 3: Implementar.** Em `regras.model.js`:
  1. Cabeçalho: trocar o bloco "As duas regras que o André especificou…" por:
     "A regra de ocupação por horário - que contém as duas regras antigas, o intervalo manhã → tarde e a
     folga da noite - mora em `disponibilidade.model.js` (spec 2026-09-26, D5). Aqui fica o que a tela
     faz com o resultado: o que é erro e o que é aviso, e para quem."
  2. Apagar `intervaloEntreViagens` e `noiteViavel` (e seus comentários). Manter `PERIODOS`, `paraMin`,
     `paraHora`, `onibusPara`, `vansPara`, `alocarFichas`, `pendenciasDeFicha`.
  3. Substituir `avaliarPedido` inteira por:

```js
// ── O agregador: erro barra, aviso não (R15 e spec D7) ──
//
// A MESMA situação é erro para a escola e aviso para quem aprova: a frota
// é inviolável para uma e negociável para o outro - é daí que nasce a
// frota extra do dia (040). A exceção é o dia SEM frota nenhuma: aí nem
// quem aprova segue, porque a viagem precisa de uma frota que a cubra
// (spec 2026-09-26, D4) - a tela oferece o cadastro ali mesmo.
//
// `livres`/`livresVan`: veículos livres no INTERVALO do pedido
// (disponibilidade.model.js § livresPara). `proximo`: primeiro embarque,
// em minutos, em que o pedido caberia - ou null.
export function avaliarPedido(p) {
  const {
    periodo, qtdAlunos = 0, qtdCadeirantes = 0, usaOnibus = true,
    livres = 0, livresVan = 0, totalDia = 0, proximo = null,
    diasDeAntecedencia = null, horarioEmbarque = null, horarioRetorno = null,
    capacidadeOnibus, capacidadeVan, antecedenciaMin, aprovador = false,
  } = p;

  const erros = [];
  const avisos = [];
  const barra = (codigo, texto) => (aprovador ? avisos : erros).push({ codigo, texto });

  const onibus = usaOnibus ? onibusPara(qtdAlunos, capacidadeOnibus) : 0;
  const vans = vansPara(qtdCadeirantes, capacidadeVan);

  if (!qtdAlunos || qtdAlunos < 1) erros.push({ codigo: 'sem_alunos', texto: 'Informe quantos estudantes vão.' });

  if (!aprovador && diasDeAntecedencia !== null && diasDeAntecedencia < antecedenciaMin) {
    erros.push({
      codigo: 'antecedencia',
      texto: `Pedidos precisam de ${antecedenciaMin} dia(s) de antecedência. Para algo mais próximo, fale com a Gerência de Transporte.`,
    });
  }

  // Sem os dois horários não há intervalo a conferir (spec D3).
  if (!horarioEmbarque || !horarioRetorno) {
    erros.push({ codigo: 'sem_horario', texto: 'Informe o horário de embarque e o de retorno.' });
  } else if (periodo !== 'noite') {
    // A noite pode voltar depois da meia-noite; os outros períodos, não.
    const e = paraMin(horarioEmbarque), r = paraMin(horarioRetorno);
    if (e !== null && r !== null && r <= e) erros.push({ codigo: 'horarios', texto: 'O retorno precisa ser depois do embarque.' });
  }

  if (onibus > 0) {
    if (!totalDia) {
      erros.push({
        codigo: 'sem_frota_dia',
        texto: aprovador
          ? 'Não há frota cadastrada para esta data. Cadastre-a abaixo para seguir.'
          : 'Não há ônibus disponíveis nesta data.',
      });
    } else if (onibus > livres) {
      const dica = proximo !== null ? ` A partir das ${paraHora(proximo)} há ônibus suficientes.` : '';
      barra('sem_frota', `Faltam ônibus: o pedido precisa de ${onibus} e há ${Math.max(0, livres)} livre(s) neste horário.${dica}`);
    }
  }

  // Cadeirante sem van é SEMPRE aviso: o pedido segue e a Gerência
  // providencia a van ou o deixa aguardando transporte adaptado.
  if (vans > 0 && vans > livresVan) {
    avisos.push({
      codigo: 'sem_van',
      texto: `Não há van adaptada livre para ${qtdCadeirantes} cadeirante(s). O pedido segue, e a Gerência providencia a van ou o deixa aguardando transporte adaptado.`,
    });
  }

  return { erros, avisos, onibus, vans };
}
```

  4. Em `sate.model.js`, trocar o bloco de `STATUS_RESERVA`:

```js
// Status que OCUPAM veículo. `solicitado` entra desde 26/09/2026 (spec
// 2026-09-26, D6): sem ele, duas escolas viam "1 livre" e as duas pediam
// o mesmo ônibus. `pendente_cancelamento` fica de fora de propósito: a
// vaga volta ao saldo no momento em que a escola pede, não no da ciência.
export const STATUS_RESERVA = Object.freeze(['solicitado', 'em_analise', 'aguardando_transporte_adaptado', 'confirmado']);
```

- [ ] **Step 4:** `node --test tests/` → todos PASS (inclusive os das Tasks 2 e 3).

- [ ] **Step 5: Commit**

```bash
git add src/modules/sate/regras.model.js src/modules/sate/sate.model.js tests/sate-regras.test.mjs
git commit -m "feat(sate): avaliarPedido por intervalo; solicitado passa a reservar"
```

> Nota: depois desta task, `formulario.js` ainda importa `saldo.model.js` e chama `avaliarPedido`
> com o formato antigo. A Task 7 conserta; entre as duas o SATE não é publicado.

---

### Task 5: Página Frota = cadastro

**Files:**
- Rewrite: `src/modules/sate/views/frota.js`
- Create: `src/modules/sate/views/frota-form.js`
- Delete: `src/modules/sate/views/frota-painel.js`
- Modify: `src/modules/sate/sate.config.js` (tirar o item `frota` e o import de `pintarFrota`; atualizar o comentário do cabeçalho que diz que o cadastro da frota é configuração)
- Modify: `src/modules/sate/sate.view.js` (texto `desc` da página frota)
- Modify: `src/modules/sate/sate.css` (apagar as regras de `.cfg-frota`, `.fr-linha`, `.fr-nova` e as do saldo antigo `.frota`, `.frota-row`, `.fr-per`, `.fr-uso`, `.fr-saldo`, `.fr-tipo`, `.fr-composicao`; manter `.fr-lote`, `.fr-orfas`, `.fr-orfa-acoes`, `.fx-texto`)

**Interfaces:**
- Consumes (Task 3): `getFrotas`, `filtrarFrotas`, `situacaoDaFrota`, `SITUACOES`, `TIPOS`, `rotulaTipo`, `getFrotasOrfas`, `manterLote`, `excluirFrota`, `editarFrota`, `abrirFrota`, `criarLote`, `getRotulos`, `criarRotulo`, `arquivarRotulo`, `excluirRotulo`.
- Produces: `frota-form.js` exporta `abrirFormFrota({ frota = null, aoSalvar })` e `abrirRotulos({ aoFechar })`.

- [ ] **Step 1: `views/frota-form.js`** - os dois modais:

```js
// ============================================================
// FundHub - sate/views/frota-form.js
// Os modais da página Frota: Nova/Editar frota e Rótulos.
// Spec: 2026-09-26-sate-frota-e-disponibilidade-design.md § D2.
//
// Um formulário para os dois jeitos de frota: SEM fim = em aberto (abre
// pela abrir_frota(), que encerra a anterior do MESMO rótulo e tipo); COM
// fim = lote que soma. A pessoa não precisa saber a diferença de
// mecanismo - só se a frota tem prazo.
// ============================================================
import {
  TIPOS, getRotulos, criarRotulo, arquivarRotulo, excluirRotulo,
  abrirFrota, criarLote, editarFrota,
} from '../frota.model.js';
import { esc, val, falha } from '../../../shared/dom.js';
import { hojeISO } from '../../../shared/format.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro, loading } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

const NOVO = '__novo__';

export async function abrirFormFrota({ frota = null, aoSalvar }) {
  const f = frota;
  const rotulos = await getRotulos().catch(() => []);
  // Editando uma frota de rótulo ARQUIVADO: ele não vem na lista ativa,
  // mas precisa aparecer selecionado.
  const lista = f && !rotulos.some(r => r.id === f.rotulo_id)
    ? [...rotulos, { id: f.rotulo_id, nome: f.rotulo?.nome || 'rótulo arquivado' }] : rotulos;

  abrirModal(`
    ${modalHead(f ? 'Editar frota' : 'Nova frota', f ? esc(f.rotulo?.nome || '') : 'Veículos disponíveis para o SATE')}
    <div class="modal-body">
      <form id="ff-form" class="esc-form">
        <div class="form-grid">
          <label class="col-full">Rótulo
            <select id="ff-rotulo" required>
              <option value="">Selecione…</option>
              ${lista.map(r => `<option value="${esc(r.id)}" ${f?.rotulo_id === r.id ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}
              <option value="${NOVO}">+ Novo rótulo…</option>
            </select>
            <small class="form-hint">De onde vêm os veículos ("Regular", "Feira do Livro").</small></label>
          <label class="col-full" id="ff-novo-w" hidden>Nome do novo rótulo
            <input id="ff-novo" type="text" maxlength="60" /></label>
          <label>Tipo
            <select id="ff-tipo">${TIPOS.map(t => `<option value="${esc(t.id)}" ${f?.tipo === t.id ? 'selected' : ''}>${esc(t.rotulo)}</option>`).join('')}</select></label>
          <label>Veículos <input id="ff-qtd" type="number" min="1" inputmode="numeric" value="${esc(String(f?.quantidade ?? ''))}" required /></label>
          <label>Início <input id="ff-inicio" type="date" value="${esc(f?.inicio || hojeISO())}" required /></label>
          <label>Fim <input id="ff-fim" type="date" value="${esc(f?.fim || '')}" />
            <small class="form-hint">Vazio = em aberto, sem data para acabar.</small></label>
          <label class="col-full">Observação <input id="ff-obs" type="text" value="${esc(f?.observacao || '')}" /></label>
        </div>
        <p class="form-hint" id="ff-dica">${f ? 'Para mudar a quantidade a partir de um dia, use Nova frota com o mesmo rótulo: a anterior é encerrada na véspera.' : 'Sem fim, esta frota substitui a aberta do mesmo rótulo e tipo a partir do início.'}</p>
        <div class="form-foot">
          <span id="ff-msg" class="auth-msg"></span>
          <button type="submit" class="btn-primary" id="ff-ok">${f ? 'Salvar' : 'Cadastrar frota'}</button>
        </div>
      </form>
    </div>`, { tamanho: 'medio' });

  const sel = document.getElementById('ff-rotulo');
  sel.addEventListener('change', () => {
    document.getElementById('ff-novo-w').hidden = sel.value !== NOVO;
    if (sel.value === NOVO) document.getElementById('ff-novo').focus();
  });

  document.getElementById('ff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('ff-msg'); msg.className = 'auth-msg';
    const qtd = parseInt(val('ff-qtd'), 10);
    const inicio = val('ff-inicio'), fim = val('ff-fim') || null;
    if (!sel.value) return falha(msg, 'Escolha ou crie o rótulo.');
    if (sel.value === NOVO && !val('ff-novo')) return falha(msg, 'Informe o nome do novo rótulo.');
    if (!qtd || qtd < 1) return falha(msg, 'Informe quantos veículos.');
    if (!inicio) return falha(msg, 'Informe o início.');
    if (fim && fim < inicio) return falha(msg, 'A data de fim não pode ser antes do início.');

    const btn = document.getElementById('ff-ok'); btn.disabled = true;
    try {
      const rotuloId = sel.value === NOVO ? (await criarRotulo(val('ff-novo'))).id : sel.value;
      const dados = { rotuloId, tipo: document.getElementById('ff-tipo').value, quantidade: qtd, inicio, fim, observacao: val('ff-obs') || null };
      if (f) await editarFrota(f.id, dados);
      else if (fim) await criarLote(dados);
      else await abrirFrota(dados);
      fecharModal();
      toast({ titulo: f ? 'Frota atualizada' : 'Frota cadastrada', tipo: 'sucesso' });
      aoSalvar?.();
    } catch (err) {
      reportarErro(err, { msg, titulo: 'Não foi possível salvar' });
      btn.disabled = false;
    }
  });
}

// Rótulos: arquivar some da escolha e preserva o nome nas frotas antigas;
// excluir só o que nunca foi usado (o banco recusa o resto).
//
// Os ouvintes ficam no #rt-corpo, que não é recriado - só o conteúdo dele
// é. Ligar dentro de pintarRotulos() empilharia um ouvinte por repintura.
export async function abrirRotulos({ aoFechar } = {}) {
  abrirModal(`
    ${modalHead('Rótulos', 'O nome que explica de onde vieram os veículos')}
    <div class="modal-body"><div id="rt-corpo">${loading()}</div></div>`, { tamanho: 'estreito' });
  const box = document.getElementById('rt-corpo');
  const depois = async () => { await pintarRotulos(); aoFechar?.(); };

  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await criarRotulo(val('rt-nome')); await depois(); }
    catch (err) { reportarErro(err, { msg: document.getElementById('rt-msg'), titulo: 'Não foi possível criar' }); }
  });
  box.addEventListener('click', async (e) => {
    const arq = e.target.closest('[data-arq]');
    const del = e.target.closest('[data-del]');
    if (!arq && !del) return;
    try {
      if (arq) await arquivarRotulo(arq.dataset.arq, arq.dataset.ativo !== '1');
      else {
        if (!(await confirmar('Excluir este rótulo?', {
          detalhe: 'Só é possível excluir rótulo que nunca foi usado em uma frota.', textoOk: 'Excluir', perigo: true,
        }))) return;
        await excluirRotulo(del.dataset.del);
      }
      await depois();
    } catch (err) { reportarErro(err, { titulo: 'Não foi possível concluir' }); }
  });
  await pintarRotulos();
}

async function pintarRotulos() {
  const box = document.getElementById('rt-corpo');
  if (!box) return;
  const rotulos = await getRotulos({ incluirArquivados: true }).catch(() => []);
  box.innerHTML = `
    <div class="rt-lista">
      ${rotulos.map(r => `<div class="fr-lote ${r.ativo ? '' : 'inativo'}">
        <b>${esc(r.nome)}</b>
        ${r.ativo ? '' : '<span class="tag st-negado">arquivado</span>'}
        <span class="fr-orfa-acoes">
          <button type="button" class="mini-btn" data-arq="${esc(r.id)}" data-ativo="${r.ativo ? '1' : '0'}">${r.ativo ? 'Arquivar' : 'Reativar'}</button>
          <button type="button" class="mini-btn no" data-del="${esc(r.id)}" aria-label="Excluir rótulo ${esc(r.nome)}">${ico('excluir')}</button>
        </span>
      </div>`).join('') || '<p class="form-hint">Nenhum rótulo ainda.</p>'}
    </div>
    <form id="rt-form" class="esc-form rt-novo">
      <label>Novo rótulo <input id="rt-nome" type="text" maxlength="60" placeholder="Ex.: Cirem" /></label>
      <button type="submit" class="mini-btn">${ico('adicionar')} Criar</button>
    </form>
    <p class="auth-msg" id="rt-msg"></p>`;
}
```

- [ ] **Step 2: Reescrever `views/frota.js`**:

```js
// ============================================================
// FundHub - sate/views/frota.js  (página Frota - só quem aprova)
// O CADASTRO da frota: o que existe, o que vale, o que expirou.
// Spec: 2026-09-26-sate-frota-e-disponibilidade-design.md § D2.
//
// Até a 0.36 esta página mostrava o saldo de UM dia, e o cadastro morava
// num painel da engrenagem - ninguém achava a frota cadastrada. O saldo
// foi para a página Disponibilidade (todos veem), e o cadastro veio para
// cá, como tabela: as frotas se comparam entre si (R18).
//
// No topo, a frota extra que perdeu o pedido de origem (spec do ciclo
// de aprovação, D3): é pendência, e aparece até alguém decidir.
// ============================================================
import {
  getFrotas, filtrarFrotas, situacaoDaFrota, SITUACOES, TIPOS, rotulaTipo,
  getFrotasOrfas, manterLote, excluirFrota,
} from '../frota.model.js';
import { STATUS } from '../sate.model.js';
import { abrirFormFrota, abrirRotulos } from './frota-form.js';
import { esc } from '../../../shared/dom.js';
import { hojeISO, fmtData } from '../../../shared/format.js';
import { montarTabela } from '../../../shared/ui/tabela.js';
import { modalHtml, montarModal } from '../../../shared/ui/modal.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { loading, erroBox, reportarErro } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

let lista = [];
let tabela = null;
// Filtro de sessão da página: sobrevive à troca de página, não ao recarregar.
const filtro = { situacao: 'vigente', tipo: '', de: '', ate: '' };
const CHIPS = [['vigente', 'Vigentes'], ['futura', 'Futuras'], ['encerrada', 'Encerradas'], ['todas', 'Todas']];

export function render(ctx) {
  tabela = null;
  ctx.box().innerHTML = `
    <div class="toolbar">
      <button type="button" id="fr-nova" class="btn-primary">${ico('adicionar')} Nova frota</button>
      <button type="button" id="fr-rotulos" class="btn-secundario">Rótulos</button>
    </div>
    <div id="fr-orfas"></div>
    <div class="painel-filtros">
      <div class="filters" id="fr-sit" role="group" aria-label="Situação">
        ${CHIPS.map(([v, r]) => `<button type="button" class="chip ${filtro.situacao === v ? 'on' : ''}" data-sit="${v}">${r}</button>`).join('')}
      </div>
      <label class="filtro-campo">Tipo <select id="fr-tipo">
        <option value="">Todos</option>
        ${TIPOS.map(t => `<option value="${esc(t.id)}" ${filtro.tipo === t.id ? 'selected' : ''}>${esc(t.rotulo)}</option>`).join('')}
      </select></label>
      <label class="filtro-campo">Vigente de <input id="fr-de" type="date" value="${esc(filtro.de)}" /></label>
      <label class="filtro-campo">até <input id="fr-ate" type="date" value="${esc(filtro.ate)}" /></label>
    </div>
    <div id="fr-lista">${loading()}</div>
    ${modalHtml()}`;

  montarModal();
  const recarregar = () => { carregar(); pintarOrfas(); };
  document.getElementById('fr-nova').addEventListener('click', () => abrirFormFrota({ aoSalvar: recarregar }));
  document.getElementById('fr-rotulos').addEventListener('click', () => abrirRotulos({ aoFechar: carregar }));
  document.getElementById('fr-sit').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sit]'); if (!b) return;
    filtro.situacao = b.dataset.sit;
    document.querySelectorAll('#fr-sit .chip').forEach(c => c.classList.toggle('on', c === b));
    pintar();
  });
  document.getElementById('fr-tipo').addEventListener('change', e => { filtro.tipo = e.target.value; pintar(); });
  document.getElementById('fr-de').addEventListener('change', e => { filtro.de = e.target.value; pintar(); });
  document.getElementById('fr-ate').addEventListener('change', e => { filtro.ate = e.target.value; pintar(); });
  document.getElementById('fr-orfas').addEventListener('click', decidirOrfa);

  carregar();
  pintarOrfas();

  async function carregar() {
    const box = document.getElementById('fr-lista');
    if (!box) return;
    try { lista = await getFrotas({}); }
    catch (err) { box.innerHTML = erroBox(err); tabela = null; return; }
    pintar();
  }

  // Filtrar é em memória: são dezenas de frotas, não milhares (R18).
  function pintar() {
    const box = document.getElementById('fr-lista');
    if (!box) return;
    const linhas = filtrarFrotas(lista, filtro, hojeISO());
    if (tabela) { tabela.atualizar(linhas); return; }
    tabela = montarTabela(box, {
      colunas: COLUNAS,
      linhas,
      chave: f => f.id,
      acoes: [
        { ico: 'editar', rotulo: 'Editar', ao: (f) => abrirFormFrota({ frota: f, aoSalvar: recarregar }) },
        { ico: 'excluir', rotulo: 'Excluir', perigo: true, ao: (f) => excluir(f) },
      ],
      buscarEm: ['rotulo', 'tipo'],
      ordem: { coluna: 'inicio', dir: 'desc' },
      substantivo: 'frotas',
      vazio: {
        ico: 'onibus', titulo: 'Nenhuma frota com esses filtros',
        texto: 'Troque a situação para "Todas" ou clique em "Nova frota".',
      },
    });
  }

  async function excluir(f) {
    if (!(await confirmar('Excluir esta frota?', {
      detalhe: 'Os veículos deixam de contar nos dias que ela cobria.', textoOk: 'Excluir', perigo: true,
    }))) return;
    try { await excluirFrota(f.id); toast({ titulo: 'Frota excluída', tipo: 'sucesso' }); recarregar(); }
    catch (err) { reportarErro(err, { titulo: 'Não foi possível excluir' }); }
  }
}

const COLUNAS = [
  { id: 'rotulo', rotulo: 'Rótulo', valor: f => f.rotulo?.nome || 'sem rótulo' },
  { id: 'tipo', rotulo: 'Tipo', prioridade: 2, valor: f => rotulaTipo(f.tipo) },
  { id: 'qtd', rotulo: 'Veículos', tipo: 'numero', alinhar: 'dir', valor: f => f.quantidade || 0 },
  { id: 'inicio', rotulo: 'Início', tipo: 'data', valor: f => f.inicio || '', celula: f => esc(fmtData(f.inicio)) },
  { id: 'fim', rotulo: 'Fim', prioridade: 2, tipo: 'data', valor: f => f.fim || '',
    celula: f => (f.fim ? esc(fmtData(f.fim)) : '<span class="vazio">em aberto</span>') },
  { id: 'situacao', rotulo: 'Situação', valor: f => SITUACOES[situacaoDaFrota(f, hojeISO())],
    celula: f => { const s = situacaoDaFrota(f, hojeISO());
      return `<span class="tag fr-sit-${s}">${esc(SITUACOES[s])}</span>`; } },
  { id: 'origem', rotulo: 'Origem', prioridade: 3,
    valor: f => (f.solicitacao_id ? 'Extra de pedido' : 'Cadastro') },
];

// ── Frota órfã (spec 2026-09-13-sate-ciclo-de-aprovacao, D3) ──
// Lote extra cujo pedido foi negado, cancelado ou remanejado para outra
// data. Independe dos filtros: é pendência, e aparece até alguém decidir.
async function pintarOrfas() {
  const box = document.getElementById('fr-orfas');
  if (!box) return;
  const orfas = await getFrotasOrfas().catch(() => []);
  if (!orfas.length) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="fr-orfas">
      <div class="lbl">Frota extra sem pedido (${orfas.length})</div>
      <p class="form-hint">Estes veículos extras nasceram de um pedido que foi negado, cancelado ou mudou de data.
        <b>Manter</b> transforma o lote em reforço comum; <b>Remover</b> apaga.</p>
      ${orfas.map(f => {
        const s = f.solicitacao;
        const motivo = !s ? 'pedido apagado'
          : ['negado', 'cancelado'].includes(s.status) ? `pedido ${STATUS[s.status].toLowerCase()}`
          : `pedido remanejado para ${fmtData(s.data)}`;
        return `<div class="fr-lote">
          <b>${esc(f.rotulo?.nome || 'sem rótulo')}</b>
          <span class="tag">${esc(rotulaTipo(f.tipo))}</span>
          <span>${f.quantidade} veículo(s) em ${esc(fmtData(f.inicio))}</span>
          <span class="di-meta">${esc(motivo)}</span>
          <span class="fr-orfa-acoes">
            <button type="button" class="mini-btn" data-manter="${esc(f.id)}">Manter</button>
            <button type="button" class="mini-btn no" data-remover="${esc(f.id)}">Remover</button>
          </span>
        </div>`;
      }).join('')}
    </div>`;
}

// `recarregarLista` é atribuída em render(): a lista de frotas também
// muda quando uma órfã é mantida ou removida.
let recarregarLista = () => {};

async function decidirOrfa(e) {
  const manter = e.target.closest('[data-manter]');
  const remover = e.target.closest('[data-remover]');
  if (!manter && !remover) return;
  if (remover && !(await confirmar('Remover este lote de frota extra?', {
    detalhe: 'Os veículos deixam de contar no saldo daquele dia.', textoOk: 'Remover', perigo: true,
  }))) return;
  try {
    if (manter) await manterLote(manter.dataset.manter);
    else await excluirFrota(remover.dataset.remover);
    toast({ titulo: manter ? 'Lote mantido como reforço' : 'Lote removido', tipo: 'sucesso' });
    await pintarOrfas();
    recarregarLista();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível concluir' });
  }
}
```

  Dentro de `render`, logo depois de declarar `carregar`, atribua `recarregarLista = carregar;`
  (as funções internas são declarações de função, então `carregar` já existe nesse ponto).

- [ ] **Step 3: CSS** em `sate.css`, no lugar das regras apagadas:

```css
/* ── Página Frota ──────────────────────────────────────────── */
/* Situação da frota: a mesma família de cor das situações de pedido. */
.tag.fr-sit-vigente  { color: var(--ok); background: color-mix(in srgb, var(--ok) 16%, transparent); }
.tag.fr-sit-futura   { color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
.tag.fr-sit-encerrada { color: var(--muted); background: var(--surface-3); }
.fr-lote.inativo { opacity: .65; }
/* Modal de rótulos: lista e o campo de criar numa linha (R17: botão ao
   lado de campo usa a altura do campo - a regra estrutural já cobre). */
.rt-lista { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.rt-novo { display: flex; align-items: end; gap: 8px; }
.rt-novo label { flex: 1 1 auto; }
```

- [ ] **Step 4: Configurações e manifesto de páginas.**
  - `sate.config.js`: apagar `import { pintarFrota } …`, o item `{ chave: 'frota', … painel: pintarFrota }`
    e reescrever o parágrafo do cabeçalho "O CADASTRO da frota também é configuração…" para:
    "O cadastro da frota saiu daqui em 26/09/2026 para a página Frota do SATE: ficava escondido
    numa engrenagem e ninguém achava o que estava cadastrado (spec 2026-09-26, D2)."
  - `git rm src/modules/sate/views/frota-painel.js`
  - `sate.view.js`: `desc` da página `frota` → `'As frotas cadastradas: quantos veículos, de quando a quando, e de onde vêm.'`

- [ ] **Step 5: Verificar**

Run: `node --test tests/` → PASS. `python .claude/scripts/verificar_arquitetura.py` → sem BLOQUEIA novo
(a checagem 12 pode avisar classe órfã se sobrar algo - resolva).
`grep -rn "frota-painel\|pintarFrota\|getFrotaAberta" src` → nada.

- [ ] **Step 6: Commit**

```bash
git add -A src/modules/sate
git commit -m "feat(sate): pagina Frota vira o cadastro - lista, filtros, nova/editar/excluir, rotulos"
```

---

### Task 6: Página Disponibilidade

**Files:**
- Create: `src/modules/sate/views/disponibilidade.js`
- Modify: `src/modules/sate/sate.view.js` (importar e registrar em `PAGINAS`, entre `solicitacoes` e `fichas`, sem `aprovador`)
- Modify: `src/modules/sate/sate.css`

**Interfaces:**
- Consumes (Task 2): `lerOcupacao(de, ate)`, `livresNoPeriodo(linha, dia, periodo, tipo)`, `escadaDaTarde(linha, dia, tipo)`, `totalDoDia(linha, dia, tipo)`, `DIA`, `TIPICO`; `getFrotas({ vigenteEm })` (Task 3); `PERIODOS` de `sate.model.js`; `paraHora` de `regras.model.js`.
- `ctx` recebido: `{ aprovador, box(), … }` (ver `sate.view.js`).

- [ ] **Step 1: Registrar a página** em `sate.view.js`:

```js
import * as paginaDisponibilidade from './views/disponibilidade.js';
// … em PAGINAS, logo depois de solicitacoes:
  disponibilidade: { rotulo: 'Disponibilidade', ico: 'calendario', view: paginaDisponibilidade,
    desc: 'Quantos ônibus estão livres em cada dia e período, para planejar o pedido.' },
```

- [ ] **Step 2: Implementar `views/disponibilidade.js`**:

```js
// ============================================================
// FundHub - sate/views/disponibilidade.js  (página Disponibilidade - todos)
// Uma semana por vez: quantos ônibus (e vans) estão livres em cada dia e
// período. Spec: 2026-09-26-sate-frota-e-disponibilidade-design.md § D3.
//
// A escola planeja ANTES de pedir. Os números são para uma viagem típica
// de cada período (disponibilidade.model.js § TIPICO); o formulário
// confere o horário exato. A tarde mostra a ESCADA: os ônibus da manhã
// voltam aos poucos, e "2 livres às 12h" não conta a história de "9 a
// partir das 15h30".
//
// A escola vê só números - nunca de quem é a reserva (mesma promessa da
// 036). Quem aprova vê também, ao abrir o dia, a composição por rótulo.
// ============================================================
import { lerOcupacao, livresNoPeriodo, escadaDaTarde, totalDoDia } from '../disponibilidade.model.js';
import { getFrotas, rotulaTipo } from '../frota.model.js';
import { PERIODOS } from '../sate.model.js';
import { paraHora } from '../regras.model.js';
import { esc } from '../../../shared/dom.js';
import { hojeISO, addDias, fmtData, DOW } from '../../../shared/format.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

let ctx = null;
let segunda = null;   // data civil da segunda-feira da semana à vista

// Segunda-feira da semana de `iso`. Aritmética de calendário (R8 permite):
// só o dia da semana sai do Date, e o resultado volta por addDias.
function segundaDe(iso) {
  const dow = new Date(iso + 'T00:00:00').getDay();   // 0 = domingo
  return addDias(iso, dow === 0 ? -6 : 1 - dow);
}

export function render(contexto) {
  ctx = contexto;
  segunda = segunda || segundaDe(hojeISO());
  ctx.box().innerHTML = `
    <div class="toolbar disp-nav">
      <button type="button" class="mini-btn" id="disp-ant" aria-label="Semana anterior">${ico('voltar')}</button>
      <label class="search compacta">${ico('calendario', { tam: 14 })}
        <input id="disp-data" type="date" aria-label="Ir para a data" /></label>
      <button type="button" class="mini-btn" id="disp-prox" aria-label="Próxima semana">${ico('avancar')}</button>
      <button type="button" class="mini-btn" id="disp-hoje">Hoje</button>
    </div>
    <div id="disp-corpo">${loading()}</div>
    <p class="form-hint">Os números são para uma viagem típica de cada período. O formulário de pedido confere o horário exato.</p>`;

  const ir = (nova) => { segunda = nova; carregar(); };
  document.getElementById('disp-ant').addEventListener('click', () => ir(addDias(segunda, -7)));
  document.getElementById('disp-prox').addEventListener('click', () => ir(addDias(segunda, 7)));
  document.getElementById('disp-hoje').addEventListener('click', () => ir(segundaDe(hojeISO())));
  document.getElementById('disp-data').addEventListener('change', (e) => { if (e.target.value) ir(segundaDe(e.target.value)); });
  document.getElementById('disp-corpo').addEventListener('click', abrirDia);
  carregar();
}

async function carregar() {
  const box = document.getElementById('disp-corpo');
  if (!box) return;
  box.innerHTML = loading();
  const domingo = addDias(segunda, 6);
  let linha;
  try { linha = await lerOcupacao(segunda, domingo); }
  catch (err) { box.innerHTML = erroBox(err); return; }
  if (!document.getElementById('disp-corpo')) return;

  const hoje = hojeISO();
  const dias = [0, 1, 2, 3, 4, 5, 6].map(i => ({ i, data: addDias(segunda, i) }));
  box.innerHTML = `
    ${linha.aproximado ? '<p class="sol-aviso">Contagem sem horário: o banco ainda não tem a atualização desta versão. Os números são por período.</p>' : ''}
    <h2 class="disp-semana">${esc(fmtData(segunda))} a ${esc(fmtData(domingo))}</h2>
    <div class="disp-grade">${dias.map(d => diaHtml(linha, d, hoje)).join('')}</div>`;
}

function diaHtml(linha, { i, data }, hoje) {
  const dow = new Date(data + 'T00:00:00').getDay();
  const tot = totalDoDia(linha, i, 'onibus');
  const totVan = totalDoDia(linha, i, 'vans');
  const passado = data < hoje;
  const cab = `<div class="disp-dia-cab"><b>${esc(DOW[dow])}</b> <span>${esc(fmtData(data))}</span></div>`;
  if (!tot && !totVan) {
    return `<div class="disp-dia ${passado ? 'passado' : ''}">${cab}<span class="vazio">sem frota</span></div>`;
  }
  const n = (v) => Math.max(0, v);
  const linhaPer = (p) => {
    if (p === 'tarde') {
      const esc_ = escadaDaTarde(linha, i, 'onibus');
      const texto = esc_.map((g, k) => (k === 0 ? `<b>${n(g.livres)}</b>` : `<b>${n(g.livres)}</b> a partir das ${esc(paraHora(g.aPartirDe))}`)).join(' · ');
      return `<div class="disp-per"><span>${esc(PERIODOS.tarde)}</span><span>${texto}</span></div>`;
    }
    return `<div class="disp-per"><span>${esc(PERIODOS[p])}</span><span><b>${n(livresNoPeriodo(linha, i, p, 'onibus'))}</b></span></div>`;
  };
  const vans = totVan ? `<div class="disp-per disp-van"><span>${ico('cadeirante', { tam: 12 })} Vans</span>
      <span>${['manha', 'tarde', 'noite'].map(p => n(livresNoPeriodo(linha, i, p, 'vans'))).join(' · ')}</span></div>` : '';
  const abrir = ctx.aprovador ? ` data-dia="${esc(data)}" role="button" tabindex="0" aria-label="Ver a composição da frota de ${esc(fmtData(data))}"` : '';
  return `<div class="disp-dia ${passado ? 'passado' : ''} ${ctx.aprovador ? 'clicavel' : ''}"${abrir}>
    ${cab}
    <div class="disp-tot">${tot} ônibus no dia</div>
    ${['manha', 'tarde', 'noite'].map(linhaPer).join('')}
    ${vans}
    <div class="disp-comp" hidden></div>
  </div>`;
}

// Quem aprova: a composição da frota do dia, por rótulo, abre embaixo.
async function abrirDia(e) {
  const card = e.target.closest('[data-dia]');
  if (!card || !ctx.aprovador) return;
  const comp = card.querySelector('.disp-comp');
  if (!comp.hidden) { comp.hidden = true; return; }
  comp.hidden = false;
  comp.innerHTML = loading();
  const frotas = await getFrotas({ vigenteEm: card.dataset.dia }).catch(() => []);
  comp.innerHTML = frotas.length
    ? frotas.map(f => `<div>${esc(f.rotulo?.nome || 'sem rótulo')} · ${f.quantidade} ${esc(rotulaTipo(f.tipo).toLowerCase())}</div>`).join('')
    : '<span class="vazio">sem frota</span>';
}
```

  Confira que `DOW` em `shared/format.js` é indexado por `getDay()` (0 = domingo). Se não for, use o
  índice correto; não crie formatação nova fora de `format.js`. Adicione um `keydown` (Enter/Espaço)
  em `#disp-corpo` que chame `abrirDia` para o card focado - acessibilidade do `role="button"`.

- [ ] **Step 3: CSS** em `sate.css` (mobile-first; a grade vira 7 colunas só em tela larga):

```css
/* ── Página Disponibilidade ────────────────────────────────── */
.disp-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.disp-semana { font-size: 15px; margin: 4px 0 12px; }
.disp-grade { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 720px)  { .disp-grade { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1100px) { .disp-grade { grid-template-columns: repeat(4, 1fr); } }
.disp-dia {
  display: flex; flex-direction: column; gap: 6px; padding: 12px;
  border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface);
}
.disp-dia.passado { opacity: .55; }
.disp-dia.clicavel { cursor: pointer; }
.disp-dia.clicavel:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.disp-dia-cab { display: flex; justify-content: space-between; gap: 8px; }
.disp-dia-cab span, .disp-tot { color: var(--muted); font-size: 12.5px; }
.disp-per { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.disp-per > span:first-child { color: var(--muted); flex: 0 0 auto; }
.disp-per > span:last-child { text-align: right; }
.disp-van { border-top: 1px solid var(--border); padding-top: 6px; }
.disp-comp { border-top: 1px solid var(--border); padding-top: 6px; font-size: 12.5px; color: var(--muted); }
```

- [ ] **Step 4: Verificar:** `node --test tests/`, verificador sem BLOQUEIA novo.

- [ ] **Step 5: Commit**

```bash
git add src/modules/sate/views/disponibilidade.js src/modules/sate/sate.view.js src/modules/sate/sate.css
git commit -m "feat(sate): pagina Disponibilidade - semana, escada da tarde, composicao para quem aprova"
```

---

### Task 7: Formulário, porta de entrada, decidir e remanejar

**Files:**
- Modify: `src/modules/sate/views/formulario.js`
- Modify: `src/modules/sate/views/solicitacoes.js`
- Modify: `src/modules/sate/views/detalhe.js`
- Modify: `src/modules/sate/views/remanejar.js`
- Delete: `src/modules/sate/saldo.model.js`
- Modify: `src/modules/sate/sate.model.js` (cabeçalho: tirar a menção a `saldo.model.js`, apontar para `disponibilidade.model.js`); `sate.css` (`.sol-cad-frota`)

**Interfaces:**
- Consumes: Task 2 (`lerOcupacao`, `intervaloDaViagem`, `livresPara`, `totalDoDia`, `proximoHorario`, `faltaParaConfirmar`, `livresNoPeriodo`), Task 3 (`existeFrota`, `criarLote`, `getRotulos`, `criarRotulo`), Task 4 (`avaliarPedido` novo, `STATUS_RESERVA`).

- [ ] **Step 1: `formulario.js` - imports.** Trocar:

```js
import { criarSolicitacao, listSolicitacoes } from '../sate.model.js';
import { saldoDoDia, livreManhaSeguinte } from '../saldo.model.js';
```
por
```js
import { criarSolicitacao } from '../sate.model.js';
import {
  lerOcupacao, intervaloDaViagem, livresPara, totalDoDia, proximoHorario, livresNoPeriodo,
} from '../disponibilidade.model.js';
import { criarLote, getRotulos, criarRotulo } from '../frota.model.js';
```
e tirar `intervaloMinMin` do import de `sate.config.js` (o intervalo vem da linha, `linha.intervaloMin`, que é o mesmo número que o banco usa).

- [ ] **Step 2: Horários obrigatórios.** Nos dois `<input type="time">` (`f-emb`, `f-ret`) acrescentar `required`.

- [ ] **Step 3: Substituir `pintarSaldo` e `avaliar`** (linhas ~228-290) por:

```js
async function pintarSaldo() {
  const box = document.getElementById('f-saldo');
  const btn = document.getElementById('f-submit');
  if (!box) return;   // o modal fechou enquanto o debounce corria

  const data = val('f-data');
  const periodo = document.getElementById('f-per').value;
  const alunos = parseInt(val('f-alunos'), 10) || 0;
  if (!data || !periodo || !alunos) { box.innerHTML = ''; btn.disabled = !!ctx.somenteLeitura; return; }

  const meu = ++pedidoSaldo;
  let linha;
  try { linha = await lerOcupacao(data); }
  catch (_) { box.innerHTML = ''; btn.disabled = !!ctx.somenteLeitura; return; }
  if (meu !== pedidoSaldo) return;   // resposta velha: descarta

  const emb = val('f-emb') || null, ret = val('f-ret') || null;
  // Com os dois horários, a conta é do INTERVALO do pedido (spec D5/D8).
  // Sem eles, o número da página Disponibilidade para o período.
  const iv = emb && ret ? intervaloDaViagem({
    periodo, embarque: emb, retorno: ret, trajetoMin: trajeto?.minutos, intervaloMin: linha.intervaloMin,
  }) : null;
  const livres = iv ? livresPara(linha, iv.ini, iv.fim, 'onibus') : livresNoPeriodo(linha, 0, periodo, 'onibus');
  const livresVan = iv ? livresPara(linha, iv.ini, iv.fim, 'vans') : livresNoPeriodo(linha, 0, periodo, 'vans');
  const totalDia = totalDoDia(linha, 0, 'onibus');
  const r = avaliar({ data, periodo, alunos, livres, livresVan, totalDia, emb, ret, linha, iv });

  const quando = iv ? `para embarque às ${esc(emb)}` : `no período`;
  const linhas = [
    totalDia ? `<div class="sol-saldo-num"><b>${Math.max(0, livres)}</b> ônibus livres ${quando} em ${esc(fmtData(data))}`
      + ` · este pedido usa <b>${r.onibus}</b></div>` : '',
    linha.aproximado ? '<div class="sol-aviso">Contagem sem horário: o banco ainda não tem a atualização desta versão.</div>' : '',
    ...r.erros.map(e => `<div class="sol-erro">${esc(e.texto)}</div>`),
    ...r.avisos.map(a => `<div class="sol-aviso">${esc(a.texto)}</div>`),
  ];
  // Quem aprova, num dia sem frota: o cadastro rápido ali mesmo (spec D4).
  if (ctx.aprovador && r.erros.some(e => e.codigo === 'sem_frota_dia')) linhas.push(await cadastroRapidoHtml(data));
  box.innerHTML = linhas.join('');
  ligarCadastroRapido(data);
  btn.disabled = r.erros.length > 0 || !!ctx.somenteLeitura;
}

function avaliar({ data, periodo, alunos, livres, livresVan, totalDia, emb, ret, linha, iv }) {
  const dias = Math.round((new Date(data + 'T00:00:00') - new Date(hojeISO() + 'T00:00:00')) / 86400000);
  const atividade = modo === 'catalogo'
    ? (ctx.atividades || []).find(x => x.id === document.getElementById('f-ativ').value) : null;
  const usaOnibus = atividade ? atividade.usa_onibus !== false : true;
  const precisa = usaOnibus ? Math.ceil(alunos / capacidadeOnibus()) : 0;
  return avaliarPedido({
    periodo, qtdAlunos: alunos, usaOnibus,
    qtdCadeirantes: parseInt(val('f-cadeira'), 10) || 0,
    livres, livresVan, totalDia,
    proximo: iv && precisa > livres ? proximoHorario(linha, { ini: iv.ini, fim: iv.fim, precisa, periodo }) : null,
    diasDeAntecedencia: dias,
    horarioEmbarque: emb, horarioRetorno: ret,
    capacidadeOnibus: capacidadeOnibus(), capacidadeVan: capacidadeVan(),
    antecedenciaMin: antecedenciaMinDias(),
    aprovador: !!ctx.aprovador,
  });
}

// ── Cadastro rápido de frota (quem aprova, dia sem frota) ────
// Na LINHA do saldo, e não num modal por cima: o modal do hub é um só, e
// voltar ao pedido o reconstruiria vazio. É LOTE (com fim), não frota em
// aberto: abrir uma aqui poderia substituir a aberta do mesmo rótulo que
// começa depois (abrir_frota). Spec 2026-09-26, D4.
async function cadastroRapidoHtml(data) {
  const rotulos = await getRotulos().catch(() => []);
  return `<div class="sol-cad-frota">
    <div class="sol-cad-campos">
      <label>Rótulo <select id="cf-rotulo">
        <option value="">Selecione…</option>
        ${rotulos.map(r => `<option value="${esc(r.id)}">${esc(r.nome)}</option>`).join('')}
        <option value="__novo__">+ Novo rótulo…</option>
      </select></label>
      <label id="cf-novo-w" hidden>Nome do rótulo <input id="cf-novo" type="text" maxlength="60" /></label>
      <label>Ônibus <input id="cf-qtd" type="number" min="1" inputmode="numeric" /></label>
      <label>Até <input id="cf-fim" type="date" min="${esc(data)}" value="${esc(data)}" /></label>
      <button type="button" class="btn-secundario" id="cf-ok">Cadastrar frota</button>
    </div>
    <span class="form-hint">Frota em aberto (sem data para acabar) se cadastra na página Frota.</span>
    <span class="auth-msg" id="cf-msg"></span>
  </div>`;
}

function ligarCadastroRapido(data) {
  const ok = document.getElementById('cf-ok');
  if (!ok) return;
  const sel = document.getElementById('cf-rotulo');
  sel.addEventListener('change', () => { document.getElementById('cf-novo-w').hidden = sel.value !== '__novo__'; });
  ok.addEventListener('click', async () => {
    const msg = document.getElementById('cf-msg'); msg.className = 'auth-msg';
    const qtd = parseInt(val('cf-qtd'), 10);
    if (!sel.value) return falha(msg, 'Escolha ou crie o rótulo.');
    if (sel.value === '__novo__' && !val('cf-novo')) return falha(msg, 'Informe o nome do rótulo.');
    if (!qtd || qtd < 1) return falha(msg, 'Informe quantos ônibus.');
    const fim = val('cf-fim') || data;
    if (fim < data) return falha(msg, 'A data final não pode ser antes do dia do pedido.');
    ok.disabled = true;
    try {
      const rotuloId = sel.value === '__novo__' ? (await criarRotulo(val('cf-novo'))).id : sel.value;
      await criarLote({ rotuloId, quantidade: qtd, inicio: data, fim, tipo: 'onibus' });
      toast({ titulo: 'Frota cadastrada', texto: fmtData(data), tipo: 'sucesso' });
      pintarSaldo();
    } catch (err) {
      reportarErro(err, { msg, titulo: 'Não foi possível cadastrar' });
      ok.disabled = false;
    }
  });
}
```

  Detalhes a conferir no arquivo:
  - `trajeto?.minutos` - leia `rota.model.js` e use o nome real do campo de minutos do resultado de
    `calcularTrajeto` (o mesmo que `retratoTrajeto` grava em `trajeto_min`). Se `pintarTrajeto` terminar
    depois do saldo, chame `revisar()` no fim de `pintarTrajeto` para recalcular com o trajeto.
  - Remover o que ficou sem uso: `listSolicitacoes`, `intervaloMinMin`, `livreManhaSeguinte`.
  - Em `enviar()`, o `qtd_onibus` já considera `usaOnibus` - mantém.
  - Em `enviar()`, no `catch`: se `err.code === 'P0001'` e a mensagem começar com `Sem onibus livres`,
    mostrar `falha(msg, 'Não há ônibus livres para este horário. Escolha outro horário ou outra data.')`
    e chamar `pintarSaldo()` (outra escola pode ter acabado de pegar a vaga). Se `err.code === '23502'`,
    `falha(msg, 'Informe o horário de embarque e o de retorno.')`. Senão, o `reportarErro` de hoje.
  - O arquivo precisa ficar **≤ 400 linhas** (R11). Se passar, primeiro enxugue comentários
    redundantes; se ainda passar, o cadastro rápido (as duas funções acima) sai para
    `views/frota-rapida.js`, exportando `cadastroRapidoHtml(data)` e `ligarCadastroRapido(data, aoCadastrar)` -
    é uma responsabilidade com fronteira própria (R11, "tire o que tem fronteira própria").

  CSS em `sate.css`:

```css
/* Cadastro rápido de frota, na linha do saldo (quem aprova, dia sem frota). */
.sol-cad-frota { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px;
  border: 1px dashed var(--border-forte); border-radius: var(--radius-btn); }
.sol-cad-campos { display: grid; grid-template-columns: 1fr; gap: 8px; align-items: end; }
@media (min-width: 720px) { .sol-cad-campos { grid-template-columns: 2fr 1fr 1fr auto; } }
.sol-cad-campos label { display: flex; flex-direction: column; gap: 4px; }
```
  O formulário é `.esc-form`, então os campos já herdam altura e rótulo (R17) - não declare `--campo`.

- [ ] **Step 4: `solicitacoes.js` - porta de entrada** (sistema sem frota nenhuma, quem aprova):

```js
import { existeFrota } from '../frota.model.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
// …
document.getElementById('sol-nova').addEventListener('click', async () => {
  // Antes da primeira viagem, a primeira frota (spec 2026-09-26, D4).
  // Só para quem aprova: a escola vê o formulário e ele diz que não há
  // ônibus - "cadastre a frota" não é algo que ela possa fazer.
  if (ctx.aprovador && !ctx.somenteLeitura && !(await existeFrota().catch(() => true))) {
    const ir = await confirmar('Antes da primeira viagem, cadastre a frota', {
      detalhe: 'O SATE ainda não tem nenhum veículo cadastrado. As viagens usam a frota para saber quantos ônibus há em cada dia.',
      textoOk: 'Cadastrar frota',
    });
    if (ir) ctx.irPara('frota');
    return;
  }
  abrirFormulario(ctx);
});
```
  Confira a assinatura de `confirmar` em `shared/ui/confirmar.js` (retorna `Promise<boolean>`; opções
  `detalhe`, `textoOk`, `perigo`).

- [ ] **Step 5: `detalhe.js`.**
  - Import: trocar `import { saldoDoDia, faltaParaConfirmar } from '../saldo.model.js';` por
    `import { lerOcupacao, faltaParaConfirmar, intervaloDaViagem, livresPara } from '../disponibilidade.model.js';`
    e tirar `STATUS_RESERVA` do import de `sate.model.js` se ficar sem uso.
  - Abertura (linhas ~50-61): trocar `saldoDoDia(s.data).catch(() => null)` por
    `lerOcupacao(s.data, s.data, { excluir: s.id }).catch(() => null)` (variável `linha`), e o selo por:

```js
${linha ? (() => {
  const iv = intervaloDaViagem({ periodo: s.periodo, embarque: s.horario_embarque, retorno: s.horario_retorno,
    trajetoMin: s.trajeto_min, intervaloMin: linha.intervaloMin });
  return `<span class="di-meta">${Math.max(0, livresPara(linha, iv.ini, iv.fim))} ônibus livres no horário deste pedido, fora ele</span>`;
})() : ''}
```
  - `confirmar(btn)`: `const falta = faltaParaConfirmar(s, await lerOcupacao(s.data, s.data, { excluir: s.id }));`

- [ ] **Step 6: `remanejar.js`.** Import de `disponibilidade.model.js` (`lerOcupacao`, `faltaParaConfirmar`) no
  lugar de `saldo.model.js`; no bloco "a nova data comporta?":
  `const falta = faltaParaConfirmar(s, await lerOcupacao(s.data, s.data, { excluir: s.id }));`
  Atualize o comentário ("`jaReservado` porque…" → "o próprio pedido sai da conta pelo `excluir`").

- [ ] **Step 7: Apagar `saldo.model.js`** - `git rm src/modules/sate/saldo.model.js`.
  `grep -rn "saldo.model\|saldoDoDia\|livreManhaSeguinte\|jaReservado" src` → nada.
  Cabeçalho de `sate.model.js`: onde cita `saldo.model.js`, passar a citar `disponibilidade.model.js`.

- [ ] **Step 8: Verificar.** `node --test tests/` PASS; verificador sem BLOQUEIA; `wc -l src/modules/sate/views/*.js`
  (nenhuma view > 400).

- [ ] **Step 9: Commit**

```bash
git add -A src/modules/sate
git commit -m "feat(sate): formulario, confirmar e remanejar contam por horario; porta de entrada sem frota"
```

---

### Task 8: SATE sem o nome do FundHub, com ajuda própria

**Files:**
- Modify: `src/sate.js`, `sate.html`, `src/shell/chrome.js`, `src/shell/portao.js`

**Interfaces:**
- `setChrome(logado, user, perfil, opts)` aceita `opts.meusDados: () => boolean` (padrão: sempre `true`).
- `carimboRodape({ completo = true } = {})`.
- `abrirPortao(app, { …, chrome })` repassa `chrome.rodapeCompleto` para `carimboRodape`.

- [ ] **Step 1: `chrome.js`.**
  - `opcoesChrome` ganha `meusDados: () => true`. No fim de `setChrome` (depois de preencher o menu):

```js
  // "Meus dados" mora no FundHub. No SATE, só aparece para quem também usa
  // o FundHub - quem só usa o SATE não é levado a um sistema que não
  // conhece (spec 2026-09-26-sate-identidade-propria, D3).
  menu.querySelector('.um-link').hidden = !opcoesChrome.meusDados();
```
  - `carimboRodape({ completo = true } = {})`; em `cartaoHtml(c, completo)`: quando `!completo`, não
    renderizar o `<ul class="bc-resumo">` nem o link "Histórico completo" (o resumo e o link falam do
    FundHub). Passe `completo` de `carimboRodape` para onde `cartaoHtml` é chamada.
  - Atualizar o comentário do item `externo` (linhas ~94-96): tirar "o FundHub e a ajuda, vistos do SATE" → "o FundHub, visto do SATE".

- [ ] **Step 2: `portao.js`:** `carimboRodape();` → `carimboRodape({ completo: chrome.rodapeCompleto !== false });`
  e documentar `rodapeCompleto` no comentário de `chrome`.

- [ ] **Step 3: `sate.html`:**
  - `<title>SATE - Transporte extraclasse</title>`
  - rodapé: `SATE` no lugar de `SATE · FundHub` (mantém o resto: build-wrap, "· Gerência de Ensino Fundamental · SME Ribeirão Preto").
  - O comentário HTML do rodapé que fala "qual FundHub é este" → "qual versão é esta" (comentário é visível no código-fonte da página).

- [ ] **Step 4: `src/sate.js`:**

```js
import { MODULOS, moduloPorId, nivelEfetivo, veModulo } from './core/registry.js';
import { markdownParaHtml } from './modules/ajuda/markdown.js';
// …

// Usa o FundHub = enxerga ao menos um módulo de navegação que não seja o
// SATE nem um dos de serviço (`publico`). Não é controle de acesso (R6):
// decide só o que o SATE MENCIONA. Spec 2026-09-26-sate-identidade-propria, D3.
const usaFundHub = () => MODULOS.some(m =>
  m.nav && m.rota && m.id !== 'sate' && !m.publico && veModulo(m));
```
  - `gruposDoMenu()`: o item de ajuda vira rota interna e o link do FundHub fica condicional:

```js
    { rota: '#/ajuda', ico: 'ajuda', nome: 'Como usar o SATE' },
    ...(usaFundHub() ? [linkFundHub()] : []),
```
  - No ramo `nv === OCULTO` de `montarSate`: `montarNav([{ itens: usaFundHub() ? [linkFundHub()] : [] }])`.
    O texto do `emptyState` continua citando a Gerência de Ensino Fundamental - ela é a área, não o FundHub.
  - `rotear()`: antes do tratamento de `configuracoes`:

```js
  if (id === 'ajuda') {
    marcarNav('#/ajuda');
    return paginaAjuda();
  }
```
  e a função:

```js
// O tutorial do SATE, dentro do SATE. É o MESMO arquivo que a Ajuda do
// FundHub lê (docs/modulos/sate.md), pelo mesmo leitor - um texto só,
// dois lugares de leitura (spec 2026-09-26-sate-identidade-propria, D1).
async function paginaAjuda() {
  app.innerHTML = `
    <div class="page-head"><h1>Como usar o SATE</h1></div>
    <article class="ajuda-doc" id="ajuda-doc">${loading()}</article>`;
  const box = document.getElementById('ajuda-doc');
  try {
    const resp = await fetch('docs/modulos/sate.md', { cache: 'no-cache' });
    if (!resp.ok) throw new Error('nao encontrado');
    const html = markdownParaHtml(await resp.text());
    if (document.getElementById('ajuda-doc')) box.innerHTML = html;
  } catch {
    box.innerHTML = emptyState(ico('documento', { tam: 32 }), 'Tutorial ainda não disponível',
      'O texto de ajuda ainda não foi publicado.');
  }
  window.scrollTo(0, 0);
}
```
  - `abrirPortao(...)`: `chrome: { base: './', aoAtualizar: () => rotear(), meusDados: usaFundHub, rodapeCompleto: false }`.
  - Atualizar o cabeçalho de `sate.js` (o parágrafo "Quem entra num entra no outro" continua verdadeiro; acrescente uma linha sobre o link condicional e a ajuda interna).

- [ ] **Step 5: Verificar** em dev-local (procedimento na memória do projeto: `fundhub-teste-devlocal`):
  abrir `sate.html`, ir a "Como usar o SATE" → abre dentro do SATE. Forçar `usaFundHub` a `false`
  temporariamente e conferir, pelo `get_page_text` do navegador, que "FundHub" não aparece em lugar
  nenhum da página (inclusive o cartão de versão ao passar o mouse). **Reverter os patches de dev-local.**

- [ ] **Step 6: Commit**

```bash
git add src/sate.js sate.html src/shell/chrome.js src/shell/portao.js
git commit -m "feat(sate): ajuda dentro do SATE e nenhuma mencao ao FundHub para quem so usa o SATE"
```

---

### Task 9: Tutorial do SATE

**Files:**
- Modify: `docs/modulos/sate.md`

Use o skill `atualizar-ajuda`. O texto é escrito para **quem usa**, sem nome de arquivo, tabela ou função.

- [ ] **Step 1: Neutralizar (spec A, D2).** Nenhuma ocorrência de "FundHub". Reescrever "Onde fica o SATE":
  o SATE tem página própria, com menu; a tabela de páginas passa a ser:

| Página | Para quem |
|---|---|
| **Solicitações** | todos |
| **Disponibilidade** | todos |
| **Fichas de ônibus**, **Frota**, **Locais**, **Configurações** | quem aprova |
| **Catálogo** | todos |

  "**Como usar o SATE** abre este tutorial." (sem "Ir para o FundHub", sem "a conta é a mesma…").

- [ ] **Step 2: Regras novas (spec B).**
  - Substituir a seção "As duas regras de agendamento" por **"A regra de agendamento"**: a regra única
    de ocupação por horário, com as duas consequências (manhã → tarde; noite ocupa a manhã seguinte),
    um exemplo numérico (ônibus volta às 11h, trajeto 30 min, intervalo 2h → livre às 13h30) e a frase
    "pedido **solicitado** já reserva a vaga; negar ou cancelar devolve".
  - "Regras que o sistema aplica": **bloqueia** - dia sem frota (para todos), falta de ônibus no horário
    (escola), horários de embarque e retorno em branco; **avisa** - falta de ônibus (quem aprova), sem van.
    Tirar "Intervalo entre períodos apertado" dos avisos (virou parte da regra).
  - "Passo a passo": novo **"Consultar a disponibilidade"**; novo **"Cadastrar a frota"** (Nova frota,
    rótulo, tipo, veículos, início, fim vazio = em aberto; editar, excluir; Rótulos); **"Pedir transporte"**
    com horários obrigatórios e a mensagem do próximo horário; quem aprova num dia sem frota: o cadastro
    rápido na linha do saldo; primeira viagem sem frota nenhuma: o aviso que leva à página Frota.
  - "Como a frota funciona": uma frota **em aberto por rótulo e tipo**; frotas de rótulos diferentes
    somam; a extra de pedido da noite vale até o dia seguinte.
  - "Perguntas frequentes": revisar "Pedi e o sistema disse que não há ônibus" (agora pode ser o horário:
    tente o horário sugerido) e "O saldo que eu vejo conta os pedidos das outras escolas?".
  - Carimbo final: `> Atualizado na versão 0.37.0.`

- [ ] **Step 3: Commit**

```bash
git add docs/modulos/sate.md
git commit -m "docs(sate): tutorial neutro, frota, disponibilidade e a regra por horario"
```

---

### Task 10: Configurações em cartões

**Files:**
- Modify: `src/modules/configuracoes/configuracoes.css`, `src/modules/configuracoes/painel.js`

- [ ] **Step 1: `painel.js`** - no `return` de item de controle simples (o último de `itemHtml`),
  `<div class="cfg-item">` → `<div class="cfg-item cfg-simples">`. O item de painel continua só `cfg-item`.

- [ ] **Step 2: `configuracoes.css`** - substituir as regras de `.cfg-form > .form-grupo`, `.cfg-item`,
  `.cfg-item > .switch` e `.cfg-mod*` por:

```css
/* ── Cada grupo é um cartão (spec 2026-09-26-configuracoes-em-blocos) ──
   Antes os grupos se separavam só por uma legenda e um traço fino, e com
   oito itens não se via onde um terminava. O cartão dá a fronteira; a
   legenda vira o cabeçalho dele. */
.cfg-form > .form-grupo {
  margin: 0; padding: 0; overflow: hidden;
  border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface);
}
/* O traço entre grupos do .form-grupo comum sobra: o cartão já separa. */
.cfg-form > .form-grupo + .form-grupo { border-top: 1px solid var(--border); padding-top: 0; }
.cfg-form > .form-grupo > legend {
  float: left; width: 100%; margin: 0; padding: 10px 16px;
  background: var(--surface-2); border-bottom: 1px solid var(--border);
}
/* `float` tira a legend da borda do fieldset (senão ela "morde" a borda
   de cima); o primeiro item limpa o float. */
.cfg-form > .form-grupo > legend + * { clear: both; }

/* ── Cada item é uma linha de ajuste ─────────────────────── */
.cfg-item { display: flex; flex-direction: column; gap: 5px; padding: 12px 16px; margin: 0; }
.cfg-item + .cfg-item { border-top: 1px solid var(--border); }
.cfg-item > .switch { min-height: var(--campo); }
/* Tela larga: rótulo e dica à esquerda, controle à direita - o padrão
   das telas de ajustes. Lê-se a coluna de rótulos de cima a baixo e o
   valor está sempre no mesmo lugar. O item de PAINEL (lista, ordenação)
   continua empilhado: ele é largo por natureza. */
@media (min-width: 720px) {
  .cfg-item.cfg-simples {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 24px; align-items: center;
  }
  .cfg-item.cfg-simples > .lbl { grid-column: 1; }
  .cfg-item.cfg-simples > :not(.lbl):not(.form-hint) { grid-column: 2; grid-row: 1; justify-self: end; }
  .cfg-item.cfg-simples > .form-hint { grid-column: 1 / -1; }
}

/* ── Tela agregadora: um bloco por módulo ────────────────── */
.cfg-mod + .cfg-mod { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border); }
.cfg-mod-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.cfg-mod-head h2 { font-size: 15px; margin: 0; }
```
  Mantenha as regras de `.cfg-dica`, `.cfg-rede`, `.cfg-item input[type="number"]` e dos painéis de
  módulo (`.cfg-locais`, `.cfg-paineis`, `.cfg-cob-*`) como estão. Atualize o comentário de cabeçalho
  do arquivo.

- [ ] **Step 3: Verificar no navegador** (dev-local): engrenagem de Horários, de Escolas, do SATE, e a
  página Configurações, em 360px, 768px e 1280px, tema claro e escuro (`resize_window` com `colorScheme`).
  Conferir: legenda dentro do cartão sem cortar a borda; switch alinhado à direita no desktop; em 360px
  tudo empilhado sem rolagem lateral. Se o `float` da legend der problema em algum navegador, a alternativa
  é `display: contents` no fieldset + um `<div class="cfg-grupo">` - mas só se o `float` falhar na medição.

- [ ] **Step 4: Commit**

```bash
git add src/modules/configuracoes/configuracoes.css src/modules/configuracoes/painel.js
git commit -m "style(configuracoes): grupos em cartoes e itens como linhas de ajuste"
```

---

### Task 11: Usuários - migration 043, nome em caixa alta e ajustes do formulário

**Files:**
- Create: `supabase/migrations/043_usuarios_nome_e_equipe_sme.sql`
- Modify: `src/modules/usuarios/usuarios.view.js`, `src/modules/usuarios/usuarios.css`, `src/modules/meus-dados/meus-dados.view.js`

- [ ] **Step 1: Migration**

```sql
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
```

- [ ] **Step 2: Permissões por módulo (spec D, D2)** em `usuarios.view.js`, na montagem das opções:
  `Padrão do papel (${esc(rotulaNivel(herdado))})` → `Padrão: ${esc(rotulaNivel(herdado))}`.
  Em `usuarios.css`:

```css
.perm-nome { font-size: 13px; font-weight: 500; text-transform: none; letter-spacing: 0; min-width: 0; }
/* Fonte menor que a do campo comum: a lista é densa, e a opção herdada
   ("Padrão: Leitura") precisa caber sem cortar. */
.perm-sel { flex: 0 0 auto; width: 13.5em; max-width: 60%; font-size: 13px; }
```

- [ ] **Step 3: Nome em caixa alta na tela (D3).** Em `usuarios.view.js`:
  `<input id="f-nome" …>` ganha `class="caixa-alta"` e, em `salvar`, `nome: (val('f-nome') || '').toUpperCase() || null`.
  Em `meus-dados.view.js`, o campo de nome de exibição ganha a mesma classe e o valor salvo vai com
  `.toUpperCase()` (localize o input e a chamada a `salvarMeuNome`). Em `components.css`, junto do bloco de
  formulário (não é de módulo: dois módulos usam):

```css
/* Campo cujo valor é gravado em maiúsculas (o banco garante): o que se vê
   ao digitar é o que se grava. */
input.caixa-alta { text-transform: uppercase; }
```

- [ ] **Step 4: Switch alinhado com a caixa do Papel (D4).** Em `usuarios.css`, depois das regras de `.acesso-row`:

```css
/* O trilho alinha com a CAIXA do select, não com o rótulo: o container
   alinha pela base (acima) e o switch assume a altura do campo, então a
   base dele é a base da caixa. */
.acesso-row > .switch { min-height: var(--campo); align-self: end; }
```
  Medir no navegador (dev-local, modal Editar acesso, ≥ 560px): o centro vertical do trilho deve ficar a
  ±2px do centro vertical do `<select id="f-papel">` (`getBoundingClientRect`). Se não ficar, ajustar por
  medição, não por dedução (memória `fundhub-teste-devlocal`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/043_usuarios_nome_e_equipe_sme.sql src/modules/usuarios src/modules/meus-dados src/styles/components.css
git commit -m "feat(usuarios): nome em caixa alta, Equipe SME leitora, campo de permissao e switch alinhados"
```

---

### Task 12: Tabela de papéis viva na Ajuda

**Files:**
- Modify: `src/modules/ajuda/markdown.js`, `src/modules/ajuda/ajuda.view.js`, `src/modules/ajuda/ajuda.css`
- Modify: `docs/modulos/usuarios.md`
- Modify: `.claude/scripts/verificar_arquitetura.py`, `.claude/rules/documentacao.md`
- Test: `tests/markdown.test.mjs`

**Interfaces:**
- `markdownParaHtml` passa a emitir `<div class="md-vivo" data-vivo="<id>"></div>` para uma cerca ```` ```vivo ```` cujo corpo é um id `[a-z0-9-]+`.
- `ajuda.view.js`: `const VIVOS = { 'permissoes-padrao': pintarPermissoes }` - exportar `VIVOS_CONHECIDOS = Object.keys(VIVOS)`? **Não**: o verificador lê o arquivo como texto (regex `'([a-z0-9-]+)':\s*pintar`), sem importar JS.

- [ ] **Step 1: Teste que falha** - acrescentar em `tests/markdown.test.mjs`:

```js
test('cerca vivo vira um bloco a preencher pela tela', () => {
  const h = markdownParaHtml('antes\n\n```vivo\npermissoes-padrao\n```\n\ndepois');
  assert.match(h, /<div class="md-vivo" data-vivo="permissoes-padrao"><\/div>/);
  assert.ok(!h.includes('<pre>'));
});

test('cerca vivo com id inválido continua sendo código', () => {
  const h = markdownParaHtml('```vivo\n<script>x</script>\n```');
  assert.ok(!h.includes('md-vivo'));
  assert.ok(h.includes('&lt;script&gt;'));
});
```

- [ ] **Step 2:** `node --test tests/markdown.test.mjs` → FAIL.

- [ ] **Step 3: `markdown.js`** - no bloco de código cercado:

```js
    // Bloco de código cercado. ```vivo com um id é um BLOCO VIVO: a tela o
    // preenche com dado do banco (ajuda.view.js § VIVOS). Id fora de
    // [a-z0-9-] continua código - nada vindo do texto vira atributo sem
    // passar por aqui.
    if (l.trimStart().startsWith('```')) {
      const info = l.trim().slice(3).trim();
      const corpo = [];
      i++;
      while (i < linhas.length && !linhas[i].trimStart().startsWith('```')) {
        corpo.push(linhas[i]); i++;
      }
      i++; // pula o fechamento
      const id = corpo.join('').trim();
      if (info === 'vivo' && /^[a-z0-9-]+$/.test(id)) out.push(`<div class="md-vivo" data-vivo="${id}"></div>`);
      else out.push(`<pre><code>${corpo.join('\n')}\n</code></pre>`);
      continue;
    }
```
  Atualizar o cabeçalho do arquivo ("Suportado: … ``` cerca (e ```vivo, bloco preenchido pela tela) …").

- [ ] **Step 4:** `node --test tests/markdown.test.mjs` → PASS.

- [ ] **Step 5: `ajuda.view.js`** - preencher os blocos depois de renderizar o tutorial:

```js
import { getMatrizDePermissoes } from '../usuarios/usuarios.model.js';
import { rotulaNivel, OCULTO } from '../../core/permissoes.js';
import { montarTabela } from '../../shared/ui/tabela.js';
import { erroBox } from '../../shared/ui/feedback.js';

// ── Blocos vivos ─────────────────────────────────────────────
// Um tutorial pede dado do banco com ```vivo + id (markdown.js). Assim a
// tabela de papéis na Ajuda de Usuários nunca envelhece: ela É o banco.
// O verificador (checagem 11d) bloqueia id desconhecido e a remoção do
// bloco de permissões.
//
// O desenho da matriz é o mesmo da Documentação técnica (docs.view.js).
// São dois usos, então cada view tem o seu - a terceira cópia extrai (R13).
const VIVOS = {
  'permissoes-padrao': pintarPermissoes,
};

async function preencherVivos(box) {
  for (const el of box.querySelectorAll('.md-vivo')) {
    const fn = VIVOS[el.dataset.vivo];
    if (!fn) { el.innerHTML = '<p class="vazio">Conteúdo indisponível.</p>'; continue; }
    try { await fn(el); } catch (err) { el.innerHTML = erroBox(err); }
  }
}

async function pintarPermissoes(el) {
  const matriz = await getMatrizDePermissoes();
  const celula = (x) => {
    const txt = esc(rotulaNivel(x.nivel)) + (x.implicito ? '*' : '');
    return x.nivel === OCULTO ? `<span class="vazio">${txt}</span>` : `<b>${txt}</b>`;
  };
  montarTabela(el, {
    colunas: [
      { id: 'modulo', rotulo: 'Módulo', prioridade: 1, tipo: 'texto', valor: l => l.nome },
      ...matriz.papeis.map((p, i) => ({
        id: p.chave, rotulo: p.rotulo, prioridade: i < 2 ? 1 : (i < 4 ? 2 : 3),
        valor: l => rotulaNivel(l.niveis[p.chave].nivel), celula: l => celula(l.niveis[p.chave]),
      })),
    ],
    linhas: matriz.linhas,
    chave: l => l.id,
    buscarEm: ['modulo'],
    ordem: { coluna: 'modulo', dir: 'asc' },
    porPagina: 100,
    substantivo: 'módulos',
    vazio: { ico: 'acesso', titulo: 'Sem módulos', texto: 'Nenhum módulo ativo.' },
  });
}
```
  Em `pintarTutorial`, depois de `box.innerHTML = markdownParaHtml(...)`: `await preencherVivos(box);`
  (dentro do `try`, mas com o próprio try/catch de cada bloco - uma falha na tabela não esconde o texto).
  Confira os nomes exportados em `core/permissoes.js` (`rotulaNivel`, `OCULTO`) e ajuste os imports já existentes
  (`erroBox` pode já vir de `feedback.js` junto de `loading`/`emptyState`).
  Em `ajuda.css`: `.ajuda-doc .md-vivo { margin: 12px 0 16px; }`.

- [ ] **Step 6: `docs/modulos/usuarios.md`** - leia o arquivo e acrescente (antes de "Regras que o sistema aplica",
  ou onde os papéis são explicados) a seção:

````markdown
### Papéis e níveis padrão

O que cada papel enxerga **antes** de qualquer exceção individual. A tabela
é montada na hora a partir do sistema - quando um padrão muda, ela muda junto.

```vivo
permissoes-padrao
```

\* Nível implícito: o administrador tem escrita em tudo, inclusive em
módulos novos; os módulos de serviço (Ajuda, Configurações, Meus dados)
são de leitura para todos.
````
  Se o arquivo já tiver uma tabela de papéis escrita à mão, **substitua-a** pelo bloco (duas fontes é o que a spec elimina).
  Mencione também, em "Passo a passo", que o nome de exibição é gravado em MAIÚSCULAS, e atualize o carimbo para 0.37.0.

- [ ] **Step 7: Verificador (checagem 11d)** em `check_documentacao()`, no fim:

```python
    # 11d. Blocos vivos: todo ```vivo usado num tutorial precisa de um
    # preenchedor em ajuda.view.js, e a Ajuda de Usuarios precisa manter a
    # tabela de papeis viva - a copia estatica era o que envelhecia.
    ajuda_view = os.path.join(SRC, 'modules', 'ajuda', 'ajuda.view.js')
    conhecidos = set(re.findall(r"'([a-z0-9-]+)':\s*pintar", ler(ajuda_view))) \
        if os.path.isfile(ajuda_view) else set()
    if os.path.isdir(docs_dir):
        for f in sorted(os.listdir(docs_dir)):
            if not f.endswith('.md'):
                continue
            caminho = os.path.join(docs_dir, f)
            usados = re.findall(r'```vivo\s*\n\s*([^\n`]+?)\s*\n\s*```', ler(caminho))
            for vid in usados:
                if vid not in conhecidos:
                    add('BLOQUEIA', 11, caminho, 0,
                        'bloco vivo "%s" sem preenchedor em ajuda.view.js (VIVOS)' % vid)
    usuarios_md = os.path.join(docs_dir, 'usuarios.md')
    if os.path.isfile(usuarios_md) and not re.search(
            r'```vivo\s*\n\s*permissoes-padrao\s*\n\s*```', ler(usuarios_md)):
        add('BLOQUEIA', 11, usuarios_md, 0,
            'a Ajuda de Usuarios perdeu o bloco vivo "permissoes-padrao" - a tabela de papeis '
            'precisa vir do banco, nao de texto')
```
  Atualize a docstring/`TITULOS[11]` se ela enumerar os itens a-c.

- [ ] **Step 8: `.claude/rules/documentacao.md`** - na lista do subconjunto suportado, acrescentar
  "```` ```vivo ```` + id (bloco preenchido pela tela com dado do banco - hoje só `permissoes-padrao`)"
  e na tabela da checagem 11 a linha **d**: "bloco vivo sem preenchedor, ou `usuarios.md` sem `permissoes-padrao` | bloqueia".

- [ ] **Step 9: Verificar:** `node --test tests/`, `python .claude/scripts/verificar_arquitetura.py` (sem BLOQUEIA).
  Teste negativo rápido: apagar o bloco de `usuarios.md` localmente → o verificador BLOQUEIA → restaurar.

- [ ] **Step 10: Commit**

```bash
git add src/modules/ajuda docs/modulos/usuarios.md .claude/scripts/verificar_arquitetura.py .claude/rules/documentacao.md tests/markdown.test.mjs
git commit -m "feat(ajuda): tabela de papeis viva na Ajuda de Usuarios, guardada pelo verificador"
```

---

### Task 13: Versão, changelog, verificação final e publicação

**Files:**
- Modify: `src/core/config.js` (`versao: '0.37.0'`), `CHANGELOG.md`

- [ ] **Step 1: Versão** `0.36.0` → `0.37.0` em `src/core/config.js`.

- [ ] **Step 2: CHANGELOG** - nova entrada no topo, **para quem usa** (sem jargão, sem nome de arquivo):

```markdown
## [0.37.0] - 2026-09-26

> **Exige rodar as migrations `042` e `043`**, nesta ordem. Sem a 042, a
> contagem de ônibus do SATE continua por período e a escola não é barrada
> no servidor; sem a 043, os nomes não viram maiúsculas e a Equipe SME
> segue com os acessos antigos.

### Adicionado

- **SATE - página Frota** com todas as frotas cadastradas: filtros por
  situação (vigentes, futuras, encerradas), tipo e período; cadastrar,
  editar e excluir; rótulos num só lugar.
- **SATE - página Disponibilidade**, para todos: uma semana por vez, com
  os ônibus livres de manhã, à tarde (e a partir de que horário) e à noite.
- **SATE - ajuda dentro do SATE**: "Como usar o SATE" abre o tutorial sem
  sair da página.
- Frotas de origens diferentes podem valer ao mesmo tempo, cada uma com
  seu rótulo, e somam.

### Mudado

- **SATE - a vaga passa a ser contada pelo horário.** Um ônibus fica
  ocupado do embarque até voltar, mais o intervalo mínimo; o da noite, até
  o meio-dia seguinte. O pedido mostra quantos ônibus estão livres no
  horário escolhido e, se faltar, a partir de que horário há vaga.
- **SATE - pedido enviado já reserva a vaga**, e duas escolas não
  conseguem mais pedir o mesmo último ônibus ao mesmo tempo.
- **SATE - horários de embarque e retorno passam a ser obrigatórios.**
- **SATE - viagem só com frota cadastrada.** Num dia sem frota, quem
  aprova cadastra ali mesmo, no pedido.
- **Configurações** com cada grupo num cartão e cada ajuste numa linha.
- **Usuários**: nomes de exibição sempre em maiúsculas; a Ajuda mostra a
  tabela de papéis e acessos padrão sempre atualizada.
- **Equipe SME** passa a ter só leitura em SATE, Viagens, Afastamentos,
  Projetos, Ocorrências, Atas e Visitas.

### Corrigido

- O texto das opções de permissão por módulo não cabia no campo.
- A chave "Acesso ativo" ficava desalinhada da caixa do papel.
- Um ônibus reservado para a noite podia ser pedido de novo para a manhã
  seguinte.
- O cadastro da frota ficava escondido nas configurações do SATE.
```

- [ ] **Step 3: Verificação completa**

```bash
node --test tests/
python .claude/scripts/verificar_arquitetura.py
git diff main --stat
```
Expected: todos os testes PASS; verificador sem BLOQUEIA (avisos de tutorial podem restar apenas se
explicados). Varredura de dado real: `git diff main -- . ':(exclude)_private' | grep -iE "@educacao|\(1[0-9]\)|[0-9]{3}\.[0-9]{3}\.[0-9]{3}"` → nada.

- [ ] **Step 4: Teste no navegador (dev-local)** - procedimento da memória `fundhub-teste-devlocal`:
  patch temporário em `config.js` (chave vazia) e `perfil.js` (admin + mapa `escrita`), fixture de
  ocupação: no ramo dev-local de `lerOcupacao` (`if (!hasSupabase()) return montarLinha(window.__fixtureOcupacao || null);`
  **temporário**). Conferir:
  - `sate.html#/frota`: filtros e tabela (fixture em `getFrotas`, também temporária);
  - `sate.html#/disponibilidade`: escada da tarde com a fixture `{ intervalo_min:120, frota:[{dia:0,onibus:9,vans:0},…], ocupacoes:[{dia:0,ini:420,fim:850,onibus:6,vans:0}] }`;
  - formulário: 13:00 bloqueia (como escola: `aprovador:false` no ctx), 14:10 libera;
  - `#/ajuda` do SATE; Configurações do FundHub em 360/768/1280, claro/escuro;
  - modal Editar acesso: fonte do select e alinhamento do switch;
  - console sem erro.
  **Reverter todos os patches e fixtures** e conferir `git status` limpo além do que é da entrega:
  `grep -rn "__fixture\|dev@local" src index.html sate.html` → só `docs.content.js`.

- [ ] **Step 5: Commit e publicação**

```bash
git add src/core/config.js CHANGELOG.md
git commit -m "chore: versao 0.37.0"
git push origin dev
```
Publica em `https://andregvg.github.io/fundhub/dev/` (workflow `pages.yml`). Aguardar o workflow e abrir
`/fundhub/dev/sate.html` para conferir que carrega (antes das migrations, a Disponibilidade mostra o aviso
de "contagem sem horário" - esperado).
