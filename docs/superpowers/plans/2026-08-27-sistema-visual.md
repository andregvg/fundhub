# Sistema Visual - Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar os 199 emojis por um conjunto de ícones SVG, adotar o `.switch` onde ainda há checkbox/radio cru, criar um sistema de mensagens semântico no topo da tela, eliminar o travessão do repositório e acrescentar o botão de atualizar no cabeçalho.

**Architecture:** Quatro vocabulários novos no kernel (`shared/ui/icones.js`, `shared/cache.js`, `toast.js` reescrito, `vazio()` em `shared/dom.js`) e depois a adoção deles módulo a módulo. Nada de framework, nada de dependência: o conjunto de ícones é um objeto de strings SVG e o registro de caches é um `Set` de funções.

**Tech Stack:** JavaScript ES modules puro, sem build. CSS com custom properties. Testes em `.mjs` rodados por `node`, usando só `node:assert` e `node:test` da biblioteca padrão.

**Spec:** [`docs/superpowers/specs/2026-08-27-sistema-visual-design.md`](../specs/2026-08-27-sistema-visual-design.md)

## Global Constraints

- **PT-BR** em código, comentário, commit e interface.
- **Branch `dev`.** Nunca commitar na `main`.
- **Sem npm, sem bundler, sem dependência nova.** O que está no repositório é o que roda no navegador.
- **Nenhuma cor literal em `src/modules/**`** - nem `#hex`, nem `rgb()`, nem `hsl()`. Só `var(--token)`. Tokens vivem em `src/styles/tokens.css`, sempre nas duas variantes (clara e escura).
- **Todo valor vindo do banco passa por `esc()`** antes de entrar em template literal.
- **Nenhum dado real de pessoa ou escola** em código, comentário, exemplo ou fixture. Placeholders inventados: `(00) 00000-0000`, `nome@exemplo.com`, `Escola Exemplo`.
- **O kernel (`core/` + `shared/`) nunca importa `modules/` nem `shell/`.**
- **Ícones sempre `aria-hidden="true"`** - o significado vem do texto ao lado ou do `aria-label` do botão.
- **Antes de cada commit:** `python .claude/scripts/verificar_arquitetura.py` sem novas violações, e `git diff --cached` lido à procura de dado real.
- **Nenhum código novo nasce com `—`.** Ao transcrever os blocos deste plano, escreva `-` em todo comentário e string, inclusive nos blocos das Tasks 8 e 9, que rodam DEPOIS da varredura da Task 7. Se elas reintroduzirem travessão, a verificação final falha.
- **Cortes responsivos:** 560 · 720 · 900 · 1100px. Base é o celular; `@media (min-width: …)` acrescenta, nunca subtrai.
- **Testes:** `node --test` (sem argumento) roda tudo - o Node varre a partir do diretorio corrente. **Nao** use `node --test`: nesta maquina (Node 24, Windows) o Node trata o caminho como modulo e falha com `MODULE_NOT_FOUND`. Rodar um arquivo so continua valendo: `node --test tests/icones.test.mjs`. Arquivo por assunto, `.test.mjs`, só `node:test` e `node:assert/strict`.
- **Só lógica pura é testada por `node`.** Os models importam limpo fora do navegador (`core/supabase.js` só toca em `window` dentro de `sb()`, nunca na carga) - isso foi verificado antes deste plano ser escrito e **precisa continuar valendo**: nenhum módulo pode passar a tocar em `window` ou `document` em tempo de carga. O que depende de DOM é verificado no navegador, com o patch de dev-local, e o patch é **revertido antes de commitar**.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/shared/ui/icones.js` | **novo.** Traçados SVG + `ico(nome, opts)`. Sem estado, sem DOM. |
| `src/shared/cache.js` | **novo.** Registro de funções de invalidação de cache. ~20 linhas. |
| `src/shared/ui/toast.js` | Reescrito: vocabulário semântico, fila, topo à direita. |
| `src/shared/dom.js` | Ganha `vazio(msg)`. |
| `src/shared/ui/phones.js` | Radio de "principal" ganha aparência de switch; primeiro vira principal. |
| `src/shell/chrome.js` | Botão Atualizar + carimbo; `USER_SVG` sai daqui. |
| `src/core/router.js` | Ganha `recarregarRota()`. |
| `src/styles/tokens.css` | `--topbar-h`, `--sucesso-bg`, `--atencao-bg`, `--erro-bg`, `--info-bg`. |
| `src/styles/components.css` | `.ico`, `.vazio`, `.switch.radio`, bloco de toast. |
| `src/styles/base.css` | `.topbar` ganha `min-height`. |
| `tests/icones.test.mjs` | **novo.** Contrato de `ico()`. |
| `tests/toast.test.mjs` | **novo.** Normalização de tipo e política de duração. |
| `tests/cache.test.mjs` | **novo.** Registro e limpeza. |

---

## Task 1: Conjunto de ícones

**Files:**
- Create: `src/shared/ui/icones.js`
- Create: `tests/icones.test.mjs`
- Modify: `src/styles/components.css` (acrescentar `.ico`)

**Interfaces:**
- Consumes: nada.
- Produces: `ico(nome: string, opts?: { tam?: number, classe?: string }) => string` (HTML de um `<svg>`); `TEM_ICONE(nome: string) => boolean`.

**Traçados.** Todos vêm do Feather Icons (MIT), grade 24×24, `fill: none`, `stroke-width: 2`, cantos redondos. O objeto `TRACOS` guarda **só o miolo** do SVG - o envelope é montado por `ico()`. Onde este plano não traz o `d` literal, copie o miolo do arquivo correspondente do Feather e confira o desenho no navegador a 16px. **Não invente traçado.**

Mapa completo emoji → nome (é a decisão de nomenclatura; nomes descrevem a coisa, não o desenho):

| Emoji | Nome | Feather |
|---|---|---|
| 🏫 | `escola` | `home` |
| 🏛 | `sede` | `briefcase` |
| 👤 | `servidor` | `user` |
| 👥 | `equipe` | `users` |
| 🕒 | `horario` | `clock` |
| 📅 | `calendario` | `calendar` |
| 🌴 | `afastamento` | `sun` |
| 🚌 | `transporte` | `truck` |
| 📊 | `dashboard` | `bar-chart-2` |
| 🧩 | `modulos` | `grid` |
| 📝 | `ata` | `edit-3` |
| 📋 | `ocorrencia` | `clipboard` |
| 🔬 | `projeto` | `award` |
| 📍 | `visita` | `map-pin` |
| 🔐 | `acesso` | `shield` |
| 🕵 | `auditoria` | `eye` |
| 📖 📗 📚 | `docs` | `book-open` |
| 🔔 | `sino` | `bell` |
| (novo) | `info` | `info` |
| ✎ | `editar` | `edit-2` |
| 🗑 | `excluir` | `trash-2` |
| 🔎 | `buscar` | `search` |
| ➕ | `adicionar` | `plus` |
| ✕ | `fechar` | `x` |
| ✓ | `ok` | `check` |
| ⚠ | `atencao` | `alert-triangle` |
| ⛔ | `erro` | `alert-octagon` |
| 🔒 🚫 | `restrito` | `lock` |
| ☰ | `menu` | `menu` |
| 🧭 | `perdido` | `compass` |
| 📭 | `vazio` | `inbox` |
| ☎ | `fixo` | `phone` |
| 📱 | `celular` | `smartphone` |
| 💬 | `whatsapp` | `message-circle` |
| ✉ | `email` | `mail` |
| 📄 | `documento` | `file-text` |
| 🗄 🗂 | `arquivo` | `archive` |
| 🪪 | `identidade` | `credit-card` |
| 🖨 | `imprimir` | `printer` |
| 🎨 | `tema` | `droplet` |
| 🌙 | `escuro` | `moon` |
| ⭱ | `subir` | `arrow-up` |
| 🎯 | `meta` | `target` |
| 🤝 | `parceria` | `users` |
| 🏗 | `obra` | `tool` |
| 🧸 | `infantil` | `smile` |
| ♿ | `acessibilidade` | `user-check` |
| 🚀 📌 | `destaque` | `bookmark` |

Nomes adicionais que o plano usa mais adiante e que precisam existir já: `atualizar` (`refresh-cw`), `sair` (`log-out`), `chevron` (`chevron-down`), `info` (`info`, usado pelo toast) e `arrastar` (`move`, usado pela legenda da grade no plano B-1). `arrastar` é entrada própria no `TRACOS`, não um apelido de `menu`: apelido faria `ico('arrastar')` devolver string vazia e o ícone sumir em silêncio.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/icones.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ico, TEM_ICONE } from '../src/shared/ui/icones.js';

test('devolve um svg com o tamanho pedido', () => {
  const svg = ico('escola', { tam: 20 });
  assert.match(svg, /^<svg /);
  assert.match(svg, /width="20"/);
  assert.match(svg, /height="20"/);
  assert.match(svg, /viewBox="0 0 24 24"/);
});

test('herda a cor do texto e nunca fixa cor', () => {
  const svg = ico('escola');
  assert.match(svg, /stroke="currentColor"/);
  assert.match(svg, /fill="none"/);
  assert.doesNotMatch(svg, /#[0-9a-fA-F]{3,6}/);
  assert.doesNotMatch(svg, /rgb\(|hsl\(/);
});

test('e sempre decorativo para o leitor de tela', () => {
  assert.match(ico('escola'), /aria-hidden="true"/);
});

test('tamanho padrao e 16', () => {
  assert.match(ico('escola'), /width="16"/);
});

test('aceita classe extra sem perder a classe base', () => {
  const svg = ico('escola', { classe: 'nav-ico' });
  assert.match(svg, /class="ico nav-ico"/);
});

test('nome desconhecido devolve string vazia, sem lancar', () => {
  assert.equal(ico('nao-existe'), '');
  assert.equal(TEM_ICONE('nao-existe'), false);
  assert.equal(TEM_ICONE('escola'), true);
});

test('todos os icones do conjunto produzem svg', () => {
  const nomes = ['escola', 'sede', 'servidor', 'equipe', 'horario', 'calendario',
    'afastamento', 'transporte', 'dashboard', 'modulos', 'ata', 'ocorrencia',
    'projeto', 'visita', 'acesso', 'auditoria', 'docs', 'sino', 'editar',
    'excluir', 'buscar', 'adicionar', 'fechar', 'ok', 'atencao', 'erro',
    'restrito', 'menu', 'perdido', 'vazio', 'fixo', 'celular', 'whatsapp',
    'email', 'documento', 'arquivo', 'identidade', 'imprimir', 'tema',
    'escuro', 'subir', 'meta', 'parceria', 'obra', 'infantil',
    'acessibilidade', 'destaque', 'atualizar', 'sair', 'chevron', 'info', 'arrastar'];
  for (const n of nomes) {
    assert.ok(ico(n).startsWith('<svg '), `icone ausente: ${n}`);
  }
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
node --test tests/icones.test.mjs
```

Esperado: FAIL - `Cannot find module '../src/shared/ui/icones.js'`.

- [ ] **Step 3: Escrever `src/shared/ui/icones.js`**

```js
// ============================================================
// FundHub — shared/ui/icones.js
// Conjunto de ícones do hub. Traçados do Feather (MIT), grade
// 24×24, sem preenchimento, traço de 2 e cantos redondos.
//
// Por que SVG e não emoji: emoji não alinha (cada glifo tem
// baseline própria), não herda cor (é bitmap colorido, e por isso
// ignora o tema escuro e a R9) e muda de desenho conforme o
// sistema operacional — inaceitável numa rede de 144 escolas com
// parque heterogêneo.
//
// O nome descreve a COISA, não o desenho: 'excluir', não 'lixeira'.
// Assim trocar o traçado depois não obriga a renomear as chamadas.
// ============================================================

// Só o miolo do SVG. O envelope é montado por ico().
const TRACOS = {
  escola: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  servidor: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  equipe: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  horario: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  editar: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  excluir: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  buscar: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  adicionar: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  fechar: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  ok: '<polyline points="20 6 9 17 4 12"/>',
  atencao: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  erro: '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  restrito: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  sino: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  atualizar: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  chevron: '<polyline points="6 9 12 15 18 9"/>',
  fixo: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  celular: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  // … demais nomes do mapa da spec, copiados do Feather:
  // sede(briefcase) afastamento(sun) transporte(truck) dashboard(bar-chart-2)
  // modulos(grid) ata(edit-3) ocorrencia(clipboard) projeto(award)
  // visita(map-pin) acesso(shield) auditoria(eye) docs(book-open)
  // perdido(compass) vazio(inbox) email(mail) documento(file-text)
  // arquivo(archive) identidade(credit-card) imprimir(printer)
  // tema(droplet) escuro(moon) subir(arrow-up) meta(target)
  // parceria(users) obra(tool) infantil(smile) acessibilidade(user-check)
  // destaque(bookmark)
};

export const TEM_ICONE = (nome) => Object.hasOwn(TRACOS, nome);

// Ícone inexistente devolve string vazia: um nome errado deixa um
// buraco na tela, nunca um erro de JS que derruba a página inteira.
export function ico(nome, { tam = 16, classe = '' } = {}) {
  const tracos = TRACOS[nome];
  if (!tracos) return '';
  const cls = classe ? `ico ${classe}` : 'ico';
  return `<svg class="${cls}" width="${tam}" height="${tam}" viewBox="0 0 24 24"`
    + ` fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"`
    + ` stroke-linejoin="round" aria-hidden="true">${tracos}</svg>`;
}
```

Preencher os traçados comentados copiando do Feather. O teste do Step 1 falha enquanto faltar qualquer um.

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
node --test tests/icones.test.mjs
```

Esperado: PASS, 7 testes.

- [ ] **Step 5: Acrescentar `.ico` em `src/styles/components.css`**

```css
/* Ícones (shared/ui/icones.js). O par `flex: 0 0 auto` aqui +
   centro no container é o que faz o alinhamento deixar de ser
   sorte — emoji nunca teve como alinhar, SVG tem. */
.ico { display: inline-block; vertical-align: -0.125em; flex: 0 0 auto; }
```

- [ ] **Step 6: Verificar arquitetura e commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
```

```bash
git add src/shared/ui/icones.js tests/icones.test.mjs src/styles/components.css
git commit -m "feat(ui): conjunto de icones SVG em shared/ui"
```

---

## Task 2: Moldura e manifestos passam a usar ícones

**Files:**
- Modify: `src/modules/*/module.js` (17 arquivos - campo `ico`)
- Modify: `src/shell/chrome.js` (remove `USER_SVG`, usa `ico()`, item de menu)
- Modify: `src/core/router.js` (ícones dos estados vazios)
- Modify: `src/modules/modulos/modulos.view.js` (tiles)
- Modify: `src/modules/dashboard/dashboard.view.js` (13 emojis)
- Modify: `index.html` (favicon, `brand-mark`, `nav-toggle`)

**Interfaces:**
- Consumes: `ico(nome, opts)` da Task 1.
- Produces: campo `ico` dos manifestos passa a ser **nome de ícone**, não emoji. Todo consumidor de `m.ico` precisa envolver em `ico()`.

- [ ] **Step 1: Trocar o `ico` dos 17 manifestos**

Aplicar o mapa da Task 1. Exemplo, `src/modules/horarios/module.js`:

```js
export default {
  id: 'horarios',
  ico: 'horario',          // era '🕒'
  nome: 'Horários de Trabalho',
  // … resto inalterado
};
```

Conferir que os 17 valores estão no `TRACOS`:

```bash
grep -h "ico:" src/modules/*/module.js
```

- [ ] **Step 2: `chrome.js` - remover o `USER_SVG` e montar o item de menu com `ico()`**

Apagar a constante `USER_SVG` (linhas 44-46) e importar:

```js
import { ico } from '../shared/ui/icones.js';
```

Trocar as duas ocorrências de `${USER_SVG}` por `${ico('servidor', { tam: 20 })}` e a função `item`:

```js
function item(m) {
  return `<a href="${m.rota}" data-rota="${m.rota}">
    <span class="nav-ico">${ico(m.ico, { tam: 18 })}</span>
    <span class="nav-txt">${esc(m.navNome || m.nome)}</span>
  </a>`;
}
```

O `aria-hidden` sai do `<span>` - agora vive no próprio SVG.

- [ ] **Step 3: `index.html` - favicon, marca e botão de menu**

```html
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231d4ed8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/%3E%3Cpolyline points='9 22 9 12 15 12 15 22'/%3E%3C/svg%3E" />
```

O `#1d4ed8` no favicon é a única cor literal aceitável do projeto: `data:` URI em `index.html` não é `src/modules/**` e não tem como referenciar um token CSS. Registrar isso em comentário HTML ao lado.

**A marca vai inline no HTML, o `☰` vem do JS.** `montarNav()` só roda depois do login (`main.js`, `montarApp`), então preencher `.brand-mark` por JS deixaria a tela de login e a de acesso pendente sem logotipo. O `nav-toggle` pode vir do JS porque já é escondido quando anônimo (`.topbar.anon .nav-toggle { display: none }`).

No `index.html`, dentro do `<span class="brand-mark">`, o mesmo traçado de `escola` do conjunto:

```html
    <!-- Marca inline (e não via icones.js) para o logotipo aparecer na tela
         de login, antes de qualquer JS rodar. Se o traçado de `escola` mudar
         em shared/ui/icones.js, mude aqui também. -->
    <span class="brand-mark" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </span>
```

Em `montarNav()`, só o botão de menu:

```js
toggle().innerHTML = ico('menu', { tam: 20 });
```

E `.brand-mark { font-size: 22px; }` em `base.css:70` vira `.brand-mark { display: inline-flex; color: var(--brand); }`.

- [ ] **Step 4: `router.js`, tiles e dashboard**

Em `router.js`, `emptyState('🧭', …)` → `emptyState(ico('perdido', { tam: 32 }), …)`; `emptyState('🔒', …)` → `emptyState(ico('restrito', { tam: 32 }), …)`. O primeiro parâmetro de `emptyState` já entra sem escapar (`feedback.js:9`), então o SVG passa direto.

Em `modulos.view.js` e `dashboard.view.js`, todo `${m.ico}` vira `${ico(m.ico, { tam: 20 })}` e cada emoji solto vira o nome correspondente do mapa.

- [ ] **Step 5: Verificar no navegador**

Aplicar o patch de dev-local (`config.js` com `supabaseAnonKey: ''`; `perfil.js` devolvendo `{ email:'dev@local', papel:'admin_sme', isAdmin:true }` no ramo `!hasSupabase()`), servir e conferir.

```bash
python -c "print('use preview_start com o nome fundhub, porta 8123')"
```

Conferir: menu lateral com 17 ícones alinhados, topbar com marca e ☰, tiles em `#/modulos`, dashboard. Console sem erro. Tema claro e escuro (os ícones devem trocar de cor junto com o texto). **Reverter o patch de dev-local antes de commitar.**

- [ ] **Step 6: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(ui): moldura, manifestos e tiles usam icones SVG"
```

---

## Task 3: Emojis restantes nos módulos

**Files:**
- Modify: todos os `src/modules/**/*.js` com emoji remanescente (lista gerada no Step 1)
- Modify: `src/shared/ui/phones.js`, `src/shared/ui/filtro-segmento.js`, `src/core/segmentos.js`
- Modify: `src/styles/base.css` (2 emojis)

**Interfaces:**
- Consumes: `ico()` da Task 1.
- Produces: `src/` sem nenhum emoji.

- [ ] **Step 1: Levantar o que sobrou**

```bash
python -c "
import re, os
pat = re.compile('[\U0001F000-\U0001FAFF☀-➿⬀-⯿]')
for root, _, fs in os.walk('src'):
    for f in fs:
        p = os.path.join(root, f)
        for i, l in enumerate(open(p, encoding='utf-8'), 1):
            if pat.search(l): print(f'{p}:{i}')
"
```

- [ ] **Step 2: Trocar arquivo por arquivo, seguindo o mapa da Task 1**

Padrões que aparecem:

```js
// antes
`<button class="mini-btn" data-edit="${esc(p.email)}" aria-label="Editar">✎</button>`
// depois
`<button class="mini-btn" data-edit="${esc(p.email)}" aria-label="Editar">${ico('editar')}</button>`
```

```js
// antes
emptyState('🔐', 'Nenhum acesso cadastrado', 'Clique em "Adicionar acesso".')
// depois
emptyState(ico('acesso', { tam: 32 }), 'Nenhum acesso cadastrado', 'Clique em "Adicionar acesso".')
```

```js
// antes  (phones.js:150)
const ico = { whatsapp: '💬', celular: '📱', fixo: '☎️' };
// depois  — cuidado: a variável local `ico` colide com o import.
const ICO_TEL = { whatsapp: 'whatsapp', celular: 'celular', fixo: 'fixo' };
// … e no map: ${ico(ICO_TEL[t.tipo] || 'fixo')}
```

Em `core/segmentos.js` o campo `ico` de cada segmento vira nome (`infantil`, `escola`, …), como nos manifestos. `filtro-segmento.js` e `usuarios/views/lista.js` passam a envolver em `ico()`.

Em `base.css`, os dois emojis estão em `content:` de pseudo-elemento - trocar por um `background-image` com `data:` URI SVG ou, melhor, remover o pseudo-elemento e pôr o ícone no HTML. Preferir a segunda.

- [ ] **Step 3: Conferir que não sobrou nenhum**

```bash
python -c "
import re, os, sys
pat = re.compile('[\U0001F000-\U0001FAFF☀-➿⬀-⯿]')
n = 0
for root, _, fs in os.walk('src'):
    for f in fs:
        p = os.path.join(root, f)
        t = open(p, encoding='utf-8').read()
        m = pat.findall(t)
        if m: n += len(m); print(p, len(m))
print('TOTAL', n); sys.exit(1 if n else 0)
"
```

Esperado: `TOTAL 0`, saída 0.

- [ ] **Step 4: Verificar no navegador**

Aplicar dev-local e percorrer: Servidores, Escolas, Horários, Usuários, Afastamentos, SATE, Calendário, Docs. Conferir alinhamento vertical em botões `mini-btn`, chips de segmento e estados vazios. Console limpo. **Reverter o patch.**

- [ ] **Step 5: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(ui): substitui os emojis restantes por icones SVG"
```

---

## Task 4: Sistema de mensagens

**Files:**
- Modify: `src/shared/ui/toast.js` (reescrito)
- Create: `tests/toast.test.mjs`
- Modify: `src/styles/tokens.css` (`--topbar-h` e os quatro `-bg`)
- Modify: `src/styles/base.css` (`.topbar` ganha `min-height`)
- Modify: `src/styles/components.css` (bloco de toast, vindo de notificações)
- Modify: `src/modules/notificacoes/notificacoes.css` (perde o bloco de toast)

**Interfaces:**
- Consumes: `ico()` da Task 1.
- Produces:
  - `toast({ titulo, texto?, tipo?, duracao? }) => void`, com `tipo: 'sucesso' | 'atencao' | 'erro' | 'info'`;
  - `normalizarTipo(tipo: string) => 'sucesso' | 'atencao' | 'erro' | 'info'` (exportada só para teste e para o painel do sino);
  - `duracaoPadrao(tipo: string) => number`;
  - `limparToasts() => void` (mantida).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/toast.test.mjs`. Só a parte pura é testada - a montagem do DOM é verificada no navegador.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTipo, duracaoPadrao } from '../src/shared/ui/toast.js';

test('os quatro tipos semanticos passam intactos', () => {
  for (const t of ['sucesso', 'atencao', 'erro', 'info']) {
    assert.equal(normalizarTipo(t), t);
  }
});

test('o vocabulario antigo das notificacoes continua valendo', () => {
  assert.equal(normalizarTipo('ok'), 'sucesso');
  assert.equal(normalizarTipo('no'), 'erro');
  assert.equal(normalizarTipo('del'), 'erro');
  assert.equal(normalizarTipo('upd'), 'atencao');
  assert.equal(normalizarTipo('novo'), 'info');
});

test('tipo desconhecido ou ausente vira info', () => {
  assert.equal(normalizarTipo('qualquer'), 'info');
  assert.equal(normalizarTipo(undefined), 'info');
  assert.equal(normalizarTipo(null), 'info');
});

test('erro dura mais que os outros, porque erro precisa ser lido', () => {
  assert.equal(duracaoPadrao('erro'), 8000);
  assert.equal(duracaoPadrao('atencao'), 6000);
  assert.equal(duracaoPadrao('sucesso'), 5000);
  assert.equal(duracaoPadrao('info'), 5000);
});

test('duracao de tipo desconhecido cai no padrao', () => {
  assert.equal(duracaoPadrao('qualquer'), 5000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test tests/toast.test.mjs
```

Esperado: FAIL - `normalizarTipo` não exportada.

- [ ] **Step 3: Reescrever `src/shared/ui/toast.js`**

```js
// ============================================================
// FundHub — shared/ui/toast.js
// Mensagens de sistema. Entram pela direita, no topo, logo abaixo
// da barra de cabeçalho, e saem sozinhas.
//
// A REGRA DE USO, que vale para o hub inteiro:
//   • validação de campo    → inline no formulário, junto do campo
//                             (shared/dom.js → falha/ok);
//   • resultado da ação     → toast.
// "Informe o e-mail" é inline: a correção é ali. "Acesso adicionado"
// e "Não foi possível salvar" são toast: a gaveta já fechou.
//
// Erro dura mais porque erro precisa ser lido — e costuma trazer um
// texto do Postgres que a pessoa vai querer copiar. Por isso o hover
// também pausa o timer.
// ============================================================
import { esc } from '../dom.js';
import { ico } from './icones.js';

const TIPOS = ['sucesso', 'atencao', 'erro', 'info'];

// O vocabulário antigo era do domínio de notificações ('novo', 'upd',
// 'del'). Continua aceito para não reescrever aquele módulo.
const LEGADO = { ok: 'sucesso', no: 'erro', del: 'erro', upd: 'atencao', novo: 'info' };

const ICO_TIPO = { sucesso: 'ok', atencao: 'atencao', erro: 'erro', info: 'info' };

const DURACAO = { sucesso: 5000, atencao: 6000, erro: 8000, info: 5000 };

const MAX_VISIVEIS = 4;

export function normalizarTipo(tipo) {
  const t = String(tipo ?? '');
  if (TIPOS.includes(t)) return t;
  return LEGADO[t] || 'info';
}

export const duracaoPadrao = (tipo) => DURACAO[normalizarTipo(tipo)];

// UM container. Dois containers fixos no mesmo `top` se sobreporiam na
// tela. O papel vai em cada toast, não na caixa: role="alert" para erro
// (assertivo por definição) e role="status" para os demais — que é o
// padrão ARIA para notificação transitória.
function caixa() {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.className = 'toasts';
    document.body.appendChild(box);
  }
  return box;
}

export function toast({ titulo, texto = '', tipo = 'info', duracao } = {}) {
  const t = normalizarTipo(tipo);
  const box = caixa();
  const ms = duracao ?? DURACAO[t];

  const el = document.createElement('div');
  el.className = `toast t-${t}`;
  el.setAttribute('role', t === 'erro' ? 'alert' : 'status');
  el.innerHTML = `
    <span class="toast-ico">${ico(ICO_TIPO[t], { tam: 18 })}</span>
    <div class="toast-txt">
      <b>${esc(titulo)}</b>
      ${texto ? `<span>${esc(texto)}</span>` : ''}
    </div>
    <button type="button" class="toast-x" aria-label="Fechar aviso">${ico('fechar', { tam: 14 })}</button>`;
  box.appendChild(el);

  // O quinto empurra o mais antigo: pilha que cresce sem limite vira
  // cortina e esconde a própria tela.
  while (box.children.length > MAX_VISIVEIS) box.firstElementChild.remove();

  requestAnimationFrame(() => el.classList.add('show'));

  let timer = setTimeout(sair, ms);
  function sair() {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }
  el.querySelector('.toast-x').addEventListener('click', () => { clearTimeout(timer); sair(); });
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(sair, 2000); });
}

export function limparToasts() {
  document.getElementById('toasts')?.remove();
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test tests/toast.test.mjs
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Tokens**

Em `src/styles/tokens.css`, no `:root` claro:

```css
  /* Altura da barra de cabeçalho. Existe como token porque três
     coisas precisam concordar sobre ela: a própria topbar, a origem
     dos toasts e a altura dos botões do canto direito. */
  --topbar-h: 52px;

  /* Fundo suave das mensagens de sistema. Derivado por color-mix da
     cor de traço com a superfície, para claro e escuro saírem
     coerentes sem escolher oito valores à mão. */
  --sucesso-bg: color-mix(in srgb, var(--ok) 12%, var(--surface));
  --atencao-bg: color-mix(in srgb, var(--accent) 14%, var(--surface));
  --erro-bg:    color-mix(in srgb, var(--danger) 12%, var(--surface));
  --info-bg:    color-mix(in srgb, var(--brand) 12%, var(--surface));
```

No bloco `@media (prefers-color-scheme: dark)`, repetir os quatro `-bg` com percentuais um pouco maiores (18%/20%/18%/18%), porque sobre superfície escura a mesma proporção fica invisível. `--topbar-h` não se repete: altura não muda com o tema.

- [ ] **Step 6: `base.css` - a topbar passa a ter altura declarada**

```css
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--topbar-h);
  padding: 8px 14px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
```

- [ ] **Step 7: Mover o CSS de toast**

Apagar de `src/modules/notificacoes/notificacoes.css` o bloco `#toasts` / `.toast` (linhas 72-106, incluindo o `@media`) e escrever em `src/styles/components.css`:

```css
/* ── Mensagens de sistema (shared/ui/toast.js) ─────────────── */
/* Ficavam em modules/notificacoes/notificacoes.css: um módulo de
   fundo era dono do estilo de um componente do kernel. */
.toasts {
  position: fixed;
  top: calc(var(--topbar-h) + 12px);
  left: 12px;
  right: 12px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;          /* a fila não bloqueia a página */
}
.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--brand);
  border-radius: 10px;
  box-shadow: var(--shadow);
  opacity: 0;
  transform: translateX(110%);
  transition: opacity .25s ease, transform .25s ease;
  pointer-events: auto;
}
.toast.show { opacity: 1; transform: translateX(0); }
.toast-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.toast b { font-size: 13.5px; }
.toast span { color: var(--muted); font-size: 12.5px; overflow-wrap: anywhere; }
.toast-ico { display: inline-flex; padding-top: 1px; }
.toast-x {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px; height: 22px;
  border: 0; border-radius: 6px;
  background: none; color: var(--muted); cursor: pointer;
}
.toast-x:hover { background: var(--surface-3); color: var(--text); }

.toast.t-sucesso { border-left-color: var(--ok);     background: var(--sucesso-bg); }
.toast.t-sucesso .toast-ico { color: var(--ok); }
.toast.t-atencao { border-left-color: var(--accent); background: var(--atencao-bg); }
.toast.t-atencao .toast-ico { color: var(--accent); }
.toast.t-erro    { border-left-color: var(--danger); background: var(--erro-bg); }
.toast.t-erro .toast-ico { color: var(--danger); }
.toast.t-info    { border-left-color: var(--brand);  background: var(--info-bg); }
.toast.t-info .toast-ico { color: var(--brand); }

@media (min-width: 560px) {
  .toasts { left: auto; right: 18px; width: min(360px, calc(100vw - 36px)); }
}
@media (prefers-reduced-motion: reduce) {
  .toast { transition: opacity .15s ease; transform: none; }
}
```

O `.bell-item.t-*` de `notificacoes.css` **fica** - é do painel do sino, não do toast. Trocar lá os seletores `t-ok`/`t-no`/`t-del`/`t-upd` para os nomes semânticos e ajustar o serviço para passar os novos.

Atualizar também `base.css:304` (regra de impressão), que cita `#toasts`: passa a `.toasts`.

- [ ] **Step 8: Verificar no navegador**

Com dev-local, chamar do console:

```js
const m = await import('/src/shared/ui/toast.js');
m.toast({ titulo: 'Acesso adicionado', tipo: 'sucesso' });
m.toast({ titulo: 'Confira o horário', texto: 'Mais de 6h contínuas.', tipo: 'atencao' });
m.toast({ titulo: 'Não foi possível salvar', texto: 'violates foreign key constraint', tipo: 'erro' });
m.toast({ titulo: 'Dados atualizados', tipo: 'info' });
```

Conferir: entram pela direita, abaixo da topbar, sem cobrir o menu; erro fica mais tempo; hover pausa; o × fecha; a cor do ícone acompanha o tipo; legíveis no tema escuro; em 375px ocupam a largura.

- [ ] **Step 9: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(ui): mensagens de sistema semanticas no topo da tela"
```

---

## Task 5: Adoção do toast nos formulários

**Files:**
- Modify: `src/modules/usuarios/views/lista.js`, `src/modules/servidores/views/formulario.js`, `src/modules/servidores/views/vinculo.js`, `src/modules/escolas/views/formulario.js`, `src/modules/afastamentos/views/formulario.js`, `src/modules/atas/atas.view.js`, `src/modules/ocorrencias/ocorrencias.view.js`, `src/modules/projetos/projetos.view.js`, `src/modules/visitas/visitas.view.js`, `src/modules/sate/views/nova.js`, `src/modules/calendario/calendario.view.js`, `src/modules/meus-dados/meus-dados.view.js`

**Interfaces:**
- Consumes: `toast()` da Task 4.
- Produces: nenhuma API nova. É adoção da regra.

- [ ] **Step 1: Mapear os pontos de submit**

```bash
grep -rn "fecharDrawer()" src/modules/ | grep -v "drawer.js"
```

Cada um desses é um sucesso silencioso hoje.

- [ ] **Step 2: Aplicar a regra em cada formulário**

Padrão, usando `salvar()` de `usuarios/views/lista.js` como referência:

```js
// ANTES
    if (p) await atualizarPerfil(p.email, payload);
    else await criarPerfil(payload);
    fecharDrawer(); carregar();
  } catch (err) {
    falha(msg, err.message || String(err));

// DEPOIS
    if (p) await atualizarPerfil(p.email, payload);
    else await criarPerfil(payload);
    fecharDrawer(); carregar();
    toast({ titulo: p ? 'Acesso atualizado' : 'Acesso adicionado', texto: email, tipo: 'sucesso' });
  } catch (err) {
    // Nem todo erro de gravação é resultado da ação: violação de
    // constraint com a gaveta ainda ABERTA é erro de campo, e um
    // toast que some sozinho é o pior lugar para dizê-lo.
    reportarErro(err, { msg, titulo: 'Não foi possível salvar' });
```

**A classificação inline-versus-toast fica num lugar só.** São 13 formulários; a
regra de três está cumprida com folga, e um lugar para errar é melhor que treze.
Acrescente a `src/shared/ui/feedback.js`:

```js
import { toast } from './toast.js';
import { falha } from '../dom.js';

// Erros que a pessoa consegue corrigir no formulário que está aberto na
// frente dela. Códigos do Postgres, no mesmo idioma que escolas.model.js
// e afastamentos.model.js já usam para 42P01/42703.
const CORRIGIVEL = new Set([
  '23505',   // unique_violation   - número de ata repetido, segundo vínculo aberto
  '23514',   // check_violation    - valor fora do domínio permitido
  '23502',   // not_null_violation - campo obrigatório vazio
]);

// Erro de gravação: inline quando dá para consertar ali, toast quando não dá.
// Rede, chave estrangeira (23503) e permissão negada pelo RLS (42501) não se
// consertam no formulário - e a gaveta pode fechar antes de a pessoa ler.
export function reportarErro(err, { msg, titulo = 'Não foi possível salvar' } = {}) {
  const texto = err?.message || String(err);
  if (msg && CORRIGIVEL.has(err?.code)) { falha(msg, texto); return; }
  toast({ titulo, texto, tipo: 'erro' });
}
```

**O que NÃO muda:** as validações de campo antes do `try` continuam inline. Em `usuarios/views/lista.js`, `falha(msg, 'Informe o e-mail.')` e `falha(msg, 'Use um e-mail do domínio institucional…')` ficam como estão - a correção é ali, no campo.

Títulos por módulo (sempre no passado, sem ponto final, com o identificador no `texto`):

| Módulo | Sucesso ao criar | Sucesso ao editar | Sucesso ao excluir |
|---|---|---|---|
| Usuários | `Acesso adicionado` | `Acesso atualizado` | `Acesso removido` |
| Servidores | `Servidor cadastrado` | `Servidor atualizado` | `Servidor removido` |
| Vínculo | `Vínculo criado` | `Vínculo atualizado` | `Vínculo encerrado` |
| Escolas | `Escola cadastrada` | `Escola atualizada` | `Escola removida` |
| Afastamentos | `Afastamento lançado` | `Afastamento atualizado` | `Afastamento cancelado` |
| Atas | `Ata registrada` | `Ata atualizada` | `Ata removida` |
| Ocorrências | `Ocorrência registrada` | `Ocorrência atualizada` | `Ocorrência removida` |
| Projetos | `Projeto cadastrado` | `Projeto atualizado` | `Projeto removido` |
| Visitas | `Visita agendada` | `Visita atualizada` | `Visita cancelada` |
| SATE | `Solicitação enviada` | `Solicitação atualizada` | `Solicitação cancelada` |
| Calendário | `Dia gravado` | `Dia atualizado` | `Dia limpo` |
| Meus dados | - | `Dados atualizados` | - |

- [ ] **Step 3: Verificar no navegador**

Com dev-local, abrir e salvar em pelo menos três módulos diferentes. Conferir que o toast aparece **depois** da gaveta fechar e que a lista já veio recarregada por baixo dele.

- [ ] **Step 4: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(ui): resultado de acao vira toast em todos os formularios"
```

---

## Task 6: Toggles

**Files:**
- Modify: `src/shared/ui/phones.js:75-85` (`rowHtml`) e `montarPhonesEditor`
- Modify: `src/modules/usuarios/views/lista.js:141`
- Modify: `src/styles/components.css` (`.switch.radio`, `.phone-pri`)

**Interfaces:**
- Consumes: `.switch` existente.
- Produces: nenhuma API nova. `lerPhonesEditor` continua com a mesma assinatura e o mesmo retorno.

- [ ] **Step 1: `phones.js` - o radio ganha aparência de switch**

Em `rowHtml`, trocar o bloco `.phone-pri`:

```js
      <label class="switch radio phone-pri" title="Telefone principal">
        <input type="radio" name="phone-pri" ${t.principal ? 'checked' : ''} />
        <span class="switch-trilho" aria-hidden="true"></span>
        <span class="switch-txt">principal</span>
      </label>
```

**Continua sendo um `radio` de propósito.** A exclusividade mútua ("só um principal") é o que um grupo de radio faz nativamente; trocar por checkbox obrigaria a escrever JS que desmarca os outros, e esse JS teria de lidar com linhas criadas depois, com a remoção da linha do principal e com navegação por teclado. Mantendo o radio, o navegador faz tudo isso e o código novo é zero.

`lerPhonesEditor` lê `r.querySelector('.phone-pri input').checked` - **não muda**, porque o input continuou sendo o mesmo elemento.

- [ ] **Step 2: Garantir que sempre há um principal**

No fim de `montarPhonesEditor`, e de novo depois de cada `click` que adiciona ou remove linha:

```js
  // Uma lista de telefones sem principal não ajuda ninguém a decidir
  // para qual ligar. Se ninguém marcou, o primeiro assume.
  function garantirPrincipal() {
    const radios = [...box.querySelectorAll('.phone-pri input')];
    if (radios.length && !radios.some(r => r.checked)) radios[0].checked = true;
  }
```

Chamar `garantirPrincipal()` ao montar, depois do `insertAdjacentHTML` do `+ telefone` e depois do `.phone-del`.

- [ ] **Step 3: CSS**

```css
/* O "principal" dos telefones é um radio com aparência de switch:
   a exclusão mútua é do navegador, não de JS nosso. */
.switch.radio { font-weight: 400; font-size: 13px; color: var(--muted); }
.switch input:checked ~ .switch-txt { color: var(--text); font-weight: 600; }
```

E remover a regra antiga `.phone-pri { display: inline-flex; … }` (`components.css:785`), que agora conflita com `.switch`.

- [ ] **Step 4: `usuarios/views/lista.js` - "Acesso ativo" ao lado do Papel**

Trocar o `fieldset` de Acesso:

```html
        <fieldset class="form-grupo">
          <legend>Acesso</legend>
          <div class="campos">
            <div class="esc-row acesso-row">
              <label>Papel <select id="f-papel">${optsPapel}</select></label>
              <label class="switch">
                <input type="checkbox" id="f-ativo" ${(p ? p.ativo : true) ? 'checked' : ''} />
                <span class="switch-trilho" aria-hidden="true"></span>
                <span class="switch-txt">Acesso ativo</span>
              </label>
            </div>
            <small class="form-hint" id="f-papel-desc"></small>
          </div>
        </fieldset>
```

O `form-hint` sai de dentro do `<label>` para não quebrar a linha do grid. `checked('f-ativo')` em `salvar()` continua funcionando: o id é o mesmo.

```css
/* Papel e "acesso ativo" na mesma linha: `end` alinha o trilho com a
   base do select, não com o topo do rótulo. */
.acesso-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: end; }
@media (max-width: 559px) { .acesso-row { grid-template-columns: 1fr; align-items: start; } }
```

- [ ] **Step 5: Verificar no navegador**

Com dev-local: gaveta de Servidores (telefones) - marcar principal em cada linha e conferir que só um fica ligado; adicionar linha; remover a linha do principal e conferir que outra assume. Gaveta de Usuários - o toggle alinhado com o select em desktop, empilhado em 375px, e o valor chegando certo no `payload`.

- [ ] **Step 6: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(ui): telefone principal e acesso ativo viram toggle"
```

---

## Task 7: Travessão, hífen e vazios semânticos

**Files:**
- Modify: `src/shared/dom.js` (ganha `vazio`)
- Modify: `src/styles/components.css` (`.vazio`)
- Modify: todo o repositório (troca de `—`)

**Interfaces:**
- Consumes: `esc()`.
- Produces: `vazio(msg: string) => string` (HTML de um `<span class="vazio">`).

- [ ] **Step 1: `vazio()` em `shared/dom.js`**

```js
// Campo sem valor. Nunca "—": o travessão não informa nada, e não
// distingue "ninguém cadastrou" de "carregou vazio por erro". Cada
// chamada escolhe a mensagem — é aí que está o valor do helper.
export const vazio = (msg) => `<span class="vazio">${esc(msg)}</span>`;
```

```css
.vazio { color: var(--muted); font-style: italic; }
```

- [ ] **Step 2: Aplicar o mapa de mensagens**

| Arquivo | Antes | Depois |
|---|---|---|
| `shell/chrome.js` | `'primeiro acesso'` (já semântico) | manter |
| `modules/usuarios/views/lista.js` | `Último acesso: ${fmtDataHora(p.ultimo_acesso)}` | `Último acesso: ${p.ultimo_acesso ? esc(fmtDataHora(p.ultimo_acesso)) : vazio('nunca acessou')}` |
| `shared/ui/phones.js:160` | `.join(' · ') \|\| '—'` | `.join(' · ') \|\| vazio('sem telefone cadastrado')` |
| `modules/horarios/views/por-escola.js` | `<span class="hb-vazio">—</span>` | `vazio('sem jornada')` |
| `modules/servidores/servidores.model.js` (`lotacaoDe`) | devolve `''` | manter `''`; quem exibe usa `vazio('sem lotação')` |
| `modules/servidores/views/detalhe.js` | cargo ausente | `vazio('cargo não informado')` |
| `modules/escolas/views/detalhe.js` | campos em branco | `vazio('não informado')` |

Tom: minúscula, sem ponto final, descrevendo o **fato** ("nunca acessou"), não a ausência do dado ("sem informação"). Varrer o resto:

```bash
grep -rn "'—'\|\"—\"\|>—<" src/
```

- [ ] **Step 3: Concatenações passam a hífen**

```bash
grep -rn "join(' — ')\|+ ' — '\| — \${" src/
```

O caso citado na spec é a lotação: `SME - Sede`.

- [ ] **Step 4: Troca mecânica no repositório inteiro**

```bash
python -c "
import os, io
alvos = []
for base in ['src', 'docs', '.claude/rules']:
    for root, _, fs in os.walk(base):
        for f in fs:
            if f.endswith(('.js','.css','.md','.sql','.py','.html')):
                alvos.append(os.path.join(root, f))
alvos += ['index.html', 'CHANGELOG.md', 'CLAUDE.md', 'README.md']
pular = os.path.join('docs','superpowers','specs','2026-08-27-sistema-visual-design.md')
n = 0
for p in alvos:
    if not os.path.exists(p) or p.endswith(pular): continue
    t = io.open(p, encoding='utf-8').read()
    if '—' not in t: continue
    n += t.count('—')
    io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('—', '-'))
print('trocados:', n)
"
```

A spec `2026-08-27-sistema-visual-design.md` é pulada de propósito: lá o caractere é citado como assunto, entre crases, e não usado como pontuação.

- [ ] **Step 5: Conferir**

```bash
grep -rn "—" src/ docs/ .claude/ index.html CHANGELOG.md CLAUDE.md README.md \
  | grep -v "2026-08-27-sistema-visual-design.md" || echo "limpo"
```

Esperado: `limpo`.

Ler o diff procurando prosa que ficou estranha - `texto — texto` vira `texto - texto`, o que é aceitável, mas travessão duplo ou colado precisa de ajuste manual.

- [ ] **Step 6: Verificar no navegador e commitar**

Com dev-local, conferir Usuários (nunca acessou), Servidores (sem telefone), Horários (sem jornada).

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(ui): hifen no lugar de travessao e mensagens semanticas para vazio"
```

---

## Task 8: Botão Atualizar

**Files:**
- Create: `src/shared/cache.js`
- Create: `tests/cache.test.mjs`
- Modify: `src/modules/escolas/escolas.model.js`, `src/modules/locais/locais.model.js`, `src/modules/servidores/servidores.model.js`, `src/modules/sate/atividades.model.js`
- Modify: `src/core/router.js` (`recarregarRota`)
- Modify: `src/shell/chrome.js` (botão + carimbo)
- Modify: `src/styles/components.css` (`.topbar-acao`, `.atualizado`)

**Interfaces:**
- Consumes: `ico()`, `fmtDataHora()`.
- Produces:
  - `registrarCache(limpar: () => void) => void`;
  - `limparCaches() => void`;
  - `recarregarRota() => Promise<void>` (de `core/router.js`);
  - `marcarAtualizacao() => void` e o elemento `#atualizado` na topbar.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/cache.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarCache, limparCaches, _reset } from '../src/shared/cache.js';

test('limparCaches chama todas as funcoes registradas', () => {
  _reset();
  let a = 0, b = 0;
  registrarCache(() => { a++; });
  registrarCache(() => { b++; });
  limparCaches();
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test('a mesma funcao registrada duas vezes so e chamada uma vez', () => {
  _reset();
  let n = 0;
  const f = () => { n++; };
  registrarCache(f);
  registrarCache(f);
  limparCaches();
  assert.equal(n, 1);
});

test('uma funcao que lanca nao impede as outras de rodar', () => {
  _reset();
  let depois = 0;
  registrarCache(() => { throw new Error('modelo quebrado'); });
  registrarCache(() => { depois++; });
  limparCaches();
  assert.equal(depois, 1);
});

test('sem nada registrado, limpar nao lanca', () => {
  _reset();
  assert.doesNotThrow(() => limparCaches());
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test tests/cache.test.mjs
```

Esperado: FAIL - módulo não encontrado.

- [ ] **Step 3: Escrever `src/shared/cache.js`**

```js
// ============================================================
// FundHub — shared/cache.js
// Registro das funções que invalidam cache de model. Existe para o
// botão Atualizar do cabeçalho poder dizer "recarregue tudo" sem que
// o kernel precise conhecer módulo nenhum.
//
// A inversão é a mesma do core/registry.js: o kernel oferece o ponto
// de registro, os módulos se registram. A diferença é que o registry
// conhece manifestos e este não conhece nada — só guarda funções
// anônimas. Assim a R1 (kernel nunca importa modules/) fica intacta.
//
// Hoje são quatro models com cache: escolas, locais, servidores e
// sate/atividades.
// ============================================================

const registrados = new Set();

export function registrarCache(limpar) {
  if (typeof limpar === 'function') registrados.add(limpar);
}

// Uma função que lança não pode impedir as outras de rodar: cache
// meio limpo é pior que cache não limpo, porque a tela mistura dado
// velho com dado novo sem avisar.
export function limparCaches() {
  for (const limpar of registrados) {
    try { limpar(); }
    catch (err) { console.warn('[cache] falha ao invalidar:', err); }
  }
}

// Só para teste.
export function _reset() { registrados.clear(); }
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test tests/cache.test.mjs
```

Esperado: PASS, 4 testes.

- [ ] **Step 5: Os quatro models se registram**

Em cada um dos quatro, logo após a declaração do `_cache`:

```js
import { registrarCache } from '../../shared/cache.js';

let _cache = null;
registrarCache(() => { _cache = null; });
```

`servidores.model.js` já expõe `limparCacheServidores()` - registrar essa mesma função em vez de criar outra. Idem para os demais que já tenham um limpador nomeado.

- [ ] **Step 6: `recarregarRota()` em `core/router.js`**

```js
// Reexecuta a rota atual sem tocar no hash — o scroll, a aba e o
// filtro em que a pessoa estava sobrevivem. É o que o botão
// Atualizar faz depois de invalidar os caches.
export async function recarregarRota() {
  await route();
}
```

- [ ] **Step 7: Botão e carimbo em `shell/chrome.js`**

**A ordem dos três controles é decidida por CSS, não por ordem de inserção.** `notificacoes.service.js:118` insere o sino com `right.insertBefore(wrap, right.firstChild)`, então o sino sempre vira o primeiro filho; qualquer coisa que `setChrome` anexe cai à direita dele. Como `.topbar-right` já é `display: flex` (`base.css:76`), a propriedade `order` resolve isso de forma determinística, sem coordenar quem monta primeiro.

Numa função nova, chamada por `setChrome` quando logado:

```js
import { limparCaches } from '../shared/cache.js';
import { recarregarRota } from '../core/router.js';
import { ico } from '../shared/ui/icones.js';
import { toast } from '../shared/ui/toast.js';

function montarAtualizar(right) {
  if (right.querySelector('.atualizar-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'atualizar-wrap';
  wrap.innerHTML = `
    <span class="atualizado" id="atualizado"></span>
    <button class="topbar-acao" id="btn-atualizar" type="button"
            aria-label="Atualizar os dados desta tela">${ico('atualizar', { tam: 18 })}</button>`;
  right.appendChild(wrap);

  wrap.querySelector('#btn-atualizar').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('girando');
    btn.disabled = true;
    try {
      limparCaches();
      await recarregarRota();
      marcarAtualizacao();
    } catch (err) {
      toast({ titulo: 'Não foi possível atualizar', texto: err.message || String(err), tipo: 'erro' });
    } finally {
      btn.classList.remove('girando');
      btn.disabled = false;
    }
  });
  marcarAtualizacao();
}

// O carimbo diz quando estes dados vieram do banco. Se ele mostrasse
// a hora do relógio sem os caches terem sido invalidados, mentiria.
export function marcarAtualizacao() {
  const el = document.getElementById('atualizado');
  if (el) el.textContent = `atualizado ${fmtDataHora(agoraISO())}`;
}
```

`agoraISO` já existe em `shared/format.js`; acrescentar ao import existente. Chamar `montarAtualizar(right)` em `setChrome`, no ramo `if (logado)`, **antes** do bloco que monta o menu de usuário.

**Cuidado com ciclo (R4):** `chrome.js` importar `core/router.js` é permitido (`shell/` → kernel), e `router.js` não importa `shell/`. Conferir com o script.

- [ ] **Step 8: CSS**

```css
/* Cabeçalho: os três controles do canto direito compartilham altura
   e centro, que é o que os alinha entre si.

   A ORDEM vem daqui, não da ordem de inserção no DOM: o sino se
   insere como primeiro filho (notificacoes.service.js) e o menu de
   usuário é anexado por setChrome, então sem `order` o botão de
   atualizar acabaria à direita do sino. */
.topbar-right > .atualizar-wrap { order: 1; }
.topbar-right > .bell-wrap      { order: 2; }
.topbar-right > .user-menu      { order: 3; }

.atualizar-wrap { display: inline-flex; align-items: center; gap: 8px; }
.atualizado { color: var(--muted); font-size: 12px; white-space: nowrap; }
.topbar-acao {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--toque);
  height: var(--toque);
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text);
  cursor: pointer;
}
.topbar-acao:hover { border-color: color-mix(in srgb, var(--brand) 40%, var(--border)); }
.topbar-acao:disabled { opacity: .6; cursor: default; }
.topbar-acao.girando .ico { animation: girar .8s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .topbar-acao.girando .ico { animation: none; } }

/* Abaixo de 720px o carimbo não cabe; o botão fica. */
@media (max-width: 719px) { .atualizado { display: none; } }
```

O `.bell` de `notificacoes.css` usa as mesmas medidas - conferir que ficam idênticos e, se divergirem, fazer o `.bell` herdar de `.topbar-acao`.

- [ ] **Step 9: Verificar no navegador**

Com dev-local: o carimbo aparece à esquerda do botão, os três controles do canto direito alinhados no centro vertical; clicar gira o ícone, a tela recarrega e o carimbo muda; em 375px o carimbo some e o botão continua; console limpo.

- [ ] **Step 10: Commitar**

```bash
node --test
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(ui): botao de atualizar no cabecalho com carimbo da ultima carga"
```

---

## Task 9: Fechamento da entrega

**Files:**
- Modify: `src/core/config.js` (`CONFIG.versao`)
- Modify: `CHANGELOG.md`
- Modify: `src/modules/docs/docs.content.js` (se descrever ícones ou mensagens)

- [ ] **Step 1: Rodar tudo, incluindo a re-varredura de travessão**

```bash
node --test
python .claude/scripts/verificar_arquitetura.py
```

As Tasks 8 e 9 criaram código depois da varredura da Task 7. Re-varrer:

```bash
grep -rn "—" src/ docs/ .claude/ index.html CHANGELOG.md CLAUDE.md README.md   | grep -v "2026-08-27-sistema-visual-design.md" || echo "limpo"
```

Esperado: `limpo`. Se aparecer algo, trocar por `-` antes de seguir.

E a varredura de emoji da Task 3, pelo mesmo motivo:

```bash
python -c "
import re, os, sys
pat = re.compile('[🀀-🫿☀-➿⬀-⯿]')
n = 0
for root, _, fs in os.walk('src'):
    for f in fs:
        p = os.path.join(root, f)
        t = open(p, encoding='utf-8').read()
        m = pat.findall(t)
        if m: n += len(m); print(p, len(m))
print('TOTAL', n); sys.exit(1 if n else 0)
"
```

- [ ] **Step 2: Subir a versão**

`CONFIG.versao` de `0.11.0` para `0.12.0` - é MINOR: muda vocabulário visual do hub inteiro, não é correção.

- [ ] **Step 3: Escrever o CHANGELOG**

Escrito para **quem usa** o sistema. Sem jargão, sem nome de arquivo, sem "refatoração".

```markdown
## 0.12.0

- Os ícones do sistema foram redesenhados. Agora acompanham a cor do texto,
  ficam alinhados e têm o mesmo desenho em qualquer computador ou celular.
- Ao salvar um formulário, o sistema avisa o que aconteceu: um aviso verde
  aparece no canto superior direito e some sozinho. Erro aparece em vermelho
  e fica mais tempo na tela.
- O telefone principal e o acesso ativo agora são chaves de liga e desliga,
  no lugar das caixinhas de marcar.
- Campos sem informação passam a dizer o que está faltando - "nunca acessou",
  "sem telefone cadastrado" - no lugar de um traço.
- Um botão de atualizar foi acrescentado ao topo da tela, com a informação de
  quando os dados foram carregados pela última vez.
```

- [ ] **Step 4: Testar em tela estreita e conferir o console**

375px: topbar, menu, gavetas, toasts, toggles. Tema claro e escuro.

- [ ] **Step 5: Commitar**

```bash
git add -A && git diff --cached
git commit -m "chore: versao 0.12.0 e fecha a rodada do sistema visual"
```

---

## Verificação final

- [ ] `node --test` verde.
- [ ] `python .claude/scripts/verificar_arquitetura.py` sem novas violações.
- [ ] Zero emojis em `src/` (varredura da Task 3, Step 3).
- [ ] Zero `—` no repositório, exceto a spec do sistema visual.
- [ ] Console do navegador limpo em todas as rotas.
- [ ] Tema claro e escuro conferidos.
- [ ] 375px conferido.
- [ ] `git diff` da branch lido inteiro à procura de dado real.
