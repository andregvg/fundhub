# FundHub - Hierarquia de formulário e painel de filtros

> Decisões tomadas em 02/09/2026, a partir de um pedido de melhorias no módulo
> Servidores que revelou dois problemas de sistema, não de módulo. Este
> documento explica o **porquê**; o plano de implementação detalha o **como**.
>
> Spec irmã: `2026-08-27-sistema-visual-design.md`, que fixou ícones, toggles,
> mensagens e vazios. Esta continua o mesmo trabalho em duas frentes que ficaram
> de fora: a **leitura de um formulário** e a **barra de filtros de uma lista**.

## 1. Objetivo

O pedido original era uma lista de nove ajustes na ficha do servidor. Sete são
ajustes de tela. Dois não são:

- **A hierarquia visual de um formulário não existe.** Dentro de um `fieldset`,
  o rótulo do campo tem o mesmo tom, o mesmo peso e quase o mesmo tamanho do
  que foi digitado no campo; e a legenda da seção é o elemento mais apagado da
  tela. A hierarquia não é fraca - está invertida.
- **Cada módulo desenha sua própria barra de filtros.** Há três vocabulários
  concorrentes para a mesma coisa, e nenhum deles é o padrão.

Os dois são infraestrutura visual compartilhada. Resolvidos uma vez, valem para
os 18 arquivos que hoje montam formulário e para os 8 módulos que hoje montam
lista com filtro - e módulo novo nasce certo sem ninguém lembrar da regra.

Fora de escopo, explicitamente: identidade de cor por módulo (R14 continua
valendo), o filtro por segmento (§6) e qualquer mudança de comportamento -
nenhum filtro filtra diferente, nenhum formulário grava campo diferente.

## 2. Diagnóstico

### 2.1 Formulário: três papéis, hierarquia invertida

| Papel | Onde | Cor | Tamanho | Peso | Caixa |
|---|---|---|---|---|---|
| **Legenda de bloco** | `.form-grupo > legend` | `--muted` | 11px | 700 | ALTA |
| **Rótulo dentro de `fieldset`** | `.form-grupo .campos label` | **`--text`** | **15px** | **400** | normal |
| **Rótulo fora de `fieldset`** | `.form-grid label`, `.field .lbl` | `--muted` | 11.5-12px | 700 | ALTA |
| **Conteúdo do campo** | `input`, `select` | `--text` | 16px | 400 | normal |

Dois achados, e o segundo explica o primeiro:

**O rótulo dentro de um `fieldset` não tem regra de tipografia nenhuma.**
`.form-grupo .campos label:not(.inline)` declara só layout - `display: flex`,
`gap`, `min-width`. A tipografia cai no `body`. Nos formulários que usam
`fieldset` - e o de editar servidor é um deles - o rótulo e o conteúdo do campo
saem com **o mesmo tom, o mesmo peso e praticamente o mesmo tamanho**. Só a
posição distingue "Nome completo" do que foi digitado ali. É literalmente a
segunda queixa do pedido.

**A legenda é o elemento mais fraco da tela.** `--muted`, 11px, sobre rótulos em
`--text`, 15px. O título da seção tem menos peso visual que os itens que ele
contém - a hierarquia está invertida, e é por isso que a legenda "se confunde"
em vez de comandar o bloco.

E os rótulos que **têm** regra não concordam entre si. As mesmas oito linhas de
CSS foram escritas cinco vezes com números diferentes:

| Classe | font-size | letter-spacing |
|---|---|---|
| `.form-grid label`, `.esc-form > label` | 12px | .03em |
| `.auth-form label` | 12px | .04em |
| `.field .lbl` | 11.5px | .04em |
| `.phones > .lbl` | 11.5px | .04em |
| `.filtro-campo` | 11px | .04em |

Nenhuma dessas diferenças foi decidida - elas são sedimento.

### 2.2 Formulário: três alturas para o mesmo controle

Na mesma linha de um formulário convivem hoje três alturas diferentes:

| Controle | Altura resultante | Por quê |
|---|---|---|
| `input[type="text"]` | ~35px | `font-size: 16px` + `padding: 7px 10px`, sem altura declarada |
| `input[type="date"]` | ~38px | o `datetime-edit` do WebKit acrescenta padding interno próprio |
| `.campo-derivado` (span) | ~38px | herda `line-height: 1.5` do `body`, que o `input` não herda |

Nenhum dos três declara altura. As três alturas são consequência acidental de
onde cada um herda `line-height`. Por isso o campo de data e o span de "Lotação"
saem mais altos que o campo de texto ao lado - e por isso não adianta ajustar o
padding de um: o próximo controle novo vai errar de novo.

### 2.3 Filtros: três vocabulários para a mesma coisa

| Padrão | Onde | Forma |
|---|---|---|
| `.filtros-linha` + `.filtro-campo` | Servidores, Escolas | grid de selects com rótulo acima + `.switch` |
| `.toolbar.subfiltros` + `.search.compacta` | Visitas, Ocorrências, Projetos, Atas, Auditoria | caixas arredondadas com rótulo **inline** |
| `.filters` | Afastamentos | fila de chips solta, sem contêiner |

Os três resolvem o mesmo problema - "recortar a lista abaixo" - e nenhum se
parece com o outro. O `.search.compacta` é o caso mais claro de acidente: é a
classe da **caixa de busca**, reusada para segurar um campo de data porque era
a caixa arredondada que estava à mão.

Nenhum dos três se apresenta como uma superfície: os controles flutuam sobre o
fundo da página, e não há nada dizendo "isto aqui é o painel de filtros".

## 3. Decisões

### D1 - Três tons nomeados para o formulário

**Decisão:** três tokens em `tokens.css`, um por papel, aplicados de uma vez a
todas as classes de rótulo do hub.

```
--form-legend: var(--text);    /* título de seção - o mais forte */
--form-label:  var(--muted);   /* rótulo de campo - o mais quieto */
--form-field:  var(--text);    /* conteúdo digitado */
```

**Duas coisas mudam, e são exatamente as duas do diagnóstico:**

1. **A legenda sobe** de `--muted` para texto cheio e ganha uma divisória. Deixa
   de ser o elemento mais fraco e passa a comandar o bloco.
2. **O rótulo dentro de `fieldset` entra no vocabulário** que o resto do hub já
   usa: de `--text`/15px/400/normal para `--form-label`/11.5px/700/ALTA - a
   mesma forma de `.field .lbl` e `.phones > .lbl`. É aqui que nasce a
   diferença de tom entre rótulo e conteúdo que faltava.

O conteúdo do campo não muda. Nenhuma cor nova entra no sistema: a hierarquia
sai de tom, tamanho, peso, caixa e traço - que é o que "sóbrio e elegante"
quer dizer aqui.

```
DOCUMENTOS                       legend  ·  --form-legend  11.5px  700  ALTA  + traço
────────────────────────
CPF                              label   ·  --form-label   11.5px  700  ALTA
[ 000.000.000-00            ]    campo   ·  --form-field   16px    400  normal
```

**A legenda precisa do traço, não só da cor.** Com o rótulo subindo para caixa
alta e negrito (mudança 2), legenda e rótulo voltariam a se parecer se a
diferença fosse só de tom. A divisória é o que resolve:

```css
.form-grupo > legend {
  width: 100%;
  padding-bottom: 7px;
  margin-bottom: 3px;
  border-bottom: 1px solid var(--border);
  color: var(--form-legend);
  font-size: 11.5px;
  letter-spacing: .06em;
}
```

O traço faz a legenda ler como **divisão** e não como item. Sem cor de
destaque, sem tinta de marca, sem tamanho maior.

**Convergência dos rótulos:** os cinco divergentes de §2.1 **mais** os de
`fieldset` passam todos a `11.5px` / `.04em` / `700` / caixa alta /
`var(--form-label)`. O valor escolhido é o que já era maioria (`.field .lbl` e
`.phones > .lbl`). As classes continuam existindo - o que passa a ser único é a
declaração.

**Por que três tokens, se dois têm o mesmo valor.** `--form-legend` e
`--form-field` são ambos `var(--text)` hoje. Eles nunca competem entre si - uma
legenda nunca aparece na mesma linha que o conteúdo de um campo, e as duas se
distinguem por tamanho, peso e caixa. O valor do token não é a cor, é o
**nome**: quem for calibrar o tom da legenda depois mexe em um lugar, e quem
escrever formulário novo tem um vocabulário para seguir em vez de escolher entre
`--text` e `--muted` no escuro. É o mesmo raciocínio de `--sucesso-bg` e
companhia na spec de 27/08.

### D2 - Uma altura para todo controle de formulário

**Decisão:** um token de altura e uma `line-height` declarada, aplicados a todo
controle de formulário e ao `.campo-derivado`.

```
--campo: 36px;    /* tokens.css; em (pointer: coarse) sobe para var(--toque) */
```

```css
.form-grid :is(input, select, textarea),
.esc-form :is(input, select, textarea),
.filtro-campo :is(input, select),
.auth-form input,
.fr-of input,
.campo-derivado {
  min-height: var(--campo);
  line-height: 1.25;          /* declarada, não herdada */
}

/* As duas exceções, explícitas: caixa de seleção e o radio escondido do
   .switch têm tamanho próprio e não são "campo". */
:is(.form-grid, .esc-form) :is([type="checkbox"], [type="radio"]) { min-height: 0; }
```

A lista de seletores é longa de propósito. Um `input, select, textarea` solto
pegaria também o `input` sem borda de dentro da `.search`, o `checkbox` de 18px
e o radio de 1px escondido do `.switch` - três controles que não são campo de
formulário e que quebrariam. Enumerar os contêineres é o que mantém a regra
restrita ao que ela descreve.

**Por que declarar `line-height` resolve o problema e ajustar padding não.** As
três alturas de §2.2 divergem porque cada controle herda `line-height` de um
lugar diferente: o `input` não herda do `body`, o `span` herda, e o `date`
acrescenta o padding do `datetime-edit`. Enquanto a altura for consequência,
qualquer ajuste vale para os controles de hoje e falha no próximo. Declarando
altura mínima e entrelinha, a altura passa a ser **causa**: um controle novo
nasce com a altura certa sem que ninguém precise medir.

Para o `date`, some ainda o padding interno do WebKit
(`::-webkit-datetime-edit { padding: 0 }`). O indicador do calendário fica -
`appearance: none` não é usado, porque tirar o seletor nativo de data para
ganhar 2px seria trocar função por alinhamento.

Consequência de fronteira: `--campo` (36px) fica entre `--controle` (32px, o
botão) e `--toque` (40px, o alvo mínimo de toque). São três números com três
papéis distintos. Em `@media (pointer: coarse)`, `--campo` é redefinido para
`var(--toque)` - a mesma elevação que os botões já recebem hoje - de modo que
nenhum campo fique abaixo do alvo de toque no celular.

### D3 - `.painel-filtros`: um vocabulário de filtro para o hub inteiro

**Decisão:** um contêiner único substitui os três padrões de §2.3.

```css
.painel-filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 10px 16px;
  padding: 12px 14px;
  margin-bottom: 16px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
```

Dentro dele, e **só** isto:

| Peça | Papel |
|---|---|
| `.filtro-campo` | rótulo acima + `select`/`input` - `flex: 1 1 180px` |
| `.switch` | liga/desliga |
| `.filters` | grupo de chips (escolha entre poucos) |
| `.chip-filtro` | recorte vindo da URL, com o × que desfaz |
| `.count` | contagem, empurrada para a direita |

**`align-items: end`, não `center`.** O pedido dizia "alinhados verticalmente ao
centro". Com o rótulo **acima** do campo - que é o padrão do hub e foi
confirmado como tal - alinhar pelo centro colocaria o toggle na altura do
rótulo dos vizinhos, não na altura dos controles. O que faz a linha ler como uma
linha é os **controles** compartilharem a base, e é isso que `end` faz. Como o
painel tem a altura do seu conteúdo, a linha fica centrada nele de qualquer
forma. É a mesma escolha já feita no toggle de Usuários (spec de 27/08, D2).

**`flex: 1 1 180px` nos campos** é o que faz o painel ocupar a linha toda: os
selects dividem o espaço disponível em vez de deixar sobra à direita. Abaixo de
560px o painel vira coluna e cada campo ocupa a largura inteira.

**`.search.compacta` e `.subfiltros` são aposentados.** Os cinco módulos que os
usam trocam `<label class="search compacta">De <input type="date">` por
`<label class="filtro-campo">De <input type="date">`. O rótulo sobe, como em
todo o resto do hub. `.search` continua existindo para o que ela é: a caixa de
busca por texto, que fica na `.toolbar` acima do painel.

Onde o rótulo era um ícone sozinho (Visitas e Ocorrências usam
`${ico('escola')}` como rótulo do select de escola), ele ganha texto ao lado -
`${ico('escola')} Escola`. Ícone é decoração e não pode ser o único rótulo; isso
já é regra em `.claude/rules/ui.md`.

**Por que um painel com fundo próprio.** `--surface-2` sobre `--bg` é a
diferença mínima que ainda se percebe, e é a mesma superfície já usada por
`.dash-item` e pelo `.person`. O painel diz "os controles daqui recortam a
lista abaixo" sem borda grossa nem cor. Os chips e as caixas de busca dentro
dele continuam em `--surface`, então continuam legíveis como controles sobre a
superfície.

### D4 - Ficha do servidor: o cabeçalho responde "quem é"

**Decisão:** o cabeçalho da gaveta passa a carregar a identidade funcional, e o
corpo para de repetir o que a lista de vínculos já diz.

```
NOME COMPLETO DO SERVIDOR
Cargo atual · Escola vinculada agora
```

- **Sai o apelido do cabeçalho.** Ele continua no card da lista, que é onde
  ajuda a achar a pessoa. Na ficha dela, "quem é" já está respondido pelo nome;
  o que falta responder é "faz o quê, onde" - e era isso que estava a três
  campos de distância.
- **Saem os campos "Cargo / função" e "Lotação" do corpo.** Eram derivados do
  vínculo e apareciam duas vezes na mesma tela: como campo no topo e como item
  na lista de vínculos abaixo, que traz cargo, escola e período. Duas exibições
  do mesmo fato numa tela só é ruído.
- **A escola vem com nome completo.** `lotacaoDe()` hoje devolve
  `apelido || nome`. O apelido existe para caber no card; no cabeçalho da ficha
  e no formulário há espaço, e o nome oficial é o que se confere.
- **Código funcional, CPF e RG dividem uma linha** no desktop. São três campos
  curtos que ocupavam três linhas inteiras e empurravam o resto para fora da
  primeira tela.

O model ganha o parâmetro em vez de a view escolher a string:

```js
export function lotacaoDe(s, { completo = false } = {}) { … }
```

Regra de negócio - qual nome representa a lotação - continua no model (R3).

### D5 - Voltar na gaveta de editar servidor

**Decisão:** a gaveta de editar servidor aberta **a partir da ficha** ganha o
`←`, e ao salvar volta para a ficha em vez de fechar tudo.

O mecanismo já existe: `abrirDrawer(html, { voltar })` desenha o botão e o `Esc`
desempilha. A gaveta de vínculo já usa. A de servidor não passava o `voltar`,
então editar um servidor a partir da ficha dele fechava a pilha inteira e
devolvia a pessoa à lista - perdendo o contexto que ela mesma tinha aberto.

"Novo servidor", aberto pela toolbar, continua sem `←`: não há para onde voltar.

### D6 - Linha de telefone em uma linha

**Decisão:** o rótulo do telefone **fica** - é campo do sistema e some da tela
se sair. O que muda é a métrica da linha, para os cinco elementos caberem sem
aperto:

```
[Tipo v] [(16) 99999-9999] [rótulo] [(o)] [×]
```

- fonte dos controles da linha cai para 13px, com padding lateral menor;
- a palavra "principal" sai do toggle, ficando o trilho com `aria-label` - é o
  elemento que mais custava largura e o que menos precisava de texto, porque só
  há um por linha e o significado está na exclusividade, não na palavra;
- `align-items: center` alinha os cinco pelo meio;
- a **altura** dos controles não muda: continua `var(--campo)` (D2), como todo
  campo do hub. O espaço vem da largura, não do achatamento - encolher a altura
  da linha de telefone a deixaria fora do padrão que D2 acaba de estabelecer, e
  no celular a colocaria abaixo do alvo de toque;
- a grade de uma linha continua entrando em **560px**, um dos cortes já
  documentados. Abaixo disso empilha, como hoje - a diferença é que agora cabe
  de verdade em vez de espremer.

Na gaveta de 560px sobram ~524px de conteúdo; as cinco colunas somadas aos
espaços ficam em ~420px. A folga é o que garante que o rótulo não volte a
espremer o número quando alguém digitar um texto mais longo.

Vale para os três lugares que usam o editor: Servidores, Escolas e Meus dados.

## 4. Arquivos afetados

| Arquivo | Natureza |
|---|---|
| `styles/tokens.css` | `--form-legend`, `--form-label`, `--form-field`, `--campo` |
| `styles/components.css` | D1 (inclusive dar tipografia aos rótulos de `fieldset`, que hoje não têm), D2, D3, D6; aposenta `.subfiltros` e `.search.compacta`; `.filtros-linha` vira `.painel-filtros` |
| `shared/ui/phones.js` | métrica da linha; toggle sem a palavra "principal" |
| `modules/servidores/servidores.model.js` | `lotacaoDe(s, { completo })` |
| `modules/servidores/servidores.view.js` | painel de filtros; `abrirFormServidor` aceita opções |
| `modules/servidores/views/detalhe.js` | cabeçalho; saem cargo/lotação; documentos em linha; `voltar` ao editar |
| `modules/servidores/views/formulario.js` | `voltar`; lotação com nome completo |
| `modules/servidores/servidores.css` | `.campos-linha` (documentos lado a lado) |
| `modules/escolas/escolas.view.js` | painel de filtros |
| `modules/visitas/visitas.view.js` | painel de filtros; rótulos sobem |
| `modules/ocorrencias/ocorrencias.view.js` | painel de filtros; rótulos sobem |
| `modules/projetos/projetos.view.js` | painel de filtros; rótulos sobem |
| `modules/atas/atas.view.js` | painel de filtros; rótulos sobem |
| `modules/usuarios/views/auditoria.js` | painel de filtros; rótulos sobem |
| `modules/afastamentos/afastamentos.view.js` | `#af-filtros` vira painel |
| `.claude/rules/ui.md` | registra `.painel-filtros` e os tokens de formulário |
| `src/core/config.js`, `CHANGELOG.md` | 0.14.1 |

Os outros 17 arquivos que montam formulário **não são tocados**: D1 e D2 chegam
neles pelas classes compartilhadas. Essa é a prova de que a decisão está no
lugar certo.

## 5. Verificação

- `python .claude/scripts/verificar_arquitetura.py` sem novas violações.
- Console limpo em todas as telas visitadas.
- **Formulários** (D1, D2): a legenda lê como seção em Servidores, Escolas,
  Afastamentos, Meus dados, Usuários, SATE, Horários e Login. Numa linha com
  campo de texto, campo de data e `.campo-derivado`, os três têm a mesma altura
  e a mesma base.
- **Filtros** (D3): os 8 módulos com lista mostram o mesmo painel; os controles
  compartilham a base; o painel ocupa a largura; abaixo de 560px vira coluna.
- **Servidores** (D4, D5): cabeçalho com cargo e escola; sem apelido; sem os
  campos duplicados; documentos em uma linha no desktop; `←` presente ao editar
  a partir da ficha e ausente em "Novo servidor"; salvar volta para a ficha.
- **Telefones** (D6): cinco elementos numa linha na gaveta a partir de 560px,
  em Servidores, Escolas e Meus dados.
- Tela estreita (375px) e larga; tema claro e escuro.

## 6. Fora de escopo

- **O filtro por segmento continua fora do painel**, na própria linha acima.
  Ele é outro mecanismo - multi-escolha com memória de sessão, componente com
  estado (`shared/ui/filtro-segmento.js`) - e a distinção entre "chips rápidos"
  e "campos de recorte" é legível. Levá-lo para dentro do painel não estava no
  desenho aprovado; se o André quiser, é uma linha de CSS depois.
- Identidade de cor por módulo (R14).
- Substituir os `confirm()`/`alert()` remanescentes.
- Qualquer mudança de comportamento de filtro, validação ou persistência.
