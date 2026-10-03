# SATE e formulários - Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a rodada de ajustes do SATE e os padrões de formulário/modal/busca do hub descritos na spec, sem mudar banco, dado ou permissão.

**Architecture:** Funções puras novas (distância de edição, aproximação de opções, semana útil, local no endereço, estado "sujo" do modal) nascem com teste em `node --test`. O resto é CSS global em `components.css`/`tokens.css` e ajustes de markup nas views, verificados no navegador em dev-local. Nenhum arquivo de código novo.

**Tech Stack:** JS ES modules sem build, CSS puro, testes `node:test` (Node 24), servidor `.claude/devserver.py` (porta 8123), Supabase (não tocado).

**Spec:** `docs/superpowers/specs/2026-10-02-sate-ajustes-e-formularios-design.md` - ler inteira antes da primeira tarefa. Cada tarefa cita a decisão (D1…D13) que implementa.

## Global Constraints

- Sem npm, sem bundler, sem dependência nova (CLAUDE.md "Sem build").
- Nenhum dado real em código, comentário, teste ou doc: "Escola Exemplo", "Museu Exemplo", "Rua Exemplo", `(00) 00000-0000` (R7).
- Todo valor vindo do banco **ou digitado pela pessoa** passa por `esc()` antes de entrar em template literal (R5).
- Nenhuma cor literal em `src/modules/**` - só `var(--token)` (R9). Cor literal só em `tokens.css`.
- Model nunca toca DOM; view nunca chama `sb()` (R3). Só `*.model.js` atravessa a fronteira de módulo (R2).
- Data civil é string `yyyy-mm-dd`; `new Date(iso + 'T00:00:00')` só para dia da semana; nada de `toISOString`/`toLocale*` fora de `shared/format.js` (R8).
- View ≤ 400 linhas, model ≤ 250 (R11).
- PT-BR em código, comentário, commit e interface. Comentários explicam o **porquê**, na densidade do arquivo vizinho.
- Commits na branch **`dev`**, mensagem no padrão `tipo(escopo): descrição` em português, terminando com:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Antes de cada commit: `git diff --cached` lido procurando dado real.
- Versões-alvo: `CONFIG.versao` **0.38.1**, `CONFIG.versaoSate` **0.17.1** (só na Tarefa 10).

**Rodar os testes:** `node --test tests/` (na raiz do projeto).
**Verificar arquitetura:** `python .claude/scripts/verificar_arquitetura.py`.

**Navegador (dev-local), quando a tarefa pedir:** seguir a memória `fundhub-teste-devlocal`:
1. `src/core/config.js` → `supabaseAnonKey: ''`;
2. `src/core/perfil.js`, ramo `if (!hasSupabase())` → devolver `{ email:'dev@local', papel:'admin_sme', isAdmin:true }` e chamar `definirMapa(new Proxy({}, { get: () => 'escrita' }))` antes;
3. `preview_start` com `name: "fundhub"`; **`resize_window` para uma largura real antes de medir qualquer coisa** (o painel abre com ~1px);
4. navegar com `?v=N` para furar o cache dos módulos;
5. para abrir um modal sem navegar a fundo: `javascript_tool` com `(await import('/src/modules/<x>/views/<y>.js')).<funcao>(...)`.
**Reverter 1 e 2 antes de qualquer commit** e conferir `grep -rn "dev@local" src/` (só `docs.content.js` pode citar).

---

## Mapa de arquivos

| Arquivo | Tarefas | Responsabilidade |
|---|---|---|
| `src/shared/dom.js` | 1 | `distancia`, `semelhanca` (puras, ao lado de `norm`) |
| `src/shared/ui/busca-selecao.js` | 1, 6 | `aproximarOpcoes` (pura); widget: rótulo, âncora, abrir por gesto, "Parecidos", item criar |
| `src/modules/locais/locais.model.js` | 2 | `locaisParecidos` tolerante; `localNoEndereco` |
| `src/modules/sate/disponibilidade.model.js` | 2 | `semanaUtil` |
| `src/shared/ui/modal.js` | 3 | dispensa protegida por dado digitado |
| `src/shared/ui/icones.js` + 8 usos | 4 | sai `transporte`, entra `onibus` |
| `src/styles/tokens.css`, `components.css` | 5, 6, 7 | grupos, rótulos, foco, fundo, cabeçalho, busca, campo solto |
| `src/modules/horarios/views/jornada.js`, `usuarios/usuarios.view.js` | 5 | `.plano` |
| `src/modules/sate/views/fichas.js`, `disponibilidade.js`, `viagens/viagens.view.js`, `dashboard/views/hoje.js`, `dashboard/dashboard.css`, `calendario/views/escalas.js` | 7, 8 | `.campo-solto` |
| `src/modules/sate/views/frota.js`, `sate.view.js`, `disponibilidade.js`, `sate.css`, `escolas/views/detalhe.js` | 8 | D5 (escola), D9, D10, D11 |
| `src/modules/sate/views/formulario.js`, `formulario-destino.js`, `sate.css` | 9 | D13 |
| `.claude/rules/ui.md`, `docs/modulos/sate.md`, `docs/modulos/escolas.md`, `src/core/config.js`, `CHANGELOG.md` | 10 | regras, tutoriais, versão |

---

### Task 1: Distância de edição e aproximação de opções (puras)

Implementa a parte pura da D7 ("Tolerância a erro de digitação").

**Files:**
- Modify: `src/shared/dom.js` (depois de `norm`, linha ~20)
- Modify: `src/shared/ui/busca-selecao.js` (depois de `filtrarOpcoes`, linha ~30; import na linha 16)
- Test: `tests/busca.test.mjs` (acrescentar ao fim)

**Interfaces:**
- Produces:
  - `distancia(a: string, b: string): number` - Levenshtein com transposição adjacente.
  - `semelhanca(p: string, q: string): number | null` - custo (0, 1 ou 2) se a palavra digitada `p` "parece" a palavra `q`, senão `null`. Normaliza as duas por dentro.
  - `aproximarOpcoes(opcoes, termo, max = 5): Opcao[]` - opções em que **toda** palavra do termo parece alguma palavra de `rotulo + detalhe + busca`, ordenadas por custo total crescente (estável), no máximo `max`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `tests/busca.test.mjs` (e trocar a linha 3 por
`import { filtrarOpcoes, aproximarOpcoes } from '../src/shared/ui/busca-selecao.js';`
mais uma linha `import { distancia, semelhanca } from '../src/shared/dom.js';`):

```js
test('distancia: troca, inserção, remoção e inversão contam 1', () => {
  assert.equal(distancia('museu', 'museu'), 0);
  assert.equal(distancia('muzeu', 'museu'), 1);   // troca
  assert.equal(distancia('teatro', 'theatro'), 1); // inserção
  assert.equal(distancia('msueu', 'museu'), 1);   // inversão de vizinhas
  assert.equal(distancia('', 'abc'), 3);
  assert.equal(distancia('abc', ''), 3);
});

test('semelhanca: começo de palavra é igual; até 1 letra (2 a partir de 7)', () => {
  assert.equal(semelhanca('muse', 'museu'), 0);       // ainda digitando
  assert.equal(semelhanca('Muzeu', 'MUSEU'), 1);      // normaliza caixa
  assert.equal(semelhanca('exemplu', 'exemplo'), 1);
  assert.equal(semelhanca('exenplu', 'exemplo'), 2);  // 7 letras: tolera 2
  assert.equal(semelhanca('muzeo', 'museu'), null);   // 2 erros em 5 letras
  assert.equal(semelhanca('de', 'da'), null);         // curta: só igual ou começo
  assert.equal(semelhanca('de', 'dentro'), 0);
  assert.equal(semelhanca('escola', 'museu'), null);
  assert.equal(semelhanca('', 'museu'), null);
});

const LOCAIS = [
  { id: 'm', rotulo: 'Museu Exemplo', detalhe: 'Rua Exemplo, 10 - Centro' },
  { id: 't', rotulo: 'Theatro Exemplo', detalhe: 'Rua Exemplo, 20 - Centro' },
  { id: 'p', rotulo: 'Parque Exemplo', detalhe: 'Avenida Exemplo, 30 - Jardim' },
];

test('aproximarOpcoes: acha com erro de digitação', () => {
  assert.deepEqual(aproximarOpcoes(LOCAIS, 'muzeu').map(o => o.id), ['m']);
  assert.deepEqual(aproximarOpcoes(LOCAIS, 'teatro exemplu').map(o => o.id), ['t']);
});

test('aproximarOpcoes: toda palavra precisa parecer alguma', () => {
  assert.deepEqual(aproximarOpcoes(LOCAIS, 'muzeu jardim').map(o => o.id), []);
});

test('aproximarOpcoes: mais parecida primeiro, com teto', () => {
  const r = aproximarOpcoes(LOCAIS, 'exemplp').map(o => o.id);
  assert.deepEqual(r, ['m', 't', 'p']);               // empate: ordem original
  assert.equal(aproximarOpcoes(LOCAIS, 'exemplp', 2).length, 2);
});

test('aproximarOpcoes: termo vazio ou lista ausente devolve vazio', () => {
  assert.deepEqual(aproximarOpcoes(LOCAIS, ''), []);
  assert.deepEqual(aproximarOpcoes(undefined, 'museu'), []);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/busca.test.mjs`
Expected: FAIL - `distancia`/`aproximarOpcoes` não exportados (SyntaxError de import).

- [ ] **Step 3: Implementar em `src/shared/dom.js`**, logo abaixo de `norm`:

```js
// Distância de edição (Levenshtein com inversão de vizinhas): quantas
// letras trocar, pôr, tirar ou inverter para ir de `a` a `b`. Base da
// busca tolerante a erro de digitação (spec 2026-10-02, D7).
export function distancia(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Quanto a palavra digitada `p` difere da palavra `q`, ou null se não se
// parecem. Começo de palavra vale como igual: quem digitou "muse" ainda
// não terminou "museu". Abaixo de 4 letras, só igual ou começo - "de" e
// "da" a uma letra de tudo trariam a lista inteira. Tolera 1 letra, e 2
// a partir de 7 (palavra longa erra mais).
export function semelhanca(p, q) {
  p = norm(p).trim(); q = norm(q).trim();
  if (!p || !q) return null;
  if (q.startsWith(p)) return 0;
  if (p.length < 4) return null;
  const d = Math.min(distancia(p, q), distancia(p, q.slice(0, p.length)));
  return d <= (p.length >= 7 ? 2 : 1) ? d : null;
}
```

- [ ] **Step 4: Implementar `aproximarOpcoes` em `busca-selecao.js`**

Trocar o import da linha 16 por `import { esc, norm, semelhanca } from '../dom.js';` e acrescentar logo depois de `filtrarOpcoes`:

```js
// Segunda passada, só quando a exata não acha NADA (spec 2026-10-02, D7):
// cada palavra do termo precisa parecer alguma palavra da opção. Quem
// digita certo nunca vê isto; quem digitou "Muzeu" acha o museu.
export function aproximarOpcoes(opcoes, termo, max = 5) {
  const palavras = norm(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return [];
  return (opcoes || [])
    .map((o, i) => {
      const alvo = norm(`${o.rotulo || ''} ${o.detalhe || ''} ${o.busca || ''}`)
        .split(/[^a-z0-9]+/).filter(Boolean);
      let custo = 0;
      for (const p of palavras) {
        const custos = alvo.map(q => semelhanca(p, q)).filter(c => c !== null);
        if (!custos.length) return null;
        custo += Math.min(...custos);
      }
      return { o, custo, i };
    })
    .filter(Boolean)
    .sort((a, b) => a.custo - b.custo || a.i - b.i)
    .slice(0, max)
    .map(x => x.o);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS em todos (os testes antigos de `filtrarOpcoes` continuam verdes - a função não mudou).

- [ ] **Step 6: Commit**

```bash
git add src/shared/dom.js src/shared/ui/busca-selecao.js tests/busca.test.mjs
git commit -m "feat(busca): distancia de edicao e aproximacao de opcoes com erro de digitacao"
```

---

### Task 2: Regras de domínio puras - locais e semana útil

Implementa a parte de model da D13 (itens 2 e 4) e da D9.

**Files:**
- Modify: `src/modules/locais/locais.model.js` (`locaisParecidos`, linha ~99; import da linha 18)
- Modify: `src/modules/sate/disponibilidade.model.js` (nova exportação; conferir que `addDias` já é importado de `shared/format.js` no topo - é usado por `aproximarPorPeriodo`)
- Test: `tests/sate-solicitacao.test.mjs`, `tests/sate-disponibilidade.test.mjs`

**Interfaces:**
- Consumes: `semelhanca(p, q)` de `src/shared/dom.js` (Task 1).
- Produces:
  - `localNoEndereco(rua: string, numero: string, locais: Local[]): Local | null` - primeiro local **ativo** com a mesma rua (normalizada, com abreviação de logradouro expandida) e o mesmo número.
  - `semanaUtil(iso: string): { segunda: string, sexta: string, foco: string }` - sábado → foco na segunda seguinte (+2); domingo → +1; dia útil → ele mesmo.
  - `locaisParecidos` mantém assinatura e passa a aceitar nome com erro de digitação.

- [ ] **Step 1: Testes que falham - locais**

Em `tests/sate-solicitacao.test.mjs`, trocar a linha 5 por
`import { enderecoCompleto, locaisParecidos, localNoEndereco } from '../src/modules/locais/locais.model.js';`
e acrescentar ao fim:

```js
test('locaisParecidos: tolera erro de digitação no nome', () => {
  const locais = [
    { id: '1', nome: 'Museu Exemplo', bairro: 'Centro', ativo: true },
    { id: '2', nome: 'Parque Distante', bairro: 'Jardim', ativo: true },
  ];
  const r = locaisParecidos({ nome: 'Muzeu Exenplo', bairro: '' }, locais).map(l => l.id);
  assert.deepEqual(r, ['1']);
});

test('localNoEndereco: mesma rua e número, sem acento, caixa ou abreviação', () => {
  const locais = [
    { id: '1', nome: 'Museu Exemplo', endereco: 'Rua São Exemplo', numero: '100', ativo: true },
    { id: '2', nome: 'Parque Exemplo', endereco: 'Avenida Exemplo', numero: '20', ativo: true },
    { id: '3', nome: 'Antigo Exemplo', endereco: 'Rua Velha Exemplo', numero: '5', ativo: false },
  ];
  assert.equal(localNoEndereco('r. sao exemplo', '100', locais)?.id, '1');
  assert.equal(localNoEndereco('Av Exemplo', ' 20 ', locais)?.id, '2');
  assert.equal(localNoEndereco('Rua São Exemplo', '101', locais), null);
  assert.equal(localNoEndereco('Rua Velha Exemplo', '5', locais), null);   // inativo
  assert.equal(localNoEndereco('', '100', locais), null);
  assert.equal(localNoEndereco('Rua São Exemplo', '', locais), null);
});
```

- [ ] **Step 2: Testes que falham - semana útil**

Em `tests/sate-disponibilidade.test.mjs`, acrescentar `semanaUtil` ao import do topo e, ao fim:

```js
// 05/10/2026 é segunda-feira.
test('semanaUtil: dia útil fica em foco na própria semana', () => {
  assert.deepEqual(semanaUtil('2026-10-07'), { segunda: '2026-10-05', sexta: '2026-10-09', foco: '2026-10-07' });
  assert.deepEqual(semanaUtil('2026-10-05'), { segunda: '2026-10-05', sexta: '2026-10-09', foco: '2026-10-05' });
  assert.deepEqual(semanaUtil('2026-10-09'), { segunda: '2026-10-05', sexta: '2026-10-09', foco: '2026-10-09' });
});
test('semanaUtil: sábado e domingo levam à segunda seguinte', () => {
  assert.deepEqual(semanaUtil('2026-10-10'), { segunda: '2026-10-12', sexta: '2026-10-16', foco: '2026-10-12' });
  assert.deepEqual(semanaUtil('2026-10-11'), { segunda: '2026-10-12', sexta: '2026-10-16', foco: '2026-10-12' });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test tests/sate-solicitacao.test.mjs tests/sate-disponibilidade.test.mjs`
Expected: FAIL - `localNoEndereco`/`semanaUtil` não exportados.

- [ ] **Step 4: Implementar em `locais.model.js`**

Trocar o import da linha 18 por `import { norm, semelhanca } from '../../shared/dom.js';`.

Em `locaisParecidos`, trocar a linha do `const nome = …` por:

```js
      // Prefixo de 5 letras (o critério antigo) OU uma letra de diferença
      // (spec 2026-10-02, D13): "Muzeu" e "Theatro" também contam.
      const nome = palavras(l.nome).some(p => nomeAlvo.has(p) || [...nomeAlvo].some(a =>
        a.startsWith(p.slice(0, 5)) || p.startsWith(a.slice(0, 5)) || semelhanca(a, p) !== null));
```

E acrescentar ao fim do arquivo:

```js
// O local cadastrado (ativo) que já ocupa este endereço, ou null. Avisa
// quem digita um local NOVO que o lugar talvez já exista com outro nome
// (spec 2026-10-02, D13). A rua é comparada sem acento, caixa e
// pontuação, com a abreviação do logradouro expandida ("R." = "Rua").
const LOGRADOURO = { r: 'rua', av: 'avenida', al: 'alameda', pc: 'praca', pca: 'praca', rod: 'rodovia', tv: 'travessa', est: 'estrada' };
function chaveRua(s) {
  const p = norm(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  if (p.length && LOGRADOURO[p[0]]) p[0] = LOGRADOURO[p[0]];
  return p.join(' ');
}
const chaveNumero = (n) => norm(n).replace(/\s+/g, '');

export function localNoEndereco(rua, numero, locais) {
  const r = chaveRua(rua), n = chaveNumero(numero);
  if (!r || !n) return null;
  return (locais || []).find(l => l.ativo && chaveRua(l.endereco) === r && chaveNumero(l.numero) === n) || null;
}
```

- [ ] **Step 5: Implementar em `disponibilidade.model.js`**, junto das funções puras (antes de `// ── Leitura`):

```js
// A semana ÚTIL (segunda a sexta) a mostrar para `iso`, e o dia em foco.
// POR ENQUANTO, SEM FIM DE SEMANA (spec 2026-10-02, D9): sábado e domingo
// levam à semana seguinte, com o foco na segunda - é onde está o próximo
// dia útil, e é para frente que a escola planeja. Aritmética de
// calendário: o Date só diz o dia da semana (R8).
export function semanaUtil(iso) {
  const dow = new Date(iso + 'T00:00:00').getDay();   // 0 = domingo
  const foco = dow === 6 ? addDias(iso, 2) : dow === 0 ? addDias(iso, 1) : iso;
  const segunda = addDias(foco, 1 - new Date(foco + 'T00:00:00').getDay());
  return { segunda, sexta: addDias(segunda, 4), foco };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS, inclusive o teste antigo `locaisParecidos: nome sem acento…`.

- [ ] **Step 7: Commit**

```bash
git add src/modules/locais/locais.model.js src/modules/sate/disponibilidade.model.js tests/sate-solicitacao.test.mjs tests/sate-disponibilidade.test.mjs
git commit -m "feat(sate): local no mesmo endereco, parecidos com erro de digitacao e semana util"
```

---

### Task 3: Modal pergunta antes de descartar dado digitado (D6)

**Files:**
- Modify: `src/shared/ui/modal.js`
- Test: `tests/modal.test.mjs` (novo arquivo de teste)

**Interfaces:**
- Produces:
  - `valorDoCampo(el): string | boolean` - `checked` para checkbox/radio, `value` para o resto.
  - `algumMudou(bases: Map<el, valor>): boolean` - algum campo com valor atual diferente da base (ignora `el.isConnected === false`).
  - `abrirModal(html, { voltar, tamanho, protegerSaida })` - `protegerSaida`: `true` | `false` | `null` (padrão = "o corpo tem `<form>`").
  - `fecharModal()` continua exportado e **incondicional**.

- [ ] **Step 1: Teste que falha**

Criar `tests/modal.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { valorDoCampo, algumMudou } from '../src/shared/ui/modal.js';

const campo = (props) => ({ type: 'text', value: '', checked: false, ...props });

test('valorDoCampo: checked para caixa e radio, value para o resto', () => {
  assert.equal(valorDoCampo(campo({ type: 'checkbox', checked: true })), true);
  assert.equal(valorDoCampo(campo({ type: 'radio', checked: false })), false);
  assert.equal(valorDoCampo(campo({ value: 'abc' })), 'abc');
  assert.equal(valorDoCampo(campo({ type: 'select-one', value: '2' })), '2');
});

test('algumMudou: só o que difere da base do primeiro toque', () => {
  const a = campo({ value: 'x' }), b = campo({ type: 'checkbox', checked: false });
  const bases = new Map([[a, 'x'], [b, false]]);
  assert.equal(algumMudou(bases), false);
  a.value = 'xy';
  assert.equal(algumMudou(bases), true);
  a.value = 'x';                       // digitou e apagou: limpo de novo
  assert.equal(algumMudou(bases), false);
  b.checked = true;
  assert.equal(algumMudou(bases), true);
});

test('algumMudou: campo que saiu do DOM não conta; mapa vazio é limpo', () => {
  const a = campo({ value: 'novo', isConnected: false });
  assert.equal(algumMudou(new Map([[a, 'velho']])), false);
  assert.equal(algumMudou(new Map()), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/modal.test.mjs`
Expected: FAIL - exportações inexistentes.

- [ ] **Step 3: Implementar em `modal.js`**

3a. Import: acrescentar `import { confirmar } from './confirmar.js';` (kernel → kernel; `confirmar.js` não importa `modal.js`, sem ciclo).

3b. Depois de `let soltarFoco = null;`, acrescentar:

```js
// ── Dado digitado (spec 2026-10-02, D6) ──────────────────────
// A linha de base de cada campo é tirada no PRIMEIRO TOQUE da pessoa
// (tecla ou ponteiro), não na abertura. Assim digitar e apagar volta a
// "limpo", e um formulário que recebe valores depois de aberto (busca
// carregada, endereço preenchido ao escolher o local) não vira "sujo"
// sozinho: o código mudou campos que a pessoa não tocou.
const CAMPO = 'input, select, textarea';
let bases = new Map();
let proteger = false;

export const valorDoCampo = (el) =>
  (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;

export function algumMudou(mapa) {
  for (const [el, v] of mapa) if (el.isConnected !== false && valorDoCampo(el) !== v) return true;
  return false;
}

// Clique no <label> de uma caixa de seleção também é toque nela.
function aoTocar(e) {
  if (!proteger) return;
  const el = e.target.closest?.(CAMPO) || e.target.closest?.('label')?.control;
  if (!el || bases.has(el) || !el.closest('.modal-body form')) return;
  bases.set(el, valorDoCampo(el));
}

// As quatro portas de DISPENSA pela pessoa - fundo, Esc, × e ← - passam
// por aqui. `fecharModal()` exportado continua direto: quem fecha pelo
// código (depois de salvar) não pergunta nada.
async function tentarFechar() {
  if (proteger && algumMudou(bases)) {
    const descartar = await confirmar('Descartar o que você preencheu?', {
      detalhe: 'Se fechar agora, as informações digitadas serão perdidas.',
      textoOk: 'Descartar', textoCancelar: 'Continuar editando', perigo: true,
    });
    if (!descartar) return;
  }
  fecharModal();
}
```

3c. `montarModal()` passa a ser:

```js
export function montarModal() {
  document.getElementById('modal-back')?.addEventListener('click', aoCliqueFundo);
  // Captura: a base precisa ser lida ANTES de a tecla ou o clique mudar o valor.
  const m = document.getElementById('modal');
  m?.addEventListener('keydown', aoTocar, true);
  m?.addEventListener('pointerdown', aoTocar, true);
}
```

3d. `aoCliqueFundo`: trocar `fecharModal()` por `tentarFechar()`.

3e. Em `abrirModal`:
- assinatura: `export function abrirModal(html, { voltar = null, tamanho = 'medio', protegerSaida = null } = {}) {`
- logo depois de `m.innerHTML = html;`:

```js
  bases = new Map();
  proteger = protegerSaida ?? !!m.querySelector('.modal-body form');
```
- `btn.addEventListener('click', fecharModal);` (voltar) → `btn.addEventListener('click', tentarFechar);`
- `m.querySelector('.modal-close')?.addEventListener('click', fecharModal);` → `…('click', tentarFechar);`
- `prenderFoco(m, { aoEsc: () => fecharModal() })` → `prenderFoco(m, { aoEsc: () => tentarFechar() })`.

3f. Atualizar o comentário de "Uso na view" do cabeçalho com uma linha:
`//   abrirModal(html, { protegerSaida: false });   // formulário que grava na hora`

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 5: Conferir no navegador** (preparar dev-local conforme o cabeçalho)

Em `#/escolas` (tem modal), abrir o formulário de nova escola via `javascript_tool` ou clicando em "Nova escola":
1. sem digitar nada, clicar no fundo → fecha **sem** perguntar;
2. digitar no Nome, clicar no `×` → aparece "Descartar o que você preencheu?", foco em "Continuar editando"; `Esc` → confirmação fecha, **modal continua aberto** com o texto;
3. apagar o que digitou, `Esc` → fecha sem perguntar;
4. digitar, "Descartar" → fecha;
5. abrir a ficha de uma escola (modal sem `<form>`) e fechar pelo fundo → sem pergunta;
6. `read_console_messages` sem erro.

- [ ] **Step 6: Commit** (com o patch de dev-local revertido)

```bash
git add src/shared/ui/modal.js tests/modal.test.mjs
git commit -m "feat(modal): perguntar antes de descartar dado digitado ao fechar"
```

---

### Task 4: Um ícone de ônibus só (D12)

**Files:**
- Modify: `src/shared/ui/icones.js` (remover a entrada `transporte:` de `TRACOS`, linha 25)
- Modify: `tests/icones.test.mjs` (linha 59: tirar `'transporte'` da lista)
- Modify (trocar `ico('transporte'` por `ico('onibus'`, mantendo os parâmetros): `src/modules/dashboard/views/paineis.js:42` e `:58`, `src/modules/escolas/escolas.view.js:66` e `:162`, `src/modules/escolas/views/detalhe.js:65`, `src/modules/sate/views/catalogo.js:26` e `:41`, `src/modules/sate/views/fichas.js:70`, `src/modules/viagens/viagens.view.js:48`

**Interfaces:**
- Produces: `TEM_ICONE('transporte') === false`; `ico('onibus', …)` em todos os lugares que mostram ônibus.

- [ ] **Step 1: Teste que falha** - acrescentar em `tests/icones.test.mjs`:

```js
test('um desenho só para ônibus: o caminhão antigo saiu', () => {
  assert.equal(TEM_ICONE('transporte'), false);
  assert.ok(TEM_ICONE('onibus'));
});
```

- [ ] **Step 2: Rodar e ver falhar** - `node --test tests/icones.test.mjs` → FAIL em "o caminhão antigo saiu".

- [ ] **Step 3: Remover `transporte` de `TRACOS`, tirar `'transporte'` da lista da linha 59 e trocar os 9 usos acima.**

- [ ] **Step 4: Confirmar que não sobrou uso**

Run: `grep -rn "'transporte'" src/`
Expected: nenhuma linha com `ico('transporte'`. (Strings como `tem_transporte`/`'f-transporte'` não são ícone e ficam.)

- [ ] **Step 5: Rodar** `node --test tests/` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/ui/icones.js tests/icones.test.mjs src/modules/dashboard/views/paineis.js src/modules/escolas/escolas.view.js src/modules/escolas/views/detalhe.js src/modules/sate/views/catalogo.js src/modules/sate/views/fichas.js src/modules/viagens/viagens.view.js
git commit -m "fix(icones): onibus unico - sai o caminhao antigo de transporte"
```

---

### Task 5: Grupos, rótulos, foco, fundo e cabeçalho do modal (D1–D5, CSS)

**Files:**
- Modify: `src/styles/tokens.css` (fim do arquivo)
- Modify: `src/styles/components.css` (regras citadas abaixo)
- Modify: `src/modules/horarios/views/jornada.js:335` (`class="form-grupo hj-dia"` → `class="form-grupo plano hj-dia"`)
- Modify: `src/modules/usuarios/usuarios.view.js:190` (o fieldset de "Permissões por módulo": `class="form-grupo"` → `class="form-grupo plano"`)
- Modify: `src/modules/escolas/views/detalhe.js` (cabeçalho e "Nome no SAE")
- Modify: `src/modules/sate/views/formulario.js:55` (`modalHead('Nova solicitação', 'Transporte para atividade extraclasse')` → `modalHead('Nova solicitação')`)

**Interfaces:**
- Produces (tokens): `--overlay`, `--overlay-leve` (`:root`); `--grupo-bg`, `--grupo-borda`, `--cabecalho-bg`, `--cabecalho-borda` (`body`). Classe `.form-grupo.plano`.

- [ ] **Step 1: Medir ANTES, no navegador** (dev-local; `resize_window` 1280×900)

Abrir o modal de nova solicitação: `#/…` não serve, o SATE é `sate.html` - navegar para `http://localhost:8123/sate.html?v=1#/solicitacoes` e clicar em "Nova solicitação" (sem frota em dev-local o aprovador vê a confirmação "cadastre a frota"; nesse caso abrir direto: `(await import('/src/modules/sate/views/formulario.js')).abrirFormulario({ perfil:{unidades:[]}, unidades:[{numero:'1',nome:'Escola Exemplo'}], locais:[], aprovador:false, somenteLeitura:false })`).
Com `javascript_tool`, anotar:

```js
[...document.querySelectorAll('#sol-form fieldset')].map((f, i, a) =>
  i ? Math.round(f.getBoundingClientRect().top - a[i-1].getBoundingClientRect().bottom) : 0)
```
Expected: o intervalo QUANDO→RESPONSÁVEL maior que os outros (confirma a causa do pedido 2e). Anotar também a altura de `#f-periodo` (`getBoundingClientRect().height` e `getComputedStyle(...).marginTop`).

- [ ] **Step 2: Tokens** - acrescentar ao fim de `tokens.css`:

```css
/* Fundo atrás de modal e confirmação (spec 2026-10-02, D4). O desfoque
   (components.css) é o que tira a legibilidade do conteúdo de trás; o
   escurecimento não precisa ir até o preto. --overlay-leve: confirmação
   ABERTA SOBRE um modal - os dois fundos se somariam. */
:root {
  --overlay: rgba(10, 15, 30, .62);
  --overlay-leve: rgba(10, 15, 30, .35);
}
@media (prefers-color-scheme: dark) {
  :root { --overlay: rgba(0, 0, 0, .72); --overlay-leve: rgba(0, 0, 0, .4); }
}

/* Tons DERIVADOS da cor de destaque (spec 2026-10-02, D1 e D5) -
   declarados em `body`, não em `:root`. O SATE troca o --brand no
   <body> (sate.css); uma variável declarada em :root seria calculada
   lá, com o azul do hub, e o SATE verde ganharia cabeçalho azul. É o
   mesmo motivo de sate.css redeclarar --info-bg. */
body {
  --grupo-bg: color-mix(in srgb, var(--brand) 4%, var(--surface));
  --grupo-borda: color-mix(in srgb, var(--brand) 16%, var(--border));
  --cabecalho-bg: color-mix(in srgb, var(--brand) 9%, var(--surface));
  --cabecalho-borda: color-mix(in srgb, var(--brand) 22%, var(--border));
}
@media (prefers-color-scheme: dark) {
  body {
    --grupo-bg: color-mix(in srgb, var(--brand) 7%, var(--surface));
    --grupo-borda: color-mix(in srgb, var(--brand) 26%, var(--border));
    --cabecalho-bg: color-mix(in srgb, var(--brand) 15%, var(--surface));
    --cabecalho-borda: color-mix(in srgb, var(--brand) 32%, var(--border));
  }
}
```

- [ ] **Step 3: D2 - rótulos em caixa normal.** Em `components.css`:
  - no bloco `.lbl, .form-grid label, .esc-form > label, .form-grupo .campos label:not(...)` (linha ~615), trocar `font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;` por `font-size: 12.5px; font-weight: 600;`;
  - no bloco `.filtro-campo { … }` (linha ~221), a mesma troca;
  - acrescentar ao comentário do bloco do `.lbl` uma linha: `Caixa normal desde 02/10/2026 (spec D2): a legenda do grupo é que fica em caixa alta - é o que separa os dois papéis.`

- [ ] **Step 4: D3 - uma borda só no foco.** Substituir os três blocos de foco:
  - `.filtro-campo select:focus, .filtro-campo input:focus { outline…; border-color… }` (linha ~251),
  - `.form-grid input:focus, … .esc-form textarea:focus { … }` (linha ~650),
  - `.auth-form input:focus { … }` (linha ~819, removê-lo desta linha),

  por **uma** regra (no lugar do bloco da linha ~650):

```css
/* Campo em foco: só a borda, na cor de destaque (spec 2026-10-02, D3). O
   anel do :focus-visible global (base.css) tem outline-offset de 2px e,
   somado à borda, desenhava duas linhas. Caixa e rádio ficam de fora: não
   têm borda de campo, e para eles o anel é o indicador. */
:is(.form-grid, .esc-form, .filtro-campo) :is(input:not([type="checkbox"]):not([type="radio"]), select, textarea):focus,
.auth-form input:focus,
.campo-solto:focus {
  outline: none;
  border-color: var(--brand);
}
```

- [ ] **Step 5: D4 - fundo.** Em `.modal-back` (linha ~968) e `.confirmar-back` (linha ~894), trocar `background: rgba(10, 15, 30, .5);` por `background: var(--overlay);`. Acrescentar depois de `.modal-back.open { … }`:

```css
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .modal-back.open, .confirmar-back.open { -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
}
/* Confirmação por cima de modal: o formulário atrás É o contexto da
   pergunta ("Descartar o que você preencheu?") - fundo leve, sem blur. */
body:has(.modal-back.open) .confirmar-back { background: var(--overlay-leve); }
body:has(.modal-back.open) .confirmar-back.open { -webkit-backdrop-filter: none; backdrop-filter: none; }
```

- [ ] **Step 6: D5 - cabeçalho.** No bloco `.modal-head` (linha ~984) acrescentar `background: var(--cabecalho-bg);` e trocar `border-bottom: 1px solid var(--border);` por `border-bottom: 1px solid var(--cabecalho-borda);`. Em `.modal-close` trocar `background: var(--surface-2);` por `background: transparent;` e acrescentar `.modal-close:hover { background: color-mix(in srgb, var(--brand) 14%, transparent); }`. Em `.modal-voltar` trocar `border: 1px solid var(--border);` e `background: var(--surface-2);` por `border: 1px solid var(--cabecalho-borda);` e `background: transparent;`; o hover passa a `background: color-mix(in srgb, var(--brand) 14%, transparent);`. Dentro do `@media (min-width: 560px)` que já tem `.modal { … }`, acrescentar:

```css
  /* O cabeçalho tem fundo próprio: sem o raio, os cantos dele saíam
     quadrados por cima do cartão arredondado. */
  .modal-head { border-radius: calc(var(--radius) - 1px) calc(var(--radius) - 1px) 0 0; }
```

- [ ] **Step 7: D1 - grupos em modal.** Logo depois de `.form-grupo .campos { … }` (linha ~1231):

```css
/* Grupo de formulário DENTRO DE MODAL vira cartão com a legenda na borda
   (spec 2026-10-02, D1). Só em modal: numa página o formulário já mora num
   .panel, e moldura dentro de moldura é poluição.
   Plano (sem moldura): o grupo marcado .plano e o grupo que já traz
   cartões, lista ou tabela - o :has() reconhece o vocabulário de cartão.
   Sem suporte a :has() a regra inteira cai e o grupo fica como na página.
   O seletor longo se repete nas três regras abaixo de propósito: CSS não
   tem variável de seletor, e um nome a mais aqui seria uma classe que
   alguém precisaria lembrar de pôr. */
.modal .form-grupo:not(.plano):not(:has(.card, .person, .people, .solic, .dash-item, .tabela, .panel, .tiles)) {
  min-width: 0;
  margin: 0 0 16px;
  padding: 6px 14px 16px;
  border: 1px solid var(--grupo-borda);
  border-radius: var(--radius);
  background: var(--grupo-bg);
}
.modal .form-grupo:not(.plano):not(:has(.card, .person, .people, .solic, .dash-item, .tabela, .panel, .tiles)) > legend {
  width: auto;
  padding: 0 6px;
  margin: 0 0 6px -6px;
  border-bottom: 0;
}
/* Campo mais claro que o grupo: é o que o separa do fundo tingido. */
.modal .form-grupo:not(.plano):not(:has(.card, .person, .people, .solic, .dash-item, .tabela, .panel, .tiles))
  :is(input:not([type="checkbox"]):not([type="radio"]), select, textarea, .search) {
  background: var(--surface);
}

/* Elemento de dica que ainda não tem texto (o período calculado antes dos
   horários) não ocupa linha da grade nem margem (spec 2026-10-02, D1/2e). */
.form-hint:empty { display: none; }
```

- [ ] **Step 8: Ficha da escola (D5).** Em `src/modules/escolas/views/detalhe.js`:
  - import: `import { esc, norm } from '../../../shared/dom.js';`
  - linha 72: `${modalHead(esc(u.nome), esc(u.nome_oficial || ''))}` → `${modalHead(`<span class="nome-oficial">${esc(u.nome)}</span>`)}`
  - no bloco "Cadastros e links", antes de `campo('INEP', …)`:

```js
      ${u.nome_oficial && norm(u.nome_oficial).trim() !== norm(u.nome).trim()
        ? campo('Nome no SAE', esc(u.nome_oficial)) : ''}
```
  - acrescentar ao comentário do topo do arquivo: `O cabeçalho mostra só o nome; o nome no SAE vai para "Cadastros e links" quando difere (spec 2026-10-02, D5).`

- [ ] **Step 9: `.plano`** nos dois arquivos listados em Files, e o `modalHead` da Nova solicitação.

- [ ] **Step 10: Conferir no navegador** - 1280px e 375px, claro e escuro (`resize_window` com `colorScheme`):
  1. Nova solicitação: grupos com borda arredondada, legenda sobre a borda, campos mais claros que o grupo; repetir a medição do Step 1 → **todos os intervalos iguais (16px)**; cabeçalho só "Nova solicitação", tingido;
  2. no SATE, trocar a cor em Configurações (ex.: vinho) e reabrir: cabeçalho e grupos seguem a cor;
  3. foco num campo: `getComputedStyle(el).outlineStyle === 'none'` e `borderColor` = brand; caixa de seleção ainda com anel;
  4. fundo do modal escurecido e desfocado; abrir a confirmação de descarte (digitar e `Esc`): fundo leve sobre o modal;
  5. `#/horarios` → Jornada da semana: dias **sem** moldura; `#/usuarios` → editar acesso: "Permissões por módulo" sem moldura, os outros três com;
  6. ficha de uma escola: cabeçalho só com o nome; "Nome no SAE" aparece só se diferente;
  7. Meus dados (página): grupos **como antes** (sem moldura);
  8. rótulos de formulário e de filtro (`#/afastamentos`) em caixa normal;
  9. console sem erro.

- [ ] **Step 11: Commit** (dev-local revertido)

```bash
git add src/styles/tokens.css src/styles/components.css src/modules/horarios/views/jornada.js src/modules/usuarios/usuarios.view.js src/modules/escolas/views/detalhe.js src/modules/sate/views/formulario.js
git commit -m "feat(ui): grupos de modal com legenda na borda, rotulos em caixa normal, foco com uma borda, fundo e cabecalho do modal"
```

---

### Task 6: Caixa de busca com quadrado de lupa e lista alinhada (D7)

**Files:**
- Modify: `src/styles/components.css` (`.search` linha ~167; `.tabela-topo .search` linha ~1086; bloco "Busca com seleção" linha ~1560; `.toolbar > div:has(> .bs)` linha ~162 fica)
- Modify: `src/shared/ui/busca-selecao.js` (widget inteiro abaixo de `aproximarOpcoes`)

**Interfaces:**
- Consumes: `filtrarOpcoes`, `aproximarOpcoes` (Task 1).
- Produces: `criarBuscaSelecao(el, { opcoes, valor, placeholder, vazioTexto, onChange, rotulo = '', criar = null })`, onde
  `criar = { etiqueta: string, rotulo(termo: string, haOutros: boolean): string, aoCriar(termo: string): void }`.
  Retorno: `{ definirOpcoes, definirValor, valorAtual, destruir }` (mesmo de hoje). `definirValor` e escolher um item limpam o "criado".
  O input ganha `id` gerado (`bs-<n>`) e a lista `id="bs-<n>-lista"`.

- [ ] **Step 1: Medir ANTES** (dev-local, 1280px): no modal de Nova solicitação, focar o campo Local, digitar uma letra e anotar

```js
const c = document.querySelector('#f-local-busca .bs-campo').getBoundingClientRect();
const l = document.querySelector('#f-local-busca .bs-lista').getBoundingClientRect();
({ campo: [c.left, c.width, c.height], lista: [l.left, l.width] })
```
(o widget aparece sem locais em dev-local; para ter itens, passar `locais:[{id:'1',nome:'Museu Exemplo',endereco:'Rua Exemplo',numero:'10',bairro:'Centro',ativo:true}]` no `abrirFormulario` do Step 1 da Task 5).

- [ ] **Step 2: CSS da busca.** Substituir o bloco `.search { … }` (linha ~167) e `.search input { … }` por:

```css
/* Caixa de busca: UM controle (spec 2026-10-02, D7). A lupa mora num
   quadrado de fundo próprio à esquerda, separado do texto por um fio.
   O quadrado é o próprio <svg>: lado = altura - 2px de borda, e o padding
   empurra o desenho de 16px para o centro geométrico - não depende de
   line-height. Altura FIXA (height, não min-height): com min-height o
   controle podia crescer e o quadrado ficaria para trás. O fio é sombra
   interna, e não borda, para não tirar meio pixel do centro. */
.search {
  --lado: calc(var(--toque) - 2px);
  flex: 1 1 100%;
  display: flex;
  align-items: center;
  height: var(--toque);
  padding: 0 6px 0 0;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 11px;
  box-shadow: var(--shadow);
}
.search > .ico:first-child {
  width: var(--lado);
  height: var(--lado);
  padding: calc((var(--lado) - 16px) / 2);
  background: var(--surface-3);
  box-shadow: inset -1px 0 0 var(--border);
  color: var(--muted);
}
.search:focus-within { border-color: var(--brand); }
.search input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  padding: 0 10px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-size: var(--campo-fonte);   /* 16px em toque: evita o zoom do iOS */
}
/* Dentro de formulário a busca é mais um campo: altura, raio e fundo dos
   vizinhos, sem sombra. Antes saía com 40px contra 36px e sombra. */
:is(.esc-form, .form-grid, .form-grupo) .search {
  --lado: calc(var(--campo) - 2px);
  height: var(--campo);
  border-radius: var(--radius-btn);
  background: var(--surface-2);
  box-shadow: none;
}
```
Remover a regra `.search.compacta { flex: 0 0 auto; }` e o comentário dela **só na Task 7** (os usos ainda existem até lá).

No bloco `.tabela-topo .search` (linha ~1086), trocar `min-height: var(--campo); padding: 4px 10px;` por `--lado: calc(var(--campo) - 2px); height: var(--campo);`.

- [ ] **Step 3: CSS do widget.** Substituir o bloco "Busca com seleção" (linha ~1560 até o fim do arquivo) por:

```css
/* ── Busca com seleção (shared/ui/busca-selecao.js) ──────────
   A lista ancora em .bs-ancora, que contém SÓ o controle e a lista: com
   left/right 0 ela tem exatamente a largura e o left do campo, em
   qualquer contexto (spec 2026-10-02, D7). Antes ancorava em .bs, cuja
   largura vinha de um flex pensado para a toolbar. */
.bs { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.toolbar .bs { flex: 1 1 260px; }
.bs-ancora { position: relative; }
.bs-campo { width: 100%; }
.bs-novo { flex: 0 0 auto; margin-right: 4px; }
.bs-limpar {
  display: inline-flex; align-items: center; justify-content: center;
  flex: 0 0 auto; width: 22px; height: 22px; border: 0; border-radius: 6px;
  background: none; color: var(--muted); cursor: pointer;
}
.bs-limpar:hover { background: var(--surface-3); color: var(--text); }
.bs-lista {
  position: absolute; z-index: 60; top: calc(100% + 4px); left: 0; right: 0;
  max-height: 300px; overflow-y: auto; margin: 0; padding: 4px; list-style: none;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-btn); box-shadow: var(--shadow);
}
.toolbar .bs-lista { border-radius: 11px; }
.bs-item {
  display: flex; align-items: baseline; gap: 8px;
  padding: 8px 10px; border-radius: 8px; cursor: pointer;
}
.bs-item.on { background: var(--surface-3); }
.bs-rot { font-size: 14px; }
.bs-det { margin-left: auto; color: var(--muted); font-size: 12px; }
.bs-nada { padding: 14px 10px; color: var(--muted); font-size: 13px; text-align: center; }
/* "Parecidos": a busca exata não achou nada e estes estão a uma letra. */
.bs-sub { padding: 6px 10px 2px; color: var(--muted); font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
/* Criar um item novo: o último da lista. Apagado quando há itens acima -
   o duplicado exige escolha deliberada (spec 2026-10-02, D13). */
.bs-criar { align-items: center; margin-top: 4px; border-top: 1px solid var(--border); border-radius: 0 0 8px 8px; color: var(--brand); }
.bs-criar:first-child { margin-top: 0; border-top: 0; border-radius: 8px; }
.bs-criar.apagado { color: var(--muted); }
@media (pointer: coarse) { .bs-item { min-height: var(--toque); align-items: center; } }
```

- [ ] **Step 4: Reescrever o widget.** Em `busca-selecao.js`, acrescentar ao cabeçalho do arquivo (depois da linha "busca - texto extra…"):

```js
//
// Opções do widget (spec 2026-10-02, D7 e D13):
//   rotulo - desenha o rótulo do campo (`.lbl`, com `for`): o formulário
//            fica com UM elemento, sem invólucro;
//   criar  - { etiqueta, rotulo(termo, haOutros), aoCriar(termo) }: último
//            item da lista, para aceitar o texto digitado como item NOVO.
// A lista abre por GESTO (clique, digitação, seta) e não pelo foco: um
// modal que começa por uma busca nasceria com a lista aberta (ARIA APG).
```

Trocar a função `criarBuscaSelecao` inteira por:

```js
let seq = 0;

export function criarBuscaSelecao(el, {
  opcoes = [], valor = '', placeholder = 'Buscar...', rotulo = '',
  vazioTexto = 'Nada encontrado', onChange = () => {}, criar = null,
} = {}) {
  let todas = [...opcoes];
  // Mesma guarda de definirValor: um valor inicial que não está em
  // `opcoes` não vira escolha (a mesma porta de entrada, o construtor).
  let escolhido = todas.some(o => o.id === valor) ? (valor || '') : '';
  let criado = '';    // texto aceito como item NOVO (criar), ou ''
  let destaque = -1;
  let visiveis = [];  // [{ o } | { criar: termo }], na ordem da lista
  const id = `bs-${++seq}`;

  el.innerHTML = `
    <div class="bs">
      ${rotulo ? `<label class="lbl" for="${id}">${esc(rotulo)}</label>` : ''}
      <div class="bs-ancora">
        <label class="search bs-campo">
          ${ico('buscar')}
          <input type="text" id="${id}" class="bs-input" role="combobox" aria-expanded="false"
                 aria-controls="${id}-lista" aria-autocomplete="list" autocomplete="off"
                 placeholder="${esc(placeholder)}" />
          <span class="tag bs-novo" hidden>${esc(criar?.etiqueta || 'Novo')}</span>
          <button type="button" class="bs-limpar" aria-label="Limpar" hidden>${ico('fechar', { tam: 14 })}</button>
        </label>
        <ul class="bs-lista" id="${id}-lista" role="listbox" hidden></ul>
      </div>
    </div>`;

  const input = el.querySelector('.bs-input');
  const lista = el.querySelector('.bs-lista');
  const limpar = el.querySelector('.bs-limpar');
  const novo = el.querySelector('.bs-novo');

  const rotuloDe = (oid) => todas.find(o => o.id === oid)?.rotulo || '';

  function pintarCampo() {
    input.value = escolhido ? rotuloDe(escolhido) : criado;
    limpar.hidden = !(escolhido || criado);
    novo.hidden = !criado;
  }

  // Exatas primeiro; aproximadas só se a exata não achou nada; o item de
  // criar por último. O destaque vai para o PRIMEIRO item - que só é o de
  // criar quando ele é o único.
  function abrir(termo) {
    const eraFechada = lista.hidden;
    const t = String(termo || '').trim();
    const exatas = filtrarOpcoes(todas, t);
    const aprox = exatas.length ? [] : aproximarOpcoes(todas, t);
    const haOutros = exatas.length + aprox.length > 0;
    const podeCriar = !!criar && t.length >= 3 && !todas.some(o => norm(o.rotulo).trim() === norm(t));
    visiveis = [...exatas, ...aprox].map(o => ({ o }));
    if (podeCriar) visiveis.push({ criar: t });
    destaque = visiveis.length ? 0 : -1;

    const item = (v, i) => {
      const on = i === destaque;
      if (v.criar !== undefined) {
        return `<li class="bs-item bs-criar ${haOutros ? 'apagado' : ''} ${on ? 'on' : ''}" role="option"
                    aria-selected="${on}" data-i="${i}">${ico('adicionar', { tam: 14 })}
                  <span class="bs-rot">${esc(criar.rotulo(v.criar, haOutros))}</span></li>`;
      }
      return `<li class="bs-item ${on ? 'on' : ''}" role="option" aria-selected="${on}" data-i="${i}">
                <span class="bs-rot">${esc(v.o.rotulo)}</span>
                ${v.o.detalhe ? `<span class="bs-det">${esc(v.o.detalhe)}</span>` : ''}</li>`;
    };
    const linhas = visiveis.map(item);
    if (aprox.length) linhas.unshift('<li class="bs-sub" role="presentation">Parecidos</li>');
    lista.innerHTML = linhas.length ? linhas.join('') : `<li class="bs-nada">${esc(vazioTexto)}</li>`;
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    // Dentro de modal o corpo rola e corta o que passa da base.
    if (eraFechada && el.closest('.modal-body')) lista.scrollIntoView({ block: 'nearest' });
  }

  function fechar() {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    pintarCampo();
  }

  function escolher(oid) {
    escolhido = oid;
    criado = '';
    fechar();
    onChange(oid);
  }

  function escolherIndice(i) {
    const v = visiveis[i];
    if (!v) return;
    if (v.criar === undefined) { escolher(v.o.id); return; }
    escolhido = '';
    criado = v.criar;
    fechar();
    criar.aoCriar(v.criar);
  }

  function mover(passo) {
    if (lista.hidden) { abrir(''); return; }
    if (!visiveis.length) return;
    destaque = (destaque + passo + visiveis.length) % visiveis.length;
    [...lista.querySelectorAll('.bs-item')].forEach((li, i) => {
      li.classList.toggle('on', i === destaque);
      li.setAttribute('aria-selected', String(i === destaque));
    });
    lista.querySelector('.bs-item.on')?.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('click', () => { if (lista.hidden) abrir(''); });
  input.addEventListener('input', () => abrir(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
    else if (e.key === 'Enter') {
      if (!lista.hidden && visiveis[destaque]) { e.preventDefault(); escolherIndice(destaque); }
    } else if (e.key === 'Escape') {
      // Lista aberta: o Esc é dela, e o modal em volta fica aberto (o
      // preventDefault é o sinal que foco.js respeita). Lista fechada: o
      // Esc segue adiante e fecha a superfície, como em qualquer campo.
      if (!lista.hidden) { e.preventDefault(); fechar(); }
      else input.blur();
    }
  });
  lista.addEventListener('mousedown', (e) => {
    // mousedown e não click: o blur do input fecharia a lista antes.
    const li = e.target.closest('.bs-item'); if (!li) return;
    e.preventDefault();
    escolherIndice(Number(li.dataset.i));
  });
  limpar.addEventListener('click', () => escolher(''));
  // Nomeada (não inline) para poder ser removida em destruir() - um
  // listener de document por instância que nunca sai retém `el` (e a
  // subárvore inteira) para sempre numa SPA que repinta a cada rota.
  function aoClicarFora(e) { if (!el.contains(e.target)) fechar(); }
  document.addEventListener('click', aoClicarFora);

  pintarCampo();

  return {
    definirOpcoes(lst) { todas = [...(lst || [])]; if (!todas.some(o => o.id === escolhido)) escolhido = ''; pintarCampo(); },
    // Mesma simetria de definirOpcoes: um id que não está na lista
    // atual não vira escolha - senão o campo mostra "nada selecionado"
    // enquanto valorAtual() ainda devolve um id fantasma.
    definirValor(oid) { escolhido = todas.some(o => o.id === oid) ? (oid || '') : ''; criado = ''; pintarCampo(); },
    valorAtual() { return escolhido; },
    // Chamar ao descartar a instância (troca de aba/rota) - sem isso o
    // listener de document acima sobrevive ao componente.
    destruir() { document.removeEventListener('click', aoClicarFora); },
  };
}
```

- [ ] **Step 5: Rodar** `node --test tests/` → PASS (as funções puras não mudaram).

- [ ] **Step 6: Conferir no navegador** (1280px, depois 375px; claro e escuro):
  1. repetir a medição do Step 1 → `lista.left === campo.left` e `lista.width === campo.width` (diferença 0);
  2. quadrado da lupa centrado: o centro do `<svg>` (`getBoundingClientRect`) coincide com o centro vertical do controle (±0.5px) e o quadrado tem lado = altura do controle − 2;
  3. focar o campo pelo Tab **não** abre a lista; clicar abre; `↓` abre; digitar abre;
  4. digitar "muzeu" → aparece "PARECIDOS" e "Museu Exemplo";
  5. buscas de toolbar em `#/escolas`, `#/servidores`, `#/afastamentos` e a busca de tabela em `#/usuarios`: quadrado da lupa, foco com borda, nada quebrado;
  6. `#/horarios` (Por escola) e Ver como escola do SATE: escolher e limpar continuam funcionando;
  7. console sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/styles/components.css src/shared/ui/busca-selecao.js
git commit -m "feat(busca): quadrado de lupa, lista alinhada ao campo, parecidos e item de criar"
```

---

### Task 7: Controle solto - data, período e ano sem ícone duplicado (D8)

**Files:**
- Modify: `src/styles/components.css` (perto da regra estrutural da R17, linha ~478; remover `.search.compacta` e o comentário dela, linha ~179)
- Modify: `src/modules/sate/views/fichas.js:30-39`
- Modify: `src/modules/sate/views/disponibilidade.js:46-47`
- Modify: `src/modules/viagens/viagens.view.js:25-28`
- Modify: `src/modules/dashboard/views/hoje.js:31-32`, `src/modules/dashboard/dashboard.css:27`
- Modify: `src/modules/calendario/views/escalas.js:53-55`

**Interfaces:**
- Produces: classe `.campo-solto` (em `input[type=date]`, `input[type=number]` ou `select`, sem `<label>` em volta, com `aria-label`).

- [ ] **Step 1: CSS.** Logo depois de `:is(div, form):has(> input, > select) > .mini-btn { min-height: var(--campo); }` (linha ~478):

```css
/* Controle solto (spec 2026-10-02, D8): um campo nativo SOZINHO numa barra
   - a data da Disponibilidade, data e período das Fichas, o ano das
   Escalas. Aparência de campo de formulário, sem <label> de caixa em volta
   (o nome vai em aria-label). Substituiu `.search.compacta`, que vestia o
   campo de caixa de busca: ícone de calendário repetido (o type="date" já
   traz o dele) e moldura dupla no <select>.
   Data e select têm a MESMA largura: é o que alinha "data + período". Em
   tela estreita, os soltos da mesma barra dividem a linha. */
.campo-solto {
  width: 11rem;
  max-width: 100%;
  height: var(--campo);
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background: var(--surface);
  color: var(--form-field);
  font: inherit;
  font-size: var(--campo-fonte);
  line-height: 1.25;
}
.campo-solto[type="number"] { width: 6rem; }
.toolbar > .campo-solto { flex: 1 1 9rem; min-width: 0; }
.toolbar > .campo-solto[type="number"] { flex: 0 0 6rem; }
@media (min-width: 560px) {
  .toolbar > .campo-solto { flex: 0 0 11rem; }
}
/* R17 estendida: botão na mesma barra de um controle solto tem a altura do
   campo (o .mini-btn já ganha pela regra estrutural acima). A busca da
   mesma barra também desce para --campo, senão a linha teria 40 e 36px. */
.toolbar:has(> .campo-solto) > :is(.btn-primary, .btn-secundario) { min-height: var(--campo); }
.toolbar:has(> .campo-solto) .search { --lado: calc(var(--campo) - 2px); height: var(--campo); }
```

E remover o bloco `/* Variante compacta… */ .search.compacta { flex: 0 0 auto; }`.

- [ ] **Step 2: Markup** - trocar exatamente:

`fichas.js` (dentro de `<div class="toolbar no-print">`):
```html
      <input id="fi-data" class="campo-solto" type="date" value="${esc(filtro.data)}" aria-label="Data" />
      <select id="fi-per" class="campo-solto" aria-label="Período">
        <option value="">Todos os períodos</option>
        ${Object.entries(PERIODOS).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}
      </select>
      <button id="fi-imprimir" class="btn-primary">${ico('imprimir')} Imprimir</button>
```

`disponibilidade.js` (as duas linhas do `<label class="search compacta">`):
```html
      <input id="disp-data" class="campo-solto" type="date" aria-label="Ir para a data" />
```

`viagens.view.js` (o `<label class="search compacta">…</label>` de três linhas):
```html
      <input id="pv-data" class="campo-solto" type="date" value="${dataSel}" aria-label="Data" />
```

`hoje.js`:
```html
    <input type="date" id="hoje-dia" class="campo-solto hoje-data" value="${esc(data)}" aria-label="Data" />
```
e em `dashboard.css`: `.hoje-data { max-width: 220px; margin-bottom: 8px; }` → `.hoje-data { display: block; margin-bottom: 8px; }`.

`escalas.js` (o `<label class="search compacta">…</label>` do ano):
```html
      <input type="number" id="cal-esc-ano" class="campo-solto" min="2020" max="2099" value="${ano}" aria-label="Ano" />
```

Se `ico` deixar de ser usado em algum desses arquivos, **manter** o import só se ainda houver outro uso (conferir com `grep -n "ico(" <arquivo>`).

- [ ] **Step 3: Confirmar que não sobrou**

Run: `grep -rn "compacta" src/`
Expected: nenhuma linha.

- [ ] **Step 4: Conferir no navegador** (1280px e 375px, claro e escuro): Fichas (data e período com a mesma largura, uma moldura só, "Imprimir" com a altura dos campos), Disponibilidade (sem ícone de calendário repetido; setas e "Hoje" na altura do campo), Viagens, painel Hoje do dashboard, Escalas (ano). Foco com uma borda. Console sem erro.

- [ ] **Step 5: Rodar** `python .claude/scripts/verificar_arquitetura.py` → sem bloqueio (checagem 12: `campo-solto` tem regra).

- [ ] **Step 6: Commit**

```bash
git add src/styles/components.css src/modules/sate/views/fichas.js src/modules/sate/views/disponibilidade.js src/modules/viagens/viagens.view.js src/modules/dashboard/views/hoje.js src/modules/dashboard/dashboard.css src/modules/calendario/views/escalas.js
git commit -m "fix(ui): controle solto para data, periodo e ano - sem icone duplicado e com largura certa"
```

---

### Task 8: Páginas do SATE - Frota, Solicitações e Disponibilidade (D9–D11)

**Files:**
- Modify: `src/modules/sate/views/frota.js:36-37`
- Modify: `src/modules/sate/sate.view.js:27-28` e `:57`
- Modify: `src/modules/sate/views/disponibilidade.js`
- Modify: `src/modules/sate/sate.css` (bloco "Página Disponibilidade", linha ~321)

**Interfaces:**
- Consumes: `semanaUtil(iso)` (Task 2); `.campo-solto` `#disp-data` (Task 7).

- [ ] **Step 1: Frota (D10).** Trocar as linhas 36-37 por:

```js
// Filtro de sessão da página: sobrevive à troca de página, não ao recarregar.
// "Todas" é o padrão e vem primeiro (spec 2026-10-02, D10): quem abre a
// página quer ver o que existe, e uma frota futura escondida parecia sumida.
const filtro = { situacao: 'todas', tipo: '', de: '', ate: '' };
const CHIPS = [['todas', 'Todas'], ['vigente', 'Vigentes'], ['futura', 'Futuras'], ['encerrada', 'Encerradas']];
```
(a linha de comentário original "Filtro de sessão…" é substituída por este bloco).

- [ ] **Step 2: Solicitações (D11).** Em `sate.view.js`:
  - linha 27-28: `solicitacoes: { rotulo: 'Solicitações', ico: 'documento', view: paginaSolicitacoes },` (sem `desc`);
  - linha 25 (comentário): acrescentar `` `desc` é opcional: sem ela, a página não tem frase de apoio. ``;
  - linha 57: `<p>${esc(pagina.desc)}</p>` → `${pagina.desc ? `<p>${esc(pagina.desc)}</p>` : ''}`.

- [ ] **Step 3: Disponibilidade (D9).** Em `disponibilidade.js`:

3a. Import: `import { lerOcupacao, livresNoPeriodo, escadaDaTarde, totalDoDia, semanaUtil } from '../disponibilidade.model.js';`

3b. Trocar a função `segundaDe` e as variáveis do topo por:

```js
let ctx = null;
let segunda = null;   // data civil da segunda-feira da semana à vista
let foco = null;      // o dia destacado: a data escolhida ou, sem escolha, hoje
let linhaAtual = null;   // última ocupação carregada SEM ficar velha (ver `pedido`)
// Cada carregar() recebe um número: clicar "próxima semana" duas vezes
// rápido dispara duas buscas, e sem isto a resposta da primeira - mais
// lenta - pintaria por cima da segunda, com o cabeçalho de uma semana e
// os números de outra (mesmo padrão de `pedidoSaldo` em formulario.js).
let pedido = 0;
// POR ENQUANTO, SEM FIM DE SEMANA (spec 2026-10-02, D9): deslocamentos a
// partir da segunda. A volta do sábado e do domingo é aqui e em
// semanaUtil() (disponibilidade.model.js).
const DIAS_UTEIS = [0, 1, 2, 3, 4];
```

3c. Em `render`, trocar `segunda = segunda || segundaDe(hojeISO());` por:

```js
  if (!foco) ({ segunda, foco } = semanaUtil(hojeISO()));
```
e os quatro ouvintes de navegação por:

```js
  // Escolher uma data (ou "Hoje") muda o FOCO e leva à semana dele; as
  // setas só trocam a semana - o foco fica onde a pessoa o pôs.
  const focar = (iso) => { ({ segunda, foco } = semanaUtil(iso)); carregar(); };
  const ir = (nova) => { segunda = nova; carregar(); };
  document.getElementById('disp-ant').addEventListener('click', () => ir(addDias(segunda, -7)));
  document.getElementById('disp-prox').addEventListener('click', () => ir(addDias(segunda, 7)));
  document.getElementById('disp-hoje').addEventListener('click', () => focar(hojeISO()));
  document.getElementById('disp-data').addEventListener('change', (e) => { if (e.target.value) focar(e.target.value); });
```

3d. Em `carregar`, trocar:
- `const domingo = addDias(seg, 6);` → `const sexta = addDias(seg, DIAS_UTEIS[DIAS_UTEIS.length - 1]);`
- `lerOcupacao(seg, domingo)` → `lerOcupacao(seg, sexta)`
- `const dias = [0, 1, 2, 3, 4, 5, 6].map(i => ({ i, data: addDias(seg, i) }));` → `const dias = DIAS_UTEIS.map(i => ({ i, data: addDias(seg, i) }));`
- no título: `${esc(fmtData(domingo))}` → `${esc(fmtData(sexta))}`
- logo antes de `box.innerHTML = …`: `const campoData = document.getElementById('disp-data'); if (campoData) campoData.value = foco;` (o campo mostra o dia em foco).

3e. Em `diaHtml`, depois de `const passado = data < hoje;`:

```js
  // O dia em foco, na cor do SATE (o --brand do <body>). aria-current diz
  // ao leitor de tela o que o destaque diz ao olho.
  const emFoco = data === foco;
  const marca = `${passado ? 'passado' : ''} ${emFoco ? 'foco' : ''}`;
  const atual = emFoco ? ' aria-current="date"' : '';
```
e trocar as duas aberturas de cartão:
- `<div class="disp-dia ${passado ? 'passado' : ''}">${cab}<span class="vazio">sem frota</span></div>` → `<div class="disp-dia ${marca}"${atual}>${cab}<span class="vazio">sem frota</span></div>`
- `<div class="disp-dia ${passado ? 'passado' : ''} ${ctx.aprovador ? 'clicavel' : ''}"${abrir}>` → `<div class="disp-dia ${marca} ${ctx.aprovador ? 'clicavel' : ''}"${abrir}${atual}>`

3f. Atualizar o comentário do topo do arquivo: "Uma semana por vez" → "Uma semana útil por vez (segunda a sexta, por enquanto), com o dia em foco destacado".

- [ ] **Step 4: CSS (`sate.css`).** Trocar as duas linhas de `@media` da `.disp-grade` por:

```css
@media (min-width: 720px)  { .disp-grade { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 900px)  { .disp-grade { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1280px) { .disp-grade { grid-template-columns: repeat(5, 1fr); } }
```
e acrescentar depois de `.disp-dia.clicavel:focus-visible { … }`:

```css
/* Dia em foco (spec 2026-10-02, D9): borda + anel interno de 1px na cor do
   SATE, e fundo tingido. Um dia passado em foco perde o esmaecimento - se
   a pessoa pediu para vê-lo, ele tem que ser legível. */
.disp-dia.foco {
  border-color: var(--brand);
  box-shadow: inset 0 0 0 1px var(--brand);
  background: color-mix(in srgb, var(--brand) 8%, var(--surface));
  opacity: 1;
}
```

- [ ] **Step 5: Rodar** `node --test tests/` → PASS.

- [ ] **Step 6: Conferir no navegador** (sate.html, 1280px e 375px):
  1. Frota abre com "Todas" marcado, primeiro chip;
  2. Solicitações sem a frase sob o título, botão "Nova solicitação" à esquerda; Disponibilidade e as demais mantêm a frase;
  3. Disponibilidade: 5 cartões; hoje destacado e o campo mostrando hoje (num fim de semana: a segunda seguinte); escolher uma quarta → destaque nela; setas → semana muda, voltar → destaque ainda lá; "Hoje" → volta; escolher um sábado → semana seguinte, segunda destacada;
  4. trocar a cor do SATE nas Configurações → o destaque segue;
  5. console sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/modules/sate/views/frota.js src/modules/sate/sate.view.js src/modules/sate/views/disponibilidade.js src/modules/sate/sate.css
git commit -m "feat(sate): frota abre em Todas, solicitacoes sem frase de apoio, disponibilidade util com dia em foco"
```

---

### Task 9: Modal "Nova solicitação" - escola por busca e local novo inteligente (D13)

**Files:**
- Modify: `src/modules/sate/views/formulario-destino.js` (reescrita)
- Modify: `src/modules/sate/views/formulario.js`
- Modify: `src/modules/sate/sate.css` (bloco do grupo DESTINO, linha ~84)

**Interfaces:**
- Consumes: `criarBuscaSelecao(el, { rotulo, criar, … })` (Task 6); `localNoEndereco`, `enderecoCompleto` (Task 2 / existente).
- Produces (mesmo contrato de hoje para `formulario.js`): `destinoHtml()`, `ligarDestino(locais, aoMudar)`, `lerDestino() → { localId, local, nome, endereco, numero, bairro }`, `validarDestino(d) → string | null`.

- [ ] **Step 1: Reescrever `formulario-destino.js`:**

```js
// ============================================================
// FundHub - sate/views/formulario-destino.js
// O grupo DESTINO do modal de solicitação (spec 2026-09-27, D2; refeito
// na spec 2026-10-02, D13). Separado de formulario.js por ter estado e
// contrato próprios: o local escolhido ou o local NOVO digitado - o
// formulário só pergunta "qual é o destino?" e "está válido?".
//
// Não há mais botão "Local não está na lista" nem modo alternado. O campo
// Local é a única entrada: a busca acha o cadastrado (inclusive com erro
// de digitação) e o último item da lista aceita o texto como local novo.
// Contra duplicata, três camadas sem clique a mais: a lista mostra o que
// existe onde o olhar já está; criar fica atrás de uma escolha
// deliberada quando há parecidos; e o endereço denuncia o mesmo lugar
// com outro nome. O backstop é o "Conferir local" da Gerência.
// ============================================================
import { enderecoCompleto, localNoEndereco } from '../../locais/locais.model.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { esc, val } from '../../../shared/dom.js';

let locaisAtivos = [];
let escolhido = null;   // Local do cadastro, ou null
let novoNome = null;    // nome digitado aceito como local NOVO, ou null
let bs = null;          // handle de criarBuscaSelecao - destruído antes de
                        // recriar (senão cada abertura do modal deixa um
                        // listener de document a mais)
let aoMudar = () => {};

const ENDERECO = ['f-dest-end', 'f-dest-num', 'f-dest-bairro'];

export const destinoHtml = () => `
  <fieldset class="form-grupo">
    <legend>Destino</legend>
    <div class="campos duas">
      <div id="f-local" class="col-2"></div>
      <label class="col-2">Endereço <input id="f-dest-end" type="text" placeholder="Ex.: Rua Exemplo" readonly /></label>
      <label>Número <input id="f-dest-num" type="text" inputmode="numeric" placeholder="Ex.: 123" readonly /></label>
      <label>Bairro <input id="f-dest-bairro" type="text" placeholder="Ex.: Centro" readonly /></label>
      <div class="col-2 dest-mesmo" id="f-dest-mesmo" aria-live="polite"></div>
    </div>
  </fieldset>`;

const campo = (id) => document.getElementById(id);

function preencher(l) {
  campo('f-dest-end').value = l?.endereco || '';
  campo('f-dest-num').value = l?.numero || '';
  campo('f-dest-bairro').value = l?.bairro || '';
}

// Local do cadastro: endereço só leitura (vem do cadastro). Local novo:
// os três campos destravam e passam a ser obrigatórios.
function destravar(novo) {
  for (const id of ENDERECO) campo(id).readOnly = !novo;
}

function usarCadastrado(l) {
  escolhido = l; novoNome = null;
  preencher(l); destravar(false); pintarMesmo();
  aoMudar();
}

// Mesmo lugar com outro nome: o endereço digitado já é de um local
// cadastrado. Aviso discreto com um clique, nunca bloqueio - dois nomes
// num endereço às vezes são dois lugares.
function pintarMesmo() {
  const box = campo('f-dest-mesmo');
  const l = novoNome ? localNoEndereco(val('f-dest-end'), val('f-dest-num'), locaisAtivos) : null;
  box.innerHTML = l
    ? `<p class="form-hint">Este endereço já é de <b>${esc(l.nome)}</b>.
         <button type="button" class="mini-btn" data-usar="${esc(l.id)}">Usar este</button></p>`
    : '';
}

export function ligarDestino(locais, mudou) {
  bs?.destruir();
  aoMudar = mudou;
  locaisAtivos = (locais || []).filter(l => l.ativo);
  escolhido = null; novoNome = null;
  bs = criarBuscaSelecao(campo('f-local'), {
    rotulo: 'Local',
    opcoes: locaisAtivos.map(l => ({ id: l.id, rotulo: l.nome, detalhe: enderecoCompleto(l), busca: l.bairro || '' })),
    placeholder: 'Digite o nome do local…',
    vazioTexto: 'Digite ao menos 3 letras para cadastrar um local novo',
    criar: {
      etiqueta: 'Novo local',
      rotulo: (termo, haOutros) => (haOutros ? `Nenhum destes? Cadastrar “${termo}”` : `Usar “${termo}” como novo local`),
      aoCriar: (termo) => {
        escolhido = null; novoNome = termo;
        preencher(null); destravar(true); pintarMesmo();
        campo('f-dest-end').focus();
        aoMudar();
      },
    },
    onChange: (id) => {
      const l = locaisAtivos.find(x => x.id === id) || null;
      if (l) { usarCadastrado(l); return; }
      // Limpou o campo: nem cadastrado nem novo.
      escolhido = null; novoNome = null;
      preencher(null); destravar(false); pintarMesmo();
      aoMudar();
    },
  });
  for (const id of ['f-dest-end', 'f-dest-num']) campo(id).addEventListener('change', pintarMesmo);
  campo('f-dest-mesmo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-usar]'); if (!b) return;
    const l = locaisAtivos.find(x => x.id === b.dataset.usar); if (!l) return;
    bs.definirValor(l.id);
    usarCadastrado(l);
  });
}

export function lerDestino() {
  if (escolhido) {
    const l = escolhido;
    return { localId: l.id, local: l, nome: l.nome || '', endereco: l.endereco || '', numero: l.numero || '', bairro: l.bairro || '' };
  }
  return { localId: null, local: null, nome: novoNome || '', endereco: val('f-dest-end'), numero: val('f-dest-num'), bairro: val('f-dest-bairro') };
}

// Local do cadastro: basta tê-lo escolhido. Local novo: as quatro partes
// são obrigatórias - é o que a empresa de transporte vai ler na ficha.
export function validarDestino(d) {
  if (d.localId) return null;
  if (!novoNome) return 'Escolha o local na lista ou digite o nome de um local novo.';
  if (!d.nome || !d.endereco || !d.numero || !d.bairro) return 'Informe endereço, número e bairro do local novo.';
  return null;
}
```

- [ ] **Step 2: `sate.css`** - substituir o bloco do grupo DESTINO (as 3 linhas de comentário + `.dest-lista` + `.dest-alternar`) por:

```css
/* Grupo DESTINO: aviso "este endereço já é de…" (spec 2026-10-02, D13).
   Vazio, não ocupa linha da grade. */
.dest-mesmo:empty { display: none; }
.dest-mesmo .form-hint { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
```

- [ ] **Step 3: `formulario.js`** - Escola por busca para quem aprova.

3a. Import: acrescentar `import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';`.

3b. Depois de `let deb = null;`:

```js
// Escola por busca para quem aprova (são 144); null para a escola, que
// escolhe numa lista curta (spec 2026-10-02, D13). Destruído a cada
// abertura pelo mesmo motivo de `bs` em formulario-destino.js.
let buscaEscola = null;
const escolaId = () => (buscaEscola ? buscaEscola.valorAtual() : (document.getElementById('f-esc')?.value || ''));
```

3c. No HTML do grupo Origem, trocar

```html
            <label class="col-2">Escola
              <select id="f-esc" required>${opcoesEscola(unidades, perfil, aprovador)}</select></label>
```
por

```html
            ${aprovador
              ? '<div id="f-esc-busca" class="col-2"></div>'
              : `<label class="col-2">Escola <select id="f-esc" required>${opcoesEscola(unidades, perfil)}</select></label>`}
```

3d. Trocar `opcoesEscola` inteira por:

```js
// A escola escolhe só entre as dela - antes a lista trazia a rede inteira e
// o banco recusava o pedido feito para outra unidade, com um erro que a
// pessoa não entendia. Se é uma só, já vem escolhida. Nome completo, como
// no cartão da escola (spec 2026-10-02, D13).
function opcoesEscola(unidades, perfil) {
  const minhas = perfil?.unidades || [];
  const lista = [...(unidades || [])]
    .filter(u => minhas.includes(u.id))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
  const unica = lista.length === 1;
  return (unica ? '' : '<option value="">Selecione…</option>')
    + lista.map(u => `<option value="${esc(u.id || u.numero)}" ${unica ? 'selected' : ''}>${esc(u.nome)}</option>`).join('');
}
```

3e. Em `ligar()`, trocar `document.getElementById('f-esc').addEventListener('change', pintarTrajeto);` por:

```js
  buscaEscola?.destruir();
  buscaEscola = null;
  if (ctx.aprovador) {
    const escolas = [...(ctx.unidades || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
    buscaEscola = criarBuscaSelecao(document.getElementById('f-esc-busca'), {
      rotulo: 'Escola',
      opcoes: escolas.map(u => ({ id: u.id || u.numero, rotulo: u.nome, detalhe: u.segmento || '', busca: u.apelido || '' })),
      placeholder: 'Digite para buscar a escola…',
      onChange: pintarTrajeto,
    });
  } else {
    document.getElementById('f-esc').addEventListener('change', pintarTrajeto);
  }
```

3f. Em `pintarTrajeto()` e em `enviar()`, trocar `const escId = document.getElementById('f-esc').value;` por `const escId = escolaId();`.

3g. Atualizar o comentário de topo do arquivo: depois da linha "de responsável e acessibilidade." acrescentar
`// Revisto na spec 2026-10-02 (D13): escola por busca para quem aprova, local novo pela própria busca do campo Local.`

- [ ] **Step 4: Tamanho.** Run: `wc -l src/modules/sate/views/formulario.js src/modules/sate/views/formulario-destino.js` → ambos < 400.

- [ ] **Step 5: Rodar** `node --test tests/` e `python .claude/scripts/verificar_arquitetura.py` → PASS / sem bloqueio novo.

- [ ] **Step 6: Conferir no navegador** (sate.html; abrir o formulário pelo `import()` do Step 1 da Task 5, com `locais: [{ id:'1', nome:'Museu Exemplo', endereco:'Rua Exemplo', numero:'10', bairro:'Centro', ativo:true }]` e, para o caso aprovador, `aprovador:true, unidades:[{numero:'1',nome:'Escola Exemplo Alfa',apelido:'Alfa',segmento:'EMEF'},{numero:'2',nome:'Escola Exemplo Beta',segmento:'EMEI'}]`). Em 1280 e 375px:
  1. aprovador: campo Escola é busca com rótulo "Escola"; ao abrir o modal a lista **não** abre sozinha; "alfa" acha pela forma curta; escolher dispara o trajeto (mensagem de cálculo aparece);
  2. escola (`aprovador:false`, `perfil:{unidades:[...]}` com os ids/números): `<select>` com o nome completo;
  3. Local: "muzeu" → "Parecidos: Museu Exemplo" + último item apagado "Nenhum destes? Cadastrar “muzeu”"; `Enter` escolhe o **museu** (destaque no primeiro);
  4. "Galeria Exemplo" (sem parecido) → único item "Usar “Galeria Exemplo” como novo local", destacado; `Enter` → etiqueta "Novo local", endereço/número/bairro editáveis, foco no Endereço;
  5. digitar "R. Exemplo" + número "10" (sair do campo) → "Este endereço já é de Museu Exemplo. [Usar este]"; clicar → campo mostra "Museu Exemplo", endereço só leitura preenchido, aviso some;
  6. `×` do campo Local → limpa tudo, endereço volta a só leitura;
  7. lista do Local com a mesma largura e `left` do campo (medida da Task 6);
  8. Enviar com local novo incompleto → "Informe endereço, número e bairro do local novo.";
  9. fechar com algo digitado → pergunta (Task 3);
  10. console sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/modules/sate/views/formulario.js src/modules/sate/views/formulario-destino.js src/modules/sate/sate.css
git commit -m "feat(sate): escola por busca para quem aprova e local novo pela propria busca, com aviso de endereco repetido"
```

---

### Task 10: Regras, tutoriais, versão e verificação final

**Files:**
- Modify: `.claude/rules/ui.md`
- Modify: `docs/modulos/sate.md`, `docs/modulos/escolas.md`
- Modify: `src/core/config.js` (`versao: '0.38.1'`, `versaoSate: '0.17.1'`)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: `ui.md`.** Na lista "Vocabulário existente":
  - em **Busca**, trocar `` `.search` (a caixa de busca por texto; `.compacta` = um controle único na toolbar) `` por `` `.search` (a caixa de busca por texto, com o quadrado da lupa à esquerda) ``;
  - acrescentar `- **Controle solto:** `.campo-solto` - data, `select` ou número sozinho numa barra, com `aria-label` (substituiu `.search.compacta`)`;
  - em **Formulário**, acrescentar `` `.form-grupo.plano` (grupo de modal sem moldura) ``.

  Acrescentar, depois da seção "Formulário: três papéis, três tratamentos", a seção:

```markdown
## Grupos, foco e saída de modal (spec 2026-10-02)

- **Grupo em modal é cartão.** `.form-grupo` dentro de `.modal` ganha borda
  arredondada, a legenda sobre a linha da borda e o fundo `--grupo-bg`; os
  campos dentro ficam em `--surface`. Grupo com cartão, lista ou tabela fica
  plano sozinho (`:has()`); o que o detector não pega leva `.plano`. Em
  página, o grupo continua seção com traço - o `.panel` já é a moldura.
- **Rótulo em caixa normal, legenda em caixa alta.** É o que separa os dois.
- **Foco é a borda**, na cor de destaque, sem anel. Caixa e rádio ficam com o anel.
- **Modal com formulário pergunta antes de descartar** o que a pessoa
  digitou, nas quatro portas (fundo, Esc, ×, ←). `fecharModal()` pelo código
  não pergunta. Formulário que grava na hora: `abrirModal(html, { protegerSaida: false })`.
- **Busca com seleção abre por gesto** (clique, digitação, ↓), não pelo foco,
  e tolera erro de digitação ("Parecidos") quando a busca exata não acha nada.
```

  Na R17, acrescentar ao fim: `A mesma regra vale para a barra com `.campo-solto`: botão e busca da barra descem/sobem para `--campo`.`

  Na tabela "Formulário: três papéis", trocar a linha do rótulo para `| Rótulo de campo (`<label>`) | `--form-label` | 12.5px · 600 · caixa normal |`.

- [ ] **Step 2: Tutoriais.** Invocar a skill `atualizar-ajuda` para `sate` e depois para `escolas`, levando estas mudanças (texto para quem usa, sem nome de arquivo, carimbo `> Atualizado na versão 0.38.1.`):
  - **sate.md** - Nova solicitação: o campo Escola é uma busca para quem aprova; no campo Local, digitar o nome; se não estiver na lista, escolher o último item "Usar “…” como novo local" e preencher endereço, número e bairro; com erro de digitação o sistema mostra "Parecidos"; se o endereço já for de um local cadastrado, aparece "Usar este"; fechar o formulário com algo preenchido pede confirmação. Frota: abre mostrando todas. Disponibilidade: mostra de segunda a sexta (por enquanto) e destaca o dia escolhido (ou hoje); escolher um sábado ou domingo leva à semana seguinte. Remover menções ao botão "Local não está na lista".
  - **escolas.md** - a ficha mostra o nome no cabeçalho; o nome que consta no SAE aparece em "Cadastros e links" quando é diferente.

- [ ] **Step 3: Versão.** `src/core/config.js`: `versao: '0.38.1'`, `versaoSate: '0.17.1'`.

- [ ] **Step 4: CHANGELOG.** Na tabela "Versões do SATE", nova primeira linha:
  `| 0.17.1 | 0.38.1 | pedido com local novo pela busca, disponibilidade de segunda a sexta com o dia destacado |`
  E acima de `## [0.38.0] - 2026-09-27`:

```markdown
## [0.38.1] - 2026-10-02

SATE 0.17.1.

### Mudou
- **Nova solicitação:** o local que não está na lista é cadastrado pela própria busca -
  digite o nome e escolha "Usar … como novo local". Erros de digitação mostram os locais
  parecidos, e um endereço que já é de um local cadastrado avisa "Usar este". Quem aprova
  procura a escola pelo nome, em vez de rolar a lista inteira. O título ficou só "Nova
  solicitação".
- **Disponibilidade:** mostra de segunda a sexta e destaca o dia escolhido (ou hoje) na cor
  do SATE. O campo de data ficou do tamanho certo, sem ícone repetido.
- **Frota** abre mostrando todas as frotas.
- **Fichas de ônibus:** data e período lado a lado, do mesmo tamanho; o desenho do ônibus é
  o mesmo em todo o sistema.
- **Formulários em janela:** os grupos de campos ganharam moldura com o título na borda, os
  nomes dos campos não estão mais em maiúsculas, e o campo selecionado tem uma borda só.
- **Fechar uma janela com algo preenchido** pergunta antes de descartar.
- O fundo atrás das janelas ficou mais escuro e desfocado, e o cabeçalho delas ganhou a cor
  do sistema. A ficha da escola mostra só o nome no topo.
- As caixas de busca têm a lupa num quadrado à esquerda, e acham o que foi digitado com uma
  letra errada.
```

- [ ] **Step 5: Verificação final.**
  - `node --test tests/` → PASS;
  - `python .claude/scripts/verificar_arquitetura.py` → sem bloqueio (checagens 11, 12 e 14 em especial);
  - navegador em 375/768/1280px, claro e escuro, percorrendo a lista de "Riscos" da spec: Escolas, Servidores, Usuários, Horários (jornada), Calendário (escalas), Afastamentos, Atas, Visitas, Projetos, Ocorrências, Configurações (engrenagem), Meus dados, Dashboard, Viagens e as seis páginas do SATE - procurando campo desalinhado, moldura dupla, rótulo em caixa alta remanescente e erro no console;
  - reverter o patch de dev-local; `grep -rn "dev@local" src/` só em `docs.content.js`;
  - `git diff --cached` lido procurando dado real.

- [ ] **Step 6: Commit**

```bash
git add .claude/rules/ui.md docs/modulos/sate.md docs/modulos/escolas.md src/core/config.js CHANGELOG.md
git commit -m "docs: regras de ui, tutoriais do SATE e de Escolas, versao 0.38.1 (SATE 0.17.1)"
```
