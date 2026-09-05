# Ícones e botões: um só padrão (Bloco I) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma só forma para cada affordance recorrente do hub: excluir = lixeira vermelha; fechar = `ico('fechar')`; adicionar = `ico('adicionar')`; lupa sempre dentro do campo de busca.

**Architecture:** Mudança de *uso*, não de traçado. `icones.js` já tem `fechar` e `adicionar`. A classe `.mini-btn.no` já é o padrão de fato para excluir em ~16 telas - ela passa a pintar vermelho **em repouso**, não só no hover. Os poucos desvios (o `×` de texto do editor de telefones, os `+ ` concatenados a rótulos, o `×` de texto da gaveta) são trocados um a um.

**Tech Stack:** JS ES modules puro, CSS com tokens (`--danger`), sem build. `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-05-icones-e-botoes-design.md`

## Global Constraints

- PT-BR em código, comentário, commit e interface.
- Branch `dev`. Commits frequentes.
- **Nenhuma cor literal** em `src/modules/**` nem em CSS novo - só `var(--token)`. `--danger` já existe.
- SVG, nunca emoji nem glifo de fonte para ícone.
- `[hidden]` some de verdade (`base.css` já tem a regra global).
- Legível em 375px, nos dois temas; alvo de toque `--toque` preservado em `(pointer: coarse)`.
- `python .claude/scripts/verificar_arquitetura.py` sem violações.
- Ao fechar: `CONFIG.versao` PATCH em `src/core/config.js` + `CHANGELOG.md` (texto para quem usa).

---

## Contexto verificado

- `icones.js` já expõe `fechar` (× do Feather) e `adicionar` (+ do Feather). **Não muda.**
- `.mini-btn.no` hoje: cinza em repouso, `border-color`/`color` viram `--danger` só no `:hover` (`components.css:361`).
- `.btn-perigo` (vermelho preenchido, só dentro de `confirmar.js`) **não muda e não se mistura** com o novo `.mini-btn.no`.
- `.mini-btn.no` + `ico('excluir')` aparece em: `afastamentos/views/lista.js:45`, `atas.view.js:113`, `calendario/views/escalas.js:261`, `escolas/views/detalhe.js:48`, `horarios/views/jornada.js:154`, `ocorrencias.view.js:176`, `projetos.view.js:130,175`, `sate/views/catalogo.js:50`, `sate/views/locais.js:46`, `servidores/views/detalhe.js:37,102`, `servidores/views/vinculo.js:86`, `usuarios/views/lista.js:102`, `visitas.view.js:164`. Todos são de fato destrutivos.
- **Único `.mini-btn.no` NÃO destrutivo:** `afastamentos/views/lista.js:49` - "Cancelar" (`data-cancelar`, `ico('fechar')`), que é cancelamento reversível com histórico preservado.
- `.phone-del`: `×` literal (`phones.js:85`) + CSS próprio (`components.css:975-976`, `:1029`). `color: var(--danger)`, `font-size: 18px`.
- `.phone-add`: `+ telefone` literal (`phones.js:67`).
- `drawer.js:86` (`drawerHead`): `<button class="drawer-close">×</button>` literal.
- `servidores.view.js:120`: chip "Equipe de …" com `<button>×</button>` literal.
- `+ Novo <coisa>` literal em: `afastamentos.view.js:53`, `projetos.view.js:37`, `sate/views/locais.js:24`, `servidores.view.js:45`, `visitas.view.js:53`, `atas.view.js` (conferir), `ocorrencias.view.js` (conferir), `servidores/views/detalhe.js:61` (`+ Novo vínculo`).
- `busca-selecao.js:44-50` já emite `ico('buscar')` como primeiro filho de `<label class="search bs-campo">`; `.search` é flex com o ícone à esquerda. O relato da lupa "fora do campo" precisa ser reproduzido na URL de dev antes de mexer.
- `.phone-row` é grid; a `[…]:has(> input, > select) > .mini-btn { min-height: var(--campo) }` (`components.css:384`) dá a altura de campo de graça a um `.mini-btn` filho direto.
- Testes existentes: `tests/icones.test.mjs`.
- `CONFIG.versao` atual: `0.14.5`.

---

## Task 1: `.mini-btn.no` vermelho em repouso

**Files:**
- Modify: `src/styles/components.css` (regra `.mini-btn.no`)
- Modify: `src/modules/afastamentos/views/lista.js:49` (tirar "Cancelar" de `.no`)

**Interfaces:**
- Consumes: token `--danger`.
- Produces: `.mini-btn.no` passa a ter `color: var(--danger)` sempre; nenhum seletor novo exportado.

- [ ] **Step 1: Aplicar a cor de repouso**

Em `src/styles/components.css`, a linha:

```css
.mini-btn.no:hover { border-color: var(--danger); color: var(--danger); }
```

vira:

```css
/* Excluir é a única ação que .no marca (a de "Cancelar" reversível saiu
   dela). Vermelho em repouso, não só no hover - é o padrão pedido. */
.mini-btn.no { color: var(--danger); }
.mini-btn.no:hover {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}
```

- [ ] **Step 2: Tirar "Cancelar" da classe `.no`**

Em `src/modules/afastamentos/views/lista.js:49`:

```js
        <button class="mini-btn no" data-cancelar="${a.id}" aria-label="Cancelar">${ico('fechar')}</button>`}
```

vira:

```js
        <button class="mini-btn" data-cancelar="${a.id}" aria-label="Cancelar">${ico('fechar')}</button>`}
```

- [ ] **Step 3: Varredura de confirmação**

Run: `grep -rn "mini-btn no" src/`
Expected: toda ocorrência restante é uma ação de **exclusão** (lista acima do plano). Se aparecer alguma nova não-destrutiva, tirar da classe como no Step 2.

- [ ] **Step 4: Verificação visual (controlador)**

Na URL de dev, abrir 3 telas com botão de excluir em lista (ficha de servidor, catálogo do SATE, jornada de horário) e confirmar: ícone vermelho legível nos dois temas, sem parecer botão preenchido; hover com leve fundo vermelho.

- [ ] **Step 5: Commit**

```bash
git add src/styles/components.css src/modules/afastamentos/views/lista.js
git commit -m "feat(ui): botao de excluir vermelho em repouso; Cancelar sai de .no

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: O `×` do editor de telefones morre

**Files:**
- Modify: `src/shared/ui/phones.js` (`rowHtml`, `phonesEditorHtml`, `montarPhonesEditor`)
- Modify: `src/styles/components.css` (remover `.phone-del`; acrescentar posicionamento do `.mini-btn` na grade)
- Test: `tests/phones.test.mjs` (criar, se não existir)

**Interfaces:**
- Consumes: `ico('excluir')`, `ico('adicionar')`.
- Produces: o botão de remover telefone passa a ser `<button class="mini-btn no phone-del" …>`; `lerPhonesEditor` e o seletor `.phone-del` do listener continuam funcionando (a classe `phone-del` fica no elemento como gancho de JS).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/phones.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phonesEditorHtml } from '../src/shared/ui/phones.js';

test('o botao de remover telefone usa a lixeira, nao um x de texto', () => {
  const html = phonesEditorHtml([{ numero: '(16) 3333-3333', tipo: 'fixo' }]);
  assert.ok(html.includes('phone-del'), 'mantém o gancho de JS .phone-del');
  assert.ok(/<svg[^>]*>/.test(html.match(/phone-del[\s\S]*?<\/button>/)[0]),
    'o botão contém um <svg>');
  assert.ok(!/>×<|>\+ telefone</.test(html), 'nenhum glifo de texto sobrou');
});

test('o botao de adicionar telefone usa o icone +', () => {
  const html = phonesEditorHtml([]);
  assert.ok(/phone-add[\s\S]*?<svg/.test(html));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/phones.test.mjs`
Expected: FAIL (`×` e `+ telefone` ainda são texto).

- [ ] **Step 3: Trocar o markup em `phones.js`**

`import { ico } from './icones.js';` já existe. Em `rowHtml`, a última linha antes de `</div>`:

```js
      <button type="button" class="phone-del" aria-label="Remover telefone">×</button>
```

vira:

```js
      <button type="button" class="mini-btn no phone-del" aria-label="Remover telefone">${ico('excluir', { tam: 14 })}</button>
```

Em `phonesEditorHtml`:

```js
      <button type="button" class="mini-btn phone-add">+ telefone</button>
```

vira:

```js
      <button type="button" class="mini-btn phone-add">${ico('adicionar', { tam: 14 })} telefone</button>
```

- [ ] **Step 4: Ajustar o CSS da grade**

Em `src/styles/components.css`, **remover**:

```css
.phone-del { justify-self: end; width: var(--toque); height: var(--campo); border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--danger); font-size: 18px; line-height: 1; cursor: pointer; }
.phone-del:hover { border-color: var(--danger); }
```

e a linha dentro do `@media (min-width: 560px)`:

```css
  .phone-del { width: 30px; }
```

Acrescentar, junto das outras regras de `.phone-row`:

```css
/* O botão de remover é um .mini-btn.no como em toda lista; na grade da
   linha ele fica à direita e com a altura de campo (a regra :has(> input)
   de components.css já dá o min-height). */
.phone-row > .phone-del { justify-self: end; }
```

- [ ] **Step 5: Rodar o teste**

Run: `node --test tests/phones.test.mjs`
Expected: PASS.

- [ ] **Step 6: Verificação visual (controlador)**

Editor de telefones na modal de servidor e na de escola, em 375px e desktop: o botão de remover alinha com os campos da linha; adicionar mostra o ícone + "telefone".

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui/phones.js src/styles/components.css tests/phones.test.mjs
git commit -m "feat(ui): editor de telefones usa lixeira e icone +, nao glifos de texto

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `fechar` é `ico('fechar')`

**Files:**
- Modify: `src/shared/ui/drawer.js:86` (`drawerHead`)
- Modify: `src/modules/servidores/servidores.view.js:120` (chip de unidade)
- Test: `tests/icones.test.mjs` (acrescentar) ou verificação por grep

**Interfaces:**
- Consumes: `ico('fechar')`. `drawer.js` já importa `ico`? Conferir - se não, `import { ico } from './icones.js';`.
- Produces: nenhum seletor novo. `.drawer-close` continua sendo o gancho de JS.

- [ ] **Step 1: `drawerHead`**

Conferir o import de `ico` no topo de `drawer.js`; acrescentar se faltar. Trocar:

```js
    <button class="drawer-close" type="button" aria-label="Fechar">×</button>
```

por:

```js
    <button class="drawer-close" type="button" aria-label="Fechar">${ico('fechar')}</button>
```

- [ ] **Step 2: Chip de unidade em Servidores**

`servidores.view.js:120`:

```js
    <button type="button" id="sv-limpa-uni" aria-label="Remover o filtro de unidade">×</button></span>`;
```

vira:

```js
    <button type="button" id="sv-limpa-uni" aria-label="Remover o filtro de unidade">${ico('fechar', { tam: 12 })}</button></span>`;
```

Conferir o import de `ico` no arquivo (já existe - `servidores.view.js:20`).

- [ ] **Step 3: Varredura**

Run: `grep -rn ">×<\|>× \|'×'\|\"×\"" src/`
Expected: nenhuma sobra em `src/modules/**` nem `src/shared/**`. (O `×` como caractere em comentário ou texto de conteúdo pode ficar.)

- [ ] **Step 4: Verificação visual (controlador)**

Abrir qualquer gaveta (ex.: ficha de servidor) e confirmar o × do cabeçalho alinhado como os outros ícones; abrir Servidores a partir de "Gerir servidores e vínculos" de uma escola e conferir o × do chip.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/drawer.js src/modules/servidores/servidores.view.js
git commit -m "feat(ui): fechar gaveta e remover chip usam ico(fechar), nao x de texto

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `+ Novo <coisa>` usa `ico('adicionar')`

**Files:**
- Modify: `src/modules/afastamentos/afastamentos.view.js`, `src/modules/projetos/projetos.view.js`, `src/modules/visitas/visitas.view.js`, `src/modules/atas/atas.view.js`, `src/modules/ocorrencias/ocorrencias.view.js`, `src/modules/sate/views/locais.js`, `src/modules/servidores/servidores.view.js`, `src/modules/servidores/views/detalhe.js`

**Interfaces:**
- Consumes: `ico('adicionar')`. Conferir/adicionar o import em cada arquivo.
- Produces: nada.

- [ ] **Step 1: Localizar todos os botões**

Run: `grep -rn "\"btn-primary\">+ \|'btn-primary'>+ \|>+ Novo\|>+ Nov" src/modules/`
Anotar a lista completa (a do contexto acima + o que o grep achar).

- [ ] **Step 2: Trocar um a um**

Para cada, o padrão é: `>+ Novo servidor</button>` → `>${ico('adicionar')} Novo servidor</button>`. Conferir que `ico` está importado no arquivo; `import { ico } from '<caminho>/shared/ui/icones.js';` se faltar (o caminho relativo varia: `../../shared/` para `*.view.js`, `../../../shared/` para `views/*.js`).

`servidores/views/detalhe.js:61`: `+ Novo vínculo` → `${ico('adicionar')} Novo vínculo` (nota: o rótulo "vínculo" muda no Bloco J, não aqui).

- [ ] **Step 3: Varredura**

Run: `grep -rn ">+ \|\"+ \|'+ " src/modules/`
Expected: só sobra `+ Outro…` dentro de `<option>` em `servidores/views/vinculo.js` (texto de lista suspensa, correto) e `escalas.model.js:106` (comentário).

- [ ] **Step 4: Sanidade**

Run: `python .claude/scripts/verificar_arquitetura.py`
Expected: sem violações (inclusive imports - o script checa grafo).

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/
git commit -m "feat(ui): botoes Novo <x> usam ico(adicionar) no lugar do + de texto

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: A lupa dentro do campo, sem exceção

**Files:**
- Modify (condicional): `src/styles/components.css` (regra do `.bs` / `.bs-campo`) e/ou `src/shared/ui/busca-selecao.js`

**Interfaces:**
- Consumes: `.search` (flex, ícone à esquerda).
- Produces: nada exportado; só CSS.

- [ ] **Step 1: Reproduzir (controlador)**

Na URL de dev, abrir "Novo vínculo" na ficha de um servidor. Observar o campo "Local": a lupa está dentro do campo (à esquerda do texto) ou acima/fora dele? Fotografar. Repetir na tela de Escalas do Calendário (usa o mesmo componente).

- [ ] **Step 2a: Se já estiver dentro**

Nada a corrigir no componente. Fazer a varredura do Step 3 mesmo assim e encerrar a task com uma nota "verificado: lupa dentro em todas as telas".

- [ ] **Step 2b: Se estiver fora**

A causa está no CSS que o `.bs` impõe sobre o `.search` aninhado. Conferir `.bs { position: relative; }` e `.bs-campo { width: 100%; }` (`components.css:1140-1141`) e o que mais casa `.bs .search` ou `.bs-campo`. Garantir que `.bs-campo` **não** anule o `display: flex` / `align-items: center` de `.search` nem tire o `gap`. Se `.bs-limpar` (position absolute) estiver empurrando algo, escopar. A correção deve ser mínima e no `.bs-campo`, nunca no `.search` base (que as listas usam e está correto).

- [ ] **Step 3: Varredura das telas de busca**

Listas com `<label class="search">`: `afastamentos`, `atas`, `escolas`, `ocorrencias`, `projetos`, `servidores`, `visitas`. Abrir cada uma na URL de dev e confirmar a lupa dentro do campo. (Essas já usam `.search` direto e devem estar certas - a verificação é barata e fecha o critério.)

- [ ] **Step 4: Commit (se houve mudança)**

```bash
git add src/styles/components.css src/shared/ui/busca-selecao.js
git commit -m "fix(ui): lupa dentro do campo tambem no seletor de busca (bs-campo)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Se não houve mudança, registrar no PR: "Task 5: verificado, lupa já dentro em todas as telas; nenhuma alteração."

---

## Task 6: Fechar a entrega

**Files:**
- Modify: `src/core/config.js`, `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-08-27-sistema-visual-design.md` (nota de remissão)

- [ ] **Step 1: Nota na spec do sistema visual**

Acrescentar ao fim de `2026-08-27-sistema-visual-design.md`:

```markdown
## Adendo (05/09/2026)

A coerência de *uso* dos ícones recorrentes (excluir / fechar / adicionar /
busca) foi tratada em `2026-09-05-icones-e-botoes-design.md`.
```

- [ ] **Step 2: Versão**

`src/core/config.js`: `versao: '0.14.5'` → `versao: '0.14.6'`.

- [ ] **Step 3: CHANGELOG**

No topo de `CHANGELOG.md`, seguindo o formato da entrada anterior:

```markdown
## [0.14.6] - 2026-09-05

### Alterado
- Todos os botões de excluir do sistema passaram a ter o mesmo desenho: uma
  lixeira vermelha. Antes, o mesmo "excluir" aparecia ora como um "x"
  vermelho, ora como uma lixeira cinza. Os botões de fechar e de adicionar
  também ficaram iguais em todas as telas.
```

- [ ] **Step 4: Verificador + testes**

Run: `python .claude/scripts/verificar_arquitetura.py` → sem violações.
Run: `node --test tests/` → PASS.

- [ ] **Step 5: Commit e push**

```bash
git add src/core/config.js CHANGELOG.md docs/superpowers/specs/2026-08-27-sistema-visual-design.md
git commit -m "chore: versao 0.14.6 e fecha o bloco de icones e botoes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin dev
```

---

## Self-Review

**Spec coverage:**
- D1 (uma affordance de excluir, vermelha em repouso; dois formatos por contexto) → Task 1. Os dois formatos (só ícone / ícone+texto) já existem no código; a task só muda a cor. ✔
- D2 (`×` do telefone morre; `+ telefone` vira ícone) → Task 2. ✔
- D3 (`fechar` é `ico('fechar')`; "Cancelar" sai de `.no`) → Task 3 + Task 1 Step 2. ✔
- D4 (`+` é `ico('adicionar')`) → Task 4. ✔
- D5 (lupa dentro do campo) → Task 5. ✔
- Adendo na spec do sistema visual → Task 6 Step 1. ✔
- Critérios 1-7 → Tasks 1-6 + verificações visuais.

**Placeholder scan:** sem TBD/TODO. Task 5 é condicional por natureza (depende de reproduzir o bug), mas os dois ramos estão escritos. Task 4 Step 1/2 pedem um `grep` para completar a lista porque os arquivos exatos de `atas`/`ocorrencias` não foram abertos - o padrão de troca está dado por inteiro.

**Type consistency:** `ico('fechar')`, `ico('adicionar')`, `ico('excluir')` - todos existem em `icones.js` (verificado). `.phone-del` mantida como classe-gancho de JS mesmo virando `.mini-btn.no`. `.mini-btn.no` usado igual em todas as telas.
