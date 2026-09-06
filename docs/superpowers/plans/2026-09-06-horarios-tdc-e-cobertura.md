# Horários: TDC por dia da semana, cobertura por tipo e leitura da grade (Bloco G) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobertura de horário por tipo de escola; TDC preso a um dia da semana (aparece na jornada mesmo com o calendário vazio); a jornada de TDC como sub-linha da grade; e os quatro ajustes de leitura (D8–D11).

**Architecture:** Continua o modelo de escalas de 2026-08-27 (escala = nome de dia; o calendário resolve a data). Cobertura deixa de ser constante e vira config de rede por tipo (`segmento` + `tem_eja`). `escala_tipo` ganha `dia_semana`. As funções puras de `grade.model.js` passam a receber a janela como parâmetro; a view a deriva da unidade. Três painéis novos em `horarios.config.js` (mecanismo do Bloco A). A grade ganha uma sub-faixa por dia com escala fixa.

**Tech Stack:** JS ES modules puro, sem build. `node --test`. Migration à mão. Config via `core/configuracoes.js`.

**Spec:** `docs/superpowers/specs/2026-09-05-horarios-tdc-e-cobertura-design.md` (continua `2026-08-27-horarios-escalas-grade-design.md`).

## Global Constraints

- PT-BR em código, comentário, commit e interface.
- Branch `dev`. Commits por slice. Push ao fechar.
- Todo valor do banco por `esc()`. Nenhuma cor literal em `src/modules/**`.
- **Datas civis:** `dia_semana` 1–5 (seg–sex). `diaDaSemana(iso)` já existe (`escalas.model.js`), devolve 0–6.
- **D6.1 é crítico:** `validarDia` roda **uma vez por escala**, nunca sobre blocos de escalas diferentes concatenados - senão acusa sobreposição fantasma.
- **`grade.model.js` continua puro:** as três funções recebem `janela = { ini, fim }` (minutos); default = janela de fábrica. Nenhuma delas passa a importar config.
- Migration **027** idempotente; fecha com `select registrar_migration('027', '...')`. Degrada com `42703` → catálogo sem dia fixo → comportamento de hoje.
- **Regra de documentação (Bloco B):** `horarios` ganha `doc: true` e `docs/modulos/horarios.md` **no mesmo commit**.
- Ao fechar: `CONFIG.versao` MINOR + `CHANGELOG.md`.
- `node --test tests/*.mjs` e `python .claude/scripts/verificar_arquitetura.py` sem violações. **Legível em 375px** - a grade é o pior caso; medir.

---

## Contexto verificado

- **Constantes de cobertura:** `horarios.model.js:24-25` `COBERTURA_INICIO='07:00'`, `COBERTURA_FIM='18:20'`. Lidas por `grade.model.js` (`INI=paraMin(...)=420`, `FIM=1100`) e por `horarios.view.js` (texto do page-head) e `por-escola.js` (texto "Cobertura da escola:").
- **`grade.model.js`** funções puras que usam `INI`/`FIM`: `posicaoNaBarra(bloco)`, `marcasDaBarra()`, `lacunasCobertura(blocos)`. `grade.js` (`gradeHtml`) chama as três + `posDoIntervalo` (que chama `posicaoNaBarra`).
- **`grade.js` `eixo()`** (`:120-123`): `<em>${m.hora.slice(0, 2)}</em>` - o "07" sem "h".
- **`grade.js` `gradeHtml`** (`:107`): `<div class="hg-dia">${esc(d.curto)}</div>` - "Seg".
- **`escalas.model.js` (horarios):** `getEscalas()` → `.select('chave, rotulo, ordem').order('ordem')`; degrada `42P01` → `ESCALAS_PADRAO`. `definirEscalaTipo(chave, { rotulo, ordem })`. `escolherBlocos`, `jornadaEm`, `resolverEscala`.
- **`horarios.view.js`:** monta `emUso` (Set de escalas com data marcada no ano) + `catalogoEscalas` (`getEscalas`), ordena por `escala_tipo.ordem`, passa `ctx.escalasEmUso`/`ctx.catalogoEscalas`. Tem o botão `#h-cargos` (`:48-49`) que abre `views/cargos.js` `abrirCargos({ recarregar })`.
- **`jornada.js`:** `abrirJornada({ servidor, unidadeId, blocos, recarregar, escalasEmUso, catalogoEscalas, escalaInicial })`. `estado.porEscala[escala][dia_semana] = linhas[]`. `DIAS` (seg–sex) de `horarios.model.js`. Abas por escala; `pintar()` renderiza os 5 dias; `pintarDica()` texto por escala. Botão "+ bloco" (`.hj-add`) por dia. `salvar()` grava todas as escalas.
- **`por-escola.js`** (356 linhas - perto do limite R11 de 400): `carregar()` monta `escalaVista`, chama `blocosDe(servidorId, dia)` = `escolherBlocos(blocos.filter(...), escalaVista)`, passa a `gradeHtml`. Seletor de escala = `.hg-escalas` chips (só se `escalasEmUso.length > 1`). `mostrarCobertura = local?.tipo !== 'sede'`.
- **`views/cargos.js`:** `abrirCargos({ recarregar })` faz `abrirDrawer(...)` + `getCargos`/`getCargosGestao`/`definirCargoGestao`. Linhas `<label class="switch cg-linha">`.
- **`calendario/views/escalas.js` `pintarRede`** (`:129-152`): `<select class="cal-esc-sel"><option value="">Sem escala</option>...`; `salvarRede` faz `definirEscalaRede(data, select.value || null)`. `pintarEscola` (visão Escola) tem os três estados - **não muda** (D8). `abrirTiposEscala`/`pintarTipos` (a modal, `:326+`): `<div class="esc-row">` com `<input class="et-rotulo">` solto + `<span class="form-hint">chave</span>`; `criarTipo` cria; **sem** botão de excluir.
- **`calendario.view.js` `pintar()`** (`:120-152`): monta as células do mês; `d = dias[iso]`; `.cal-marks` tem os ícones de bloqueio. `getCalendarioMes(ano, mes)` traz os dias. `getEscalasRede(de, ate)` / `getEscalasUnidade(unidadeId, de, ate)` disponíveis em `calendario.model.js`.
- **Bloco A** `painel.js`: item com `painel: (box, ctx) => …` desenhado em `[data-painel="<chave>"]`. Grupos `regras` e `calendario` existem em `GRUPOS`.
- **`core/segmentos.js`** `segmentosDaUnidade(u)` → `['EMEF']` ou `['EMEF','EJA']` etc.
- `tests/horarios.test.mjs` importa `validarDia, paraMin` + `empilhar, contarFaixas, ordenarParaGrade, SERIES`. `tests/escalas.test.mjs` cobre `escolherBlocos`/`jornadaEm`/`resolverEscala`. **Nenhum** testa `posicaoNaBarra`/`marcasDaBarra`/`lacunasCobertura`.
- `CONFIG.versao` após o Bloco F: `0.19.0`.

---

## Task 1 (Slice 1): D1, D7, D8, D11 - leitura, "Sem escala" e a modal de tipos

**Files:**
- Modify: `src/styles/components.css` (D1)
- Modify: `src/modules/horarios/views/grade.js` (D7)
- Modify: `src/modules/horarios/horarios.css` (D7)
- Modify: `src/modules/calendario/views/escalas.js` (D8, D11)
- Modify: `src/modules/calendario/calendario.css` (D11, se preciso)
- Modify: `src/modules/horarios/escalas.model.js` (D11 - detectar tipo em uso)

- [ ] **Step 1: D1 - campo de busca ocupa a linha**

`components.css`, junto das regras de `.toolbar`:

```css
/* O seletor de busca da toolbar (Horários "Por escola"/"Por servidor")
   estica até o contador. min-width: 0 é obrigatório - sem ele o item
   flex não encolhe abaixo do conteúdo e empurra o .count para baixo. */
.toolbar > div:has(> .bs) { flex: 1 1 auto; min-width: 0; }
.toolbar > .count { flex: 0 0 auto; }
```

(Conferir no browser que `#h-uni-box` / o wrapper do `.bs` em `por-servidor.js` são filhos diretos de `.toolbar`. Se `:has` não pegar, dar uma classe `.toolbar-busca` ao wrapper nas duas views.)

- [ ] **Step 2: D7 - eixo com `h`, dias em caixa alta**

`grade.js` `eixo()`:

```js
`<span class="hg-marca" style="left:${m.pos}%"><i></i><em>${esc(m.hora.slice(0, 2))}h</em></span>`
```

`horarios.css`:

```css
.hg-dia { text-transform: uppercase; }
.hg-marca em { font-size: 9.5px; color: color-mix(in srgb, var(--muted) 65%, var(--surface)); }
```

(Conferir o valor atual de `.hg-marca em` em `horarios.css` e substituir, não duplicar.)

- [ ] **Step 3: D8 - "Sem escala" da visão Rede vira botão de excluir**

`calendario/views/escalas.js` `pintarRede`: o `<select>` perde a `<option value="">Sem escala</option>`; ao lado dele, um botão:

```js
${ctxAtual.podeEditar ? `
  <select class="cal-esc-sel" aria-label="Escala de ${esc(fmtData(r.data))}">
    ${catalogo.filter(e => e.chave !== 'normal').map(e =>
      `<option value="${esc(e.chave)}" ${r.escala === e.chave ? 'selected' : ''}>${esc(e.rotulo)}</option>`).join('')}
  </select>
  <button type="button" class="mini-btn no cal-esc-del" aria-label="Remover ${esc(fmtData(r.data))} do calendário de TDC">${ico('excluir', { tam: 14 })}</button>` : ...}
```

`salvarRede` deixa de tratar `value === ''`. Novo handler:

```js
corpo.querySelectorAll('.cal-esc-del').forEach(b => b.addEventListener('click', () => removerDataRede(b.closest('.cal-esc-linha').dataset.data)));
```

```js
async function removerDataRede(data) {
  const ok = await confirmar(`Remover ${fmtData(data)} do calendário de TDC?`, {
    detalhe: 'A data volta a valer a jornada Normal para toda a rede. Os horários de TDC gravados não são apagados - só deixam de valer nesta data.',
    textoOk: 'Remover', perigo: true,
  });
  if (!ok) return;
  try { await definirEscalaRede(data, null); toast({ titulo: 'Data removida', texto: fmtData(data), tipo: 'sucesso' }); }
  catch (err) { toast({ titulo: 'Não foi possível remover', texto: err.message || String(err), tipo: 'erro' }); }
  finally { carregar(); }
}
```

`confirmar` já está importado. A visão **Escola** (`pintarEscola`) **não muda**.

- [ ] **Step 4: D11 - modal "Tipos de escala" no padrão + excluir**

Em `escalas.model.js` (horarios), uma função para saber se um tipo está em uso:

```js
// true se a escala está gravada em algum bloco de jornada OU em alguma
// data do calendário - só então NÃO pode ser excluída.
export async function escalaEmUso(chave) {
  if (!hasSupabase()) return false;
  const [b, d] = await Promise.all([
    sb().from('horario_bloco').select('id', { count: 'exact', head: true }).eq('escala', chave),
    sb().from('dia_calendario').select('data', { count: 'exact', head: true }).eq('escala', chave),
  ]);
  return (b.count || 0) > 0 || (d.count || 0) > 0;
}

export async function excluirEscalaTipo(chave) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  if (chave === 'normal') throw new Error('A escala Normal não pode ser excluída.');
  if (await escalaEmUso(chave)) {
    const e = new Error('Esta escala está em uso (no calendário ou em jornadas). Remova esses registros antes.');
    e.amigavel = true; throw e;
  }
  const { error } = await sb().from('escala_tipo').delete().eq('chave', chave);
  if (error) throw error;
  _escalas = null;
}
```

`calendario/views/escalas.js` `pintarTipos()`: cada linha vira um campo com rótulo padrão + botão de excluir:

```js
document.getElementById('et-lista').innerHTML = catalogo.map(e => `
  <div class="et-linha" data-chave="${esc(e.chave)}">
    <label class="et-campo">${esc(e.chave)}
      <input class="et-rotulo" value="${esc(e.rotulo)}" aria-label="Rótulo de ${esc(e.chave)}" />
    </label>
    ${e.chave !== 'normal'
      ? `<button type="button" class="mini-btn no et-del" aria-label="Excluir ${esc(e.rotulo)}">${ico('excluir', { tam: 14 })}</button>`
      : ''}
  </div>`).join('');
```

Handler de `et-del` chama `excluirEscalaTipo` (import), toast, `catalogo = await getEscalas()`, `pintarTipos()`. `criarTipo`/`renomear` continuam.

`calendario.css` (ou onde `.esc-row .et-rotulo` estava): `.et-linha { display: flex; gap: 8px; align-items: end; }` `.et-campo { flex: 1 1 auto; display: flex; flex-direction: column; gap: 4px; color: var(--form-label); font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }` `.et-campo input { min-height: var(--campo); }`.

- [ ] **Step 5: Sanidade + verificação (controlador)**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py`.
Browser (patch dev-local): Horários "Por escola" - o "Buscar escola…" estica; o eixo mostra `07h`; os dias `SEG`. Calendário → Escalas (TDC), visão Rede - cada data tem `<select>` (sem "Sem escala") + lixeira vermelha; clicar pede confirmação. Modal "Tipos de escala" - campos com rótulo, lixeira que recusa escala em uso. Reverter.

- [ ] **Step 6: Commit**

```bash
git add src/styles/components.css src/modules/horarios/ src/modules/calendario/
git commit -m "feat(horarios): busca elastica, eixo com h, dias em caixa alta; 'Sem escala' vira excluir; modal de tipos no padrao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2 (Slice 2): D2 - "Equipe gestora" vira painel de configuração

**Files:**
- Create: `src/modules/horarios/horarios.config.js`
- Modify: `src/modules/horarios/views/cargos.js`
- Modify: `src/modules/horarios/horarios.view.js`
- Modify: `src/modules/horarios/module.js`

**Interfaces:**
- Produces: `horarios.config.js` `DECLARACAO` com o item `cargos_gestao` (painel). `views/cargos.js` passa a exportar `pintarCargosGestao(box, ctx)`.

- [ ] **Step 1: `views/cargos.js` - recebe elemento, não abre gaveta**

Trocar `export async function abrirCargos({ recarregar })` por `export async function pintarCargosGestao(box)`. Remover o `abrirDrawer(...)` e o `drawerHead`; escrever direto em `box`:

```js
export async function pintarCargosGestao(box) {
  if (!box) return;
  box.innerHTML = `
    <p class="form-hint">Cargo que não estiver ligado aqui não aparece por padrão
      na grade da escola nem entra no cálculo da cobertura. Ele continua podendo
      ser acrescentado escola a escola.</p>
    <div id="cg-lista">${loading()}</div>`;
  const lista = box.querySelector('#cg-lista');
  let cargos = [], gestao = new Set();
  try { [cargos, gestao] = await Promise.all([getCargos(), getCargosGestao()]); }
  catch (err) { lista.innerHTML = erroBox(err); return; }
  lista.innerHTML = cargos.length ? `<div class="cg-linhas">${cargos.map(c => `
    <label class="switch cg-linha">
      <input type="checkbox" data-cargo="${esc(c)}" ${gestao.has(c) ? 'checked' : ''} />
      <span class="switch-trilho" aria-hidden="true"></span>
      <span class="switch-txt">${esc(c)}</span>
    </label>`).join('')}</div>`
    : `<p class="form-hint">Nenhum cargo em uso ainda. Registre um local de trabalho em Servidores.</p>`;
  lista.addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-cargo]'); if (!inp) return;
    inp.disabled = true;
    try { await definirCargoGestao(inp.dataset.cargo, inp.checked); toast({ titulo: 'Equipe gestora atualizada', texto: inp.dataset.cargo, tipo: 'sucesso' }); }
    catch (err) { inp.checked = !inp.checked; reportarErro(err, { titulo: 'Não foi possível salvar' }); }
    finally { inp.disabled = false; }
  });
}
```

Remover imports não usados (`drawerHead`, `abrirDrawer`). Não precisa mais de `recarregar` - a grade recarrega quando a pessoa volta para ela (o painel de config é uma gaveta por cima; ao fechar, a view por baixo não recarregou sozinha, mas os models têm cache invalidado por `definirCargoGestao` → o próximo `getCargosGestao` na grade lê fresco). **Aviso:** se a grade estiver aberta atrás da gaveta, ela não repinta ao vivo - aceitável (config é raro e a pessoa reabre a escola). Documentar como decisão.

- [ ] **Step 2: `horarios.config.js`**

```js
// Declaração de configuração do módulo Horários. NÃO é model. Três
// itens de rede: quais cargos são equipe gestora (Task 2), a janela de
// cobertura por tipo de escola (Task 4) e o dia da semana de cada
// escala (Task 5).
import { pintarCargosGestao } from './views/cargos.js';

export const DECLARACAO = {
  itens: [
    { chave: 'cargos_gestao', escopo: 'rede', grupo: 'regras',
      rotulo: 'Equipe gestora',
      dica: 'Quais cargos entram na grade e na cobertura por padrão.',
      painel: pintarCargosGestao },
  ],
};
```

(Tasks 4 e 5 acrescentam itens aqui.)

- [ ] **Step 3: `horarios.view.js` - remove o botão da barra**

Remover o `<button id="h-cargos">` (`:48-49`) e o listener `document.getElementById('h-cargos')?.addEventListener(...)` (`:88-91`). O `.h-topo` fica só com a `.tabbar`.

- [ ] **Step 4: `horarios/module.js`**

```js
  config: () => import('./horarios.config.js'),
```

`doc: true` entra na Task 6 (com o `.md`).

- [ ] **Step 5: Sanidade + verificação**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py`.
Browser (patch dev-local): Horários não tem mais o botão "Equipe gestora" na barra; a engrenagem do módulo abre a gaveta com o painel "Equipe gestora" no grupo "Regras e limites"; `#/configuracoes` mostra o mesmo. Reverter.

- [ ] **Step 6: Commit**

```bash
git add src/modules/horarios/
git commit -m "feat(horarios): 'Equipe gestora' vira painel de configuracao de rede

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3 (Slice 3): D3 - cobertura por tipo de escola

**Files:**
- Modify: `src/modules/horarios/horarios.model.js`
- Modify: `src/modules/horarios/grade.model.js`
- Modify: `src/modules/horarios/horarios.config.js`
- Modify: `src/modules/horarios/views/grade.js`, `src/modules/horarios/views/por-escola.js`, `src/modules/horarios/horarios.view.js`
- Test: `tests/grade.test.mjs` (criar)

**Interfaces:**
- Produces:
  - `horarios.config.js`: `janelaDaUnidade(unidade): { ini, fim }` (minutos) + item `cobertura_por_tipo` (painel).
  - `grade.model.js`: `posicaoNaBarra(bloco, janela?)`, `marcasDaBarra(janela?)`, `lacunasCobertura(blocos, janela?)` - `janela = { ini, fim }`, default = fábrica.

- [ ] **Step 1: Testes que falham**

`tests/grade.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posicaoNaBarra, marcasDaBarra, lacunasCobertura } from '../src/modules/horarios/grade.model.js';
import { paraMin } from '../src/modules/horarios/horarios.model.js';

const J1 = { ini: paraMin('07:00'), fim: paraMin('18:20') };  // fábrica
const J2 = { ini: paraMin('07:00'), fim: paraMin('17:00') };  // CEI

test('posicaoNaBarra: o mesmo bloco ocupa mais da barra numa janela menor', () => {
  const b = { inicio: '07:00', fim: '12:00' };
  assert.ok(posicaoNaBarra(b, J2).largura > posicaoNaBarra(b, J1).largura);
});

test('marcasDaBarra: a última marca não passa do fim da janela', () => {
  const m = marcasDaBarra(J2);
  assert.equal(m[m.length - 1].hora.slice(0, 5), '17:00');
});

test('lacunasCobertura: janela menor, lacuna final menor', () => {
  const blocos = [{ inicio: '07:00', fim: '13:00' }];
  const g1 = lacunasCobertura(blocos, J1);
  const g2 = lacunasCobertura(blocos, J2);
  assert.equal(g2[g2.length - 1].fim, J2.fim);
  assert.ok(g1[g1.length - 1].fim > g2[g2.length - 1].fim);
});

test('sem janela = comportamento de fábrica', () => {
  const b = { inicio: '07:00', fim: '12:00' };
  assert.deepEqual(posicaoNaBarra(b), posicaoNaBarra(b, J1));
});
```

Run: `node --test tests/grade.test.mjs` → FAIL.

- [ ] **Step 2: Parametrizar `grade.model.js`**

`horarios.model.js`: `COBERTURA_INICIO`/`COBERTURA_FIM` **ficam** (são o padrão de fábrica) mas renomeados no comentário para "padrão de fábrica".

`grade.model.js`:

```js
import { paraMin, paraHora, COBERTURA_INICIO, COBERTURA_FIM, unir } from './horarios.model.js';

// Janela de fábrica - o padrão quando a Gerência não configurou nada.
export const JANELA_FABRICA = { ini: paraMin(COBERTURA_INICIO), fim: paraMin(COBERTURA_FIM) };

export function posicaoNaBarra(bloco, { ini, fim } = JANELA_FABRICA) {
  const janela = fim - ini;
  const i = Math.max(paraMin(bloco.inicio), ini);
  const f = Math.min(paraMin(bloco.fim), fim);
  return { esquerda: ((i - ini) / janela) * 100, largura: (Math.max(f - i, 0) / janela) * 100,
           forade: paraMin(bloco.inicio) < ini || paraMin(bloco.fim) > fim };
}

export function marcasDaBarra({ ini, fim } = JANELA_FABRICA) {
  const janela = fim - ini;
  const marcas = [];
  for (let m = Math.ceil(ini / 60) * 60; m <= fim; m += 60) marcas.push({ hora: paraHora(m), pos: ((m - ini) / janela) * 100 });
  return marcas;
}

export function lacunasCobertura(blocosDoDiaDaUnidade, { ini, fim } = JANELA_FABRICA) {
  const cobertos = unir(blocosDoDiaDaUnidade.map(paraIntervalo)).filter(iv => iv.fim > ini && iv.ini < fim);
  const lacunas = []; let cursor = ini;
  for (const iv of cobertos) {
    if (iv.ini > cursor) lacunas.push({ ini: cursor, fim: Math.min(iv.ini, fim) });
    cursor = Math.max(cursor, iv.fim);
    if (cursor >= fim) break;
  }
  if (cursor < fim) lacunas.push({ ini: cursor, fim });
  return lacunas;
}
```

Remover os `const INI`/`const FIM` de topo (agora dentro de `JANELA_FABRICA`).

- [ ] **Step 3: `janelaDaUnidade` em `horarios.config.js`**

```js
import { conf } from '../../core/configuracoes.js';
import { segmentosDaUnidade } from '../../core/segmentos.js';
import { paraMin } from './horarios.model.js';
import { JANELA_FABRICA } from './grade.model.js';

// O tipo de cobertura de uma unidade: EMEF_EJA se tem EJA; senão o
// segmento-base. Sem segmento (sede) → null, sem cobertura.
export function tipoCobertura(u) {
  const segs = segmentosDaUnidade(u);
  if (!segs.length) return null;
  if (segs.includes('EJA') && segs.includes('EMEF')) return 'EMEF_EJA';
  return segs[0];
}

export function janelaDaUnidade(u) {
  const tipo = tipoCobertura(u);
  const mapa = conf('horarios', 'cobertura_por_tipo') || {};
  const j = tipo && mapa[tipo];
  if (!j?.inicio || !j?.fim) return { ...JANELA_FABRICA };
  return { ini: paraMin(j.inicio), fim: paraMin(j.fim) };
}
```

Item de config (painel - grupo "Calendário e escalas"):

```js
{ chave: 'cobertura_por_tipo', escopo: 'rede', grupo: 'calendario',
  rotulo: 'Janela de cobertura por tipo de escola',
  dica: 'O horário em que precisa haver alguém da equipe gestora na unidade. O padrão é 07:00–18:20 para todos.',
  painel: pintarCoberturaPorTipo },
```

`pintarCoberturaPorTipo(box)`: para cada tipo (`EMEF`, `EMEF_EJA`, `CEI`, `EMEI`, `CONVENIADA`), dois `<input type="time">` (início/fim) com o valor de `conf('horarios','cobertura_por_tipo')?.[tipo]` ou o padrão. `change` → monta o objeto inteiro e `definirConf('horarios', 'cobertura_por_tipo', obj)`. Campos dentro de `.esc-form`/`.campos` para herdar a altura de campo (R17).

- [ ] **Step 4: As views passam a janela**

`por-escola.js` `carregar()`: `const janela = janelaDaUnidade(unidades.find(u => u.id === unidadeId));` (importar de `../horarios.config.js`). Passar `janela` a `gradeHtml(DIAS, { linhas, blocosDe, mostrarCobertura, janela })`. O texto "Cobertura da escola: X às Y" usa `paraHora(janela.ini)` / `paraHora(janela.fim)`.

`grade.js` `gradeHtml({ ..., janela })`: threa `janela` em `posicaoNaBarra(bloco, janela)`, `marcasDaBarra(janela)` (no `eixo(janela)`), `lacunasCobertura(..., janela)`, e `posDoIntervalo(ini, fim, janela)`.

`horarios.view.js` page-head: o texto fixo "das 07:00 às 18:20" vira "conforme o tipo da escola" (a janela varia; não dá para citar uma no cabeçalho). Ex.: "…e a escola coberta pela janela do seu tipo (o padrão é das 07:00 às 18:20)."

- [ ] **Step 5: Rodar os testes**

Run: `node --test tests/grade.test.mjs` → PASS. `node --test tests/*.mjs` → PASS (os testes antigos não passam janela → usam a de fábrica → inalterados).

- [ ] **Step 6: Verificação (controlador)**

Browser (patch dev-local): configurar CEI para 07:00–17:00 no painel; abrir uma escola CEI em Horários → a tira de cobertura e o eixo vão até 17h; abrir uma EMEF → até 18:20. Reverter.

- [ ] **Step 7: Commit**

```bash
git add src/modules/horarios/ tests/grade.test.mjs
git commit -m "feat(horarios): janela de cobertura por tipo de escola (config de rede)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4 (Slice 4): D10 - "Copiar para todos os dias" na gaveta de jornada

**Files:**
- Modify: `src/modules/horarios/views/jornada.js`

- [ ] **Step 1: Botão por dia**

Em `pintar()`, ao lado do `.hj-add`:

```js
<button type="button" class="mini-btn hj-add" data-dia="${d.n}">${ico('adicionar', { tam: 14 })} bloco</button>
${podeCopiar() ? `<button type="button" class="mini-btn hj-copiar" data-dia="${d.n}">${ico('atualizar', { tam: 14 })} copiar para todos os dias</button>` : ''}
```

`podeCopiar()` = `estado.escala` **não** tem `dia_semana` fixo (Task 5 acrescenta o dado; até lá, sempre `true` para escalas sem dia). Guardar `estado.diasFixos = { [escala]: dow|null }` vindo do catálogo.

- [ ] **Step 2: Handler**

```js
box.querySelectorAll('.hj-copiar').forEach(b => b.addEventListener('click', async () => {
  const origem = Number(b.dataset.dia);
  const dias = estado.porEscala[estado.escala];
  const fonte = dias[origem].filter(l => !l.excluir);
  if (!fonte.length) return toast({ titulo: 'Nada para copiar', texto: 'Este dia não tem blocos.', tipo: 'atencao' });
  const temOutros = DIAS.some(d => d.n !== origem && dias[d.n].some(l => !l.excluir));
  if (temOutros && !(await confirmar('Copiar para todos os dias?', {
      detalhe: 'Os blocos dos outros dias desta escala serão substituídos pelos deste dia.', textoOk: 'Copiar' }))) return;
  for (const d of DIAS) {
    if (d.n === origem) continue;
    // marca os existentes com id para exclusão; substitui pelos novos (sem id).
    dias[d.n] = dias[d.n].filter(l => l.id).map(l => ({ ...l, excluir: true }))
      .concat(fonte.map(l => ({ inicio: l.inicio, fim: l.fim, obs: l.obs })));
  }
  pintar();
}));
```

`confirmar` precisa ser importado em `jornada.js`.

- [ ] **Step 3: Verificação (controlador)**

Browser: montar a segunda de um servidor, clicar "copiar para todos os dias" → terça a sexta ficam iguais; editar a terça depois não muda a segunda; "Salvar jornada" grava tudo. Confirmação aparece quando outro dia já tinha bloco.

- [ ] **Step 4: Commit**

```bash
git add src/modules/horarios/views/jornada.js
git commit -m "feat(horarios): botao 'copiar para todos os dias' na gaveta de jornada

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5 (Slice 5): D4 + D5 - dia da semana no catálogo; jornada de escala com dia fixo

**Files:**
- Create: `supabase/migrations/027_escala_dia_semana.sql`
- Modify: `src/modules/horarios/escalas.model.js`
- Modify: `src/modules/horarios/horarios.config.js`
- Modify: `src/modules/horarios/horarios.view.js`
- Modify: `src/modules/horarios/views/jornada.js`
- Test: `tests/escalas.test.mjs`

- [ ] **Step 1: Migration 027**

```sql
-- ============================================================
-- 027 - Dia da semana da escala
-- Rode no SQL Editor, depois da 025/026.
-- Uma escala com dia_semana definido entra na jornada mesmo com o
-- calendário do ano vazio (problema 1 do Bloco G). O calendário
-- continua mandando na resolução data-a-data.
-- ============================================================
alter table escala_tipo add column if not exists dia_semana smallint
  check (dia_semana is null or dia_semana between 1 and 5);

select registrar_migration('027', 'Dia da semana da escala (escala_tipo.dia_semana)');
```

- [ ] **Step 2: `escalas.model.js` lê e grava `dia_semana`**

`getEscalas()`: `.select('chave, rotulo, ordem, dia_semana')`; degradação: se `error.code === '42703'`, refazer sem `dia_semana` e mapear `dia_semana: null`. `ESCALAS_PADRAO` entries ganham `dia_semana: null`.

`definirEscalaTipo(chave, { rotulo, ordem, dia_semana })`: incluir `dia_semana` no `row` quando a chave estiver presente (aceitar `null` explícito).

Nova função para a união das três origens (D4):

```js
// As escalas que devem aparecer na gaveta de jornada de um servidor:
// as em uso no calendário do ano ∪ as já gravadas nos blocos dele ∪
// as com dia_semana definido (aparecem mesmo com o calendário vazio).
export function escalasParaJornada({ emUsoNoAno = [], blocosDoServidor = [], catalogo = [] }) {
  const s = new Set(['normal', ...emUsoNoAno, ...blocosDoServidor.map(b => b.escala || 'normal')]);
  for (const e of catalogo) if (e.dia_semana != null) s.add(e.chave);
  return [...s];
}
```

- [ ] **Step 3: `horarios.config.js` - painel "Dias de escala"**

```js
{ chave: 'dia_semana_escala', escopo: 'rede', grupo: 'calendario',
  rotulo: 'Dia da semana de cada escala',
  dica: 'Em que dia o TDC costuma cair. O calendário ainda manda na resolução de cada data - isto só faz a escala aparecer na jornada antes do calendário do ano ser lançado.',
  painel: pintarDiasDeEscala },
```

`pintarDiasDeEscala(box)`: `getEscalas()`; para cada escala ≠ 'normal', um `<select>` Seg–Sex + "sem dia fixo" (`value=""`). `change` → `definirEscalaTipo(chave, { dia_semana: v ? Number(v) : null })` (o rótulo e a ordem não são tocados - `definirEscalaTipo` faz upsert; garantir que passar só `dia_semana` não zere `rotulo`: **ajustar `definirEscalaTipo` para buscar o rótulo atual se não vier**, ou fazer um `update` em vez de `upsert` quando só `dia_semana` muda). Decisão: `definirEscalaTipo` passa a fazer `update` da(s) coluna(s) presentes quando a chave já existe, e `insert` só quando não existe.

- [ ] **Step 4: `horarios.view.js` - união das três origens**

Substituir a montagem de `emUso`/`escalasOrdenadas` por `escalasParaJornada({ emUsoNoAno: [...emUso], blocosDoServidor: [], catalogo: catalogoEscalas })` para `ctx.escalasEmUso` - mas `blocosDoServidor` varia por servidor. Manter a lógica atual (rede + catálogo com dia fixo) no `ctx`, e `jornada.js` já une com `blocos.map(b => b.escala)` internamente (linha 37). Então: `horarios.view.js` só acrescenta ao `emUso` as escalas com `dia_semana != null`:

```js
for (const e of catalogoEscalas) if (e.dia_semana != null) emUso.add(e.chave);
```

`ctx.catalogoEscalas` já carrega `dia_semana` (Step 2).

- [ ] **Step 5: `jornada.js` - escala com dia fixo mostra um dia só (D5)**

`abrirJornada`: montar `estado.diasFixos = Object.fromEntries(catalogoEscalas.map(e => [e.chave, e.dia_semana ?? null]))`.

`pintar()`: `const dias = estado.diasFixos[estado.escala] ? DIAS.filter(d => d.n === estado.diasFixos[estado.escala]) : DIAS;` e iterar `dias` em vez de `DIAS`.

`pintarDica()`: para escala com dia fixo: `"Deixe em branco para seguir a jornada Normal desta " + DIAS.find(d => d.n === dow).nome.toLowerCase() + "."`.

**Blocos órfãos** (gravados em outros dias numa escala que agora tem dia fixo): ao montar `porEscala`, detectar `blocos` dessa escala com `dia_semana !== diaFixo`; se houver, mostrar um aviso no topo da aba com um botão "Remover N bloco(s) em outros dias" que marca `.excluir` nesses e repinta. **Não apagar em silêncio.**

`salvar()`: já grava `estado.porEscala` inteiro; como `pintar` só mostra o dia fixo, os outros dias dessa escala em `estado.porEscala` ficam intocados (não são apagados) - a menos que o botão de órfãos os marque. Isso está correto (D5: "não são apagados").

- [ ] **Step 6: Testes**

`tests/escalas.test.mjs`: acrescentar

```js
test('escalasParaJornada une as três origens e sempre inclui normal', () => {
  const r = escalasParaJornada({
    emUsoNoAno: ['tdc-presencial'],
    blocosDoServidor: [{ escala: 'tdc-virtual' }],
    catalogo: [{ chave: 'tdc-c', dia_semana: 4 }, { chave: 'tdc-d', dia_semana: null }],
  });
  assert.ok(r.includes('normal') && r.includes('tdc-presencial') && r.includes('tdc-virtual') && r.includes('tdc-c'));
  assert.ok(!r.includes('tdc-d'));
});
```

Run: `node --test tests/escalas.test.mjs` → PASS.

- [ ] **Step 7: Verificação (controlador)**

Browser (patch dev-local, precisa de fixtures de catálogo com `dia_semana`): no painel "Dias de escala", pôr "TDC Presencial" na Quarta; abrir a jornada de um servidor com o calendário do ano vazio → a aba "TDC Presencial" aparece e mostra só Quarta. Reverter.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/027_escala_dia_semana.sql src/modules/horarios/ tests/escalas.test.mjs
git commit -m "feat(horarios): dia da semana no catalogo de escalas; jornada de dia fixo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6 (Slice 6): D6 + D9 - sub-linha de TDC na grade; escala na grade mensal

**Files:**
- Modify: `src/modules/horarios/views/por-escola.js`, `src/modules/horarios/views/grade.js`, `src/modules/horarios/horarios.css`
- Modify: `src/modules/calendario/calendario.view.js`, `src/modules/calendario/calendario.css`
- Modify: `src/modules/horarios/module.js` (`doc: true`)
- Create: `docs/modulos/horarios.md`
- Modify: `src/core/config.js`, `CHANGELOG.md`

- [ ] **Step 1: D6 - sub-linha na grade "Por escola"**

`por-escola.js`: identificar as escalas com dia fixo (`ctxAtual.catalogoEscalas.filter(e => e.dia_semana)`). Para cada uma, o dia `e.dia_semana` ganha uma sub-faixa.

O chip de escala (`.hg-escalas`) filtra fora as escalas com dia fixo: `ctxAtual.escalasEmUso.filter(e => !diaFixoDe(e))`.

`gradeHtml` recebe `subLinhas` = `[{ dia, escala, rotulo, blocosDe }]` (uma por escala com dia fixo em uso). Para cada `hg-linha` cujo `d.n` casa, renderiza abaixo da faixa normal:

```html
<div class="hg-sublinha" data-escala="...">
  <div class="hg-sub-rotulo">┈ TDC Presencial ┈</div>
  <div class="hg-track" style="height:...">${eixo(janela)}${barrasDaSubLinha}</div>
</div>
```

**D6.1:** as `marcas` de validação (`validarDia`) da faixa normal usam só os blocos normais; as da sub-linha usam só os blocos daquela escala. **Nunca concatenar.**
**D6.2:** `lacunasCobertura` continua só sobre os blocos normais (`escalaVista`/normal). A sub-linha não entra no cálculo de cobertura.
**D6.3:** só quem tem bloco próprio na escala aparece na sub-linha (`escolherBlocos` sem fallback para 'normal' - filtrar `b.escala === escalaDaSubLinha` diretamente). Um `<p class="form-hint">` abaixo: "Quem não tem horário próprio de TDC cumpre a jornada normal."

Cuidado com o tamanho de `por-escola.js` (356 linhas). Se passar de 400, mover a montagem das sub-linhas para uma função em `grade.js` (que é onde o HTML da grade mora).

- [ ] **Step 2: D7-relacionado - `eixo()` recebe janela**

Já feito na Task 3 (`eixo(janela)`). Confirmar que a sub-linha usa a mesma janela da unidade.

- [ ] **Step 3: CSS da sub-linha**

`horarios.css`:

```css
.hg-sublinha { margin-top: 2px; padding-top: 4px; border-top: 1px dashed var(--border); }
.hg-sub-rotulo { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; text-align: center; margin-bottom: 2px; }
```

Medir em 375px - a faixa extra só existe no dia com escala fixa.

- [ ] **Step 4: D9 - marcador na grade mensal do Calendário**

`calendario.view.js`: em `carregar()`, além de `getCalendarioMes`, carregar `getEscalasRede(primeiroDia, ultimoDia)` do mês e montar `escalasDoMes = { [iso]: escala }` (só ≠ 'normal'). `getEscalas()` para os rótulos. Em `pintar()`, na célula:

```js
${escalasDoMes[iso] ? `<span class="cal-escala tag">${esc(rotulaEscala(escalasDoMes[iso], catalogoCal))}</span>` : ''}
```

Import `getEscalasRede` já está? (`calendario.view.js` importa de `calendario.model.js`). `rotulaEscala`/`getEscalas` de `horarios/escalas.model.js` - import module→module OK. Degradação: `getEscalasRede` falha → `escalasDoMes = {}` → grade como hoje.

`calendario.css`: `.cal-escala { display: inline-block; font-size: 9.5px; padding: 0 4px; margin-top: 2px; }`.

- [ ] **Step 5: `doc: true` + `docs/modulos/horarios.md`**

`horarios/module.js`: `doc: true,`.

`docs/modulos/horarios.md` - espinha de `.claude/rules/documentacao.md`. Cobrir: as duas visões (por escola / por servidor); montar a jornada semanal numa gaveta; por que jornada é bloco e não entrada/saída; **8h/dia é erro, 6h contínuas é aviso** (o que bloqueia vs. o que só marca); a cobertura da escola (varia por tipo, configurável); o TDC como escala e o dia da semana; "copiar para todos os dias"; a equipe gestora nas configurações. Carimbo: `> Atualizado na versão 0.20.0.`

- [ ] **Step 6: Versão + CHANGELOG**

`0.19.0` → `0.20.0`.

```markdown
## [0.20.0] - 2026-09-06

### Adicionado
- A jornada dos dias de **TDC** aparece agora na mesma grade da semana, como uma
  faixa abaixo do dia, em vez de trocar a grade inteira. E o TDC passou a ter
  dia da semana: a escala aparece na jornada mesmo antes de o calendário do ano
  ser lançado.
- No Calendário Escolar, a grade do mês mostra qual escala vale em cada dia.
- Na jornada, um botão "copiar para todos os dias" repete o horário de um dia
  nos outros.

### Alterado
- A janela de cobertura de cada escola passou a depender do tipo (CEI, EMEF,
  EMEF com EJA…), configurável pela Gerência. O padrão continua 07:00–18:20.
- "Equipe gestora" saiu da barra do módulo e virou uma configuração.
- Leitura da grade: o eixo mostra "07h" e os dias aparecem em maiúsculas.
- No Calendário, remover uma data de TDC é um botão de excluir, não uma opção
  escondida num menu.
```

- [ ] **Step 7: Verificação final (controlador)**

Browser (patch dev-local): grade "Por escola" com uma escala de dia fixo em uso → a sub-faixa aparece só naquele dia, rotulada; o chip daquela escala sumiu; um servidor com 07–13 normal e 07–11 no TDC **não** recebe aviso de sobreposição; a tira de cobertura ignora o TDC. Calendário → Grade → um dia de TDC mostra a tag da escala. 375px: a grade não estoura. Reverter.

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py` (checagem 11 verde).

- [ ] **Step 8: Commit e push**

```bash
git add src/modules/horarios/ src/modules/calendario/ docs/modulos/horarios.md src/core/config.js CHANGELOG.md
git commit -m "feat(horarios): TDC como sub-linha da grade; escala na grade mensal do calendario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin dev
```

- [ ] **Step 9: Pendências para o André**

- **Rodar a migration 027** no SQL Editor (depois da 025/026).
- Configurar as janelas de cobertura por tipo e os dias de escala nas configurações de Horários.
- Validar logado: sub-linha de TDC na grade, cobertura por tipo, calendário mensal com escala, os quatro ajustes de leitura.

---

## Self-Review

**Spec coverage:**
- D1 (busca elástica) → Task 1 Step 1. ✔
- D2 (Equipe gestora → painel) → Task 2. ✔
- D3 (cobertura por tipo; 3 funções puras parametrizadas; testes com 2 janelas) → Task 3. ✔
- D4 (`escala_tipo.dia_semana`; migration 027; união das 3 origens) → Task 5 Steps 1-4. ✔
- D5 (jornada de dia fixo mostra 1 dia; blocos órfãos avisados, não apagados) → Task 5 Step 5. ✔
- D6 (sub-linha na grade; chip some; validação por escala; cobertura do dia regular; texto "cumpre a normal") → Task 6 Step 1. ✔
- D7 (eixo `07h`; dias em caixa alta) → Task 1 Step 2. ✔
- D8 ("Sem escala" → excluir na visão Rede; visão Escola intacta) → Task 1 Step 3. ✔
- D9 (escala na grade mensal do Calendário) → Task 6 Step 4. ✔
- D10 (copiar para todos os dias) → Task 4. ✔
- D11 (modal de tipos no padrão + excluir tipo não usado) → Task 1 Step 4. ✔
- Critérios 1-17 → Tasks 1-6 + verificações.

**Placeholder scan:** sem TBD. As sub-linhas (Task 6 Step 1) e os painéis de config (Tasks 3, 5) têm o mecanismo descrito por inteiro; alguns HTML exatos são "seguir o padrão de X" com X apontado. `horarios.md` é redação guiada por tópicos.

**Type consistency:** `janela = { ini, fim }` (minutos) - mesma forma em `grade.model.js` (Task 3 Step 2), `janelaDaUnidade` (Task 3 Step 3), `grade.js`/`por-escola.js` (Task 3 Step 4). `escalasParaJornada({ emUsoNoAno, blocosDoServidor, catalogo })` - Task 5 Step 2 define, Task 5 Steps 4/6 usam. `catalogo` traz `dia_semana` em toda leitura pós-Task-5. `pintarCargosGestao(box)` - Task 2 Step 1 define, `horarios.config.js` (Task 2 Step 2) importa.

**Risco de tamanho (R11):** `por-escola.js` (356) e `jornada.js` (245) crescem. Tasks 5 e 6 têm passo explícito de mover HTML para `grade.js` se passar de 400. `grade.js` (167) tem folga.
