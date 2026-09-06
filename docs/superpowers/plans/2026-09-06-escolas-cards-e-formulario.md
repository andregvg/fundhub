# Escolas: card configurável e formulário mais legível (Bloco F) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No card de Escolas: exibir contagem de servidores e escolher cards por linha. No formulário: Nome em linha inteira, Transporte/EJA como switch, dicas discretas (correção global).

**Architecture:** Duas chaves novas em `escolas.config.js` (mecanismo do Bloco A), uma em `servidores.config.js` (`cards_por_linha`). A contagem de servidores é carregada só quando ligada, por `import()` dinâmico de `servidores.model.js`. `cards_por_linha` é uma variável CSS que a view escreve no container. A dica berrante é herança de `<label>` - o reset vai em `.form-hint` global.

**Tech Stack:** JS ES modules puro, sem build. `node --test`. Preferências via `core/configuracoes.js`.

**Spec:** `docs/superpowers/specs/2026-09-05-escolas-cards-e-formulario-design.md`

## Global Constraints

- PT-BR em código, comentário, commit e interface.
- Branch `dev`. Commits frequentes. Push ao fechar.
- Todo valor do banco por `esc()`. Nenhuma cor literal em `src/modules/**`.
- `<x>.config.js` não é model (não fala com `sb()`); a view não chama `sb()` - a contagem vem do `servidores.model.js` por model→model (R2, permitido, sem ciclo: `servidores.model.js` importa `telefones.model.js`, não Escolas).
- **D7 é correção GLOBAL:** `.form-hint` afeta Escolas, Servidores, SATE, Projetos. Conferir os quatro.
- **Regra de documentação (Bloco B):** `escolas` ganha `doc: true` e `docs/modulos/escolas.md` **no mesmo commit**.
- Ao fechar: `CONFIG.versao` MINOR (novas configs de modelo) + `CHANGELOG.md`.
- `node --test tests/*.mjs` e `python .claude/scripts/verificar_arquitetura.py` sem violações.

---

## Contexto verificado

- **Bloco A já criou** `escolas.config.js` (só `telefones_no_card`, com `mostrarTelefonesNoCard()`) e `servidores.config.js` (idem). **Bloco J** acrescentou o painel `locais_internos` ao de Escolas. Este bloco só **acrescenta itens**.
- `escolas.view.js`: `<div class="cards" id="cards">`; `cardHtml(u)` monta o array `tags` (já com o telefone do Bloco A). `combina(u)`, `pintar()`, `recarregar()`. Não importa `servidores.model.js` hoje.
- `servidores.view.js`: `<div class="cards" id="sv-cards">`; `card(s)` em `views/lista.js`.
- `.cards` (`components.css:414`): `grid-template-columns: 1fr`; em `@media (min-width: 560px)` (`:1017`) vira `repeat(auto-fill, minmax(280px, 1fr))`.
- `.form-hint` (`components.css:681`): só `color: var(--muted); font-size: 13px;`. Herda `font-weight: 700; text-transform: uppercase; letter-spacing: .04em` de `.form-grupo .campos label:not(.inline):not(.search)` (`:913`) quando está dentro de um `<label>` desses.
- `escolas/views/formulario.js`: bloco "Identificação" tem `<label>Nome <input name="nome" .../><small class="form-hint">…</small></label>` (**sem** `col-full`); "Nome oficial / SAE" já é `col-full`. Transporte/EJA: `<label class="inline col-full"><input type="checkbox" name="tem_transporte" …/> Transporte de alunos</label>`.
- `.switch` (`components.css:223`): `display: inline-flex; align-items: center; text-transform: none; letter-spacing: 0; font-weight: 600; align-self: end;`. **NÃO** redefine `flex-direction`, então dentro de `.form-grupo .campos label` herdaria `column` - por isso o label do switch no formulário precisa **também** ser excluído da regra de rótulo (`:not(.switch)`), como `.search` e `.inline` já são.
- `getServidoresDaUnidade(unidadeId)` existe em `servidores.model.js` e filtra `vinculosAbertos`. Para a contagem por unidade, o mais barato é `getServidores()` uma vez + contar client-side (o model tem cache).
- `servidores.model.js` `vinculosAbertos(s)` = `(s.vinculos||[]).filter(v => !v.fim)`.
- `CONFIG.versao` após o Bloco E: `0.18.0`.

---

## Task 1: `.form-hint` volta ao lugar (D7) + `:not(.switch)` na regra de rótulo (D6 prep)

**Files:**
- Modify: `src/styles/components.css`

- [ ] **Step 1: Reset de herança em `.form-hint`**

`components.css:681`:

```css
.form-hint { color: var(--muted); font-size: 13px; }
```

vira:

```css
/* Dentro de um <label>, a dica herdava peso 700, caixa alta e
   letter-spacing do rótulo de campo - saía MAIÚSCULA E EM NEGRITO,
   competindo com o rótulo. O reset é global: a herança atinge toda
   dica em Escolas, Servidores, SATE e Projetos. */
.form-hint {
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  line-height: 1.4;
}
```

- [ ] **Step 2: `.switch` fora da regra de rótulo de campo**

`components.css:913`:

```css
.form-grupo .campos label:not(.inline):not(.search) {
```

vira:

```css
.form-grupo .campos label:not(.inline):not(.search):not(.switch) {
```

e atualizar o comentário logo acima (l.905-912) para citar o `.switch` junto de `.inline` e `.search` como exceção (é um toggle com rótulo ao lado, não um rótulo acima de campo).

- [ ] **Step 3: Verificação (controlador)**

Patch dev-local. Abrir o formulário de escola, de servidor, uma solicitação do SATE e um projeto: as dicas (`.form-hint`) aparecem em caixa normal, peso normal, discretas. Se 13px ainda competir com o campo de 16px, cair para 12,5px (calibração, não arquitetura). Reverter.

- [ ] **Step 4: Commit**

```bash
git add src/styles/components.css
git commit -m "fix(ui): dica de campo (.form-hint) nao herda mais negrito/caixa-alta do rotulo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `cards_por_linha` - config + CSS + views

**Files:**
- Modify: `src/modules/escolas/escolas.config.js`, `src/modules/servidores/servidores.config.js`
- Modify: `src/styles/components.css`
- Modify: `src/modules/escolas/escolas.view.js`, `src/modules/servidores/servidores.view.js`
- Test: `tests/escolas-config.test.mjs`

**Interfaces:**
- Produces: `cardsPorLinha()` em cada config (`pref(mod,'cards_por_linha') ?? 3`, limitado a 1–6).

- [ ] **Step 1: Teste**

`tests/escolas-config.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardsPorLinha as cardsEscolas } from '../src/modules/escolas/escolas.config.js';
import { cardsPorLinha as cardsServidores } from '../src/modules/servidores/servidores.config.js';
import { _semearParaTeste, limparConfiguracoes } from '../src/core/configuracoes.js';

test('cardsPorLinha padrão é 3', () => {
  limparConfiguracoes();
  assert.equal(cardsEscolas(), 3);
  assert.equal(cardsServidores(), 3);
});

test('cardsPorLinha respeita a preferência, limitado a 1–6', () => {
  _semearParaTeste({}, { 'escolas/cards_por_linha': 5 });
  assert.equal(cardsEscolas(), 5);
  _semearParaTeste({}, { 'escolas/cards_por_linha': 99 });
  assert.equal(cardsEscolas(), 6);
  _semearParaTeste({}, { 'escolas/cards_por_linha': 0 });
  assert.equal(cardsEscolas(), 1);
});
```

Run: `node --test tests/escolas-config.test.mjs` → FAIL.

- [ ] **Step 2: `escolas.config.js` - item + acesso**

Acrescentar ao array `DECLARACAO.itens` (depois de `telefones_no_card`, antes de `locais_internos`):

```js
    { chave: 'servidores_no_card', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'switch', rotulo: 'Exibir quantidade de servidores',
      dica: 'Conta quem tem local de trabalho aberto na unidade.', padrao: false },
    { chave: 'cards_por_linha', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'numero', rotulo: 'Cards por linha (telas largas)',
      min: 1, max: 6, padrao: 3 },
```

e os acessos:

```js
export const mostrarServidoresNoCard = () => pref('escolas', 'servidores_no_card') ?? false;
export const cardsPorLinha = () => Math.max(1, Math.min(6, Number(pref('escolas', 'cards_por_linha') ?? 3) || 3));
```

- [ ] **Step 3: `servidores.config.js` - só `cards_por_linha`**

```js
    { chave: 'cards_por_linha', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'numero', rotulo: 'Cards por linha (telas largas)',
      min: 1, max: 6, padrao: 3 },
```

```js
export const cardsPorLinha = () => Math.max(1, Math.min(6, Number(pref('servidores', 'cards_por_linha') ?? 3) || 3));
```

Servidores **não** ganha `servidores_no_card` (não faz sentido) nem contagem de escolas.

- [ ] **Step 4: CSS - uma variável, duas regras (D3)**

`components.css`, junto de `.cards`:

```css
.cards { display: grid; gap: 12px; grid-template-columns: 1fr; --por-linha: 3; }
```

e no `@media (min-width: 900px)` (criar o bloco se não existir, ou acrescentar):

```css
@media (min-width: 900px) {
  .cards { grid-template-columns: repeat(var(--por-linha), minmax(0, 1fr)); }
}
```

O `minmax(0, 1fr)` (não `1fr`) impede um nome comprido de esticar a coluna. Abaixo de 900px nada muda (o `@media 560px` com `auto-fill` continua valendo até 900).

- [ ] **Step 5: A view escreve a variável**

`escolas.view.js`, em `pintar()` (ou onde o `#cards` é preenchido): antes de montar os cards,

```js
cards.style.setProperty('--por-linha', String(cardsPorLinha()));
```

Importar `cardsPorLinha` de `./escolas.config.js`.

`servidores.view.js`, análogo no `#sv-cards` (em `pintar()`), importando de `./servidores.config.js`.

- [ ] **Step 6: Rodar os testes**

Run: `node --test tests/escolas-config.test.mjs` → PASS. `node --test tests/*.mjs` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/escolas/ src/modules/servidores/ src/styles/components.css tests/escolas-config.test.mjs
git commit -m "feat(config): cards por linha em Escolas e Servidores (>=900px)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Contagem de servidores no card de Escolas (D2)

**Files:**
- Modify: `src/modules/escolas/escolas.view.js`

**Interfaces:**
- Consumes: `mostrarServidoresNoCard` de `./escolas.config.js`; `getServidores`, `vinculosAbertos` de `../servidores/servidores.model.js` (via `import()` dinâmico).

- [ ] **Step 1: Carregar a contagem só quando ligada**

Em `escolas.view.js`, `render()` (ou `pintar()`): quando `mostrarServidoresNoCard()`, fazer `import()` dinâmico e montar um mapa `unidadeId → nº de vínculos abertos`.

```js
let contagemServidores = {};   // módulo-level, junto de ALL

async function carregarContagem() {
  contagemServidores = {};
  if (!mostrarServidoresNoCard()) return;
  try {
    const { getServidores, vinculosAbertos } = await import('../servidores/servidores.model.js');
    const servidores = await getServidores();
    for (const s of servidores) {
      for (const v of vinculosAbertos(s)) {
        if (v.unidade_id) contagemServidores[v.unidade_id] = (contagemServidores[v.unidade_id] || 0) + 1;
      }
    }
  } catch (_) { contagemServidores = {}; }   // degrada: card só sem o número
}
```

Chamar `await carregarContagem()` no `render()` depois de `ALL = await getUnidades()`, e de novo em `recarregar()`. (O model de servidores tem cache próprio - `getServidores()` repetido não paga duas vezes.)

- [ ] **Step 2: Mostrar no card**

Em `cardHtml(u)`, acrescentar ao array `tags`:

```js
    mostrarServidoresNoCard()
      ? `<span class="tag">${ico('equipe', { tam: 12 })} ${contagemServidores[u.id] || 0} ${(contagemServidores[u.id] || 0) === 1 ? 'servidor' : 'servidores'}</span>`
      : '',
```

- [ ] **Step 3: Verificação (controlador)**

Patch dev-local (precisa de fixtures de servidores com vínculo - se difícil, testar só que ligar não quebra e que a contagem some/aparece). Ligar "Exibir quantidade de servidores" na engrenagem → os cards mostram "N servidores"; desligar → some, e a lista de servidores **não** é carregada (conferir no Network/console). Reverter.

- [ ] **Step 4: Commit**

```bash
git add src/modules/escolas/escolas.view.js
git commit -m "feat(escolas): contagem de servidores no card, carregada so quando ligada

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Formulário - Nome em linha inteira, Transporte/EJA como switch (D5, D6)

**Files:**
- Modify: `src/modules/escolas/views/formulario.js`

- [ ] **Step 1: Nome ocupa a linha**

`<label>Nome <input name="nome" required .../>` → `<label class="col-full">Nome <input name="nome" required .../>`. Apelido fica sozinho na linha seguinte (já está sem `col-full`; a leitura passa a ser: nome inteiro, apelido, nome oficial inteiro).

- [ ] **Step 2: Transporte e EJA viram switch**

```html
<label class="inline col-full"><input type="checkbox" name="tem_transporte" ${chk('tem_transporte')} /> Transporte de alunos</label>
<label class="inline col-full"><input type="checkbox" name="tem_eja" ${chk('tem_eja')} /> Atende EJA</label>
```

vira:

```html
<label class="switch col-full">
  <input type="checkbox" name="tem_transporte" ${chk('tem_transporte')} />
  <span class="switch-trilho" aria-hidden="true"></span> Transporte de alunos</label>
<label class="switch col-full">
  <input type="checkbox" name="tem_eja" ${chk('tem_eja')} />
  <span class="switch-trilho" aria-hidden="true"></span> Atende EJA</label>
```

`f.tem_transporte.checked` / `f.tem_eja.checked` no `salvar()` continuam funcionando - `.switch` é só CSS sobre o mesmo `<input type="checkbox">` (R12).

- [ ] **Step 3: Alinhamento do switch no grid do formulário**

Se o switch sair desalinhado (o `align-self: end` do `.switch` base ou o `min-height: var(--controle)`), acrescentar em `components.css`:

```css
.form-grupo .campos label.switch { align-self: start; min-height: var(--campo); }
```

Medir no browser antes de decidir se precisa.

- [ ] **Step 4: Verificação (controlador)**

Patch dev-local. Formulário de escola:
1. Nome ocupa a linha inteira.
2. Transporte e EJA são toggles; marcar/desmarcar e salvar grava os dois valores (conferir o payload no console, ou reabrir a ficha).
3. As dicas de Nome/Apelido/Nome oficial estão discretas (Task 1).
4. Em 375px: os campos empilham, os switches não estouram.
Reverter.

- [ ] **Step 5: Commit**

```bash
git add src/modules/escolas/views/formulario.js src/styles/components.css
git commit -m "feat(escolas): Nome em linha inteira; Transporte e EJA viram switch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Tutorial + fechar

**Files:**
- Modify: `src/modules/escolas/module.js` (`doc: true`)
- Create: `docs/modulos/escolas.md`
- Modify: `src/core/config.js`, `CHANGELOG.md`

- [ ] **Step 1: `doc: true`**

Acrescentar `doc: true,` ao manifesto de Escolas.

- [ ] **Step 2: `docs/modulos/escolas.md`**

Espinha de `.claude/rules/documentacao.md`. Cobrir: buscar e filtrar; ler a ficha; cadastrar e editar uma escola; **a equipe vem dos locais de trabalho** (editada em Servidores, não aqui); o segmento como conveniência de filtro, não restrição; as opções do card (telefone, contagem de servidores, cards por linha) nas configurações; que escola sem segmento aparece em qualquer filtro (para poder completá-la). Carimbo: `> Atualizado na versão 0.19.0.`

- [ ] **Step 3: Versão + CHANGELOG**

`src/core/config.js`: `0.18.0` → `0.19.0`.

```markdown
## [0.19.0] - 2026-09-06

### Adicionado
- O card de **Escolas** ganhou opções (na engrenagem): mostrar o telefone
  principal, mostrar quantos servidores estão na unidade, e escolher quantos
  cards cabem por linha em telas largas. Servidores tem a mesma opção de
  cards por linha.

### Alterado
- No formulário de escola, o Nome ocupa a linha inteira, e "Transporte de
  alunos" e "Atende EJA" viraram interruptores.
- As dicas abaixo dos campos deixaram de sair em maiúsculas e negrito -
  valia para todos os formulários do sistema.
```

- [ ] **Step 4: Verificação final**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py` (checagem 11 verde: `escolas` tem `doc: true` **e** `.md`).

- [ ] **Step 5: Commit e push**

```bash
git add src/modules/escolas/module.js docs/modulos/escolas.md src/core/config.js CHANGELOG.md
git commit -m "chore: versao 0.19.0 e fecha o bloco de cards e formulario de Escolas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin dev
```

- [ ] **Step 6: Pendências para o André**

Nenhuma migration nova. Validar logado: as três opções no card de Escolas; cards por linha em Servidores; formulário; dicas discretas em todos os formulários.

---

## Self-Review

**Spec coverage:**
- D1 (três configs de exibição em Escolas; padrão desligado/desligado/3) → Tasks 2 e 3. `telefones_no_card` já veio do Bloco A. ✔
- D2 (contagem carregada só quando ligada, `import()` dinâmico, cache do model, conta vínculos abertos) → Task 3. ✔
- D3 (`--por-linha`, `minmax(0,1fr)`, ≥900px) → Task 2 Steps 4-5. ✔
- D4 (Servidores recebe `telefones_no_card` - já do A - e `cards_por_linha`; **não** `servidores_no_card`) → Task 2 Step 3. ✔
- D5 (Nome `col-full`) → Task 4 Step 1. ✔
- D6 (Transporte/EJA → `.switch`; payload igual) → Task 4 Step 2. ✔
- D7 (`.form-hint` global: `font-weight:400; text-transform:none; letter-spacing:0`) → Task 1 Step 1. ✔
- Critérios 1-10 → Tasks 1-5 + verificações.

**Placeholder scan:** sem TBD. `escolas.md` (Task 5) é redação guiada por tópicos, revisável em diff, coberta por `check_pii`. Task 4 Step 3 e Task 3 Step 3 têm "medir no browser" como passo explícito de calibração, não buraco.

**Type consistency:** `cardsPorLinha()` / `mostrarServidoresNoCard()` definidos na Task 2, usados nas Tasks 2-3. `carregarContagem()` / `contagemServidores` internos de `escolas.view.js` (Task 3). `getServidores`/`vinculosAbertos` - assinaturas reais de `servidores.model.js`.
