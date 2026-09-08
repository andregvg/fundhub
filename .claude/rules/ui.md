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
| `modal.js` (abre/fecha, Esc, foco, pilha) | listas simples, cards |
| `tabela.js` (ordem, página, busca, expansão) | grades estáticas de leitura |
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
- **Stats:** `.stat-row` · `.stat-tile` · `.stat-num` · `.stat-label`
- **Formulário:** `.esc-form` · `.esc-row` · `.form-grid` · `.form-grupo` · `.form-foot` · `.form-hint` · `.field` · `.lbl`
- **Botões:** `.btn-primary` · `.btn-secundario` · `.btn-perigo` (ação destrutiva, só em diálogo) · `.mini-btn` (com `.ok` / `.no`)
- **Marcadores:** `.chip` · `.tag` · `.badge` · `.pill`
- **Modal:** `.modal` e família - usar sempre via `shared/ui/modal.js`, nunca à mão
- **Confirmação:** `.confirmar-back`/`.confirmar-card` - usar sempre via `shared/ui/confirmar.js`, nunca à mão
- **Tabela:** `.tabela` e família - usar sempre via `shared/ui/tabela.js`, nunca à mão
- **Busca:** `.search` (a caixa de busca por texto; `.compacta` = um controle único na toolbar)

CSS de módulo (`<modulo>.css`) só **acrescenta** ao vocabulário comum; nunca redefine `.card`,
`.chip` ou `.btn-*`. Se você precisa mudar um componente global, mude em `components.css` - e então
ele muda no hub inteiro, que é o objetivo.

## Formulário: três papéis, três tratamentos

**Superfície em forma de formulário se DECLARA formulário.** `.esc-form`,
`.form-grid` e `.filtro-campo` são o que concede altura de campo, reset de
`date`/`time`, anel de foco e tipografia de rótulo. Quem desenha campo fora
dos três acaba remendando `min-height` à mão, e desigualmente - foi o que
aconteceu com os painéis de configuração e com o modal "Tipos de escala"
até 06/09/2026. O painel de configuração já nasce dentro de `.esc-form`
(`configuracoes/painel.js`): **um `painel:` de módulo nunca declara
`--campo`.**

**Componente não decide como se alinha no container dos outros.** `align-self` é decisão de
quem monta a linha, não do componente. O `.switch` e o `.chip-filtro` nascem `align-self: start`,
que é o certo para o caso comum (container em coluna - formulário, item de configuração), e o
único lugar que quer alinhamento pela base pede: `.painel-filtros` no `@media` de 1100px. Até
07/09/2026 o padrão era `end` e **nenhum** container o queria - os quatro que hospedam um `.switch`
o desfaziam, e o quinto a nascer herdava o toggle jogado na borda direita. Se você criar um
container novo e precisar desfazer o padrão de um componente, o padrão é que está errado.

**Rótulo de campo é a classe `.lbl`**, não um bloco de cinco declarações
copiado. Ela vale sozinha (`<div class="lbl">`) e ao lado de uma classe de
posicionamento do módulo (`class="lbl cfg-cob-tipo"`). Os `<label>` de
`.form-grid`, `.esc-form` e `.form-grupo .campos` já recebem o tratamento
pela estrutura e não precisam da classe.

**Classe no markup sem regra de CSS não faz nada** - e ninguém percebe, porque
CSS ausente é silencioso. A checagem 12 do verificador avisa quando uma classe
não existe em CSS nenhum **nem** é usada como seletor em JS. Se você quer um
gancho só para o JS, tudo bem: use-o num `querySelector` e a checagem entende.
O que não vale é deixar o nome no HTML esperando que alguém adivinhe.

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
ganha a altura certa sem precisar declarar nada. Não se aplica a botão de ação de lista/modal
(`.modal-acoes`, `.solic-acoes`) nem a `.campo-derivado` (não tem `input`/`select`, é `<span>`) -
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

Não há exceção pendente: desde 07/09/2026 não resta nenhuma chamada nativa em `src/`. Se você
encontrar uma, ela é regressão - não precedente.

### As duas superfícies sobrepostas

| Componente | Papel | Quando |
|---|---|---|
| `shared/ui/modal.js` | **detalhe e edição** | ficha, formulário, qualquer tela que interrompe |
| `shared/ui/confirmar.js` | **decisão pontual** (`alertdialog`) | uma pergunta, dois botões, nada mais |

**São duas, e só duas.** A gaveta lateral (`shared/ui/drawer.js`) foi deletada em 08/09/2026, com
as ~20 telas convertidas no mesmo commit. Ela não foi mantida "por compatibilidade": duas formas de
abrir a mesma tela é exatamente o que a spec veio encerrar, e uma gaveta esquecida no repositório
vira a forma que alguém copia sem saber.

O modal centraliza nos dois eixos, rola **no corpo** para o cabeçalho e o rodapé de formulário
ficarem parados, e **abaixo de 560px ocupa a tela inteira** - cartão de 420px em tela de 360px é
cartão de 360px com margem inútil.

**Três larguras, declaradas na chamada:**

| `tamanho` | | Para |
|---|---|---|
| `estreito` | 420px | confirmação com contexto, escolha curta |
| `medio` | 560px (padrão) | quase tudo |
| `largo` | 760px | formulário denso: escola, servidor, jornada da semana |

A largura é decisão de **quem abre**, não de largura de tela. Até 07/09/2026 a gaveta engordava
sozinha num `@media (min-width: 1280px)`, o que dava mais espaço a todo formulário do hub por causa
de dois deles.

**As duas prendem o foco** (`shared/ui/foco.js`). Um elemento com `aria-modal="true"` está
afirmando que o resto da página não existe; sem armadilha, o Tab atravessa e vai passear pelo menu
que o leitor de tela acabou de anunciar como inexistente. Se você criar uma terceira superfície
modal, ela prende o foco também - não é opcional.

## R18 - O padrão de lista

Spec: `docs/superpowers/specs/2026-09-08-listas-e-modais-design.md`.

### Tabela ou cartão

| Use **tabela** quando | Use **cartão** quando |
|---|---|
| as linhas se comparam entre si | cada item se lê sozinho |
| há 4+ atributos do mesmo tipo em todas as linhas | os atributos variam de item para item |
| a lista passa de ~20 itens com frequência | a lista é curta e navegável de olho |
| ordenar por um atributo é uma pergunta real | a ordem é sempre a mesma |

Escolas e Servidores são **cartão**: são fichas de identidade, e o que se faz ali é reconhecer,
não comparar. Usuários, Auditoria e as solicitações do SATE são **tabela**.

### Toda tabela é `shared/ui/tabela.js`

Nenhuma view escreve `<table>` à mão. A view **declara** colunas, ações e dados:

```js
montarTabela(box, {
  colunas: [{ id, rotulo, prioridade, ordenavel, tipo, alinhar, valor, celula }],
  linhas, chave, acoes, buscarEm, porPagina, ordem, aoClicarLinha, substantivo, vazio,
});
```

**`valor` ordena e busca; `celula` desenha.** `valor(linha)` devolve texto ou número puro - é o
que o comparador recebe e o que a busca varre. `celula(linha)` devolve o HTML exibido. Sem a
separação, ordenar uma coluna de chip ordenaria pelo markup, igual em todas as linhas.

**O escape segue a R5, com o caminho seguro por default:** coluna só com `valor` é escapada pelo
componente; coluna com `celula` devolve HTML e o `esc()` é de quem escreveu a view.

**`tipo` decide o comparador** - nada é adivinhado pelo conteúdo. `texto` usa `localeCompare`
pt-BR; `numero` compara numericamente; `data` e `datahora` comparam **como string**, porque
`yyyy-mm-dd` e o ISO são ordenáveis lexicograficamente (R8) e nenhum `Date` precisa ser
construído.

### Celular: esconder coluna, nunca rolar de lado

Cada coluna declara `prioridade`: **1** nunca some · **2** some abaixo de 900px · **3** abaixo de
720px. A coluna de ações some abaixo de 720px. O que sumiu reaparece quando a linha é expandida -
**para baixo**, em pares rótulo → valor, com as ações ao pé.

O botão `▸` só aparece nas larguras em que há algo escondido; no desktop, com tudo à vista, ele
some e a linha não abre. A rolagem lateral existe só como rede de segurança no desktop.

**Tocar a linha expande** - salvo quando a tela declara `aoClicarLinha` (abrir um modal ou uma
rota): aí a linha faz isso e a expansão fica só no botão.

### Busca da tabela × painel de filtros

São dois mecanismos e podem coexistir na mesma tela:

| | `.painel-filtros` (da view) | busca da tabela (do componente) |
|---|---|---|
| Estreita | **o que é buscado no banco** | **o que já está na tela** |
| Recarrega o model | sim | não |

A busca da tabela mora **dentro** do componente, na barra `.tabela-topo`, junto da contagem. A
regra de `.search` na `.toolbar` vale para lista de **cartões** e continua valendo lá.

### Paginação no navegador

O model traz tudo; a tabela pagina, ordena e busca em memória (25 por página por padrão). Os
volumes do hub cabem com folga. **Não criar abstração de fonte paginável antes de existir uma
lista que doa** - quando doer, ela nasce ali, com o caso real guiando o formato (R13).

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
- modal fecha com `Esc`, devolve o foco e prende o Tab (já tratado por `modal.js` + `foco.js`).

## CSS novo de módulo

Arquivo `<modulo>.css` na pasta do módulo **e** uma linha de `@import` em `src/styles/main.css` -
sem o import ele simplesmente não carrega. O script verifica.
