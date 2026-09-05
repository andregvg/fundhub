# Filtro de Segmento - Cores por Eixo - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o filtro de segmento (e os chips de segmento em Usuários) mostrarem cor por eixo pedagógico (Ensino Fundamental = azul, Educação Infantil = âmbar, "Todas" = cinza destacado) e remover os ícones dos chips de segmento, mantendo o ícone do botão "limpar".

**Architecture:** `core/segmentos.js` ganha um campo `eixo` por segmento-base (e perde o campo `ico`, que fica sem uso). `shared/ui/filtro-segmento.js` para de chamar `ico()` nos chips de segmento/atalho e passa a emitir `data-eixo="<id>"` neles. `components.css` define três tokens de cor em `tokens.css` e faz `.chip.on` ler de uma variável CSS `--eixo` que cada `data-eixo` redefine - o padrão da variável é `var(--brand)`, o que preserva 100% do visual de todo chip fora do filtro de segmento (afastamentos, escalas, etc.).

**Tech Stack:** JavaScript puro (sem framework, sem build), CSS com custom properties, testes com `node:test` (`node --test "tests/*.mjs"`).

**Spec:** `docs/superpowers/specs/2026-09-05-filtro-segmento-cores-design.md`

## Global Constraints

- Nenhuma cor literal (`#hex`, `rgb()`, `hsl()`) fora de `src/styles/tokens.css` (R9 - `.claude/rules/ui.md`).
- Todo valor vindo do banco ou do usuário passa por `esc()` antes de virar HTML (R5) - não se aplica a esta mudança porque nada aqui é dado dinâmico novo, mas os templates existentes que já usam `esc()` continuam usando.
- Zero ciclo de import; `core/` nunca importa `modules/` nem `shell/` (R1).
- PT-BR em código, comentário, commit e interface.
- Rodar `python .claude/scripts/verificar_arquitetura.py` sem violações antes de considerar qualquer tarefa concluída.
- Rodar `node --test "tests/*.mjs"` sem falhas antes de cada commit.
- Trabalhar na branch `dev`.

---

## Task 1: `core/segmentos.js` - trocar `ico` por `eixo`

**Files:**
- Modify: `src/core/segmentos.js:30-36` (array `SEGMENTOS`) e o bloco de comentário que o precede (linhas 17-29, que hoje justifica o campo `ico` e o compartilhamento de traçado entre CEI/EMEI - esse texto deixa de fazer sentido e sai)
- Test: `tests/segmentos.test.mjs` (criar)

**Interfaces:**
- Consumes: nada (arquivo já existe, é puro).
- Produces: `SEGMENTOS` - array de `{ codigo, rotulo, eixo }`, sem campo `ico`. `eixo` é `'fundamental'` para `EMEF`/`EJA` e `'infantil'` para `CEI`/`EMEI`/`CONVENIADA`. Nenhuma outra função de `segmentos.js` muda de assinatura (`expandir`, `atalhoDe`, `unidadeNoSegmento`, `rotulaSegmento`, `rotuloSelecao`, `ATALHOS`, `CODIGOS` continuam idênticos).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/segmentos.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEGMENTOS, ATALHOS, expandir, unidadeNoSegmento } from '../src/core/segmentos.js';

test('todo segmento-base declara eixo fundamental ou infantil', () => {
  for (const s of SEGMENTOS) {
    assert.ok(['fundamental', 'infantil'].includes(s.eixo), `${s.codigo} sem eixo valido`);
  }
});

test('EMEF e EJA sao do eixo fundamental', () => {
  const porCodigo = Object.fromEntries(SEGMENTOS.map(s => [s.codigo, s]));
  assert.equal(porCodigo.EMEF.eixo, 'fundamental');
  assert.equal(porCodigo.EJA.eixo, 'fundamental');
});

test('CEI, EMEI e Conveniada sao do eixo infantil', () => {
  const porCodigo = Object.fromEntries(SEGMENTOS.map(s => [s.codigo, s]));
  assert.equal(porCodigo.CEI.eixo, 'infantil');
  assert.equal(porCodigo.EMEI.eixo, 'infantil');
  assert.equal(porCodigo.CONVENIADA.eixo, 'infantil');
});

test('nenhum segmento-base declara mais o campo ico', () => {
  for (const s of SEGMENTOS) {
    assert.equal(s.ico, undefined, `${s.codigo} ainda tem campo ico`);
  }
});

test('expandir e unidadeNoSegmento continuam funcionando como antes', () => {
  assert.deepEqual(expandir('fundamental'), ['EMEF', 'EJA']);
  assert.deepEqual(expandir('infantil'), ['CEI', 'EMEI', 'CONVENIADA']);
  assert.ok(unidadeNoSegmento({ segmento: 'EMEF', tem_eja: false }, ['EMEF']));
  assert.ok(!unidadeNoSegmento({ segmento: 'CEI', tem_eja: false }, ['EMEF']));
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `node --test tests/segmentos.test.mjs`
Expected: FAIL - `SEGMENTOS` ainda tem `ico` e não tem `eixo` (o teste "nenhum segmento-base declara mais o campo ico" falha, e os três primeiros também falham por `eixo` ser `undefined`).

- [ ] **Step 3: Editar `core/segmentos.js`**

Substituir o array `SEGMENTOS` (linhas 30-36) e o comentário acima dele:

```js
// Segmentos-base. O `codigo` é o que está em unidade_escolar.segmento
// (mais 'EJA', que vem da flag tem_eja).
// `eixo` agrupa os segmentos em dois grandes eixos pedagógicos da rede -
// Ensino Fundamental e Educação Infantil - usado pela interface para dar
// cor consistente ao filtro de segmento (shared/ui/filtro-segmento.js).
// Não é vocabulário do banco: é convenção de exibição, e por isso mora
// aqui e não em unidade_segmentos() no Postgres.
export const SEGMENTOS = [
  { codigo: 'EMEF',       rotulo: 'EMEF',        eixo: 'fundamental' },
  { codigo: 'EJA',        rotulo: 'EJA',         eixo: 'fundamental' },
  { codigo: 'CEI',        rotulo: 'CEI',         eixo: 'infantil' },
  { codigo: 'EMEI',       rotulo: 'EMEI',        eixo: 'infantil' },
  { codigo: 'CONVENIADA', rotulo: 'Conveniadas', eixo: 'infantil' },
];
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `node --test tests/segmentos.test.mjs`
Expected: PASS - 5 testes passando.

- [ ] **Step 5: Rodar a suíte inteira para garantir que nada mais quebrou**

Run: `node --test "tests/*.mjs"`
Expected: PASS - todos os testes (inclusive os novos) passando, nenhuma regressão.

- [ ] **Step 6: Commit**

```bash
git add src/core/segmentos.js tests/segmentos.test.mjs
git commit -m "feat(segmentos): substitui campo ico por eixo (fundamental/infantil)"
```

---

## Task 2: `shared/ui/filtro-segmento.js` - remover ícone, emitir `data-eixo`

**Files:**
- Modify: `src/shared/ui/filtro-segmento.js:36-49` (função `pintar`)

**Interfaces:**
- Consumes: `SEGMENTOS` de `core/segmentos.js` (Task 1) - cada item agora tem `.eixo`. `ATALHOS` de `core/segmentos.js` (já existente, `id` é `'fundamental' | 'infantil' | 'todas'` - usado direto como valor de `data-eixo`).
- Produces: nenhuma função nova exportada; a API pública do módulo (`criarFiltroSegmento`, `indexarUnidades`) não muda de assinatura. O HTML produzido por `pintar()` muda: chips de atalho e de segmento-base ganham `data-eixo="<id ou eixo>"` e perdem o `${ico(...)}`.

- [ ] **Step 1: Editar a função `pintar()`**

Em `src/shared/ui/filtro-segmento.js`, a função `pintar()` (linhas 36-49) fica:

```js
  function pintar() {
    const ativo = atalhoDe(selecao);
    el.innerHTML = `
      <div class="fseg" role="group" aria-label="Filtrar por segmento">
        ${ATALHOS.map(a => `
          <button type="button" class="chip atalho ${ativo === a.id ? 'on' : ''}"
                  data-atalho="${a.id}" data-eixo="${a.id}">${esc(a.rotulo)}</button>`).join('')}
        <span class="fseg-sep" aria-hidden="true"></span>
        ${SEGMENTOS.map(s => `
          <button type="button" class="chip ${selecao.includes(s.codigo) ? 'on' : ''}"
                  data-seg="${s.codigo}" data-eixo="${s.eixo}">${esc(s.rotulo)}</button>`).join('')}
        ${selecao.length ? `<button type="button" class="chip limpar" data-limpar="1">${ico('fechar', { tam: 12 })} limpar</button>` : ''}
      </div>`;
  }
```

Note: o botão "limpar" continua chamando `ico('fechar', { tam: 12 })` - não remover esse. Só os chips de atalho e de segmento-base perdem o `ico(...)`.

O import de `ico` no topo do arquivo (`import { ico } from './icones.js';`) **permanece** - ainda é usado pelo botão limpar.

- [ ] **Step 2: Verificar manualmente no dev-local**

Não há teste automatizado para HTML de view (o resto do módulo não tem testes - é DOM puro). Confirmar visualmente:

```bash
python .claude/scripts/verificar_arquitetura.py
```

Expected: `OK - nenhuma violacao encontrada.` (o script não teria como pegar essa mudança de HTML, mas confirma que nada de estrutural quebrou, como import não usado).

Depois, abrir a Task 5 (integração visual) para de fato ver o filtro renderizado - por ora seguir para o commit, já que o comportamento funcional (seleção, atalhos, `combina()`) não muda, só o HTML.

- [ ] **Step 3: Rodar a suíte de testes para garantir que nada quebrou**

Run: `node --test "tests/*.mjs"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/ui/filtro-segmento.js
git commit -m "feat(filtro-segmento): remove icone dos chips, emite data-eixo"
```

---

## Task 3: Tokens de cor por eixo em `tokens.css`

**Files:**
- Modify: `src/styles/tokens.css:11-112` (bloco `:root` claro) e `:114-146` (bloco `@media (prefers-color-scheme: dark)`)

**Interfaces:**
- Consumes: nada.
- Produces: três custom properties novas, definidas nos dois temas: `--eixo-fundamental`, `--eixo-infantil`, `--eixo-todas`.

- [ ] **Step 1: Acrescentar os tokens no bloco claro**

Em `src/styles/tokens.css`, dentro do primeiro `:root { ... }` (o bloco que termina com `--serie-6: #7fa06b;` na linha 111), acrescentar antes do fechamento da chave (depois do bloco de `--serie-*`):

```css
  /* Cor por eixo pedagógico no filtro de segmento (core/segmentos.js,
     shared/ui/filtro-segmento.js). Fundamental reusa o azul de --brand -
     não é coincidência, é o eixo "padrão" da rede. Infantil é âmbar, não
     amarelo puro: amarelo (#f59e0b, --accent) como cor de TEXTO tem
     contraste 2,2:1 sobre fundo claro - ilegível. O âmbar escolhido aqui
     tem ~5,0:1. --eixo-todas é o cinza "destacado" pedido, mais escuro
     que --muted para não parecer desabilitado. */
  --eixo-fundamental: #1d4ed8;
  --eixo-infantil: #b45309;
  --eixo-todas: #57606a;
```

- [ ] **Step 2: Acrescentar os tokens no bloco escuro**

Dentro do `@media (prefers-color-scheme: dark) { :root { ... } }` (o bloco que termina com `--serie-6: #8fb07b;` por volta da linha 144), acrescentar:

```css
    /* Mesmos três eixos, recalibrados para fundo escuro. */
    --eixo-fundamental: #5b8cff;
    --eixo-infantil: #fbbf24;
    --eixo-todas: #adbac7;
```

- [ ] **Step 3: Verificar que o CSS é válido**

Não há linter de CSS configurado no projeto (sem build). Verificar visualmente que as chaves abrem e fecham corretamente:

```bash
node -e "const fs=require('fs'); const c=fs.readFileSync('src/styles/tokens.css','utf-8'); const abre=(c.match(/\{/g)||[]).length; const fecha=(c.match(/\}/g)||[]).length; console.log('chaves:', abre, fecha, abre===fecha ? 'OK' : 'DESBALANCEADO');"
```

Expected: `chaves: N N OK` (mesmo número dos dois lados).

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat(tokens): tres tokens de cor por eixo pedagogico (claro e escuro)"
```

---

## Task 4: `.chip.on` por `var(--eixo)` + borda em repouso no filtro

**Files:**
- Modify: `src/styles/components.css:249-266` (`.chip`, `.chip:hover`, `.chip.on`) e `:272-277` (bloco `.fseg`)

**Interfaces:**
- Consumes: `--eixo-fundamental`, `--eixo-infantil`, `--eixo-todas` (Task 3); `data-eixo` nos chips (Task 2).
- Produces: nenhuma classe nova exportada para JS - só CSS. Todo chip fora de `.fseg` continua com `--eixo: var(--brand)` (default), ou seja, visualmente idêntico a hoje.

- [ ] **Step 1: Editar o bloco `.chip`**

Em `src/styles/components.css`, o bloco atual (linhas 249-266):

```css
.chip {
  min-height: var(--controle);
  padding: 4px 11px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
}
.chip:hover { background: var(--surface-2); border-color: var(--border-forte); }
.chip.on {
  background: color-mix(in srgb, var(--brand) 12%, transparent);
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 40%, var(--border));
  font-weight: 600;
}
```

Vira:

```css
.chip {
  /* Default: todo chip que não declara data-eixo (afastamentos, escalas,
     segmentos de Usuários fora do filtro, etc.) continua exatamente como
     era - só o filtro de segmento (.fseg) redefine --eixo abaixo. */
  --eixo: var(--brand);
  min-height: var(--controle);
  padding: 4px 11px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
}
.chip:hover { background: var(--surface-2); border-color: var(--border-forte); }
.chip.on {
  background: color-mix(in srgb, var(--eixo) 12%, transparent);
  color: var(--eixo);
  border-color: color-mix(in srgb, var(--eixo) 40%, var(--border));
  font-weight: 600;
}
```

- [ ] **Step 2: Editar o bloco `.fseg`**

O bloco atual (linhas 272-277):

```css
/* Filtro por segmento: atalhos à esquerda, segmentos-base à direita,
   separados por um traço fino para a diferença ficar óbvia. */
.fseg { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fseg .atalho { font-weight: 600; }
.fseg-sep { width: 1px; height: 20px; background: var(--border); margin: 0 2px; }
.fseg .limpar { color: var(--muted); border-style: dashed; }
```

Vira:

```css
/* Filtro por segmento: atalhos à esquerda, segmentos-base à direita,
   separados por um traço fino para a diferença ficar óbvia. Cada chip
   redefine --eixo pelo próprio data-eixo (fundamental/infantil/todas) -
   ver core/segmentos.js e shared/ui/filtro-segmento.js. */
.fseg { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fseg .atalho { font-weight: 600; }
.fseg-sep { width: 1px; height: 20px; background: var(--border); margin: 0 2px; }
.fseg .limpar { color: var(--muted); border-style: dashed; }
.fseg .chip[data-eixo="fundamental"] { --eixo: var(--eixo-fundamental); }
.fseg .chip[data-eixo="infantil"]    { --eixo: var(--eixo-infantil); }
.fseg .chip[data-eixo="todas"]       { --eixo: var(--eixo-todas); }
/* Em repouso (sem .on) a borda já insinua o eixo, para a fila ler como
   dois grupos mesmo sem nada selecionado. */
.fseg .chip { border-color: color-mix(in srgb, var(--eixo) 25%, var(--border)); }
```

- [ ] **Step 3: Verificar que o CSS é válido**

```bash
node -e "const fs=require('fs'); const c=fs.readFileSync('src/styles/components.css','utf-8'); const abre=(c.match(/\{/g)||[]).length; const fecha=(c.match(/\}/g)||[]).length; console.log('chaves:', abre, fecha, abre===fecha ? 'OK' : 'DESBALANCEADO');"
```

Expected: `chaves: N N OK`.

- [ ] **Step 4: Commit**

```bash
git add src/styles/components.css
git commit -m "feat(chip): .chip.on le cor de --eixo; filtro de segmento pinta por eixo"
```

---

## Task 5: `usuarios/views/lista.js` - mesmo tratamento nos chips de segmento

**Files:**
- Modify: `src/modules/usuarios/views/lista.js:196-207` (função `pintarSegs` dentro do escopo do formulário de edição de usuário)

**Interfaces:**
- Consumes: `SEGMENTOS` com `.eixo` (Task 1). `ico` continua importado no arquivo para outros usos (não remover o import geral, só a chamada dentro de `pintarSegs`).
- Produces: nada novo exportado - é HTML interno da view.

- [ ] **Step 1: Editar `pintarSegs`**

Em `src/modules/usuarios/views/lista.js`, o trecho atual (linhas 199-207):

```js
  const pintarSegs = () => {
    const ativo = atalhoDe(segs);
    boxSegs.innerHTML = `
      <div class="fseg">
        ${ATALHOS.map(a => `<button type="button" class="chip atalho ${ativo === a.id ? 'on' : ''}" data-atalho="${a.id}">${esc(a.rotulo)}</button>`).join('')}
        <span class="fseg-sep" aria-hidden="true"></span>
        ${SEGMENTOS.map(s => `<button type="button" class="chip ${segs.includes(s.codigo) ? 'on' : ''}" data-seg="${s.codigo}">${ico(s.ico, { tam: 14 })} ${esc(s.rotulo)}</button>`).join('')}
      </div>`;
  };
```

Vira:

```js
  const pintarSegs = () => {
    const ativo = atalhoDe(segs);
    boxSegs.innerHTML = `
      <div class="fseg">
        ${ATALHOS.map(a => `<button type="button" class="chip atalho ${ativo === a.id ? 'on' : ''}" data-atalho="${a.id}" data-eixo="${a.id}">${esc(a.rotulo)}</button>`).join('')}
        <span class="fseg-sep" aria-hidden="true"></span>
        ${SEGMENTOS.map(s => `<button type="button" class="chip ${segs.includes(s.codigo) ? 'on' : ''}" data-seg="${s.codigo}" data-eixo="${s.eixo}">${esc(s.rotulo)}</button>`).join('')}
      </div>`;
  };
```

- [ ] **Step 2: Conferir se `ico` continua sendo usado em outro ponto do arquivo**

```bash
grep -n "ico(" src/modules/usuarios/views/lista.js
```

Expected: pelo menos uma ocorrência de `ico(` fora da função `pintarSegs` (o arquivo usa ícones em outros lugares da lista de usuários). Se a saída mostrar **zero** ocorrências, remover o import `import { ico } from '...';` do topo do arquivo - mas isso não é esperado, é só uma checagem de segurança.

- [ ] **Step 3: Rodar a suíte de testes**

Run: `node --test "tests/*.mjs"`
Expected: PASS.

- [ ] **Step 4: Rodar a verificação de arquitetura**

Run: `python .claude/scripts/verificar_arquitetura.py`
Expected: `OK - nenhuma violacao encontrada.`

- [ ] **Step 5: Commit**

```bash
git add src/modules/usuarios/views/lista.js
git commit -m "feat(usuarios): chips de segmento tambem pintam por eixo"
```

---

## Task 6: Verificação visual em dev-local

**Files:**
- Nenhum arquivo novo - esta tarefa só verifica o resultado das Tasks 1-5 no navegador.

**Interfaces:**
- Consumes: tudo das Tasks 1-5.
- Produces: nada - é o checkpoint manual antes de considerar o bloco pronto.

- [ ] **Step 1: Subir o servidor de dev-local**

```bash
python .claude/devserver.py 8123
```

(Ou usar a ferramenta de preview do ambiente, se disponível, apontando para `.claude/launch.json` → configuração `fundhub`.)

- [ ] **Step 2: Abrir o módulo Escolas e conferir o filtro de segmento**

Checklist visual (comparar com a spec, seção "Critérios de aceite"):
- Os cinco chips de segmento e os três atalhos aparecem **sem ícone**.
- O botão "limpar" (quando algo está selecionado) mantém o ícone de X.
- Clicar em "Ensino Fundamental" pinta o chip em **azul** (fundo, texto e borda).
- Clicar em "Educação Infantil" pinta em **âmbar**.
- Clicar em "Todas" pinta em **cinza**.
- Em repouso (nada selecionado), a borda dos chips já sugere os dois grupos (uma leve tonalidade azul nos de Fundamental, âmbar nos de Infantil).

- [ ] **Step 3: Repetir a checagem em mais um módulo com o filtro**

Abrir Horários (aba "Por escola") ou Afastamentos e confirmar o mesmo comportamento - o filtro é o mesmo componente, então não deveria haver diferença, mas é o teste de que a mudança realmente é centralizada.

- [ ] **Step 4: Conferir Usuários**

Abrir Usuários, editar um usuário, checar que os chips de "Segmentos de atuação" seguem o mesmo padrão de cor (sem ícone, azul/âmbar/cinza).

- [ ] **Step 5: Conferir chips de outros domínios (regressão)**

Abrir Afastamentos e olhar os chips de tipo de afastamento (não são segmento) - devem estar **visualmente idênticos a antes** (cor de `--brand` quando ativos, sem relação com âmbar/azul de eixo). Isso confirma que o default `--eixo: var(--brand)` em `.chip` não vazou para outros chips.

- [ ] **Step 6: Conferir os dois temas**

Alternar entre tema claro e escuro do sistema operacional (ou emular via DevTools: `prefers-color-scheme`) e repetir os passos 2-5. Confirmar que o âmbar é legível nos dois temas.

- [ ] **Step 7: Conferir em tela estreita**

Redimensionar para ~375px de largura (ou usar o modo responsivo do navegador) e confirmar que a fila de chips quebra linha de forma legível, sem cortar texto.

- [ ] **Step 8: Rodar a verificação de arquitetura uma última vez**

```bash
python .claude/scripts/verificar_arquitetura.py
```

Expected: `OK - nenhuma violacao encontrada.`

Nenhum commit nesta tarefa - é checkpoint de verificação. Se algo estiver errado, voltar à task correspondente, corrigir e commitar lá.

---

## Self-Review Summary

**Spec coverage** (`2026-09-05-filtro-segmento-cores-design.md`):
- D1 (eixo em `core/segmentos.js`) → Task 1.
- D2 (chip de segmento é só texto) → Task 2 e Task 5.
- D3 (cor por indireção via `--eixo`) → Task 4.
- D4 (os três tokens, âmbar em vez de amarelo puro) → Task 3.
- D5 (onde a mudança aparece - componente central + Usuários) → Task 2 (componente) + Task 5 (Usuários) + Task 6 (verificação nos 8 módulos consumidores, por amostragem).
- D6 (cor nunca é o único sinal) → já garantido pelo CSS existente (peso 600 + borda no `.chip.on`), não requer task própria; confirmado no Step 5 da Task 6.
- Critérios de aceite 1-8 da spec → cobertos pelos Steps da Task 6, mais os testes automatizados das Tasks 1 e a checagem do script nas Tasks 2, 4 e 5.

**Placeholder scan:** nenhum "TBD"/"implementar depois" - todo trecho de código é literal e completo, incluindo o CSS e o HTML exatos.

**Type/name consistency:** `eixo` é o nome usado em `SEGMENTOS[].eixo` (Task 1), em `data-eixo` (Tasks 2 e 5) e em `--eixo` (Tasks 3 e 4) - consistente do banco de dados de domínio até o CSS. `ATALHOS[].id` (já existente, não recriado) é reusado como valor de `data-eixo` nos atalhos, exatamente como a spec (D1) descreve.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-05-filtro-segmento-cores.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
