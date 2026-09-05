# FundHub - Dashboard: painéis reordenáveis e ocultáveis

> Decisões tomadas em 05/09/2026. Bloco E da rodada de melhorias.
> **Depende do Bloco A** (`2026-09-05-configuracoes-por-modulo-design.md`):
> a ordem e os painéis ocultos são preferências de usuário, gravadas pelo
> mecanismo de lá.

## 1. O problema

A Dashboard mostra seis coisas na mesma ordem para todo mundo: os números do
dia, o cartão "hoje", extraclasse, afastamentos, calendário e ocorrências. Quem
cuida de transporte quer extraclasse no topo; quem cuida de pessoal quer
afastamentos; quem não trabalha com ocorrências olha para um painel vazio todo
dia.

Hoje isso não é configurável porque os painéis **não são unidades**: são cinco
blocos de HTML escritos direto no `innerHTML` de `dashboard.view.js`, cada um
com o seu `<section class="panel">` e a sua função de carga. Não há como
reordenar o que não tem nome.

## 2. Decisões

### D1 - Painel vira unidade declarada

`dashboard.view.js` passa a ter uma lista, e o resto do arquivo passa a ser um
laço sobre ela:

```js
const PAINEIS = [
  { id: 'numeros',      titulo: 'Números do dia',    ico: 'dashboard',   pintar: painelStats },
  { id: 'hoje',         titulo: 'Hoje',              ico: 'calendario',  pintar: painelHoje },
  { id: 'extraclasse',  titulo: 'Extraclasse hoje',  ico: 'transporte',  pintar: painelExtraclasse, perm: 'sate' },
  { id: 'afastamentos', titulo: 'Afastamentos hoje', ico: 'afastamento', pintar: painelAfastamentos, perm: 'afastamentos' },
  { id: 'calendario',   titulo: 'Calendário hoje',   ico: 'calendario',  pintar: painelCalendario,  perm: 'calendario' },
  { id: 'ocorrencias',  titulo: 'Ocorrências de hoje', ico: 'ocorrencia', pintar: painelOcorrencias, perm: 'ocorrencias' },
];
```

O `id` é o que a preferência guarda e **nunca muda** - renomear o título é
livre, renomear o id perde a ordem de todo mundo.

A faixa de números (`.stat-row`) vira o painel `numeros`: é a primeira coisa
que alguém vai querer mover ou esconder, e deixá-la de fora criaria a exceção
que a tela toda teria de explicar.

### D2 - Painel de módulo oculto não aparece

Achado ao ler o código: a Dashboard pinta os seis painéis para todo mundo. Quem
não tem acesso a Ocorrências recebe hoje um painel vazio - não porque não haja
ocorrências, mas porque o RLS não devolve nenhuma. A tela mente por omissão.

Com `perm` declarado, o painel só entra se `nivel(perm) !== OCULTO`. Os painéis
`numeros` e `hoje` não declaram `perm`: compõem dados de vários módulos e
degradam sozinhos quando uma parte não vem.

Isso corrige um defeito existente, não é escopo novo - e é pré-requisito do
resto: reordenar uma lista que contém painéis que não deveriam estar lá seria
consolidar o erro.

### D3 - A ordem e o que está oculto são preferência de usuário

Duas chaves, escopo `usuario` (Bloco A, D1):

| Chave | Valor | Padrão |
|---|---|---|
| `dashboard.ordem_paineis` | `['extraclasse','numeros',…]` | ordem de `PAINEIS` |
| `dashboard.paineis_ocultos` | `['ocorrencias']` | `[]` |

A ordem gravada é **filtrada e completada** na leitura: id desconhecido (painel
que deixou de existir) é descartado, e painel novo que ainda não está na lista
entra **no fim**. Sem isso, acrescentar um painel no futuro o tornaria invisível
para todo mundo que já tivesse ordenado a tela - o modo de falha clássico desse
tipo de preferência.

### D4 - Arrastar na página, mover pelas configurações

Duas formas de reordenar, pelo mesmo motivo que a legenda da grade de Horários
tem duas:

**Na página**, o cabeçalho do painel é a alça: `draggable` no `<h2>`, com
arrasto nativo HTML5. Reaproveita o padrão já provado em
`horarios/views/por-escola.js` - `dragstart`/`dragover`/`drop` delegados no
container estável, `insertBefore` ao vivo e gravação no `drop`.

**Nas configurações**, cada painel é uma linha com um switch (exibir/ocultar) e
duas setas (subir/descer). Este é o caminho **obrigatório** em telas de toque:
arrasto nativo não existe lá - o comentário de `moverServidor()` em
`por-escola.js` registra isso, e a mesma limitação vale aqui.

Ocultar um painel na página é um `×` no cabeçalho dele, ao lado da alça.
Reexibir é só pelas configurações - é o que o pedido descreve, e é o
comportamento certo: o botão de trazer de volta não pode morar no lugar que
acabou de sumir.

### D5 - Falha de um painel não derruba a tela

Comportamento que já existe e precisa continuar existindo depois do refactor:
cada painel carrega e falha por conta própria, com o seu próprio `emptyState` de
erro. Uma consulta que falha some com um painel, não com a Dashboard.

### D6 - Tamanho do arquivo

`dashboard.view.js` tem 180 linhas e vai crescer com o arrasto e a leitura de
preferências. O limite da R11 é 400 para view. Se passar, a divisão é por
superfície: `views/paineis.js` (as funções de pintura) e a casca com a
declaração e a ordenação - **não** por tipo técnico.

## 3. Arquivos

| Arquivo | Ação |
|---|---|
| `src/modules/dashboard/dashboard.view.js` | declaração `PAINEIS`, laço, filtro por permissão, arrasto, ocultar |
| `src/modules/dashboard/dashboard.config.js` | criar - declaração das duas chaves + painel de ordenação |
| `src/modules/dashboard/module.js` | campo `config` |
| `src/modules/dashboard/dashboard.css` | alça de arrasto, `×`, estado "arrastando" |
| `docs/modulos/dashboard.md` | criar - tutorial, no mesmo commit (regra do Bloco B) |

Nenhuma migration própria (as tabelas vêm da 026, do Bloco A).

## 4. Riscos

| Risco | Mitigação |
|---|---|
| Ordem gravada apontar para painel que não existe mais | filtro na leitura (D3) |
| Painel novo nascer invisível | completa no fim na leitura (D3) |
| Arrasto não funcionar em toque | setas nas configurações são o caminho oficial (D4) |
| Refactor quebrar o isolamento de falha dos painéis | D5 é critério de aceite explícito |
| Ocultar tudo e a tela ficar vazia sem explicação | estado vazio com link para as configurações |

## 5. Critérios de aceite

1. Arrastar um painel pelo cabeçalho reordena, grava e sobrevive a recarregar a
   página e a trocar de navegador.
2. As setas nas configurações fazem o mesmo, e funcionam em tela de toque.
3. O `×` no cabeçalho oculta; o switch nas configurações traz de volta.
4. Quem não enxerga Ocorrências não recebe o painel de Ocorrências - nem
   visível, nem na lista de configuração.
5. Um painel cuja consulta falha mostra o próprio erro; os outros continuam.
6. Com todos os painéis ocultos, a tela explica como trazê-los de volta.
7. Um painel acrescentado depois aparece no fim para quem já tinha ordem
   gravada.
8. Legível em 375px, nos dois temas.
9. `docs/modulos/dashboard.md` escrito no mesmo commit e listado em `#/ajuda`.
10. `python .claude/scripts/verificar_arquitetura.py` sem violações.
