# FundHub - Listas e modais: dois padrões que faltavam

> Decisões tomadas em 08/09/2026. **Bloco S0** da reestruturação do SATE -
> mas o que está aqui é do hub inteiro, não do SATE, e sobrevive a
> qualquer decisão sobre ele. Entrega prevista como MINOR (componente
> novo em `shared/ui/`, sem migration).
>
> Continua `2026-08-27-sistema-visual-design.md` (o traço),
> `2026-09-02-formularios-filtros-design.md` (o painel de filtros) e
> `2026-09-05-icones-e-botoes-design.md` (a affordance dos botões).
>
> É o primeiro dos seis blocos do SATE. Os outros - casca própria,
> modelo de dados v2, solicitações, logística, visão pública - dependem
> deste e ganham spec própria.

## 1. O problema

**O FundHub não tem tabela.** Nenhuma. Uma varredura em `src/modules/`
encontra `<table>` só em dois lugares, e nenhum dos dois é lista de
dados: o leitor de Markdown da Ajuda (`markdown.js`) e as tabelas de
referência da documentação (`docs.content.js`).

Toda lista do hub é hoje uma pilha de cartões - `.solic` em Usuários,
Auditoria e SATE; `.card` em Servidores e Escolas; `.dash-item` na
Dashboard. O padrão de cartão é bom e vai continuar existindo, mas ele
não dá conta de três coisas que uma lista de trabalho precisa:

1. **Comparar linhas.** Sete solicitações do mesmo dia, com escola,
   período e número de alunos: em cartões, os valores nunca ficam
   alinhados na vertical e a comparação vira leitura, uma por uma.
2. **Ordenar.** Não existe ordenação por coluna em lugar nenhum do hub.
   A ordem é a que o `order` do model devolveu, e ponto.
3. **Paginar.** Também não existe. `box.innerHTML = lista.map(item)` é
   o idioma em todas as telas. A aba **Auditoria › Mudanças** já monta
   o período inteiro de uma vez - e o `audit_log` só cresce.

Some-se a isso o problema do **diálogo**: o hub tem duas formas de
mostrar conteúdo sobreposto, e elas discordam sobre onde a coisa
aparece. `shared/ui/drawer.js` desliza pela **lateral**;
`shared/ui/confirmar.js` abre **centralizado**. A gaveta é o que quase
todo módulo usa para editar, e centralizar era um desejo antigo.

## 2. Escopo

**Entra em S0:**

- `shared/ui/tabela.js` - o componente de lista tabular.
- `shared/ui/modal.js` - o diálogo centralizado.
- `shared/ui/foco.js` - a armadilha de foco, ligada nas superfícies modais
  do hub. Eram três em S0 (modal, gaveta e confirmação) e passaram a duas
  quando S0b deletou a gaveta. Ver D8 e § 10.
- As famílias `.tabela` e `.modal` em `styles/components.css`.
- A regra escrita em `.claude/rules/ui.md` (R18 nova; R16 ampliada).
- **Duas telas convertidas**, para provar o contrato: Usuários & Acessos
  e Auditoria › Mudanças.

**Não entra:**

| Fora | Onde vai |
|---|---|
| ~~Converter as gavetas do hub para modal~~ | **Feito no bloco S0b**, 08/09/2026 - ver § 10 |
| Paginação no banco (`range()` do PostgREST) | Só se uma lista concreta exigir (R13) |
| Escolher, esconder ou reordenar colunas pelo usuário | Nenhum caso concreto hoje |
| Exportar direto da tabela | Nenhum caso concreto hoje |
| Seleção múltipla e ação em lote | Nenhum caso concreto hoje |

## 3. Decisões

### D1 - Lista tabular é um componente JS, não uma convenção

`shared/ui/tabela.js` monta a marcação e liga ordenação, paginação,
busca e expansão. A view **declara**; não desenha.

A R12 (`ui.md`) autoriza sem exceção: *"componente JS em `shared/ui/` só
quando há comportamento - estado, eventos, foco ou ciclo de vida"*.
Ordenar, paginar, buscar e expandir são quatro estados e quatro
famílias de evento. Uma tabela tem mais comportamento que o `drawer.js`.

A alternativa considerada - só vocabulário CSS mais funções puras de
ordenar/paginar, com cada view montando o próprio `<table>` - foi
descartada por um motivo prático: o objetivo declarado é que **toda**
tabela do hub siga o padrão. Com CSS mais convenção isso é uma
intenção que a sétima tela contraria. Com componente, é fato.

**A regra de três (R13) não é violada:** o gatilho não é "vai que
precisa depois". São três consumidores concretos identificados **antes**
de escrever uma linha - Usuários, Auditoria › Mudanças e as solicitações
do SATE - e dois deles são convertidos dentro deste bloco.

### D2 - `valor` ordena e busca; `celula` desenha

Cada coluna pode declarar duas funções, e elas não são a mesma coisa:

```js
{ id: 'status', rotulo: 'Situação',
  valor:  l => STATUS[l.status],                 // texto puro: ordena e busca
  celula: l => `<span class="chip st-${esc(l.status)}">…</span>` }  // HTML: exibe
```

- **`valor(linha)`** devolve `string` ou `number`. É o que o comparador
  de ordenação recebe e o que a busca varre. Default: `linha[id]`.
- **`celula(linha)`** devolve HTML. Default: `esc(valor(linha))`.

Sem essa separação, ordenar a coluna "Situação" ordenaria pelo HTML do
chip - alfabeticamente por `<span class=...`, igual em todas as linhas.

**Responsabilidade do escape (R5):** quando a coluna tem só `valor`, o
componente aplica `esc()`. Quando tem `celula`, a view é dona do HTML e
é dela o `esc()` - exatamente como já é hoje em toda view do hub. O
caminho seguro é o default; o caminho perigoso exige escolha
deliberada, que é como tem que ser.

### D3 - Ordenação por tipo declarado

`tipo` decide o comparador. Não há adivinhação pelo conteúdo.

| `tipo` | Comparador | Por quê |
|---|---|---|
| `texto` (default) | `localeCompare(pt-BR)` | acento e caixa ordenam como português |
| `numero` | subtração numérica | `'10' < '9'` como texto |
| `data` | comparação **de string**, `<` e `>` | data civil é `yyyy-mm-dd`, ordenável lexicograficamente (R8). Nenhum `Date` é construído |
| `datahora` | comparação de string do ISO | mesma razão; timestamp ISO também é ordenável como texto |

A ordenação é **estável**: linhas empatadas mantêm a ordem anterior, o
que faz ordenar por duas colunas em sequência produzir o resultado
esperado.

Clicar no `<th>` alterna ascendente → descendente. A coluna ativa
carrega `aria-sort` e uma seta. Coluna com `ordenavel: false` não
responde ao clique nem recebe o cursor de ponteiro.

### D4 - Prioridade de coluna e expansão vertical

Cada coluna declara `prioridade`:

| Prioridade | Some abaixo de |
|---|---|
| 1 (default) | nunca |
| 2 | 900px |
| 3 | 720px |

**Nunca há rolagem horizontal no celular.** O mecanismo é esconder
coluna, não deslocar a tabela. O que sumiu reaparece quando a linha é
expandida: uma `<tr class="tabela-detalhe">` com um `<td colspan>`
inserida logo abaixo, com as colunas escondidas em pares rótulo → valor
e as ações ao pé.

O botão de expandir (`▸`, primeira célula) **só existe onde há algo
escondido naquela largura** - coluna de prioridade 2 ou 3, ou a coluna
de ações (D5). O componente carimba na `<table>` a maior prioridade que
declarou (`data-prio-max`) e se há ações (`data-acoes`); o CSS usa os
dois para esconder o botão nas larguras em que nada foi escondido. No
desktop, com tudo à vista, ele some sozinho e a linha não abre.

A rolagem lateral continua existindo como rede de segurança no desktop
(`.tabela-rolagem { overflow-x: auto }`), para uma tabela
excepcionalmente larga. No celular ela nunca dispara, porque a largura
sempre cabe.

**Quem responde ao toque na linha:**

| A tela declara | Tocar a linha faz | Expandir fica |
|---|---|---|
| nada | expande | na linha inteira e no `▸` |
| `aoClicarLinha` | abre o detalhe (modal ou rota) | só no `▸` |

### D5 - Ações são a última coluna, à direita, e ícone

Sempre a última coluna, alinhada à direita. **Abaixo de 720px a coluna
de ações some da linha e as ações reaparecem no pé do detalhe
expandido** - dois botões de toque na mesma linha de uma tela de 360px
espremeriam a coluna de identidade, que é a que faz a lista servir para
alguma coisa.

Consequência para o botão de expandir (D4): ele aparece a partir da
largura em que **qualquer coisa** se esconde - coluna de prioridade 2 ou
3, ou a coluna de ações. Uma tabela sem coluna escondida mas **com**
ações passa a ter expansão abaixo de 720px, e é assim que as ações
continuam alcançáveis.

Cada ação é um `.mini-btn` com `ico()` e **`aria-label` obrigatório** -
o padrão fixado em `2026-09-05-icones-e-botoes-design.md`. `perigo:
true` acrescenta `.no` (lixeira vermelha em repouso).

`quando(linha)` decide se a ação aparece para aquela linha. É conforto
de tela, não segurança: quem barra continua sendo o RLS (R6).

### D6 - Busca e contagem pertencem à tabela; o painel de filtros, à view

São dois mecanismos diferentes e podem coexistir na mesma tela:

| | `.painel-filtros` (da view) | busca da tabela (do componente) |
|---|---|---|
| Estreita | **o que é buscado no banco** | **o que já está na tela** |
| Exemplo | período, módulo, escola | digitar parte do nome de uma escola |
| Recarrega o model | sim | não |

Por isso a busca fica dentro do componente, numa barra fina
`.tabela-topo` acima do `<thead>`: busca à esquerda, contagem à direita.
A contagem mostra **o que está sendo listado**, e o total só quando a
busca está estreitando: `312 solicitações` em repouso, `28 de 312` com
busca ativa - senão o número na tela contradiz a lista embaixo dele. Se
a busca ficasse na `.toolbar` da view, cada
tela precisaria religar o mesmo par de eventos - exatamente a
repetição que o componente existe para evitar.

**Isto amplia, não contradiz, a regra atual.** `ui.md` diz que `.search`
fica na `.toolbar`, fora do painel de filtros. Aquela regra foi escrita
para lista de cartões e continua valendo lá. Uma tela de tabela tem uma
busca só: a da tabela.

A busca normaliza acento e caixa dos dois lados
(`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()`), para
"varzea" encontrar "Várzea".

### D7 - Paginação no navegador

O model traz tudo, como já faz hoje; a tabela pagina, ordena e busca em
memória. Rodapé `.tabela-pe` com "1-25 de 312" e anterior/próxima, que
**some inteiro quando há uma página só**.

Justificativa: os volumes do hub são pequenos e conhecidos - 144
escolas, 186 servidores, alguns milhares de solicitações por ano. Em
memória, ordenar e buscar são instantâneos, nenhum model precisa de
assinatura nova, e o modo dev-local (sem banco) continua funcionando
sem tratamento especial.

**Não haverá abstração "com porta aberta para o banco".** Uma fonte
paginável sem nenhum uso hoje é a abstração especulativa que a R13
proíbe. Quando uma lista concreta crescer a ponto de doer, o
componente ganha a fonte paginável naquele momento, com um caso real
guiando o formato.

### D8 - `modal.js` espelha a API de `drawer.js`

```js
modalHtml() · montarModal() · abrirModal(html, { titulo, tamanho }) · fecharModal() · garantirModal()
```

Os nomes são deliberadamente paralelos aos da gaveta para que **S0b**
seja substituição de identificador, não reescrita de tela.

**Herdado do `drawer.js`, porque já está resolvido lá:** fecha com
`Esc`; devolve o foco a quem abriu; fecha no clique do fundo; e
**empilha** guardando a *função* que reabre a de baixo, nunca o HTML
dela - restaurar HTML deixaria os ouvintes para trás e a de baixo
voltaria com dado velho.

**Próprio do modal:**

- Centralizado nos dois eixos (`position: fixed; inset: 0;
  display: grid; place-items: center`).
- Três larguras: `estreito` 420px · `medio` (default) 560px · `largo` 760px.
- `max-height: min(88dvh, 100% - 2rem)`, com a rolagem **no corpo** -
  cabeçalho e rodapé de formulário ficam parados.
- **Abaixo de 560px ocupa a tela inteira**, sem raio e sem margem. É o
  que a gaveta já faz hoje no celular, e pela mesma razão: um cartão
  centralizado de 420px numa tela de 360px é um cartão de 360px com
  margem inútil.

`confirmar.js` **não é reescrito sobre o modal**. Ele é um
`alertdialog` com outro trabalho (uma pergunta, dois botões, sem
formulário) e reescrevê-lo seria unificar duas coisas que só se parecem.
O que muda é que ele passa a ler os mesmos tokens de fundo e de cartão,
para haver uma linguagem visual única.

**Armadilha de foco: nas três superfícies, não só no modal.**

A primeira versão desta spec deixava a armadilha de fora, com o
argumento de que a gaveta não tinha e acrescentar só no modal criaria
dois níveis de acessibilidade no mesmo hub. O argumento estava certo; a
conclusão, não. A saída correta não era rebaixar o modal - era elevar as
três, que é o que fica decidido aqui (decisão do André, 08/09/2026).

O problema é concreto: `drawer` e `confirmar-card` já declaram
`aria-modal="true"`, ou seja, **já afirmam** que o resto da página não
existe enquanto estão abertos. Sem armadilha, o Tab atravessa e vai
passear pelo menu lateral que o leitor de tela acabou de anunciar como
inexistente. A afirmação e o comportamento discordavam - não era uma
funcionalidade faltando, era uma promessa quebrada.

`shared/ui/foco.js` expõe `prenderFoco(raiz)` → `soltar()`. Nasce em
arquivo próprio, e não copiado três vezes, porque **são três**
consumidores concretos (R13), e um laço de Tab duplicado é um bug
duplicado. Detalhes que a implementação não pode perder:

- A lista de focáveis é recalculada **a cada Tab**, nunca capturada na
  abertura: o conteúdo é substituído por `innerHTML` (gaveta sobre
  gaveta, formulário repintado) e uma lista capturada apontaria para nós
  já descartados.
- O filtro de "alcançável" usa `getClientRects().length`, não
  `offsetParent`: este último também é `null` em elemento
  `position: fixed`, que é exatamente o caso da gaveta e do modal.
- O ouvinte é registrado em **captura**, para o laço valer mesmo que o
  conteúdo trate `Tab` por conta própria.
- Uma armadilha por **pilha**, não por superfície: o elemento é sempre o
  mesmo nó, e prender de novo deixaria dois laços concorrendo.

`confirmar.js` ganha de quebra o retorno de foco a quem abriu, que ele
não fazia.

### D9 - O CSS mora em `components.css`; nenhum token novo

As famílias `.tabela` e `.modal` entram em `styles/components.css` -
são vocabulário compartilhado, e o hub tem três arquivos de estilo por
desenho (`tokens` · `base` · `components`). Abrir um quarto por causa
de duas famílias seria a pasta que nasce antes do terceiro caso (R13).

**Nenhuma cor nova.** A tabela usa `--surface` (fundo), `--surface-2`
(cabeçalho e zebra), `--border`, `--muted` (rótulo no detalhe expandido)
e `--brand` (coluna ordenada). O modal usa `--surface`, `--shadow`,
`--radius` e o mesmo fundo escurecido de `confirmar.js`. O tema escuro
sai de graça, como manda a R9.

Alturas: a caixa de busca usa `--campo`; os botões de ação e de
paginação usam `.mini-btn` (`--controle`), elevado a `--toque` em
`(pointer: coarse)`.

### D10 - Quando é tabela e quando é cartão

A regra escrita, que vai para `ui.md`:

| Use **tabela** quando | Use **cartão** quando |
|---|---|
| as linhas se comparam entre si | cada item se lê sozinho |
| há 4+ atributos do mesmo tipo em todas as linhas | os atributos variam de item para item |
| a lista passa de ~20 itens com frequência | a lista é curta e navegável de olho |
| ordenar por um atributo é uma pergunta real | a ordem é sempre a mesma |

Escolas e Servidores continuam em cartão: são fichas de identidade, com
foto mental própria, e o que se faz ali é reconhecer, não comparar.
Usuários, Auditoria e as solicitações do SATE viram tabela.

## 4. O contrato

```js
import { montarTabela } from '../../shared/ui/tabela.js';

const t = montarTabela(elemento, {
  colunas: [
    // id       - identifica a coluna; default de `valor` é linha[id]
    // rotulo   - o texto do <th>
    // prioridade - 1 sempre · 2 some <900px · 3 some <720px
    // ordenavel  - default true
    // tipo     - 'texto' | 'numero' | 'data' | 'datahora'
    // alinhar  - 'esq' (default) | 'dir'
    // valor    - (linha) => string|number   ordena e busca
    // celula   - (linha) => html            exibe (a view escapa)
    { id: 'escola', rotulo: 'Escola', valor: l => l.unidade?.nome || '' },
    { id: 'data',   rotulo: 'Data',   tipo: 'data', celula: l => esc(fmtData(l.data)) },
    { id: 'alunos', rotulo: 'Alunos', tipo: 'numero', alinhar: 'dir', prioridade: 3 },
  ],

  linhas: [],
  chave: l => l.id,              // id estável; preserva a linha aberta em atualizar()

  acoes: [
    { ico: 'editar',  rotulo: 'Editar',  quando: l => podeEditar(l), ao: (l) => abrir(l) },
    { ico: 'excluir', rotulo: 'Excluir', perigo: true,               ao: (l) => remover(l) },
  ],

  buscarEm: ['escola'],          // ids de coluna, ou (linha) => texto
  porPagina: 25,                 // 0 desliga a paginação
  ordem: { coluna: 'data', dir: 'desc' },
  aoClicarLinha: null,           // (linha) => …  ver D4
  vazio: { ico: 'transporte', titulo: '…', texto: '…' },
});

t.atualizar(novasLinhas);   // repinta o <tbody>; preserva página, ordem, busca e linha aberta
t.destruir();               // remove ouvintes; chamar ao trocar de rota
```

A superfície pública é **essa e só essa**: `montarTabela`, `atualizar`,
`destruir`. Um `estado()` que devolvesse página e ordem para a view
guardar chegou a ser considerado e foi descartado - nenhuma das duas
telas convertidas precisa dele, e é exatamente a abstração de um uso
só que a R13 proíbe. Quando uma tela precisar reabrir na mesma página,
o método nasce ali.

**`atualizar()` repinta só o `<tbody>`.** O `<thead>`, a barra de busca e
o rodapé permanecem os mesmos nós do DOM - o foco dentro da caixa de
busca sobrevive à atualização. Isso não é detalhe: o SATE tem realtime
(`subscribeSolicitacoes`), e uma tabela que rouba o foco a cada evento
do banco é inutilizável. Se a página corrente ficou fora do alcance
depois da atualização, o componente cai na última página existente.

## 5. Marcação gerada

```html
<div class="tabela-caixa">
  <div class="tabela-topo">
    <div class="search compacta">…lupa + input…</div>
    <span class="count">312 solicitações</span>
  </div>

  <div class="tabela-rolagem">
    <table class="tabela" data-prio-max="3">
      <thead>
        <tr>
          <th class="col-exp"></th>
          <th scope="col" class="ord on" aria-sort="descending" data-col="data">Data</th>
          <th scope="col" class="p2" data-col="periodo">Período</th>
          <th scope="col" class="acoes" aria-label="Ações"></th>
        </tr>
      </thead>
      <tbody>
        <tr data-k="…">
          <td class="col-exp"><button class="exp" aria-expanded="false" aria-label="Mais">…</button></td>
          <td>12/09/2026</td>
          <td class="p2">Manhã</td>
          <td class="acoes"><button class="mini-btn" aria-label="Editar">…</button></td>
        </tr>
        <tr class="tabela-detalhe" hidden>
          <td colspan="4">
            <div class="det-par"><span class="lbl">Alunos</span><span>44</span></div>
            <div class="det-acoes">…</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="tabela-pe">
    <span>1-25 de 312</span>
    <button class="mini-btn" aria-label="Página anterior">…</button>
    <button class="mini-btn" aria-label="Próxima página">…</button>
  </div>
</div>
```

`.p2` e `.p3` são as classes de prioridade. Reusos deliberados do
vocabulário existente: `.search.compacta`, `.count`, `.mini-btn`,
`.lbl`. Nada disso nasce aqui.

O cabeçalho da coluna de ações fica **vazio, com `aria-label`** - o hub
não tem utilitário de texto só para leitor de tela (`.sr-only` e
similares não existem em `components.css`), e criar um por causa de uma
célula seria a classe que nasce no primeiro caso (R13).

## 6. Acessibilidade

O mínimo que `ui.md` já cobra, aplicado:

- `<table>` de verdade, com `<th scope="col">` - não `<div>` com `role`.
- `aria-sort="ascending|descending"` no `<th>` ordenado; ausente nos demais.
- O `<th>` ordenável é um `<button>` interno, alcançável por teclado.
- Botão de expandir com `aria-expanded` e `aria-label`.
- Toda ação de ícone com `aria-label` (D5).
- A linha de detalhe usa `hidden`, não `display: none` inline.
- O modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
  apontando para o título, `Esc` fecha, foco volta a quem abriu.

## 7. Onde provar

Duas telas, dentro deste bloco. Duas porque **um formato só não prova
contrato nenhum** - o componente precisa caber em duas formas diferentes
antes de ser oferecido ao hub.

| Tela | Forma | O que prova |
|---|---|---|
| **Usuários & Acessos** (`usuarios.view.js`, 309 linhas) | lista curta, ações por linha, colunas óbvias: e-mail, servidor, papel, segmentos, último acesso | o caminho das ações, da expansão e do `celula` (o papel é um `.tag`) |
| **Auditoria › Mudanças** (`views/mudancas.js`, 136 linhas) | lista longa, `.painel-filtros` acima, sem ações por linha, `aoClicarLinha` abre o detalhe | a convivência filtro-do-banco + busca-da-tabela (D6) e a paginação de uma lista que já cresce sozinha |

As duas são **só de admin**. Se algo sair torto, ninguém na rede é
afetado - e é por isso que são estas, e não Escolas ou Servidores.

## 8. Verificação

```bash
python .claude/scripts/verificar_arquitetura.py
```

A checagem 12 (classe no markup sem regra de CSS) cobre as famílias
novas automaticamente. Além dela:

- dev-local em **360px** e em desktop, nas duas telas convertidas;
- console limpo;
- ordenar, buscar, paginar e expandir em cada largura;
- tema escuro nas duas telas;
- `git diff --cached` procurando dado real (R7);
- ao fechar: `CONFIG.versao` e `CHANGELOG.md`, escrito para quem usa.

## 9. O que isto destrava

Os blocos seguintes do SATE, já acordados e cada um com spec própria:

| | Bloco | Depende de |
|---|---|---|
| ~~S0b~~ | ~~Converter as gavetas do hub para modal~~ | **entregue em 08/09/2026** (§ 10) |
| **S1** | SATE como aplicação própria (`sate.html`, casca, cor verde, ícone de ônibus) | - |
| **S2** | Modelo de dados v2: frota com vigência, ciclo de vida da solicitação, múltiplos embarques, vans adaptadas | - |
| **S3** | Solicitações: modal de nova solicitação, tabela, aprovação, regras de agendamento | S0, S2 |
| **S4** | Logística: geo e tempo de viagem, cronograma, fichas de ônibus | S2 |
| **S5** | Visão pública sem login | adiada por decisão de 08/09/2026 |

Decisões já tomadas que estes blocos herdam, registradas aqui para não
se perderem entre uma spec e outra:

- **Topologia:** `sate.html` no mesmo repositório, casca própria,
  reusando o kernel; o item SATE no menu do FundHub vira link externo.
- **Aprovação:** aprovar é ter `escrita` no módulo `sate`. Todo
  `admin_sme` aprova - não haverá isenção do curinga nem papel novo. O
  papel `transporte` (migration 021) já cobre quem aprova sem ser admin
  geral.
- **Empresa de transporte:** sem acesso ao sistema; recebe as fichas
  impressas ou em PDF, como no `agendamentos-fil` hoje. A primeira
  barreira (domínio institucional) não é afrouxada.
- **Frota:** existe **no máximo uma frota em aberto** (sem data-fim) -
  ela é a vigente, e cadastrar outra em aberto encerra a anterior. Toda
  outra frota tem data-fim obrigatória e **soma** à vigente, seja
  cadastrada à mão (evento) ou nascida de uma aprovação que estourou o
  limite (início = fim = o dia do agendamento). Os dias imprevisíveis do
  Cirem nascem sozinhos desse mecanismo, um a um. Frota órfã de um
  agendamento negado ou cancelado **permanece**, com aviso na tela para
  o aprovador confirmar ou remover.
- **Rótulo de frota:** tabela própria com combobox que retroalimenta.
  Serve para explicar a composição do dia e registrar por que o ônibus
  extra existiu. Rótulo sem frota vinculada pode ser excluído; rótulo em
  uso só pode ser arquivado.
- **Tipo de veículo:** campo `tipo` (`onibus` | `van_adaptada`) na
  própria frota, para que um lote de evento possa trazer só vans e a
  conta de cadeirante consuma saldo próprio.
- **Ciclo de vida da solicitação** (vai para a ajuda do módulo):
  aprovar e negar só com `escrita` em `sate`; antes de aprovada, a
  escola cancela sozinha; depois de aprovada, a escola **pede**
  cancelamento e a solicitação fica *pendente de cancelamento* até a
  confirmação de quem tem escrita; **justificativa é obrigatória** em
  toda negativa e todo cancelamento.
- **Regras de agendamento** (vão para a ajuda do módulo, em destaque):
  (a) um ônibus usado de manhã só serve à tarde se houver **intervalo
  mínimo configurável** (padrão 2h) entre o retorno previsto à escola da
  manhã e o embarque da tarde; (b) um agendamento noturno exige ônibus
  livre em um dos períodos do próprio dia **e** no período da manhã do
  dia seguinte.

## 10. Adendo - o bloco S0b, entregue em 08/09/2026

S0b não ganhou spec própria porque **não tomou nenhuma decisão nova**: ele
executou o D8. Fica registrado aqui o que de fato aconteceu, com o que
divergiu do previsto.

**Alcance:** 23 arquivos de view convertidos, 24 chamadas de `abrirModal`.
`shared/ui/drawer.js` foi **deletado no mesmo commit** - não mantido "por
compatibilidade". Uma gaveta esquecida no repositório vira a forma que a
próxima pessoa copia sem saber que foi aposentada.

**A conversão foi de fato mecânica**, como o D8 previu: renomear os cinco
símbolos e as duas classes de markup (`drawer-body`, `drawer-acoes`). Nenhuma
view precisou ser reescrita - o que valida a decisão de espelhar a API em vez
de projetar uma "melhor".

**Nenhum CSS de módulo dependia de `.drawer*`.** As 17 ocorrências estavam
todas em `components.css`, o que só foi possível porque a R12 já proibia
módulo redefinir componente global.

### O que divergiu do previsto

**A largura deixou de ser função da tela.** A gaveta tinha 560px e engordava
para 680px num `@media (min-width: 1280px)`, escrito para dois formulários
específicos (escola e servidor) mas aplicado a todos. Isso virou o parâmetro
`tamanho` na chamada: `largo` (760px) em escola, servidor e jornada da semana;
`medio` (560px) no resto. Quem abre decide, não a largura da janela.

**O `foco.js` passou de três consumidores para dois.** Com a gaveta deletada,
sobraram `modal.js` e `confirmar.js`. O arquivo continua, e o cabeçalho dele
registra o número novo sem maquiagem: a R13 proíbe a **abstração especulativa**
- generalizar dois casos que só se parecem por coincidência -, e não é o caso.
Modal e confirmação fazem a mesma coisa; o que está ali são trinta linhas de
tratamento de `Tab` cheias de detalhe, e duas cópias seriam dois bugs. Se
sobrar um consumidor só, o arquivo some.

**O vocabulário mudou em toda a documentação.** "Gaveta" descrevia algo que
deslizava da lateral e deixou de existir: virou "modal" no código e nas regras,
e **"janela"** nos tutoriais de uso - `docs/modulos/` é escrito para quem usa o
sistema, e ali "modal" é jargão.
