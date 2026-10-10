# Notificações do SATE - Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O aviso do SATE passa a existir no banco: fica no sino até a pessoa abrir a solicitação, não avisa quem fez a ação, e cada público escolhe o que quer receber.

**Architecture:** Duas tabelas - `solicitacao_aviso` (um fato por linha, escrito só por gatilho) e `solicitacao_visto` (quando cada pessoa abriu cada solicitação). Quem recebe não é gravado: recebe quem enxerga a solicitação (RLS), menos o autor. No front, `sate/avisos.model.js` lê, filtra (funções puras) e marca visto; `notificacoes.service.js` troca a interpretação de linha crua do Realtime por esse model.

**Tech Stack:** JS ES modules sem build, Supabase (Postgres, PostgREST, Realtime), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-10-sate-notificacoes-design.md`

## Global Constraints

- Sem npm, sem dependência nova.
- Kernel (`src/core`, `src/shared`) nunca importa `src/modules` (R1). View nunca chama `sb()`; model nunca toca no DOM (R3). Só `*.model.js` atravessa a fronteira de um módulo (R2). Zero ciclos (R4).
- Todo valor do banco passa por `esc()` antes de entrar em template literal, inclusive em atributo (R5).
- Nenhuma cor literal em `src/modules/**` (R9).
- Timestamp só é exibido por `fmtDataHora`; nenhum módulo chama `toISOString`/`toLocale*` (R8).
- **RLS default-deny; nenhuma policy concede acesso a `anon`.** Ninguém escreve em `solicitacao_aviso` a não ser o gatilho.
- **O aviso nunca impede a ação:** a inserção do aviso fica em bloco protegido dentro do gatilho.
- **Repositório público:** nenhum dado real em código, comentário, teste, migration ou doc. E-mail de exemplo: `nome@exemplo.com`.
- Migration idempotente (`if not exists`, `drop … if exists`), terminando com `select religar_auditoria();` e `select registrar_migration(...)`.
- PT-BR em código, comentário e commit. Commits na `dev`, com a linha final `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Limites: view ≤ 400 linhas, model ≤ 250.
- A cada tarefa: `node --test "tests/*.test.mjs"` (todos passam) e `python .claude/scripts/verificar_arquitetura.py` (0 bloqueantes).
- **Não** subir versão nem mexer no CHANGELOG antes da Task 4.

## Review Focus

1. Banco sem a migration 048 → o sino do SATE fica vazio, sem erro no console além de um aviso, e o resto do app funciona.
2. A própria pessoa age (nega, edita, acrescenta parada) → nenhum aviso para ela, nem balão nem sino.
3. Aviso chega pelo Realtime de uma solicitação que a pessoa não enxerga → o RLS não o entrega; se a busca do aviso voltar vazia, nada acontece.
4. A mesma solicitação aberta em outra aba → ao voltar para esta aba, o sino se atualiza.
5. `?abrir=<id>` de uma solicitação fora do período filtrado, ou que não existe mais → abre buscando pelo id; se não achar, avisa e segue.

---

### Task 1: Migration 048 - avisos e vistos

**Files:**
- Create: `supabase/migrations/048_sate_avisos.sql`
- Modify: `.claude/scripts/verificar_arquitetura.py` (`ISENTAS_AUDITORIA`)

**Interfaces:**
- Produces (banco): tabela `solicitacao_aviso(id, solicitacao_id, tipo, unidade_id, autor, em)`; tabela `solicitacao_visto(email, solicitacao_id, visto_em)`; função `marcar_solicitacao_vista(p_solicitacao uuid) returns timestamptz`.

- [ ] **Step 1: Criar `supabase/migrations/048_sate_avisos.sql`:**

```sql
-- ============================================================
-- 048 - SATE: avisos que ficam ate serem abertos
--
-- Spec: 2026-10-10-sate-notificacoes-design.md.
--
-- Ate aqui o aviso do sino era um eco do Realtime: nascia no navegador de
-- quem estava online, a partir da linha crua que mudou, e morria ao
-- recarregar. Para "ficar ate ser aberto" ele precisa existir no banco, e
-- para "nao avisar quem fez" o banco precisa saber QUEM fez.
--
-- Duas coisas guardadas, e so duas:
--   solicitacao_aviso  o FATO ("aconteceu X na solicitacao Y, feito por Z").
--                      Um por fato, nao um por destinatario. So gatilho
--                      escreve: ninguem forja aviso.
--   solicitacao_visto  quando cada pessoa ABRIU cada solicitacao. Nao lido =
--                      aviso mais novo que o visto dela naquela solicitacao.
--
-- QUEM RECEBE nao e gravado: recebe quem pode ver a solicitacao (o RLS
-- decide na leitura), menos quem fez. Sem lista de destinatarios para
-- manter, e mudar a permissao de alguem vale no mesmo instante.
--
-- O aviso NUNCA impede a acao: a insercao fica num bloco protegido. Se
-- falhar, a decisao e gravada do mesmo jeito e o banco registra um alerta.
--
-- Idempotente.
-- ============================================================

-- ── 1. O fato ────────────────────────────────────────────────
create table if not exists solicitacao_aviso (
  id             bigint generated always as identity primary key,
  solicitacao_id uuid not null references solicitacao_transporte(id) on delete cascade,
  tipo           text not null,
  unidade_id     uuid references unidade_escolar(id) on delete set null,  -- a escola da parada, nos avisos de parada
  autor          text,                                                    -- auth_email() de quem fez
  em             timestamptz not null default now()
);
create index if not exists idx_solic_aviso_em    on solicitacao_aviso(em desc);
create index if not exists idx_solic_aviso_solic on solicitacao_aviso(solicitacao_id);

-- Lista FECHADA de tipos. Os sete status entram todos (inclusive
-- `solicitado`, que hoje nenhuma transicao produz) para que um status
-- gravado por qualquer via nunca caia fora da lista.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solic_aviso_tipo_check') then
    alter table solicitacao_aviso add constraint solic_aviso_tipo_check
      check (tipo in ('nova', 'solicitado', 'em_analise', 'aguardando_transporte_adaptado',
                      'confirmado', 'negado', 'cancelado', 'pendente_cancelamento',
                      'reaberta', 'editada',
                      'parada_acrescentada', 'saida_pedida', 'saida_confirmada'));
  end if;
end $$;

-- RLS habilitado mas NAO forcado, como em audit_log (011): o gatilho e
-- SECURITY DEFINER e roda como dono da tabela, que e isento - o insert do
-- gatilho passa e o usuario comum nao escreve. Le quem enxerga a
-- solicitacao: a subconsulta passa pelo RLS da propria solicitacao.
alter table solicitacao_aviso enable row level security;
drop policy if exists solic_aviso_sel on solicitacao_aviso;
create policy solic_aviso_sel on solicitacao_aviso for select
  using (exists (select 1 from solicitacao_transporte s where s.id = solicitacao_id));
grant select on solicitacao_aviso to authenticated;   -- sem insert/update/delete de proposito

-- ── 2. O visto ───────────────────────────────────────────────
create table if not exists solicitacao_visto (
  email          text not null,
  solicitacao_id uuid not null references solicitacao_transporte(id) on delete cascade,
  visto_em       timestamptz not null default now(),
  primary key (email, solicitacao_id)
);

alter table solicitacao_visto enable row level security;
alter table solicitacao_visto force  row level security;
drop policy if exists solic_visto_sel on solicitacao_visto;
drop policy if exists solic_visto_ins on solicitacao_visto;
drop policy if exists solic_visto_upd on solicitacao_visto;
create policy solic_visto_sel on solicitacao_visto for select using (email = auth_email());
create policy solic_visto_ins on solicitacao_visto for insert with check (email = auth_email());
create policy solic_visto_upd on solicitacao_visto for update using (email = auth_email())
  with check (email = auth_email());
grant select, insert, update on solicitacao_visto to authenticated;

-- A hora do visto e a do BANCO, nao a do navegador: o aviso e carimbado
-- com now() pelo gatilho, e comparar com um relogio de cliente adiantado
-- ou atrasado marcaria como lido o que nao foi (ou o contrario). Sem
-- `security definer`: passa pelas policies acima, e so grava a propria linha.
create or replace function marcar_solicitacao_vista(p_solicitacao uuid) returns timestamptz
  language sql volatile set search_path = public as $$
    insert into solicitacao_visto (email, solicitacao_id, visto_em)
    values (auth_email(), p_solicitacao, now())
    on conflict (email, solicitacao_id) do update set visto_em = excluded.visto_em
    returning visto_em
  $$;
grant execute on function marcar_solicitacao_vista(uuid) to authenticated;

-- ── 3. Os gatilhos que registram o fato ──────────────────────
-- Funcao de gatilho nao pode ser chamada por RPC: o unico caminho para uma
-- linha de aviso e uma mudanca REAL na solicitacao ou na participacao.
--
-- O que NAO gera aviso, de proposito:
--   - o recalculo dos totais do cabecalho (cache das participacoes, 037);
--   - a troca de destino ao conferir um local (para a escola, o lugar e o mesmo);
--   - turma, responsavel, observacao.
create or replace function fn_sate_aviso_solic() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_tipo text;
begin
  if tg_op = 'INSERT' then
    v_tipo := 'nova';
  elsif new.status is distinct from old.status then
    v_tipo := case when new.status = 'em_analise' and old.status in ('confirmado', 'negado', 'cancelado')
                   then 'reaberta' else new.status end;
  elsif (new.data, new.horario_embarque, new.horario_retorno)
        is distinct from (old.data, old.horario_embarque, old.horario_retorno) then
    v_tipo := 'editada';
  end if;

  if v_tipo is not null then
    begin
      insert into solicitacao_aviso (solicitacao_id, tipo, autor)
      values (new.id, v_tipo, auth_email());
    exception when others then
      raise warning 'SATE: aviso "%" nao registrado: %', v_tipo, sqlerrm;
    end;
  end if;
  return null;
end $$;

drop trigger if exists trg_sate_aviso_solic on solicitacao_transporte;
create trigger trg_sate_aviso_solic
  after insert or update on solicitacao_transporte
  for each row execute function fn_sate_aviso_solic();

-- A primeira participacao nasce junto com a viagem (criar_viagem acende a
-- marca de transacao `sate.criar_viagem`): o aviso `nova` ja diz tudo, e
-- um `parada_acrescentada` a mais seria ruido.
create or replace function fn_sate_aviso_part() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_tipo text;
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('sate.criar_viagem', true), '') <> '1' then
      v_tipo := 'parada_acrescentada';
    end if;
  elsif new.status is distinct from old.status then
    v_tipo := case new.status when 'pendente_cancelamento' then 'saida_pedida'
                              when 'cancelada'             then 'saida_confirmada' end;
  end if;

  if v_tipo is not null then
    begin
      insert into solicitacao_aviso (solicitacao_id, tipo, unidade_id, autor)
      values (new.solicitacao_id, v_tipo, new.unidade_id, auth_email());
    exception when others then
      raise warning 'SATE: aviso "%" nao registrado: %', v_tipo, sqlerrm;
    end;
  end if;
  return null;
end $$;

drop trigger if exists trg_sate_aviso_part on solicitacao_participacao;
create trigger trg_sate_aviso_part
  after insert or update on solicitacao_participacao
  for each row execute function fn_sate_aviso_part();

-- ── 4. Realtime ──────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'solicitacao_aviso'
  ) then
    alter publication supabase_realtime add table solicitacao_aviso;
  end if;
end $$;

-- ── 5. Auditoria: as duas tabelas ficam de fora ──────────────
-- Espelhada em ISENTAS_AUDITORIA (.claude/scripts/verificar_arquitetura.py).
create or replace function _audit_isentas() returns text[]
  language sql immutable as $$ select array[
    'audit_log',            -- auditar o log e recursao sem valor
    'evento_log',           -- idem
    'preferencia_usuario',  -- preferencia pessoal de tela; ruido puro
    'schema_migrations',    -- metadado de infraestrutura, nao cadastro
    'solicitacao_aviso',    -- log de um fato ja auditado na origem (a solicitacao)
    'solicitacao_visto'     -- estado pessoal de leitura; ruido puro
  ] $$;

-- religar_auditoria() so CRIA o gatilho nas nao isentas; se uma execucao
-- anterior ja o tiver posto nestas duas, sai aqui.
drop trigger if exists trg_audit on solicitacao_aviso;
drop trigger if exists trg_audit on solicitacao_visto;

select religar_auditoria();

select registrar_migration('048',
  'SATE: avisos persistentes (solicitacao_aviso por gatilho) e leitura por pessoa (solicitacao_visto)');

-- ── Conferencia (rodar a mao, se quiser) ─────────────────────
-- Pelo APP (precisa do login - no SQL Editor auth_email() e nulo): crie um
-- pedido de teste, negue, reabra e mude a data. Depois, aqui:
--   select tipo, autor is not null as tem_autor, em
--     from solicitacao_aviso order by em desc limit 10;
-- Esperado, do mais novo para o mais antigo: editada, reaberta, negado, nova.
```

- [ ] **Step 2: `.claude/scripts/verificar_arquitetura.py`** - em `ISENTAS_AUDITORIA`, depois de `'schema_migrations'`:

```python
    'solicitacao_aviso',    # log de um fato ja auditado na origem (a solicitacao)
    'solicitacao_visto',    # estado pessoal de leitura; ruido puro
```

- [ ] **Step 3:** `python .claude/scripts/verificar_arquitetura.py` → 0 bloqueantes (checagem 13: as duas listas concordam). Conferir com `grep -n "auth_email\|registrar_migration\|religar_auditoria" supabase/migrations/0[0-3]*.sql | head` que as três funções usadas existem em migrations anteriores, e com `grep -n "create table if not exists solicitacao_participacao" -A12 supabase/migrations/037_sate_participacao.sql` que a participação tem as colunas `solicitacao_id`, `unidade_id` e `status`.

- [ ] **Step 4: Commit** - `feat(sate): migration 048 - avisos persistentes e leitura por pessoa`.

---

### Task 2: O model dos avisos

**Files:**
- Create: `src/modules/sate/avisos.model.js`
- Modify: `src/modules/sate/sate.model.js` (`listSolicitacoes` aceita `id`)
- Test: `tests/sate-avisos.test.mjs`

**Interfaces:**
- Produces, em `avisos.model.js`:
  - puras: `publicoDe(nivel) → 'aprovador' | 'leitor' | 'escola'`; `PADRAO_AVISOS`; `chaveDoAviso(tipo, publico) → string | null`; `interessa(aviso, { email, publico, prefs }) → boolean`; `naoLidos(avisos, vistos) → aviso[]`; `ordenarAvisos(avisos) → aviso[]`; `descrever(aviso, nomes) → { titulo, tipo, texto }`.
  - com estado: `carregarAvisos({ nivel }) → Promise<void>`; `pendentes() → aviso[]` (não lidos que interessam, já ordenados); `idsComNovidade() → Set<string>`; `receberAviso(id) → Promise<aviso | null>` (devolve o aviso só se ele interessa); `marcarVisto(solicitacaoId) → Promise<void>`; `aoMudarAvisos(fn) → () => void`; `subscribeAvisos(handler) → () => void`; `limparAvisos()`.
- Produces, em `sate.model.js`: `listSolicitacoes({ id })` - o filtro por id (devolve lista de zero ou um item).

- [ ] **Step 1: Teste que falha** - criar `tests/sate-avisos.test.mjs`:

```js
// Avisos do SATE: quem recebe o quê, o que conta como não lido e o texto.
// Spec: 2026-10-10-sate-notificacoes-design.md § D3 e D4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  publicoDe, chaveDoAviso, interessa, naoLidos, ordenarAvisos, descrever, PADRAO_AVISOS,
} from '../src/modules/sate/avisos.model.js';

const EU = 'nome@exemplo.com';
const av = (tipo, extra = {}) => ({ id: 1, solicitacao_id: 's1', tipo, autor: 'outra@exemplo.com', em: '2026-10-10T12:00:00+00:00', ...extra });

test('publicoDe: escrita aprova, leitura só lê, o resto é escola', () => {
  assert.equal(publicoDe('escrita'), 'aprovador');
  assert.equal(publicoDe('leitura'), 'leitor');
  assert.equal(publicoDe('proprios'), 'escola');
  assert.equal(publicoDe('oculto'), 'escola');
});

test('ninguém é avisado do que ele mesmo fez', () => {
  for (const publico of ['aprovador', 'leitor', 'escola']) {
    assert.equal(interessa(av('nova', { autor: EU }), { email: EU, publico, prefs: {} }), false, publico);
    assert.equal(interessa(av('negado', { autor: 'NOME@Exemplo.com' }), { email: EU, publico, prefs: {} }), false, publico);
  }
});

test('quem aprova: pedido novo SEMPRE, mesmo com tudo desligado', () => {
  const prefs = { avisos_pedidos_escola: false, avisos_equipe: false };
  assert.equal(chaveDoAviso('nova', 'aprovador'), null);
  assert.equal(interessa(av('nova'), { email: EU, publico: 'aprovador', prefs }), true);
});

test('quem aprova: pedidos das escolas ligados por padrão, ações da equipe desligadas', () => {
  const ctx = { email: EU, publico: 'aprovador', prefs: {} };
  assert.equal(interessa(av('pendente_cancelamento'), ctx), true);
  assert.equal(interessa(av('saida_pedida'), ctx), true);
  for (const t of ['em_analise', 'confirmado', 'negado', 'cancelado', 'reaberta', 'editada', 'parada_acrescentada', 'saida_confirmada']) {
    assert.equal(interessa(av(t), ctx), false, t);
    assert.equal(interessa(av(t), { ...ctx, prefs: { avisos_equipe: true } }), true, t);
  }
  assert.equal(interessa(av('saida_pedida'), { ...ctx, prefs: { avisos_pedidos_escola: false } }), false);
});

test('escola: decisão e andamento ligados por padrão, cada um desliga o seu', () => {
  const ctx = { email: EU, publico: 'escola', prefs: {} };
  for (const t of ['confirmado', 'negado', 'cancelado']) {
    assert.equal(chaveDoAviso(t, 'escola'), 'avisos_decisao');
    assert.equal(interessa(av(t), ctx), true, t);
    assert.equal(interessa(av(t), { ...ctx, prefs: { avisos_decisao: false } }), false, t);
  }
  for (const t of ['nova', 'em_analise', 'reaberta', 'editada', 'parada_acrescentada', 'saida_confirmada']) {
    assert.equal(chaveDoAviso(t, 'escola'), 'avisos_andamento');
    assert.equal(interessa(av(t), ctx), true, t);
    assert.equal(interessa(av(t), { ...ctx, prefs: { avisos_andamento: false } }), false, t);
  }
});

test('leitor: os avisos da escola, desligados por padrão', () => {
  assert.deepEqual(PADRAO_AVISOS.leitor, { avisos_decisao: false, avisos_andamento: false });
  assert.equal(interessa(av('confirmado'), { email: EU, publico: 'leitor', prefs: {} }), false);
  assert.equal(interessa(av('confirmado'), { email: EU, publico: 'leitor', prefs: { avisos_decisao: true } }), true);
});

test('naoLidos: sem visto, visto antes e visto depois', () => {
  const lista = [av('nova', { id: 1, solicitacao_id: 'a' }), av('negado', { id: 2, solicitacao_id: 'b' }), av('editada', { id: 3, solicitacao_id: 'c' })];
  const vistos = { b: '2026-10-10T11:00:00+00:00', c: '2026-10-10T13:00:00+00:00' };
  assert.deepEqual(naoLidos(lista, vistos).map(a => a.id), [1, 2]);
});

test('naoLidos compara instantes, não texto (frações de segundo diferentes)', () => {
  const lista = [av('nova', { em: '2026-10-10T12:00:00.5+00:00' })];
  assert.equal(naoLidos(lista, { s1: '2026-10-10T12:00:00.123456+00:00' }).length, 1);
  assert.equal(naoLidos(lista, { s1: '2026-10-10T12:00:01+00:00' }).length, 0);
});

test('ordenarAvisos junta os da mesma solicitação, a mais recente em cima', () => {
  const lista = [
    av('nova',       { id: 1, solicitacao_id: 'a', em: '2026-10-10T08:00:00+00:00' }),
    av('nova',       { id: 2, solicitacao_id: 'b', em: '2026-10-10T09:00:00+00:00' }),
    av('confirmado', { id: 3, solicitacao_id: 'a', em: '2026-10-10T10:00:00+00:00' }),
  ];
  assert.deepEqual(ordenarAvisos(lista).map(a => a.id), [3, 1, 2]);
});

test('descrever: título pelo tipo e escola · destino · data', () => {
  const a = av('negado', { solicitacao: { data: '2026-10-14', destino_nome: 'Teatro Exemplo', unidade_id: 'u1' } });
  assert.deepEqual(descrever(a, { u1: 'Escola Exemplo' }), {
    titulo: 'Negado', tipo: 'erro', texto: 'Escola Exemplo · Teatro Exemplo · 14/10/2026',
  });
});

test('descrever: aviso de parada usa a escola da parada; sem escola, a Gerência', () => {
  const a = av('saida_pedida', { unidade_id: 'u2', solicitacao: { data: '2026-10-14', destino_nome: 'Teatro Exemplo', unidade_id: 'u1' } });
  assert.match(descrever(a, { u1: 'Escola Exemplo', u2: 'Escola Modelo' }).texto, /^Escola Modelo · /);
  const b = av('nova', { solicitacao: { data: '2026-10-14', destino_nome: null, unidade_id: null } });
  assert.equal(descrever(b, {}).texto, 'Gerência de Transporte · 14/10/2026');
  assert.equal(descrever(av('tipo_que_nao_existe'), {}).titulo, 'Solicitação atualizada');
});
```

- [ ] **Step 2:** `node --test tests/sate-avisos.test.mjs` → FALHA (módulo ausente).

- [ ] **Step 3: Criar `src/modules/sate/avisos.model.js`:**

```js
// ============================================================
// FundHub - modules/sate/avisos.model.js
// Os AVISOS do SATE: o que aconteceu numa solicitação, para quem
// interessa, e se a pessoa já viu.
// Spec: 2026-10-10-sate-notificacoes-design.md.
//
// O aviso é um FATO gravado pelo banco (`solicitacao_aviso`, por gatilho);
// o "visto" é de cada pessoa (`solicitacao_visto`). Não lido = aviso mais
// novo que o visto daquela solicitação. Abrir a solicitação marca o visto
// e limpa todos os avisos dela de uma vez.
//
// QUEM RECEBE não é gravado: o banco entrega o aviso a quem enxerga a
// solicitação (RLS), e aqui se tira o que a própria pessoa fez e o que ela
// desligou nas preferências. As regras são puras, para o teste fixá-las.
//
// É API pública do módulo: o serviço do sino (modules/notificacoes) lê
// daqui. Nunca toca no DOM.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { pref } from '../../core/configuracoes.js';
import { subscribeTabela } from '../../shared/realtime.js';
import { hojeISO, addDias, fmtData } from '../../shared/format.js';

// Título e tom de cada tipo. `tipo` é o tom do balão (shared/ui/toast.js).
const TIPOS = Object.freeze({
  nova: { titulo: 'Nova solicitação', tipo: 'info' },
  solicitado: { titulo: 'Solicitado', tipo: 'info' },
  em_analise: { titulo: 'Em análise', tipo: 'atencao' },
  aguardando_transporte_adaptado: { titulo: 'Aguardando adaptado', tipo: 'atencao' },
  confirmado: { titulo: 'Confirmado', tipo: 'sucesso' },
  negado: { titulo: 'Negado', tipo: 'erro' },
  cancelado: { titulo: 'Cancelado', tipo: 'erro' },
  pendente_cancelamento: { titulo: 'Pedido de cancelamento', tipo: 'atencao' },
  reaberta: { titulo: 'Solicitação reaberta', tipo: 'atencao' },
  editada: { titulo: 'Data ou horário alterado', tipo: 'atencao' },
  parada_acrescentada: { titulo: 'Escola acrescentada à viagem', tipo: 'info' },
  saida_pedida: { titulo: 'Pedido de saída', tipo: 'atencao' },
  saida_confirmada: { titulo: 'Saída confirmada', tipo: 'erro' },
});

// ── Quem recebe o quê (puras) ────────────────────────────────
// Três públicos (spec D3). Quem aprova é quem tem escrita no SATE; a
// Equipe da SME com leitura vê a rede inteira e por isso nasce com tudo
// desligado; o resto é a escola, que só enxerga as próprias solicitações.
export const publicoDe = (nivel) => (nivel === 'escrita' ? 'aprovador' : nivel === 'leitura' ? 'leitor' : 'escola');

export const PADRAO_AVISOS = Object.freeze({
  aprovador: Object.freeze({ avisos_pedidos_escola: true, avisos_equipe: false }),
  escola: Object.freeze({ avisos_decisao: true, avisos_andamento: true }),
  leitor: Object.freeze({ avisos_decisao: false, avisos_andamento: false }),
});

const PEDIDOS_DA_ESCOLA = ['pendente_cancelamento', 'saida_pedida'];
const DECISOES = ['confirmado', 'negado', 'cancelado'];

// A preferência que governa um tipo de aviso para aquele público.
// `null` = não é configurável: quem aprova é SEMPRE avisado de pedido novo.
export function chaveDoAviso(tipo, publico) {
  if (publico === 'aprovador') {
    if (tipo === 'nova') return null;
    return PEDIDOS_DA_ESCOLA.includes(tipo) ? 'avisos_pedidos_escola' : 'avisos_equipe';
  }
  return DECISOES.includes(tipo) ? 'avisos_decisao' : 'avisos_andamento';
}

const mesmoEmail = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

export function interessa(aviso, { email, publico, prefs = {} }) {
  if (mesmoEmail(aviso.autor, email)) return false;   // ninguém é avisado do que ele mesmo fez
  const chave = chaveDoAviso(aviso.tipo, publico);
  if (chave === null) return true;
  const escolha = prefs[chave];
  return typeof escolha === 'boolean' ? escolha : !!PADRAO_AVISOS[publico]?.[chave];
}

// Compara INSTANTES, não texto: o banco devolve frações de segundo de
// tamanhos diferentes, e a ordem alfabética erraria.
const instante = (ts) => Date.parse(ts) || 0;

export const naoLidos = (avisos, vistos = {}) =>
  (avisos || []).filter(a => instante(a.em) > instante(vistos[a.solicitacao_id]));

// Os avisos da mesma solicitação ficam JUNTOS, o mais recente em cima; e a
// solicitação com a novidade mais recente vem primeiro.
export function ordenarAvisos(avisos) {
  const maisNovo = new Map();
  for (const a of avisos || []) maisNovo.set(a.solicitacao_id, Math.max(maisNovo.get(a.solicitacao_id) || 0, instante(a.em)));
  return [...(avisos || [])].sort((a, b) =>
    (maisNovo.get(b.solicitacao_id) - maisNovo.get(a.solicitacao_id))
    || String(a.solicitacao_id).localeCompare(String(b.solicitacao_id))
    || (instante(b.em) - instante(a.em)));
}

// O que a pessoa lê: título = o que houve; apoio = escola · destino · data.
// `nomes`: id da unidade → nome. Aviso de parada fala da escola da parada.
export function descrever(aviso, nomes = {}) {
  const t = TIPOS[aviso.tipo] || { titulo: 'Solicitação atualizada', tipo: 'atencao' };
  const s = aviso.solicitacao || {};
  const escola = nomes[aviso.unidade_id || s.unidade_id] || 'Gerência de Transporte';
  const texto = [escola, s.destino_nome || s.atividade_livre || '', s.data ? fmtData(s.data) : ''].filter(Boolean).join(' · ');
  return { titulo: t.titulo, tipo: t.tipo, texto };
}

// ── Estado ───────────────────────────────────────────────────
const COLS = 'id, solicitacao_id, tipo, unidade_id, autor, em,'
  + ' solicitacao:solicitacao_transporte(id, data, destino_nome, atividade_livre, unidade_id)';
const JANELA_DIAS = 60;

let _avisos = [];
let _vistos = {};
let _email = null;
let _publico = 'escola';
const _ouvintes = new Set();

const prefs = () => ({
  avisos_pedidos_escola: pref('sate', 'avisos_pedidos_escola'),
  avisos_equipe: pref('sate', 'avisos_equipe'),
  avisos_decisao: pref('sate', 'avisos_decisao'),
  avisos_andamento: pref('sate', 'avisos_andamento'),
});
const meInteressa = (a) => interessa(a, { email: _email, publico: _publico, prefs: prefs() });

function avisar() {
  for (const fn of _ouvintes) { try { fn(); } catch (err) { console.warn('[sate] ouvinte de avisos:', err); } }
}

// Carrega os avisos recentes e os vistos da pessoa. QUALQUER falha vira
// "sem avisos" (inclusive tabela ausente, 42P01, antes da migration 048):
// o sino informa, e não pode derrubar o resto do app.
export async function carregarAvisos({ nivel } = {}) {
  if (nivel) _publico = publicoDe(nivel);
  if (!hasSupabase()) { _avisos = []; _vistos = {}; avisar(); return; }
  try {
    _email = _email || await emailAtual();
    const { data, error } = await sb().from('solicitacao_aviso').select(COLS)
      .gte('em', addDias(hojeISO(), -JANELA_DIAS)).order('em', { ascending: false }).limit(200);
    if (error) throw error;
    _avisos = data || [];
    const ids = [...new Set(_avisos.map(a => a.solicitacao_id))];
    _vistos = {};
    if (ids.length) {
      const v = await sb().from('solicitacao_visto').select('solicitacao_id, visto_em').in('solicitacao_id', ids);
      if (v.error) throw v.error;
      for (const r of v.data || []) _vistos[r.solicitacao_id] = r.visto_em;
    }
  } catch (err) {
    console.warn('[sate] avisos indisponíveis:', err?.message || err);
    _avisos = []; _vistos = {};
  }
  avisar();
}

// Os que estão por ver e interessam à pessoa, na ordem do sino.
export const pendentes = () => ordenarAvisos(naoLidos(_avisos, _vistos).filter(meInteressa));

export const idsComNovidade = () => new Set(pendentes().map(a => a.solicitacao_id));

// Chegou um aviso pelo Realtime: o evento traz só a linha crua, então
// busca o aviso com a solicitação junto. O RLS decide se a pessoa o
// enxerga - se não, a busca volta vazia e nada acontece. Devolve o aviso
// só se ele interessa (é o que decide o balão).
export async function receberAviso(id) {
  if (!hasSupabase() || id == null || _avisos.some(a => a.id === id)) return null;
  const { data, error } = await sb().from('solicitacao_aviso').select(COLS).eq('id', id).maybeSingle();
  if (error || !data) return null;
  _avisos.unshift(data);
  avisar();
  return meInteressa(data) ? data : null;
}

// Abrir a solicitação marca o visto, com a hora do BANCO (o aviso é
// carimbado lá; o relógio do navegador pode estar adiantado ou atrasado).
// Enquanto a resposta não chega, a tela já trata como visto: se a gravação
// falhar, o aviso reaparece na próxima carga - melhor que travar a ficha.
export async function marcarVisto(solicitacaoId) {
  if (!hasSupabase() || !solicitacaoId) return;
  const tinha = idsComNovidade().has(solicitacaoId);
  const maisNovo = _avisos.filter(a => a.solicitacao_id === solicitacaoId).map(a => a.em)
    .sort((a, b) => instante(b) - instante(a))[0];
  if (maisNovo) _vistos[solicitacaoId] = maisNovo;
  if (tinha) avisar();
  const { data, error } = await sb().rpc('marcar_solicitacao_vista', { p_solicitacao: solicitacaoId });
  if (error) { console.warn('[sate] visto não gravado:', error.message); return; }
  if (data) _vistos[solicitacaoId] = data;
}

export function aoMudarAvisos(fn) {
  _ouvintes.add(fn);
  return () => _ouvintes.delete(fn);
}

export function subscribeAvisos(handler) {
  return subscribeTabela('solicitacao_aviso', handler, 'solic-aviso-rt');
}

export function limparAvisos() {
  _avisos = []; _vistos = {}; _email = null; _publico = 'escola';
}
```

- [ ] **Step 4:** `node --test tests/sate-avisos.test.mjs` → PASSA. (Se o teste não conseguir importar o arquivo por causa de `core/configuracoes.js` ou `core/supabase.js`, veja como `tests/sate-disponibilidade.test.mjs` importa um model que usa `core/supabase.js` - funciona sem ajuste. Não mude o arquivo de produção para agradar o teste sem antes reportar.)

- [ ] **Step 5: `sate.model.js`** - `listSolicitacoes` ganha o filtro por `id`, para abrir a ficha a partir de um aviso quando a solicitação está fora do período que a lista mostra (spec D4). O arquivo está em 249 linhas e o teto é 250: **uma linha só**, sem função nova.
  - a assinatura passa a ser `listSolicitacoes({ status, de, ate, unidadeId, id } = {})`;
  - junto dos outros filtros: `if (id) q = q.eq('id', id);`

- [ ] **Step 6:** `node --test "tests/*.test.mjs"`; verificador → 0 bloqueantes; `wc -l src/modules/sate/avisos.model.js src/modules/sate/sate.model.js` ≤ 250 cada (`sate.model.js` fica em exatamente 250).

- [ ] **Step 7: Commit** - `feat(sate): model dos avisos - quem recebe, o que esta por ver e marcar visto`.

---

### Task 3: O sino, a lista, a ficha e as preferências

**Files:**
- Modify: `src/modules/notificacoes/notificacoes.service.js`, `src/modules/notificacoes/notificacoes.css`
- Modify: `src/sate.js` (a chamada de `iniciar`)
- Modify: `src/modules/sate/views/solicitacoes.js`, `src/modules/sate/views/detalhe.js`, `src/modules/sate/sate.css`
- Modify: `src/modules/sate/sate.config.js`, `src/modules/configuracoes/painel.js`

**Interfaces:**
- Consumes: tudo de `avisos.model.js` (Task 2); `listSolicitacoes({ id })` (Task 2).
- Produces: `iniciar({ fontes, naPaginaDoSate = false })` em `notificacoes.service.js`; item de configuração aceita `visivel: () => boolean`.

**Antes de escrever:** ler `notificacoes.service.js` inteiro. A fonte SATE muda de natureza; as fontes `afastamentos` e `ocorrencias` **não mudam** (continuam ao vivo e somem ao recarregar - pendência registrada na spec).

- [ ] **Step 1: `notificacoes.service.js`.**

(a) Imports - **saem** `subscribeSolicitacoes, STATUS as STATUS_SATE` de `sate.model.js`, `subscribeParticipacoes` de `participacoes.model.js` e `getAtividades` de `atividades.model.js`. **Entram**:

```js
import {
  carregarAvisos, pendentes, receberAviso, descrever, subscribeAvisos, aoMudarAvisos, limparAvisos,
} from '../sate/avisos.model.js';
import { nivel } from '../../core/permissoes.js';
import { horaAgora, fmtData, fmtDataHora } from '../../shared/format.js';
```
  (`fmtData` continua em uso pelos outros descritores, se continuar; conferir com grep e tirar o que sobrar. `nomeAtividade` sai junto com `getAtividades`.)

(b) **Apagar** o bloco "Ruído do cache de totais" inteiro (`JANELA_MS`, `ultimoAviso`, `ehRuidoDeTotais`) e os descritores `solicitacao_transporte` e `solicitacao_participacao` de `DESCRITORES`. Em `aoEvento`, sai a checagem `ehRuidoDeTotais(payload)` e as duas linhas de `ultimoAviso`. Conferir com `grep -rn "ehRuidoDeTotais" src tests`: se algum teste importar a função, o teste daquele comportamento sai junto (o ruído que ela adivinhava deixou de existir: o gatilho só registra o que é fato).

(c) O cabeçalho de comentário do arquivo passa a explicar as duas naturezas. Substituir os dois primeiros parágrafos por:

```js
// Sino no topo + balões para o que acontece em VÁRIOS módulos.
//
// Duas naturezas de aviso convivem aqui (spec 2026-10-10-sate-notificacoes):
//   SATE          persistente. O fato é gravado pelo banco e fica no sino
//                 até a pessoa ABRIR a solicitação - pelo próprio sino ou
//                 pela lista. Abrir o sino não limpa nada. Quem lê e filtra
//                 é sate/avisos.model.js; aqui só se desenha.
//   afastamentos  ao vivo. Eco do Realtime: chega a quem está com a tela
//   e ocorrências aberta e some ao recarregar. (Pendência registrada: o
//                 mesmo desenho do SATE serve a eles, com tabelas próprias.)
```

(d) Estado e `iniciar`:

```js
let naPaginaDoSate = false;
let comSate = false;

export async function iniciar({ fontes = TODAS, naPaginaDoSate: noSate = false } = {}) {
  if (ligado) return;
  ligado = true;
  naPaginaDoSate = noSate;
  comSate = fontes.includes('sate');
  montarSino();

  // Mapas id → nome, para descrever o evento sem uma consulta por notificação.
  // Servidores só quando há afastamento na lista: é a carga mais pesada.
  const [unidades, servidores] = await Promise.all([
    getUnidades().catch(() => []),
    fontes.includes('afastamentos') ? getServidores().catch(() => []) : [],
  ]);
  unidades.forEach(u => { if (u.id) nomeUnidade[u.id] = u.nome; });
  servidores.forEach(s => { nomeServidor[s.id] = s.apelido || s.nome; });

  if (!ligado) return;   // parou enquanto os mapas carregavam
  unsubs = [
    ...(fontes.includes('afastamentos') ? [subscribeAfastamentos(aoEvento)] : []),
    ...(fontes.includes('ocorrencias') ? [subscribeOcorrencias(aoEvento)] : []),
  ];

  if (comSate) {
    // Qualquer mudança nos avisos (carga, chegada, visto) repinta o sino.
    unsubs.push(aoMudarAvisos(pintar), subscribeAvisos(aoAvisoDoSate));
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    await carregarAvisos({ nivel: nivel('sate') });
  }
}

// A solicitação pode ter sido aberta em OUTRA aba (o FundHub abre o SATE em
// nova aba): ao voltar para esta, o sino confere de novo.
function aoVoltarParaAba() {
  if (!document.hidden && ligado && comSate) carregarAvisos();
}

// Só INSERT interessa: aviso não se edita. O balão sai apenas para o que
// interessa à pessoa (e nunca para o que ela mesma fez).
async function aoAvisoDoSate(payload) {
  if (payload?.eventType !== 'INSERT') return;
  const aviso = await receberAviso(payload.new?.id);
  if (aviso) toast(descrever(aviso, nomeUnidade));
}
```
  Atenção: `nomeUnidade` passa a guardar o **nome completo** (`u.nome`), não o apelido - é o que a lista de solicitações mostra desde a 0.43.0. Os descritores de ocorrência usam o mesmo mapa e passam a mostrar o nome completo também.

  `parar()` ganha, antes de remover o sino: `document.removeEventListener('visibilitychange', aoVoltarParaAba); limparAvisos(); comSate = false;`

(e) O sino. `atualizarBadge` e `renderLista` passam a somar as duas naturezas; renomear `renderLista` para `pintar` (é o ouvinte de `aoMudarAvisos`) e fazê-la atualizar o número **e** a lista:

```js
// Endereço direto para a ficha de uma solicitação. Dentro do SATE é só
// trocar o hash; no FundHub, o SATE abre em nova aba, como o item do menu.
const linkDaSolicitacao = (id) => `${naPaginaDoSate ? '' : 'sate.html'}#/solicitacoes?abrir=${encodeURIComponent(id)}`;

function pintar() {
  const doSate = comSate ? pendentes() : [];
  const b = document.getElementById('bell-badge');
  if (b) {
    const total = doSate.length + naoLidas;
    b.textContent = String(total);
    b.hidden = total === 0;
  }
  const el = document.getElementById('bell-lista');
  if (!el) return;
  const fora = naPaginaDoSate ? '' : ' target="_blank" rel="noopener"';
  const persistentes = doSate.map(a => {
    const d = descrever(a, nomeUnidade);
    return `<a class="bell-item t-${esc(d.tipo)}" href="${esc(linkDaSolicitacao(a.solicitacao_id))}"${fora}>
      <div class="bi-tit">${esc(d.titulo)} <span class="bi-hora">${esc(fmtDataHora(a.em))}</span></div>
      <div class="bi-txt">${esc(d.texto)}</div>
    </a>`;
  }).join('');
  const aoVivo = eventos.map(e => `
    <div class="bell-item t-${esc(e.tipo)}">
      <div class="bi-tit">${esc(e.titulo)} <span class="bi-hora">${esc(e.hora)}</span></div>
      <div class="bi-txt">${esc(e.texto)}</div>
    </div>`).join('');
  el.innerHTML = (persistentes + aoVivo) || `<div class="bell-vazio">Sem notificações.</div>`;
}
```
  - Onde o código chamava `atualizarBadge()` ou `renderLista()`, chamar `pintar()`.
  - `abrir()` continua zerando `naoLidas` (os avisos ao vivo) e chamando `pintar()` - **os do SATE não são tocados**.
  - Em `montarSino`, depois de ligar o botão: clicar num aviso do SATE fecha o painel - `wrap.addEventListener('click', (e) => { if (e.target.closest('a.bell-item')) fechar(); });`

- [ ] **Step 2: `notificacoes.css`** - depois das regras `.bell-item.t-*`:

```css
/* Aviso do SATE: é um link para a solicitação, e fica até ela ser aberta. */
a.bell-item { display: block; color: inherit; text-decoration: none; }
a.bell-item:hover { background: var(--surface-3); }
a.bell-item:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
```
  (conferir que `--surface-3` existe em `tokens.css`; se não, usar o token de hover que `.bell-*` ou `.topbar-acao` já usa.)

- [ ] **Step 3: `src/sate.js`** - a chamada passa a ser `notificacoes.iniciar({ fontes: ['sate'], naPaginaDoSate: true });`

- [ ] **Step 4: `views/detalhe.js`** - abrir a ficha marca o visto. Importar `marcarVisto` de `../avisos.model.js` e, em `abrirDetalhe`, logo depois de `abrirModal(...)`:

```js
  // Abrir a solicitação é o que tira os avisos dela do sino (spec
  // 2026-10-10-sate-notificacoes, D4). Não espera: a ficha não depende disso.
  marcarVisto(s.id);
  document.querySelector(`[data-novidade="${CSS.escape(String(s.id))}"]`)?.remove();
```

- [ ] **Step 5: `views/solicitacoes.js`** - o ponto de novidade e o endereço direto.

Imports: `import { idsComNovidade } from '../avisos.model.js';` (`listSolicitacoes` já é importado); `import { toast } from '../../../shared/ui/toast.js';` se ainda não houver.

(a) Na `celula` da coluna `escola`, o ponto vem antes do nome:

```js
    celula: s => `${novidades.has(s.id) ? `<span class="sol-novidade" data-novidade="${esc(s.id)}" title="Há novidade nesta solicitação"><span class="sr-only">Novidade: </span></span>` : ''}`
      + `<span class="sol-esc-nome">${esc(nomeEscolas(s))}</span><span class="sol-esc-apelido">${esc(apelidoEscolas(s))}</span>` },
```
  com `let novidades = new Set();` no topo do arquivo, preenchido em `carregar()` logo antes de `montarTabela`: `novidades = idsComNovidade();`. (Conferir se a classe `.sr-only` existe em `src/styles/`; se não existir com esse nome, usar a classe de "só leitor de tela" que o projeto já tem, ou trocar o `<span>` interno por `aria-label="Novidade"` no externo.)

(b) O endereço direto. No fim de `carregar()`, depois de `montarTabela(...)`:

```js
  await abrirPeloEndereco(lista);
```
  e a função:

```js
// `#/solicitacoes?abrir=<id>`: o sino aponta para cá (spec
// 2026-10-10-sate-notificacoes, D4). Abre a ficha uma vez e limpa o
// endereço, para recarregar a página não reabrir a mesma solicitação.
async function abrirPeloEndereco(lista) {
  const id = new URLSearchParams(String(location.hash).split('?')[1] || '').get('abrir');
  if (!id) return;
  history.replaceState(null, '', `${location.pathname}${location.search}#/solicitacoes`);
  // Fora do período filtrado, busca pelo id.
  const s = lista.find(x => x.id === id) || (await listSolicitacoes({ id }).catch(() => []))[0];
  if (!s) return toast({ titulo: 'Solicitação não encontrada', texto: 'Ela pode ter sido excluída.', tipo: 'atencao' });
  abrirDetalhe(s, ctx);
}
```

- [ ] **Step 6: `sate.css`** - junto das regras `.sol-esc-*`:

```css
/* Há aviso por ver nesta solicitação (o mesmo que está no sino). */
.sol-novidade {
  display: inline-block; width: 8px; height: 8px; margin-right: 6px;
  border-radius: 999px; background: var(--brand); vertical-align: middle;
}
```

- [ ] **Step 7: Preferências.**

`src/modules/configuracoes/painel.js` - em `pintarConfigDoModulo`, o filtro de itens passa a respeitar `visivel`:

```js
  // `visivel` (opcional): o item só aparece para quem ele serve - quem
  // aprova e a escola têm avisos diferentes (spec 2026-10-10-sate-notificacoes, D3).
  const itens = (declaracao?.itens || [])
    .filter(i => !soPessoais || i.escopo === 'usuario')
    .filter(i => typeof i.visivel !== 'function' || i.visivel());
```

`src/modules/sate/sate.config.js` - imports: `import { nivel, podeEscrever } from '../../core/permissoes.js';` e `import { PADRAO_AVISOS, publicoDe } from './avisos.model.js';`. Em `DECLARACAO.itens`, depois do item `cor`:

```js
    // Avisos do sino (spec 2026-10-10-sate-notificacoes, D3). Cada público
    // vê só os seus. O padrão é getter porque depende de quem está logado,
    // e a declaração é lida antes do login.
    {
      chave: 'avisos_pedidos_escola', escopo: 'usuario', grupo: 'notificacoes', tipo: 'switch',
      get padrao() { return PADRAO_AVISOS.aprovador.avisos_pedidos_escola; },
      visivel: () => podeEscrever('sate'),
      rotulo: 'Pedidos das escolas',
      dica: 'Pedido de cancelamento e pedido de saída de uma viagem. De solicitação nova você é avisado sempre.',
    },
    {
      chave: 'avisos_equipe', escopo: 'usuario', grupo: 'notificacoes', tipo: 'switch',
      get padrao() { return PADRAO_AVISOS.aprovador.avisos_equipe; },
      visivel: () => podeEscrever('sate'),
      rotulo: 'Ações de outros aprovadores',
      dica: 'Análise, confirmação, negativa, cancelamento, reabertura, edição e paradas feitas por outra pessoa da equipe.',
    },
    {
      chave: 'avisos_decisao', escopo: 'usuario', grupo: 'notificacoes', tipo: 'switch',
      get padrao() { return PADRAO_AVISOS[publicoDe(nivel('sate'))]?.avisos_decisao ?? true; },
      visivel: () => !podeEscrever('sate'),
      rotulo: 'Decisão da solicitação',
      dica: 'Quando uma solicitação é confirmada, negada ou cancelada.',
    },
    {
      chave: 'avisos_andamento', escopo: 'usuario', grupo: 'notificacoes', tipo: 'switch',
      get padrao() { return PADRAO_AVISOS[publicoDe(nivel('sate'))]?.avisos_andamento ?? true; },
      visivel: () => !podeEscrever('sate'),
      rotulo: 'Andamento da solicitação',
      dica: 'Entrou em análise, foi reaberta, teve data ou horário alterado, foi aberta pela Gerência em nome da escola, ou uma escola entrou ou saiu da viagem.',
    },
```
  Conferir: `avisos.model.js` **não** importa `sate.config.js` (senão fecha ciclo); `grupo: 'notificacoes'` existe em `GRUPOS` (`core/configuracoes.js`). O sino relê as preferências a cada pintura (`pref` é síncrono), então mudar um interruptor vale no próximo aviso; para valer na hora, em `src/sate.js`, onde a página já ouve `cfg:salva`, nada precisa mudar - o próximo `pintar()` já reflete.

- [ ] **Step 8:** `node --test "tests/*.test.mjs"`; verificador → 0 bloqueantes (ciclos; checagem 12). `grep -rn "subscribeSolicitacoes\|subscribeParticipacoes" src` - se ficaram sem nenhum chamador, **deixe as funções onde estão** (são API pública dos models e não custam nada); só reporte.

- [ ] **Step 9: Commit** - `feat(sate): sino com avisos que ficam ate abrir a solicitacao, e preferencias por publico`.

---

### Task 4: Tutoriais, changelog e versões

**Files:**
- Modify: `docs/modulos/sate.md`, `docs/modulos/configuracoes.md`, `CHANGELOG.md`, `src/core/config.js`

- [ ] **Step 1: `src/core/config.js`** - `versao: '0.44.0'`, `versaoSate: '0.22.0'`.

- [ ] **Step 2: `CHANGELOG.md`.**
  - Tabela "Versões do SATE", nova primeira linha: `| 0.22.0 | 0.44.0 | avisos que ficam no sino até a solicitação ser aberta, sem avisar quem fez a ação, com escolha do que receber |`
  - Nova entrada acima da mais recente (ler a entrada anterior inteira como modelo literal de formato):

```markdown
## [0.44.0] - 2026-10-10

> SATE 0.22.0.
>
> **Rodar a migration 048 no Supabase.** É ela que guarda os avisos. **Até rodar, o sino do
> SATE não mostra aviso nenhum** - o resto do sistema funciona normalmente.

### Alterado

- **Os avisos do SATE ficam no sino até você abrir a solicitação.** Antes, só recebia quem
  estava com a tela aberta naquele momento, e o sino se esvaziava ao ser aberto. Agora o
  aviso espera: some quando você abre a solicitação, clicando nele ou pela lista.
- **Você não é mais avisado do que você mesmo fez.** Negar, confirmar ou editar uma
  solicitação não gera aviso para quem fez.
- **Cada um escolhe o que recebe**, em Configurações do SATE, em **Notificações**. Quem
  aprova é sempre avisado de solicitação nova; pode ligar ou desligar os pedidos das
  escolas e as ações de outros aprovadores. A escola escolhe entre a decisão da solicitação
  e o andamento dela.

### Adicionado

- Na lista de solicitações, um **ponto** ao lado da escola marca as que têm novidade por ver.
- Clicar num aviso abre a solicitação correspondente.
```

- [ ] **Step 3: `docs/modulos/sate.md`.**
  - O parágrafo sobre o **sino** (em "Onde fica o SATE"): reescrever com o comportamento novo - o aviso fica até a solicitação ser aberta; clicar nele abre a solicitação; quem fez a ação não é avisado; o ponto na lista.
  - Nova tarefa em "Passo a passo": "### Escolher os avisos que você recebe" (Configurações → Notificações), com as opções de quem aprova e as da escola, e a regra de que solicitação nova sempre avisa quem aprova.
  - "## Perguntas frequentes": "O aviso sumiu do sino sem eu clicar nele" → abrir a solicitação pela lista também o tira; "Não recebi aviso do que eu mesmo fiz" → é assim.
  - Carimbo final: `> Atualizado na versão 0.44.0.`

- [ ] **Step 4: `docs/modulos/configuracoes.md`** - em "O que dá para fazer aqui" ou "Perguntas frequentes", uma linha: algumas preferências só aparecem para quem elas servem (os avisos do SATE são diferentes para quem aprova e para a escola). Carimbo final atualizado para `0.44.0`.

  Regras dos tutoriais: escritos para quem usa; nenhum nome de arquivo, tabela, função ou coluna; nenhum dado real.

- [ ] **Step 5:** `node --test "tests/*.test.mjs"`; verificador → 0 bloqueantes.

- [ ] **Step 6:** ler o `git diff --cached` procurando dado real. **Commit** - `feat: 0.44.0 - avisos do SATE que ficam ate serem abertos`.
