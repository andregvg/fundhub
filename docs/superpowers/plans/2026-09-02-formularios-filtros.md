# Hierarquia de formulário e painel de filtros - Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA - use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa.
> Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** dar ao formulário do FundHub uma hierarquia de leitura em três
níveis, unificar a altura dos controles e substituir os três padrões de barra de
filtros por um `.painel-filtros` único - aplicando tudo isso aos nove ajustes
pedidos na ficha do servidor.

**Arquitetura:** as duas decisões de sistema (D1/D2 e D3) vivem em
`styles/tokens.css` e `styles/components.css` e chegam aos módulos pelas classes
que eles já usam. Nenhum arquivo de módulo ganha CSS novo, exceto uma regra de
três colunas em `servidores.css`. Nenhuma mudança de comportamento: nenhum filtro
filtra diferente, nenhum formulário grava campo diferente.

**Stack:** SPA estática sem build - HTML/CSS/JS ES modules servidos por
`.claude/devserver.py`. Sem npm, sem bundler, sem framework de teste.

**Spec:** `docs/superpowers/specs/2026-09-02-formularios-filtros-design.md`

## Restrições globais

Copiadas da spec e do `CLAUDE.md`; valem para **todas** as tarefas.

- **Sem build, sem dependência nova.** O que está no repositório é o que roda.
- **Nenhuma cor literal em `src/modules/**`** (R9). Só `var(--token)`. Token que
  falta nasce em `tokens.css`, nas duas variantes.
- **Mobile-first.** O que está fora de `@media` é o layout do celular;
  `@media (min-width: …)` só acrescenta. Cortes permitidos: **560 · 720 · 900 ·
  1100px**. Não inventar corte novo.
- **Todo valor vindo do banco passa por `esc()`** antes de entrar em template
  literal (R5).
- **Model nunca toca no DOM; view nunca chama `sb()`** (R3).
- **PT-BR** em código, comentário, commit e interface.
- **Nenhum dado real** em código, comentário ou exemplo (R7). Conferir
  `git diff --cached` antes de cada commit.
- Commits na branch **`dev`**.
- Valores fixados pela spec, a serem usados literalmente:
  - rótulo de campo: `11.5px` / `700` / `uppercase` / `letter-spacing: .04em` / `var(--form-label)`
  - legenda de bloco: `11.5px` / `700` / `uppercase` / `letter-spacing: .06em` / `var(--form-legend)` / `border-bottom: 1px solid var(--border)`
  - altura de campo: `var(--campo)` = `36px`, e `var(--toque)` em `(pointer: coarse)`
  - `line-height` de campo: `1.25`, **declarada**, nunca herdada

## Preparação (uma vez, antes da Tarefa 1) - NÃO COMMITAR

O hub não tem framework de teste. A verificação de cada tarefa é visual, no
browser, com o app em modo dev-local. Este patch é temporário e é **revertido na
Tarefa 7**.

- [ ] **P1: Ligar o modo dev-local**

Em `src/core/config.js`, esvaziar a chave (isto desliga o gate de login):

```js
  supabaseAnonKey: '',
```

- [ ] **P2: Dar um perfil de admin ao modo dev-local**

Em `src/core/perfil.js`, no ramo `if (!hasSupabase())` da linha 22, devolver um
perfil em vez de `null`:

```js
  if (!hasSupabase()) { _cache = null; return { email: 'dev@local', papel: 'admin_sme', isAdmin: true }; }
```

- [ ] **P3: Subir o servidor de preview**

Usar a ferramenta `preview_start` com `{ name: "fundhub" }` (porta 8123, já
configurada em `.claude/launch.json`). **Nunca** subir servidor por Bash.

- [ ] **P4: Confirmar que o app abre**

Navegar para `http://localhost:8123/?v=1#/servidores`. Ler a página com
`get_page_text` e o console com `read_console_messages`.
Esperado: a tela de Servidores renderiza (lista vazia, sem banco) e o console
não tem erro.

> **Cache:** o browser guarda os ES modules. A cada recarga depois de editar
> JS, navegar com um `?v=N` diferente (`?v=2`, `?v=3`, …). CSS costuma
> recarregar sozinho, mas na dúvida suba o `v`.
>
> **Screenshot dá timeout com frequência neste projeto.** Preferir
> `get_page_text`, `read_page` e `javascript_tool` (para ler estilo computado)
> a `computer{action:"screenshot"}`.

---

## Tarefa 1: Fundação de formulário - três tons e uma altura

Implementa D1 e D2 da spec. É a tarefa de maior alcance visual: as classes
mexidas aqui são usadas por 18 arquivos que montam formulário, e nenhum deles é
tocado.

**Arquivos:**
- Modificar: `src/styles/tokens.css`
- Modificar: `src/styles/components.css`

**Interfaces:**
- Produz: os tokens `--form-legend`, `--form-label`, `--form-field`, `--campo`,
  consumidos pelas Tarefas 2, 3, 4, 5 e 6.

- [ ] **Passo 1: Acrescentar os quatro tokens**

Em `src/styles/tokens.css`, dentro do `:root` inicial, logo **depois** do bloco
`--controle` / `--toque` (hoje linhas 30-33):

```css
  /* Altura de um campo de formulário. Fica entre --controle (o botão, 32px)
     e --toque (o alvo mínimo, 40px): o campo é maior que o botão porque
     carrega texto de 16px. Declarar a altura é o que impede o campo de data e
     o .campo-derivado de saírem mais altos que o campo de texto ao lado - a
     altura deles era consequência de onde cada um herdava line-height. */
  --campo: 36px;

  /* Hierarquia de leitura de um formulário: legenda de bloco, rótulo de campo
     e conteúdo digitado. Três papéis, três tratamentos - ver a spec de
     02/09/2026 § D1.

     --form-legend e --form-field têm hoje o mesmo valor, e isso é proposital:
     eles nunca aparecem na mesma linha, e o que os separa é tamanho, peso e
     caixa. O token existe pelo NOME, para que calibrar o tom da legenda
     depois seja um lugar só.

     Não precisam ser redefinidos no tema escuro: como apontam para --text e
     --muted, a substituição acontece no elemento e já pega o valor escuro. */
  --form-legend: var(--text);
  --form-label: var(--muted);
  --form-field: var(--text);
```

- [ ] **Passo 2: Elevar `--campo` ao alvo de toque no celular**

Ainda em `src/styles/tokens.css`, **no fim do arquivo**, depois do
`@media (min-width: 720px)`:

```css
/* Em tela de toque nenhum campo pode ficar abaixo do alvo mínimo - a mesma
   elevação que os botões já recebem em components.css. */
@media (pointer: coarse) {
  :root { --campo: var(--toque); }
}
```

- [ ] **Passo 3: Verificar que os tokens resolvem**

Recarregar `http://localhost:8123/?v=2#/servidores` e rodar com
`javascript_tool`:

```js
getComputedStyle(document.documentElement).getPropertyValue('--campo').trim()
```

Esperado: `36px`.

- [ ] **Passo 4: Unificar os rótulos fora de `fieldset`**

Em `src/styles/components.css`, substituir o bloco de `.form-grid label` (hoje
linhas 445-456) por:

```css
/* Rótulo de campo: 11.5px / 700 / ALTA / .04em / --form-label. Este é o
   tratamento único do hub - antes cada classe tinha o seu (12px/.03em,
   12px/.04em, 11.5px/.04em, 11px/.04em), sem que nenhuma diferença tivesse
   sido decidida. */
.form-grid label,
.esc-form > label,
.fr-of {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--form-label);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}
```

- [ ] **Passo 5: Dar altura e entrelinha declaradas aos campos**

Logo abaixo, substituir o bloco de `.form-grid input, …` (hoje linhas 457-469)
por:

```css
.form-grid input, .form-grid select, .form-grid textarea,
.esc-form input, .esc-form select, .esc-form textarea,
.fr-of input {
  min-height: var(--campo);
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background: var(--surface-2);
  color: var(--form-field);
  font-size: 16px;   /* idem: 16px evita o zoom do iOS */
  font-weight: 400;
  line-height: 1.25; /* DECLARADA: o input não herda line-height do body e o
                        span herda - era daí que vinham alturas diferentes */
  text-transform: none;
  letter-spacing: 0;
}

/* As duas exceções, explícitas: caixa de seleção e o radio escondido do
   .switch têm tamanho próprio e não são campo de formulário. Sem isto, o
   seletor acima faria o checkbox de 18px sair com 36px de altura. */
.form-grid :is([type="checkbox"], [type="radio"]),
.esc-form :is([type="checkbox"], [type="radio"]) { min-height: 0; padding: 0; }
```

- [ ] **Passo 6: Normalizar o campo de data**

Logo depois das regras de `:focus` de formulário (hoje linhas 470-474), antes de
`input[type="color"]`:

```css
/* O campo de data saía ~3px mais alto que o de texto: o WebKit acrescenta
   padding próprio ao miolo editável. Zerado aqui, a altura passa a vir só de
   --campo, como em todo campo. O indicador do calendário FICA - trocar o
   seletor nativo de data por 3px de alinhamento não compensa. */
input[type="date"]::-webkit-datetime-edit { padding: 0; }
```

- [ ] **Passo 7: Fazer a legenda comandar o bloco**

Substituir o bloco de `.form-grupo > legend` (hoje linhas 712-719) por:

```css
.form-grupo > legend {
  width: 100%;
  padding: 0 0 7px;
  margin-bottom: 3px;
  border-bottom: 1px solid var(--border);
  color: var(--form-legend);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
}
```

O traço é o que faz a legenda ler como divisão e não como mais um rótulo -
com o rótulo também em caixa alta e negrito (Passo 8), só a cor não bastaria.

- [ ] **Passo 8: Dar tipografia ao rótulo dentro de `fieldset`**

Este é o achado central do diagnóstico: `.form-grupo .campos label` só declarava
layout, então caía no `body` (15px, `--text`, caixa normal) - o mesmo tom e
tamanho do conteúdo do campo. Substituir o bloco (hoje linhas 732-737) por:

```css
/* Rótulo SEMPRE acima do campo. A única exceção é o checkbox (.inline),
   onde o rótulo ao lado é o que a caixa significa.
   A tipografia é a mesma de .form-grid label - até 02/09/2026 este seletor
   declarava só layout, e o rótulo saía igual ao conteúdo do campo. */
.form-grupo .campos label:not(.inline) {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  color: var(--form-label);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}
```

- [ ] **Passo 9: Alinhar o `.campo-derivado` com os campos de verdade**

Substituir o bloco `.campo-derivado` (hoje linhas 744-758) por:

```css
/* Valor derivado, exibido no formulário mas editado em outro lugar
   (cargo e lotação vêm do vínculo). Parece campo, não é - e agora tem
   exatamente a métrica de um campo, para não sair mais alto que o vizinho. */
.campo-derivado {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: var(--campo);
  padding: 7px 10px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
  background: var(--surface-2);
  color: var(--form-field);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.25;
  text-transform: none;
  letter-spacing: 0;
}
```

- [ ] **Passo 10: Unificar os três rótulos restantes**

Três substituições de uma linha cada, em `src/styles/components.css`:

`.auth-form label` (hoje linha 531):

```css
.auth-form label { color: var(--form-label); font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
```

`.field .lbl` e `.field .val` (hoje linhas 763-764):

```css
.field .lbl { margin-bottom: 3px; color: var(--form-label); font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.field .val { color: var(--form-field); font-size: 14.5px; }
```

`.phones > .lbl` (hoje linha 788):

```css
.phones > .lbl { margin-bottom: 6px; color: var(--form-label); font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
```

- [ ] **Passo 11: Medir as três alturas que divergiam**

Navegar para `http://localhost:8123/?v=3#/meus-dados` (é um formulário que abre
sem banco). Com `javascript_tool`:

```js
[...document.querySelectorAll('.esc-form input, .campo-derivado')]
  .map(el => `${el.id || el.className}: ${Math.round(el.getBoundingClientRect().height)}px`)
```

Esperado: **todos com a mesma altura** (36px, ou 40px se o browser estiver
emulando toque). Antes da tarefa, `input[type="date"]` e `.campo-derivado`
saíam ~3px maiores que `input[type="text"]`.

- [ ] **Passo 12: Conferir a hierarquia num formulário com `fieldset`**

Navegar para `#/escolas`, abrir uma gaveta de edição (ou, sem banco, usar
`#/meus-dados`) e ler com `javascript_tool`:

```js
const g = el => el && getComputedStyle(el);
const L = g(document.querySelector('.form-grupo > legend'));
const R = g(document.querySelector('.form-grupo .campos label:not(.inline)'));
const C = g(document.querySelector('.esc-form input'));
({ legenda: [L?.color, L?.fontSize], rotulo: [R?.color, R?.fontSize], campo: [C?.color, C?.fontSize] })
```

Esperado: legenda e rótulo com **cores diferentes** (legenda = `--text`,
rótulo = `--muted`), rótulo e campo com **tamanhos diferentes** (11.5px vs
16px). Console sem erro.

- [ ] **Passo 13: Conferir tema escuro e tela estreita**

Usar `resize_window` com `{ preset: "mobile" }` e depois
`{ colorScheme: "dark" }`. Repetir o Passo 12. Esperado: os tokens continuam
resolvendo (a legenda fica clara no escuro, porque `--form-legend` aponta para
`--text`, que o `@media` redefine). Voltar com `{ preset: "desktop" }` e
`{ colorScheme: "light" }`.

- [ ] **Passo 14: Verificar a arquitetura**

```bash
python .claude/scripts/verificar_arquitetura.py
```

Esperado: sem novas violações.

- [ ] **Passo 15: Commit**

Conferir que o patch de dev-local **não** entrou:

```bash
git add src/styles/tokens.css src/styles/components.css && git diff --cached
```

```bash
git commit -m "feat(ui): hierarquia de tres niveis e altura unica no formulario

O rotulo dentro de um fieldset nao tinha regra de tipografia: caia no body
e saia com o mesmo tom, peso e tamanho do conteudo do campo. E a legenda,
em --muted, era o elemento mais fraco da tela - a hierarquia estava
invertida. Agora sao tres papeis com tres tratamentos, via --form-legend,
--form-label e --form-field.

O campo de data e o .campo-derivado saiam mais altos que o campo de texto
porque cada um herdava line-height de um lugar diferente. Com --campo e
line-height declarados, a altura deixa de ser consequencia.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 2: `.painel-filtros` e adoção em Servidores e Escolas

Implementa D3 da spec, primeira metade: cria o componente e converte os dois
módulos que já usam `.filtros-linha`.

**Arquivos:**
- Modificar: `src/styles/components.css`
- Modificar: `src/modules/servidores/servidores.view.js:47-62`
- Modificar: `src/modules/escolas/escolas.view.js:39-55`

**Interfaces:**
- Consome: `--campo`, `--form-label`, `--form-field` (Tarefa 1).
- Produz: a classe `.painel-filtros` e o contrato "aceita `.filtro-campo`,
  `.switch`, `.filters`, `.chip-filtro` e `.count`", consumido pela Tarefa 3.

- [ ] **Passo 1: Substituir `.filtros-linha` por `.painel-filtros`**

Em `src/styles/components.css`, substituir o bloco `.filtros-linha` +
`.filtro-campo` (hoje linhas 110-139) por:

```css
/* Painel de filtros: a superfície única onde ficam os controles que recortam
   a lista abaixo. Um por tela de lista - ver a spec de 02/09/2026 § D3.
   Aceita .filtro-campo, .switch, .filters, .chip-filtro e .count; nada além
   disso entra aqui.
   MOBILE-FIRST: coluna por padrão, linha a partir de 560px. */
.painel-filtros {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 16px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
/* Em coluna, o eixo cruzado é o HORIZONTAL: o `align-self: end` que o
   .switch e o .chip-filtro trazem os jogaria para a direita da tela. E o
   .filtro-sep (afastamentos.css) cresceria na vertical em vez de na
   horizontal. */
.painel-filtros .switch,
.painel-filtros .chip-filtro { align-self: start; }
.painel-filtros .filtro-sep { flex: 0 0 auto; }

.filtro-campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  color: var(--form-label);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}
/* Rótulo com ícone: sem o <span>, o SVG e o texto viram dois itens flex e
   empilham. Ícone nunca é o rótulo sozinho - ele é aria-hidden. */
.filtro-campo > span { display: flex; align-items: center; gap: 5px; }
.filtro-campo select,
.filtro-campo input {
  min-height: var(--campo);
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  /* --surface, e não --surface-2: dentro do painel (que já é --surface-2) o
     controle precisa ler como controle sobre a superfície. */
  background: var(--surface);
  color: var(--form-field);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.25;
  text-transform: none;
  letter-spacing: 0;
}
.filtro-campo select:focus,
.filtro-campo input:focus {
  outline: 2px solid color-mix(in srgb, var(--brand) 40%, transparent);
  border-color: var(--brand);
}
```

- [ ] **Passo 2: A linha do painel a partir de 560px**

Em `src/styles/components.css`, dentro do `@media (min-width: 560px)` já
existente (hoje linha 802), substituir a linha
`.filtros-linha { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }`
por:

```css
  /* align-items: end, e NÃO center: com o rótulo acima do campo, o que faz a
     linha ler como uma linha é os controles compartilharem a base. Centrar
     alinharia o toggle com o rótulo dos vizinhos, não com os campos. */
  .painel-filtros { flex-direction: row; flex-wrap: wrap; align-items: end; gap: 10px 16px; }
  /* Os campos dividem a linha inteira; o resto ocupa só o que precisa. */
  .painel-filtros .filtro-campo { flex: 1 1 180px; }
  .painel-filtros .filters,
  .painel-filtros .switch,
  .painel-filtros .chip-filtro { flex: 0 0 auto; align-self: end; }
  /* O separador de Afastamentos volta a empurrar na horizontal. */
  .painel-filtros .filtro-sep { flex: 1 1 8px; }
  .painel-filtros .count { margin-left: auto; align-self: center; }
```

- [ ] **Passo 3: Converter Servidores**

Em `src/modules/servidores/servidores.view.js`, substituir as linhas 48-62
(o `<div class="toolbar-linha">` que embrulha `#sv-filtros`) por:

```js
    <div class="painel-filtros" id="sv-filtros">
      <label class="filtro-campo">Cargo / função
        <select id="f-cargo"><option value="">Todos</option></select>
      </label>
      <label class="filtro-campo">Lotação
        <select id="f-local"><option value="">Todas</option></select>
      </label>
      <label class="switch">
        <input type="checkbox" id="f-sem" /><span class="switch-trilho" aria-hidden="true"></span>
        Sem vínculo
      </label>
      <span id="sv-chip-uni"></span>
    </div>
```

O `<div class="toolbar-linha">` externo sai; o painel é o próprio contêiner.

- [ ] **Passo 4: Converter Escolas**

Em `src/modules/escolas/escolas.view.js`, substituir as linhas 40-54 (o
`<div class="toolbar-linha">` externo e o `<div class="filtros-linha">` interno,
que viram um contêiner só) por:

```js
    <div class="painel-filtros" id="filters">
      <label class="filtro-campo">Oferta
        <select id="f-oferta"><option value="">Todas</option></select>
      </label>
      <label class="switch">
        <input type="checkbox" id="f-transporte" /><span class="switch-trilho" aria-hidden="true"></span>
        ${ico('transporte', { tam: 14 })} Transporte
      </label>
      <label class="switch">
        <input type="checkbox" id="f-eja" /><span class="switch-trilho" aria-hidden="true"></span>
        ${ico('noturno', { tam: 14 })} EJA
      </label>
    </div>
```

Os `id` (`filters`, `f-oferta`, `f-transporte`, `f-eja`) são exatamente os
mesmos - nenhum listener do arquivo muda.

- [ ] **Passo 5: Verificar Servidores no browser**

Navegar para `http://localhost:8123/?v=4#/servidores`. Com `javascript_tool`:

```js
const p = document.getElementById('sv-filtros');
const r = p.getBoundingClientRect();
({
  classe: p.className,
  fundo: getComputedStyle(p).backgroundColor,
  direcao: getComputedStyle(p).flexDirection,
  base: [...p.children].map(c => Math.round(c.getBoundingClientRect().bottom)),
})
```

Esperado: `classe` = `painel-filtros`, `direcao` = `row`, fundo diferente do
fundo da página, e os valores de `base` dos dois selects e do toggle
**iguais** (é o que "alinhados" quer dizer).

- [ ] **Passo 6: Verificar em tela estreita**

`resize_window` com `{ preset: "mobile" }`, recarregar e repetir. Esperado:
`direcao` = `column`, e nenhum filho colado à direita (o
`align-self: start` do Passo 1). Voltar a `{ preset: "desktop" }`.

- [ ] **Passo 7: Verificar Escolas e o console**

Navegar para `#/escolas`, repetir o Passo 5 com `#filters`. Rodar
`read_console_messages` com `{ onlyErrors: true }`. Esperado: nenhum erro, e os
filtros continuam funcionando (clicar num toggle e conferir que a lista repinta).

- [ ] **Passo 8: Verificar a arquitetura**

```bash
python .claude/scripts/verificar_arquitetura.py
```

- [ ] **Passo 9: Commit**

```bash
git add src/styles/components.css src/modules/servidores/servidores.view.js src/modules/escolas/escolas.view.js && git diff --cached
```

```bash
git commit -m "feat(ui): .painel-filtros, o contêiner unico dos filtros de lista

Os controles de filtro flutuavam sobre o fundo da pagina, sem nada dizendo
onde comeca e onde termina a barra. Agora ficam numa superficie propria,
numa linha so, com os controles compartilhando a base - o alinhamento vem
de align-items: end, porque com o rotulo acima do campo e a base dos
controles que faz a linha ler como uma linha.

Servidores e Escolas adotam. Os outros modulos vem na sequencia.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 3: Adoção do painel nos seis módulos restantes

Implementa D3 da spec, segunda metade. Aposenta `.subfiltros` e
`.search.compacta`.

**Arquivos:**
- Modificar: `src/modules/visitas/visitas.view.js:56-65`
- Modificar: `src/modules/ocorrencias/ocorrencias.view.js:56-65`
- Modificar: `src/modules/projetos/projetos.view.js:39-49`
- Modificar: `src/modules/atas/atas.view.js:33-40`
- Modificar: `src/modules/usuarios/views/auditoria.js:23-36`
- Modificar: `src/modules/afastamentos/afastamentos.view.js:56` e `105-129`
- Modificar: `src/styles/components.css` (remove `.subfiltros` e `.search.compacta`)

**Interfaces:**
- Consome: `.painel-filtros` e seu contrato de filhos (Tarefa 2).

- [ ] **Passo 1: Converter Visitas**

Em `src/modules/visitas/visitas.view.js`, substituir o bloco
`<div class="toolbar subfiltros">` (linhas 56-65) por:

```js
    <div class="painel-filtros">
      <label class="filtro-campo">De <input id="vi-de" type="date" value="${filtro.de}" /></label>
      <label class="filtro-campo">Até <input id="vi-ate" type="date" value="${filtro.ate}" /></label>
      <label class="filtro-campo"><span>${ico('escola', { tam: 13 })} Escola</span>
        <select id="vi-uni"><option value="">Todas as escolas</option></select>
      </label>
      <div class="filters" id="vi-status">
        <button class="chip" data-st="">Todos</button>
        ${Object.entries(STATUS).map(([k, v]) => `<button class="chip" data-st="${k}">${esc(v)}</button>`).join('')}
      </div>
      <span class="count" id="vi-count"></span>
    </div>
```

O ícone ganhou texto ao lado: ícone é `aria-hidden` e não pode ser o rótulo
sozinho. Todos os `id` são os mesmos - nenhum listener muda.

- [ ] **Passo 2: Converter Ocorrências**

Em `src/modules/ocorrencias/ocorrencias.view.js`, mesma substituição nas linhas
56-65, com os `id` do módulo:

```js
    <div class="painel-filtros">
      <label class="filtro-campo">De <input id="oc-de" type="date" value="${filtro.de}" /></label>
      <label class="filtro-campo">Até <input id="oc-ate" type="date" value="${filtro.ate}" /></label>
      <label class="filtro-campo"><span>${ico('escola', { tam: 13 })} Escola</span>
        <select id="oc-uni"><option value="">Todas as escolas</option></select>
      </label>
      <div class="filters" id="oc-status">
        <button class="chip" data-st="">Todas</button>
        ${Object.entries(STATUS).map(([k, v]) => `<button class="chip" data-st="${k}">${esc(v)}</button>`).join('')}
      </div>
      <span class="count" id="oc-count"></span>
    </div>
```

- [ ] **Passo 3: Converter Projetos**

Em `src/modules/projetos/projetos.view.js`, substituir as linhas 39-49 por:

```js
    <div class="painel-filtros">
      <label class="filtro-campo">Situação <select id="pj-status">
        <option value="">Todas</option>
        ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <label class="filtro-campo">Tipo <select id="pj-tipo">
        <option value="">Todos</option>
        ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <span class="count" id="pj-count"></span>
    </div>
```

- [ ] **Passo 4: Converter Atas**

Em `src/modules/atas/atas.view.js`, substituir as linhas 33-40 por (o
`no-print` fica: a barra some na impressão):

```js
    <div class="painel-filtros no-print">
      <label class="filtro-campo">De <input id="at-de" type="date" value="${filtro.de}" /></label>
      <label class="filtro-campo">Até <input id="at-ate" type="date" value="${filtro.ate}" /></label>
      <label class="filtro-campo">Tipo <select id="at-tipo">
        <option value="">Todos</option>
        ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <span class="count" id="at-count"></span>
    </div>
```

- [ ] **Passo 5: Converter Auditoria**

Em `src/modules/usuarios/views/auditoria.js`, substituir as linhas 23-36 por:

```js
    <div class="painel-filtros">
      <label class="filtro-campo">De <input id="au-de" type="date" value="${filtro.de}" /></label>
      <label class="filtro-campo">Até <input id="au-ate" type="date" value="${filtro.ate}" /></label>
      <label class="filtro-campo">Módulo <select id="au-tab">
        <option value="">Todos</option>
        ${Object.entries(TABELAS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <label class="filtro-campo">Ação <select id="au-op">
        <option value="">Todas</option>
        ${Object.entries(OPERACOES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <label class="filtro-campo"><span>${ico('servidor', { tam: 13 })} Autor</span>
        <input id="au-autor" type="search" placeholder="autor…" />
      </label>
      <span class="count" id="au-count"></span>
    </div>
```

- [ ] **Passo 6: Converter Afastamentos**

Em `src/modules/afastamentos/afastamentos.view.js`, linha 56, trocar a classe do
contêiner:

```js
    <div class="painel-filtros" id="af-filtros"></div>
```

E em `montarFiltros()` (linhas 105-129), agrupar os chips em `.filters`, que é
a peça que o painel aceita:

```js
function montarFiltros() {
  const box = document.getElementById('af-filtros');
  if (modo === 'calendario') {
    box.innerHTML = `
      <div class="cal-nav">
        <button class="mini-btn" data-nav="prev" aria-label="Mês anterior">←</button>
        <div class="cal-titulo" id="af-titulo">${MESES[mes - 1]} de ${ano}</div>
        <button class="mini-btn" data-nav="next" aria-label="Próximo mês">→</button>
      </div>
      <div class="cal-legenda">
        <span><i class="lg lg-nletivo"></i> não letivo</span>
        <span>${ico('erro', { tam: 14 })} não conceder afastamentos</span>
        <span><i class="lg lg-pend"></i> aguardando confirmação</span>
        <small>o texto do dia é o evento do calendário escolar</small>
      </div>
      <div class="filters">${chipsTipo()}</div>`;
  } else {
    box.innerHTML = `
      <div class="filters">
        <button class="chip" data-visao="vigentes">Vigentes</button>
        <button class="chip" data-visao="todos">Todos</button>
        <button class="chip" data-visao="importados">Importados</button>
        <button class="chip" data-visao="cancelados">Cancelados</button>
      </div>
      <span class="filtro-sep"></span>
      <div class="filters">${chipsTipo()}</div>`;
  }
  box.querySelectorAll('.chip').forEach(b => {
    const on = (b.dataset.visao && b.dataset.visao === filtro.visao)
      || (b.dataset.tipo != null && b.dataset.tipo === filtro.tipo);
    b.classList.toggle('on', on);
  });
}
```

O `onFiltroClick` é delegado no contêiner e não muda - os `data-visao` e
`data-tipo` continuam nos mesmos botões.

- [ ] **Passo 7: Aposentar `.subfiltros` e `.search.compacta`**

Em `src/styles/components.css`, remover o bloco (hoje linhas 210-218):

```css
/* Segunda barra de filtros (período/escola/status), usada por módulos de
   lista como Ocorrências, Visitas e Auditoria. */
.subfiltros { margin-top: -6px; }
.subfiltros .search.compacta { flex: 1 1 auto; }
.subfiltros .search.compacta select { min-width: 0; }
@media (min-width: 560px) {
  .subfiltros .search.compacta { flex: 0 0 auto; }
  .subfiltros select { min-width: 160px; }
}
```

E remover a linha `.search.compacta { flex: 0 0 auto; }` (hoje linha 96).
`.search` (a caixa de busca por texto, na `.toolbar`) **fica**.

- [ ] **Passo 8: Confirmar que nada ficou órfão**

```bash
grep -rn "subfiltros\|search compacta\|filtros-linha" src/
```

Esperado: **nenhum resultado**. Se aparecer algum, converter também.

- [ ] **Passo 9: Verificar as seis telas no browser**

Para cada rota - `#/visitas`, `#/ocorrencias`, `#/projetos`, `#/atas`,
`#/afastamentos`, `#/usuarios` (aba Auditoria) - navegar com um `?v=` novo e
rodar:

```js
const p = document.querySelector('.painel-filtros');
p && ({ filhos: p.children.length, direcao: getComputedStyle(p).flexDirection,
        base: [...p.querySelectorAll('.filtro-campo select, .filtro-campo input')]
                .map(c => Math.round(c.getBoundingClientRect().bottom)) })
```

Esperado: em cada tela, um painel presente e todos os valores de `base`
**iguais**. Depois `read_console_messages` com `{ onlyErrors: true }`:
nenhum erro.

- [ ] **Passo 10: Verificar a arquitetura e commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
```

```bash
git add src/modules src/styles/components.css && git diff --cached
```

```bash
git commit -m "refactor(ui): os seis modulos restantes adotam .painel-filtros

Visitas, Ocorrencias, Projetos, Atas, Auditoria e Afastamentos usavam
.toolbar.subfiltros com .search.compacta - a classe da CAIXA DE BUSCA,
reusada para segurar um campo de data porque era a caixa arredondada que
estava a mao. Agora usam .filtro-campo, com o rotulo acima, como o resto
do hub. .subfiltros e .search.compacta sao aposentadas.

Onde o rotulo era um icone sozinho, ganhou texto: icone e aria-hidden e
nunca pode ser o unico rotulo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 4: Ficha do servidor - cabeçalho, campos duplicados e documentos

Implementa D4 da spec. Itens (a), (b) e (c) do pedido.

**Arquivos:**
- Modificar: `src/modules/servidores/servidores.model.js:63-68`
- Modificar: `src/modules/servidores/views/detalhe.js`
- Modificar: `src/modules/servidores/servidores.css`

**Interfaces:**
- Produz: `lotacaoDe(s, { completo = false } = {})` - com `completo: true`
  devolve o nome oficial da unidade em vez do apelido. Consumido pela Tarefa 5.

- [ ] **Passo 1: Dar o parâmetro ao model**

Em `src/modules/servidores/servidores.model.js`, substituir `lotacaoDe`
(linhas 63-68) por:

```js
// A lotação é o nome do local do vínculo aberto - escola ou SME.
// Mais de um vínculo aberto acontece (alguém responde por duas
// unidades) e esconder isso seria mentir.
//
// `completo`: o nome oficial em vez do apelido. O apelido existe para
// caber no card da lista; no cabeçalho da ficha e no formulário há
// espaço, e o nome oficial é o que se confere. Qual nome representa a
// lotação é regra de domínio - por isso está aqui, e não na view (R3).
export function lotacaoDe(s, { completo = false } = {}) {
  const nomes = vinculosAbertos(s)
    .map(v => (completo ? v.unidade?.nome : (v.unidade?.apelido || v.unidade?.nome)))
    .filter(Boolean);
  return [...new Set(nomes)].join(' · ');
}
```

As três chamadas existentes (`lista.js:31`, `formulario.js:21`,
`meus-dados.view.js:146`) continuam válidas: o parâmetro tem default.

- [ ] **Passo 2: Reescrever o topo de `detalhe.js`**

Em `src/modules/servidores/views/detalhe.js`, substituir o import da linha 6 e
o corpo da função `detalhe` até a chamada de `abrirDrawer` (linhas 6 e 19-66):

```js
import { cargoDe, lotacaoDe } from '../servidores.model.js';
```

`vinculosAbertos` sai do import: era usado só pelo botão de editar vínculo que
ficava ao lado do campo "Cargo / função", e esse campo sai nesta tarefa.
`vazio` também sai do import de `shared/dom.js`, pelo mesmo motivo - a linha 8
passa a ser:

```js
import { esc } from '../../../shared/dom.js';
```

E o corpo:

```js
export function detalhe(id, ctx) {
  const s = ctx.lista.find(x => x.id === id);
  if (!s) return;

  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';

  // Cargo e escola do vínculo aberto sobem para o cabeçalho: é o que
  // identifica a pessoa funcionalmente. No corpo eles seriam a terceira
  // exibição do mesmo fato - a lista de vínculos abaixo já traz cargo,
  // escola e período. O apelido sai daqui: ele ajuda a ACHAR a pessoa,
  // e isso é papel do card na lista, não da ficha dela.
  const sub = [cargoDe(s), lotacaoDe(s, { completo: true })]
    .filter(Boolean).map(esc).join(' · ');

  const acoes = ctx.podeEditar ? `
    <div class="drawer-acoes">
      <button class="mini-btn" id="sv-edit">${ico('editar')} Editar</button>
      <a class="mini-btn" href="#/horarios?servidor=${esc(s.id)}">${ico('horario')} Horário de trabalho</a>
      <button class="mini-btn no" id="sv-del">${ico('excluir')} Excluir</button>
    </div>` : `
    <div class="drawer-acoes">
      <a class="mini-btn" href="#/horarios?servidor=${esc(s.id)}">${ico('horario')} Horário de trabalho</a>
    </div>`;

  abrirDrawer(`
    ${drawerHead(`<span class="nome-oficial">${esc(s.nome)}</span>`, sub)}
    <div class="drawer-body">
      ${acoes}
      ${campo('E-mail', s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '')}
      ${campo('Telefones', telefonesTexto(s.telefones))}
      ${campo('Nascimento', s.nascimento
        ? `${esc(fmtData(s.nascimento))}${fmtIdade(s.nascimento) ? ` · ${esc(fmtIdade(s.nascimento))}` : ''}`
        : '')}
      <div class="sv-docs">
        ${campo('Código funcional', esc(s.codigo_funcional || ''))}
        ${campo('CPF', esc(s.cpf || ''))}
        ${campo('RG', esc(s.rg || ''))}
      </div>
      ${campo('Ingresso na rede', s.inicio_rede ? esc(fmtData(s.inicio_rede)) : '')}
      <hr class="sep" />
      <div class="vinc-head">
        <div class="field" style="margin:0"><div class="lbl">Vínculos com escolas</div></div>
        ${ctx.podeEditar ? `<button class="mini-btn" id="sv-vinc">+ Novo vínculo</button>` : ''}
      </div>
      <div class="people" id="sv-vinculos">${listaVinculos(s, ctx.podeEditar)}</div>
    </div>`);
```

- [ ] **Passo 3: Remover o listener do campo que saiu**

Ainda em `detalhe.js`, no bloco `if (ctx.podeEditar)`, remover as duas linhas do
`[data-vinc-edit]` (hoje linhas 71-72). O bloco fica:

```js
  if (ctx.podeEditar) {
    document.getElementById('sv-edit').addEventListener('click', () => ctx.abrirFormServidor(s));
    document.getElementById('sv-del').addEventListener('click', () => ctx.removerServidor(s));
    document.getElementById('sv-vinc').addEventListener('click', () =>
      formVinculo(s, null, ctx, { voltar: (freshCtx) => detalhe(s.id, freshCtx || ctx) }));
    const box = document.getElementById('sv-vinculos');
    box.querySelectorAll('[data-edit-vinc]').forEach(b => b.addEventListener('click', () => {
      const v = s.vinculos.find(x => x.id === b.dataset.editVinc);
      formVinculo(s, v, ctx, { voltar: (freshCtx) => detalhe(s.id, freshCtx || ctx) });
    }));
    box.querySelectorAll('[data-del-vinc]').forEach(b =>
      b.addEventListener('click', () => removerVinculo(s, b.dataset.delVinc, ctx)));
  }
```

`vinculosAbertos` não é mais usado no arquivo - conferir com
`grep -n "vinculosAbertos" src/modules/servidores/views/detalhe.js` (esperado:
nenhum resultado).

- [ ] **Passo 4: Documentos lado a lado**

Em `src/modules/servidores/servidores.css`, acrescentar ao fim:

```css
/* Código funcional, CPF e RG na mesma linha no desktop: três campos
   curtos que ocupavam três linhas inteiras da ficha e empurravam os
   vínculos para fora da primeira tela. */
.sv-docs { display: grid; grid-template-columns: 1fr; gap: 0 14px; }
@media (min-width: 560px) {
  .sv-docs { grid-template-columns: repeat(3, 1fr); }
}
```

O nome tem prefixo de módulo de propósito: CSS de módulo só **acrescenta** ao
vocabulário comum, e um nome genérico aqui arriscaria colidir com o global
depois (`.claude/rules/ui.md`).

- [ ] **Passo 5: Verificar a ficha no browser**

Servidores não renderiza ficha sem banco. Injetar um servidor de mentira - **com
dados inventados, nunca reais** (R7) - pelo `javascript_tool`, depois de navegar
para `?v=8#/servidores`:

```js
// Dado 100% inventado, só para a gaveta ter o que desenhar.
const mod = await import('/src/modules/servidores/views/detalhe.js');
const s = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001', nome: 'FULANO DE TAL EXEMPLO',
  apelido: 'Fulano', email: 'nome@exemplo.com', cpf: '000.000.000-00',
  rg: '00.000.000-0', codigo_funcional: '000000', nascimento: '1980-01-01',
  inicio_rede: '2010-01-01', telefones: [],
  vinculos: [{ id: 'v1', unidade_id: 'u1', papel: 'Diretor(a)', ingresso: '2020-01-01',
               fim: null, unidade: { id: 'u1', nome: 'ESCOLA EXEMPLO', apelido: 'Exemplo', tipo: 'escola' } }],
};
mod.detalhe('aaaaaaaa-0000-4000-8000-000000000001',
  { lista: [s], podeEditar: true, abrirFormServidor(){}, removerServidor(){} });
document.querySelector('.drawer-head').innerText
```

Esperado: o texto traz o nome completo e, abaixo, `Diretor(a) · ESCOLA EXEMPLO`
(**nome completo**, não `Exemplo`). Sem apelido.

- [ ] **Passo 6: Conferir que os campos duplicados saíram e os documentos alinham**

Com a mesma gaveta aberta:

```js
({
  temCargoNoCorpo: [...document.querySelectorAll('.drawer-body .lbl')].map(e => e.textContent),
  colunasDocs: getComputedStyle(document.querySelector('.sv-docs')).gridTemplateColumns,
})
```

Esperado: a lista de rótulos **não** contém "Cargo / função" nem "Lotação"; e
`colunasDocs` tem três valores (três colunas) numa janela larga. Repetir com
`resize_window { preset: "mobile" }`: uma coluna só.

- [ ] **Passo 7: Verificar a arquitetura e commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
```

```bash
git add src/modules/servidores && git diff --cached
```

Ler o diff procurando dado real - o Passo 5 injetou dados no browser, não no
arquivo, mas a conferência é obrigatória (R7).

```bash
git commit -m "feat(servidores): a ficha responde 'faz o que, onde' no cabecalho

Cargo e escola do vinculo aberto sobem para o cabecalho da gaveta, com o
nome COMPLETO da escola. Saem do corpo: eram a terceira exibicao do mesmo
fato, ja que a lista de vinculos logo abaixo traz cargo, escola e periodo.
O apelido sai do cabecalho - ele ajuda a ACHAR a pessoa, e isso e papel do
card na lista, nao da ficha dela.

Codigo funcional, CPF e RG passam a dividir uma linha no desktop.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 5: Editar servidor - botão voltar e lotação completa

Implementa D5 e a parte de D4 que cabe no formulário. Itens (d) e (e) do pedido.

**Arquivos:**
- Modificar: `src/modules/servidores/servidores.view.js:137`
- Modificar: `src/modules/servidores/views/detalhe.js` (a linha do `sv-edit`)
- Modificar: `src/modules/servidores/views/formulario.js:21`, `111`, `114-157`

**Interfaces:**
- Consome: `lotacaoDe(s, { completo })` (Tarefa 4); `abrirDrawer(html, { voltar })`
  e `fecharDrawer()` de `shared/ui/drawer.js` (já existentes).
- Produz: `ctx.abrirFormServidor(s, opts)` - o segundo parâmetro é repassado a
  `formServidor` como `{ voltar }`.

- [ ] **Passo 1: Deixar o `ctx` repassar as opções**

Em `src/modules/servidores/servidores.view.js`, linha 137, dentro de `ctxAtual()`:

```js
    abrirFormServidor: (s, opts) => formServidor(s, ctxAtual(), opts),
```

- [ ] **Passo 2: A ficha pede o voltar**

Em `src/modules/servidores/views/detalhe.js`, no bloco `if (ctx.podeEditar)`,
trocar a linha do `sv-edit` por:

```js
    // Editar a partir da ficha empilha a gaveta: o ← devolve para cá, com o
    // dado recarregado. Sem isto, salvar fechava a pilha inteira e jogava a
    // pessoa de volta na lista, perdendo o contexto que ela mesma abriu.
    document.getElementById('sv-edit').addEventListener('click', () =>
      ctx.abrirFormServidor(s, { voltar: (freshCtx) => detalhe(s.id, freshCtx || ctx) }));
```

`fecharDrawer()` chama `voltar()` **sem argumento** (ver `drawer.js:68`), então
`freshCtx` fica `undefined` e o `|| ctx` assume. Ao salvar, o Passo 4 chama
`voltar(novoCtx)` com o contexto recarregado.

- [ ] **Passo 3: Lotação com o nome completo no formulário**

Em `src/modules/servidores/views/formulario.js`, linha 21:

```js
  const lotacao = s ? lotacaoDe(s, { completo: true }) : '';
```

- [ ] **Passo 4: Salvar volta para a ficha**

Ainda em `formulario.js`, linha 111, passar o `voltar` adiante:

```js
  form.addEventListener('submit', (e) => salvarServidor(e, s, ctx, voltar));
```

E na função `salvarServidor` (linhas 114-158), mudar a assinatura e o trecho de
sucesso. A assinatura:

```js
async function salvarServidor(e, s, ctx, voltar) {
```

E o `try` (hoje linhas 146-151) passa a:

```js
  try {
    const id = s ? (await atualizarServidor(s.id, payload), s.id) : (await criarServidor(payload)).id;
    await sincronizarTelefones({ servidorId: id }, telefones);
    const novoCtx = await ctx.recarregar();
    // Veio da ficha: volta para ela já com o dado novo, em vez de fechar a
    // pilha inteira. Mesmo padrão de views/vinculo.js § salvar.
    if (voltar) voltar(novoCtx); else fecharDrawer();
    toast({ titulo: s ? 'Servidor atualizado' : 'Servidor cadastrado', texto: payload.nome, tipo: 'sucesso' });
  } catch (err) {
```

A ordem mudou de propósito: recarregar **antes** de fechar, para que a ficha de
baixo reabra com o dado novo. O `catch` não muda.

- [ ] **Passo 5: Verificar o ← no browser**

Navegar para `?v=9#/servidores` e, com `javascript_tool`, repetir a injeção do
Passo 5 da Tarefa 4 e clicar em Editar:

```js
document.getElementById('sv-edit').click();
({
  temVoltar: Boolean(document.querySelector('.drawer-voltar')),
  titulo: document.querySelector('.drawer-head h2')?.textContent,
  lotacao: [...document.querySelectorAll('.campo-derivado')].map(e => e.textContent.trim()),
})
```

Esperado: `temVoltar` = `true`; `lotacao` traz `ESCOLA EXEMPLO` (nome completo),
não `Exemplo`.

- [ ] **Passo 6: Verificar que "Novo servidor" NÃO tem ←**

```js
document.querySelector('.drawer-close').click();
document.getElementById('sv-novo')?.click();
Boolean(document.querySelector('.drawer-voltar'))
```

Esperado: `false` - não há para onde voltar.

- [ ] **Passo 7: Conferir a altura dos derivados**

Com a gaveta de edição aberta (Passo 5):

```js
[...document.querySelectorAll('#sv-form input, #sv-form .campo-derivado')]
  .map(el => Math.round(el.getBoundingClientRect().height))
```

Esperado: todos iguais - inclusive o `input[type="date"]` do nascimento e os
dois `.campo-derivado`. É a prova da Tarefa 1 aplicada nesta tela.

- [ ] **Passo 8: Verificar a arquitetura e commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
```

```bash
git add src/modules/servidores && git diff --cached
```

```bash
git commit -m "feat(servidores): editar a partir da ficha empilha, com o botao voltar

Editar um servidor pela ficha dele fechava a pilha inteira ao salvar e
devolvia a pessoa a lista, perdendo o contexto que ela mesma tinha aberto.
Agora a gaveta empilha - com o ←, como a de vinculo ja fazia - e salvar
volta para a ficha com o dado recarregado.

A lotacao no formulario passa a mostrar o nome completo da escola: o
apelido existe para caber no card, e aqui ha espaco.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 6: Linha de telefone em uma linha

Implementa D6 da spec. Item (g) do pedido, na forma corrigida: o rótulo **fica**;
o que muda é a métrica.

**Arquivos:**
- Modificar: `src/shared/ui/phones.js:81-85`
- Modificar: `src/styles/components.css` (bloco `.phone-*`)

**Interfaces:**
- Consome: `--campo` (Tarefa 1).
- Não muda nenhuma assinatura: `phonesEditorHtml`, `montarPhonesEditor` e
  `lerPhonesEditor` seguem iguais, e `lerPhonesEditor` continua devolvendo
  `rotulo`.

- [ ] **Passo 1: Tirar a palavra do toggle, manter o significado**

Em `src/shared/ui/phones.js`, substituir o bloco do `.phone-pri` (linhas 81-85)
por:

```js
      <label class="switch radio phone-pri" title="Telefone principal">
        <input type="radio" name="phone-pri" aria-label="Telefone principal" ${t.principal ? 'checked' : ''} />
        <span class="switch-trilho" aria-hidden="true"></span>
      </label>
```

A palavra "principal" era o item que mais custava largura e o que menos
precisava de texto: só há um por linha, e o significado está na exclusividade do
radio. O `aria-label` mantém o rótulo para quem usa leitor de tela.

**Não remover** a regra `.switch input:checked ~ .switch-txt` de
`components.css`: `.switch-txt` continua sendo usado por
`horarios/views/cargos.js`, `horarios/views/grade.js` e
`usuarios/views/lista.js`.

- [ ] **Passo 2: Compactar a linha a partir de 560px**

Em `src/styles/components.css`, substituir o bloco `.phone-row` do
`@media (min-width: 560px)` (hoje linhas 817-825) por:

```css
  /* Tipo · número · rótulo · principal · remover, os cinco numa linha.
     A fonte cai para 13px SÓ aqui: no celular a linha empilha e precisa
     dos 16px que evitam o zoom automático do iOS ao focar.
     A ALTURA não muda - continua var(--campo), como todo campo do hub;
     o espaço vem da largura, não do achatamento. */
  .phone-row {
    grid-template-columns: 96px minmax(132px, 1.1fr) minmax(96px, 1fr) auto auto;
    align-items: center;
    gap: 8px;
  }
  .phone-row :is(select, input[type="tel"], input[type="text"]) {
    padding: 5px 8px;
    font-size: 13px;
  }
  .phone-del { width: 30px; }
```

- [ ] **Passo 3: Ajustar a altura do botão de remover**

Ainda em `components.css`, na regra `.phone-del` (hoje linha 796), trocar
`height: 30px` por `height: var(--campo)`, para o × alinhar com os campos da
linha:

```css
.phone-del { justify-self: end; width: var(--toque); height: var(--campo); border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--danger); font-size: 18px; line-height: 1; cursor: pointer; }
```

- [ ] **Passo 4: Medir a linha no browser**

Navegar para `?v=10#/meus-dados` (tem o editor de telefones e abre sem banco).
Com `javascript_tool`:

```js
document.querySelector('.phone-add')?.click();
const r = document.querySelector('.phone-row');
({
  colunas: getComputedStyle(r).gridTemplateColumns,
  linhas: new Set([...r.children].map(c => Math.round(c.getBoundingClientRect().top))).size,
  larguraUsada: Math.round(r.scrollWidth),
  larguraDisponivel: Math.round(r.clientWidth),
})
```

Esperado: `linhas` = **1** (os cinco filhos no mesmo topo), e `larguraUsada`
menor ou igual a `larguraDisponivel` (não transborda).

- [ ] **Passo 5: Conferir que o celular continua sem zoom**

`resize_window` com `{ preset: "mobile" }`, recarregar e rodar:

```js
getComputedStyle(document.querySelector('.phone-num')).fontSize
```

Esperado: `16px` - abaixo de 560px a linha empilha e a fonte volta ao tamanho
que evita o zoom do iOS. Voltar a `{ preset: "desktop" }`.

- [ ] **Passo 6: Conferir que o rótulo continua sendo lido e gravado**

```js
const f = document.querySelector('form');
document.querySelector('.phone-num').value = '(16) 90000-0000';
document.querySelector('.phone-rot').value = 'recado';
const m = await import('/src/shared/ui/phones.js');
m.lerPhonesEditor(f)
```

Esperado: um objeto com `rotulo: 'recado'` e `principal: true`. O campo de
rótulo não saiu do sistema - só a métrica da linha mudou.

- [ ] **Passo 7: Verificar a arquitetura e commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
```

```bash
git add src/shared/ui/phones.js src/styles/components.css && git diff --cached
```

```bash
git commit -m "fix(ui): os cinco campos da linha de telefone cabem numa linha

Tipo, numero, rotulo, principal e remover se espremiam na gaveta. A fonte
dos controles cai para 13px a partir de 560px (no celular a linha empilha
e precisa dos 16px que evitam o zoom do iOS) e a palavra 'principal' sai
do toggle, mantendo o aria-label - era o item que mais custava largura e o
que menos precisava de texto.

A altura nao muda: continua var(--campo), como todo campo do hub.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 7: Documentação, versão e reversão do patch

**Arquivos:**
- Modificar: `.claude/rules/ui.md`
- Modificar: `src/core/config.js:12`
- Modificar: `CHANGELOG.md`
- Reverter: `src/core/config.js` (chave) e `src/core/perfil.js` (perfil de dev)

- [ ] **Passo 1: Registrar o vocabulário novo na regra de UI**

Em `.claude/rules/ui.md`, na seção "Vocabulário existente - reusar antes de
criar", substituir a linha de Página e acrescentar a de Filtros:

```markdown
- **Página:** `.page-head` · `.toolbar` · `.toolbar-linha` · `.count`
- **Filtros:** `.painel-filtros` (o contêiner) + `.filtro-campo` · `.switch` · `.filters` · `.chip-filtro`
```

`.filters` e `.subfiltros` saem da linha de Página; `.subfiltros` e
`.search.compacta` não existem mais.

- [ ] **Passo 2: Acrescentar as duas regras novas**

Em `.claude/rules/ui.md`, logo depois da seção "Vocabulário existente":

```markdown
## Formulário: três papéis, três tratamentos

Todo formulário do hub lê em três níveis, e cada um tem um token:

| Papel | Token | Forma |
|---|---|---|
| Legenda de bloco (`<legend>`) | `--form-legend` | 11.5px · 700 · ALTA · .06em · com traço embaixo |
| Rótulo de campo (`<label>`) | `--form-label` | 11.5px · 700 · ALTA · .04em |
| Conteúdo do campo | `--form-field` | 16px · 400 · caixa normal |

Não escrever `--text` nem `--muted` direto num rótulo de formulário - use o
token do papel. Todo controle de formulário tem `min-height: var(--campo)` e
`line-height: 1.25` **declarados**: sem isso, `input`, `span` e
`input[type="date"]` herdam entrelinha de lugares diferentes e saem com três
alturas na mesma linha.

## Filtros: um painel por tela de lista

Toda tela de lista com filtro usa **um** `.painel-filtros`, e só ele. Dentro
entram `.filtro-campo` (rótulo acima do controle), `.switch`, `.filters`
(grupo de chips), `.chip-filtro` e `.count`. Nada mais.

O rótulo fica **acima** do controle, e o painel alinha os controles pela
**base** (`align-items: end`) - é a base compartilhada que faz a linha ler
como uma linha. A caixa de busca por texto (`.search`) fica **fora**, na
`.toolbar` acima do painel.

O filtro por segmento (`shared/ui/filtro-segmento.js`) fica fora do painel,
na própria linha: é multi-escolha com memória de sessão, outro mecanismo.
```

- [ ] **Passo 3: Subir a versão**

Em `src/core/config.js`, linha 12 - PATCH, porque é correção visual e não muda
modelo de dados:

```js
  versao: '0.14.1',
```

- [ ] **Passo 4: Registrar no CHANGELOG**

Em `CHANGELOG.md`, logo depois da linha `---`, antes de `## [0.14.0]`. Escrito
para quem **usa** o sistema: sem jargão, sem nome de arquivo, sem nome de classe.

```markdown
## [0.14.1] - 2026-09-02

Rodada de acabamento visual: formulários e filtros ficam mais fáceis de ler,
e a ficha do servidor foi reorganizada.

### Alterado
- Nos formulários, o título de cada bloco, o nome de cada campo e o que você
  digita agora se distinguem à primeira vista. Antes o nome do campo saía do
  mesmo tamanho e da mesma cor do conteúdo dele.
- Campos de data e campos apenas para leitura deixaram de sair mais altos que
  os campos de texto ao lado.
- Os filtros de todas as listas passaram a ficar num painel só, em uma linha,
  com os campos alinhados. Vale para Servidores, Escolas, Visitas,
  Ocorrências, Projetos, Atas, Afastamentos e o registro de alterações.
- Na ficha do servidor, o cargo e a escola atuais aparecem logo abaixo do nome,
  com o nome completo da escola. Deixaram de aparecer repetidos no meio da
  ficha, já que a lista de vínculos logo abaixo mostra os dois com o período.
- Código funcional, CPF e RG passaram a dividir a mesma linha da ficha.
- Editar um servidor a partir da ficha dele agora tem botão de voltar, e ao
  salvar você volta para a ficha em vez de cair na lista.
- A linha de cadastro de telefone passou a caber inteira em uma linha.
```

- [ ] **Passo 5: Reverter o patch de dev-local**

Desfazer P1 e P2 da Preparação.

Em `src/core/config.js`, restaurar a chave publishable (que é pública por
design e vive no repositório):

```js
  supabaseAnonKey: 'sb_publishable_LGg_RNYhGwVVQwciIoBswA_EwDxfR_J',
```

Em `src/core/perfil.js`, linha 22, restaurar:

```js
  if (!hasSupabase()) { _cache = null; return null; }
```

- [ ] **Passo 6: Provar que o patch saiu**

```bash
grep -rn "dev@local\|admin_sme'," src/core/ ; git diff --stat src/core/
```

Esperado: nenhum `dev@local` em `src/core/`, e `git diff` de `src/core/`
mostrando **apenas** a mudança de versão em `config.js`.

- [ ] **Passo 7: Varredura final**

```bash
python .claude/scripts/verificar_arquitetura.py
```

```bash
grep -rn "subfiltros\|search compacta\|filtros-linha\|campoAcao" src/
```

Esperado: nenhum resultado no segundo comando.

- [ ] **Passo 8: Commit**

```bash
git add .claude/rules/ui.md src/core/config.js src/core/perfil.js CHANGELOG.md && git diff --cached
```

```bash
git commit -m "chore: versao 0.14.1 e registra os padroes de formulario e filtro

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Passo 9: Parar o servidor de preview**

Usar `preview_stop` com o `serverId` devolvido pelo `preview_start` da
Preparação.

---

## Verificação final (a lista da spec § 5)

Depois da Tarefa 7, com o app ainda servido em dev-local (ou reabrindo o
preview se já foi parado), percorrer:

- [ ] Formulários: legenda lê como seção em Servidores, Escolas, Afastamentos,
      Meus dados, Usuários, SATE, Horários e Login.
- [ ] Numa linha com campo de texto, campo de data e `.campo-derivado`, os três
      têm a mesma altura e a mesma base.
- [ ] Os 8 módulos com lista mostram o mesmo painel; controles com base
      compartilhada; painel ocupando a largura; coluna abaixo de 560px.
- [ ] Jornada semanal (`#/horarios`, gaveta de jornada): as legendas de dia
      (`fieldset.form-grupo.hj-dia`) agora saem em caixa alta e com traço.
      Conferir que `.hj-total` ao lado continua legível.
- [ ] Servidores: cabeçalho com cargo e escola, sem apelido; sem os campos
      duplicados; documentos em uma linha no desktop; `←` ao editar pela ficha
      e ausente em "Novo servidor"; salvar volta para a ficha.
- [ ] Telefones numa linha em Servidores, Escolas e Meus dados a partir de 560px.
- [ ] Tela estreita (375px) e larga; tema claro e escuro; console limpo.
