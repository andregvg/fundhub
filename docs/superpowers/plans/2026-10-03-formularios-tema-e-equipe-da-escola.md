# Formulários, tema e equipe da escola - Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar os 20 ajustes da spec em três blocos: formulários e SATE (A), tema e Configurações (B), equipe da escola e mapa (C, com a migration 045).

**Architecture:** Funções puras novas (data `dd/mm`, tema, rótulo e ordem do vínculo) nascem com teste em `node --test`. CSS global em `tokens.css`/`components.css`. O tema vira atributo `data-tema` no `<html>`, com `core/tema.js` de dono. A função do gestor é uma coluna em `vinculo`, e a troca com data fecha um período e abre outro. O mapa com pino muda para `shared/ui/`.

**Tech Stack:** JS ES modules sem build, CSS puro, testes `node:test`, servidor `.claude/devserver.py` (porta 8123), Supabase (migration aplicada à mão pelo André).

**Spec:** `docs/superpowers/specs/2026-10-03-formularios-tema-e-equipe-da-escola-design.md` - ler inteira antes da primeira tarefa. Cada tarefa cita a decisão (D1…D20) que implementa.

## Global Constraints

- Sem npm, sem bundler, sem dependência nova (CLAUDE.md "Sem build").
- Nenhum dado real em código, comentário, teste ou doc: "Escola Exemplo", "SERVIDOR EXEMPLO", `nome@exemplo.com`, `(00) 00000-0000` (R7). O placeholder `(16) 99999-9999` é pedido explícito da spec e não é número real.
- Todo valor vindo do banco **ou digitado** passa por `esc()` antes de entrar em template literal (R5).
- Nenhuma cor literal em `src/modules/**` - só `var(--token)` (R9). Cor literal só em `tokens.css` e nas data URIs de `components.css`.
- **Fundo de campo é sempre `background-color`, nunca o atalho `background`** (D1): o atalho apaga o ícone desenhado como `background-image`.
- Model nunca toca DOM; view nunca chama `sb()` (R3). Só `*.model.js` atravessa a fronteira de módulo (R2). Zero ciclos (R4): a direção é `equipe.model.js` → `vinculos.model.js` → `servidores.model.js`, **nunca o contrário**.
- Data civil é string `yyyy-mm-dd`; nada de `toISOString`/`toLocale*` fora de `shared/format.js` (R8).
- View ≤ 400 linhas, model ≤ 250 (R11). Arquivo novo ≥ ~60 linhas.
- PT-BR em código, comentário, commit e interface. Comentários explicam o **porquê**, na densidade do arquivo vizinho.
- Mexeu em tela ou regra de módulo com tutorial: `docs/modulos/<id>.md` no **mesmo commit** (skill `atualizar-ajuda`), sem nome de arquivo, tabela ou função.
- Commits na **`dev`**, `tipo(escopo): descrição` em português, terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  **Depois de cada commit: `git push origin dev`** (autorizado pelo André em 03/10/2026).
- Antes de cada commit: `git diff --cached` lido procurando dado real.
- Versões-alvo, **só na Tarefa 13**: `CONFIG.versao` **0.39.0**, `CONFIG.versaoSate` **0.18.0**.

**Rodar os testes:** `node --test tests/*.mjs` (na raiz).
**Verificar arquitetura:** `python .claude/scripts/verificar_arquitetura.py`.

**Navegador (dev-local), quando a tarefa pedir** - seguir a memória `fundhub-teste-devlocal`:
1. `src/core/config.js` → `supabaseAnonKey: ''`;
2. `src/core/perfil.js`, ramo `if (!hasSupabase())` → devolver `{ email:'dev@local', papel:'admin_sme', isAdmin:true }` e chamar `definirMapa(new Proxy({}, { get: () => 'escrita' }))` antes;
3. `preview_start` com `name: "fundhub"`; **`resize_window` para uma largura real antes de medir** (o painel abre com ~1px);
4. navegar com `?v=N` para furar o cache dos módulos;
5. abrir um modal sem navegar a fundo: `javascript_tool` com `(await import('/src/modules/<x>/views/<y>.js')).<funcao>(...)`.
**Reverter 1 e 2 antes de qualquer commit** e conferir `grep -rn "dev@local" src/` (só `docs.content.js` pode citar).

---

# Bloco A - Formulários e SATE

### Task 1: Campos - ícones, fundo, seta do `select`, grupo e filtros (D1, D3, D4, D8, D2-1a)

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/components.css` (§ Formulários ~687-700, ícones ~781-800, grupo de modal ~1338-1342, `.filtro-campo` ~267-282, `.campo-solto` ~515-527, `.search` em formulário ~207, painel ~1514)

**Interfaces:**
- Produces: tokens `--campo-bg`, `--campo-borda`. A Tarefa 6 converte os blocos `@media (prefers-color-scheme: dark)` criados aqui.

- [ ] **Step 1: Tokens.** Em `tokens.css`, no primeiro `:root`, depois de `--campo-fonte`:

```css
  /* Fundo e borda do campo de formulário (spec 2026-10-03, D3). Um token
     só, dentro e fora de grupo: antes o campo era --surface-2 solto e
     --surface dentro do grupo de modal, e nos dois casos ficava a um
     passo do fundo do modal. O campo é AFUNDADO - mais escuro que a
     superfície nos dois temas -, que é o que o separa do cartão do
     grupo sem depender da cor de destaque. */
  --campo-bg: #eef1f6;
  --campo-borda: #c3cad3;
```

No bloco escuro (`@media (prefers-color-scheme: dark) { :root {`), junto dos outros:

```css
    --campo-bg: #0e1424;
    --campo-borda: #3a4358;
```

E os tons do grupo (os dois blocos `body { … }` do fim do arquivo):

```css
/* claro E escuro: 4% e 15% (spec 2026-10-03, D2) */
  --grupo-bg: color-mix(in srgb, var(--brand) 4%, var(--surface));
  --grupo-borda: color-mix(in srgb, var(--brand) 15%, var(--border));
```

- [ ] **Step 2: O campo usa o token, com `background-color`.** Em `components.css`, na regra `.form-grid input, … .esc-form textarea`:

```css
  border: 1px solid var(--campo-borda);
  border-radius: var(--radius-btn);
  background-color: var(--campo-bg);   /* -color, nunca o atalho: ver D1 */
```

- [ ] **Step 3: Sai a regra "campo mais claro que o grupo".** Apagar o bloco (comentário + regra) que começa em `/* Campo mais claro que o grupo` e termina em `background: var(--surface); }`. É ela que apagava os ícones: o atalho `background` zera `background-image`.

- [ ] **Step 4: Varredura do atalho.** Rodar `grep -n "background:" src/styles/components.css` e, em toda regra cujo seletor alcança `input`, `select` ou `textarea` (`.filtro-campo select, .filtro-campo input`, `.campo-solto`, `.campo-derivado`, e a regra de `.search` dentro de formulário logo abaixo de "Dentro de formulário a busca é mais um campo"), trocar `background:` por `background-color:`. Em `.campo-derivado` e na `.search` de formulário o valor passa a `var(--campo-bg)` e a borda a `var(--campo-borda)`; `.filtro-campo` e `.campo-solto` mantêm `var(--surface)`.

- [ ] **Step 5: Seta do `select`.** Logo depois do bloco `@supports selector(::-webkit-calendar-picker-indicator) { … }`:

```css
/* Seta do <select> desenhada por nós (spec 2026-10-03, D4): a nativa cola
   na borda direita, e o recuo dela não é estilizável. Fica a 10px - o
   mesmo recuo do texto digitado. Mesma técnica e mesma ressalva dos ícones
   de data e hora acima: data URI não enxerga var(), então são duas cores
   copiadas de --muted (tokens.css). */
:is(.form-grid, .esc-form, .filtro-campo) select:not([multiple]),
select.campo-solto {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23656d76' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 12px 12px;
  padding-right: 30px;
}
@media (prefers-color-scheme: dark) {
  :is(.form-grid, .esc-form, .filtro-campo) select:not([multiple]),
  select.campo-solto {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2393a0bd' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  }
}
```

- [ ] **Step 6: Filtros não esticam (D8).** No `@media` de 560px, trocar `.painel-filtros .filtro-campo { flex: 1 1 180px; }` por:

```css
  /* Não cresce (spec 2026-10-03, D8): um select de três opções esticado
     até a borda do painel lê como campo de texto. Sobra espaço à direita. */
  .painel-filtros .filtro-campo { flex: 0 1 220px; }
```

- [ ] **Step 7: Navegador.** Dev-local, largura 1280 e 380, tema claro e escuro (`resize_window` com `colorScheme`):
  - `#/servidores` → "Novo servidor": os três campos de data mostram o ícone de calendário; `sate.html` → "Nova solicitação": data e horas com ícone.
  - Campo visivelmente distinto do fundo do modal **e** do cartão do grupo, nos dois temas. Ajustar os quatro valores do Step 1 se o contraste ficar duro ou fraco; registrar os valores finais no relatório.
  - `select` (cargo, em "Novo servidor"): seta a 10px da borda, texto não passa por baixo dela.
  - `#/escolas`: o select "Oferta" não estica; sobra espaço depois do interruptor EJA.
  - `read_console_messages` sem erro. Capturas de antes e depois do modal "Novo servidor", claro e escuro.

- [ ] **Step 8: Verificar e commitar.**

```bash
node --test tests/*.mjs && python .claude/scripts/verificar_arquitetura.py
git add src/styles/tokens.css src/styles/components.css
git commit -m "fix(ui): icones de data e hora de volta, fundo proprio do campo, seta do select e filtros sem esticar"
git push origin dev
```

---

### Task 2: Editor de telefones e e-mail institucional (D5, D6)

**Files:**
- Modify: `src/shared/ui/phones.js`
- Modify: `src/styles/components.css` (`.phones`, `.phone-row`, ~1475-1493 e ~1537-1545)
- Modify: `src/modules/servidores/views/formulario.js`
- Modify: `src/modules/escolas/views/formulario.js` (só se precisar passar `tipoPadrao`: o padrão já é `fixo`)
- Test: `tests/phones.test.mjs`
- Docs: `docs/modulos/servidores.md`, `docs/modulos/escolas.md`

**Interfaces:**
- Produces: `phonesEditorHtml(lista, { label = 'Telefones', tipoPadrao = 'fixo' })`.

- [ ] **Step 1: Teste que falha.** Acrescentar a `tests/phones.test.mjs`:

```js
test('lista vazia já nasce com uma linha em branco', () => {
  const html = phonesEditorHtml([]);
  assert.equal((html.match(/class="phone-row"/g) || []).length, 1);
});

test('a linha inicial usa o tipo padrão de quem chama', () => {
  const html = phonesEditorHtml([], { tipoPadrao: 'celular' });
  assert.match(html, /<option value="celular" selected>/);
  assert.match(html, /data-tipo-padrao="celular"/);
});

test('lista com telefones não ganha linha extra', () => {
  const html = phonesEditorHtml([{ numero: '(00) 0000-0000', tipo: 'fixo' }]);
  assert.equal((html.match(/class="phone-row"/g) || []).length, 1);
});
```

- [ ] **Step 2: Rodar e ver falhar.** `node --test tests/phones.test.mjs` → as duas primeiras falham.

- [ ] **Step 3: Implementar em `phones.js`.**

```js
// HTML do editor. `lista` = [{ id?, tipo, rotulo, numero, principal }].
// Lista vazia nasce com UMA linha em branco (spec 2026-10-03, D5): o caso
// comum é ter um telefone, e "+ telefone" fica para o segundo. Linha sem
// número não é gravada - lerPhonesEditor já a descarta.
export function phonesEditorHtml(lista = [], { label = 'Telefones', tipoPadrao = 'fixo' } = {}) {
  const linhas = (lista || []).length ? lista : [{ tipo: tipoPadrao }];
  return `
    <div class="phones" data-phones data-tipo-padrao="${esc(tipoPadrao)}">
      <div class="lbl">${esc(label)}</div>
      <div class="phone-rows">${linhas.map(rowHtml).join('')}</div>
      <button type="button" class="mini-btn phone-add">${ico('adicionar', { tam: 14 })} telefone</button>
    </div>`;
}
```

Em `rowHtml`, o `<option>` precisa sair exatamente como `<option value="celular" selected>`: trocar a montagem por

```js
    .map(([v, r]) => `<option value="${v}"${t.tipo === v ? ' selected' : ''}>${r}</option>`)
```

Em `montarPhonesEditor`, o "+ telefone" usa o tipo do editor:

```js
    rows.insertAdjacentHTML('beforeend', rowHtml({ tipo: box.dataset.tipoPadrao || 'fixo' }));
```

O placeholder do número continua `(16) 00000-0000`.

- [ ] **Step 4: CSS.** A linha deixa de ser uma caixa:

```css
/* A linha é parte da grade do formulário, não um cartão dentro dele (spec
   2026-10-03, D5): sem borda, fundo nem padding próprios. */
.phone-row { display: grid; grid-template-columns: 1fr; gap: 8px; }
/* Um telefone só: não há "principal" a escolher. O rádio continua no DOM
   (lerPhonesEditor o lê), só não aparece. */
.phone-rows:has(> .phone-row:only-child) .phone-pri { display: none; }
```

No `@media` de 560px, a grade passa a ter a coluna do "principal" colapsável:

```css
  .phone-row {
    grid-template-columns: 110px minmax(132px, 1.1fr) minmax(96px, 1fr) auto auto;
    align-items: center;
    gap: 8px;
  }
```

e sai a regra que baixava `padding`/`font-size` dos campos da linha para 13px (eles passam a ter a métrica de todo campo).

- [ ] **Step 5: Servidor - telefone e e-mail.** Em `servidores/views/formulario.js`:

```js
import { CONFIG } from '../../../core/config.js';
```

No grupo Contato:

```js
            <label class="col-full">E-mail institucional
              <input id="s-email" type="text" inputmode="email" autocomplete="off" autocapitalize="none"
                     spellcheck="false" pattern="[^@\\s]+@[^@\\s]+\\.[^@\\s]+"
                     title="Informe o e-mail completo, como nome@dominio" value="${v('email')}" /></label>
            <div class="col-full">${phonesEditorHtml(s?.telefones, { tipoPadrao: 'celular' })}</div>
```

Depois de `montarPhonesEditor(form)`:

```js
  ligarDominio(document.getElementById('s-email'));
```

E a função, no fim do arquivo, antes de `salvarServidor`:

```js
// E-mail institucional (spec 2026-10-03, D6): ao digitar o "@", o domínio
// da rede entra JÁ SELECIONADO - quem tem o domínio padrão segue em frente,
// quem tem outro continua digitando e o texto selecionado é substituído.
// Só no primeiro "@", e só quando ele é o último caractere: colar um
// e-mail inteiro ou editar o meio não dispara nada.
// `type="text"` e não "email": o campo de e-mail não aceita setSelectionRange.
function ligarDominio(el) {
  el.addEventListener('input', (e) => {
    if (e.data !== '@' || el.value.indexOf('@') !== el.value.length - 1) return;
    const ate = el.value.length;
    el.value += CONFIG.dominioInstitucional.slice(1);
    el.setSelectionRange(ate, el.value.length);
  });
}
```

- [ ] **Step 6: Testes passam.** `node --test tests/*.mjs` → tudo verde.

- [ ] **Step 7: Navegador.** "Novo servidor": uma linha de telefone à vista, sem moldura, alinhada à grade; sem interruptor "principal"; "+ telefone" cria a segunda e o interruptor aparece nas duas. Digitar `nome@` no e-mail → domínio completa, selecionado; digitar `x` substitui a seleção. "Nova escola" e "Meus dados": mesma linha, tipo inicial Fixo. Largura 380: a linha empilha. Console limpo.

- [ ] **Step 8: Tutoriais e commit.** Atualizar `docs/modulos/servidores.md` e `escolas.md` (passo a passo de telefone e de e-mail; carimbo "Atualizado na versão 0.39.0").

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/shared/ui/phones.js src/styles/components.css src/modules/servidores src/modules/escolas tests/phones.test.mjs docs/modulos
git commit -m "feat(formularios): telefone ja com uma linha e e-mail institucional com dominio sugerido"
git push origin dev
```

---

### Task 3: Data civil a partir de `dd/mm` (D2-1b, parte pura)

**Files:**
- Modify: `src/shared/format.js`
- Create: `tests/format-dia-mes.test.mjs`

**Interfaces:**
- Produces:
  - `mascaraDiaMes(v: string): string` - `'1403'` → `'14/03'`; `'14032027'` → `'14/03/2027'`.
  - `dataDeDiaMes(texto: string, hoje = hojeISO()): string | null` - data civil `yyyy-mm-dd` ou `null`.
  - `diaMesDe(iso: string): string` - `'2026-03-14'` → `'14/03'`.

- [ ] **Step 1: Teste que falha.** `tests/format-dia-mes.test.mjs`:

```js
// Data sem ano (spec 2026-10-03, D2): a escola digita dia e mês, e o ano
// é o vigente - ou o seguinte, se a data já passou.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mascaraDiaMes, dataDeDiaMes, diaMesDe } from '../src/shared/format.js';

test('a máscara põe a barra enquanto se digita', () => {
  assert.equal(mascaraDiaMes('1'), '1');
  assert.equal(mascaraDiaMes('14'), '14');
  assert.equal(mascaraDiaMes('140'), '14/0');
  assert.equal(mascaraDiaMes('1403'), '14/03');
  assert.equal(mascaraDiaMes('14032027'), '14/03/2027');
  assert.equal(mascaraDiaMes('14/03'), '14/03');
  assert.equal(mascaraDiaMes('140320279'), '14/03/2027');
});

test('dia e mês assumem o ano de hoje', () => {
  assert.equal(dataDeDiaMes('14/03', '2026-02-01'), '2026-03-14');
  assert.equal(dataDeDiaMes('1403', '2026-02-01'), '2026-03-14');
});

test('hoje ainda é este ano', () => {
  assert.equal(dataDeDiaMes('14/03', '2026-03-14'), '2026-03-14');
});

test('data que já passou vai para o ano seguinte', () => {
  assert.equal(dataDeDiaMes('10/02', '2026-12-05'), '2027-02-10');
});

test('oito dígitos dizem o ano', () => {
  assert.equal(dataDeDiaMes('14/03/2028', '2026-02-01'), '2028-03-14');
});

test('dia que não existe é null', () => {
  assert.equal(dataDeDiaMes('31/02', '2026-01-01'), null);
  assert.equal(dataDeDiaMes('00/05', '2026-01-01'), null);
  assert.equal(dataDeDiaMes('10/13', '2026-01-01'), null);
  assert.equal(dataDeDiaMes('31/04/2026', '2026-01-01'), null);
});

test('29/02 só existe em ano bissexto', () => {
  assert.equal(dataDeDiaMes('29/02', '2028-01-10'), '2028-02-29');
  assert.equal(dataDeDiaMes('29/02', '2027-01-10'), '2028-02-29');   // 2027 não tem; 2028 tem
  assert.equal(dataDeDiaMes('29/02', '2025-01-10'), null);           // nem 2025 nem 2026
});

test('texto incompleto é null', () => {
  assert.equal(dataDeDiaMes('', '2026-01-01'), null);
  assert.equal(dataDeDiaMes('14/0', '2026-01-01'), null);
  assert.equal(dataDeDiaMes('14/03/20', '2026-01-01'), null);
});

test('diaMesDe devolve dd/mm', () => {
  assert.equal(diaMesDe('2026-03-14'), '14/03');
  assert.equal(diaMesDe(''), '');
});
```

- [ ] **Step 2: Rodar e ver falhar.** `node --test tests/format-dia-mes.test.mjs` → "mascaraDiaMes is not a function".

- [ ] **Step 3: Implementar.** Em `src/shared/format.js`, depois de `addDias`:

```js
// ── Data sem ano ─────────────────────────────────────────────
// Campo "dd/mm" (spec 2026-10-03, D2): a pessoa digita dia e mês, o ano é
// o vigente. Tudo aqui trabalha com STRING - a data civil nunca vira Date
// para ser formatada (R8). O único Date é aritmética de calendário
// (quantos dias tem o mês).

// '1403' → '14/03' · '14032027' → '14/03/2027'. Progressiva: formata o
// que já foi digitado.
export function mascaraDiaMes(v) {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function existeDia(ano, mes, dia) {
  if (!(mes >= 1 && mes <= 12 && dia >= 1)) return false;
  return dia <= new Date(ano, mes, 0).getDate();   // dia 0 do mês seguinte = último deste
}

// 'dd/mm' ou 'dd/mm/aaaa' → 'yyyy-mm-dd', ou null se incompleto ou
// inexistente. Sem ano: o de `hoje`; se a data já passou, o seguinte -
// pedido de dezembro para fevereiro é caso real, e data no passado nunca é
// o que a pessoa quis dizer.
export function dataDeDiaMes(texto, hoje = hojeISO()) {
  const d = String(texto ?? '').replace(/\D/g, '');
  if (d.length !== 4 && d.length !== 8) return null;
  const dd = d.slice(0, 2), mm = d.slice(2, 4);
  const monta = (ano) => (existeDia(ano, Number(mm), Number(dd))
    ? `${String(ano).padStart(4, '0')}-${mm}-${dd}` : null);
  if (d.length === 8) return monta(Number(d.slice(4)));
  const ano = Number(String(hoje).slice(0, 4));
  const neste = monta(ano);
  return neste && neste >= hoje ? neste : monta(ano + 1);
}

// '2026-03-14' → '14/03'
export function diaMesDe(iso) {
  return iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '';
}
```

- [ ] **Step 4: Rodar e ver passar.** `node --test tests/format-dia-mes.test.mjs` → todos passam.

- [ ] **Step 5: Commit.**

```bash
node --test tests/*.mjs
git add src/shared/format.js tests/format-dia-mes.test.mjs
git commit -m "feat(format): data civil a partir de dia e mes, com o ano assumido"
git push origin dev
```

---

### Task 4: SATE - grupos "Quando" e "Responsável" do pedido (D2)

**Files:**
- Create: `src/modules/sate/views/formulario-quando.js`
- Create: `src/modules/sate/views/formulario-responsavel.js`
- Modify: `src/modules/sate/views/formulario.js`
- Modify: `src/modules/sate/sate.css`
- Create: `src/modules/servidores/equipe.model.js` (recebe `getEquipeDaUnidade`, que SAI de `vinculos.model.js`; ganha `eSupervisao` e a marca `supervisao`)
- Modify: `src/modules/servidores/vinculos.model.js` (sai `getEquipeDaUnidade`)
- Modify: `src/modules/escolas/views/detalhe.js` (só o caminho do import de `getEquipeDaUnidade`)
- Create: `tests/vinculos.test.mjs`
- Docs: `docs/modulos/sate.md`

**Interfaces:**
- Consumes: `mascaraDiaMes`, `dataDeDiaMes`, `diaMesDe`, `fmtExtenso` (`shared/format.js`); `marcarVazio` (`shared/ui/campo-data-hora.js`); `periodoDe`, `PERIODOS` (`sate/regras.model.js`); `getEquipeDaUnidade` (`servidores/equipe.model.js`).
- Produces:
  - `quandoHtml(minData: string): string`, `ligarQuando(aoMudar: () => void): void`. Os ids `f-data` (date nativo, fonte da verdade `yyyy-mm-dd`), `f-emb`, `f-ret` **não mudam** - o resto do formulário continua lendo `val('f-data')`.
  - `responsavelHtml(): string`, `ligarResponsavel(): void`, `carregarEquipe(unidadeId: string): Promise<void>`. Ids `f-prof` e `f-tel` não mudam.
  - `servidores/equipe.model.js` (model novo, API pública): `CARGO_SUPERVISAO = 'Supervisor(a)'`, `eSupervisao(cargo: string): boolean`; `getEquipeDaUnidade(unidadeId)` (movida de `vinculos.model.js`) passa a devolver `supervisao: boolean` em cada pessoa.

- [ ] **Step 1: Teste que falha.** `tests/vinculos.test.mjs`:

```js
// Regras do vínculo que outras telas leem: quem é supervisão (não é equipe
// da escola) - spec 2026-10-03, D13.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eSupervisao } from '../src/modules/servidores/equipe.model.js';

test('supervisão é reconhecida pelo rótulo canônico e pelo legado', () => {
  assert.equal(eSupervisao('Supervisor(a)'), true);
  assert.equal(eSupervisao('supervisor'), true);        // papel anterior à migration 023
  assert.equal(eSupervisao('Gestor(a)'), false);
  assert.equal(eSupervisao('Coordenador(a)'), false);
  assert.equal(eSupervisao(''), false);
  assert.equal(eSupervisao(null), false);
});
```

`node --test tests/vinculos.test.mjs` → falha ("eSupervisao is not a function").

- [ ] **Step 2: Model novo - `src/modules/servidores/equipe.model.js`.** `getEquipeDaUnidade` SAI de `vinculos.model.js` (apagar a função e o comentário dela de lá; tirar de lá os imports que ficarem sem uso - `getServidoresDaUnidade`, e `vinculosAbertos` se nada mais o usar) e passa a morar aqui, com a regra de supervisão. Motivo: `vinculos.model.js` é o CADASTRO do vínculo e estouraria o teto de 250 linhas com o que as Tarefas 4 e 8 acrescentam; a LEITURA da equipe é outro agregado. O arquivo nasce pequeno, mas é importado por dois módulos já nesta tarefa (Escolas e SATE).

```js
// ============================================================
// FundHub - modules/servidores/equipe.model.js
// A EQUIPE de uma unidade: quem trabalha lá agora, com que cargo - a
// leitura que as outras telas fazem do vínculo (ficha da escola, pedido
// do SATE, Horários).
//
// Separado de vinculos.model.js por ser outro agregado, e não só para
// caber no teto: aquele é o CADASTRO do vínculo (criar, editar,
// encerrar); este é a LEITURA da equipe, com as regras de quem é equipe
// e quem não é. Os dois são API pública do módulo (R2).
//
// Direção dos imports (R4): equipe → vinculos → servidores. Nunca o
// contrário.
// ============================================================
import { getServidoresDaUnidade, vinculosAbertos } from './servidores.model.js';
import { rotulaCargo } from './vinculos.model.js';

// Supervisão NÃO é equipe da escola (spec 2026-10-03, D13): o supervisor
// trabalha na Secretaria e acompanha várias unidades. O vínculo dele com a
// escola continua existindo - é o que registra "supervisiona esta escola"
// e o que dá a ele acesso aos dados dela -, mas é lido como supervisão.
// Reconhecida pelo rótulo canônico (o que a migration 023 produz); a regra
// mora aqui, num lugar só, para virar marca no banco se um dia precisar.
export const CARGO_SUPERVISAO = 'Supervisor(a)';
export const eSupervisao = (cargo) => rotulaCargo(cargo) === CARGO_SUPERVISAO;

// Quem tem local de trabalho aberto na unidade, já na forma de LEITURA que
// outra tela exibe: { id, nome, cargo, email, telefone, supervisao }.
//   - o cargo é o do(s) vínculo(s) aberto(s) NESTA unidade, não o geral -
//     quem responde por duas unidades aparece em cada uma com o cargo de lá;
//   - o telefone é o principal, ou o primeiro se nenhum for;
//   - `supervisao` marca quem só SUPERVISIONA a unidade: quem consome
//     decide onde mostrar (a ficha da escola separa; o SATE e Horários
//     deixam de fora).
// Ordenada por nome. Lê o cache de servidores, que toda gravação invalida.
export async function getEquipeDaUnidade(unidadeId) {
  const servidores = await getServidoresDaUnidade(unidadeId);
  return servidores.map(s => {
    const daqui = vinculosAbertos(s).filter(v => v.unidade_id === unidadeId);
    const cargo = [...new Set(daqui.map(v => rotulaCargo(v.papel)).filter(Boolean))].join(' · ');
    const tels = s.telefones || [];
    const tel = tels.find(t => t.principal) || tels[0];
    return {
      id: s.id, nome: s.nome, cargo, email: s.email || '', telefone: tel?.numero || '',
      // Só supervisão NESTA unidade: quem é coordenador aqui e supervisor de
      // outra escola continua sendo equipe daqui.
      supervisao: daqui.length > 0 && daqui.every(v => eSupervisao(v.papel)),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}
```

Em `escolas/views/detalhe.js`, o import passa a `import { getEquipeDaUnidade } from '../../servidores/equipe.model.js';`. Conferir que ninguém mais importava a função do lugar antigo: `grep -rn "getEquipeDaUnidade" src`. Atualizar o cabeçalho de `vinculos.model.js` se ele citar a equipe. `node --test tests/vinculos.test.mjs` → passa.

- [ ] **Step 3: `formulario-quando.js`.**

```js
// ============================================================
// FundHub - sate/views/formulario-quando.js
// O grupo QUANDO do modal de solicitação (spec 2026-10-03, D2). Separado
// de formulario.js por ter estado e contrato próprios, como
// formulario-destino.js: a data sem ano, os dois horários e o período
// calculado - o formulário só pergunta "quando?".
//
// A data é digitada como dd/mm: o campo nativo de data não deixa esconder
// o ano, e quem pede um ônibus pensa em "14/03", não em "14/03/2026". O
// <input type="date"> continua existindo, escondido, por dois motivos: é
// ele que abre o calendário do navegador (showPicker) e é dele que o
// resto do formulário lê a data civil (`val('f-data')`), sem saber que o
// campo visível mudou.
// ============================================================
import { periodoDe, PERIODOS } from '../regras.model.js';
import { mascaraDiaMes, dataDeDiaMes, diaMesDe, fmtExtenso } from '../../../shared/format.js';
import { marcarVazio } from '../../../shared/ui/campo-data-hora.js';
import { esc, val } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';

const DICA = 'Dia e mês. O ano é o atual - ou o próximo, se a data já passou.';

export const quandoHtml = (minData) => `
  <fieldset class="form-grupo">
    <legend>Quando</legend>
    <div class="campos duas">
      <div class="lbl col-2">
        <label for="f-dia">Data</label>
        <span class="data-curta">
          <input id="f-dia" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm"
                 maxlength="10" required aria-describedby="f-data-ext" />
          <button type="button" class="data-curta-btn" id="f-data-btn"
                  aria-label="Escolher a data no calendário">${ico('calendario', { tam: 16 })}</button>
          <input id="f-data" class="data-curta-nativo" type="date" min="${esc(minData)}"
                 tabindex="-1" aria-hidden="true" />
        </span>
        <small class="form-hint" id="f-data-ext" aria-live="polite">${DICA}</small>
      </div>
      <label>Horário de embarque <input id="f-emb" type="time" required /></label>
      <label>Horário de saída do evento <input id="f-ret" type="time" required /></label>
      <p class="form-hint col-2">Somente números, ex.: 0730 → 07h30</p>
      <p class="sol-periodo col-2" id="f-periodo" aria-live="polite"></p>
    </div>
  </fieldset>`;

// 'dd/mm' quando o ano é o que seria assumido; 'dd/mm/aaaa' quando a
// pessoa escolheu outro no calendário - senão o texto mentiria sobre o ano.
const textoDe = (iso) => (dataDeDiaMes(diaMesDe(iso)) === iso
  ? diaMesDe(iso) : `${diaMesDe(iso)}/${iso.slice(0, 4)}`);

// O período é calculado (spec 2026-09-27, D4): a escola vê, não escolhe.
function pintarPeriodo() {
  const p = periodoDe(val('f-emb'), val('f-ret'));
  document.getElementById('f-periodo').innerHTML = p
    ? `${ico(p === 'noite' ? 'noturno' : 'horario', { tam: 14 })}<span>Período</span><b>${esc(PERIODOS[p])}</b>`
    : '';
}

export function ligarQuando(aoMudar) {
  const dia = document.getElementById('f-dia');
  const nativo = document.getElementById('f-data');
  const ext = document.getElementById('f-data-ext');

  const pintarExtenso = () => {
    const digitos = dia.value.replace(/\D/g, '').length;
    const completo = digitos === 4 || digitos === 8;
    const invalida = completo && !nativo.value;
    ext.textContent = nativo.value ? fmtExtenso(nativo.value) : (invalida ? 'Essa data não existe.' : DICA);
    ext.classList.toggle('err', invalida);
  };

  dia.addEventListener('input', () => {
    dia.value = mascaraDiaMes(dia.value);
    const iso = dataDeDiaMes(dia.value) || '';
    if (nativo.value !== iso) { nativo.value = iso; marcarVazio(nativo); aoMudar(); }
    pintarExtenso();
  });
  // Escolheu no calendário: o texto acompanha.
  nativo.addEventListener('change', () => {
    dia.value = nativo.value ? textoDe(nativo.value) : '';
    pintarExtenso();
    aoMudar();
  });
  document.getElementById('f-data-btn').addEventListener('click', () => {
    // Navegador sem showPicker: o campo de texto continua sendo o caminho.
    try { nativo.showPicker(); } catch (_) { dia.focus(); }
  });

  for (const id of ['f-emb', 'f-ret']) {
    document.getElementById(id).addEventListener('change', () => { pintarPeriodo(); aoMudar(); });
  }
  pintarPeriodo();
}
```

- [ ] **Step 4: `formulario-responsavel.js`.**

```js
// ============================================================
// FundHub - sate/views/formulario-responsavel.js
// O grupo RESPONSÁVEL PELA VISITA do modal de solicitação (spec
// 2026-10-03, D2). O campo sugere a equipe da escola escolhida - gestores
// e coordenadores, sem a supervisão - e, quando um deles é o responsável,
// preenche o telefone principal, que o cadastro já tem.
//
// <datalist> e não a busca-seleção: aqui o nome digitado à mão é resposta
// tão legítima quanto a sugestão (o responsável pode ser um professor que
// não está no cadastro), e a busca-seleção descarta o texto que não vira
// escolha. A lista tem três ou quatro nomes; o nativo dá conta.
//
// Sem equipe cadastrada, sem permissão de leitura ou com a consulta
// falhando, a lista fica vazia e o campo é texto livre - como era.
// ============================================================
import { getEquipeDaUnidade } from '../../servidores/equipe.model.js';
import { esc, norm } from '../../../shared/dom.js';
import { isUuid } from '../../../shared/format.js';
import { formatarTelefone, exibirTelefone } from '../../../shared/ui/phones.js';

let equipe = [];
// Trocar de escola duas vezes: a resposta da primeira não pode pintar por
// cima da segunda (mesmo padrão de pedidoTrajeto em formulario.js).
let pedido = 0;

export const responsavelHtml = () => `
  <fieldset class="form-grupo">
    <legend>Responsável pela visita</legend>
    <div class="campos duas">
      <label>Servidor(a) responsável
        <input id="f-prof" type="text" list="f-prof-lista" autocomplete="off" required />
        <datalist id="f-prof-lista"></datalist></label>
      <label>Telefone / WhatsApp
        <input id="f-tel" type="tel" inputmode="tel" placeholder="(16) 99999-9999" required /></label>
    </div>
  </fieldset>`;

export function ligarResponsavel() {
  equipe = [];
  pedido++;
  const nome = document.getElementById('f-prof');
  const tel = document.getElementById('f-tel');
  // Casou com alguém da equipe: o telefone vem do cadastro. Continua
  // editável - o número do dia da visita pode ser outro.
  nome.addEventListener('input', () => {
    const p = equipe.find(x => norm(x.nome).trim() === norm(nome.value).trim());
    if (p?.telefone) tel.value = exibirTelefone(p.telefone);
  });
  tel.addEventListener('blur', () => { tel.value = formatarTelefone(tel.value); });
}

export async function carregarEquipe(unidadeId) {
  const meu = ++pedido;
  let lista = [];
  if (isUuid(unidadeId)) {
    try { lista = await getEquipeDaUnidade(unidadeId); } catch (_) { /* segue como texto livre */ }
  }
  const dl = document.getElementById('f-prof-lista');
  if (meu !== pedido || !dl) return;
  equipe = lista.filter(p => !p.supervisao);
  dl.innerHTML = equipe.map(p => `<option value="${esc(p.nome)}" label="${esc(p.cargo)}"></option>`).join('');
}
```

- [ ] **Step 5: `formulario.js` usa os dois.**
  - Imports: acrescentar `import { quandoHtml, ligarQuando } from './formulario-quando.js';` e `import { responsavelHtml, ligarResponsavel, carregarEquipe } from './formulario-responsavel.js';`. Tirar `PERIODOS` do import de `regras.model.js` e `formatarTelefone` continua (é usado em `contato_professor`).
  - No template, o `<fieldset>` "Quando" inteiro vira `${quandoHtml(minData)}` e o "Responsável pela visita" vira `${responsavelHtml()}`.
  - Apagar a função `pintarPeriodo` deste arquivo.
  - Em `ligar()`:

```js
  // A escola escolhida decide o trajeto e quem pode ser o responsável.
  const aoMudarEscola = () => { pintarTrajeto(); carregarEquipe(escolaId()); };
```

    usar `aoMudarEscola` no `onChange` da busca de escola e no `change` do `#f-esc`; apagar os dois `addEventListener('change', …)` de `f-emb`/`f-ret`, o `blur` de `f-tel` e tirar `'f-data'` do laço (`for (const id of ['f-alunos', 'f-cadeira'])`); no lugar de `pintarPeriodo();`:

```js
  ligarQuando(revisar);
  ligarResponsavel();
  carregarEquipe(escolaId());   // escola única já vem escolhida
```

  - Mensagens (em `enviar` e no `catch`):
    - `'Informe a data e os horários de embarque e de saída do evento.'`
    - `'A saída do evento precisa ser depois do embarque.'`
    - `'Informe o servidor(a) responsável e o telefone.'` (duas ocorrências)
    - `'Informe o horário de embarque e o de saída do evento.'`
  - Conferir `wc -l src/modules/sate/views/formulario.js` ≤ 400.

- [ ] **Step 6: CSS em `sate.css`.**

```css
/* Data sem ano (spec 2026-10-03, D2): campo de texto dd/mm com o botão do
   calendário por dentro, e o <input type="date"> nativo escondido atrás
   dele - é ele que abre o seletor. */
.data-curta { position: relative; display: flex; }
.data-curta > input[type="text"] { flex: 1 1 auto; min-width: 0; padding-right: 38px; }
.data-curta-btn {
  position: absolute; top: 1px; right: 1px; bottom: 1px; width: 34px;
  display: grid; place-items: center;
  border: 0; border-radius: var(--radius-btn); background: transparent;
  color: var(--muted); cursor: pointer;
}
.data-curta-btn:hover { color: var(--brand); }
/* 1px e transparente, mas PRESENTE: display:none impediria o showPicker, e
   é a posição dele que ancora o calendário sob o canto direito do campo. */
.data-curta > input.data-curta-nativo {
  position: absolute; right: 0; bottom: 0;
  width: 1px; height: 1px; min-height: 0; padding: 0; border: 0;
  opacity: 0; pointer-events: none;
}
.form-hint.err { color: var(--danger); }

/* Período calculado: selo, não texto de dica (D2, 1e). */
.sol-periodo {
  justify-self: start;
  display: inline-flex; align-items: center; gap: 7px;
  margin: 0; padding: 5px 12px;
  border: 1px solid color-mix(in srgb, var(--brand) 30%, var(--border));
  border-radius: 999px;
  background: var(--info-bg);
  color: var(--brand); font-size: 13px;
}
.sol-periodo > span { color: var(--muted); }
.sol-periodo > b { font-weight: 700; }
.sol-periodo:empty { display: none; }
```

Antes de acrescentar `.form-hint.err`, `grep -n "form-hint.err\|\.err" src/styles/components.css`: se já existir regra equivalente, não duplicar.

- [ ] **Step 7: Navegador (`sate.html`).** "Nova solicitação":
  - digitar `1403` → campo mostra `14/03`, abaixo a data por extenso com o ano; `3102` → "Essa data não existe." em vermelho; botão do calendário abre o seletor e a escolha preenche o texto;
  - embarque `0730`, saída `1130` → selo "Período Manhã"; apagar um horário → o selo some;
  - a dica "Somente números…" aparece sob os horários;
  - responsável: rótulo novo, placeholder `(16) 99999-9999`; no dev-local a lista de sugestões fica vazia (sem banco) e o campo aceita texto;
  - com `data` e nº de estudantes preenchidos, o saldo continua sendo pintado (a data chega ao resto do formulário);
  - largura 380 e 1280, claro e escuro, console limpo.

- [ ] **Step 8: Tutorial e commit.** `docs/modulos/sate.md`: passos 6 e 7 de "pedir transporte" (data com dia e mês, saída do evento, servidor(a) responsável com sugestão e telefone automático) e a tabela de período ("Saída do evento").

```bash
node --test tests/*.mjs && python .claude/scripts/verificar_arquitetura.py
git add src/modules/sate src/modules/servidores src/modules/escolas/views/detalhe.js tests/vinculos.test.mjs docs/modulos/sate.md
git commit -m "feat(sate): data sem ano, servidor responsavel com sugestao da equipe e periodo em destaque"
git push origin dev
```

---

### Task 5: SATE - rótulos em todas as telas, "Ver como escola" e link do FundHub (D2, D18, D19)

**Files:**
- Modify: `src/modules/sate/views/detalhe.js:80`, `src/modules/sate/views/fichas.js:161`, `src/modules/sate/views/remanejar.js:40,78`, `src/modules/sate/regras.model.js:111,115`
- Modify: `src/sate.js`
- Test: `tests/sate-regras.test.mjs` (se alguma asserção cita o texto antigo)
- Docs: `docs/modulos/sate.md`

**Interfaces:**
- Produces: `estado.nivel` em `sate.js`; `ehEscola(): boolean` (interno).

- [ ] **Step 1: Rótulos.**
  - `detalhe.js`: `` `embarque ${…} · saída do evento ${…}` ``.
  - `fichas.js`: `<th>Saída do evento</th>`.
  - `remanejar.js`: rótulo "Horário de saída do evento"; mensagem `'A saída do evento precisa ser depois do embarque.'`.
  - `regras.model.js`: `'Informe o horário de embarque e o de saída do evento.'` e `'A saída do evento precisa ser depois do embarque.'`.
  - `grep -rn -i "retorno\|professor" src/modules/sate tests/sate-*.mjs` e conferir cada ocorrência que **aparece para a pessoa** (rótulo, mensagem, `title`, `aria-label`). Nomes de coluna, de variável e comentários ficam. Ajustar as asserções de teste que citem o texto antigo.

- [ ] **Step 2: `sate.js` - nome completo (D18).** Em `paginaVerComo`:

```js
    opcoes: unidades.map(u => ({ id: u.id, rotulo: u.nome, detalhe: u.segmento || '', busca: u.apelido || '' })),
    placeholder: 'Buscar a escola…',
    onChange: (id) => {
      const u = unidades.find(x => x.id === id);
      // Nome completo, não o apelido (spec 2026-10-03, D18): é o que a faixa
      // "Você está vendo o SATE como…" mostra, e apelido não identifica.
      if (u) mudarSimulacao({ id: u.id, nome: u.nome });
    },
```

- [ ] **Step 3: `sate.js` - a escola não é levada ao FundHub (D19).** Importar `PROPRIOS` de `./core/permissoes.js`. Em `montarSate`, guardar o nível: `estado = { perfil, nivel: nv, podeAprovar: nv === ESCRITA, somenteLeitura: nv === LEITURA };`. Depois de `usaFundHub`:

```js
// Quem usa o SATE como ESCOLA não é levado ao FundHub - nem pelo menu, nem
// pelo "Meus dados" (spec 2026-10-03, D19). Por enquanto: volta quando o
// FundHub for aberto às escolas. NÃO é controle de acesso (R6): quem
// digitar o endereço entra e vê o que o banco deixa. `simulando` conta
// como escola - a simulação mostra o menu exatamente como ela o vê.
const nivelSate = () => nivelEfetivo(moduloPorId('sate'));
const ehEscola = () => !!simulando || nivelSate() === PROPRIOS;
const ofereceFundHub = () => usaFundHub() && !ehEscola();
```

Em `gruposDoMenu`, o grupo "Mais":

```js
  const conta = [
    ...(aprovador ? [{ rota: '#/configuracoes', ico: 'config', nome: 'Configurações' }] : []),
    // Fora da simulação: durante ela, a saída é o botão da faixa do topo.
    ...(estado.podeAprovar && !simulando ? [{ rota: '#/ver-como', ico: 'escola', nome: 'Ver como escola' }] : []),
    { rota: '#/ajuda', ico: 'ajuda', nome: 'Como usar o SATE' },
    ...(ofereceFundHub() ? [linkFundHub()] : []),
  ];
```

No ramo `OCULTO` de `montarSate` o link continua pelo `usaFundHub()` (quem não tem o SATE precisa de uma saída). Em `abrirPortao`, `meusDados: ofereceFundHub`.

A rota `#/ver-como` continua acessível a quem aprova (é como se troca de escola depois de sair da simulação).

- [ ] **Step 4: Navegador.** `sate.html` em dev-local (perfil admin): "Ver como escola" lista os nomes completos; escolher uma → a faixa mostra o nome completo e o menu perde "Ver como escola", "Ir para o FundHub" e "Configurações"; "Voltar à minha visão" devolve os três. Detalhe de uma solicitação e a página Fichas mostram "saída do evento". Console limpo.

- [ ] **Step 5: Tutorial e commit.** `docs/modulos/sate.md`: trocar "retorno" por "saída do evento" e "professor(a) responsável" por "servidor(a) responsável" em todo o texto; a seção "Ver como escola", se existir, diz que o menu fica igual ao da escola.

```bash
node --test tests/*.mjs && python .claude/scripts/verificar_arquitetura.py
git add src/sate.js src/modules/sate tests docs/modulos/sate.md
git commit -m "feat(sate): saida do evento e servidor responsavel em todas as telas; escola sem link para o FundHub"
git push origin dev
```

---

# Bloco B - Tema e Configurações

### Task 6: Tema claro e escuro (D10, D11 - menu de usuário)

**Files:**
- Create: `src/core/tema.js`
- Create: `tests/tema.test.mjs`
- Modify: `index.html`, `sate.html` (script no `<head>`, **antes** do `<link>` da folha de estilo)
- Modify: `src/styles/tokens.css`, `src/styles/components.css`, `src/modules/sate/sate.css` (todo `@media (prefers-color-scheme: dark)`)
- Modify: `src/main.js`, `src/sate.js` (chamar `iniciarTema()` no boot)
- Modify: `src/shell/portao.js` (chamar `sincronizarTemaDaConta()` depois de `carregarConfiguracoes()`)
- Modify: `src/shell/chrome.js`, `src/styles/base.css` (interruptor no menu de usuário)
- Modify: `src/modules/docs/docs.content.js:599` (o texto que ensina a regra do tema escuro)

**Interfaces:**
- Produces (`core/tema.js`):
  - `resolverTema(gravado: string|null, sistemaEscuro: boolean): 'claro'|'escuro'` (pura)
  - `iniciarTema(): void` · `temaAtual(): 'claro'|'escuro'` · `definirTema(tema): Promise<void>` · `sincronizarTemaDaConta(): void`
  - evento `tema:mudou` em `document`, `detail` = o tema.
  - `localStorage['fundhub:tema']`; preferência da conta `('geral', 'tema')`.

- [ ] **Step 1: Teste que falha.** `tests/tema.test.mjs`:

```js
// Tema (spec 2026-10-03, D10): a escolha gravada vence; sem ela, o sistema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverTema } from '../src/core/tema.js';

test('a escolha gravada vence o sistema', () => {
  assert.equal(resolverTema('claro', true), 'claro');
  assert.equal(resolverTema('escuro', false), 'escuro');
});

test('sem escolha, segue o sistema', () => {
  assert.equal(resolverTema(null, true), 'escuro');
  assert.equal(resolverTema(null, false), 'claro');
});

test('valor estranho gravado é como não ter escolha', () => {
  assert.equal(resolverTema('roxo', false), 'claro');
  assert.equal(resolverTema('', true), 'escuro');
});
```

`node --test tests/tema.test.mjs` → falha (módulo não existe).

- [ ] **Step 2: `src/core/tema.js`.**

```js
// ============================================================
// FundHub - core/tema.js  (tema claro / escuro)
// Spec: docs/superpowers/specs/2026-10-03-formularios-tema-e-equipe-da-escola-design.md § D10.
//
// O tema é um ATRIBUTO: <html data-tema="claro|escuro">. O CSS inteiro
// obedece a ele (tokens.css), e não mais a `prefers-color-scheme` - a
// pessoa escolhe, e o sistema só decide enquanto ela não escolheu.
//
// A escolha mora em dois lugares, e os dois têm motivo:
//   localStorage  - vale ANTES do login e nas duas páginas (index.html e
//                   sate.html têm a mesma origem), e é o que o script do
//                   <head> lê para pintar sem piscar;
//   preferência   - ('geral', 'tema') em preferencia_usuario: acompanha a
//                   pessoa em outro aparelho. No login, ela vence.
//
// O script do <head> das duas páginas ESPELHA resolverTema(): mudou a
// regra aqui, mude lá.
// ============================================================
import { pref, definirPref } from './configuracoes.js';

const CHAVE = 'fundhub:tema';
const TEMAS = ['claro', 'escuro'];
const sistema = () => window.matchMedia('(prefers-color-scheme: dark)');

// Pura: a escolha gravada vence; sem ela (ou com valor estranho), o sistema.
export function resolverTema(gravado, sistemaEscuro) {
  return TEMAS.includes(gravado) ? gravado : (sistemaEscuro ? 'escuro' : 'claro');
}

// Modo privado ou armazenamento bloqueado: segue sem lembrar.
function lerLocal() { try { return localStorage.getItem(CHAVE); } catch (_) { return null; } }
function gravarLocal(tema) { try { localStorage.setItem(CHAVE, tema); } catch (_) { /* sem lembrança */ } }

export const temaAtual = () => document.documentElement.dataset.tema || 'claro';

function aplicar(tema) {
  document.documentElement.dataset.tema = tema;
  // Quem mostra o tema (menu de usuário, Configurações) se atualiza por aqui.
  document.dispatchEvent(new CustomEvent('tema:mudou', { detail: tema }));
}

// Uma vez, no boot de cada página.
export function iniciarTema() {
  aplicar(resolverTema(lerLocal(), sistema().matches));
  // Sem escolha, o tema acompanha o sistema mesmo com a página aberta.
  sistema().addEventListener('change', (e) => {
    if (!TEMAS.includes(lerLocal())) aplicar(resolverTema(null, e.matches));
  });
}

// Depois do login, com as preferências carregadas: a da conta vence a do
// aparelho.
export function sincronizarTemaDaConta() {
  const daConta = pref('geral', 'tema');
  if (TEMAS.includes(daConta) && daConta !== lerLocal()) { gravarLocal(daConta); aplicar(daConta); }
}

export async function definirTema(tema) {
  if (!TEMAS.includes(tema)) return;
  gravarLocal(tema);
  aplicar(tema);
  // Sem banco, sem sessão ou sem a tabela: a escolha local já vale.
  try { await definirPref('geral', 'tema', tema); } catch (_) { /* fica só neste aparelho */ }
}
```

`node --test tests/tema.test.mjs` → passa.

- [ ] **Step 3: Script do `<head>`.** Em `index.html` e `sate.html`, imediatamente antes do `<link rel="stylesheet" …>` principal:

```html
  <script>
    // Tema ANTES da primeira pintura, para não piscar (spec 2026-10-03, D10).
    // Espelha resolverTema() em src/core/tema.js: mudou lá, mude aqui.
    (function () {
      var t = null;
      try { t = localStorage.getItem('fundhub:tema'); } catch (e) {}
      if (t !== 'claro' && t !== 'escuro') {
        t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
      }
      document.documentElement.dataset.tema = t;
    })();
  </script>
```

- [ ] **Step 4: CSS - de `@media` para atributo.** Em cada arquivo, cada bloco `@media (prefers-color-scheme: dark) { SELETOR { … } }` vira uma regra com o prefixo `:root[data-tema="escuro"]`:

| Arquivo | Antes (dentro do `@media`) | Depois |
|---|---|---|
| `tokens.css` | `:root { … }` (paleta) | `:root[data-tema="escuro"] { … }` |
| `tokens.css` | `:root { --overlay… }` | `:root[data-tema="escuro"] { --overlay… }` |
| `tokens.css` | `body { --grupo-bg… }` | `:root[data-tema="escuro"] body { … }` |
| `components.css` | `input[type="date"] { … }` / `input[type="time"] { … }` | `:root[data-tema="escuro"] input[type="date"] { … }` (idem `time`) |
| `components.css` | a seta do `select` (Tarefa 1) | `:root[data-tema="escuro"] :is(.form-grid, .esc-form, .filtro-campo) select:not([multiple]), :root[data-tema="escuro"] select.campo-solto { … }` |
| `sate.css` | `body.app-sate { --info-bg… }` | `:root[data-tema="escuro"] body.app-sate { … }` |

O bloco dos ícones de data continua dentro do `@supports`. Em `tokens.css`, declarar o `color-scheme`:

```css
/* Controles nativos (seletor de data, lista do select, rolagem) seguem o
   tema escolhido, não o do sistema. */
:root { color-scheme: light; }
:root[data-tema="escuro"] { color-scheme: dark; }
```

Atualizar os comentários que citam `@media (prefers-color-scheme: dark)` (cabeçalho de `tokens.css`, o de `--form-legend`, o do `body` com `--grupo-bg`). Conferir:

```bash
grep -rn "prefers-color-scheme" src/styles src/modules --include=*.css
```

Esperado: nenhuma linha.

- [ ] **Step 5: Boot.** `src/main.js` e `src/sate.js`: `import { iniciarTema } from './core/tema.js';` e chamar `iniciarTema();` antes de `abrirPortao(…)`. Em `shell/portao.js`, onde `carregarConfiguracoes()` é aguardado (linha ~41, dentro de um `Promise.all`), chamar `sincronizarTemaDaConta()` **depois** que esse `Promise.all` resolver (importar de `../core/tema.js`).

- [ ] **Step 6: Menu de usuário.** Em `chrome.js`, `import { temaAtual, definirTema } from '../core/tema.js';`. No template do `.user-panel`, entre a linha "Dados" e o link "Meus dados":

```html
        <label class="um-linha um-tema switch">
          <span class="um-lbl">Tema escuro</span>
          <input type="checkbox" id="um-tema" />
          <span class="switch-trilho" aria-hidden="true"></span>
        </label>
```

Dentro do `if (!menu) { … }`, depois dos outros ouvintes:

```js
    const tema = menu.querySelector('#um-tema');
    tema.addEventListener('change', () => definirTema(tema.checked ? 'escuro' : 'claro'));
    // Trocado em outro lugar (Configurações): o interruptor acompanha.
    document.addEventListener('tema:mudou', (e) => { tema.checked = e.detail === 'escuro'; });
```

E, junto das outras atualizações do fim de `setChrome`: `menu.querySelector('#um-tema').checked = temaAtual() === 'escuro';`.

Em `base.css`, depois de `.um-acesso`:

```css
/* O interruptor do tema é uma .um-linha: rótulo à esquerda, trilho à direita. */
.um-tema { width: 100%; min-height: 0; cursor: pointer; }
```

- [ ] **Step 7: Texto da documentação interna.** `docs.content.js:599`: a frase que ensina "escuro definido por `@media (prefers-color-scheme: dark)`" passa a dizer que o escuro é definido por `:root[data-tema="escuro"]` em `tokens.css`, e que quem aplica o atributo é `core/tema.js`.

- [ ] **Step 8: Navegador.**
  - FundHub: abrir o menu de usuário, ligar "Tema escuro" → a página inteira troca sem recarregar; recarregar → continua escuro, **sem piscar claro**; `sate.html` abre escuro.
  - Desligar → claro nos dois. `localStorage.removeItem('fundhub:tema')` + recarregar com `resize_window colorScheme: 'dark'` → escuro (segue o sistema).
  - Passar por dashboard, escolas, servidores, horários, um modal com formulário, e o SATE nas quatro cores (`document.body.dataset.cor = 'vinho'` etc.) nos dois temas: nenhuma tela com cor quebrada; ícones de data e seta do `select` na cor certa.
  - Seletor de data nativo e lista do `select` abrem no tema escolhido.
  - Console limpo.

- [ ] **Step 9: Commit.**

```bash
node --test tests/*.mjs && python .claude/scripts/verificar_arquitetura.py
git add index.html sate.html src/core/tema.js src/main.js src/sate.js src/shell src/styles src/modules/sate/sate.css src/modules/docs/docs.content.js tests/tema.test.mjs
git commit -m "feat(tema): claro ou escuro pela escolha da pessoa, no menu de usuario do FundHub e do SATE"
git push origin dev
```

---

### Task 7: Configurações - blocos expansíveis, "Geral" e a aparência do SATE (D9, D11, D20)

**Files:**
- Modify: `src/modules/configuracoes/painel.js`
- Modify: `src/modules/configuracoes/configuracoes.view.js`, `configuracoes.css`
- Modify: `src/modules/sate/sate.config.js`
- Modify: `src/sate.js`
- Test: `tests/configuracoes.test.mjs` (ou `tests/sate-cor.test.mjs` novo, se aquele não importar `sate.config.js`)
- Docs: `docs/modulos/configuracoes.md`, `docs/modulos/sate.md`

**Interfaces:**
- Consumes: `temaAtual`, `definirTema`, evento `tema:mudou` (`core/tema.js`); `_semearParaTeste(rede, pessoa)` (`core/configuracoes.js`).
- Produces (`configuracoes/painel.js`):
  - `pintarTema(box: HTMLElement): void`
  - `pintarConfigDoModulo(box, mod, ctx = {}, { soPessoais = false } = {})`
  - evento `cfg:salva` (borbulha a partir de `box`), `detail: { modulo, chave }`.
- Produces (`sate.config.js`): `corSate()` = preferência → rede → `'verde'`.

- [ ] **Step 1: Teste que falha - a cor é da pessoa.**

```js
// A cor do SATE é de cada pessoa (spec 2026-10-03, D20): a preferência
// vence; sem ela, vale a que a rede tinha escolhido; sem nenhuma, verde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _semearParaTeste } from '../src/core/configuracoes.js';
import { corSate } from '../src/modules/sate/sate.config.js';

test('sem nada gravado, verde', () => {
  _semearParaTeste({}, {});
  assert.equal(corSate(), 'verde');
});

test('a cor da rede é o padrão de quem nunca escolheu', () => {
  _semearParaTeste({ 'sate/cor': 'azul' }, {});
  assert.equal(corSate(), 'azul');
});

test('a preferência da pessoa vence a da rede', () => {
  _semearParaTeste({ 'sate/cor': 'azul' }, { 'sate/cor': 'vinho' });
  assert.equal(corSate(), 'vinho');
});

test('valor fora da lista cai no padrão', () => {
  _semearParaTeste({}, { 'sate/cor': 'neon' });
  assert.equal(corSate(), 'verde');
});
```

Rodar → o terceiro falha.

- [ ] **Step 2: `sate.config.js`.** Importar `pref` junto de `conf`.

```js
// Cor principal da página do SATE - de CADA PESSOA (spec 2026-10-03, D20).
// A cor que a rede tinha escolhido vira o padrão de quem nunca escolheu.
// Valor fora da lista cai no padrão: um texto estranho gravado não pode
// deixar a página sem cor de marca.
export const corSate = () => {
  const v = pref('sate', 'cor') ?? conf('sate', 'cor');
  return CORES.some(c => c.valor === v) ? v : PADRAO.cor;
};
```

E o item da `DECLARACAO`:

```js
    {
      chave: 'cor', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'opcao', opcoes: CORES,
      // Getter: o padrão exibido é a cor EM VIGOR para quem ainda não
      // escolheu (a da rede), e a declaração é lida antes do login.
      get padrao() { return corSate(); },
      rotulo: 'Cor principal do SATE',
      dica: 'A cor de destaque do SATE para você: botões, menu e marca.',
    },
```

Testes → passam.

- [ ] **Step 3: `painel.js` - `soPessoais`, evento e `pintarTema`.** Import: `import { temaAtual, definirTema } from '../../core/tema.js';`.

Assinatura e filtro:

```js
// `soPessoais`: só os itens de escopo `usuario` (spec 2026-10-03, D20). É a
// página de configurações do SATE vista pela escola - quem não decide frota
// e regras não precisa vê-las ali, nem desabilitadas.
export async function pintarConfigDoModulo(box, mod, ctx = {}, { soPessoais = false } = {}) {
```

e, onde `itens` é montado: `const itens = (declaracao?.itens || []).filter(i => !soPessoais || i.escopo === 'usuario');`.

Em `ligar`, depois do `toast` de sucesso:

```js
      // Quem hospeda o painel reage ao que foi salvo sem conhecer os itens
      // (o SATE reaplica a cor na hora).
      box.dispatchEvent(new CustomEvent('cfg:salva', { bubbles: true, detail: { modulo: modId, chave } }));
```

E a função nova, depois de `abrirPainelConfig`:

```js
// O interruptor do tema, no mesmo desenho de um item de configuração. Não é
// item de módulo nenhum: é do sistema inteiro, e por isso tem renderizador
// próprio - usado pelo bloco "Geral" do FundHub e pela página de
// configurações do SATE (spec 2026-10-03, D11 e D20).
export function pintarTema(box) {
  if (!box) return;
  box.innerHTML = `<div class="esc-form cfg-form">
    <fieldset class="form-grupo plano">
      <legend>Aparência</legend>
      <div class="cfg-item cfg-simples">
        <label class="lbl" for="cfg-tema">Tema escuro
          <span class="form-hint cfg-dica">Vale para o FundHub e para o SATE, neste aparelho e na sua conta.</span></label>
        <label class="switch">
          <input type="checkbox" id="cfg-tema" ${temaAtual() === 'escuro' ? 'checked' : ''} />
          <span class="switch-trilho" aria-hidden="true"></span></label>
      </div>
    </fieldset></div>`;
  const inp = box.querySelector('#cfg-tema');
  inp.addEventListener('change', () => definirTema(inp.checked ? 'escuro' : 'claro'));
  // Trocado pelo menu de usuário com esta tela aberta: o interruptor
  // acompanha. O ouvinte é de `document` e se desliga sozinho quando a tela
  // sai - senão cada visita a Configurações deixaria um para trás.
  const aoMudar = (e) => {
    if (!inp.isConnected) { document.removeEventListener('tema:mudou', aoMudar); return; }
    inp.checked = e.detail === 'escuro';
  };
  document.addEventListener('tema:mudou', aoMudar);
}
```

- [ ] **Step 4: `configuracoes.view.js` - blocos expansíveis.** Substituir a montagem da lista (do `lista.innerHTML = alvos.map(…)` até o fim do `render`) e o ramo "nada para configurar" (agora sempre existe o bloco Geral):

```js
import { pintarConfigDoModulo, pintarTema } from './painel.js';

// Quais blocos ficaram abertos - conveniência do navegador, a tela
// funciona sem. Primeiro acesso: só o "Geral".
const CHAVE_ABERTOS = 'fundhub:cfg-abertos';
function lerAbertos() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_ABERTOS) || 'null');
    return new Set(Array.isArray(v) ? v : ['geral']);
  } catch (_) { return new Set(['geral']); }
}
function gravarAbertos(set) {
  try { localStorage.setItem(CHAVE_ABERTOS, JSON.stringify([...set])); } catch (_) { /* sem lembrança */ }
}

// <details> nativo: teclado, leitor de tela e abrir/fechar sem JS. O nome
// do módulo é o <summary>; a seta gira pelo [open] (configuracoes.css).
const blocoHtml = (id, icone, nome, aberto) => `
  <details class="cfg-mod" data-mod="${esc(id)}" ${aberto ? 'open' : ''}>
    <summary class="cfg-mod-head">
      ${ico(icone, { tam: 18 })}<h2>${esc(nome)}</h2>
      <span class="cfg-mod-seta" aria-hidden="true">${ico('chevron', { tam: 16 })}</span>
    </summary>
    <div class="cfg-mod-corpo"></div>
  </details>`;
```

No `render`, depois de calcular `alvos` e escrever o `page-head`:

```js
  const lista = app.querySelector('#cfg-lista');
  const abertos = lerAbertos();
  lista.innerHTML = blocoHtml('geral', 'config', 'Geral', abertos.has('geral'))
    + alvos.map(m => blocoHtml(m.id, m.ico || 'config', m.nome, abertos.has(m.id))).join('');

  // Cada bloco é desenhado na PRIMEIRA abertura: antes a página esperava
  // todos os módulos em fila, mesmo os que ninguém ia abrir.
  const pintar = async (det) => {
    if (det.dataset.pintado) return;
    det.dataset.pintado = '1';
    const corpo = det.querySelector('.cfg-mod-corpo');
    if (det.dataset.mod === 'geral') { pintarTema(corpo); return; }
    const mod = alvos.find(m => m.id === det.dataset.mod);
    if (mod) await pintarConfigDoModulo(corpo, mod, { perfil });
  };

  // `toggle` não borbulha: ouvinte na fase de captura.
  lista.addEventListener('toggle', (e) => {
    const det = e.target.closest?.('details.cfg-mod');
    if (!det) return;
    if (det.open) { abertos.add(det.dataset.mod); pintar(det); }
    else abertos.delete(det.dataset.mod);
    gravarAbertos(abertos);
  }, true);

  for (const det of lista.querySelectorAll('details.cfg-mod[open]')) await pintar(det);
```

Tirar o import de `emptyState` se ficar sem uso, e o `cssEscape` idem.

- [ ] **Step 5: `configuracoes.css`.** Ler as regras atuais de `.cfg-mod`, `.cfg-mod-head` e `.cfg-mod-corpo` (fim do arquivo) e ajustar para o `<details>`:

```css
/* Cabeçalho do bloco é o <summary> (spec 2026-10-03, D9): clicável inteiro,
   sem o marcador nativo, com a seta à direita girando ao abrir. */
.cfg-mod-head { cursor: pointer; list-style: none; user-select: none; }
.cfg-mod-head::-webkit-details-marker { display: none; }
.cfg-mod-head h2 { flex: 1 1 auto; min-width: 0; }
.cfg-mod-seta { display: grid; place-items: center; color: var(--muted); transition: transform .15s ease; }
.cfg-mod[open] > .cfg-mod-head .cfg-mod-seta { transform: rotate(90deg); }
.cfg-mod-head:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: var(--radius-btn); }
.cfg-mod:not([open]) > .cfg-mod-head { margin-bottom: 0; }
```

Conferir no navegador para onde o ícone `chevron` aponta em repouso e ajustar o ângulo (fechado = aponta para a direita; aberto = para baixo). Se `.cfg-mod-head` ainda não for `display: flex` com `align-items: center` e `gap`, declarar.

- [ ] **Step 6: `sate.js` - Configurações para todos.** Import: `import { pintarConfigDoModulo, pintarTema } from './modules/configuracoes/painel.js';`.

Em `gruposDoMenu`, o item deixa de depender de `aprovador`:

```js
    { rota: '#/configuracoes', ico: 'config', nome: 'Configurações' },
```

Em `rotear`: `if (id === 'configuracoes') {` (sem o `&& aprovadorEfetivo()`).

```js
// Configurações como PÁGINA. Para todos (spec 2026-10-03, D20): tema e cor
// são de cada pessoa. Quem aprova vê, abaixo, as configurações da rede; a
// escola (e quem a simula) vê só a aparência.
async function paginaConfiguracoes() {
  const aprovador = aprovadorEfetivo();
  app.innerHTML = `
    <div class="page-head">
      <h1>Configurações</h1>
      <p>${aprovador
        ? 'O tema e a cor são seus. Frota e regras de agendamento valem para a rede toda.'
        : 'O tema e a cor do SATE. Valem só para você.'}</p>
    </div>
    <div id="sate-tema"></div>
    <div id="sate-config">${loading()}</div>`;
  pintarTema(document.getElementById('sate-tema'));
  const box = document.getElementById('sate-config');
  // A cor vale na hora, sem recarregar.
  box.addEventListener('cfg:salva', (e) => { if (e.detail.chave === 'cor') aplicarCor(); });
  await pintarConfigDoModulo(box, moduloPorId('sate'), {}, { soPessoais: !aprovador });
}
```

`#sate-tema` e `#sate-config` precisam de um respiro entre si: se `.cfg-form` não tiver margem inferior, acrescentar em `sate.css` `#sate-tema { margin-bottom: 16px; }`.

- [ ] **Step 7: Navegador.**
  - `#/configuracoes` (FundHub): "Geral" aberto, demais fechados; abrir "Escolas" desenha o conteúdo; fechar e recarregar → o que estava aberto continua aberto; Tab chega ao cabeçalho e Enter/Espaço abre.
  - Interruptor do tema em "Geral" troca o tema e o do menu de usuário acompanha (e vice-versa).
  - `sate.html#/configuracoes`: "Aparência" (tema) e a cor; trocar a cor pinta o menu na hora. Em "Ver como escola": só tema e cor, sem as regras da rede.
  - 380px e 1280px, claro e escuro, console limpo. (No dev-local `definirPref` lança "Sem conexão": o tema troca do mesmo jeito; a cor mostra o toast de erro - esperado sem banco.)

- [ ] **Step 8: Tutoriais e commit.** `docs/modulos/configuracoes.md` (blocos expansíveis, tema em "Geral" e no menu de usuário) e `docs/modulos/sate.md` (Configurações para todos: tema e cor são de cada pessoa).

```bash
node --test tests/*.mjs && python .claude/scripts/verificar_arquitetura.py
git add src/modules/configuracoes src/modules/sate src/sate.js tests docs/modulos
git commit -m "feat(configuracoes): blocos expansiveis, tema em Geral e cor do SATE por pessoa"
git push origin dev
```

---

# Bloco C - Equipe da escola e mapa

### Task 8: Função do gestor e ordem da equipe - banco e model (D12, D13, D17)

**Files:**
- Create: `supabase/migrations/045_funcao_gestor_e_supervisao.sql`
- Modify: `src/modules/servidores/servidores.model.js`
- Modify: `src/modules/servidores/vinculos.model.js`
- Modify: `src/modules/servidores/equipe.model.js`
- Test: `tests/vinculos.test.mjs`

**Interfaces:**
- Produces (`servidores.model.js` - derivações do vínculo, sem importar `vinculos.model.js`):
  - `CARGO_GESTOR = 'Gestor(a)'`
  - `rotulaVinculo(v: { papel, funcao? }): string` - `'Gestor(a) 1'`, `'Gestor(a) 2'` ou o cargo.
  - `cargoExibidoDe(s): string` - como `cargoDe`, com a função no rótulo. **`cargoDe` não muda**: continua sendo a chave de comparação (filtros, equipe gestora).
  - cada vínculo lido passa a trazer `funcao` (1, 2 ou `null`/ausente).
- Produces (`vinculos.model.js`):
  - `FUNCOES = [{ valor: 1, rotulo: 'Gestor 1' }, { valor: 2, rotulo: 'Gestor 2' }]`
  - `temFuncao(cargo: string): boolean`
  - `criarVinculo({ servidor_id, unidade_id, papel, ingresso, fim, funcao = null })`, `atualizarVinculo(id, { unidade_id, papel, ingresso, fim, funcao = null })`
  - `mudarFuncao(servidorId, vinculo, funcao: 1|2, desde: 'yyyy-mm-dd'): Promise<vinculo>`
- Produces (`equipe.model.js`):
  - `ordemNaEquipe(v): 0|1|2|3|4`
  - `vinculosDeEquipe(s): vinculo[]` - abertos e que não são supervisão.
  - `getEquipeDaUnidade(unidadeId)` → `[{ id, nome, cargo, email, telefone, supervisao, ordem }]`, ordenada por `ordem`, cargo, nome; `cargo` com a função.
  - `quemTemFuncao(unidadeId, funcao, excetoServidorId): Promise<servidor|null>`

- [ ] **Step 1: Migration.** Conferir que `045` é o próximo número (`ls supabase/migrations | tail -3`).

```sql
-- ============================================================
-- 045 - Funcao do gestor (Gestor 1 / Gestor 2) e supervisao fora da
--       equipe gestora
-- Spec: docs/superpowers/specs/2026-10-03-formularios-tema-e-equipe-da-escola-design.md
--       (D12, D14, D17)
--
-- A funcao e parte do VINCULO: o periodo da funcao e o periodo do
-- vinculo. Trocar de funcao com data encerra um periodo e abre outro
-- (feito pelo app) - nao ha tabela de historico nova.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================

alter table vinculo add column if not exists funcao smallint;

-- So 1 ou 2 - e so no cargo de gestor. A regra tambem esta na tela, mas
-- a que vale e esta (R15).
alter table vinculo drop constraint if exists vinculo_funcao_valor;
alter table vinculo add constraint vinculo_funcao_valor
  check (funcao is null or funcao in (1, 2));

alter table vinculo drop constraint if exists vinculo_funcao_so_gestor;
alter table vinculo add constraint vinculo_funcao_so_gestor
  check (funcao is null or papel = 'Gestor(a)');

comment on column vinculo.funcao is
  'Funcao do gestor na unidade: 1 = Gestor 1, 2 = Gestor 2. Nulo = nao definida, ou cargo sem funcao.';

-- Supervisao nao e equipe da escola: sai da lista de cargos que compoem a
-- grade de horarios e a cobertura. O app ja a ignora; isto limpa a
-- configuracao que a 024 semeou.
delete from cargo_gestao where cargo = 'Supervisor(a)';

select religar_auditoria();

select registrar_migration('045',
  'Vinculo: funcao do gestor (1 ou 2); supervisao fora da equipe gestora');
```

- [ ] **Step 2: Testes que falham.** Acrescentar a `tests/vinculos.test.mjs`:

```js
import { rotulaVinculo, cargoExibidoDe } from '../src/modules/servidores/servidores.model.js';
import { temFuncao } from '../src/modules/servidores/vinculos.model.js';
import { ordemNaEquipe, vinculosDeEquipe } from '../src/modules/servidores/equipe.model.js';

test('a função entra no rótulo do cargo, só para gestor', () => {
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)', funcao: 1 }), 'Gestor(a) 1');
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)', funcao: 2 }), 'Gestor(a) 2');
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)', funcao: null }), 'Gestor(a)');
  assert.equal(rotulaVinculo({ papel: 'Gestor(a)' }), 'Gestor(a)');
  assert.equal(rotulaVinculo({ papel: 'Coordenador(a)', funcao: 1 }), 'Coordenador(a)');
  assert.equal(rotulaVinculo(null), '');
});

test('cargoExibidoDe junta os vínculos abertos, com a função', () => {
  const s = { vinculos: [
    { papel: 'Gestor(a)', funcao: 2, fim: null },
    { papel: 'Gestor(a)', funcao: 1, fim: '2026-01-31' },   // encerrado: fora
  ] };
  assert.equal(cargoExibidoDe(s), 'Gestor(a) 2');
});

test('só o cargo de gestor tem função', () => {
  assert.equal(temFuncao('Gestor(a)'), true);
  assert.equal(temFuncao('gestor'), true);            // legado
  assert.equal(temFuncao('Coordenador(a)'), false);
  assert.equal(temFuncao(''), false);
});

test('ordem da equipe: Gestor 1, Gestor 2, gestor sem função, coordenação, demais', () => {
  const ordem = [
    { papel: 'Secretário(a)' },
    { papel: 'Coordenador(a)' },
    { papel: 'Gestor(a)' },
    { papel: 'Gestor(a)', funcao: 2 },
    { papel: 'Gestor(a)', funcao: 1 },
  ].map(ordemNaEquipe);
  assert.deepEqual(ordem, [4, 3, 2, 1, 0]);
});

test('vinculosDeEquipe deixa de fora o encerrado e a supervisão', () => {
  const s = { vinculos: [
    { unidade_id: 'a', papel: 'Supervisor(a)', fim: null },
    { unidade_id: 'b', papel: 'Coordenador(a)', fim: null },
    { unidade_id: 'c', papel: 'Gestor(a)', fim: '2026-01-31' },
  ] };
  assert.deepEqual(vinculosDeEquipe(s).map(v => v.unidade_id), ['b']);
});
```

Rodar → falham.

- [ ] **Step 3: `servidores.model.js`.** A leitura tenta com `funcao`, depois sem ela (045 ausente), depois sem `tipo` (023 ausente):

```js
// As colunas que podem faltar entram por partes: migrations são aplicadas
// à mão, e entre o deploy e o SQL a consulta precisa cair para a forma que
// o banco já entende (42703), em vez de quebrar a tela.
const sel = ({ funcao, tipo }) => `*, vinculos:vinculo(
  id, unidade_id, papel, ${funcao ? 'funcao, ' : ''}ingresso, fim,
  unidade:unidade_escolar(id, nome, apelido${tipo ? ', tipo' : ''})
)`;
// Da mais completa para a mais antiga: tudo → sem a função do gestor (045)
// → sem o tipo da unidade (023). Quem consome trata `funcao` ausente como
// "não definida" e `tipo` ausente como "não é sede".
const FORMAS = [{ funcao: true, tipo: true }, { funcao: false, tipo: true }, { funcao: false, tipo: false }];

export async function getServidores() {
  if (_cache) return _cache;
  if (!hasSupabase()) { _cache = []; return _cache; }
  const tel = await getTelefonesMapas();
  let ultimo = null;
  for (const forma of FORMAS) {
    const { data, error } = await sb().from('servidor').select(sel(forma)).order('nome');
    if (error?.code === '42703') { ultimo = error; continue; }
    if (error) throw error;
    _cache = (data || []).map(s => ({
      ...s, vinculos: s.vinculos || [], telefones: tel.porServidor[s.id] || [],
    }));
    return _cache;
  }
  throw ultimo;
}
```

(Apagar a constante `SEL` antiga e o ramo `SEL_SEM_TIPO`.) E, na seção "Derivações do vínculo", depois de `cargoDe`:

```js
// Função do gestor (spec 2026-10-03, D12): 1 ou 2, só no cargo Gestor(a).
// Entra no RÓTULO do cargo - "Gestor(a) 1" - e não num elemento novo de
// tela. Mora aqui, com as outras derivações do vínculo, e não em
// vinculos.model.js: aquele importa este, e o contrário fecharia um ciclo.
export const CARGO_GESTOR = 'Gestor(a)';
export function rotulaVinculo(v) {
  const cargo = v?.papel || '';
  return cargo === CARGO_GESTOR && (v.funcao === 1 || v.funcao === 2) ? `${cargo} ${v.funcao}` : cargo;
}

// Como cargoDe, mas para EXIBIR: com a função. cargoDe continua sendo a
// chave de comparação (filtro por cargo, equipe gestora) - "Gestor(a) 1"
// não é um cargo, é um cargo com função.
export function cargoExibidoDe(s) {
  return [...new Set(vinculosAbertos(s).map(rotulaVinculo).filter(Boolean))].join(' · ');
}
```

- [ ] **Step 4: `equipe.model.js` - ordem e função.** Imports passam a:

```js
import { getServidoresDaUnidade, vinculosAbertos, CARGO_GESTOR, rotulaVinculo } from './servidores.model.js';
import { rotulaCargo, temFuncao } from './vinculos.model.js';
```

Depois de `eSupervisao`:

```js
// Posição na equipe da escola (D7): Gestor 1, Gestor 2, gestor sem função
// definida, coordenação, demais.
export function ordemNaEquipe(v) {
  const cargo = rotulaCargo(v?.papel);
  if (cargo === CARGO_GESTOR) return v.funcao === 1 ? 0 : v.funcao === 2 ? 1 : 2;
  return cargo === 'Coordenador(a)' ? 3 : 4;
}

// Os vínculos que fazem da pessoa EQUIPE de algum lugar: abertos, e não de
// supervisão. É o que Horários lê.
export const vinculosDeEquipe = (s) => vinculosAbertos(s).filter(v => !eSupervisao(v.papel));
```

`getEquipeDaUnidade`: o cargo ganha a função e a lista sai na ordem da equipe:

```js
    const cargo = [...new Set(daqui
      .map(v => rotulaVinculo({ ...v, papel: rotulaCargo(v.papel) })).filter(Boolean))].join(' · ');
    …
      ordem: Math.min(4, ...daqui.map(ordemNaEquipe)),
    };
  }).sort((a, b) => a.ordem - b.ordem
    || a.cargo.localeCompare(b.cargo, 'pt') || a.nome.localeCompare(b.nome, 'pt'));
```

(Atualizar o comentário de cabeçalho: a forma de leitura ganha `ordem`, e "Ordenada por nome" vira a ordem nova.)

E, no fim do arquivo:

```js
// Quem já ocupa a função na unidade - para AVISAR, não para barrar (R15):
// numa transição os dois períodos se encostam.
export async function quemTemFuncao(unidadeId, funcao, excetoServidorId) {
  const servidores = await getServidoresDaUnidade(unidadeId);
  return servidores.find(s => s.id !== excetoServidorId && vinculosAbertos(s)
    .some(v => v.unidade_id === unidadeId && temFuncao(v.papel) && v.funcao === funcao)) || null;
}
```

- [ ] **Step 4b: `vinculos.model.js` - gravar a função.** Imports:

```js
import { limparCacheServidores, CARGO_GESTOR } from './servidores.model.js';
import { addDias } from '../../shared/format.js';
```

(manter no import de `servidores.model.js` o que o arquivo ainda usar.) Depois de `rotulaCargo`:

```js
// Função do gestor (spec 2026-10-03, D12): só o cargo Gestor(a) tem.
export const FUNCOES = Object.freeze([
  { valor: 1, rotulo: 'Gestor 1' },
  { valor: 2, rotulo: 'Gestor 2' },
]);
export const temFuncao = (cargo) => rotulaCargo(cargo) === CARGO_GESTOR;
const funcaoValida = (f) => (f === 1 || f === 2 ? f : null);
```

Gravação com a função, degradando sem a 045:

```js
// Sem a migration 045 a coluna `funcao` não existe: o PostgREST recusa a
// gravação inteira (PGRST204) e o Postgres, 42703. Sem função a gravar,
// refaz sem a chave - o local de trabalho não pode deixar de salvar por
// causa de uma coluna que nem seria preenchida. Com função, avisa: gravar
// calado sem ela seria perder o que a pessoa acabou de informar.
const SEM_COLUNA = new Set(['PGRST204', '42703']);
async function gravarComFuncao(row, gravar) {
  let r = await gravar(row);
  if (r.error && SEM_COLUNA.has(r.error.code)) {
    if (row.funcao !== null) {
      const e = new Error('O banco ainda não tem a função do gestor. Avise a Gerência para aplicar a atualização.');
      e.code = r.error.code; e.amigavel = true;
      throw e;
    }
    const { funcao, ...semFuncao } = row;
    r = await gravar(semFuncao);
  }
  return r;
}
```

Em `criarVinculo` (assinatura ganha `funcao = null`):

```js
  const row = { servidor_id, unidade_id, papel: cargo, ano, ingresso, fim,
    funcao: temFuncao(cargo) ? funcaoValida(funcao) : null };
  const { data, error } = await gravarComFuncao(row,
    (r) => sb().from('vinculo').insert(r).select().single());
```

Em `atualizarVinculo` (assinatura ganha `funcao = null`):

```js
  const patch = { unidade_id, papel: cargo, ano, ingresso, fim,
    funcao: temFuncao(cargo) ? funcaoValida(funcao) : null };
  const { error } = await gravarComFuncao(patch,
    (p) => sb().from('vinculo').update(p).eq('id', id));
```

E, antes de `excluirVinculo`:

```js
// Troca de função COM data (spec 2026-10-03, D12): o período atual termina
// na véspera e outro começa, com a função nova - é assim que fica o
// histórico de quem foi Gestor 2 e passou a Gestor 1 na mesma escola.
// Fecha ANTES de abrir: o índice vinculo_aberto_unico não aceita dois
// abertos com o mesmo cargo. Se a abertura falhar, o fechamento é desfeito
// - meio caminho deixaria a pessoa sem local de trabalho atual.
export async function mudarFuncao(servidorId, vinculo, funcao, desde) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const erro = (texto) => Object.assign(new Error(texto), { amigavel: true });
  if (!funcaoValida(funcao)) throw erro('Escolha Gestor 1 ou Gestor 2.');
  if (!desde) throw erro('Informe a partir de quando a função mudou.');
  const vespera = addDias(desde, -1);
  if (vinculo.ingresso && vespera < vinculo.ingresso) {
    throw erro('A mudança precisa ser depois do início deste local de trabalho.');
  }
  const fechar = await sb().from('vinculo').update({ fim: vespera }).eq('id', vinculo.id);
  if (fechar.error) throw fechar.error;
  const { data, error } = await sb().from('vinculo').insert({
    servidor_id: servidorId, unidade_id: vinculo.unidade_id, papel: vinculo.papel,
    ano: Number(String(desde).slice(0, 4)), ingresso: desde, fim: null, funcao,
  }).select().single();
  if (error) {
    await sb().from('vinculo').update({ fim: null }).eq('id', vinculo.id);
    invalidar();
    throw error;
  }
  invalidar();
  return data;
}
```

Conferir `wc -l src/modules/servidores/*.model.js`: cada um ≤ 250.

- [ ] **Step 5: Testes passam.** `node --test tests/*.mjs` → tudo verde.

- [ ] **Step 6: Commit.**

```bash
python .claude/scripts/verificar_arquitetura.py
git diff --cached   # depois do add: nenhum dado real
git add supabase/migrations/045_funcao_gestor_e_supervisao.sql src/modules/servidores tests/vinculos.test.mjs
git commit -m "feat(servidores): funcao do gestor no local de trabalho e ordem da equipe (migration 045)"
git push origin dev
```

---

### Task 9: Função do gestor - formulários e ficha do servidor (D12)

**Files:**
- Modify: `src/modules/servidores/views/vinculo.js`
- Modify: `src/modules/servidores/views/formulario.js` (cadastro novo: a função junto do cargo)
- Modify: `src/modules/servidores/views/detalhe.js` (rótulos)
- Modify: `src/modules/servidores/views/lista.js` (rótulo do cargo no card, se usar `cargoDe` para exibir)
- Docs: `docs/modulos/servidores.md`

**Interfaces:**
- Consumes: `FUNCOES`, `temFuncao`, `mudarFuncao`, `criarVinculo`/`atualizarVinculo` com `funcao` (`vinculos.model.js`); `quemTemFuncao` (`equipe.model.js`); `rotulaVinculo`, `cargoExibidoDe` (`servidores.model.js`).

- [ ] **Step 1: `vinculo.js` - os dois campos.** Imports: `import { criarVinculo, atualizarVinculo, excluirVinculo, rotulaCargo, FUNCOES, temFuncao, mudarFuncao } from '../vinculos.model.js';` e `import { quemTemFuncao } from '../equipe.model.js';`.

No grupo "Local de trabalho", depois do `#v-novo-wrap`:

```js
            <label class="col-full" id="v-funcao-wrap" hidden>Função
              <select id="v-funcao">
                <option value="">Não definida</option>
                ${FUNCOES.map(f => `<option value="${f.valor}" ${vinculo?.funcao === f.valor ? 'selected' : ''}>${esc(f.rotulo)}</option>`).join('')}
              </select>
            </label>
            <label class="col-full" id="v-desde-wrap" hidden>Mudou a partir de
              <input id="v-desde" type="date" />
              <small class="form-hint">Preencha se a pessoa trocou de função: o período anterior fica no histórico.
                Em branco, o registro é só corrigido.</small>
            </label>
```

Depois do ouvinte de `sel`:

```js
  // A função só existe no cargo de gestor (D12). "Mudou a partir de" só
  // aparece quando há uma TROCA a datar: local de trabalho atual, que já
  // tinha função, e a escolhida é outra. Definir a função de quem não tinha
  // nenhuma é correção - sem pergunta.
  const cargoEscolhido = () => (sel.value === OUTRO ? document.getElementById('v-novo').value : sel.value);
  const funcaoEscolhida = () => Number(document.getElementById('v-funcao').value) || null;
  const eTroca = () => Boolean(vinculo && !vinculo.fim && vinculo.funcao
    && funcaoEscolhida() && funcaoEscolhida() !== vinculo.funcao);
  const pintarFuncao = () => {
    const gestor = temFuncao(cargoEscolhido());
    document.getElementById('v-funcao-wrap').hidden = !gestor;
    document.getElementById('v-desde-wrap').hidden = !(gestor && eTroca());
  };
  sel.addEventListener('change', pintarFuncao);
  document.getElementById('v-novo').addEventListener('input', pintarFuncao);
  document.getElementById('v-funcao').addEventListener('change', pintarFuncao);
  pintarFuncao();
```

- [ ] **Step 2: `vinculo.js` - salvar.** Em `salvar`, depois das validações existentes:

```js
  const funcao = temFuncao(papel) ? (Number(document.getElementById('v-funcao').value) || null) : null;
  const desde = document.getElementById('v-desde-wrap').hidden ? '' : document.getElementById('v-desde').value;

  // Troca datada: é a única coisa que este salvamento faz. Misturar com
  // mudança de local ou de datas deixaria ambíguo a que período cada
  // alteração pertence.
  if (desde) {
    const mexeuNoResto = unidade_id !== vinculo.unidade_id
      || (ingresso || null) !== (vinculo.ingresso || null) || (fim || null) !== (vinculo.fim || null)
      || rotulaCargo(papel) !== rotulaCargo(vinculo.papel);
    if (mexeuNoResto) return falha(msg, 'Salve a troca de função separada das outras alterações.');
  }
```

No `try`, a gravação e o aviso:

```js
    if (desde) await mudarFuncao(s.id, vinculo, funcao, desde);
    else if (vinculo) await atualizarVinculo(vinculo.id, { unidade_id, papel, ingresso, fim, funcao });
    else await criarVinculo({ servidor_id: s.id, unidade_id, papel, ingresso, fim, funcao });

    // Aviso, não erro (R15): numa transição dois gestores com a mesma
    // função se encostam. A consulta é depois de gravar e não derruba nada.
    if (funcao && !fim) {
      const outro = await quemTemFuncao(unidade_id, funcao, s.id).catch(() => null);
      if (outro) toast({ titulo: `Esta escola já tem Gestor ${funcao}`, texto: outro.nome, tipo: 'atencao' });
    }
```

e o título do toast de sucesso ganha o caso da troca: `desde ? 'Função alterada' : …` (primeiro ramo).

- [ ] **Step 3: Cadastro novo (`formulario.js`).** No grupo "Local de trabalho" do servidor novo, depois de `#s-cargo-novo-wrap`:

```js
            <label class="col-full" id="s-funcao-wrap" hidden>Função
              <select id="s-funcao">
                <option value="">Não definida</option>
                ${FUNCOES.map(f => `<option value="${f.valor}">${esc(f.rotulo)}</option>`).join('')}
              </select>
            </label>
```

Importar `FUNCOES, temFuncao` de `../vinculos.model.js`. No ouvinte de `selCargo` (e num `input` de `#s-cargo-novo`), mostrar `#s-funcao-wrap` quando `temFuncao(cargo escolhido)`. Em `salvarServidor`, `vinc = { unidade_id, papel, ingresso, funcao: temFuncao(papel) ? (Number(document.getElementById('s-funcao').value) || null) : null }`.

- [ ] **Step 4: Rótulos.**
  - `detalhe.js`: na lista de locais, `rotulaCargo(v.papel)` → `rotulaVinculo({ ...v, papel: rotulaCargo(v.papel) })` (import de `../servidores.model.js`); no subtítulo da ficha (`cargoDe(s)`, ~linha 82) → `cargoExibidoDe(s)`.
  - `formulario.js:29` (`const cargo = s ? cargoDe(s) : ''`, o campo derivado) → `cargoExibidoDe(s)`.
  - `lista.js`: `grep -n "cargoDe" src/modules/servidores/views/lista.js src/modules/servidores/servidores.view.js` - onde o resultado é **exibido** no card, `cargoExibidoDe`; onde é **comparado** (filtro por cargo, busca), fica `cargoDe`.
  - `meus-dados.view.js:149` → `cargoExibidoDe(s)`.

- [ ] **Step 5: Navegador.** Sem banco o dev-local não grava; conferir a mecânica do formulário com um servidor fictício:

```js
const m = await import('/src/modules/servidores/views/vinculo.js');
m.formVinculo({ id: 's1', nome: 'SERVIDOR EXEMPLO', vinculos: [] },
  { id: 'v1', unidade_id: 'u1', papel: 'Gestor(a)', funcao: 2, ingresso: '2026-02-01', fim: null },
  { locais: [{ id: 'u1', nome: 'Escola Exemplo' }], cargos: ['Coordenador(a)', 'Gestor(a)'], recarregar: async () => ({}) });
```

  - "Função" aparece com Gestor 2 marcado; trocar o cargo para Coordenador(a) esconde o campo;
  - de volta a Gestor(a), escolher Gestor 1 → aparece "Mudou a partir de"; voltar a Gestor 2 → some;
  - abrir com `funcao: null` → escolher Gestor 1 **não** mostra a data;
  - "Novo servidor": escolher o cargo Gestor(a) abre "Função";
  - 380px e 1280px, claro e escuro, console limpo.

- [ ] **Step 6: Tutorial e commit.** `docs/modulos/servidores.md`: tarefa nova "Informar se o gestor é Gestor 1 ou Gestor 2" e "Registrar uma troca de função" (com e sem data); em "Regras que o sistema aplica", o aviso de função repetida (avisa, não bloqueia) e que a função só existe no cargo de gestor.

```bash
node --test tests/*.mjs && python .claude/scripts/verificar_arquitetura.py
git add src/modules/servidores src/modules/meus-dados docs/modulos/servidores.md
git commit -m "feat(servidores): Gestor 1 e Gestor 2 no local de trabalho, com troca datada e historico"
git push origin dev
```

---

### Task 10: Horários sem supervisão (D14)

**Files:**
- Modify: `src/modules/horarios/views/por-escola.js` (~125-150)
- Modify: `src/modules/horarios/views/por-servidor.js` (~60, ~90-95, ~121)
- Modify: `src/modules/horarios/views/cargos.js` (~32)
- Docs: `docs/modulos/horarios.md`

**Interfaces:**
- Consumes: `eSupervisao`, `vinculosDeEquipe` (`servidores/equipe.model.js`); `rotulaVinculo` (`servidores/servidores.model.js`).

- [ ] **Step 1: Por escola.** Em `carregar()`, logo depois do `Promise.all` (antes da contagem):

```js
  // Supervisão não é equipe da escola (spec 2026-10-03, D13/D14): quem só
  // SUPERVISIONA a unidade não entra na grade, na lista de fora dela, na
  // contagem nem na cobertura. O supervisor tem horário próprio, na
  // Secretaria.
  servidores = servidores.filter(s => vinculosDeEquipe(s).some(v => v.unidade_id === unidadeId));
```

e o `cargoDe` local passa a ler só o vínculo de equipe:

```js
  const cargoDe = (s) => rotulaCargo(vinculosDeEquipe(s).find(v => v.unidade_id === unidadeId)?.papel || '');
```

Importar `vinculosDeEquipe` de `../../servidores/equipe.model.js`; tirar `vinculosAbertos` do import se ficar sem uso. Onde a grade **exibe** o cargo da linha (procurar `it.cargo` / `.cargo` em `por-escola.js` e `grade.js`), o texto mostrado passa a ser `rotulaVinculo` do vínculo de equipe daquela unidade - a chave usada em `cargosGestao.has(cargo)` continua o cargo sem função. Se a exibição estiver dentro de `ordenarParaGrade` (model), acrescentar ao item um campo `cargoExibido` calculado pela view e usar só na pintura; **não** mudar `cargo`.

- [ ] **Step 2: Por servidor.** `comVinculo = servidores.filter(s => vinculosDeEquipe(s).length);`. Na montagem de `locais`:

```js
  // A escola que a pessoa só SUPERVISIONA não é local de jornada (D14) -
  // nem quando sobrou bloco antigo lançado lá.
  const deEquipe = new Set(vinculosDeEquipe(s).map(v => v.unidade_id));
  const soSupervisiona = (id) => !deEquipe.has(id)
    && vinculosAbertos(s).some(v => v.unidade_id === id && eSupervisao(v.papel));
  const locais = new Map();
  for (const b of blocos) {
    if (b.unidade && !soSupervisiona(b.unidade.id) && !locais.has(b.unidade.id)) locais.set(b.unidade.id, b.unidade);
  }
  for (const v of vinculosDeEquipe(s)) if (v.unidade && !locais.has(v.unidade.id)) locais.set(v.unidade.id, v.unidade);
```

Em `painelLocal`: `const vinc = vinculosDeEquipe(s).find(v => v.unidade_id === local.id);`. Importar `eSupervisao, vinculosDeEquipe` de `../../servidores/equipe.model.js`.

- [ ] **Step 3: Equipe gestora.** Em `cargos.js`, depois de carregar: `cargos = cargos.filter(c => !eSupervisao(c));` (import de `eSupervisao`, de `../../servidores/equipe.model.js`), com o comentário: supervisão não compõe a equipe da escola, então não é escolha.

- [ ] **Step 4: Outros leitores.** `grep -rn "getServidoresDaUnidade\|getBlocos(" src --include=*.js` e, para cada tela fora de `horarios/` que monte equipe ou cobertura por escola (o cartão "Hoje" do dashboard, se for o caso), aplicar o mesmo filtro `vinculosDeEquipe`. Relatar o que foi encontrado, mesmo que nada.

- [ ] **Step 5: Verificar.** `node --test tests/*.mjs` (os testes de grade continuam passando) e, no navegador, `#/horarios`: a tela abre sem erro por escola e por servidor; configuração (engrenagem) lista os cargos sem "Supervisor(a)". Console limpo.

- [ ] **Step 6: Tutorial e commit.** `docs/modulos/horarios.md`: em "Regras que o sistema aplica", supervisão não entra na grade nem na cobertura da escola.

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/modules/horarios src/modules/dashboard docs/modulos/horarios.md
git commit -m "feat(horarios): supervisao fora da grade, da cobertura e da equipe gestora"
git push origin dev
```

---

### Task 11: Mapa com pino no cadastro da escola (D15, D16)

**Files:**
- Move: `src/modules/sate/views/mapa-local.js` → `src/shared/ui/mapa-pino.js` (`git mv`)
- Modify: `src/modules/sate/views/locais.js` (import, classe)
- Modify: `src/modules/sate/sate.css` (sai `.local-mapa`), `src/styles/components.css` (entra `.mapa-pino`)
- Modify: `src/modules/escolas/views/formulario.js`
- Modify: `src/modules/escolas/views/localizar.js`
- Modify: `src/core/router.js` (exportar `abrirConfiguracao`)
- Modify: `CLAUDE.md` (exceção do Leaflet), `.claude/rules/arquitetura.md` (tabela de exceções, se citar o caminho)
- Docs: `docs/modulos/escolas.md`

**Interfaces:**
- Produces:
  - `shared/ui/mapa-pino.js`: `montarMapaPino(el, { lat = null, lng = null, aoMover = (lat, lng) => {} }): Promise<{ mover(lat, lng) } | null>` (mesmo contrato do antigo `montarMapaLocal`).
  - `core/router.js`: `abrirConfiguracao(mod): Promise<void>` - abre o painel de configuração do módulo (o que o clique na engrenagem já fazia).

- [ ] **Step 1: Mover e renomear.**

```bash
git mv src/modules/sate/views/mapa-local.js src/shared/ui/mapa-pino.js
```

No arquivo: cabeçalho `FundHub - shared/ui/mapa-pino.js`; `export async function montarMapaPino(…)`; comentário atualizado - é componente comum desde o segundo uso (cadastro de locais do SATE e cadastro de escolas), porque Escolas não pode importar a tela de outro módulo (R2) e duas cópias seriam dois lugares para manter a versão e o SRI do Leaflet (spec 2026-10-03, D16). O texto "CENTRO … onde o mapa abre quando o local não tem ponto" fica.

Em `sate/views/locais.js`: `import { montarMapaPino } from '../../../shared/ui/mapa-pino.js';`, a chamada renomeada e `class="mapa-pino"` no `#l-mapa`.

CSS: tirar as duas regras `.local-mapa` de `sate.css` e pôr em `components.css`, junto dos componentes de formulário:

```css
/* Mapa com pino (shared/ui/mapa-pino.js): o contêiner onde o Leaflet se
   monta. Altura declarada - sem ela o mapa nasce com 0px. */
.mapa-pino { height: 280px; border: 1px solid var(--border); border-radius: var(--radius-btn); }
@media (min-width: 720px) { .mapa-pino { height: 340px; } }
```

`grep -rn "mapa-local\|montarMapaLocal\|local-mapa" src CLAUDE.md .claude docs/superpowers/specs/2026-10-03*` → só a spec pode citar o nome antigo.

- [ ] **Step 2: `abrirConfiguracao` no roteador.** Em `core/router.js`, extrair o corpo do clique da engrenagem:

```js
// Abre o painel de configuração de um módulo - o que a engrenagem faz. É
// exportada porque uma tela aberta A PARTIR do painel (o formulário da
// escola, pelo "Acertar no mapa") precisa voltar para ele, e uma view não
// importa a view de outro módulo (R2). `import()` dinâmico: é a exceção
// nomeada do painel, o mesmo alvo e só ele.
export async function abrirConfiguracao(mod) {
  const { abrirPainelConfig } = await import('../modules/configuracoes/painel.js');
  abrirPainelConfig(mod);
}
```

e o ouvinte passa a `document.getElementById('mod-cfg').addEventListener('click', () => abrirConfiguracao(mod));`.

- [ ] **Step 3: Formulário da escola.** Em `escolas/views/formulario.js`: `import { montarMapaPino } from '../../../shared/ui/mapa-pino.js';`. No grupo "Localização", antes de Latitude:

```js
            <div class="col-full"><div id="ef-mapa" class="mapa-pino"></div></div>
```

e a dica inicial do `#ef-geo-dica` passa a "Clique no mapa ou arraste o pino para acertar o ponto. É a localização que permite ao SATE calcular o tempo de viagem do ônibus."

Depois de `montarPhonesEditor(…)`:

```js
  // Mapa com pino (spec 2026-10-03, D15): o que o OpenStreetMap não acha
  // pelo endereço, a pessoa acerta olhando. Sem rede ou com o CDN fora, o
  // mapa não monta e o formulário segue com latitude e longitude à mão.
  const f = document.getElementById('esc-form');
  const num = (v) => (String(v).trim() === '' ? null : Number(v));
  mapaAtual = null;
  montarMapaPino(document.getElementById('ef-mapa'), {
    lat: num(f.latitude.value), lng: num(f.longitude.value),
    aoMover: (lat, lng) => { f.latitude.value = lat.toFixed(6); f.longitude.value = lng.toFixed(6); },
  }).then((m) => {
    mapaAtual = m;
    if (!m) document.getElementById('ef-mapa')?.setAttribute('hidden', '');
  });
  // Coordenada digitada à mão: o pino acompanha.
  const aoDigitar = () => {
    const lat = num(f.latitude.value), lng = num(f.longitude.value);
    if (temCoordenada(lat, lng)) mapaAtual?.mover(lat, lng);
  };
  f.latitude.addEventListener('change', aoDigitar);
  f.longitude.addEventListener('change', aoDigitar);
```

No topo do módulo: `// Handle do mapa aberto - o módulo tem um modal por vez.` / `let mapaAtual = null;`. Em `localizar()` (o "Localizar pelo endereço" do formulário), depois de preencher os campos: `mapaAtual?.mover(r.lat, r.lng);`. Conferir que `temCoordenada(null, null)` devolve `false` (ler `locais/geografia.model.js`); se aceitar só strings, adaptar a chamada.

- [ ] **Step 4: Painel "Localização das escolas".** Em `escolas/views/localizar.js`: importar `abrirForm` de `./formulario.js`, `abrirConfiguracao` de `../../../core/router.js` e `moduloPorId` de `../../../core/registry.js`.

Em `desenharResumo`, depois do bloco `${ultima ? resultadoHtml(ultima) : ''}`:

```js
      ${pendentesHtml([...r.aLocalizar, ...r.semEndereco], pode)}
```

e, depois de ligar `#geo-iniciar`:

```js
  box.querySelectorAll('[data-acertar]').forEach(b => b.addEventListener('click', () => {
    const u = [...r.aLocalizar, ...r.semEndereco].find(x => String(x.id) === b.dataset.acertar);
    if (u) acertarNoMapa(box, u);
  }));
```

As duas funções novas:

```js
// ── Sem localização: a lista que não se perde ────────────────
// O resultado da última busca vive na memória e some ao recarregar. Esta
// lista vem do cadastro: enquanto a escola não tiver ponto, ela está aqui
// (spec 2026-10-03, D15).
function pendentesHtml(lista, pode) {
  if (!lista.length) return '';
  return `
    <details class="geo-lista" open>
      <summary>Sem localização (${lista.length})</summary>
      <p class="form-hint">O que a busca pelo endereço não achou se acerta olhando: abra a escola e ponha o pino no lugar.</p>
      <ul>${lista.map(u => `<li>
        <span>${esc(u.nome)}<span class="di-meta">${esc(u.endereco || 'sem endereço cadastrado')}</span></span>
        ${pode ? `<button type="button" class="mini-btn" data-acertar="${esc(u.id)}">${ico('visita', { tam: 12 })} Acertar no mapa</button>` : ''}
      </li>`).join('')}</ul>
    </details>`;
}

// O formulário da escola por cima do painel. Na engrenagem o painel É um
// modal, e o formulário o substitui: `voltar` reabre a configuração. Na
// página Configurações o painel fica atrás, e basta repintá-lo ao salvar.
function acertarNoMapa(box, u) {
  const noModal = Boolean(box.closest('.modal'));
  const ctx = { recarregar: async () => { if (visivel(box)) await pintarLocalizacao(box); return ctx; } };
  abrirForm(u, ctx, { voltar: noModal ? () => abrirConfiguracao(moduloPorId('escolas')) : null });
}
```

Ajustar `escolas.css` se o `<li>` precisar de `display: flex; justify-content: space-between; gap: 10px; align-items: center` para o botão ficar à direita (ler a regra atual de `.geo-lista li`). Conferir `wc -l` de `localizar.js` ≤ 400.

- [ ] **Step 5: `CLAUDE.md`.** No parágrafo "Segunda exceção: Leaflet": o mapa com pino é usado pelo cadastro de locais do SATE **e pelo cadastro de escolas**; mora em `src/shared/ui/mapa-pino.js`; carregado só quando um formulário com mapa abre; sem ele, o formulário segue com latitude, longitude e "Localizar pelo endereço". Tirar a frase que mandava mover no terceiro uso. Em `.claude/rules/arquitetura.md`, na linha da exceção do `router.js`, acrescentar que `abrirConfiguracao` exporta essa mesma abertura.

- [ ] **Step 6: Navegador.**
  - `#/escolas` → "Nova escola": o mapa aparece centrado na cidade, com pino apagado; clicar no mapa preenche latitude e longitude (seis casas); digitar coordenada move o pino; abrir a rede em `read_network_requests` e conferir que o Leaflet só é pedido ao abrir o formulário.
  - `sate.html#/locais` → "Novo local": o mapa continua funcionando (o arquivo mudou de lugar).
  - `#/configuracoes` → Escolas → "Localização das escolas": no dev-local a lista vem vazia; conferir que a tela abre sem erro.
  - 380px: o mapa cabe, sem rolagem lateral. Console limpo.

- [ ] **Step 7: Tutorial e commit.** `docs/modulos/escolas.md`: tarefa "Acertar a localização de uma escola no mapa" (pelo formulário e pela lista "Sem localização" das configurações).

```bash
node --test tests/*.mjs && python .claude/scripts/verificar_arquitetura.py
git add -A src/shared/ui/mapa-pino.js src/modules/sate src/modules/escolas src/styles/components.css src/core/router.js CLAUDE.md .claude/rules docs/modulos/escolas.md
git commit -m "feat(escolas): mapa com pino no cadastro e lista das escolas sem localizacao"
git push origin dev
```

---

### Task 12: Ficha da escola (D7)

**Files:**
- Modify: `src/modules/escolas/views/detalhe.js`
- Modify: `src/modules/escolas/escolas.css`, `src/styles/components.css` (tags no cabeçalho do modal)
- Docs: `docs/modulos/escolas.md`

**Interfaces:**
- Consumes: `getEquipeDaUnidade(unidadeId)` (`servidores/equipe.model.js`) → `[{ id, nome, cargo, email, telefone, supervisao, ordem }]`, já ordenada (Tarefa 8).

- [ ] **Step 1: Cabeçalho com as tags.** O `modalHead` aceita HTML no subtítulo:

```js
    ${modalHead(`<span class="nome-oficial">${esc(u.nome)}</span>`,
      chips ? `<span class="tags">${chips}</span>` : '')}
```

e sai o `<div class="tags" style="margin-bottom:14px">` do corpo. Em `components.css`, junto das regras de `.modal-head`:

```css
/* Tags sob o título (ficha da escola): o <small> vira a linha delas. */
.modal-head small:has(> .tags) { display: block; margin-top: 6px; }
```

Atualizar o comentário de cabeçalho do arquivo ("O cabeçalho mostra só o nome" → nome e tags; o nome no SAE vai para "Mais detalhes").

- [ ] **Step 2: Corpo - supervisão, equipe e mais detalhes.** Substituir, no template, do `<h3 class="bloco-tit">Cadastros e links</h3>` até o `</p>` da dica da equipe por:

```js
      <h3 class="bloco-tit">Supervisão</h3>
      <div class="people" id="esc-supervisao">${loading()}</div>

      <hr class="sep" />
      <div class="vinc-head">
        <div class="field" style="margin:0"><div class="lbl" id="esc-equipe-tit">Equipe</div></div>
        <a class="mini-btn" href="#/servidores?unidade=${esc(u.id)}">Gerir em Servidores →</a>
      </div>
      <div class="people" id="esc-equipe">${loading()}</div>
      <p class="form-hint" style="margin-top:10px">
        A equipe vem dos locais de trabalho atuais. Para incluir ou encerrar alguém, use Servidores.
      </p>

      ${maisDetalhes(u, campo)}
```

com a função (fora de `detalhe`):

```js
// O que não precisa aparecer de cara (spec 2026-10-03, D7): identificadores
// que se consultam de vez em quando. Sem nenhum preenchido, o bloco nem nasce.
function maisDetalhes(u, campo) {
  const itens = [
    u.nome_oficial && norm(u.nome_oficial).trim() !== norm(u.nome).trim() ? campo('Nome no SAE', esc(u.nome_oficial)) : '',
    campo('INEP', esc(u.inep)),
    campo('Regional', esc(u.regional)),
    u.site_apm ? campo('Site APM', `<a href="${esc(u.site_apm)}" target="_blank" rel="noopener">abrir</a>`) : '',
  ].join('');
  return itens ? `<details class="mais-detalhes"><summary>Mais detalhes</summary>${itens}</details>` : '';
}
```

Conferir que `campo('INEP', esc(u.inep))` com `u.inep` vazio devolve `''` (o `campo` atual testa `v`).

- [ ] **Step 3: `pintarEquipe` separa os dois grupos.**

```js
  // Supervisão não é equipe (spec 2026-10-03, D13): é dado da escola, em
  // bloco próprio. A lista já vem na ordem da equipe - Gestor 1, Gestor 2,
  // coordenação, demais (servidores/equipe.model.js).
  const equipe = pessoas.filter(p => !p.supervisao);
  const supervisao = pessoas.filter(p => p.supervisao);

  const tit = document.getElementById('esc-equipe-tit');
  if (tit) tit.textContent = `Equipe (${equipe.length})`;

  const verServidor = podeAbrirFicha('servidores');
  const editarServidor = verServidor && podeEscrever('servidores');
  const cards = (lista) => lista.map(p => cardPessoa(p, { clicavel: verServidor, editar: editarServidor })).join('');

  box.innerHTML = equipe.length ? cards(equipe) : '<p class="count">Sem pessoas vinculadas.</p>';
  const boxSup = document.getElementById('esc-supervisao');
  if (boxSup) boxSup.innerHTML = supervisao.length ? cards(supervisao) : '<p class="count">Sem supervisão informada.</p>';

  for (const raiz of [box, boxSup].filter(Boolean)) {
    raiz.querySelectorAll('[data-abrir-servidor]').forEach(b => b.addEventListener('click', () =>
      abrirFicha('servidores', b.dataset.abrirServidor, abrirOpts)));
    raiz.querySelectorAll('[data-editar-servidor]').forEach(b => b.addEventListener('click', () =>
      abrirFicha('servidores', b.dataset.editarServidor, { ...abrirOpts, editar: true })));
  }
```

No ramo de erro (`catch`), pintar o erro em `box` e limpar `#esc-supervisao`. Apagar o trecho antigo equivalente (o `if (!pessoas.length)` e a ligação dos ouvintes).

- [ ] **Step 4: CSS em `escolas.css`.**

```css
/* "Mais detalhes" da ficha (spec 2026-10-03, D7): recolhido por padrão. */
.mais-detalhes { margin-top: 18px; border-top: 1px solid var(--border); padding-top: 12px; }
.mais-detalhes > summary {
  cursor: pointer; color: var(--muted);
  font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
}
.mais-detalhes[open] > summary { margin-bottom: 10px; }
```

- [ ] **Step 5: Navegador.** No dev-local, abrir a ficha de uma escola das fixtures: tags sob o nome, no cabeçalho; bloco "Supervisão" e bloco "Equipe" separados (sem banco, os dois vazios com a mensagem certa); "Mais detalhes" fechado, abre no clique e no teclado. 380px e 1280px, claro e escuro, console limpo.

- [ ] **Step 6: Tutorial e commit.** `docs/modulos/escolas.md`: a ficha (supervisão separada, ordem da equipe, "Mais detalhes").

```bash
node --test tests/*.mjs && python .claude/scripts/verificar_arquitetura.py
git add src/modules/escolas src/styles/components.css docs/modulos/escolas.md
git commit -m "feat(escolas): ficha com tags no cabecalho, supervisao a parte, equipe ordenada e mais detalhes"
git push origin dev
```

---

### Task 13: Fechamento - versões, changelog e regras

**Files:**
- Modify: `src/core/config.js` (`versao: '0.39.0'`, `versaoSate: '0.18.0'`)
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/ui.md`
- Modify: memória `fundhub-estado-banco.md` (a 0.39.0 exige a migration 045)

- [ ] **Step 1: Versões.** `CONFIG.versao = '0.39.0'`, `CONFIG.versaoSate = '0.18.0'`.

- [ ] **Step 2: CHANGELOG.** Ler a entrada `0.38.1` como modelo literal de formato (`## [X.Y.Z] - aaaa-mm-dd`, resumo, `### Adicionado` / `### Alterado` / `### Corrigido`). Entrada `## [0.39.0] - 2026-10-03`, escrita para quem usa, sem jargão nem nome de arquivo:
  - **Adicionado:** tema claro ou escuro (menu de usuário e Configurações); Gestor 1 e Gestor 2 no local de trabalho, com histórico da troca; mapa com pino no cadastro da escola e lista das escolas sem localização; no SATE, sugestão do servidor responsável com o telefone, cor por pessoa e configurações para a escola.
  - **Alterado:** data do pedido só com dia e mês; "saída do evento" e "servidor(a) responsável"; supervisão fora da equipe da escola e de Horários; ficha da escola reorganizada; Configurações em blocos que abrem e fecham; telefone já com uma linha; e-mail institucional com o domínio sugerido; filtros sem esticar; "Ver como escola" com o nome completo; a escola não vê o link para o FundHub.
  - **Corrigido:** ícones de calendário e de relógio que tinham sumido dos campos em janelas; seta das listas colada na borda; fundo dos campos pouco distinto.
  - Nota de banco: **exige a migration 045**.
  - Linha nova na tabela "Versões do SATE": `| 0.18.0 | 0.39.0 | data só com dia e mês, servidor responsável com telefone automático, tema e cor por pessoa |`.

- [ ] **Step 3: `.claude/rules/ui.md`.** Acrescentar, nas seções que já tratam do assunto:
  - em "Formulário: três papéis…": o fundo do campo é `--campo-bg` (um token, dentro e fora de grupo) e **fundo de campo é sempre `background-color`** - o atalho apaga os ícones de data, hora e a seta do `select`, que são `background-image`;
  - em "Grupos, foco e saída de modal": tirar "os campos dentro ficam em `--surface`";
  - em R9: o tema é `:root[data-tema="escuro"]`, aplicado por `core/tema.js`; não escrever `@media (prefers-color-scheme: dark)`;
  - vocabulário: `.mapa-pino` (usar via `shared/ui/mapa-pino.js`).

- [ ] **Step 4: Verificação final.**

```bash
node --test tests/*.mjs
python .claude/scripts/verificar_arquitetura.py
grep -rn "dev@local" src/                       # só docs.content.js
grep -rn "prefers-color-scheme" src --include=*.css   # vazio
git status                                      # config.js e perfil.js sem o patch de dev-local
```

Esperado: testes verdes; verificador sem bloqueio (avisos da checagem 11, se houver, apontam tutorial a atualizar - resolver).

- [ ] **Step 5: Commit.**

```bash
git add src/core/config.js CHANGELOG.md .claude/rules/ui.md
git commit -m "docs: versao 0.39.0 (SATE 0.18.0), changelog e regras de ui"
git push origin dev
```

- [ ] **Step 6: Avisar o André.** A migration `045_funcao_gestor_e_supervisao.sql` precisa ser rodada no SQL Editor antes de validar a função do gestor na URL de dev. Sem ela, o resto funciona e a escolha de função avisa que o banco não foi atualizado.
