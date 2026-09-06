# Ajuda por módulo (Bloco B) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um módulo Ajuda com tutoriais em Markdown, um por módulo, visíveis conforme a permissão; um botão de ajuda na barra de ações do módulo, à esquerda da engrenagem.

**Architecture:** Tutoriais são `.md` em `docs/modulos/<id>.md`, servidos estáticos e convertidos no navegador por um leitor próprio (`modules/ajuda/markdown.js`, subconjunto fechado, escapa antes de formatar). O módulo Ajuda é agregador (tela, sem model, sem banco). O manifesto ganha `doc: true`; o roteador (Bloco A já criou a barra) acrescenta o botão de ajuda para quem declara `doc`. `docs` passa a se chamar "Documentação técnica". Uma regra de manutenção + a checagem 11 do verificador cobram o tutorial que envelhece.

**Tech Stack:** JS ES modules puro, sem build, sem dependência. `node --test`. `fetch()` de arquivo estático.

**Spec:** `docs/superpowers/specs/2026-09-05-ajuda-por-modulo-design.md` (que atualiza `2026-08-25-ajuda-documentacao-por-modulo-design.md` - o essencial de lá vale, o que muda está no § 2 da nova).

## Global Constraints

- PT-BR em código, comentário, commit e interface.
- Branch `dev`. Commits frequentes. Push ao fechar.
- **R5:** o texto do `.md` é escapado **antes** de qualquer conversão; só tags que o próprio leitor gera existem no resultado.
- **R7:** nenhum dado real nos tutoriais - "Escola Exemplo", `nome@exemplo.com`, `(00) 00000-0000`. `check_pii` varre `docs/`.
- Kernel nunca importa `modules/` (o botão de ajuda no roteador navega por hash, não importa nada).
- Sem build, sem dependência nova. Leitor de Markdown = subconjunto fechado (§ 3.1 da spec de 25/08).
- Agregador: Ajuda não tem model, não chama `sb()`.
- Ao fechar: `CONFIG.versao` MINOR (módulo novo) + `CHANGELOG.md` (texto para quem usa).
- `python .claude/scripts/verificar_arquitetura.py` sem violações (incluindo a checagem 11 nova); `node --test tests/*.mjs` sem falhas.

---

## Contexto verificado

- **Bloco A já entregou** `.mod-wrap` > `.mod-acoes` + `#mod-view` no roteador, e `montarAcoesModulo(mod, nv)` que monta a engrenagem para quem tem `mod.config`. Este bloco acrescenta o botão de ajuda no mesmo lugar, **antes** da engrenagem (ordem fixa: ajuda à esquerda, engrenagem à direita).
- `router.js` `route()`: `params = new URLSearchParams(hash.split('?')[1] || '')` já existe; a view de Ajuda recebe `ctx.params` e lê `params.get('m')`.
- `registry.js`: `chavePerm(m) = m.perm || m.id`; `MODULOS` array; `GRUPOS` tem `ajuda` (rótulo "Documentação") - onde `docs` já vive.
- `permissoes.js`: `nivel(m)`, `OCULTO`. `meu_mapa_permissoes()` (migration 021/026) - para Ajuda ser de todos, entra no objeto hardcoded como `meus_dados`/`configuracoes`.
- **Migration 026 ainda NÃO foi aplicada pelo André.** Editar `026_configuracoes.sql` para incluir `"ajuda":"escrita"` nos dois objetos hardcoded de `meu_mapa_permissoes()` é seguro (é `create or replace`, idempotente) - avisar para re-rodar se já tiver rodado.
- `docs/module.js`: `id: 'docs'`, `nome: 'Documentação'`, `navNome: 'Docs'`, `grupo: 'ajuda'`. Sem preset em nenhum papel → só `is_admin()` enxerga.
- `icones.js`: tem `info` (círculo + "i"). Falta um `ajuda` (círculo + "?"). Traçado do Feather `help-circle`.
- `verificar_arquitetura.py`: 10 checagens, dict `TITULOS`, `main()` chama `check_*()` em sequência. `check_pii()` já varre `docs/`. Importa só `os, re, sys` - a checagem 11 acrescenta `subprocess` (para `git log -1 --format=%ct`).
- `styles/main.css`: lista de `@import` por módulo; a checagem 10 exige o `@import` para todo `.css` de módulo.
- `CONFIG.versao` após o Bloco A: `0.15.0`.
- `feedback.js`: `emptyState(icoHtml, titulo, texto)`, `loading()`, `erroBox(err)`.

---

## Task 1: O leitor de Markdown

**Files:**
- Create: `src/modules/ajuda/markdown.js`
- Test: `tests/markdown.test.mjs`

**Interfaces:**
- Produces: `markdownParaHtml(texto: string): string` - HTML seguro (só tags geradas pelo leitor).

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/markdown.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownParaHtml } from '../src/modules/ajuda/markdown.js';

test('escapa HTML antes de formatar - <script> vira texto', () => {
  const html = markdownParaHtml('um <script>alert(1)</script> perdido');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('títulos # a ###', () => {
  const h = markdownParaHtml('# Um\n## Dois\n### Três');
  assert.match(h, /<h1[^>]*>Um<\/h1>/);
  assert.match(h, /<h2[^>]*>Dois<\/h2>/);
  assert.match(h, /<h3[^>]*>Três<\/h3>/);
});

test('ênfase: forte, itálico e código inline', () => {
  const h = markdownParaHtml('isto é **forte**, isto *fraco* e isto `cod`');
  assert.match(h, /<strong>forte<\/strong>/);
  assert.match(h, /<em>fraco<\/em>/);
  assert.match(h, /<code>cod<\/code>/);
});

test('lista não ordenada e ordenada', () => {
  assert.match(markdownParaHtml('- a\n- b'), /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(markdownParaHtml('1. a\n2. b'), /<ol><li>a<\/li><li>b<\/li><\/ol>/);
});

test('tabela GFM', () => {
  const h = markdownParaHtml('| A | B |\n|---|---|\n| 1 | 2 |');
  assert.match(h, /<table>/);
  assert.match(h, /<th>A<\/th>/);
  assert.match(h, /<td>1<\/td>/);
});

test('citação vira bloco destacado', () => {
  assert.match(markdownParaHtml('> atenção aqui'), /<blockquote>[\s\S]*atenção aqui[\s\S]*<\/blockquote>/);
});

test('bloco de código cercado por três crases', () => {
  const h = markdownParaHtml('```\nlinha1\nlinha2\n```');
  assert.match(h, /<pre><code>linha1\nlinha2\n<\/code><\/pre>/);
  // dentro do bloco, marcação não é interpretada
  assert.doesNotMatch(markdownParaHtml('```\n**x**\n```'), /<strong>/);
});

test('link [texto](url) - só http(s) e hash', () => {
  assert.match(markdownParaHtml('[abrir](https://exemplo.com)'), /<a href="https:\/\/exemplo\.com"[^>]*>abrir<\/a>/);
  assert.match(markdownParaHtml('[ir](#/servidores)'), /<a href="#\/servidores">ir<\/a>/);
  // javascript: é neutralizado
  assert.doesNotMatch(markdownParaHtml('[x](javascript:alert(1))'), /href="javascript/);
});

test('régua ---', () => {
  assert.match(markdownParaHtml('a\n\n---\n\nb'), /<hr\s*\/?>/);
});

test('parágrafo simples', () => {
  assert.match(markdownParaHtml('uma frase solta'), /<p>uma frase solta<\/p>/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/markdown.test.mjs` → FAIL (módulo ausente).

- [ ] **Step 3: Escrever `src/modules/ajuda/markdown.js`**

```js
// ============================================================
// FundHub - modules/ajuda/markdown.js
// Leitor de um SUBCONJUNTO fechado de Markdown, para os tutoriais.
// O hub não tem build nem pode ganhar dependência - e o que os
// tutoriais usam cabe aqui.
//
// SEGURANÇA (R5): o texto é escapado ANTES de qualquer conversão.
// Só as tags que este arquivo gera existem no resultado - um `.md`
// com <script> aparece como texto. Escapar primeiro, formatar depois.
//
// Suportado: # a ###, **forte**, *ênfase*, `código`, listas - e 1.
// (um nível), tabelas GFM, > citação, ``` cerca, [texto](url), ---.
// Fora: HTML cru (escapado), imagens, aninhamento profundo, notas.
// ============================================================

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Inline: aplicado sobre texto JÁ ESCAPADO. `código` primeiro, para o
// conteúdo dele não sofrer as outras regras.
function inline(txt) {
  const trechos = [];
  let s = txt.replace(/`([^`]+)`/g, (_, c) => {
    trechos.push(`<code>${c}</code>`);
    return ` ${trechos.length - 1} `;
  });
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, texto, url) => {
      // Só http(s) e hash interno; qualquer outra coisa vira texto puro.
      const limpa = url.trim();
      if (/^(https?:\/\/|#\/|#)/.test(limpa)) {
        const externo = limpa.startsWith('http');
        return `<a href="${limpa}"${externo ? ' target="_blank" rel="noopener"' : ''}>${texto}</a>`;
      }
      return texto;
    });
  return s.replace(/ (\d+) /g, (_, i) => trechos[Number(i)]);
}

export function markdownParaHtml(texto) {
  const linhas = esc(String(texto || '')).split('\n');
  const out = [];
  let i = 0;

  const fechaLista = (tag) => { if (tag) out.push(`</${tag}>`); };

  while (i < linhas.length) {
    let l = linhas[i];

    // Bloco de código cercado.
    if (l.trimStart().startsWith('```')) {
      const corpo = [];
      i++;
      while (i < linhas.length && !linhas[i].trimStart().startsWith('```')) {
        corpo.push(linhas[i]); i++;
      }
      i++; // pula o fechamento
      out.push(`<pre><code>${corpo.join('\n')}\n</code></pre>`);
      continue;
    }

    // Régua.
    if (/^\s*---\s*$/.test(l)) { out.push('<hr />'); i++; continue; }

    // Título.
    const th = l.match(/^(#{1,3})\s+(.*)$/);
    if (th) { const n = th[1].length; out.push(`<h${n}>${inline(th[2].trim())}</h${n}>`); i++; continue; }

    // Citação (uma ou mais linhas iniciadas por >).
    if (/^\s*&gt;\s?/.test(l)) {
      const corpo = [];
      while (i < linhas.length && /^\s*&gt;\s?/.test(linhas[i])) {
        corpo.push(linhas[i].replace(/^\s*&gt;\s?/, '')); i++;
      }
      out.push(`<blockquote>${inline(corpo.join(' '))}</blockquote>`);
      continue;
    }

    // Tabela GFM: linha com | seguida de linha separadora |---|.
    if (l.includes('|') && i + 1 < linhas.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(linhas[i + 1]) && linhas[i + 1].includes('-')) {
      const celulas = (linha) => linha.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const cab = celulas(l);
      i += 2;
      const corpo = [];
      while (i < linhas.length && linhas[i].includes('|') && linhas[i].trim()) {
        corpo.push(celulas(linhas[i])); i++;
      }
      out.push('<table><thead><tr>' + cab.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        corpo.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>');
      continue;
    }

    // Listas (um nível).
    const li = l.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const ordenada = /\d/.test(li[1]);
      const tag = ordenada ? 'ol' : 'ul';
      out.push(`<${tag}>`);
      while (i < linhas.length) {
        const m = linhas[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (!m) break;
        out.push(`<li>${inline(m[2].trim())}</li>`);
        i++;
      }
      fechaLista(tag);
      continue;
    }

    // Linha em branco.
    if (!l.trim()) { i++; continue; }

    // Parágrafo (junta linhas consecutivas de texto).
    const par = [l];
    i++;
    while (i < linhas.length && linhas[i].trim() &&
           !/^\s*(#{1,3}\s|[-*]\s|\d+\.\s|&gt;|```|---\s*$)/.test(linhas[i]) &&
           !linhas[i].includes('|')) {
      par.push(linhas[i]); i++;
    }
    out.push(`<p>${inline(par.join(' '))}</p>`);
  }

  return out.join('');
}
```

- [ ] **Step 4: Rodar os testes**

Run: `node --test tests/markdown.test.mjs`
Expected: PASS (11 testes). Ajustar as regex do leitor se algum caso falhar - o teste é o contrato.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ajuda/markdown.js tests/markdown.test.mjs
git commit -m "feat(ajuda): leitor de um subconjunto fechado de Markdown, escapa antes de formatar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Ícone `ajuda` + botão de ajuda no roteador

**Files:**
- Modify: `src/shared/ui/icones.js`
- Modify: `tests/icones.test.mjs`
- Modify: `src/core/router.js` (`montarAcoesModulo`)

**Interfaces:**
- Consumes: `mod.doc` (booleano opcional no manifesto).
- Produces: `ico('ajuda')`; a barra de ações ganha um `<a class="mod-acao" href="#/ajuda?m=<id>">` **antes** da engrenagem para todo módulo com `doc === true` e `nivel !== OCULTO`.

- [ ] **Step 1: Ícone**

`tests/icones.test.mjs`: acrescentar `'ajuda'` ao array `nomes` da checagem "todos os icones do conjunto produzem svg" e um teste:

```js
test('tem o traçado de ajuda (interrogação em círculo)', () => {
  assert.ok(TEM_ICONE('ajuda'));
  assert.match(ico('ajuda'), /^<svg /);
});
```

`src/shared/ui/icones.js`, dentro de `TRACOS` (Feather `help-circle`):

```js
  ajuda: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
```

Run: `node --test tests/icones.test.mjs` → PASS.

- [ ] **Step 2: Botão de ajuda no `montarAcoesModulo`**

Em `src/core/router.js`, a função `montarAcoesModulo(mod, nv)` (criada no Bloco A). Hoje ela só monta a engrenagem. Reescrever para montar ajuda **primeiro**, engrenagem depois:

```js
// A barra de ações do módulo: ajuda à esquerda, engrenagem à direita -
// ordem fixa em toda tela. Ajuda NAVEGA (tutorial é texto para ler com
// calma); engrenagem abre gaveta (configurar é interrupção curta).
async function montarAcoesModulo(mod, nv) {
  const barra = document.getElementById('mod-acoes');
  if (!barra || nv === OCULTO) return;

  if (mod.doc === true) {
    barra.insertAdjacentHTML('beforeend',
      `<a class="mod-acao" href="#/ajuda?m=${encodeURIComponent(mod.id)}" aria-label="Ajuda de ${esc(mod.nome)}">${ico('ajuda')}</a>`);
  }

  if (typeof mod.config === 'function') {
    barra.insertAdjacentHTML('beforeend',
      `<button type="button" class="mod-acao" id="mod-cfg" aria-label="Configurações de ${esc(mod.nome)}">${ico('config')}</button>`);
    document.getElementById('mod-cfg').addEventListener('click', async () => {
      const { abrirPainelConfig } = await import('../modules/configuracoes/painel.js');
      abrirPainelConfig(mod);
    });
  }
}
```

(`.mod-acao` já estiliza `<button>`; um `<a>` com a mesma classe herda tudo - conferir no CSS que o seletor não é `button.mod-acao`. Se for, generalizar para `.mod-acao`.)

- [ ] **Step 3: Conferir o CSS de `.mod-acao`**

`src/styles/components.css`: `.mod-acao` (Bloco A) usa `display: inline-flex` etc. - já funciona para `<a>`. Acrescentar só `text-decoration: none;` para o link não sublinhar.

- [ ] **Step 4: Sanidade + commit**

Run: `node --test tests/*.mjs` e `python .claude/scripts/verificar_arquitetura.py`.

```bash
git add src/shared/ui/icones.js src/core/router.js src/styles/components.css tests/icones.test.mjs
git commit -m "feat(ajuda): botao de ajuda na barra de acoes, a esquerda da engrenagem

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: O módulo Ajuda

**Files:**
- Create: `src/modules/ajuda/module.js`, `src/modules/ajuda/ajuda.view.js`, `src/modules/ajuda/ajuda.css`
- Modify: `src/core/registry.js`, `src/styles/main.css`

**Interfaces:**
- Consumes: `markdownParaHtml` de `./markdown.js`; `MODULOS`, `chavePerm` de `registry.js`; `nivel`, `OCULTO` de `permissoes.js`; `esc` de `dom.js`; `ico`, `emptyState`, `loading`, `erroBox`.
- Produces: rota `#/ajuda`, grupo `ajuda`.

- [ ] **Step 1: Manifesto**

`src/modules/ajuda/module.js`:

```js
// Manifesto do módulo Ajuda (agregador: tela, sem model, sem dados
// próprios). Lista os tutoriais dos módulos que a pessoa enxerga.
// É de todo mundo - entra em meu_mapa_permissoes() como 'escrita'
// para todos (migration 026), como Meus dados e Configurações.
export default {
  id: 'ajuda',
  ico: 'ajuda',
  nome: 'Ajuda',
  desc: 'Como usar cada parte do sistema.',
  navNome: 'Ajuda',
  rota: '#/ajuda',
  grupo: 'ajuda',
  nav: true,
  ativo: true,
  doc: true,
  load: () => import('./ajuda.view.js'),
};
```

- [ ] **Step 2: A tela**

`src/modules/ajuda/ajuda.view.js`:

```js
// ============================================================
// FundHub - modules/ajuda/ajuda.view.js
// Índice + leitor de tutoriais. Sem `?m=` mostra a lista dos módulos
// que a pessoa enxerga e que têm tutorial; com `?m=<id>` abre aquele.
// Um `?m=` de módulo oculto responde como rota inexistente - sem
// confirmar que o módulo existe.
// ============================================================
import { MODULOS, chavePerm } from '../../core/registry.js';
import { nivel, OCULTO } from '../../core/permissoes.js';
import { esc } from '../../shared/dom.js';
import { ico } from '../../shared/ui/icones.js';
import { loading, emptyState } from '../../shared/ui/feedback.js';
import { markdownParaHtml } from './markdown.js';

const comTutorial = () => MODULOS.filter(m =>
  m.doc === true && nivel(chavePerm(m)) !== OCULTO);

export async function render(app, ctx = {}) {
  const alvoId = ctx.params?.get('m') || '';
  const disponiveis = comTutorial();
  const alvo = alvoId ? disponiveis.find(m => m.id === alvoId) : null;

  // ?m= de módulo que a pessoa não enxerga (ou sem tutorial): mesma
  // resposta do roteador para rota inexistente.
  if (alvoId && !alvo) {
    app.innerHTML = `<div class="page-head"><h1>Ajuda</h1></div>` +
      emptyState(ico('perdido', { tam: 32 }), 'Página não encontrada',
        'Não há tutorial para este endereço.');
    return;
  }

  if (!alvo) return pintarIndice(app, disponiveis);
  return pintarTutorial(app, alvo, disponiveis);
}

function pintarIndice(app, disponiveis) {
  app.innerHTML = `
    <div class="page-head">
      <h1>Ajuda</h1>
      <p>Instruções de uso, um tutorial por módulo.</p>
    </div>
    ${disponiveis.length ? `<div class="ajuda-indice">${disponiveis.map(m => `
      <a class="ajuda-tile" href="#/ajuda?m=${encodeURIComponent(m.id)}">
        ${ico(m.ico || 'documento', { tam: 20 })}
        <span>${esc(m.nome)}</span>
      </a>`).join('')}</div>`
    : emptyState(ico('documento', { tam: 32 }), 'Nenhum tutorial disponível',
        'Os módulos que você usa ainda não têm instruções escritas.')}`;
}

async function pintarTutorial(app, mod, disponiveis) {
  app.innerHTML = `
    <div class="page-head">
      <a class="ajuda-voltar" href="#/ajuda">${ico('chevron', { tam: 14 })} Todos os tutoriais</a>
      <h1>Ajuda: ${esc(mod.nome)}</h1>
    </div>
    <article class="ajuda-doc" id="ajuda-doc">${loading()}</article>`;

  const box = document.getElementById('ajuda-doc');
  try {
    const resp = await fetch(`docs/modulos/${mod.id}.md`, { cache: 'no-cache' });
    if (!resp.ok) throw new Error('nao encontrado');
    box.innerHTML = markdownParaHtml(await resp.text());
  } catch {
    box.innerHTML = emptyState(ico('documento', { tam: 32 }), 'Tutorial ainda não disponível',
      'O texto deste módulo ainda não foi publicado.');
  }
}
```

- [ ] **Step 3: CSS**

`src/modules/ajuda/ajuda.css`:

```css
.ajuda-indice { display: grid; grid-template-columns: 1fr; gap: 8px; }
@media (min-width: 560px) { .ajuda-indice { grid-template-columns: 1fr 1fr; } }
.ajuda-tile {
  display: flex; align-items: center; gap: 10px;
  padding: 14px; border: 1px solid var(--border); border-radius: 11px;
  background: var(--surface-2); color: var(--text); text-decoration: none;
}
.ajuda-tile:hover { border-color: var(--border-forte); background: var(--surface-3); }
.ajuda-voltar { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); text-decoration: none; font-size: 13px; margin-bottom: 6px; }
.ajuda-voltar:hover { color: var(--text); }

.ajuda-doc { max-width: 720px; line-height: 1.6; }
.ajuda-doc h1 { font-size: 20px; margin: 24px 0 8px; }
.ajuda-doc h2 { font-size: 16px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border); }
.ajuda-doc h3 { font-size: 14px; margin: 18px 0 6px; }
.ajuda-doc p { margin: 8px 0; }
.ajuda-doc ul, .ajuda-doc ol { margin: 8px 0; padding-left: 22px; }
.ajuda-doc li { margin: 3px 0; }
.ajuda-doc code { background: var(--surface-3); padding: 1px 5px; border-radius: 5px; font-size: 13px; }
.ajuda-doc pre { background: var(--surface-3); padding: 12px; border-radius: 9px; overflow-x: auto; }
.ajuda-doc pre code { background: none; padding: 0; }
.ajuda-doc blockquote {
  margin: 12px 0; padding: 10px 14px; border-left: 3px solid var(--brand);
  background: color-mix(in srgb, var(--brand) 8%, transparent); border-radius: 0 8px 8px 0;
}
.ajuda-doc table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14px; }
.ajuda-doc th, .ajuda-doc td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
.ajuda-doc th { background: var(--surface-2); }
.ajuda-doc hr { border: 0; border-top: 1px solid var(--border); margin: 20px 0; }
.ajuda-doc a { color: var(--brand); }
```

- [ ] **Step 4: Registrar**

`src/core/registry.js`: `import ajuda from '../modules/ajuda/module.js';` e no array `MODULOS`, no grupo `ajuda`, **antes** de `docs`:

```js
  notificacoes, meusDados, configuracoes, usuarios, ajuda, docs,
```

`src/styles/main.css`: `@import url('../modules/ajuda/ajuda.css');`

- [ ] **Step 5: Sanidade + commit**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py`.
**Nota:** a checagem 11 (Task 6) ainda não existe; nesta task o verificador não cobra os `.md`. Mas Ajuda declara `doc: true` sem `docs/modulos/ajuda.md` - o `.md` entra na Task 5, e a checagem 11 na Task 6, então a ordem não trava. Se preferir, criar já um `docs/modulos/ajuda.md` mínimo nesta task e completá-lo na Task 5.

```bash
git add src/modules/ajuda/ src/core/registry.js src/styles/main.css
git commit -m "feat(ajuda): modulo agregador em #/ajuda - indice e leitor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `doc: true` nos módulos estáveis; `docs` vira "Documentação técnica"; migration 026

**Files:**
- Modify: `src/modules/servidores/module.js`, `src/modules/usuarios/module.js`, `src/modules/configuracoes/module.js` (`doc: true`)
- Modify: `src/modules/docs/module.js` (rename)
- Modify: `supabase/migrations/026_configuracoes.sql` (`ajuda` no mapa)

**Interfaces:** nenhuma nova. (`ajuda/module.js` já tem `doc: true` da Task 3.)

- [ ] **Step 1: `doc: true`**

Acrescentar `doc: true,` ao manifesto de `servidores`, `usuarios` e `configuracoes` (perto de `ativo: true`).

**Não** marcar `escolas`, `horarios` nem `dashboard` - essas telas mudam nos Blocos E/F/G, e cada um escreve o seu tutorial e marca `doc: true` no mesmo commit (regra do § 3.5.1 da spec).

- [ ] **Step 2: `docs` renomeado**

`src/modules/docs/module.js`:

```js
  nome: 'Documentação técnica',
  desc: 'Arquitetura, migrations e RLS - para quem mantém o código.',
  navNome: 'Docs técnicos',
```

(manter `id: 'docs'`, rota, grupo, restrição.)

- [ ] **Step 3: `ajuda` no `meu_mapa_permissoes()` da migration 026**

Em `supabase/migrations/026_configuracoes.sql`, os dois fragmentos hardcoded de `meu_mapa_permissoes()`:

```sql
        || '{"usuarios":"escrita","modulos":"escrita","meus_dados":"escrita","configuracoes":"escrita"}'::jsonb
```
→ acrescentar `,"ajuda":"escrita"` antes do `}`.

```sql
        || '{"meus_dados":"escrita","modulos":"leitura","configuracoes":"escrita"}'::jsonb
```
→ idem: `,"ajuda":"escrita"`.

Atualizar o comentário do topo do arquivo para citar `ajuda` junto de `configuracoes`.

- [ ] **Step 4: Sanidade + commit**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py` (a checagem 11 ainda não existe; `check_registro` não cobra `.md`).

```bash
git add src/modules/servidores/module.js src/modules/usuarios/module.js src/modules/configuracoes/module.js src/modules/docs/module.js supabase/migrations/026_configuracoes.sql
git commit -m "feat(ajuda): doc:true em Servidores/Usuarios/Config; docs vira Documentacao tecnica

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Os quatro tutoriais

**Files:**
- Create: `docs/modulos/servidores.md`, `docs/modulos/usuarios.md`, `docs/modulos/ajuda.md`, `docs/modulos/configuracoes.md`

**Interfaces:** nenhuma. Conteúdo estático, servido por `fetch`.

- [ ] **Step 1: `docs/modulos/ajuda.md`**

Seguir a espinha do § 4 da spec. Cobrir: onde ficam as instruções, que cada módulo tem a sua, como pedir correção de um texto (fale com a Gerência). Terminar com `> Atualizado na versão 0.16.0.` (a versão que este bloco vai fechar - conferir no fecho).

- [ ] **Step 2: `docs/modulos/configuracoes.md`**

Cobrir: a diferença entre preferência pessoal (só sua, segue seu login) e configuração da rede (vale para todos, só quem tem escrita muda); por que algumas aparecem desabilitadas; onde encontrar (engrenagem no módulo ou a tela Configurações). Carimbo de versão no fim.

- [ ] **Step 3: `docs/modulos/servidores.md`**

Cobrir (§ 5 da spec de 25/08 + a de 05/09): cadastrar uma pessoa; vincular a uma escola ou à SME; editar e encerrar um vínculo; **encerrar ≠ excluir** (encerrar preenche o Término e preserva o histórico; excluir apaga); cargo e local de trabalho vêm do registro de designação, não do cadastro da pessoa. Passo a passo numerado, nomeando os botões. "Regras que o sistema aplica": término antes do início é erro; documento fora do padrão é aviso. "Ligações": afastamentos e horários apontam para o servidor. Sem dado real. Carimbo de versão.

> Nota: o Bloco J renomeia "vínculo"→"local de trabalho". Este tutorial já usa "local de trabalho" onde couber e "registro de designação" para a ação - assim ele não precisa ser reescrito quando o J entrar. Se o J mudar o nome de um botão, o J atualiza este `.md` no mesmo commit.

- [ ] **Step 4: `docs/modulos/usuarios.md`**

Cobrir: a allowlist (só quem está cadastrado entra, mesmo com e-mail institucional); os quatro níveis por módulo (oculto / próprios / leitura / escrita) e o que cada um permite; segmentos de atuação (conveniência para pré-filtrar telas, não restrição - quem restringe é o banco); o histórico registra toda alteração de cadastro e não se apaga. Carimbo de versão.

- [ ] **Step 5: Varredura de dado real**

Run: `python .claude/scripts/verificar_arquitetura.py --so-pii`
Expected: sem PII. Reler cada `.md` procurando nome de pessoa, e-mail institucional real, telefone real, nº de processo.

- [ ] **Step 6: Verificação no browser (controlador)**

Patch dev-local. `#/ajuda` → índice com Servidores, Usuários, Ajuda, Configurações. Clicar em cada → o tutorial renderiza (títulos, listas, tabelas, citações, código). `#/ajuda?m=escolas` → "Página não encontrada" (escolas não tem `doc`). Injetar um `.md` de teste com `<script>alert(1)</script>` e confirmar que aparece como texto. Reverter o patch.

- [ ] **Step 7: Commit**

```bash
git add docs/modulos/
git commit -m "docs(ajuda): tutoriais de Servidores, Usuarios, Ajuda e Configuracoes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Checagem 11 + regra de manutenção

**Files:**
- Modify: `.claude/scripts/verificar_arquitetura.py`
- Create: `.claude/rules/documentacao.md`
- Modify: `CLAUDE.md`

**Interfaces:** nenhuma de código.

- [ ] **Step 1: `check_documentacao()` no verificador**

Em `.claude/scripts/verificar_arquitetura.py`:

- no topo, `import subprocess`.
- `TITULOS[11] = 'R--  tutorial por modulo'`.
- em `main()`, chamar `check_documentacao()` depois de `check_registro()`.
- a função:

```python
# ------------------------------------------------------------------
# 11. Tutorial por modulo (spec 2026-09-05-ajuda-por-modulo)
# ------------------------------------------------------------------
def _git_ct(caminho):
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%ct', '--', caminho],
                              cwd=RAIZ, capture_output=True, text=True, timeout=10)
        return int(out.stdout.strip()) if out.stdout.strip() else 0
    except Exception:
        return 0


def check_documentacao():
    modulos_dir = os.path.join(SRC, 'modules')
    docs_dir = os.path.join(RAIZ, 'docs', 'modulos')
    com_doc = set()
    for mod in sorted(os.listdir(modulos_dir)):
        manifesto = os.path.join(modulos_dir, mod, 'module.js')
        if not os.path.isfile(manifesto):
            continue
        if re.search(r'\bdoc\s*:\s*true\b', ler(manifesto)):
            com_doc.add(mod)
            md = os.path.join(docs_dir, mod + '.md')
            if not os.path.isfile(md):
                add('BLOQUEIA', 11, manifesto, 0,
                    'modulo declara doc:true mas nao ha docs/modulos/%s.md' % mod)
            else:
                if _git_ct(os.path.join('src', 'modules', mod)) > _git_ct(os.path.join('docs', 'modulos', mod + '.md')):
                    add('AVISO', 11, md, 0,
                        'codigo de src/modules/%s/ mais novo que o tutorial - revisar' % mod)

    if os.path.isdir(docs_dir):
        for f in sorted(os.listdir(docs_dir)):
            if not f.endswith('.md'):
                continue
            mod = f[:-3]
            if mod not in com_doc:
                add('BLOQUEIA', 11, os.path.join(docs_dir, f), 0,
                    'docs/modulos/%s.md sem modulo correspondente com doc:true' % mod)
```

- [ ] **Step 2: Rodar o verificador**

Run: `python .claude/scripts/verificar_arquitetura.py`
Expected: sem bloqueantes (os 4 `.md` da Task 5 existem para os 4 módulos `doc: true`). Se aparecer aviso (c) de defasagem, é esperado logo após criar - some no próximo commit que tocar o `.md`.

- [ ] **Step 3: `.claude/rules/documentacao.md`**

```markdown
# Documentação de uso - manter o tutorial vivo

Módulo com `doc: true` no manifesto tem um `docs/modulos/<id>.md` - o tutorial
que a pessoa lê em `#/ajuda`.

## A regra

Mexeu na tela, no fluxo ou numa regra de negócio de um módulo com `doc: true`?
O `docs/modulos/<id>.md` correspondente é atualizado **no mesmo commit**.

- Layout que não muda o que a pessoa faz **não conta**.
- Campo novo, botão novo, passo a mais, regra que passou a bloquear, texto de
  botão que mudou - **conta**.

## Forma

Espinha fixa (previsibilidade > criatividade num texto de referência):

```
# <Nome do módulo>
> Uma frase dizendo para que serve.
## O que dá para fazer aqui
## Quem pode o quê
## Passo a passo
### <Tarefa>
## Regras que o sistema aplica
## Ligações com outros módulos
## Perguntas frequentes
> Atualizado na versão X.Y.Z.
```

- Escrito para **quem usa**: nenhum nome de arquivo, tabela, função ou coluna.
- Passo a passo numerado e literal, nomeando o botão como ele aparece.
- "Regras que o sistema aplica" separa o que **bloqueia** (erro) do que só
  **avisa**, com o motivo.
- Nenhum dado real (R7): "Escola Exemplo", `nome@exemplo.com`, `(00) 00000-0000`.
- O carimbo final é a versão em que o texto foi revisto pela última vez.

## O que o verificador cobra (checagem 11)

| | Situação | Severidade |
|---|---|---|
| a | `doc: true` sem `docs/modulos/<id>.md` | bloqueia |
| b | `.md` órfão (sem módulo `doc: true`) | bloqueia |
| c | código do módulo mais novo que o `.md` | aviso |
```

- [ ] **Step 4: Linha em `CLAUDE.md`**

Na tabela "Regras detalhadas - consultar sob demanda":

```markdown
| tela, fluxo ou regra de um módulo com tutorial | `.claude/rules/documentacao.md` |
```

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/verificar_arquitetura.py .claude/rules/documentacao.md CLAUDE.md
git commit -m "chore(verificador): checagem 11 - tutorial por modulo; regra documentacao.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Fechar a entrega

**Files:**
- Modify: `src/core/config.js`, `CHANGELOG.md`
- Modify: os 4 `.md` (carimbo de versão) se a versão final divergir do que ficou escrito na Task 5

- [ ] **Step 1: Versão**

`src/core/config.js`: `0.15.0` → `0.16.0` (MINOR - módulo novo).

- [ ] **Step 2: Conferir o carimbo dos tutoriais**

Garantir que os 4 `.md` terminam com `> Atualizado na versão 0.16.0.`

- [ ] **Step 3: CHANGELOG**

```markdown
## [0.16.0] - 2026-09-05

### Adicionado
- Módulo **Ajuda** (em "Documentação") com um tutorial de uso por módulo, e um
  botão de ajuda no topo de cada tela que tem tutorial. Começa com Servidores,
  Usuários, Configurações e a própria Ajuda. O que antes era "Documentação"
  passou a se chamar "Documentação técnica" - é a parte escrita para quem
  mantém o sistema.
```

- [ ] **Step 4: Verificação final**

Run: `node --test tests/*.mjs`; `python .claude/scripts/verificar_arquitetura.py` (sem bloqueantes; a checagem 11 deve estar verde).

- [ ] **Step 5: Commit e push**

```bash
git add src/core/config.js CHANGELOG.md docs/modulos/
git commit -m "chore: versao 0.16.0 e fecha o bloco de ajuda por modulo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin dev
```

- [ ] **Step 6: Pendências para o André**

- **Re-rodar a migration 026** no SQL Editor (agora inclui `ajuda` no mapa) - se já tinha rodado a versão do Bloco A, rodar de novo (é idempotente).
- Validar logado: `#/ajuda` lista só o que a pessoa vê; o botão de ajuda aparece no topo de Servidores/Usuários/Configurações; `docs` aparece como "Docs técnicos" só para admin.

---

## Self-Review

**Spec coverage (nova, 2026-09-05):**
- § 2 (botão na barra de ações, não no topo; ajuda à esquerda da engrenagem; ajuda navega) → Task 2. ✔
- § 3.1 (Markdown de verdade, leitor próprio, subconjunto fechado, escapa antes) → Task 1. ✔
- § 3.2 (`doc: true`; roteador inclui o botão; navega para `#/ajuda?m=<id>`) → Task 2, Task 4. ✔
- § 3.3 (permissão: ver o módulo basta; `?m=` de oculto responde como inexistente; Ajuda é de todos) → Task 3 (`comTutorial`, ramo `!alvo`), Task 4 Step 3. ✔
- § 3.4 (`docs` → "Documentação técnica"/"Docs técnicos", segue admin) → Task 4 Step 2. ✔
- § 3.5 (regra de trabalho; checagem 11 parte c; carimbo de versão) → Task 6, Task 5 (carimbo), Task 7 Step 2. ✔
- § 3.6 (checagem 11, três partes) → Task 6 Step 1. ✔
- § 4 (forma do tutorial) → Task 5 + `documentacao.md` (Task 6 Step 3). ✔
- § 5 (4 tutoriais: servidores, usuarios, ajuda, configuracoes) → Task 5. ✔ (escolas/horarios/dashboard ficam para E/F/G - Task 4 Step 1 não marca `doc` neles.)
- § 6 arquivos → cobertos.
- Critérios 1-12 → Tasks 1-7 + verificação da Task 5 Step 6.

**Placeholder scan:** sem TBD. O leitor de Markdown está completo (Task 1 Step 3). Os tutoriais (Task 5) são descritos por tópicos obrigatórios, não transcritos - é conteúdo de redação, guiado pela espinha do § 4; cada `.md` é revisável em diff e coberto pela varredura de PII.

**Type consistency:** `markdownParaHtml(texto)` produzido na Task 1, consumido na Task 3. `mod.doc === true` checado igual em `router.js` (Task 2) e `ajuda.view.js` (Task 3). `comTutorial()` usa `nivel(chavePerm(m)) !== OCULTO` - a mesma expressão do roteador e do menu.
