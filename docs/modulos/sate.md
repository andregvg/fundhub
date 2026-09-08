# SATE · Transporte extraclasse

> Onde a escola pede o ônibus para uma atividade fora da unidade, e onde a
> Gerência de Transporte aprova.

## O que dá para fazer aqui

- Pedir transporte para uma atividade do catálogo da SME ou para uma atividade
  organizada pela própria escola.
- Acompanhar em que pé está cada pedido: solicitado, em análise, confirmado,
  negado ou cancelado.
- Ver, antes de pedir, quantos veículos ainda estão livres naquele dia.
- Aprovar, negar e remanejar pedidos (para quem tem essa permissão).
- Cadastrar a frota disponível e os reforços de período de evento.

## Quem pode o quê

| Quem | O que faz |
|---|---|
| Escola | Pede transporte **para os próprios estudantes** e vê **os próprios pedidos** |
| Gerência de Transporte | Vê a rede inteira, aprova, nega, remaneja e cadastra a frota |
| Equipe da SME | Vê a rede inteira, não decide |

A escola também vê um pedido de outra escola quando o ônibus **passa na
escola dela** para embarcar estudantes - ela precisa saber a que horas o
veículo chega.

Juntar duas escolas no mesmo ônibus é decisão de quem aprova. A escola não
consegue fazer isso sozinha.

---

## As duas regras de agendamento

Estas são as regras que mais surpreendem quem está pedindo. Elas existem
porque a frota é de **veículos**, e o mesmo ônibus atende mais de uma viagem
no dia.

### 1. Um ônibus da manhã só serve à tarde com folga suficiente

Entre a **chegada prevista** do ônibus de volta na escola da manhã e o
**embarque** da atividade da tarde precisa haver um intervalo mínimo - hoje
**2 horas**.

A chegada prevista não é o horário de retorno que a escola informou: é esse
horário **mais o tempo de viagem de volta**. Um retorno às 11h com 30 minutos
de trajeto significa chegada às 11h30, e o próximo embarque só a partir das
13h30.

O intervalo é ajustável nas configurações do módulo e vale para os **próximos**
agendamentos - nunca desfaz o que já está confirmado.

### 2. Agendamento à noite depende do dia inteiro

Um pedido para o período da **noite** só é aceito se houver:

1. pelo menos **um ônibus livre pela manhã ou à tarde** do mesmo dia; **e**
2. pelo menos **um ônibus livre na manhã do dia seguinte**.

O motivo é prático: o veículo precisa estar livre antes para sair, e livre na
manhã seguinte para voltar e ser liberado.

---

## Passo a passo

### Pedir transporte

1. Abra **Nova solicitação**.
2. Escolha a atividade. Se for uma atividade organizada pela sua escola, marque
   a opção de atividade livre e informe o destino.
3. Informe a **data**, o **período** e quantos **estudantes** vão. O sistema
   calcula sozinho quantos ônibus são necessários.
4. Informe quantos estudantes usam **cadeira de rodas**, se houver. Isso
   reserva van adaptada.
5. Informe o horário de **embarque** e o de **retorno**.
6. Confira o aviso de vagas. Se o dia estiver cheio, o pedido não é aceito -
   escolha outra data.
7. Envie. O pedido nasce **pendente de autorização**.

### Aprovar ou negar

1. Abra a lista de solicitações e clique na que interessa.
2. **Aprovar** confirma o transporte e reserva os veículos.
3. **Negar** recusa o pedido. A justificativa é **obrigatória** - a escola
   precisa saber por quê.

### Cancelar

O que fazer depende de o pedido já ter sido aprovado ou não:

| Situação | Quem cancela | Como |
|---|---|---|
| Ainda não aprovado | a escola, ou quem aprova | cancela na hora, com justificativa |
| Já aprovado | a escola **pede** | fica *pendente de cancelamento* até quem aprova dar ciência |

A vaga volta ao saldo **no momento do pedido**, não no da ciência - assim o
ônibus não fica parado esperando uma formalidade.

---

## Regras que o sistema aplica

### O que bloqueia (erro)

- **Pedir sem antecedência mínima.** A escola precisa pedir com pelo menos
  5 dias. Quem aprova não tem esse limite.
- **Estourar a frota do dia.** Para a escola, o número de veículos é
  inviolável: se não há ônibus livre, o pedido não é aceito.
- **Pedido noturno sem a folga descrita na regra 2.**
- **Retorno antes do embarque.**
- **Negar ou cancelar sem justificativa.**

### O que apenas avisa

- **Intervalo entre períodos apertado** (regra 1). O retorno pode adiantar, e
  quem aprova é que sabe se a folga real dá. Fica sinalizado, não bloqueado.
- **Cadeirante sem van adaptada livre.** O pedido segue e fica *aguardando
  transporte adaptado* até a van ser resolvida.
- **Estourar a frota, para quem aprova.** Quem aprova pode e às vezes precisa
  passar do limite. Quando isso acontece, o sistema **cria um veículo extra
  só para aquele dia** e pede um rótulo que explique o motivo (por exemplo,
  "Cirem").

## Como a frota funciona

A frota não se cadastra dia a dia. Cadastra-se **quantos veículos existem** e
**desde quando**:

- A **frota vigente** não tem data de fim. Só existe uma de cada tipo de
  veículo por vez. Ao cadastrar uma nova, a anterior é encerrada na véspera -
  é assim que se registra "a partir de março passamos a ter 12".
- Um **reforço** tem data de início e fim, e **soma** à vigente. É o caso da
  Feira do Livro, que traz veículos a mais por alguns dias.
- Os dias avulsos de eventos imprevisíveis não precisam ser cadastrados: eles
  nascem sozinhos quando alguém aprova um pedido que passa do limite do dia.

Cada lançamento tem um **rótulo** ("Regular", "Feira do Livro", "Cirem"). É o
rótulo que permite entender, olhando um dia com 25 ônibus, que são 9 da frota
regular mais 16 da Feira.

Um rótulo que nunca foi usado pode ser excluído. Um que já está em uso só pode
ser **arquivado**: ele some da lista de escolha, mas os lançamentos antigos
continuam com o nome deles.

## Ligações com outros módulos

- **Escolas** fornece o endereço de embarque e o contato da unidade.
- **Calendário Escolar** é consultado para avisar quando a data pedida cai em
  recesso ou em dia sem aula.
- **Viagens** mostra a programação do dia já confirmada, pronta para conferir.
- **Dashboard** traz as atividades extraclasse do dia na tela inicial.
- **Auditoria** guarda quem aprovou, quem negou e quem cancelou cada pedido,
  com data e hora.

## Perguntas frequentes

**Pedi e o sistema disse que não há ônibus. E amanhã?**
O saldo é por dia. Troque a data no formulário e o número de vagas se atualiza
na hora.

**Minha turma tem 50 estudantes. Quantos ônibus o sistema reserva?**
Dois - a conta é por lugares por ônibus, hoje 44, arredondando para cima. Só
os estudantes entram nessa conta; acompanhantes não requisitam um veículo a
mais.

**Por que meu pedido ficou "aguardando transporte adaptado"?**
Há cadeirante na turma e ainda não há van adaptada livre naquele dia. O pedido
não foi recusado - está aguardando a van ser resolvida.

**Aprovaram meu pedido e agora a atividade foi desmarcada.**
Peça o cancelamento pela própria solicitação, com o motivo. Ele fica pendente
até a Gerência de Transporte dar ciência, mas a vaga já volta ao saldo na hora.

**Qual a diferença entre negado e cancelado?**
Negado é um pedido que **nunca** chegou a valer - foi recusado na análise.
Cancelado é um pedido que **estava de pé** e foi desfeito. Os dois exigem
justificativa.

> Atualizado na versão 0.25.0.
