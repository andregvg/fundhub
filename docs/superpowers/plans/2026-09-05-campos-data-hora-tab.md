# Campos de Data e Hora - Tab vai para o próximo campo - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o Tab sair de um `<input type="date">` em exatamente 3 passos e de um `<input type="time">` em exatamente 2 (um por segmento), eliminando a parada extra causada pelo indicador nativo do navegador - sem perder o ícone visual nem o clique que abre o seletor.

**Architecture:** `components.css` esconde o `::-webkit-calendar-picker-indicator` (a causa raiz) e repõe um ícone equivalente via `background-image` (dois SVGs embutidos por campo, um por tema - `mask-image` foi testado e descartado por apagar o campo inteiro, não só o ícone). Um único módulo novo em `shared/ui/` liga, uma vez no boot, um ouvinte de clique delegado em `document` que chama `HTMLInputElement.showPicker()` quando o clique cai na faixa onde o ícone está desenhado.

**Tech Stack:** JavaScript puro (sem framework, sem build), CSS com `background-image`/data URI, testes com `node:test` (`node --test "tests/*.mjs"`).

**Spec:** `docs/superpowers/specs/2026-09-05-campos-data-hora-tab-design.md`

## Global Constraints

- PT-BR em código, comentário e commit.
- Nenhuma view das 14 telas com campo de data/hora é alterada - a correção é 100% em `components.css` + um módulo novo de `shared/ui/` + uma chamada em `main.js` (spec § 4 e § 5).
- Rodar `python .claude/scripts/verificar_arquitetura.py` sem violações antes de cada commit.
- Rodar `node --test "tests/*.mjs"` sem falhas antes de cada commit.
- Trabalhar na branch `dev`.
- `#656d76` e `#93a0bd` (usados dentro das data URIs dos ícones) são os valores literais de `--muted` claro/escuro em `tokens.css` - não são cor de módulo (R9 é sobre `src/modules/**`), mas precisam de um comentário explícito apontando de volta ao token, porque uma data URI não pode referenciar `var(--muted)` (limitação de CSS, não escolha de estilo).

---

## Task 1: CSS - esconder o indicador nativo e repor o ícone por `background-image`

**Files:**
- Modify: `src/styles/components.css:550-567` (bloco de altura de data/hora, incluindo o comentário que hoje termina com "O indicador do calendário FICA: trocar o seletor nativo de data por causa de alguns pixels não compensa." - essa frase fica desatualizada com esta task e sai)

**Interfaces:**
- Consumes: nada (CSS puro).
- Produces: nenhuma classe ou seletor novo consumido por JS - a Task 2 só depende do **comportamento visual** (ícone na faixa direita do campo), não de nenhum nome de classe.

- [ ] **Step 1: Substituir o bloco em `src/styles/components.css`**

Localizar o bloco atual (linhas 550-567):

```css
/* Data e hora saem mais altos que o campo de texto ao lado por dois
   motivos empilhados - os dois medidos no browser, não deduzidos:
   1) o WebKit dá padding próprio ao invólucro dos campinhos internos
      (dia/mês/ano) - é o -fields-wrapper que carrega esse padding, não o
      ::-webkit-datetime-edit, os dois não são intercambiáveis;
   2) mesmo com esse padding zerado, o controle nativo ainda reivindica
      uma altura mínima própria maior que --campo (medido: 38,8px contra
      36px, com min-height IGUAL nos dois - min-height não segura quando
      o conteúdo interno pede mais).
   `height` (e não `min-height`) resolve o (2): trava o teto em --campo
   sem cortar o texto nem o ícone do calendário (conferido no browser).
   Paradigma do hub - ver .claude/rules/ui.md R17: data e hora têm SEMPRE
   a mesma altura dos campos vizinhos, em qualquer módulo.
   O indicador do calendário FICA: trocar o seletor nativo de data por
   causa de alguns pixels não compensa. */
input[type="date"], input[type="time"] { height: var(--campo); }
input[type="date"]::-webkit-datetime-edit-fields-wrapper,
input[type="time"]::-webkit-datetime-edit-fields-wrapper { padding: 0; }
```

Substituir por (a última frase do comentário de altura sai; o resto do
comentário de altura permanece igual; três blocos novos entram depois):

```css
/* Data e hora saem mais altos que o campo de texto ao lado por dois
   motivos empilhados - os dois medidos no browser, não deduzidos:
   1) o WebKit dá padding próprio ao invólucro dos campinhos internos
      (dia/mês/ano) - é o -fields-wrapper que carrega esse padding, não o
      ::-webkit-datetime-edit, os dois não são intercambiáveis;
   2) mesmo com esse padding zerado, o controle nativo ainda reivindica
      uma altura mínima própria maior que --campo (medido: 38,8px contra
      36px, com min-height IGUAL nos dois - min-height não segura quando
      o conteúdo interno pede mais).
   `height` (e não `min-height`) resolve o (2): trava o teto em --campo
   sem cortar o texto nem o ícone do calendário (conferido no browser).
   Paradigma do hub - ver .claude/rules/ui.md R17: data e hora têm SEMPRE
   a mesma altura dos campos vizinhos, em qualquer módulo. */
input[type="date"], input[type="time"] { height: var(--campo); }
input[type="date"]::-webkit-datetime-edit-fields-wrapper,
input[type="time"]::-webkit-datetime-edit-fields-wrapper { padding: 0; }

/* O indicador nativo (::-webkit-calendar-picker-indicator) entra na ordem
   de tabulação do Chromium como uma parada A MAIS depois do último
   segmento (dd/mm/aaaa ou hh/mm) - medido: 4 Tabs para sair de um campo
   de data com 3 segmentos, 3 Tabs para um de hora com 2. Como o ícone
   vive no shadow DOM do campo, `activeElement` não muda durante essa
   parada e não há como interceptá-la por JS - a única saída é remover o
   indicador da árvore de foco. Ver
   docs/superpowers/specs/2026-09-05-campos-data-hora-tab-design.md. */
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator { display: none; }

/* O ícone volta por conta própria, como background-image - MASK-IMAGE FOI
   TESTADO E DESCARTADO: aplicado ao <input> inteiro, ele recorta a
   visibilidade do campo TODO para a área do ícone (o texto digitado some
   junto, não só o indicador nativo). background-image não tem esse efeito
   colateral: pinta sobre o fundo existente sem afetar o resto da caixa.
   Duas cores, não uma var(--token): uma data URI não enxerga variável CSS
   do documento que a referencia. #656d76/#93a0bd são --muted claro/escuro
   (tokens.css) copiados à mão - se --muted mudar lá, mudar aqui junto.
   O clique nesta faixa (canto direito, ~26px) abre o seletor nativo via
   showPicker() - ver shared/ui/campo-data-hora.js. */
input[type="date"], input[type="time"] {
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px 16px;
  padding-right: 28px;
}
input[type="date"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23656d76' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");
}
input[type="time"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23656d76' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3C/svg%3E");
}
@media (prefers-color-scheme: dark) {
  input[type="date"] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2393a0bd' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");
  }
  input[type="time"] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2393a0bd' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3C/svg%3E");
  }
}
```

- [ ] **Step 2: Verificar que o CSS é válido (chaves balanceadas)**

```bash
node -e "const fs=require('fs'); const c=fs.readFileSync('src/styles/components.css','utf-8'); const abre=(c.match(/\{/g)||[]).length; const fecha=(c.match(/\}/g)||[]).length; console.log('chaves:', abre, fecha, abre===fecha ? 'OK' : 'DESBALANCEADO');"
```

Expected: `chaves: N N OK`.

- [ ] **Step 3: Rodar a verificação de arquitetura**

Run: `python .claude/scripts/verificar_arquitetura.py`
Expected: `OK - nenhuma violacao encontrada.`

- [ ] **Step 4: Rodar a suíte de testes (nenhuma mudança esperada, é checagem de regressão)**

Run: `node --test "tests/*.mjs"`
Expected: PASS, todos os testes existentes continuam passando (CSS não afeta lógica JS).

- [ ] **Step 5: Commit**

```bash
git add src/styles/components.css
git commit -m "feat(campos): esconde indicador nativo de data/hora, repoe icone por CSS

O indicador nativo (::-webkit-calendar-picker-indicator) entrava na ordem
de tabulacao como uma parada extra depois do ultimo segmento do campo -
medido: 4 Tabs para sair de uma data (3 segmentos), 3 para uma hora (2).
Escondido via display:none; o icone volta como background-image (nao
mask-image, que apaga o campo inteiro - testado e descartado)."
```

---

## Task 2: `shared/ui/campo-data-hora.js` - clique no ícone abre o seletor

**Files:**
- Create: `src/shared/ui/campo-data-hora.js`
- Test: `tests/campo-data-hora.test.mjs`

**Interfaces:**
- Consumes: nada de outro módulo (usa só `document`, `HTMLInputElement.showPicker`, ambos nativos do navegador).
- Produces: `LARGURA_ICONE` (number, 26), `cliqueNoIcone(offsetX, larguraCampo)` (function, retorna boolean), `ligarCamposDataHora()` (function, sem retorno - efeito colateral: liga o ouvinte). Task 3 consome só `ligarCamposDataHora`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/campo-data-hora.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { cliqueNoIcone, LARGURA_ICONE } from '../src/shared/ui/campo-data-hora.js';

test('clique no meio do campo nao conta como clique no icone', () => {
  assert.equal(cliqueNoIcone(10, 200), false);
});

test('clique bem a direita, dentro da faixa do icone, conta', () => {
  assert.equal(cliqueNoIcone(190, 200), true);
});

test('a borda exata da faixa do icone conta como icone (inclusiva)', () => {
  assert.equal(cliqueNoIcone(200 - LARGURA_ICONE, 200), true);
});

test('um pixel antes da faixa do icone nao conta como icone', () => {
  assert.equal(cliqueNoIcone(200 - LARGURA_ICONE - 1, 200), false);
});

test('LARGURA_ICONE e um numero positivo (sanity da constante)', () => {
  assert.equal(typeof LARGURA_ICONE, 'number');
  assert.ok(LARGURA_ICONE > 0);
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `node --test tests/campo-data-hora.test.mjs`
Expected: FAIL - o módulo `src/shared/ui/campo-data-hora.js` ainda não existe (erro de import/módulo não encontrado).

- [ ] **Step 3: Criar `src/shared/ui/campo-data-hora.js`**

```js
// ============================================================
// FundHub - shared/ui/campo-data-hora.js
// Comportamento global de todo <input type="date"> e <input type="time">
// do hub: o clique no canto direito do campo (onde o ícone desenhado em
// CSS aparece) abre o seletor nativo via showPicker(). O ícone nativo do
// navegador foi escondido (components.css) porque ele entrava na ordem
// de tabulação como uma parada a mais depois do último segmento - ver
// docs/superpowers/specs/2026-09-05-campos-data-hora-tab-design.md.
//
// Um ouvinte só, delegado em document, cobre os 32 campos de hoje e
// qualquer campo futuro - inclusive um que nasça dentro de uma gaveta
// aberta bem depois deste módulo já ter sido ligado (uma vez, no boot).
// ============================================================

// Largura da faixa clicável do ícone, em pixels - precisa bater com
// `background-size` + a folga de `background-position` em components.css
// (16px de ícone + 8px de respiro à direita + uma margem de acerto).
export const LARGURA_ICONE = 26;

// Pura: decide se um clique caiu na faixa do ícone (canto direito do
// campo). Extraída à parte para poder ser testada sem DOM - o mesmo
// padrão de shared/ui/toast.js (normalizarTipo/duracaoPadrao puras,
// o resto do módulo com efeito colateral).
export function cliqueNoIcone(offsetX, larguraCampo) {
  return offsetX >= larguraCampo - LARGURA_ICONE;
}

export function ligarCamposDataHora() {
  document.addEventListener('click', (e) => {
    const campo = e.target.closest('input[type="date"], input[type="time"]');
    if (!campo || campo.disabled || campo.readOnly) return;
    if (!cliqueNoIcone(e.offsetX, campo.clientWidth)) return;
    campo.showPicker?.();
  });
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `node --test tests/campo-data-hora.test.mjs`
Expected: PASS - 5 testes passando.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `node --test "tests/*.mjs"`
Expected: PASS, nenhuma regressão.

- [ ] **Step 6: Rodar a verificação de arquitetura**

Run: `python .claude/scripts/verificar_arquitetura.py`
Expected: `OK - nenhuma violacao encontrada.`

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui/campo-data-hora.js tests/campo-data-hora.test.mjs
git commit -m "feat(campo-data-hora): clique no icone desenhado abre o seletor nativo

showPicker() chamado a partir de um unico ouvinte delegado em document -
cobre os 32 campos de data/hora de hoje e qualquer campo futuro, inclusive
dentro de uma gaveta aberta depois do boot. cliqueNoIcone() extraida pura
para poder ser testada sem DOM (mesmo padrao de shared/ui/toast.js)."
```

---

## Task 3: Ligar `ligarCamposDataHora()` no boot

**Files:**
- Modify: `src/main.js:1-23` (bloco de imports) e `src/main.js:89-93` (início da função `boot()`)

**Interfaces:**
- Consumes: `ligarCamposDataHora` de `src/shared/ui/campo-data-hora.js` (Task 2).
- Produces: nada novo - `main.js` não exporta nada.

- [ ] **Step 1: Acrescentar o import**

Em `src/main.js`, depois da linha `import { limparCaches } from './shared/cache.js';` (linha 22), acrescentar:

```js
import { ligarCamposDataHora } from './shared/ui/campo-data-hora.js';
```

- [ ] **Step 2: Chamar a função no início de `boot()`**

O início atual de `boot()` (linhas 89-93):

```js
async function boot() {
  carimboRodape();

  // Modo dev-local (sem Supabase configurado): sem gate, sem dados.
  if (!hasSupabase()) { montarApp(null); return; }
```

Vira:

```js
async function boot() {
  carimboRodape();
  ligarCamposDataHora();

  // Modo dev-local (sem Supabase configurado): sem gate, sem dados.
  if (!hasSupabase()) { montarApp(null); return; }
```

`ligarCamposDataHora()` entra **antes** do `if (!hasSupabase())`, no mesmo nível que `carimboRodape()`: é comportamento do hub inteiro, inclusive na tela de login (que não tem campo de data, mas o ouvinte não faz mal nenhum ali) e no modo dev-local sem banco.

- [ ] **Step 3: Rodar a suíte de testes**

Run: `node --test "tests/*.mjs"`
Expected: PASS, nenhuma regressão (main.js não tem teste próprio - é boot, sem lógica pura a extrair).

- [ ] **Step 4: Rodar a verificação de arquitetura**

Run: `python .claude/scripts/verificar_arquitetura.py`
Expected: `OK - nenhuma violacao encontrada.`

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat(main): liga o comportamento de clique nos campos de data/hora no boot"
```

---

## Task 4: Verificação em dev-local e nos critérios de aceite

**Files:**
- Nenhum arquivo novo - esta tarefa verifica o resultado das Tasks 1-3 no navegador, seguindo os critérios de aceite da spec (§ 7).

**Interfaces:**
- Consumes: tudo das Tasks 1-3.
- Produces: nada - é o checkpoint manual antes de considerar o bloco pronto.

- [ ] **Step 1: Subir o servidor de dev-local**

```bash
python .claude/devserver.py 8123
```

(Ou usar a ferramenta de preview do ambiente, apontando para a configuração `fundhub` de `.claude/launch.json`, porta 8123.)

Para ver campos de data/hora reais sem precisar de login/Supabase, aplicar
o patch temporário de dev-local (reverter antes de commitar qualquer
coisa - nenhum destes dois arquivos entra em commit desta task):
- `src/core/config.js`: `supabaseAnonKey: ''`
- `src/core/perfil.js`, dentro de `getPerfilAtual()`, no ramo
  `if (!hasSupabase())`: retornar um perfil sintético com `definirMapa`
  liberando tudo (ver `docs/superpowers/specs/...` de outras rodadas para
  o padrão exato, ou o histórico de commits do projeto).

- [ ] **Step 2: Contar os Tabs num campo de data**

Abrir qualquer tela com campo de data (ex.: Servidores → editar → data de
nascimento, ou Afastamentos → novo). Clicar no primeiro segmento do campo
de data e apertar Tab três vezes, contando: o foco deve estar no **próximo
campo do formulário** depois do 3º Tab - não deve sobrar nenhuma parada no
ícone.

Pode-se confirmar por script no console do navegador, com o campo focado:
```js
document.activeElement.id  // antes de cada Tab, para comparar
```

- [ ] **Step 3: Contar os Tabs num campo de hora**

Abrir Horários → aba "Por escola" → escolher uma escola → editar a
jornada de um servidor (ícone de lápis). Focar o primeiro segmento de um
campo de hora (`hh`) e apertar Tab duas vezes: o foco deve sair do campo
de hora depois do 2º Tab.

- [ ] **Step 4: Conferir o ícone visualmente, nos dois temas**

No mesmo campo de data e de hora, confirmar que o ícone (calendário e
relógio, respectivamente) continua aparecendo no canto direito, nos temas
claro e escuro (alternar via emulação de `prefers-color-scheme` no
navegador, ou no sistema operacional).

- [ ] **Step 5: Confirmar que o clique no ícone abre o seletor**

Clicar diretamente sobre o ícone desenhado (canto direito do campo): o
seletor nativo do navegador (calendário ou relógio) deve abrir. Clicar no
meio do campo (sobre o texto) deve posicionar o cursor para digitar, sem
abrir o seletor.

- [ ] **Step 6: Confirmar `Alt+↓` (ou equivalente do navegador em uso)**

Com o campo de data focado, testar o atalho que o navegador usa para
abrir o seletor por teclado (`Alt+↓` no Chrome/Edge Windows). Se não
abrir nativamente com o indicador escondido, isso é um risco já previsto
na spec (§ 6) - reportar como achado, não é bloqueante por si só, mas
precisa constar na revisão.

- [ ] **Step 7: Verificar o caso de mais campos seguidos (jornada semanal)**

Abrir a gaveta de jornada semanal de um servidor em Horários (o caso com
mais campos de hora em sequência - até 10, cinco dias × dois campos).
Preencher um bloco de horário usando só o teclado (digitar hora, Tab,
digitar minuto seria dentro do mesmo campo; o Tab relevante é entre os
campos "início" e "fim", e entre blocos) e confirmar que a navegação por
Tab está fluida, sem paradas extras.

- [ ] **Step 8: Testar em 375px**

Reduzir a largura da janela (ou emular) para 375px e confirmar que os
campos de data/hora continuam legíveis, com o ícone no lugar certo, sem
sobrepor o texto digitado.

- [ ] **Step 9: Reverter o patch de dev-local**

Reverter as duas mudanças temporárias do Step 1 (`config.js` e
`perfil.js`). Confirmar:

```bash
git status --short
git diff --stat
```

Expected: nenhuma saída (árvore de trabalho limpa) - se algo aparecer,
reverter antes de prosseguir.

- [ ] **Step 10: Rodar a verificação de arquitetura uma última vez**

```bash
python .claude/scripts/verificar_arquitetura.py
```

Expected: `OK - nenhuma violacao encontrada.`

Nenhum commit nesta tarefa - é checkpoint de verificação. Se algo estiver
errado, voltar à task correspondente, corrigir e commitar lá.

---

## Self-Review Summary

**Spec coverage** (`2026-09-05-campos-data-hora-tab-design.md`):
- D1 (esconder o indicador nativo, globalmente, em `components.css`) → Task 1.
- D2 (o ícone volta por `background-image`, dois SVGs por tema, `mask-image` descartado com a razão documentada) → Task 1.
- D3 (clique no ícone abre o seletor via `showPicker()`, ouvinte delegado) → Task 2.
- D4 (mora em `shared/ui/campo-data-hora.js`, ligado uma vez no boot) → Task 2 (arquivo) + Task 3 (chamada no boot).
- D5 (alternativas descartadas) → não gera task, é justificativa; referenciada nos comentários de código da Task 1 e 2.
- Critérios de aceite 1-2 (contagem de Tabs) → Task 4, Steps 2-3.
- Critério 3 (ícone nos dois temas) → Task 4, Step 4.
- Critério 4 (clique no ícone vs. clique no texto) → Task 4, Step 5.
- Critério 5 (`Alt+↓`) → Task 4, Step 6.
- Critério 6 (nenhuma das 14 telas alterada) → garantido estruturalmente pelas Tasks 1-3 (nenhuma delas toca em `src/modules/**`); confirmável por `git diff --stat` ao final.
- Critério 7 (jornada semanal, mais campos seguidos) → Task 4, Step 7.
- Critério 8 (`verificar_arquitetura.py` limpo) → Step de cada task + Task 4, Step 10.

**Placeholder scan:** nenhum "TBD"/"implementar depois" - todo trecho de CSS e JS é literal e completo, incluindo as data URIs exatas dos dois ícones nos dois temas.

**Type/name consistency:** `LARGURA_ICONE` e `cliqueNoIcone` são definidos na Task 2 e usados exatamente com esses nomes dentro do próprio `ligarCamposDataHora()` (mesma task) - não há uso em task posterior com nome diferente. `ligarCamposDataHora` é o único nome que atravessa para a Task 3, e o import em `main.js` usa esse nome exato.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-05-campos-data-hora-tab.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
