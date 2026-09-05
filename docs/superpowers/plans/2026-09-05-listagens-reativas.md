# Listagens reativas (Bloco H) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um servidor ou escola recém-criado aparece na lista imediatamente, mesmo com um segmento marcado no filtro.

**Architecture:** O salvamento já recarrega o model e repinta a lista - o registro novo é escondido na *pintura* pelo filtro de segmento, que não tem como casar um registro que ainda não tem segmento. A correção generaliza a exceção que já existe para a sede: "registro sem âncora de segmento passa por qualquer recorte". Duas funções `combina()`, uma em cada lista. Nenhuma migration, nenhuma mudança de model.

**Tech Stack:** JS ES modules puro, sem build. `node --test` para os testes. Supabase só em produção (dev-local não insere).

**Spec:** `docs/superpowers/specs/2026-09-05-listagens-reativas-design.md`

## Global Constraints

- PT-BR em código, comentário, commit e interface.
- Trabalhar na branch `dev`. Commits frequentes.
- Nenhuma cor literal, nenhum dado real (repo público).
- `python .claude/scripts/verificar_arquitetura.py` sem violações antes de fechar.
- View nunca chama `sb()`; model nunca toca no DOM.
- Ao fechar a entrega: subir `CONFIG.versao` (PATCH) em `src/core/config.js` **e** registrar em `CHANGELOG.md` (texto para quem usa, sem jargão nem nome de arquivo).

---

## Contexto verificado

- `servidores/views/formulario.js`, `escolas/views/formulario.js` e `servidores/views/vinculo.js` **já** chamam `ctx.recarregar()` no sucesso; `recarregar()` nulifica `_cache` e repinta. O caminho de dados está certo.
- O módulo **Horários não cria nem edita vínculo** (só lê `getCargos`/`getCargosGestao`) - a linha correspondente da tabela D2 da spec é um não-problema; não há código a mexer lá.
- `seg.combina(u)` → `core/segmentos.js` `unidadeNoSegmento(u, sel)`: devolve `false` para unidade cujo `segmentosDaUnidade()` é `[]` (sem `segmento` e sem `tem_eja`) quando o filtro não está vazio.
- O filtro de segmento nasce **pré-preenchido** com os segmentos do perfil (`filtro-segmento.js`) - por isso o bug atinge quase todo mundo, não só quem clicou num chip.
- `combina()` de servidores: `src/modules/servidores/views/lista.js:10-38`.
- `combina()` de escolas: `src/modules/escolas/escolas.view.js:103-115` (`if (seg && !seg.combina(u)) return false;`).

---

## Task 1: Servidor sem vínculo não é filtrado por segmento

**Files:**
- Modify: `src/modules/servidores/views/lista.js` (função `combina`, bloco do filtro de segmento)
- Test: `tests/listagens-reativas.test.mjs` (criar)

**Interfaces:**
- Consumes: `combina(s, ctx)` interno do arquivo; `ctx` = `{ filtro, seg, idxUnidades, filtroUnidade }`. `seg` tem `.selecionados()` e `.combina(unidade)`.
- Produces: nada exportado novo. `combina` passa a devolver `true` para servidor com `vinculosAbertos(s).length === 0` mesmo com segmento selecionado.

- [ ] **Step 1: Escrever o teste que falha**

Extrair a lógica testável não vale a refatoração aqui - o teste exercita `combina` importando o módulo e montando um `ctx` de mentira. Como `combina` não é exportada, o teste cobre a **regra** via `core/segmentos.js` + a montagem que `lista.js` faz. Criar `tests/listagens-reativas.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unidadeNoSegmento } from '../src/core/segmentos.js';

// A regra que a correção implementa: um servidor SEM vínculo aberto
// não é escondido por um filtro de segmento. Espelha o bloco de
// `combina()` em servidores/views/lista.js.
function servidorPassaNoSegmento(abertos, selecao, idxUnidades) {
  if (!selecao.length) return true;
  const semAncora = !abertos.some(v => v.unidade?.tipo === 'escola' && v.unidade_id);
  const casa = abertos.some(v => unidadeNoSegmento(idxUnidades[v.unidade_id], selecao));
  return semAncora || casa;
}

test('servidor recém-criado (sem vínculo) passa em qualquer recorte de segmento', () => {
  assert.equal(servidorPassaNoSegmento([], ['EMEF'], {}), true);
});

test('servidor só com vínculo na sede continua visível', () => {
  const abertos = [{ unidade_id: 's1', unidade: { tipo: 'sede' } }];
  assert.equal(servidorPassaNoSegmento(abertos, ['EMEF'], {}), true);
});

test('servidor com vínculo numa EMEF é filtrado ao selecionar só Infantil', () => {
  const abertos = [{ unidade_id: 'e1', unidade: { tipo: 'escola' } }];
  const idx = { e1: { segmento: 'EMEF' } };
  assert.equal(servidorPassaNoSegmento(abertos, ['CEI'], idx), false);
});

test('servidor com vínculo numa EMEF aparece ao selecionar Fundamental', () => {
  const abertos = [{ unidade_id: 'e1', unidade: { tipo: 'escola' } }];
  const idx = { e1: { segmento: 'EMEF' } };
  assert.equal(servidorPassaNoSegmento(abertos, ['EMEF'], idx), true);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/listagens-reativas.test.mjs`
Expected: os dois primeiros testes FALHAM (a função de referência ainda espelha a regra ANTIGA, que exige `abertos.length` para o carve-out) - na verdade, como escrevi a função de referência já com a regra nova, ela passa. **Ajuste:** primeiro escreva a função de referência com a regra ANTIGA para ver o teste falhar:

```js
function servidorPassaNoSegmento(abertos, selecao, idxUnidades) {
  if (!selecao.length) return true;
  const soSede = abertos.length && abertos.every(v => v.unidade?.tipo === 'sede');
  const casa = abertos.some(v => unidadeNoSegmento(idxUnidades[v.unidade_id], selecao));
  return soSede || casa;
}
```

Run: `node --test tests/listagens-reativas.test.mjs`
Expected: FAIL em "servidor recém-criado (sem vínculo) passa" (`soSede` é `false` para lista vazia).

- [ ] **Step 3: Corrigir a função de referência do teste para a regra nova**

Trocar `soSede` por `semAncora` (código do Step 1). Rodar de novo: todos PASSAM.

- [ ] **Step 4: Aplicar a mesma regra no código real**

Em `src/modules/servidores/views/lista.js`, no bloco:

```js
  // Recorte por segmento: entra quem atua em ALGUMA escola do
  // segmento. A sede não tem segmento - e por isso continua visível,
  // senão o filtro esconderia justamente a equipe da SME.
  if (seg && seg.selecionados().length) {
    const soSede = abertos.length && abertos.every(v => v.unidade?.tipo === 'sede');
    if (!soSede && !abertos.some(v => seg.combina(idxUnidades[v.unidade_id]))) return false;
  }
```

trocar por:

```js
  // Recorte por segmento: entra quem atua em ALGUMA escola do
  // segmento. Quem NÃO tem âncora de segmento - sem vínculo aberto,
  // ou só vínculo com a sede / local interno da SME - passa em
  // qualquer recorte: senão o filtro esconderia a equipe da SME e
  // todo servidor recém-criado, que ainda não tem onde casar.
  if (seg && seg.selecionados().length) {
    const semAncora = !abertos.some(v => v.unidade?.tipo === 'escola' && v.unidade_id);
    if (!semAncora && !abertos.some(v => seg.combina(idxUnidades[v.unidade_id]))) return false;
  }
```

- [ ] **Step 5: Rodar toda a suíte**

Run: `node --test tests/`
Expected: PASS, sem regressão.

- [ ] **Step 6: Commit**

```bash
git add src/modules/servidores/views/lista.js tests/listagens-reativas.test.mjs
git commit -m "fix(servidores): servidor sem vinculo nao some quando ha segmento no filtro

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Escola sem segmento não é filtrada por segmento

**Files:**
- Modify: `src/modules/escolas/escolas.view.js` (função `combina`)
- Test: `tests/listagens-reativas.test.mjs` (acrescentar)

**Interfaces:**
- Consumes: `combina(u)` interno; `seg.combina(u)` do filtro de segmento.
- Produces: `combina` devolve `true` para unidade sem `segmento` e sem `tem_eja`, mesmo com filtro ativo.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `tests/listagens-reativas.test.mjs`:

```js
// Espelha `combina(u)` de escolas/escolas.view.js.
function escolaPassaNoSegmento(u, selecao) {
  const temSegmento = Boolean(u.segmento) || Boolean(u.tem_eja);
  if (!selecao.length) return true;
  if (temSegmento) return unidadeNoSegmento(u, selecao);
  return true;  // sem segmento declarado → não é escondida
}

test('escola recém-criada sem segmento aparece com um eixo filtrado', () => {
  assert.equal(escolaPassaNoSegmento({ nome: 'Escola Exemplo' }, ['CEI']), true);
});

test('escola EMEF some ao filtrar só Infantil', () => {
  assert.equal(escolaPassaNoSegmento({ segmento: 'EMEF' }, ['CEI']), false);
});

test('escola EMEF com EJA aparece ao filtrar EJA', () => {
  assert.equal(escolaPassaNoSegmento({ segmento: 'EMEF', tem_eja: true }, ['EJA']), true);
});
```

- [ ] **Step 2: Rodar e ver o primeiro teste falhar**

Primeiro escreva `escolaPassaNoSegmento` sem o carve-out (`return unidadeNoSegmento(u, selecao)` direto após o `if (!selecao.length)`).

Run: `node --test tests/listagens-reativas.test.mjs`
Expected: FAIL em "escola recém-criada sem segmento aparece" (`unidadeNoSegmento` devolve `false`).

- [ ] **Step 3: Corrigir a função de referência**

Aplicar o carve-out `temSegmento` do Step 1. Rodar: PASSA.

- [ ] **Step 4: Aplicar no código real**

Em `src/modules/escolas/escolas.view.js`, `combina(u)`:

```js
function combina(u) {
  if (seg && !seg.combina(u)) return false;
```

trocar a primeira linha do corpo por:

```js
function combina(u) {
  // Escola ainda sem segmento (cadastro recém-criado, campo em branco)
  // não é escondida pelo filtro - a pessoa precisa vê-la para completá-la.
  const temSegmento = Boolean(u.segmento) || Boolean(u.tem_eja);
  if (seg && temSegmento && !seg.combina(u)) return false;
```

- [ ] **Step 5: Rodar a suíte**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/escolas/escolas.view.js tests/listagens-reativas.test.mjs
git commit -m "fix(escolas): escola sem segmento nao some quando ha eixo no filtro

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Contador e verificação; fechar a entrega

**Files:**
- Modify: `src/core/config.js` (`CONFIG.versao` → PATCH)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: nada.
- Produces: nada. Só documentação e versão.

- [ ] **Step 1: Confirmar por leitura que o contador reflete o total**

Abrir `src/modules/servidores/views/lista.js` `pintarLista` e `src/modules/escolas/escolas.view.js` `pintar`: o `M` de "N de M" vem de `lista.length` / `ALL.length` (o total do model), não do filtrado. Com as Tasks 1-2, o registro novo entra em `lista`/`ALL` e nos dois números. Nenhuma mudança de código - registrar no PR que foi verificado.

- [ ] **Step 2: Rodar o verificador de arquitetura**

Run: `python .claude/scripts/verificar_arquitetura.py`
Expected: sem violações.

- [ ] **Step 3: Subir a versão**

Em `src/core/config.js`, incrementar o PATCH de `CONFIG.versao`. Valor atual: `0.14.5` → `0.14.6`. **Atenção à ordem de merge:** se o Bloco I for fechado antes deste, ele já terá usado `0.14.6` - conferir o valor real no arquivo na hora e usar o próximo PATCH livre.

- [ ] **Step 4: Registrar no CHANGELOG**

Conferir a entrada anterior de `CHANGELOG.md` como referência literal de formato (`## [X.Y.Z] - aaaa-mm-dd` + resumo + `### Corrigido`). Acrescentar no topo:

```markdown
## [0.14.6] - 2026-09-05

### Corrigido
- Um servidor ou uma escola recém-cadastrados agora aparecem na lista na
  hora, sem precisar recarregar a página, mesmo com um filtro de
  segmento ativo.
```

(ajustar a versão ao próximo PATCH livre no momento do merge)

- [ ] **Step 5: Commit**

```bash
git add src/core/config.js CHANGELOG.md
git commit -m "chore: versao 0.14.1 e fecha o bloco de listagens reativas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Verificação manual (controlador, não subagente)**

Com login admin na URL de dev (`https://andregvg.github.io/fundhub/dev/`):
1. Filtro de segmento com um eixo marcado → "Novo servidor" → salvar → aparece na hora; contador sobe.
2. Criar o primeiro vínculo desse servidor com escola do outro eixo → card troca "Sem vínculo" pela escola.
3. "Nova escola" sem preencher Segmento, com um eixo marcado → aparece.
4. Repetir (1) a partir de "Gerir servidores e vínculos" na ficha de uma escola.

Registrar o resultado. Se algum passo falhar, é um segundo furo - abrir `systematic-debugging`.

---

## Self-Review

**Spec coverage:**
- D1 (exceção "sem âncora de segmento") → Tasks 1 e 2. ✔
- D2 (auditar pontos de criação) → contexto verificado + Task 3 Step 6 (verificação manual dos 4 caminhos); Horários descartado por não criar vínculo. ✔
- D3 (contador sobre o total) → Task 3 Step 1 (verificação, sem código). ✔
- Critérios 1-7 → cobertos por Tasks 1-3 e a verificação manual.

**Placeholder scan:** sem TBD/TODO; todo teste tem código; todo passo de código tem bloco.

**Type consistency:** `semAncora`/`temSegmento` usados de forma idêntica no teste e no código real de cada task. `unidadeNoSegmento` é a assinatura real de `core/segmentos.js`.
