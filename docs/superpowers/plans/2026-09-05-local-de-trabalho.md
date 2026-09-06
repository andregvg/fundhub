# Local de trabalho (Bloco J) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Local de trabalho" no lugar de "vínculo/lotação" na interface toda; gerências e subsecretarias da SME como locais de trabalho possíveis, com nome editável; cargo e local na modal de novo servidor.

**Architecture:** Troca de rótulo, não de tabela - `vinculo` e `unidade_id` continuam com esses nomes no banco. Os locais não-escolares são linhas de `unidade_escolar` com `tipo = 'interno'` (migration 028 estende o CHECK). `getUnidades()` (tela de Escolas) continua só escola; `getLocais()` (seletor de local de trabalho) passa a trazer escola + sede + interno. O editor dos locais internos é um painel de configuração de rede (mecanismo do Bloco A). A modal "Novo servidor" ganha um fieldset opcional que cria o primeiro vínculo junto - o dado continua morando só no vínculo (a decisão da migration 023 não é reaberta).

**Tech Stack:** JS ES modules puro, sem build. Supabase (Postgres+RLS). `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-05-local-de-trabalho-design.md`

## Global Constraints

- PT-BR em código, comentário, commit e interface.
- Branch `dev`. Commits frequentes. Push ao fechar.
- **Invioláveis:** nenhum dado real (os nomes de gerência/subsecretaria os cadastra o André pela UI, não vão no repo); RLS default-deny; todo valor do banco por `esc()`.
- **A migration 023 não é reaberta:** cargo e local de trabalho moram no `vinculo`, nunca no `servidor`. As colunas `servidor.cargo`/`servidor.lotacao` seguem mortas.
- Migration 028 **idempotente**; fecha com `select registrar_migration('028', '...')`.
- Degradação sem a 028: `criarLocalInterno` recebe `23514` (CHECK) → erro amigável; o resto funciona como hoje.
- Model nunca toca no DOM; view nunca chama `sb()`; `<x>.config.js` não é model.
- Ao fechar: `CONFIG.versao` MINOR + `CHANGELOG.md`.
- `node --test tests/*.mjs` e `python .claude/scripts/verificar_arquitetura.py` sem falhas - **incluindo** a varredura de "lota*"/"vínculo" (lição de vocabulário abandonado).
- **Regra de documentação:** `servidores.md` já existe (Bloco B) e usa "vínculo"/"Local". Este bloco renomeia esses termos e **atualiza `docs/modulos/servidores.md` no mesmo commit** (checagem 11).

---

## Contexto verificado

- `unidade_escolar.tipo`: CHECK `unidade_tipo_valido` = `tipo in ('escola', 'sede')` (migration 023, adicionado só `if not exists` no `pg_constraint`). `numero int unique` é **nullable** - local interno entra sem numero.
- `escolas.model.js`:
  - `getUnidades()` → `.eq('tipo', 'escola')`. **Não muda.**
  - `getLocais()` → `.select('id, nome, tipo').order('nome')`, sorteado com `sede` primeiro. Cache `_locais`, invalidado junto de `_cache` no `registrarCache`.
  - `criarUnidade`/`atualizarUnidade` usam `CAMPOS` (sem `tipo`). **Não mudam.**
- `servidores.model.js`:
  - `lotacaoDe(s, { completo })` (linha 67) - **API pública**, atravessa a fronteira.
  - Importadores de `lotacaoDe`: `servidores/views/{detalhe,formulario,lista}.js`, `meus-dados/meus-dados.view.js`. (`usuarios.model.js` lê as colunas mortas `cargo, lotacao` no embed - fora do escopo, não é `lotacaoDe`.)
  - `cargoDe(s)` - **não** renomeia.
  - `vinculo` embed: `SEL` traz `unidade:unidade_escolar(id, nome, apelido, tipo)`.
- `vinculos.model.js`: `criarVinculo({ servidor_id, unidade_id, papel, ingresso, fim })`, `cargoCanonico(bruto)`, `getCargos()`. Erro `23505` (vínculo aberto duplicado) já tratado e `amigavel`.
- Textos de UI a trocar (varredura feita):
  - `servidores.view.js`: `<p>` do page-head (l.38), filtro "Lotação" (l.52), "Sem vínculo" (l.57), `filtro.semVinculo`/`f-sem` (mantém o id, muda o rótulo).
  - `servidores/module.js`: `desc` (l.16).
  - `views/detalhe.js`: import `lotacaoDe`; `sub` (l.30); "Vínculos com escolas" (l.60); "Novo vínculo" (l.61); "Nenhum vínculo cadastrado" (l.86); "Editar/Excluir vínculo" (l.101-102).
  - `views/formulario.js`: import; var `lotacao` (l.21); `derivado('Lotação', …)` (l.66); "Sem vínculo" (l.30); "Editar/Criar vínculo" (l.33); "vínculo(s)" no aviso de exclusão (l.167). **+ fieldset novo (D4).**
  - `views/lista.js`: import + uso em `combina` (busca).
  - `views/vinculo.js`: título "Novo vínculo"/"Editar vínculo" (l.49); legend "Designação" (l.54); label "Local" (l.55); hint "Em branco = vínculo em aberto" (l.77); "Excluir vínculo" (l.86); hint "Para preservar o histórico…" (l.87); toasts "Vínculo criado/encerrado/atualizado/excluído"; botão "Vincular"/"Salvar"; `confirmar('Excluir este vínculo?')`; `detalhe` do busca-selecao (`l.tipo === 'sede' ? 'SME' : ''`).
  - `meus-dados/meus-dados.view.js`: import `lotacaoDe`; "Lotação" (l.146-147); "sem lotação"; "Lotações vigentes" (l.168).
  - `horarios/views/por-servidor.js`: rótulo "lotação".
- `escolas.config.js` (criado no Bloco A) tem só `telefones_no_card`. Este bloco acrescenta o item `locais_internos` (painel).
- `calendario/views/escalas.js` usa `getLocais()` para o seletor de unidade (escala é por escola) - filtrar `interno` fora ali.
- Bloco A `painel.js`: item com `painel: (box, ctx) => …` é desenhado no elemento `[data-painel="<chave>"]`. Grupo `regras` existe em `GRUPOS`.
- `CONFIG.versao` após o Bloco B: `0.16.0`.
- `tests/`: `busca.test.mjs`, `segmentos.test.mjs`, etc. Nada testa `lotacaoDe` diretamente.

---

## Task 1: Migration 028 - `tipo = 'interno'`

**Files:**
- Create: `supabase/migrations/028_local_trabalho.sql`

**Interfaces:**
- Produces: `unidade_escolar.tipo` aceita `'interno'`.

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- 028 - Locais de trabalho não-escolares
-- Rode no SQL Editor, depois da 027 (ou da 026 se a 027 ainda não
-- entrou - são independentes).
--
-- Uma gerência ou subsecretaria da SME é um LOCAL DE TRABALHO, mas
-- não uma escola. Em vez de uma tabela nova (que obrigaria `vinculo`
-- a apontar para dois destinos), é uma linha de unidade_escolar com
-- tipo = 'interno' - o mesmo discriminador que a 023 criou para a
-- "SME - Sede".
--
-- getUnidades() (tela de Escolas) continua filtrando tipo = 'escola',
-- então uma gerência não aparece lá. getLocais() (seletor de local de
-- trabalho) passa a trazer os três tipos.
-- ============================================================

alter table unidade_escolar drop constraint if exists unidade_tipo_valido;
alter table unidade_escolar add constraint unidade_tipo_valido
  check (tipo in ('escola', 'sede', 'interno'));

-- unidade_escolar já está na auditoria da 019 e no realtime; nada a
-- religar. Os nomes dos locais internos os cadastra o admin pela tela
-- (painel de configuração de Escolas) - nenhum dado real nesta migration.

select registrar_migration('028', 'Locais de trabalho nao-escolares (unidade_escolar.tipo = interno)');
```

- [ ] **Step 2: Sanidade (leitura)**

Confirmar que `registrar_migration` existe (022) e que nenhuma outra migration recria `unidade_tipo_valido` depois da 023 (`grep -rn unidade_tipo_valido supabase/migrations/`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/028_local_trabalho.sql
git commit -m "feat(db): migration 028 - unidade_escolar.tipo aceita 'interno'

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Aplicada pelo André no SQL Editor - anotar na lista de pendências do fecho.

---

## Task 2: `escolas.model.js` - `getLocais` com os três tipos + CRUD de locais internos

**Files:**
- Modify: `src/modules/escolas/escolas.model.js`
- Test: `tests/locais-internos.test.mjs`

**Interfaces:**
- Produces:
  - `getLocais()` - agora escola + sede + interno, ordem: sede, interno (alfabético), escola (alfabético).
  - `eLocalInterno(u): boolean` - `u?.tipo !== 'escola'` (sede e interno são "internos" para efeito de ícone e isenção de segmento).
  - `getLocaisInternos(): Promise<Array<{ id, nome, tipo, vinculos: number }>>` - `tipo in ('sede','interno')` com contagem de vínculos.
  - `criarLocalInterno(nome): Promise<row>` - insert `{ nome, tipo: 'interno' }`.
  - `renomearLocalInterno(id, nome): Promise<void>`.
  - `excluirLocalInterno(id): Promise<void>` - `23503` (FK) → erro amigável.

- [ ] **Step 1: Escrever os testes que falham**

`getLocais`/CRUD falam com o banco - o teste cobre `eLocalInterno` (puro) e a ordenação. Criar `tests/locais-internos.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eLocalInterno, ordenarLocais } from '../src/modules/escolas/escolas.model.js';

test('eLocalInterno: escola é falso, sede e interno são verdadeiros', () => {
  assert.equal(eLocalInterno({ tipo: 'escola' }), false);
  assert.equal(eLocalInterno({ tipo: 'sede' }), true);
  assert.equal(eLocalInterno({ tipo: 'interno' }), true);
  assert.equal(eLocalInterno(null), true); // sem tipo, trata como não-escola
});

test('ordenarLocais: sede, depois internos alfabéticos, depois escolas alfabéticas', () => {
  const r = ordenarLocais([
    { nome: 'Escola B', tipo: 'escola' },
    { nome: 'Subsecretaria Z', tipo: 'interno' },
    { nome: 'SME - Sede', tipo: 'sede' },
    { nome: 'Escola A', tipo: 'escola' },
    { nome: 'Gerência A', tipo: 'interno' },
  ]).map(x => x.nome);
  assert.deepEqual(r, ['SME - Sede', 'Gerência A', 'Subsecretaria Z', 'Escola A', 'Escola B']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/locais-internos.test.mjs` → FAIL (exports ausentes).

- [ ] **Step 3: Implementar em `escolas.model.js`**

Acrescentar, perto de `getLocais`:

```js
// Sede e local interno da SME contam como "não-escola": ícone de
// prédio, e o filtro de segmento não os esconde (não têm segmento).
export const eLocalInterno = (u) => (u?.tipo || '') !== 'escola';

// Ordem do seletor de local de trabalho: a Sede primeiro (procurá-la
// no meio de 144 nomes seria absurdo), depois os internos, depois as
// escolas - cada grupo em ordem alfabética.
export function ordenarLocais(lista) {
  const rank = (t) => (t === 'sede' ? 0 : t === 'interno' ? 1 : 2);
  return [...lista].sort((a, b) =>
    rank(a.tipo) - rank(b.tipo) || a.nome.localeCompare(b.nome, 'pt'));
}
```

`getLocais()`: a query já é `.select('id, nome, tipo').order('nome')` - **remover** o `.eq` que porventura exista (não há) e trocar o sort manual por `ordenarLocais`:

```js
export async function getLocais() {
  if (_locais) return _locais;
  if (!hasSupabase()) { _locais = []; return _locais; }
  const { data, error } = await sb().from('unidade_escolar').select('id, nome, tipo').order('nome');
  if (error && error.code === '42703') {                       // 023 não rodou: tudo escola
    const { data: d2 } = await sb().from('unidade_escolar').select('id, nome').order('nome');
    _locais = (d2 || []).map(u => ({ ...u, tipo: 'escola' }));
    return _locais;
  }
  if (error) throw error;
  _locais = ordenarLocais(data || []);
  return _locais;
}
```

CRUD dos locais internos (usa `agoraISO` já importado; `_cache = null; _locais = null;` como os outros escritores):

```js
// Locais de trabalho que NÃO são escolas: a Sede e as gerências/
// subsecretarias. Editados no painel de configuração de Escolas.
export async function getLocaisInternos() {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('unidade_escolar')
    .select('id, nome, tipo, vinculos:vinculo(count)')
    .in('tipo', ['sede', 'interno']).order('nome');
  if (error) {
    if (error.code === '42703') return [];   // 023 não rodou
    throw error;
  }
  return (data || []).map(u => ({
    id: u.id, nome: u.nome, tipo: u.tipo,
    vinculos: u.vinculos?.[0]?.count ?? 0,
  }));
}

export async function criarLocalInterno(nome) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe o nome do local.');
  const { data, error } = await sb().from('unidade_escolar')
    .insert({ nome: limpo, tipo: 'interno' }).select().single();
  if (error) {
    if (error.code === '23514') {            // CHECK: a 028 ainda não rodou
      const e = new Error('Atualização do banco pendente - locais internos ainda não estão liberados.');
      e.amigavel = true; throw e;
    }
    throw error;
  }
  _cache = null; _locais = null;
  return data;
}

export async function renomearLocalInterno(id, nome) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe o nome do local.');
  const { error } = await sb().from('unidade_escolar')
    .update({ nome: limpo, atualizado_em: agoraISO() }).eq('id', id);
  if (error) throw error;
  _cache = null; _locais = null;
}

export async function excluirLocalInterno(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('unidade_escolar').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {            // FK: há vínculo apontando
      const e = new Error('Há servidores lotados neste local. Encerre os vínculos antes de excluí-lo.');
      e.amigavel = true; throw e;
    }
    throw error;
  }
  _cache = null; _locais = null;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `node --test tests/locais-internos.test.mjs` → PASS.
Run: `node --test tests/*.mjs` → PASS (sem regressão).

- [ ] **Step 5: Commit**

```bash
git add src/modules/escolas/escolas.model.js tests/locais-internos.test.mjs
git commit -m "feat(escolas): getLocais com internos; CRUD de locais de trabalho nao-escolares

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `lotacaoDe` → `localDeTrabalhoDe` (rename da API pública)

**Files:**
- Modify: `src/modules/servidores/servidores.model.js`
- Modify: `src/modules/servidores/views/{detalhe,formulario,lista}.js`
- Modify: `src/modules/meus-dados/meus-dados.view.js`

**Interfaces:**
- Produces: `localDeTrabalhoDe(s, { completo })` - substitui `lotacaoDe`, mesma assinatura e retorno.

- [ ] **Step 1: Renomear no model**

`servidores.model.js`: `export function lotacaoDe` → `export function localDeTrabalhoDe`. Atualizar o comentário do bloco "Derivações do vínculo" (l.56-72): "A lotação é o nome do local…" → "O local de trabalho é o nome da unidade do vínculo aberto - escola, sede ou local interno da SME."

- [ ] **Step 2: Atualizar os importadores**

Em cada arquivo: trocar `lotacaoDe` por `localDeTrabalhoDe` no import e em toda chamada. São:
- `views/detalhe.js` (import + `sub`)
- `views/formulario.js` (import + var `lotacao` → `local`; ver Task 4)
- `views/lista.js` (import + `combina`)
- `meus-dados/meus-dados.view.js` (import + l.146-147)

- [ ] **Step 3: Varredura**

Run: `grep -rn "lotacaoDe" src/`
Expected: nada.

- [ ] **Step 4: Sanidade + commit**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py`.

```bash
git add src/modules/servidores/ src/modules/meus-dados/
git commit -m "refactor(servidores): lotacaoDe -> localDeTrabalhoDe (API publica)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Vocabulário "local de trabalho" na interface + fieldset na modal de servidor

**Files:**
- Modify: `src/modules/servidores/servidores.view.js`, `src/modules/servidores/module.js`
- Modify: `src/modules/servidores/views/{detalhe,formulario,lista,vinculo}.js`
- Modify: `src/modules/meus-dados/meus-dados.view.js`
- Modify: `src/modules/horarios/views/por-servidor.js`
- Modify: `src/modules/calendario/views/escalas.js`

**Interfaces:**
- Consumes: `criarVinculo`, `cargoCanonico` de `vinculos.model.js`; `criarBuscaSelecao`; `getLocais` (via `ctx.locais`).

- [ ] **Step 1: Textos - Servidores**

- `servidores.view.js`: `<p>` do page-head → "Cadastro funcional, cargos e locais de trabalho."; filtro "Lotação" → "Local de trabalho"; "Sem vínculo" (switch) → "Sem local de trabalho". (ids `f-local`, `f-sem`, `filtro.semVinculo` **não mudam** - só o rótulo visível.)
- `servidores/module.js`: `desc` → "Cadastro funcional, cargos, locais de trabalho e contatos."
- `views/detalhe.js`: "Vínculos com escolas" → "Locais de trabalho"; "Novo vínculo" → "Adicionar local de trabalho"; "Nenhum vínculo cadastrado." → "Nenhum local de trabalho cadastrado."; `aria-label` "Editar/Excluir vínculo" → "Editar/Excluir local de trabalho"; na linha do vínculo, `v.unidade?.tipo === 'sede'` → `eLocalInterno(v.unidade)` para o ícone de prédio (importar `eLocalInterno` de `escolas.model.js`).
- `views/lista.js`: no `card`, `v.unidade?.tipo === 'sede'` → `eLocalInterno(v.unidade)` para o ícone; "Sem vínculo" → "Sem local de trabalho".
- `views/vinculo.js`: título "Novo vínculo"/"Editar vínculo" → "Adicionar local de trabalho"/"Editar local de trabalho"; legend "Designação" → "Local de trabalho"; label "Local" → "Local de trabalho"; hint "Em branco = vínculo em aberto." → "Em branco = local de trabalho atual."; "Excluir vínculo" → "Excluir local de trabalho"; hint "Para preservar o histórico, prefira preencher o Término em vez de excluir." (mantém); toasts "Vínculo criado/encerrado/atualizado/excluído" → "Local de trabalho adicionado/encerrado/atualizado/excluído"; botão "Vincular"/"Salvar" → "Adicionar"/"Salvar"; `confirmar('Excluir este vínculo?')` → `confirmar('Excluir este local de trabalho?')`; o `detalhe` do busca-selecao usa `eLocalInterno(l) ? 'SME' : ''`; placeholder "Buscar escola…" → "Buscar escola ou gerência…"; `vazioTexto` "Nenhuma escola com esse nome" → "Nada com esse nome". O erro amigável de `23505` ("Este servidor já tem um vínculo aberto com esse cargo neste local.") vira "Este servidor já tem esse cargo neste local de trabalho." (em `vinculos.model.js`, duas ocorrências).

- [ ] **Step 2: Textos - Meus dados e Horários**

- `meus-dados/meus-dados.view.js`: "Lotação" → "Local de trabalho"; "sem lotação" → "sem local de trabalho"; "Lotações vigentes" → "Locais de trabalho".
- `horarios/views/por-servidor.js`: "lotação" → "local de trabalho" onde aparecer como rótulo/texto.

- [ ] **Step 3: Calendário não oferece local interno como "escola" da escala**

`calendario/views/escalas.js`: onde monta `opcoes` do `criarBuscaSelecao` a partir de `getLocais()`, filtrar `locais.filter(l => !eLocalInterno(l))` - uma escala é por escola. Importar `eLocalInterno`.

- [ ] **Step 4: Fieldset "Local de trabalho" na modal de novo servidor (D4)**

`views/formulario.js`, `formServidor(s, ctx, { voltar })`, **só quando `novo`**. Depois do `<fieldset>` "Rede" (ou como bloco próprio), acrescentar:

```js
${novo ? `
  <fieldset class="form-grupo">
    <legend>Local de trabalho <span class="form-hint" style="text-transform:none;font-weight:400;letter-spacing:0">opcional - pode adicionar depois pela ficha</span></legend>
    <div class="campos auto">
      <label class="col-full">Local
        <div id="s-local-box"></div>
      </label>
      <label class="col-full">Cargo / função
        <select id="s-cargo">
          <option value="">Selecione…</option>
          ${ctx.cargos.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          <option value="::outro::">+ Outro…</option>
        </select>
      </label>
      <label class="col-full" id="s-cargo-novo-wrap" hidden>Qual cargo / função?
        <input id="s-cargo-novo" placeholder="Ex.: Vice-diretor(a)" />
      </label>
      <label>Início <input id="s-vinc-ini" type="date" /></label>
    </div>
  </fieldset>` : ''}
```

Depois de `abrirDrawer(...)`, quando `novo`, montar a busca-seleção:

```js
let buscaLocalNovo = null;
if (novo) {
  buscaLocalNovo = criarBuscaSelecao(document.getElementById('s-local-box'), {
    opcoes: (ctx.locais || []).map(l => ({
      id: l.id, rotulo: l.nome,
      detalhe: eLocalInterno(l) ? 'SME' : '',
      busca: l.apelido || '',
    })),
    placeholder: 'Buscar escola ou gerência…',
    vazioTexto: 'Nada com esse nome',
  });
  const selCargo = document.getElementById('s-cargo');
  selCargo.addEventListener('change', () => {
    const outro = selCargo.value === '::outro::';
    document.getElementById('s-cargo-novo-wrap').hidden = !outro;
    if (outro) document.getElementById('s-cargo-novo').focus();
  });
}
```

Em `salvarServidor`, no ramo `novo` (depois de `criarServidor` + `sincronizarTelefones`), antes do `ctx.recarregar()`:

```js
if (!s && buscaLocalNovo) {
  const unidade_id = buscaLocalNovo.valorAtual();
  const escolhido = document.getElementById('s-cargo').value;
  const papel = escolhido === '::outro::' ? document.getElementById('s-cargo-novo').value : escolhido;
  const ingresso = document.getElementById('s-vinc-ini').value || null;
  if (unidade_id && !String(papel).trim()) {
    // Local sem cargo é erro: não dá para ter designação sem função.
    return falha(msg, 'Escolha também o cargo do local de trabalho, ou deixe o local em branco.');
  }
  if (unidade_id) {
    try {
      await criarVinculo({ servidor_id: id, unidade_id, papel, ingresso });
    } catch (err) {
      // Servidor já está no banco; não desfaz. Avisa e a ficha resolve.
      toast({ titulo: 'Servidor criado', texto: 'O local de trabalho não pôde ser salvo - adicione pela ficha.', tipo: 'atencao' });
    }
  } else if (String(papel).trim()) {
    toast({ titulo: 'Cargo ignorado', texto: 'Escolha um local de trabalho para registrar o cargo.', tipo: 'atencao' });
  }
}
```

(nota: `id` já é definido na linha `const id = s ? … : (await criarServidor(payload)).id;` - reordenar para o `criarVinculo` ver `id`.)

`buscaLocalNovo` precisa ser destruído se a gaveta for reaberta - guardar em `let` no escopo do módulo, `buscaLocalNovo?.destruir()` no topo de `formServidor` (mesmo padrão de `vinculo.js`).

Imports novos em `formulario.js`: `criarVinculo` de `../vinculos.model.js`; `criarBuscaSelecao` de `../../../shared/ui/busca-selecao.js`; `eLocalInterno` de `../../escolas/escolas.model.js`.

- [ ] **Step 5: Varredura de vocabulário abandonado**

Run: `grep -rniI "lota[çc]\|vínculo\|vinculo\b" src/modules/ --include=*.js | grep -v "vinculos.model\|criarVinculo\|atualizarVinculo\|excluirVinculo\|formVinculo\|vinculosAbertos\|removerVinculo\|import \|from '\|\.vinculos\b\|vinculo(\|vinculo_aberto\|// "`
Expected: só nomes de símbolo/tabela (`vinculo`, `vinculos`), nenhum texto de UI com "vínculo" ou "lotação".
Run: `grep -rniI "lota[çc]\|vínculo" docs/modulos/servidores.md` - some ou fica só onde o texto explica o histórico.

- [ ] **Step 6: Atualizar `docs/modulos/servidores.md`**

Trocar "vínculo"→"local de trabalho" e "Local"→"Local de trabalho" e "lotação"→"local de trabalho" no tutorial, seguindo os rótulos novos das telas. Manter "encerrar ≠ excluir". Atualizar o carimbo de versão para a que este bloco vai fechar.

- [ ] **Step 7: Verificação no browser (controlador)**

Patch dev-local. `#/servidores` → "Novo servidor" → o fieldset "Local de trabalho" aparece; preencher local + cargo + início → salvar → o servidor nasce com o local. Deixar o local em branco → só a pessoa é criada. Local sem cargo → erro inline. Na ficha de um servidor, "Adicionar local de trabalho" abre a gaveta com "Local de trabalho" no lugar de "Local"/"Designação". Nenhuma tela diz "vínculo" ou "lotação". Reverter o patch.

- [ ] **Step 8: Commit**

```bash
git add src/modules/ docs/modulos/servidores.md
git commit -m "feat(servidores): 'local de trabalho' no lugar de vinculo/lotacao; cargo+local na modal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Painel de configuração - editar os locais internos

**Files:**
- Modify: `src/modules/escolas/escolas.config.js`
- Modify: `src/modules/escolas/escolas.css` (se precisar de estilo) ou reusar `.cfg-*`

**Interfaces:**
- Consumes: `getLocaisInternos`, `criarLocalInterno`, `renomearLocalInterno`, `excluirLocalInterno` de `escolas.model.js`; `esc`, `ico`, `toast`, `confirmar`, `loading`, `erroBox`.
- Produces: `escolas.config.js` `DECLARACAO.itens` ganha `{ chave: 'locais_internos', escopo: 'rede', grupo: 'regras', rotulo, dica, painel: pintarLocaisInternos }`.

- [ ] **Step 1: Declarar o item e o painel**

`escolas.config.js`:

```js
import { pref } from '../../core/configuracoes.js';
import {
  getLocaisInternos, criarLocalInterno, renomearLocalInterno, excluirLocalInterno,
} from './escolas.model.js';
import { esc } from '../../shared/dom.js';
import { ico } from '../../shared/ui/icones.js';
import { toast } from '../../shared/ui/toast.js';
import { confirmar } from '../../shared/ui/confirmar.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';

export const DECLARACAO = {
  itens: [
    { chave: 'telefones_no_card', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'switch', rotulo: 'Exibir telefone no card',
      dica: 'Mostra o telefone principal da escola na lista.', padrao: false },
    { chave: 'locais_internos', escopo: 'rede', grupo: 'regras',
      rotulo: 'Locais de trabalho internos',
      dica: 'Gerências, subsecretarias e coordenadorias da SME onde há servidores lotados. As escolas se cadastram na própria tela.',
      painel: pintarLocaisInternos },
  ],
};

export const mostrarTelefonesNoCard = () => pref('escolas', 'telefones_no_card') ?? false;

async function pintarLocaisInternos(box) {
  box.innerHTML = loading();
  let lista;
  try { lista = await getLocaisInternos(); }
  catch (err) { box.innerHTML = erroBox(err); return; }

  box.innerHTML = `
    <div class="cfg-locais">
      ${lista.map(l => `
        <div class="cfg-local esc-row" data-id="${esc(l.id)}">
          <input class="cfg-local-nome" value="${esc(l.nome)}" aria-label="Nome de ${esc(l.nome)}" />
          ${l.tipo === 'sede'
            ? '<span class="form-hint">fallback</span>'
            : `<button type="button" class="mini-btn no cfg-local-del"
                 aria-label="Excluir ${esc(l.nome)}"${l.vinculos ? ' disabled title="Há servidores lotados aqui"' : ''}>${ico('excluir', { tam: 14 })}</button>`}
        </div>`).join('')}
      <form class="cfg-local-novo esc-row">
        <input id="cfg-local-add" placeholder="Nova gerência / subsecretaria" aria-label="Nome do novo local interno" />
        <button type="submit" class="mini-btn" aria-label="Adicionar local interno">${ico('adicionar', { tam: 14 })}</button>
      </form>
    </div>`;

  box.querySelectorAll('.cfg-local-nome').forEach(inp => {
    inp.addEventListener('change', async () => {
      const id = inp.closest('[data-id]').dataset.id;
      try { await renomearLocalInterno(id, inp.value); toast({ titulo: 'Nome atualizado', tipo: 'sucesso' }); }
      catch (err) { toast({ titulo: 'Não foi possível renomear', texto: err.message, tipo: 'erro' }); pintarLocaisInternos(box); }
    });
  });
  box.querySelectorAll('.cfg-local-del').forEach(b => {
    b.addEventListener('click', async () => {
      const linha = b.closest('[data-id]');
      const ok = await confirmar('Excluir este local de trabalho?', {
        detalhe: 'Só é possível se nenhum servidor estiver lotado aqui.', textoOk: 'Excluir', perigo: true });
      if (!ok) return;
      try { await excluirLocalInterno(linha.dataset.id); toast({ titulo: 'Local excluído', tipo: 'sucesso' }); pintarLocaisInternos(box); }
      catch (err) { toast({ titulo: 'Não foi possível excluir', texto: err.message, tipo: 'erro' }); }
    });
  });
  box.querySelector('.cfg-local-novo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = document.getElementById('cfg-local-add');
    if (!inp.value.trim()) return;
    try { await criarLocalInterno(inp.value); inp.value = ''; pintarLocaisInternos(box); toast({ titulo: 'Local adicionado', tipo: 'sucesso' }); }
    catch (err) { toast({ titulo: 'Não foi possível adicionar', texto: err.message, tipo: 'erro' }); }
  });
}
```

**Atenção R2/R1:** `escolas.config.js` importa `escolas.model.js` (mesmo módulo - interno, OK) e helpers de `shared/` (OK). Não é model, não fala com `sb()` direto. O verificador não deve reclamar - conferir.

- [ ] **Step 2: CSS (mínimo)**

Se `.esc-row` já der o layout linha (campo + botão), só acrescentar em `escolas.css` (ou `configuracoes.css`):

```css
.cfg-locais { display: flex; flex-direction: column; gap: 8px; }
.cfg-local { align-items: center; }
```

- [ ] **Step 3: Sanidade + verificação (controlador)**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py`.
Browser (patch dev-local): engrenagem de Escolas → grupo "Regras e limites" → "Locais de trabalho internos" com "SME - Sede" (sem botão de excluir) e o campo de adicionar. Em dev-local `criarLocalInterno` lança "Sem conexão" - confirmar o toast de erro. `#/configuracoes` → bloco Escolas mostra o painel.

- [ ] **Step 4: Commit**

```bash
git add src/modules/escolas/
git commit -m "feat(escolas): painel de configuracao para os locais de trabalho internos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Fechar a entrega

**Files:**
- Modify: `src/core/config.js`, `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-09-05-local-de-trabalho-design.md` (nota)

- [ ] **Step 1: Nota na spec**

```markdown
## Nota de implementação (05/09/2026)

Entregue sobre o mecanismo do Bloco A: o editor dos locais internos é um
painel de configuração de rede em `escolas.config.js`. A modelagem foi a
(b) da § 3.2 - `unidade_escolar.tipo = 'interno'`, sem tabela nova.
`servidor.cargo`/`servidor.lotacao` seguem mortas; a modal de novo servidor
cria o primeiro vínculo, o dado continua só no vínculo.
```

- [ ] **Step 2: Versão**

`src/core/config.js`: `0.16.0` → `0.17.0` (MINOR - mudança de modelo + vocabulário de hub).

- [ ] **Step 3: CHANGELOG**

```markdown
## [0.17.0] - 2026-09-05

### Alterado
- O que o sistema chamava de "vínculo" e "lotação" agora se chama **local de
  trabalho** em todas as telas - o mesmo termo do sistema da Secretaria.

### Adicionado
- Gerências, subsecretarias e coordenadorias da SME podem ser cadastradas como
  locais de trabalho (além das escolas e da Sede). O nome é editável nas
  configurações de Escolas. Ao cadastrar um servidor, já dá para informar o
  cargo e o local de trabalho na mesma tela.
```

- [ ] **Step 4: Carimbo do tutorial**

`docs/modulos/servidores.md` termina com `> Atualizado na versão 0.17.0.`

- [ ] **Step 5: Verificação final**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py` (sem violações, checagem 11 verde).
Run a varredura de vocabulário (Task 4 Step 5) uma última vez.

- [ ] **Step 6: Commit e push**

```bash
git add src/core/config.js CHANGELOG.md docs/
git commit -m "chore: versao 0.17.0 e fecha o bloco de local de trabalho

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin dev
```

- [ ] **Step 7: Pendências para o André**

- **Rodar a migration 028** no SQL Editor (depois da 026/027).
- Cadastrar pelas configurações de Escolas os locais internos que faltam (ex.: "SME — Subsecretaria Pedagógica").
- Validar logado: a modal de novo servidor cria o local junto; o painel edita nomes; nenhuma tela diz "vínculo"/"lotação".

---

## Self-Review

**Spec coverage:**
- D1 (vocabulário "local de trabalho"; `lotacaoDe` → `localDeTrabalhoDe`; ~27 ocorrências trocadas; verificador não acha sobra) → Tasks 3 e 4 (Steps 1-2, 5). ✔
- D2 (`unidade_escolar.tipo = 'interno'`; migration 028; `getLocais` os três tipos; `getUnidades` só escola; `eLocalInterno`) → Tasks 1 e 2. ✔
- D3 (editor = painel de config de rede; 4 funções de model; `criarUnidade` não muda; permissão via painel do Bloco A) → Tasks 2 e 5. ✔
- D4 (fieldset na modal de novo servidor; local exige cargo; cargo sem local ignora; falha não desfaz o servidor; é atalho) → Task 4 Step 4. ✔
- D5 (painel segue a regra dos painéis de rede do Bloco A) → Task 5 (item `escopo: 'rede'`, o `painel.js` já desabilita para quem não tem escrita). ✔
- Riscos: varredura de "lota*"/"vínculo" (Task 4 Step 5, Task 6 Step 5); local interno fora da tela de Escolas (`getUnidades` intacto - Task 2); excluir com FK (`23503` - Task 2); vínculo na modal falhar sem desfazer o servidor (Task 4 Step 4); `28`/`23514` degradação (Task 2). ✔
- Critérios 1-11 → cobertos; 6 (recusa de gravação sem escrita) e a persistência dependem de teste logado - anotado na Task 6 Step 7.

**Placeholder scan:** sem TBD. O fieldset (Task 4 Step 4) e o painel (Task 5 Step 1) estão com o código completo. Os textos da Task 4 Step 1 são um de-para literal, não "ajuste apropriado".

**Type consistency:** `eLocalInterno(u)` produzido na Task 2, consumido nas Tasks 4 e 5. `localDeTrabalhoDe` renomeado na Task 3, usado na Task 4. `getLocaisInternos()` retorna `{ id, nome, tipo, vinculos }` na Task 2, consumido igual na Task 5. `criarLocalInterno(nome)` / `renomearLocalInterno(id, nome)` / `excluirLocalInterno(id)` - assinaturas idênticas entre Task 2 e Task 5.
