# UI - tela, estilo e componentes

Regras R9, R12, R14, R16 e R17. Contexto em
`docs/superpowers/specs/2026-08-25-arquitetura-fundhub-design.md`.

## R12 - Quando é componente JS e quando é classe CSS

Esta é a regra que impede o FundHub de virar um mini-framework caseiro e `shared/` de virar
depósito:

> **Componente JS em `shared/ui/` só quando há comportamento** - estado, eventos, foco ou ciclo
> de vida. **Markup recorrente sem comportamento é classe CSS** em `styles/components.css`.

| Tem comportamento → componente JS | Só markup → classe CSS |
|---|---|
| `drawer.js` (abre/fecha, Esc, foco, fundo) | tabelas, listas, cards |
| `toast.js` (fila, timer, animação) | botões, badges, chips, tags |
| `phones.js` (máscara, add/remover, cursor) | formulários, campos, rodapé de form |
| `filtro-segmento.js` (seleção, memória de sessão) | grades, painéis, estados vazios |
| `feedback.js` (loading/vazio/erro - 3 usos, sem estado, mas contrato único) | toolbars, barras de aba |

Antes de criar um componente novo em `shared/ui/`: ele tem comportamento? Já existe em 3 lugares
(regra de três)? Ele é livre de domínio? Se qualquer resposta for não, é classe CSS ou fica no
módulo.

## Vocabulário existente - reusar antes de criar

Sempre conferir `src/styles/components.css` antes de escrever CSS novo. O que já existe:

- **Página:** `.page-head` · `.toolbar` · `.toolbar-linha` · `.count`
- **Filtros:** `.painel-filtros` (o contêiner) + `.filtro-campo` · `.switch` · `.filters` · `.chip-filtro`
- **Abas:** `.tabbar` + `.tab` (`.on` para a ativa)
- **Listas:** `.solic` (+ `.solic-main`, `.solic-acoes`) · `.dash-item` (+ `.di-top`, `.di-meta`)
- **Cards e grades:** `.card` · `.cards` · `.tile` · `.tiles` · `.panel` · `.dash-grid` · `.md-grid`
- **Stats:** `.stat-row` · `.stat-tile` · `.stat-ico` · `.stat-num` · `.stat-label`
- **Formulário:** `.esc-form` · `.esc-row` · `.form-grid` · `.form-grupo` · `.form-foot` · `.form-hint` · `.field`
- **Botões:** `.btn-primary` · `.btn-secundario` · `.btn-perigo` (ação destrutiva, só em diálogo) · `.mini-btn` (com `.ok` / `.no`)
- **Marcadores:** `.chip` · `.tag` · `.badge` · `.pill`
- **Gaveta:** `.drawer` e família - usar sempre via `shared/ui/drawer.js`, nunca à mão
- **Confirmação:** `.confirmar-back`/`.confirmar-card` - usar sempre via `shared/ui/confirmar.js`, nunca à mão
- **Busca:** `.search` (a caixa de busca por texto; `.compacta` = um controle único na toolbar)

CSS de módulo (`<modulo>.css`) só **acrescenta** ao vocabulário comum; nunca redefine `.card`,
`.chip` ou `.btn-*`. Se você precisa mudar um componente global, mude em `components.css` - e então
ele muda no hub inteiro, que é o objetivo.

## Formulário: três papéis, três tratamentos

Todo formulário do hub lê em três níveis, e cada um tem um token:

| Papel | Token | Forma |
|---|---|---|
| Legenda de bloco (`<legend>`) | `--form-legend` | 11.5px · 700 · ALTA · .06em · com traço embaixo |
| Rótulo de campo (`<label>`) | `--form-label` | 11.5px · 700 · ALTA · .04em |
| Conteúdo do campo | `--form-field` | 16px · 400 · caixa normal |

Não escrever `--text` nem `--muted` direto num rótulo de formulário - use o token do papel.

Todo controle de formulário tem `min-height: var(--campo)` e `line-height: 1.25` **declarados**.
Sem isso, `input`, `span` e `input[type="date"]` herdam entrelinha de lugares diferentes e saem com
três alturas na mesma linha - foi exatamente o que aconteceu até 02/09/2026. `--campo` (36px) fica
entre `--controle` (o botão, 32px) e `--toque` (40px), e sobe para `--toque` em `(pointer: coarse)`.

Campo somente-leitura que exibe valor longo (`.campo-derivado`) corta com reticências e guarda o
inteiro no `title`: um campo que cresce para duas linhas deixa de casar com os vizinhos.

## R17 - Altura de campo e de botão de linha

Dois paradigmas do hub, decisão do André (05/09/2026):

**Todo campo de formulário tem a mesma altura - inclusive data e hora.** `input[type="date"]` e
`input[type="time"]` não são exceção: dentro de `.esc-form`, `.form-grid` ou `.filtro-campo` eles já
herdam `--campo` como qualquer `input`/`select` (`components.css`), e o padding extra que o WebKit
dá ao miolo do date/time é zerado à parte (`::-webkit-datetime-edit-fields-wrapper`) para não sair
2px mais alto que o campo de texto ao lado. **Um campo de data/hora novo sempre nasce dentro de um
desses três containers** - é o que garante a altura de graça; não estilizar data/hora à parte.

**Um botão de ação que divide LINHA com campo(s) usa a altura do campo (`--campo`), não a altura
padrão de botão (`--controle`/`.mini-btn`).** Exemplos: excluir um bloco de horário ao lado do
início/fim (`jornada.js`), descartar uma proposta ao lado do `<select>` de escala
(`calendario/views/escalas.js`). A regra é **estrutural**, não por classe nova - pega qualquer
`<div>`/`<form>` cujo filho direto seja `input`/`select` e que também tenha um `.mini-btn` como
filho direto (`components.css`). Um módulo novo com esse mesmo desenho (linha = campo(s) + botão)
ganha a altura certa sem precisar declarar nada. Não se aplica a botão de ação de lista/gaveta
(`.drawer-acoes`, `.solic-acoes`) nem a `.campo-derivado` (não tem `input`/`select`, é `<span>`) -
nenhum dos dois tem campo como filho direto do mesmo container.

## Filtros: um painel por tela de lista

Toda tela de lista com filtro usa **um** `.painel-filtros`, e só ele. Dentro entram
`.filtro-campo` (rótulo acima do controle), `.switch`, `.filters` (grupo de chips),
`.chip-filtro` e `.count`. Nada mais.

O rótulo fica **acima** do controle, e o painel alinha os controles pela **base**
(`align-items: end`) - é a base compartilhada que faz a linha ler como uma linha. A caixa de busca
por texto (`.search`) fica **fora**, na `.toolbar` acima do painel.

O filtro por segmento (`shared/ui/filtro-segmento.js`) fica fora do painel, na própria linha: é
multi-escolha com memória de sessão, outro mecanismo.

## R9 - Nenhuma cor literal em módulo

Nenhum `#hex`, `rgb()` ou `hsl()` dentro de `src/modules/**`, no CSS ou no JS. Só `var(--token)`.
Os tokens vivem em `src/styles/tokens.css`, com variante clara e escura - é o que faz o tema escuro
sair de graça.

Se falta uma cor, o caminho é **acrescentar um token** em `tokens.css` (nas duas variantes), não
escrever a cor no módulo.

## R14 - Identidade por módulo (sob demanda, não por padrão)

**Decisão do André (25/08/2026): não criar uma cor por módulo especulativamente.** O padrão é UM
sistema de tokens compartilhado (`--brand`, `--brand-2`, `--accent`, `--danger`, `--ok` + o que for
preciso completar de forma harmônica nele) - não 17 paletas. Todo módulo usa esse padrão até o
André pedir destaque próprio para um módulo específico.

Quando ele pedir, o mecanismo (ainda não implementado - só nasce no primeiro pedido, regra de três
não se aplica a uma decisão já tomada pelo dono do produto) é:

1. `tokens.css` ganha `--mod-<nome>`, com valor claro e escuro;
2. o manifesto daquele módulo declara `cor: '<nome>'` (ao lado de `ico`);
3. o roteador aplica `--modulo: var(--mod-<nome>)` no container da página;
4. o CSS daquele módulo usa `var(--modulo)` onde hoje usaria `var(--brand)`.

Módulo sem `cor` cai em `--brand` - o default continua consistente. O que **não** muda por módulo,
nem quando um ganhar destaque: fundo, superfície, borda, texto, sombra, raio, tipografia e
espaçamento. Identidade é o destaque, não um tema próprio.

## R16 - Diálogos

Não usar `confirm()` / `alert()` / `prompt()` nativos: são bloqueantes, não estilizáveis e ficam
fora do design system. Usar `shared/ui/confirmar.js`.

> Estado atual: `confirm()`/`alert()` ainda aparecem em ações destrutivas (afastamentos e outros).
> Substituir quando tocar no arquivo; não vale abrir refatoração só para isso.

## Mobile-first de verdade

Base = celular. `@media (min-width: …)` **acrescenta**, nunca subtrai. Cortes: **560 · 720 · 900 ·
1100px**. A navegação vira menu ☰ abaixo de 1100px.

Alvo de toque mínimo garantido por `@media (pointer: coarse)` (token `--toque: 40px`), sem impor o
tamanho ao desktop (`--controle: 32px`). Botões seguem o padrão discreto do GitHub: compactos,
borda sutil, raio pequeno.

**Testar toda entrega em tela estreita** antes de commitar.

## Acessibilidade - o mínimo que se cumpre hoje

- `aria-label` em botão que só tem ícone (`×`, `✎`, `←`);
- `aria-hidden="true"` em ícone decorativo (emoji, SVG ornamental);
- `role="tablist"` / `role="tab"` + `aria-selected` nas barras de aba;
- `aria-expanded` em toggle de menu ou dropdown;
- gaveta fecha com `Esc` e devolve o foco (já tratado por `drawer.js`).

## CSS novo de módulo

Arquivo `<modulo>.css` na pasta do módulo **e** uma linha de `@import` em `src/styles/main.css` -
sem o import ele simplesmente não carrega. O script verifica.
