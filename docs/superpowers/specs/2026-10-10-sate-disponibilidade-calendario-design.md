# Disponibilidade do SATE - calendário escolar e o dia em detalhe

Data: 10/10/2026 · Versões-alvo: FundHub **0.42.0** · SATE **0.20.0** · Sem migration

Segundo de quatro ciclos da rodada de 09/10/2026. Vem depois de
`2026-10-10-sate-endereco-e-cep-design.md` e antes de
`2026-10-10-sate-solicitacao-reformulada-design.md`, que usa o modal desta spec.

## Problema

1. **A Disponibilidade não conhece o calendário escolar.** A escola planeja uma viagem
   para um dia com oito ônibus livres, preenche o pedido inteiro e só no envio descobre
   que a data é feriado, recesso ou está bloqueada para extraclasse.
2. **Quem aprova não tem como ver o dia.** A ficha do pedido diz "N ônibus livres no
   horário deste pedido, fora ele" - um número só, sem dizer quem ocupa o resto, a que
   horas os ônibus voltam, nem quanto a frota do dia tem. O card da Disponibilidade abre
   uma linha de composição, e é só.

## A contagem não muda

Em 09/10/2026 um pedido pendente de dois ônibus pareceu não consumir a disponibilidade.
Conferido: `ocupacao_transporte()` (migration 044) inclui `solicitado` na lista de
situações que ocupam veículo, e o espelho no navegador faz a mesma conta. **Decisão do
André (10/10/2026): se já contabiliza, segue sem alterações.** Esta spec não toca na
conta nem no caminho de leitura.

O que provavelmente causou a impressão é a frase da ficha do pedido, "N ônibus livres no
horário deste pedido, **fora ele**": ela desconta o próprio pedido de propósito, e com 10
ônibus no dia a ficha de um pedido de 2 mostra "10 livres". Essa frase sai (D4).

## Decisões de design

### D1 - A Disponibilidade mostra o calendário escolar

A semana passa a ler `dia_calendario` junto com a ocupação. `calendario.model.js` ganha
`getDiasCalendario(de, ate)` - a leitura por intervalo que faltava ao lado da leitura
por mês e por dia.

Cada card de dia mostra o que o calendário diz dele, em **três situações**:

| Situação no calendário | No card | Para a escola | Para quem aprova |
|---|---|---|---|
| **Não letivo** (feriado, recesso) | faixa "Não letivo" + nome do evento; card em tom neutro | sem números: "Não há viagens neste dia" | números visíveis, esmaecidos |
| **Extraclasse bloqueado** | faixa "Extraclasse bloqueado" + nome do evento; card em tom de alerta | idem | idem |
| **Letivo com evento** (prova, evento pedagógico, cultural) | linha com ícone de calendário, nome do evento e o tipo | números normais | números normais |

- **Dia sem registro não mostra nada.** O silêncio é o dia letivo comum, e é a maioria;
  um "dia letivo" em todo card seria ruído.
- A escola **não vê números** num dia em que não pode pedir. Mostrar "8 livres" num
  feriado convida a um pedido que será recusado.
- Quem aprova **vê os números** nesses dias: ele pode agendar por cima do bloqueio (a
  regra já é essa no formulário), e precisa do número para decidir.
- O nome do evento é cortado com reticências no card e vem inteiro no `title` e no
  modal do dia.
- **Mesma linguagem do módulo Calendário:** tom neutro (`--surface-2`) para não letivo,
  tom de alerta (`--danger` diluído) para bloqueado. Quem conhece uma tela lê a outra.
- Sem a tabela do calendário, ou se a leitura falhar, a semana aparece como hoje, sem
  eventos. O calendário **informa**; não pode derrubar a Disponibilidade.

### D2 - O formulário avisa da data na hora

Hoje o calendário só é consultado no envio. Passa a ser consultado **quando a data é
escolhida**, e o resultado aparece sob o campo, junto da data por extenso:

- não letivo ou bloqueado, **escola**: erro no campo ("Data bloqueada para extraclasse
  (Nome do evento)."), antes de preencher o resto;
- não letivo ou bloqueado, **quem aprova**: aviso, sem bloquear - "erro barra, aviso
  não" (R15);
- letivo com evento: informação ("Neste dia: Nome do evento.").

A conferência no envio continua (a data pode ter sido bloqueada com o formulário
aberto), e o banco não muda.

### D3 - Modal "Disponibilidade do dia" (quem aprova)

Substitui a linha de composição que hoje abre embaixo do card - **um caminho só**.
Abre por dois lugares: clicando no dia, na Disponibilidade, e pelo botão "Ver
disponibilidade do dia" da ficha do pedido (spec da solicitação reformulada, D7), que
volta para a ficha pelo `←`.

De cima para baixo:

1. **Título:** "Disponibilidade do dia" · "terça-feira, 14/10/2026".
2. **Calendário:** a faixa ou a linha do evento (D1), com o nome inteiro.
3. **Frota do dia:** total de ônibus e de vans, e a composição por rótulo.
4. **Por período:** manhã, tarde e noite - em uso e livres. A tarde com a escada
   ("2 livres · 5 a partir das 14:10"), como no card. Estouro aparece como estouro.
5. **Viagens do dia:** uma linha por pedido que ocupa veículo, em ordem de embarque -
   do embarque até a hora em que o veículo fica livre de novo, escolas, destino,
   veículos e a situação. É o que explica os números do item 4.
   - Pedido "pendente de cancelamento" aparece no fim, marcado como "não ocupa".
   - Ônibus da **noite anterior** aparecem numa linha própria ("2 ônibus da noite
     anterior, livres às 12:00"): eles ocupam a manhã e não são viagem deste dia.
   - Aberto a partir de uma ficha, a linha **daquele pedido** vem destacada.

A lista é só de leitura nesta entrega. A escola não tem este modal: ela continua vendo
só números, nunca de quem é a reserva (a promessa da migration 036).

No código: `views/dia.js` (novo, cerca de 130 linhas), que lê `lerOcupacao`,
`getSolicitacoesDoDia`, `getParticipacoesDe`, `getFrotas` e `getDiasCalendario`.
`views/disponibilidade.js` perde `abrirDia` e `usoPorPeriodo`.
`disponibilidade.model.js` ganha `ocupacaoDoPedido(s, paradas, intervaloMin)`, pura: o
intervalo que **um** pedido ocupa - hoje montado em três lugares com os mesmos quatro
argumentos (`detalhe.js`, `faltaParaConfirmar`, `remanejar.js`).

### D4 - A linha "fora ele" sai da ficha

A frase que induz ao erro é retirada. Quem aprova passa a ter o botão do
D3, que mostra o pedido **dentro** da lista do dia; a escola não vê número de frota na
ficha. A troca é feita na spec da solicitação reformulada, junto com o redesenho da
ficha - aqui fica registrado que o modal do D3 é o que a substitui.

## Fora de escopo

- **Fim de semana na Disponibilidade** (sábado letivo inclusive). A tela mostra segunda
  a sexta desde a spec 2026-10-02, D9; a volta do sábado é decisão à parte.
- **Abrir a ficha de um pedido a partir da lista do dia.** Dá para fazer, mas cria um
  vaivém ficha → dia → ficha que precisa ser desenhado com calma.
- **Visão de mês.** O calendário escolar tem a dele; aqui a unidade é a semana.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/modules/calendario/calendario.model.js` | `getDiasCalendario(de, ate)` |
| `src/modules/sate/disponibilidade.model.js` | entra `ocupacaoDoPedido` |
| `src/modules/sate/regras.model.js` | `situacaoDoDia(dia)`, pura: `nao_letivo` · `bloqueado` · `evento` · `null` |
| `src/modules/sate/views/disponibilidade.js` | calendário nos cards; clique abre o modal |
| `src/modules/sate/views/dia.js` | novo |
| `src/modules/sate/views/formulario-quando.js`, `formulario.js` | D2 |
| `src/modules/sate/sate.css` | faixas do card e a lista do dia |
| `tests/sate-disponibilidade.test.mjs`, `tests/sate-regras.test.mjs` | ver abaixo |
| `docs/modulos/sate.md`, `CHANGELOG.md`, `src/core/config.js` | tutorial e versões |

## Verificação

- **Testes:** `situacaoDoDia` (as quatro saídas; bloqueado vence não letivo quando os
  dois estão marcados); `ocupacaoDoPedido` contra os casos que `faltaParaConfirmar` já
  cobre.
- **Navegador, dev-local, largo e estreito:** semana com um feriado, um dia bloqueado e
  um dia com evento, vista como escola e como quem aprova; modal do dia com duas
  viagens, uma noturna da véspera e um pedido pendente de cancelamento; formulário
  acusando a data bloqueada logo ao escolher.
- `python .claude/scripts/verificar_arquitetura.py` sem bloqueio.
