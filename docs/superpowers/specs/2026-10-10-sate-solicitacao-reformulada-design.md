# Solicitação do SATE reformulada - lista, ficha, decisão e formulário

Data: 10/10/2026 · Versões-alvo: FundHub **0.43.0** · SATE **0.21.0** · Sem migration

Terceiro de quatro ciclos da rodada de 09/10/2026. Depende de
`2026-10-10-sate-disponibilidade-calendario-design.md` (o modal "Disponibilidade do
dia"). As notificações ficam para a spec seguinte.

## Problema

Revisão de uso do André em 09/10/2026, com dois prints do agendamentos-fil como
referência de organização:

1. A **lista** mostra o apelido da escola; deveria mostrar o nome completo.
2. O **modal de aprovação** tem por título o destino. Um título deveria dizer o que o
   modal faz - e isso vale como jeito de **nomear** os modais em geral.
3. Na ficha, rótulo e valor ocupam uma linha cada. Poderiam ficar lado a lado.
4. **Acrescentar parada** aparece só na aprovação. É informação da hora de cadastrar.
5. Quem aprova **não consegue desfazer** uma negativa nem uma aprovação. E editar o
   pedido só faz sentido enquanto ele não está confirmado.
6. A escola vê, na ficha, quantos ônibus estão livres - não precisa. Para quem aprova,
   o número sozinho é pouco.
7. Justificativa e "decidido por" aparecem soltos no fim da ficha, mal apresentados.
8. O **formulário** pode aproveitar a organização do agendamentos-fil.

## Decisões de design

### D1 - Como um modal se chama

A regra, que passa a valer no hub (vai para `.claude/rules/ui.md`):

> **O título de um modal diz o que ele é ou faz; o subtítulo diz de qual registro.**
> O nome do modal, numa conversa, é o título que está na tela.

- **Modal de ação ou formulário** - título = a ação: "Nova solicitação", "Negar
  solicitação", "Conferir local". Quase todo o hub já é assim.
- **Ficha de um registro que tem nome próprio** (escola, servidor, projeto) - o título
  é o nome do registro, e o ícone diz o tipo. Chama-se "ficha da escola", "ficha do
  servidor". **Nada muda nessas telas.**
- **Ficha de um registro sem nome próprio** - título = o que o registro é. É o caso da
  solicitação: hoje ela toma emprestado o nome do destino, e é isso que confunde.

Os modais do SATE, com o nome que passam a ter:

| Nome (título) | Subtítulo | Arquivo |
|---|---|---|
| **Detalhes da solicitação** | escola(s) · data | `views/detalhe.js` |
| **Nova solicitação** | - | `views/formulario.js` |
| **Editar solicitação** (era "Remanejar") | escola(s) · data | `views/editar.js` |
| **Negar solicitação** · **Cancelar solicitação** · **Pedir cancelamento** | escola(s) · data | `views/decisoes.js` |
| **Acrescentar parada** | escola(s) · data | `views/participantes.js` |
| **Faltam veículos** | o dia | `views/frota-extra.js` |
| **Disponibilidade do dia** | o dia | `views/dia.js` |
| **Conferir local** | o destino digitado | `views/conferir-local.js` |
| **Novo local** · **Editar local** | o local | `views/locais.js` |
| **Nova frota** · **Editar frota** · **Rótulos** | - | `views/frota-form.js` |

Fora do SATE, nenhum título muda nesta entrega. A regra fica escrita para os próximos.

### D2 - A lista mostra o nome completo da escola

- Coluna **Escolas**: nome completo; com várias, "Nome da primeira +2".
- **Abaixo de 720px**: o apelido, em maiúsculas. É o corte em que a tabela já esconde
  colunas.
- A troca é de CSS, com os dois textos na célula; nada é recalculado ao redimensionar.
- A busca da tabela acha pelos dois (nome e apelido); a ordenação é pelo nome completo.

### D3 - A ficha "Detalhes da solicitação"

Organizada como o detalhe do agendamentos-fil, com o vocabulário de ficha do hub
(`.ficha-info`, `.ficha-secao`) - sem classes novas onde já existe uma.

```
Detalhes da solicitação                                    ×
Escola Exemplo · 14/10/2026

┌─ quadro-resumo (faixa lateral na cor da situação) ────── ✎ ┐
│ Theatro Exemplo                                            │
│ 14/10/2026 · [Manhã]                                       │
│ 07:30 – 11:30                                              │
│ Rua Exemplo, 123 - Centro · ver no mapa                    │
└────────────────────────────────────────────────────────────┘
[ Negada: "justificativa escrita por quem decidiu" ]   ← só quando há

SOLICITAÇÃO
Escola        Escola Municipal Exemplo
Situação      [Em análise]
Turma(s)      5º A, 5º B
Responsável   Nome do servidor
Telefone      (00) 00000-0000
Estudantes    56 · 1 cadeirante · 2 surdos
Observação    …

LOGÍSTICA                          [Ver disponibilidade do dia]
Embarque      07:30
Saída         11:30
Veículos      2 ônibus · 1 van adaptada
Trajeto       12 km · 41 min · ver rota · Recalcular
Paradas       1  Escola Exemplo · 28 estudantes · 07:30
              2  Escola Modelo  · 28 estudantes · 07:45
              [+ Acrescentar parada]

┌─ histórico ────────────────────────────────────────────────┐
│ Solicitado por   nome@exemplo.com em 02/10/2026 09:52      │
│ Negado por       nome@exemplo.com em 03/10/2026 14:10      │
└────────────────────────────────────────────────────────────┘
                              [Negar] [Confirmar]
```

- **Quadro-resumo.** O que identifica a viagem de relance: destino, data, período,
  horários e endereço. A faixa lateral usa a cor que a situação já tem na etiqueta.
- **Justificativa em destaque**, logo abaixo do quadro, quando o pedido está negado,
  cancelado ou com cancelamento pedido. É a informação mais importante nesses casos e
  estava no fim da tela.
- **Histórico** num quadro discreto ao pé: quem pediu e quando, quem decidiu e quando.
  Os dados já existem (`criado_por`, `criado_em`, `decidido_por`, `decidido_em`); não
  há tabela nova. Datas por `fmtDataHora` (R8).
- **Rótulo e valor lado a lado** em Solicitação e Logística. A classe já existe: é a
  `.det-par` que a tabela usa quando expande uma linha no celular. Ela passa a ser o
  par rótulo → valor do hub. Valor longo quebra dentro da própria coluna.
- **Só o que tem valor aparece.** Sem cadeirantes, não há "0 cadeirantes".
- **Telefone é link** e vem antes de qualquer e-mail (padrão de ficha do hub).
- **"Local a conferir"** continua como etiqueta ao lado do endereço, com o botão
  "Conferir local" para quem aprova.

**Uma pergunta em aberto (P1, no fim):** as fichas de registro dos outros módulos (ata,
ocorrência, visita, projeto) usam rótulo em cima e valor embaixo. Converter junto?

### D4 - "Editar solicitação" substitui "Remanejar", e só antes de confirmar

- O botão "Remanejar" do rodapé vira o **lápis no canto do quadro-resumo**
  (`.ficha-editar`), como em toda ficha do hub.
- Aparece para quem aprova quando a situação é **Solicitado**, **Em análise** ou
  **Aguardando adaptado**. Confirmado, negado e cancelado não têm lápis: para editar um
  pedido confirmado, primeiro se reabre (D5).
- O formulário ganha os campos da solicitação original que hoje não se editam:
  **turma(s)**, **responsável**, **telefone** e **observação**. Os que já existiam
  ficam: data, horários, destino e veículos.
- Estudantes e escolas continuam nas **paradas** - são das participações, não do
  cabeçalho.
- O que acontece ao salvar não muda: destino novo recalcula o trajeto; data que não
  comporta abre "Faltam veículos".
- O arquivo `views/remanejar.js` passa a se chamar `views/editar.js`. Nome de arquivo
  que contradiz o nome na tela é exatamente o que a D1 quer evitar.

A escola não edita o pedido depois de enviado, como hoje: ela cancela e pede de novo,
ou pede a alteração a quem aprova.

### D5 - Reabrir uma decisão

Quem aprova passa a ter **Reabrir** em três situações:

| Situação | Botão | Vai para |
|---|---|---|
| Negado | Reabrir | Em análise |
| Cancelado | Reabrir | Em análise |
| Confirmado | Voltar para análise | Em análise |

De "Em análise" já saem confirmar e negar: com um passo a mais, qualquer decisão pode
ser refeita. Uma ação só, em vez de uma seta para cada par de situações.

- **Reabrir limpa a decisão anterior** (quem decidiu, quando e a justificativa). O
  registro do que houve continua na Auditoria, que guarda toda alteração.
- **Pede confirmação** ("Reabrir esta solicitação? Ela volta para análise e volta a
  reservar os veículos.").
- **Um pedido negado ou cancelado volta a ocupar veículo ao ser reaberto.** Se não há
  veículo livre naquele horário, a confirmação avisa ("Não há veículos livres neste
  horário. Reabrir mesmo assim?") e deixa seguir - quem aprova pode, e depois resolve
  na confirmação ("Faltam veículos"). É aviso, não erro (R15).
- **Não precisa de migration.** O banco já deixa quem escreve no SATE mudar a situação;
  a regra "negar e cancelar exigem justificativa" continua valendo e não é tocada.
- As paradas não mudam ao negar nem ao cancelar a viagem, então reabrir as encontra
  como estavam.

"Pendente de cancelamento" fica como está: quem aprova confirma o cancelamento.

No código: `reabrirSolicitacao(id)` em `sate.model.js`, pelo mesmo `transicionar()` que
já carimba todas as mudanças de situação.

### D6 - As paradas nascem no cadastro

Decisão do André (09/10/2026): mover para o cadastro; só quem tem escrita no SATE
acrescenta parada; a escola pede só para si; na aprovação, quem aprova revisa.

- **No formulário, para quem tem escrita no SATE**, o grupo Origem ganha **"Outras
  escolas no mesmo ônibus"**: o botão "Acrescentar escola" abre uma linha com escola
  (a mesma busca do campo Escola), estudantes, cadeirantes e horário de embarque. Cada
  linha tem o seu excluir.
- **A escola não vê esse bloco.** O banco já recusa parada criada por quem não escreve
  no SATE; esconder é conforto (R6).
- **Veículos e trajeto consideram todas as escolas** já no formulário: os ônibus saem
  da soma dos estudantes, e o tempo de viagem passa por todas as paradas na ordem.
- **Ao enviar**, a viagem é criada com a primeira escola e as demais são acrescentadas
  em seguida. Se alguma falhar, a viagem **existe** e a pessoa é avisada de qual escola
  não entrou, para acrescentá-la pela solicitação. Não se mexe em `criar_viagem()` para
  isso: só quem aprova usa o bloco, e a ficha é onde ele confere o resultado de
  qualquer forma.
- **Na ficha**, a lista de paradas continua editável por quem aprova (acrescentar,
  reordenar, cancelar, remover) - é a revisão. Muda de lugar: passa a ser uma linha da
  seção **Logística**, onde o agendamentos-fil tem "Compartilhar ônibus com…".

No código: `views/formulario-paradas.js` (novo), com estado e contrato próprios, como
`formulario-destino.js` e `formulario-quando.js`.

### D7 - A disponibilidade sai da ficha e vira botão

- A linha "N ônibus livres no horário deste pedido, fora ele" **sai** - para todos.
  (Por que ela enganava: spec da Disponibilidade, "A contagem não muda".)
- **Quem aprova** tem **"Ver disponibilidade do dia"** (entregue com a spec da
  Disponibilidade), que aqui passa para a seção Logística. Abre o modal por cima da
  ficha, com este pedido destacado na lista do dia; o `←` volta para a ficha.
- **A escola** não vê número de frota na ficha. No formulário ela continua vendo se o
  pedido cabe - é o que ela precisa para escolher o horário - e a página
  Disponibilidade continua aberta a todos.

### D8 - O formulário "Nova solicitação"

O que se aproveita do agendamentos-fil, e o que não:

- **Resumo do pedido num quadro só.** Hoje trajeto, saldo, erros e avisos são linhas
  soltas acima do botão. Passam a ser um quadro com faixa lateral, como o do print:
  "56 estudantes · 2 ônibus (44 lugares cada) · 3 livres para embarque às 07:30 ·
  41 min de viagem". Erros e avisos ficam dentro dele, com as cores de sempre. Ele é o
  que a pessoa confere antes de enviar; por isso fica logo acima do botão.
- **Título** "Nova solicitação" (D1), com o ícone do SATE.
- **Ordem dos grupos** como está: Origem → Destino → Quando → Responsável →
  Acessibilidade → Observações. Já é a ordem do print.

O que **não** se copia: os grupos do print são seções com traço; no hub, grupo de modal
é cartão (decisão de 02/10/2026, igual em todos os módulos). Vale-livro não existe no
SATE.

### D9 - Cortes de arquivo (R11)

| Arquivo | Hoje | Depois |
|---|---|---|
| `views/detalhe.js` | 328 linhas: ficha + decisões | só a ficha |
| `views/decisoes.js` | - | novo: os botões que cabem em cada situação, confirmar com conferência de frota, negar/cancelar com justificativa, reabrir |
| `views/formulario.js` | 382 linhas | perde a linha de saldo para `formulario-resumo.js` |
| `views/formulario-resumo.js` | - | novo: o quadro-resumo do D8 (consulta com atraso, descarte de resposta velha) |
| `views/formulario-paradas.js` | - | novo (D6) |
| `views/editar.js` | `remanejar.js`, 128 linhas | renomeado, com os campos do D4 |

Os dois cortes são por responsabilidade com estado e contrato próprios, não para caber
no teto: decidir não é mostrar, e o resumo tem o próprio ciclo de consulta.

## Perguntas em aberto

**P1 - Rótulo e valor lado a lado nas outras fichas de registro?** Ata, ocorrência,
visita e projeto usam rótulo em cima e valor embaixo. As opções:

1. **Converter as quatro junto** nos campos curtos (data, tipo, escola, situação),
   mantendo empilhados os textos longos (pauta, descrição). Fica um padrão só.
   *Recomendo* - é a sua regra de não ramificar padrões.
2. **Só o SATE agora**, e as outras quatro ficam listadas como pendência.

Sem resposta, sigo pela 2 e registro a pendência: a 1 muda telas que você não citou.

## Fora de escopo

- **Notificações** de reabertura, edição e decisão - spec seguinte.
- **A escola editar o próprio pedido** depois de enviado.
- **Histórico completo** de idas e vindas na ficha. Ela mostra a decisão em vigor; o
  resto está na Auditoria.
- **Ponto de embarque que não é escola** no formulário. Continua possível pela ficha.
- **Renomear títulos de modais de outros módulos.**

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/modules/sate/sate.model.js` | `reabrirSolicitacao` |
| `src/modules/sate/participacoes.model.js` | `resumoEscolas` devolve nome completo e apelido |
| `src/modules/sate/views/solicitacoes.js` | coluna Escolas (D2) |
| `src/modules/sate/views/detalhe.js`, `decisoes.js`, `editar.js` | D3, D4, D5, D7 |
| `src/modules/sate/views/participantes.js` | a lista como linha da Logística |
| `src/modules/sate/views/formulario.js`, `formulario-resumo.js`, `formulario-paradas.js` | D6, D8 |
| `src/modules/sate/sate.css` | quadro-resumo, justificativa, histórico |
| `src/styles/components.css` | `.det-par` documentada como par do hub; faixa lateral do `.ficha-info` |
| `.claude/rules/ui.md` | a regra de nome de modal (D1) e o par rótulo → valor |
| `docs/modulos/sate.md` | aprovar, editar, reabrir, paradas no cadastro |
| `CHANGELOG.md`, `src/core/config.js` | versões |

## Verificação

- **Testes:** `resumoEscolas` (uma escola, várias, nenhuma ativa); os botões que cabem
  em cada situação para escola e para quem aprova (função pura em `regras.model.js`,
  hoje embutida na tela); `reabrirSolicitacao` monta a alteração certa (situação nova,
  decisão limpa).
- **Navegador, dev-local, largo e estreito**, como escola e como quem aprova:
  - lista com nome completo, e apelido em maiúsculas abaixo de 720px;
  - ficha de um pedido em cada situação (sete), conferindo botões e lápis;
  - negar → reabrir → confirmar; confirmar → voltar para análise → editar;
  - nova solicitação com três escolas; a ficha mostra as três paradas na ordem;
  - "Ver disponibilidade do dia" abre e volta para a ficha.
- `python .claude/scripts/verificar_arquitetura.py` sem bloqueio; nenhum arquivo acima
  do teto.
- Console limpo; `git diff --cached` sem dado real.
