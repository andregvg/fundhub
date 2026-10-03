# SATE e formulários - rodada de ajustes (filtros, busca, grupos, modal)

Data: 02/10/2026 · Versões-alvo: FundHub **0.38.1** · SATE **0.17.1** (nenhuma migration)

## Problema

Uma revisão de uso do SATE levantou ajustes de dois tipos:

- **Pontuais do SATE** - ordem dos filtros da Frota, texto da lista de solicitações,
  controle de data e fins de semana na Disponibilidade, barra da página Fichas, ícone
  de ônibus antigo, campos do modal "Nova solicitação".
- **Padrão do hub** - o que o modal "Nova solicitação" expôs mas vale para todo
  formulário: fundo do modal, foco dos campos, caixa de busca, grupos (`fieldset`),
  cabeçalho, rótulos e perda de dados ao fechar.

Os do segundo tipo viram regra única em `components.css` e `shared/ui/`, e o SATE é o
primeiro a usá-la. Nenhum muda dado, permissão ou banco.

## Decisões de design

### D1 - Grupos de formulário em modal viram cartões com a legenda na borda

**Escopo: `.form-grupo` dentro de `.modal`.** É o que foi pedido ("todas as modais com
formulários que usam grupos"), e é onde a moldura ajuda: num modal, o corpo é uma coluna
longa sobre fundo liso. Numa página, o formulário já mora dentro de um `.panel` (Meus
dados, Configurações do SATE) - grupo emoldurado dentro de painel emoldurado seria a
poluição que o pedido 5e quer evitar. Nas páginas o grupo segue como está (seção com
traço).

Dentro de modal, `.form-grupo` passa a ter:

- borda de 1px **em volta**, cantos arredondados (12px), com a **legenda sobre a linha
  da borda** (o recorte nativo do `<fieldset>`);
- fundo em **um tom suave único** (`--grupo-bg`, ~4% da cor de destaque sobre a
  superfície) e borda um pouco mais forte (`--grupo-borda`). Uma cor só para todos os
  grupos (decidido; R14). O tema escuro e a cor configurável do SATE vêm de graça, porque
  são `color-mix` sobre `--brand`;
- **os campos dentro do grupo ficam em `--surface`**, mais claros que o grupo (hoje são
  `--surface-2`). É isso que separa o campo do fundo do grupo; sem a troca, campo e grupo
  teriam quase o mesmo tom e se misturariam;
- legenda em `--form-legend`, 11.5px · 700 · caixa alta · `.06em`, sem o traço de baixo
  (a borda já divide);
- **espaçamento único entre grupos: 16px**. O `border-top` + `padding-top` de
  `.form-grupo + .form-grupo` sai dentro do modal.

**Regra inteligente para não poluir (pedido 5e).** A moldura existe para agrupar
**campos**. Grupo que já traz cartões, lista ou tabela fica **plano**. Duas camadas:

1. *Automática:* `:has()` reconhece o vocabulário de cartão do hub - `.card`, `.person`,
   `.people`, `.solic`, `.dash-item`, `.tabela`, `.panel`, `.tiles` - e desliga a moldura
   desse grupo. Um módulo futuro que ponha esses componentes num grupo já nasce certo.
2. *Explícita:* `.form-grupo.plano` para o que o detector não alcança. Entram hoje: o dia
   da Jornada (`hj-dia`: um fieldset por dia, com a lista de blocos dentro, sete molduras
   empilhadas) e "Permissões por módulo" de Usuários (um `<details>` com lista própria).

Grupo só de chips/`.tag` **não** é plano: chip é marcador, não cartão.

Sem suporte a `:has()` a regra de moldura inteira é descartada pelo navegador e o grupo
fica como na página - degradação inofensiva.

**O espaço estranho entre QUANDO e RESPONSÁVEL (pedido 2e) é defeito.** O
`<p class="form-hint col-2" id="f-periodo">` que mostra o período calculado fica **vazio**
até a pessoa informar os horários. Mesmo vazio, continua ocupando uma linha da grade
`.campos.duas`: são 13px de `gap` mais a margem padrão do `<p>`. Correção na raiz, para o
hub todo: `.form-hint:empty { display: none }`. Será medida no navegador (antes e depois),
não só deduzida.

### D2 - Rótulos de campo em caixa normal

`.lbl`, os rótulos de `.form-grid`/`.esc-form`/`.form-grupo .campos label` **e os de
`.filtro-campo`** perdem `text-transform: uppercase` e `letter-spacing`. O filtro entra
junto porque, sem ele, uma tela teria o rótulo do filtro em caixa alta e o do formulário
logo abaixo em caixa normal. Em caixa normal, 11.5px lê pequeno; os rótulos sobem para
**12.5px · 600**. A cor continua no token `--form-label`.

A **legenda** do grupo continua em caixa alta: é o que a distingue do rótulo e mantém a
hierarquia legenda → rótulo → campo.

### D3 - O campo em foco tem uma borda só

A borda dupla vem de duas regras empilhadas: o `outline: 2px` (com `outline-offset: 2px`,
herdado do `:focus-visible` global, que afasta o anel da borda) **mais** o `border-color`
da cor de destaque. Fica só a borda interna:

- campos com borda própria (`.form-grid`/`.esc-form`, `.filtro-campo`, `.auth-form`,
  `.campo-solto`): `outline: none; border-color: var(--brand)`;
- caixa de busca (`.search`): hoje não tem **nenhum** indicador de foco (o input tem
  `outline: 0` e a caixa não reage). Ganha `.search:focus-within { border-color: var(--brand) }`;
- botões, links e chips continuam com o anel global: não têm borda de campo, e o anel é
  o que o teclado precisa ver.

Uma regra para os campos e uma para a busca, em `components.css`. As quatro cópias de
`outline: 2px solid color-mix(...)` saem.

### D4 - Fundo do modal mais escuro e desfocado

`.modal-back` e `.confirmar-back` passam a usar o token `--overlay` (claro e escuro) e
`backdrop-filter: blur(3px)`:

| | antes | depois |
|---|---|---|
| claro | `rgba(10,15,30,.50)` | `.62` + blur 3px |
| escuro | `.50` (o mesmo) | `.72` + blur 3px |

O desfoque é o que **tira a legibilidade** sem escurecer demais: o conteúdo de trás vira
mancha de cor, e a tela não vira um bloco preto. Fica sob `@supports (backdrop-filter:
blur(1px))`; sem suporte, só o escurecimento.

**Confirmação por cima de modal:** fundo mais leve (`--overlay-leve`, ~.35, sem blur).
Os dois fundos se somariam: a pergunta "Descartar o que você preencheu?" (D6) apareceria
sobre um modal quase preto, e ver o formulário atrás é justamente o contexto da decisão.
Regra: `body:has(.modal-back.open) .confirmar-back`.

### D5 - Cabeçalho do modal em destaque

`.modal-head` ganha fundo `--cabecalho-bg` (`color-mix(in srgb, var(--brand) 9%,
var(--surface))`), borda inferior em tom da marca e os cantos de cima arredondados como o
cartão (a partir de 560px; abaixo, o modal ocupa a tela e não tem canto). O título fica no
texto normal: o tom suave segue a cor configurável do SATE, funciona no tema escuro e não
pesa em formulário longo (decidido). Os botões `×` e `←`, hoje em `--surface-2`, ficam
transparentes com fundo só no hover; um quadrado cinza sobre o cabeçalho colorido sairia
remendado.

**Ficha da escola:** o cabeçalho mostra só o **nome**, com o tratamento `.nome-oficial`
(caixa alta) do cartão da escola e do modal de servidor. O nome oficial/SAE **não some**:
vai para o grupo "Cadastros e links" da ficha como "Nome no SAE", **só quando difere do
nome**. Quando é igual, era exatamente a repetição que incomodava.

**Nova solicitação:** `modalHead('Nova solicitação')`, sem subtítulo.

### D6 - Fechar um modal com dado digitado pede confirmação

Em `shared/ui/modal.js`. A pergunta existe só quando **a pessoa** dispensa o modal, nunca
quando o código fecha (todo `fecharModal()` depois de salvar continua direto):

- as quatro portas de dispensa - clique no fundo, `Esc`, `×` e `←` - passam por
  `tentarFechar()`. O `fecharModal()` exportado continua incondicional;
- **o que é "dado digitado":** um campo do `<form>` do corpo que a pessoa **tocou**
  (`keydown` ou `pointerdown` nele) e cujo valor **hoje difere** do que tinha no primeiro
  toque. A linha de base é tirada no toque, e não ao abrir, por dois motivos:
  - *preencher e apagar não conta:* digitar e apagar volta ao valor de base, e o modal
    fecha sem perguntar;
  - *preenchimento assíncrono não engana:* um formulário que recebe valores depois de
    aberto (uma busca carregada depois, um endereço preenchido ao escolher o local) não
    vira "sujo" sozinho, porque os campos que o código mudou não foram tocados.

  `checked` para caixa e rádio, `value` para os demais. Um único ouvinte delegado em
  `#modal` (o elemento é o mesmo entre aberturas), e `abrirModal` zera as linhas de base;
- **quem nunca pergunta:** modais sem `<form>` (fichas, detalhes) e o painel de
  Configurações, que grava na hora e é `<div class="esc-form">`, não `<form>`.
  `abrirModal(html, { protegerSaida })` força (`true`) ou desliga (`false`) onde a
  detecção não serve; o padrão é "tem `<form>`";
- a pergunta usa `confirmar()` (R16): **"Descartar o que você preencheu?"**, com o detalhe
  "Se fechar agora, as informações digitadas serão perdidas." e os botões **Continuar
  editando** (recebe o foco; o `Esc` da confirmação também cai nele) e **Descartar**
  (`perigo`). Fechar sem querer é o erro caro; a opção que não perde nada é a que fica
  sob o dedo;
- vale na pilha: o `←` de um modal empilhado também pergunta, e descartar volta ao de
  baixo.

Fora do escopo: trocar de rota (menu, botão Voltar do navegador) com modal sujo aberto.

### D7 - A caixa de busca: quadrado de lupa à esquerda, igual em todo o hub

`.search` passa a ser **um controle único**: borda e raio uma vez só. Dentro, à esquerda,
um **quadrado de fundo próprio** (`--surface-3`, separado do texto por um fio) com o SVG
da lupa **centralizado nos dois eixos**; à direita, o campo de texto sem borda, ocupando o
resto.

- O controle tem **altura fixa** (`height`, não `min-height`), e o quadrado é o próprio
  `<svg>` com lado = altura − 2px de borda e `padding` = (lado − 16px) / 2. O centro é
  geométrico: não depende de `line-height` nem de alinhamento de linha. O markup atual
  (`${ico('buscar')}<input>`) **não muda**, e os 9 usos ganham o desenho novo só pelo CSS.
- **Altura:** `--toque` na barra de ferramentas da página (como hoje); **`--campo` dentro
  de formulário** (`.esc-form`/`.form-grid`/`.form-grupo`), com o mesmo fundo e raio dos
  campos vizinhos e sem sombra. Hoje a busca dentro do formulário sai com 40px contra 36px
  e com sombra, e é daí que vem a sensação de "diferente do resto".
- **Foco:** `:focus-within`, conforme a D3.
- O botão limpar (`×`) do `busca-selecao` fica **dentro** do controle, à direita.

**A lista de resultados casa com o campo (pedido 2c).** Hoje `.bs-lista` ancora em `.bs`,
cuja largura vem de `flex: 1 1 260px`, regra que só faz sentido na toolbar. A lista passa
a ancorar num invólucro que contém **só o controle e a lista** (`.bs-ancora`, `position:
relative`) e usa `left: 0; right: 0`. Assim tem **exatamente a largura e o `left` do
controle** em qualquer contexto, com `top: calc(100% + 4px)` e o mesmo raio. O `flex: 1 1
260px` fica restrito à toolbar (`.toolbar .bs`). Dentro de modal, a lista é trazida à vista
ao abrir (`scrollIntoView({ block: 'nearest' })`), porque o corpo do modal rola e corta o
que passa da base.

**A lista abre com clique, digitação ou seta para baixo - não com o foco.** Hoje ela abre
no `focus`, e um modal que começa por uma busca (o campo Escola de quem aprova, D13)
nasceria com 144 escolas despejadas sobre o formulário, porque o modal põe o foco no
primeiro campo. Abrir por gesto é o comportamento de combobox do ARIA APG, e quem chega
pelo Tab abre com `↓` ou começando a digitar.

**Sem div extra no formulário.** `criarBuscaSelecao` ganha a opção `rotulo`: o widget
desenha o rótulo (`.lbl`, com `for` ligado ao input, id gerado). O campo Local passa a ser
**um elemento** no formulário - `<div id="f-local" class="col-2">` - em vez de
`.dest-lista` + `.lbl` + contêiner. Os outros usos do widget não mudam nesta rodada.

**Tolerância a erro de digitação, para toda busca com seleção.** `filtrarOpcoes` ganha
uma segunda passada: se a busca exata não acha **nada**, mostra até 5 opções
**aproximadas**, sob o subtítulo "Parecidos". Aproximada = cada palavra do termo está a 1
letra de distância de uma palavra da opção (2 letras se a palavra tiver 7 ou mais;
palavras com menos de 4 letras exigem igualdade). A distância de edição é uma função pura
em `shared/dom.js`, ao lado de `norm()`. Os nove usos ganham isso de graça - "Alsina" acha
a escola, "Muzeu" acha o museu - e a busca exata continua tendo precedência, então nada
muda para quem digita certo. Por isso é comportamento padrão do componente e não um gancho
de um uso só (R13).

### D8 - Controle solto (data, período, ano): sem ícone duplicado e com largura certa

`<label class="search compacta"> ${ico('calendario')}<input type="date"> </label>` é uma
caixa de busca vestida de campo de data: mostra o ícone **e** o `type="date"` já traz o
dele. Além de repetir o ícone, herda a largura flexível da busca. Na página **Fichas de
ônibus** o defeito é duplo: data e período são duas `.search.compacta` de larguras
diferentes, e o `<select>` dentro do `<label>` com borda tem **duas molduras**.

Nasce `.campo-solto`: **um controle nativo sozinho** (data, `<select>`, número), sem
`<label>` de caixa em volta (o nome acessível vai em `aria-label`, como hoje), com a
aparência de campo de formulário: `--campo` de altura, `--surface`, borda e raio de campo,
foco da D3. Largura:

- data e `<select>`: **a mesma largura fixa**, 11rem, a partir de 560px. É o que alinha
  "data + período" em Fichas e iguala o campo de data entre as telas. Abaixo de 560px,
  os soltos da mesma barra **dividem a linha** (`flex: 1 1 9rem`), em vez de quebrar um
  por linha;
- número (o "ano" de Escalas): largura do conteúdo (6rem).

Aposenta `.search.compacta` nos 6 usos: **Disponibilidade, Fichas (data e período),
Programação de Viagens, Hoje (dashboard) e Escalas (ano)**. Isso cumpre a regra de três, e
`.search.compacta` sai do vocabulário (`ui.md`).

**Botões na mesma barra.** Pela regra estrutural da R17, estendida de "linha de campo" a
`.toolbar:has(.campo-solto)`, botões (`.mini-btn`, `.btn-primary`, `.btn-secundario`) na
mesma barra de um `.campo-solto` sobem para `--campo`: o "Imprimir" de Fichas e Viagens e
as setas ‹ › e o "Hoje" da Disponibilidade. Botão de 32px ao lado de campo de 36px é o
defeito que a R17 existe para impedir.

### D9 - Disponibilidade: segunda a sexta, com o dia em foco destacado

**Só dias úteis.** A página mostra 5 dias. A regra mora em dois pontos marcados "por
enquanto, sem fim de semana": `DIAS_UTEIS` na página e `semanaUtil(iso)` em
`disponibilidade.model.js`, que diz qual semana mostrar e qual dia fica em foco. Função
pura, testada.

- a consulta ao banco e o título da semana vão de segunda a **sexta**;
- a grade passa a `repeat(5, 1fr)` a partir de 1280px (1 / 2 / 3 colunas abaixo; 3
  colunas dá 3+2, sem cartão órfão no meio);
- uma data de sábado ou domingo leva à **semana seguinte**, onde está o próximo dia útil.
  Mostrar a semana que acabou seria o contrário do que a pessoa quer planejar.

**O dia em foco.** A semana inteira continua à vista, mas um dia fica **destacado**:

- é a **data escolhida** no campo de data; sem escolha, **hoje**. Se a data cair num fim
  de semana, o destaque vai para a **segunda-feira seguinte** (o dia útil que a regra
  acima levou à tela);
- o campo de data passa a **mostrar** essa data (hoje ele abre vazio e não diz o que está
  em foco). "Hoje" volta o foco e o campo para hoje;
- as setas ‹ › trocam a semana sem mudar o dia em foco. Ele só aparece destacado na
  semana a que pertence;
- **visual:** borda em `--brand` mais um anel interno de 1px (dois pixels de cor, sem
  `outline` - a mesma linguagem da D3) e fundo `color-mix(in srgb, var(--brand) 8%,
  var(--surface))`. Como o SATE define `--brand` pela cor escolhida (`body[data-cor]`), o
  destaque **segue a cor do SATE** sem nada a mais. Um dia passado em foco perde o
  esmaecimento de `.passado`: se a pessoa pediu para vê-lo, ele tem que ser legível;
- acessibilidade: `aria-current="date"` no cartão em foco.

### D10 - Frota: filtro padrão "Todas", antes de "Vigentes"

`CHIPS` reordenado para `Todas · Vigentes · Futuras · Encerradas`, e `filtro.situacao`
começa em `'todas'`. O modelo já tem a situação `todas`. O filtro da sessão continua
sobrevivendo à troca de página.

### D11 - Solicitações: sem a frase de apoio, botão onde está

- `desc` passa a ser **opcional** em `PAGINAS`, e o `<p>` só é desenhado quando existe. A
  de Solicitações sai; as demais páginas mantêm a delas;
- o botão "Nova solicitação" **fica à esquerda**, como em Frota, Locais e Catálogo. O que
  importa é o SATE ter um padrão só, e esse padrão já existe (revisão do André,
  02/10/2026).

### D12 - Ícone de ônibus: um só, o do SATE

O hub tem dois desenhos para o mesmo veículo: `transporte` (o caminhão do Feather, o
desenho antigo) e `onibus` (a silhueta própria, a do SATE). Fichas, Catálogo, Viagens, o
painel Hoje e as fichas e cartões de Escolas ("Transporte de alunos") ainda usam o
caminhão; em todos eles o objeto é um **ônibus**. Os 9 usos de `ico('transporte')` passam
a `ico('onibus')`, e `transporte` sai de `icones.js`. Com o desenho fora, ninguém volta a
usá-lo por engano (mesma lógica da gaveta deletada em 08/09/2026). O nome `onibus`
descreve a coisa, como manda o cabeçalho de `icones.js`.

### D13 - Modal "Nova solicitação"

**Origem - Escola.** Para **quem aprova**, `criarBuscaSelecao` com `rotulo: nome` (o nome
completo, como o cartão da escola), detalhe com o segmento e `busca: apelido`, para que
"Alcina" ainda ache a escola. São 144, e o hub já abandonou a rolagem para isso (Ver como
escola, Horários). Para a **escola** (uma ou poucas unidades), continua um `<select>`, já
escolhido quando é uma só, também com o nome completo. As três leituras de
`#f-esc.value` em `formulario.js` passam por uma função `escolaId()`, que sabe qual dos
dois está na tela.

**Destino - locais que não estão na lista (pedidos 2c e 2d).** Sai o botão "Local não
está na lista" e, com ele, o modo alternado. O campo **Local** é a única entrada:

1. A pessoa digita. A lista mostra os locais que casam, ignorando acento e ordem das
   palavras (como hoje) e, se nada casa, os **"Parecidos"** da D7 ("Muzeu Exemplo" →
   "Museu Exemplo").
2. **Último item da lista, sempre que há texto (3+ letras) e nenhum local tem aquele nome
   exato: "Usar “texto digitado” como novo local".** Um clique ou `Enter`. São zero
   cliques a mais que antes, e na prática um a menos (o botão sumiu).
   - Lista **vazia**: este item é o destacado, e o `Enter` o escolhe.
   - Lista **com itens** (exatos ou parecidos): este item vem **por último, em tom
     apagado** ("Nenhum destes? Cadastrar “X”"), e o destaque do teclado fica no primeiro
     local. Criar um duplicado exige uma escolha deliberada; o caminho de menor esforço é
     o local que já existe.

   Gancho genérico no widget: `criar: { rotulo(termo), aoCriar(termo) }`. É uma opção nova
   num componente existente, não uma camada (R13): o combobox acessível (teclado, foco,
   `aria-*`) já está escrito e não se duplica.
3. Escolhido, o campo mostra o texto com a etiqueta **"Novo local"**, e o limpar (`×`)
   volta à busca. Endereço, número e bairro **destravam** onde sempre estiveram e passam a
   ser obrigatórios. O texto vira `destino_nome`, e `local_id` fica nulo: é o mesmo
   caminho de hoje, e a Gerência continua conferindo ("Local a conferir").
4. **Mesmo lugar com outro nome.** Ao preencher endereço e número de um local novo, se o
   par (rua normalizada + número) já é o de um local cadastrado, aparece **uma linha
   discreta** sob os campos: "Este endereço já é de **Museu Exemplo**. [Usar este]". Um
   clique troca para o local cadastrado. Não bloqueia: dois nomes num endereço às vezes
   são dois lugares (um prédio, duas atrações). A comparação é regra de domínio e fica em
   `locais.model.js` (`localNoEndereco(rua, numero, locais)`).

São três camadas contra duplicata, nenhuma com diálogo nem clique extra no caminho comum:

- **(a)** a lista tolerante a erro mostra o que já existe onde o olhar já está;
- **(b)** o duplicado fica atrás de uma escolha deliberada;
- **(c)** o endereço denuncia o duplicado de outro nome.

O backstop continua sendo o "Conferir local" da Gerência. `locaisParecidos`, que ele usa,
passa a usar a mesma distância de edição e acha mais.

**Demais.** Os grupos seguem a D1, os rótulos a D2, e o `<form>` liga o aviso de dado
perdido (D6). Nada muda em período calculado, trajeto, saldo, validação, envio ou nas
mensagens de erro do banco.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/styles/tokens.css` | `--overlay`, `--overlay-leve` em `:root`; `--grupo-bg`, `--grupo-borda`, `--cabecalho-bg`, `--cabecalho-borda` declarados em **`body`** (claro e escuro). Derivam de `--brand`, e o SATE troca o `--brand` no `<body>`: declarados em `:root`, seriam calculados com o azul do hub e ignorariam a cor do SATE (é o motivo de `sate.css` redeclarar `--info-bg`) |
| `src/styles/components.css` | `.modal .form-grupo` e `.plano` (D1); `.form-hint:empty`; rótulos (D2); foco (D3); fundos (D4); `.modal-head`, `.modal-close`, `.modal-voltar` (D5); `.search`, `.bs-ancora`, `.bs-lista`, "Parecidos", item de criar (D7, D13); `.campo-solto` e a extensão da R17 (D8); sai `.search.compacta` |
| `src/shared/dom.js` | `distancia(a, b)` e "parece com" por palavra, ao lado de `norm()` |
| `src/shared/ui/modal.js` | `tentarFechar()`, linha de base no toque, `protegerSaida` (D6) |
| `src/shared/ui/busca-selecao.js` | `rotulo`, `.bs-ancora`, aproximados, `criar`, lista à vista |
| `src/shared/ui/icones.js` | sai `transporte` (D12) |
| `src/modules/locais/locais.model.js` | `locaisParecidos` com distância de edição; `localNoEndereco` |
| `src/modules/sate/views/formulario.js`, `formulario-destino.js` | D13 |
| `src/modules/sate/views/frota.js`, `disponibilidade.js`, `fichas.js`, `catalogo.js`, `sate.view.js`, `sate.css` | D8–D12 |
| `src/modules/escolas/views/detalhe.js`, `escolas.view.js` | cabeçalho e "Nome no SAE" (D5); ícone (D12) |
| `src/modules/viagens/viagens.view.js`, `dashboard/views/hoje.js`, `dashboard/views/paineis.js`, `calendario/views/escalas.js` | `.campo-solto` (D8); ícone (D12) |
| `src/modules/horarios/views/jornada.js`, `usuarios/usuarios.view.js` | `.plano` (D1) |
| `.claude/rules/ui.md` | vocabulário (`.campo-solto`, `.plano`; sai `.search.compacta`); grupo em modal, foco, busca, aviso ao fechar |
| `docs/modulos/sate.md`, `escolas.md` | pedido com local novo e aviso ao fechar, Frota, Disponibilidade, ficha da escola |
| `src/core/config.js`, `CHANGELOG.md` | 0.38.1 / SATE 0.17.1 (PATCH: tela, sem mudança de modelo) |

Nenhum arquivo novo de código: o que é novo cabe nos existentes (R13). Tamanhos dentro dos
tetos: `formulario.js` ~375 linhas, `formulario-destino.js` ~170, `modal.js` ~200,
`busca-selecao.js` ~200.

## Riscos

- **Regressão visual no hub inteiro** (D2, D3, D7, D8 mexem em regras globais). Conferir,
  antes de fechar, as telas que usam cada regra: Escolas, Servidores, Usuários, Horários
  (jornada), Calendário, Afastamentos, Atas, Visitas, Projetos, Ocorrências, Configurações,
  Meus dados, Dashboard, Viagens e as seis do SATE. Claro e escuro; 375, 768 e 1280px.
- **Aviso de descarte onde não cabe.** A detecção é por `<form>` + campo tocado e
  alterado, não por "modal aberto". Os formulários que gravam e fecham pelo código não
  perguntam.
- **Aproximados demais numa lista grande** (servidores). Só aparecem quando a busca exata
  não acha nada, com teto de 5. Quem digita certo não vê diferença.
- **`backdrop-filter`** tem custo em aparelho fraco: fica sob `@supports` e só existe
  enquanto o modal está aberto.

## Fora do escopo

- Uma cor por grupo ou por módulo (R14, decidido).
- Moldura de grupo em formulário de **página** (D1).
- Fim de semana na Disponibilidade além de esconder (volta trocando `DIAS_UTEIS`).
- Trocar os outros `<select>` longos do hub por busca (só o da escola no pedido).
- Aviso de dado perdido ao trocar de rota com modal aberto.
- Qualquer mudança em RLS, migration ou dado.

## Verificação

1. `python .claude/scripts/verificar_arquitetura.py` sem bloqueio novo. Checagem 12:
   classes novas têm regra; checagem 11: `sate.md` e `escolas.md` atualizados.
2. Navegador, dev-local (`fundhub-teste-devlocal`), em 375/768/1280px, claro e escuro:
   - **Nova solicitação:**
     - grupos com legenda na borda e espaço **igual** entre todos (medir QUANDO→RESPONSÁVEL
       contra os demais);
     - campos mais claros que o grupo; rótulos em caixa normal;
     - lista de locais com a **mesma largura e `left`** do campo (medir por
       `getBoundingClientRect`);
     - "Muzeu" achando "Museu"; "Novo local" liberando os campos; aviso de endereço
       repetido; Enviar ainda funciona;
     - escola por busca para quem aprova.
   - **Aviso ao fechar:** com campo alterado, pergunta pelo `×`, `Esc`, fundo e `←`.
     Digitar e apagar, ou não mexer em nada, não pergunta. Salvar não pergunta. A
     confirmação sobre o modal com fundo leve.
   - **Foco** de campo com **uma** borda; busca com indicador de foco; quadrado da lupa
     centrado (medir o centro do `<svg>` contra o centro do controle).
   - **Disponibilidade:** 5 dias; dia em foco destacado na cor do SATE (trocar a cor nas
     Configurações e conferir); abrir num sábado; campo de data sem ícone duplicado e
     mostrando a data.
   - **Fichas:** data e período da mesma largura, uma moldura só, "Imprimir" na altura dos
     campos, ônibus novo no estado vazio.
   - **Frota** abre em "Todas"; **Solicitações** sem a frase, botão à esquerda.
   - Ficha da escola só com o nome; Jornada e permissões de Usuários **sem** moldura.
   - Console sem erro.
3. `git diff --cached` procurando dado real antes de commitar (R7).
