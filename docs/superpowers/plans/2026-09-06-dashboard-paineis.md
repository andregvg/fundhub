# Dashboard: painéis reordenáveis e ocultáveis (Bloco E) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada painel do Dashboard vira uma unidade nomeada; a pessoa reordena (arrasto ou setas) e oculta (× no painel, switch nas configurações); painel de módulo oculto não aparece.

**Architecture:** `dashboard.view.js` passa a ter uma lista `PAINEIS` e um laço sobre ela. Os metadados (id/título/ícone/permissão) moram em `dashboard.config.js`; as funções de pintura, em `views/paineis.js`; a casca zipa os dois. Ordem e ocultos são preferências de usuário (mecanismo do Bloco A). Arrasto nativo HTML5 delegado no container, com as setas nas configurações como caminho de toque.

**Tech Stack:** JS ES modules puro, sem build. `node --test`. Preferências via `core/configuracoes.js` (Bloco A).

**Spec:** `docs/superpowers/specs/2026-09-05-dashboard-paineis-design.md`

## Global Constraints

- PT-BR em código, comentário, commit e interface.
- Branch `dev`. Commits frequentes. Push ao fechar.
- Todo valor do banco por `esc()`. Nenhuma cor literal em `src/modules/**`.
- Kernel não é importado ao contrário; `dashboard.config.js` não é model (não fala com `sb()`).
- **D5 é critério de aceite:** cada painel carrega e falha por conta própria - o refactor não pode quebrar o isolamento.
- **Regra de documentação (Bloco B):** `dashboard` ganha `doc: true` e `docs/modulos/dashboard.md` **no mesmo commit** (checagem 11).
- Ao fechar: `CONFIG.versao` MINOR (mudança de modelo - o Dashboard passa a ter preferências) + `CHANGELOG.md`.
- `node --test tests/*.mjs` e `python .claude/scripts/verificar_arquitetura.py` sem violações.

---

## Contexto verificado

- `dashboard.view.js` (181 linhas): `render(app)` monta `.stat-row#stats` (fora do grid) + `.dash-grid` com `#dash-hoje` (div nu) e 4 `<section class="panel">` de HTML fixo. Depois chama `painelStats/painelHoje/painelExtraclasse/painelAfastamentos/painelCalendario/painelOcorrencias` - cada uma faz `document.getElementById('p-*')` e trata o próprio erro com `emptyState`.
- `painelHoje()` faz `import('./views/hoje.js')` → `cartaoHoje(box)`, que hoje **renderiza a própria `<section class="panel hoje">`** com `<h2>Nesta data</h2>` + campo de data + `#hoje-corpo`.
- `painelExtraclasse` escreve também em `.stat-hoje .stat-num` (tile dentro de `painelStats`), com guarda `if (tile)`.
- `render(app)` hoje recebe só `app` (sem `ctx`) - o roteador passa `{ perfil, nivel, params }`, então dá para receber `ctx`.
- Bloco A: `pref(mod, chave)` / `definirPref(mod, chave, valor)` de `core/configuracoes.js`; `nivel(m)` / `OCULTO` de `core/permissoes.js`; o item de config com `painel:` é desenhado em `[data-painel="<chave>"]` por `configuracoes/painel.js`.
- Padrão de arrasto nativo (referência: `horarios/views/por-escola.js:247-288`): `dragstart` marca `origemArrasto` + `dataTransfer.setData('text/plain', …)` (Firefox exige); `dragover` faz `preventDefault()` + `insertBefore` ao vivo; `dragend` com `dropEffect === 'none'` → recarrega (soltou fora); `drop` lê a ordem do DOM e grava. Tudo **delegado no container estável**.
- `dashboard.css` tem só `.hoje-*`. `.panel`, `.dash-grid`, `.stat-row`, `.stat-tile` vêm de `components.css`.
- `dashboard/module.js`: sem `config`, sem `doc`.
- `CONFIG.versao` após o Bloco J: `0.17.0`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/modules/dashboard/dashboard.config.js` | criar - `PAINEIS_META` (id/título/ícone/perm), declaração da config, acessos `ordemPaineis()`/`paineisOcultos()`, painel de ordenação |
| `src/modules/dashboard/views/paineis.js` | criar - as 6 funções de pintura (movidas da view) + `statTile` |
| `src/modules/dashboard/dashboard.view.js` | reescrito - `PAINEIS` (zip meta+pintura), filtro por permissão, laço, arrasto, ocultar |
| `src/modules/dashboard/module.js` | campo `config`, `doc: true` |
| `src/modules/dashboard/views/hoje.js` | `cartaoHoje` renderiza no box, sem `<section class="panel">` própria |
| `src/modules/dashboard/dashboard.css` | alça de arrasto, `×`, estado "arrastando" |
| `docs/modulos/dashboard.md` | criar - tutorial |
| `tests/dashboard-paineis.test.mjs` | criar - filtro+completa da ordem |

---

## Task 1: Extrair as funções de pintura para `views/paineis.js`

**Files:**
- Create: `src/modules/dashboard/views/paineis.js`
- Modify: `src/modules/dashboard/dashboard.view.js` (importar de volta - temporário, some na Task 3)

**Interfaces:**
- Produces (de `views/paineis.js`): `painelStats(box)`, `painelExtraclasse(box, hoje)`, `painelAfastamentos(box, hoje)`, `painelCalendario(box, hoje)`, `painelOcorrencias(box, hoje)`. **Cada uma recebe o elemento `box`** (não faz mais `getElementById`).

- [ ] **Step 1: Criar `views/paineis.js`**

Mover de `dashboard.view.js` para `views/paineis.js`: os imports de model (`getUnidades`, `getAtividades`, `getSolicitacoesDoDia`, `STATUS`, `PERIODOS`, `getAfastamentos`, `getDiaCalendario`, `getOcorrencias`, `CANAIS`, `STATUS as STATUS_OCOR`, `STATUS_TAG as TAG_OCOR`), os helpers (`esc`, `fmtData`, `loading`, `emptyState`, `ico`), a função `statTile`, e as funções `painelStats/painelExtraclasse/painelAfastamentos/painelCalendario/painelOcorrencias`.

**Mudança em cada função:** trocar `const box = document.getElementById('p-xxx');` pelo parâmetro `box`. Assinatura: `export async function painelStats(box)`, `export async function painelExtraclasse(box, hoje)`, etc. `painelStats` recebe `box` mas ainda escreve nele o `.stat-row` inteiro; `painelExtraclasse` continua com `document.querySelector('.stat-hoje .stat-num')` + guarda `if (tile)` (a busca é global de propósito - o tile pode estar em outro painel).

Cabeçalho do arquivo:

```js
// ============================================================
// FundHub - dashboard/views/paineis.js
// As funções de pintura dos painéis do dashboard. Cada uma recebe o
// elemento onde desenhar e trata o próprio erro - um painel que falha
// não derruba os outros (spec D5). A casca (dashboard.view.js) decide
// QUAIS painéis pinta e em que ordem.
// ============================================================
```

- [ ] **Step 2: `dashboard.view.js` importa de volta (temporário)**

No topo: `import { painelStats, painelExtraclasse, painelAfastamentos, painelCalendario, painelOcorrencias } from './views/paineis.js';` e remover as definições locais. `painelHoje` continua em `dashboard.view.js` por ora. As chamadas em `render` mudam para passar o elemento: `painelStats(document.getElementById('stats'))`, `painelExtraclasse(document.getElementById('p-extraclasse'), hoje)`, etc.

- [ ] **Step 3: Sanidade**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py`.
Browser (patch dev-local, [[fundhub-teste-devlocal]]): `#/dashboard` abre; os painéis pintam (em dev-local a maioria fica em "estado vazio" - o que importa é nenhum erro no console e a estrutura montar).

- [ ] **Step 4: Commit**

```bash
git add src/modules/dashboard/
git commit -m "refactor(dashboard): funcoes de pintura em views/paineis.js, recebem o box

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `dashboard.config.js` - metadados, declaração e acessos

**Files:**
- Create: `src/modules/dashboard/dashboard.config.js`
- Test: `tests/dashboard-paineis.test.mjs`

**Interfaces:**
- Produces:
  - `PAINEIS_META: Array<{ id, titulo, ico, perm? }>` - a lista canônica, sem funções.
  - `ordemResolvida(idsDisponiveis): string[]` - aplica a preferência de ordem sobre os ids que existem: filtra ids desconhecidos, acrescenta os novos no fim.
  - `paineisOcultos(): string[]`
  - `DECLARACAO` - um item `painel: pintarPaineisConfig`.

- [ ] **Step 1: Escrever o teste que falha**

`tests/dashboard-paineis.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAINEIS_META, ordemResolvida } from '../src/modules/dashboard/dashboard.config.js';
import { _semearParaTeste, limparConfiguracoes } from '../src/core/configuracoes.js';

test('PAINEIS_META tem os seis painéis, com id e título', () => {
  const ids = PAINEIS_META.map(p => p.id);
  assert.deepEqual(ids, ['numeros', 'hoje', 'extraclasse', 'afastamentos', 'calendario', 'ocorrencias']);
  for (const p of PAINEIS_META) { assert.equal(typeof p.id, 'string'); assert.equal(typeof p.titulo, 'string'); }
});

test('ordemResolvida sem preferência = ordem natural filtrada pelos disponíveis', () => {
  limparConfiguracoes();
  assert.deepEqual(ordemResolvida(['numeros', 'hoje', 'calendario']), ['numeros', 'hoje', 'calendario']);
});

test('ordemResolvida respeita a preferência e descarta id que não existe mais', () => {
  _semearParaTeste({}, { 'dashboard/ordem_paineis': ['calendario', 'zumbi', 'numeros'] });
  assert.deepEqual(ordemResolvida(['numeros', 'hoje', 'calendario']), ['calendario', 'numeros', 'hoje']);
});

test('ordemResolvida acrescenta painel novo (fora da preferência) no fim', () => {
  _semearParaTeste({}, { 'dashboard/ordem_paineis': ['hoje', 'numeros'] });
  assert.deepEqual(ordemResolvida(['numeros', 'hoje', 'novo']), ['hoje', 'numeros', 'novo']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/dashboard-paineis.test.mjs` → FAIL.

- [ ] **Step 3: Escrever `dashboard.config.js`**

```js
// Declaração de configuração do módulo Dashboard. NÃO é model. É a
// lista canônica dos painéis (metadados, sem as funções de pintura -
// essas moram em views/paineis.js) + os acessos das duas preferências
// + o painel de ordenação. O padrão mora aqui.
import { pref, definirPref } from '../../core/configuracoes.js';
import { nivel, OCULTO } from '../../core/permissoes.js';
import { esc } from '../../shared/dom.js';
import { ico } from '../../shared/ui/icones.js';
import { toast } from '../../shared/ui/toast.js';

// O `id` é o que a preferência guarda e NUNCA muda - renomear o título
// é livre, renomear o id perde a ordem de todo mundo. `perm` ausente:
// o painel compõe dados de vários módulos e degrada sozinho.
export const PAINEIS_META = [
  { id: 'numeros',      titulo: 'Números do dia',      ico: 'dashboard' },
  { id: 'hoje',         titulo: 'Nesta data',          ico: 'horario' },
  { id: 'extraclasse',  titulo: 'Extraclasse hoje',    ico: 'transporte',  perm: 'sate' },
  { id: 'afastamentos', titulo: 'Afastamentos hoje',   ico: 'afastamento', perm: 'afastamentos' },
  { id: 'calendario',   titulo: 'Calendário hoje',     ico: 'calendario',  perm: 'calendario' },
  { id: 'ocorrencias',  titulo: 'Ocorrências de hoje', ico: 'ocorrencia',  perm: 'ocorrencias' },
];

const ORDEM_NATURAL = PAINEIS_META.map(p => p.id);

// Aplica a preferência de ordem sobre os ids que de fato existem:
// descarta id desconhecido, acrescenta id novo no fim. Sem isto,
// acrescentar um painel no futuro o tornaria invisível para quem já
// ordenou a tela.
export function ordemResolvida(idsDisponiveis) {
  const salva = pref('dashboard', 'ordem_paineis');
  const base = Array.isArray(salva) && salva.length ? salva : ORDEM_NATURAL;
  const naOrdem = base.filter(id => idsDisponiveis.includes(id));
  const faltando = idsDisponiveis.filter(id => !naOrdem.includes(id));
  return [...naOrdem, ...faltando];
}

export const paineisOcultos = () => {
  const v = pref('dashboard', 'paineis_ocultos');
  return Array.isArray(v) ? v : [];
};

export async function definirOrdem(ids)  { await definirPref('dashboard', 'ordem_paineis', ids); }
export async function definirOcultos(ids) { await definirPref('dashboard', 'paineis_ocultos', ids); }

export const DECLARACAO = {
  itens: [
    { chave: 'paineis', escopo: 'usuario', grupo: 'exibicao',
      rotulo: 'Painéis do dashboard',
      dica: 'Escolha o que aparece e em que ordem. Você também pode arrastar os painéis pelo título.',
      painel: pintarPaineisConfig },
  ],
};

async function pintarPaineisConfig(box) {
  const disponiveis = PAINEIS_META.filter(p => !p.perm || nivel(p.perm) !== OCULTO);
  const ids = ordemResolvida(disponiveis.map(p => p.id));
  let ocultos = paineisOcultos();
  const meta = (id) => disponiveis.find(p => p.id === id);

  const desenhar = () => {
    box.innerHTML = `<div class="cfg-paineis">${ids.map((id, i) => {
      const m = meta(id); if (!m) return '';
      const oculto = ocultos.includes(id);
      return `<div class="cfg-painel-linha" data-id="${esc(id)}">
        <label class="switch">
          <input type="checkbox" class="cfg-painel-on" ${oculto ? '' : 'checked'} />
          <span class="switch-trilho" aria-hidden="true"></span></label>
        <span class="cfg-painel-nome">${ico(m.ico, { tam: 14 })} ${esc(m.titulo)}</span>
        <span class="cfg-painel-setas">
          <button type="button" class="mini-btn cfg-painel-cima" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ico('subir', { tam: 13 })}</button>
          <button type="button" class="mini-btn cfg-painel-baixo" aria-label="Descer" ${i === ids.length - 1 ? 'disabled' : ''}>${ico('subir', { tam: 13, classe: 'gira-180' })}</button>
        </span>
      </div>`;
    }).join('')}</div>`;

    box.querySelectorAll('.cfg-painel-on').forEach(inp => inp.addEventListener('change', async () => {
      const id = inp.closest('[data-id]').dataset.id;
      ocultos = inp.checked ? ocultos.filter(x => x !== id) : [...ocultos, id];
      try { await definirOcultos(ocultos); toast({ titulo: 'Preferência salva', tipo: 'sucesso' }); }
      catch (err) { toast({ titulo: 'Não foi possível salvar', texto: err.message, tipo: 'erro' }); }
    }));
    const mover = async (id, delta) => {
      const pos = ids.indexOf(id);
      const alvo = pos + delta;
      if (alvo < 0 || alvo >= ids.length) return;
      ids.splice(pos, 1); ids.splice(alvo, 0, id);
      desenhar();
      try { await definirOrdem(ids); toast({ titulo: 'Ordem salva', tipo: 'sucesso' }); }
      catch (err) { toast({ titulo: 'Não foi possível salvar', texto: err.message, tipo: 'erro' }); }
    };
    box.querySelectorAll('.cfg-painel-cima').forEach(b => b.addEventListener('click', () => mover(b.closest('[data-id]').dataset.id, -1)));
    box.querySelectorAll('.cfg-painel-baixo').forEach(b => b.addEventListener('click', () => mover(b.closest('[data-id]').dataset.id, +1)));
  };
  desenhar();
}
```

- [ ] **Step 4: Rodar os testes**

Run: `node --test tests/dashboard-paineis.test.mjs` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/dashboard.config.js tests/dashboard-paineis.test.mjs
git commit -m "feat(dashboard): dashboard.config.js - metadados dos paineis, ordem e ocultos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Reescrever `dashboard.view.js` com o laço, o filtro e o arrasto

**Files:**
- Modify: `src/modules/dashboard/dashboard.view.js`
- Modify: `src/modules/dashboard/views/hoje.js`
- Modify: `src/modules/dashboard/dashboard.css`
- Modify: `src/modules/dashboard/module.js`

**Interfaces:**
- Consumes: `PAINEIS_META`, `ordemResolvida`, `paineisOcultos`, `definirOrdem`, `definirOcultos` de `./dashboard.config.js`; `painelStats` etc. de `./views/paineis.js`; `cartaoHoje` de `./views/hoje.js`; `nivel`/`OCULTO`.

- [ ] **Step 1: `cartaoHoje` sem `<section class="panel">` própria**

`views/hoje.js` `cartaoHoje(box)`: trocar

```js
  box.innerHTML = `
    <section class="panel hoje">
      <h2>${ico('horario')} Nesta data</h2>
      <label class="search compacta hoje-data">${ico('calendario')}
        <input type="date" id="hoje-dia" value="${esc(data)}" aria-label="Data" /></label>
      <div id="hoje-corpo">${loading()}</div>
    </section>`;
```

por

```js
  box.innerHTML = `
    <label class="search compacta hoje-data">${ico('calendario')}
      <input type="date" id="hoje-dia" value="${esc(data)}" aria-label="Data" /></label>
    <div id="hoje-corpo">${loading()}</div>`;
```

O `<h2>Nesta data</h2>` agora vem do cabeçalho do painel (título de `PAINEIS_META`). `import { ico }` continua sendo usado (calendário). `pintar(box, data)` segue funcionando (`box.querySelector('#hoje-corpo')`).

- [ ] **Step 2: Reescrever `render` em `dashboard.view.js`**

```js
// ============================================================
// FundHub - modules/dashboard/dashboard.view.js
// Painel do dia. Compõe dados de vários módulos e não é dono de nada.
// Os painéis são unidades declaradas (dashboard.config.js: metadados;
// views/paineis.js: pintura). Aqui: filtra por permissão, aplica a
// ordem/ocultos da pessoa, e liga o arrasto de reordenar.
// ============================================================
import { PAINEIS_META, ordemResolvida, paineisOcultos, definirOrdem, definirOcultos } from './dashboard.config.js';
import { painelStats, painelExtraclasse, painelAfastamentos, painelCalendario, painelOcorrencias } from './views/paineis.js';
import { nivel, OCULTO } from '../../core/permissoes.js';
import { esc } from '../../shared/dom.js';
import { hojeISO, fmtExtenso } from '../../shared/format.js';
import { loading, emptyState } from '../../shared/ui/feedback.js';
import { ico } from '../../shared/ui/icones.js';

// pintar: recebe (box, hoje). `hoje` do painel de números/hoje é ignorado.
const PINTURA = {
  numeros:      (box) => painelStats(box),
  hoje:         (box) => painelHoje(box),
  extraclasse:  (box, h) => painelExtraclasse(box, h),
  afastamentos: (box, h) => painelAfastamentos(box, h),
  calendario:   (box, h) => painelCalendario(box, h),
  ocorrencias:  (box, h) => painelOcorrencias(box, h),
};

let origemArrasto = null;

export async function render(app) {
  const hoje = hojeISO();

  const disponiveis = PAINEIS_META.filter(p => !p.perm || nivel(p.perm) !== OCULTO);
  const ocultos = paineisOcultos();
  const ordem = ordemResolvida(disponiveis.map(p => p.id));
  const visiveis = ordem.filter(id => !ocultos.includes(id));

  app.innerHTML = `
    <div class="page-head">
      <h1>Dashboard do dia</h1>
      <p class="capitalizar">${esc(fmtExtenso(hoje))}</p>
    </div>
    ${visiveis.length ? `<div class="dash-grid" id="dash-grid">${
      visiveis.map(id => {
        const m = disponiveis.find(p => p.id === id);
        return `<section class="panel" data-painel="${esc(id)}">
          <h2 class="panel-cab" draggable="true">
            <span class="panel-tit">${ico(m.ico, { tam: 16 })} ${esc(m.titulo)}</span>
            <button type="button" class="panel-x" aria-label="Ocultar ${esc(m.titulo)}">${ico('fechar', { tam: 13 })}</button>
          </h2>
          <div class="panel-corpo" id="dp-${esc(id)}">${loading()}</div>
        </section>`;
      }).join('')}</div>`
    : emptyState(ico('dashboard', { tam: 32 }), 'Todos os painéis estão ocultos',
        'Reative-os nas <a href="#/configuracoes">configurações</a>.')}`;

  const grid = document.getElementById('dash-grid');
  if (grid) {
    for (const id of visiveis) {
      const box = document.getElementById(`dp-${id}`);
      Promise.resolve(PINTURA[id]?.(box, hoje)).catch(err => {
        box.innerHTML = emptyState(ico('atencao', { tam: 32 }), 'Não foi possível carregar', esc(err?.message || err));
      });
    }
    ligarArrasto(grid);
    grid.querySelectorAll('.panel-x').forEach(b => b.addEventListener('click', () => ocultar(b.closest('[data-painel]').dataset.painel)));
  }
}

async function painelHoje(box) {
  try {
    const { cartaoHoje } = await import('./views/hoje.js');
    await cartaoHoje(box);
  } catch (err) {
    box.innerHTML = emptyState(ico('atencao', { tam: 32 }), 'Não foi possível carregar', esc(err.message || err));
  }
}

async function ocultar(id) {
  const atuais = paineisOcultos();
  if (atuais.includes(id)) return;
  try {
    await definirOcultos([...atuais, id]);
    document.querySelector(`.panel[data-painel="${CSS.escape(id)}"]`)?.remove();
    if (!document.querySelector('#dash-grid .panel')) location.reload();  // vazio → mostra o estado com link
  } catch (err) {
    // silencioso: o painel some só se gravou
  }
}

// Arrasto pelo cabeçalho do painel. Delegado no grid (container estável).
function ligarArrasto(grid) {
  grid.addEventListener('dragstart', (e) => {
    const cab = e.target.closest('.panel-cab');
    if (!cab) return;
    origemArrasto = cab.closest('.panel');
    origemArrasto.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', origemArrasto.dataset.painel);  // Firefox exige
  });
  grid.addEventListener('dragend', () => {
    origemArrasto?.classList.remove('arrastando');
    origemArrasto = null;
  });
  grid.addEventListener('dragover', (e) => {
    if (!origemArrasto) return;
    const alvo = e.target.closest('.panel');
    if (!alvo || alvo === origemArrasto || alvo.parentElement !== grid) return;
    e.preventDefault();
    const r = alvo.getBoundingClientRect();
    const depois = (e.clientY - r.top) > r.height / 2;
    grid.insertBefore(origemArrasto, depois ? alvo.nextSibling : alvo);
  });
  grid.addEventListener('drop', async (e) => {
    if (!origemArrasto) return;
    e.preventDefault();
    const ids = [...grid.querySelectorAll('.panel')].map(p => p.dataset.painel);
    // a ordem gravada inclui só os visíveis; a leitura completa com os ocultos no fim
    const ocultos = paineisOcultos();
    try { await definirOrdem([...ids, ...ocultos]); }
    catch (_) { location.reload(); }
  });
}
```

**Nota sobre a ordem gravada:** `definirOrdem` recebe `[...visiveisNaNovaOrdem, ...ocultos]`. `ordemResolvida` na próxima carga filtra pelos disponíveis e recoloca ocultos onde estiverem - como o switch de reexibir devolve o painel na posição em que ele está na lista de ordem, gravar os ocultos no fim é aceitável (a spec não exige preservar a posição de um painel oculto). Se o teste da Task 2 cobrir isso e falhar, ajustar para mesclar preservando posições.

- [ ] **Step 3: CSS**

`dashboard.css`, acrescentar:

```css
.panel-cab {
  display: flex; align-items: center; gap: 8px;
  cursor: grab; user-select: none;
}
.panel-cab:active { cursor: grabbing; }
.panel-tit { display: inline-flex; align-items: center; gap: 8px; flex: 1 1 auto; }
.panel-x {
  border: 0; background: none; color: var(--muted); cursor: pointer;
  display: inline-flex; padding: 2px; border-radius: 6px;
}
.panel-x:hover { background: var(--surface-3); color: var(--text); }
.panel.arrastando { opacity: .5; outline: 2px dashed var(--brand); }
@media (pointer: coarse) {
  /* Arrasto nativo não existe em toque: o caminho é o switch nas
     configurações. O cabeçalho deixa de anunciar que arrasta. */
  .panel-cab { cursor: default; }
}
.gira-180 { transform: rotate(180deg); }
```

Conferir se `.gira-180` colide com algo (grep). Se `ico(..., { classe })` não propaga a classe para o `<svg>`, usar `<span class="gira-180">${ico('subir'…)}</span>` no `dashboard.config.js` em vez da classe no ico.

- [ ] **Step 4: `module.js`**

```js
  config: () => import('./dashboard.config.js'),
```

`doc: true` entra na Task 5 junto do `.md` (checagem 11 bloqueia `doc: true` sem `.md`).

- [ ] **Step 5: Verificação no browser (controlador)**

Patch dev-local. `#/dashboard`:
1. Painéis aparecem com cabeçalho arrastável e `×`.
2. Arrastar um painel pelo cabeçalho reordena; recarregar a página mantém (em dev-local a preferência não persiste - confirmar que grava sem erro no console; a persistência real é na URL logada).
3. `×` oculta o painel.
4. Ocultar todos → estado vazio com link para configurações.
5. Console limpo; cada painel isola o próprio erro.
6. `resize_window` mobile: cabeçalho não mostra "grab", painéis empilham.
Reverter o patch.

- [ ] **Step 6: Sanidade + commit**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py` (D6: conferir o tamanho de `dashboard.view.js` - se passar de 400, o próprio Step já dividiu em `views/paineis.js`; se ainda assim passar, mover `ligarArrasto` para `views/arrasto.js`).

```bash
git add src/modules/dashboard/
git commit -m "feat(dashboard): paineis reordenaveis (arrasto) e ocultaveis (x)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: CSS do painel de configuração + `configuracoes.css`

**Files:**
- Modify: `src/modules/configuracoes/configuracoes.css`

- [ ] **Step 1: Estilo das linhas do painel de ordenação**

```css
.cfg-paineis { display: flex; flex-direction: column; gap: 6px; }
.cfg-painel-linha { display: flex; align-items: center; gap: 10px; }
.cfg-painel-nome { flex: 1 1 auto; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
.cfg-painel-setas { display: inline-flex; gap: 4px; }
```

- [ ] **Step 2: Sanidade + commit**

```bash
git add src/modules/configuracoes/configuracoes.css
git commit -m "style(configuracoes): linhas do painel de ordenacao do dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Tutorial + fechar

**Files:**
- Modify: `src/modules/dashboard/module.js` (`doc: true`)
- Create: `docs/modulos/dashboard.md`
- Modify: `src/core/config.js`, `CHANGELOG.md`

- [ ] **Step 1: `doc: true`**

Acrescentar `doc: true,` ao manifesto do dashboard.

- [ ] **Step 2: `docs/modulos/dashboard.md`**

Seguir a espinha do `.claude/rules/documentacao.md`. Cobrir:
- O que cada painel mostra (números do dia, nesta data, extraclasse, afastamentos, calendário, ocorrências).
- Que os painéis dependem do seu acesso: quem não vê Ocorrências não recebe aquele painel.
- Como reordenar: arrastar pelo título, ou setas nas configurações.
- Como ocultar (× no painel) e reexibir (switch nas configurações).
- Que a ordem e os ocultos são só seus e seguem o seu login.
- Que "Nesta data" também responde consultas de dias passados.
Carimbo: `> Atualizado na versão 0.18.0.` (conferir no fecho).

- [ ] **Step 3: Versão + CHANGELOG**

`src/core/config.js`: `0.17.0` → `0.18.0`.

```markdown
## [0.18.0] - 2026-09-06

### Adicionado
- No **Dashboard**, agora você reordena os painéis arrastando pelo título (ou
  pelas setas nas configurações) e oculta os que não usa. A ordem e o que fica
  escondido são só seus e seguem o seu login. Painel de um módulo que você não
  acessa deixou de aparecer.
```

- [ ] **Step 4: Verificação final**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py` (checagem 11 verde: dashboard tem `doc: true` **e** `.md`).

- [ ] **Step 5: Commit e push**

```bash
git add src/modules/dashboard/module.js docs/modulos/dashboard.md src/core/config.js CHANGELOG.md
git commit -m "chore: versao 0.18.0 e fecha o bloco de paineis do dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin dev
```

- [ ] **Step 6: Pendências para o André**

Nenhuma migration nova (as tabelas vêm da 026). Validar logado: arrastar reordena e persiste entre navegadores; `×` oculta; configurações reexibe; quem não vê Ocorrências não recebe o painel.

---

## Self-Review

**Spec coverage:**
- D1 (painel vira unidade declarada; `PAINEIS`; `numeros` e `hoje` viram painéis) → Tasks 2 e 3. ✔
- D2 (painel de módulo oculto não aparece; corrige defeito existente) → Task 3 (`disponiveis` filtra por `nivel(perm) !== OCULTO`). ✔
- D3 (duas chaves de usuário; ordem filtrada e completada na leitura) → Task 2 (`ordemResolvida`, testes). ✔
- D4 (arrastar na página pelo `<h2>`; setas + switch nas configurações; `×` na página oculta, reexibir só nas config) → Tasks 2 e 3. ✔
- D5 (falha de um painel não derruba a tela) → Task 3 (`Promise.resolve(...).catch` por painel) + Task 1 (cada `painel*` trata o próprio erro). Critério de aceite explícito. ✔
- D6 (tamanho: dividir por superfície) → Task 1 já separa `views/paineis.js`; Task 3 Step 6 verifica e divide mais se preciso. ✔
- Critérios 1-10 → Tasks 1-5 + verificação da Task 3 Step 5.

**Placeholder scan:** sem TBD. O `dashboard.md` (Task 5 Step 2) é conteúdo de redação guiado por tópicos obrigatórios, revisável em diff, coberto por `check_pii`. A nota da Task 3 Step 2 sobre a ordem-com-ocultos é uma decisão explícita, não um buraco.

**Type consistency:** `PAINEIS_META` (id/titulo/ico/perm?) definido na Task 2, consumido na Task 3 e pelo `pintarPaineisConfig`. `ordemResolvida(idsDisponiveis)` / `paineisOcultos()` / `definirOrdem(ids)` / `definirOcultos(ids)` - assinaturas idênticas entre Task 2 (definição) e Task 3 (uso). `painel*(box, hoje)` - Task 1 define, Task 3 chama via `PINTURA`.
