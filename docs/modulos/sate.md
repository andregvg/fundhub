# SATE · Transporte extraclasse

> Onde a escola pede o ônibus para uma atividade fora da unidade, e onde a
> Gerência de Transporte aprova.

## Onde fica o SATE

O SATE tem **página própria**, com menu, cor e marca dele - o endereço termina
em `sate.html` e dá para salvar nos favoritos. As páginas ficam no menu
lateral:

| Página | Para quem |
|---|---|
| **Solicitações** | todos |
| **Disponibilidade** | todos |
| **Fichas de ônibus**, **Frota**, **Locais**, **Configurações** | quem aprova |
| **Catálogo** | todos |

**Como usar o SATE** abre este tutorial.

O **sino** no topo avisa, na hora, do que acontece nos pedidos que você
enxerga: pedido novo, mudança de situação, escola acrescentada a uma viagem,
**pedido de saída** de uma escola e saída confirmada.

### Ver como uma escola (quem aprova)

Para conferir o que uma escola enxerga - ou orientar alguém por telefone -,
clique em **Ver como escola** no menu, busque a escola e escolha.

- O SATE passa a mostrar só as páginas da escola, só as viagens em que ela
  está envolvida, e o formulário com as regras dela (antecedência, frota
  inviolável, só a própria unidade na lista).
- Uma faixa no topo avisa em toda página. **Nada é gravado** nessa visão: os
  botões de decisão somem e o envio de pedido fica desativado.
- **Voltar à minha visão**, na faixa, encerra. Fechar a aba também.
A cor principal do SATE é escolhida em **Configurações** e vale para a rede
toda.

## O que dá para fazer aqui

- Pedir transporte para uma atividade do catálogo da SME ou para uma atividade
  organizada pela própria escola.
- Acompanhar em que pé está cada pedido: solicitado, em análise, confirmado,
  negado ou cancelado.
- Consultar, na página **Disponibilidade**, quantos veículos estão livres em
  cada dia e período antes de pedir.
- Ver quantos quilômetros e quanto tempo o ônibus leva das escolas até o
  destino, e abrir a rota no mapa.
- Aprovar, negar e remanejar pedidos (para quem tem essa permissão).
- Cadastrar a frota disponível e os reforços de período de evento.
- Imprimir as **fichas de ônibus** que vão para a empresa de transporte.

## Quem pode o quê

| Quem | O que faz |
|---|---|
| Escola | Pede transporte **para os próprios estudantes** e vê **os agendamentos em que está envolvida** |
| Gerência de Transporte | Vê a rede inteira, aprova, nega, remaneja e cadastra a frota |
| Equipe da SME | Vê a rede inteira, não decide |

### O que "envolvida" quer dizer

Um agendamento com mais de uma escola **não é de uma delas** - é de todas. Cada
escola entra como uma **participação**, com os próprios estudantes, a própria
posição na ordem das paradas e a própria situação.

A escola vê um agendamento quando ele é **dela**, e isso acontece de duas
formas:

1. **Ela mesma pediu.**
2. **A Gerência de Transporte pediu por ela.** Um agendamento criado pela
   gerência para a sua escola é seu do mesmo jeito: aparece na sua lista e
   você acompanha o andamento dele.

E vê também quando **o ônibus para na escola dela** para embarcar estudantes,
mesmo que o pedido tenha sido aberto para outra unidade - ela precisa saber a
que horas o veículo chega.

Quando um ônibus atende mais de uma escola, **todas as escolas envolvidas veem
o agendamento inteiro**, com os horários de cada parada e por onde mais o
veículo passa. Isso é de propósito: quem embarca no mesmo ônibus precisa saber
com quem está dividindo a viagem e em que ordem as paradas acontecem.

O que a escola **não** vê é agendamento de escola nenhuma em que ela não
entre - nem pedido, nem parada.

Juntar duas escolas no mesmo ônibus é decisão de quem aprova. A escola não
consegue fazer isso sozinha.

---

## A regra de agendamento

Existe uma regra só, e ela decide tudo. A frota é de **veículos**, e o mesmo
ônibus atende mais de uma viagem no dia: **cada viagem ocupa os seus veículos
desde o embarque até eles ficarem livres de novo** - o retorno, mais o tempo
de viagem de volta, mais um intervalo mínimo de segurança (hoje **2 horas**).
Uma viagem da **noite** ocupa os veículos até o **meio-dia do dia seguinte**.

**Exemplo:** um ônibus retorna às 11h de uma viagem com 30 minutos de trajeto
de volta. Ele fica livre às 11h30 e, somado o intervalo de 2 horas, só serve
outro pedido **a partir das 13h30**.

Desta regra única saem as duas consequências que mais surpreendem quem está
pedindo:

- **Um ônibus da manhã só serve à tarde depois dessa folga.** Um horário de
  embarque mais cedo do que isso não cabe, mesmo que o dia tenha frota de
  sobra.
- **Um pedido à noite ocupa a manhã seguinte.** O veículo só volta a contar no
  saldo depois do meio-dia do dia seguinte.

O tempo de viagem de volta é **calculado pelo sistema** a partir da distância
entre as escolas e o destino (ver *Trajeto e tempo de viagem*, mais abaixo). A
volta leva o mesmo tempo da ida. Se o trajeto não pôde ser calculado - uma
escola sem localização, por exemplo -, a regra conta o retorno sem tempo de
viagem, e a folga fica maior do que a real. O intervalo mínimo é ajustável nas
configurações do módulo e vale para os **próximos** agendamentos - nunca
desfaz o que já está confirmado.

**Um pedido já reserva a vaga no instante em que é enviado** - antes mesmo de
alguém aprovar. Negar o pedido ou cancelá-lo devolve a vaga na hora.

---

## Passo a passo

### Consultar a disponibilidade

1. No menu, clique em **Disponibilidade**. A tela mostra uma semana por vez,
   de segunda a domingo - as setas trocam de semana, e o campo de data pula
   direto para o dia que você quiser.
2. Cada dia mostra quantos **ônibus** (e, quando há, quantas **vans**) estão
   livres na **Manhã**, na **Tarde** e na **Noite**.
3. Na **Tarde** o número sobe ao longo do período, conforme os ônibus da
   manhã voltam - "2 · 5 a partir das 14h10 · 9 a partir das 15h30" quer dizer
   que quantos ônibus cabem depende do horário de embarque escolhido.
4. Um dia sem nenhum veículo cadastrado mostra "sem frota"; um dia que já
   passou aparece esmaecido.
5. Quem aprova pode clicar num dia para ver a composição da frota por rótulo
   (por exemplo, "9 Regular + 16 Feira do Livro") e quantos veículos já estão
   em uso em cada período.

Os números são para uma viagem **típica** de cada período - o formulário de
pedido confere o horário exato antes de enviar.

### Cadastrar a frota (quem aprova)

A frota não se lança dia a dia: cadastra-se **quantos veículos existem** e
**desde quando**.

1. No menu, clique em **Frota** e depois em **Nova frota**.
2. Escolha o **Rótulo** - de onde vêm os veículos ("Regular", "Feira do
   Livro"). Se ainda não existir, escolha **+ Novo rótulo…** e digite o nome.
3. Escolha o **Tipo** (Ônibus ou Van adaptada), quantos **Veículos** e o
   **Início**.
4. Deixe o **Fim** em branco para uma frota **em aberto**, sem data para
   acabar - é o caso comum. Preencha o Fim só para um reforço temporário, como
   os dias de uma feira, que **soma** à frota em aberto.
5. Clique em **Cadastrar frota**. Uma frota em aberto nova encerra, na
   véspera, a frota em aberto anterior do **mesmo rótulo e do mesmo tipo** -
   é assim que se registra "a partir de março passamos a ter 12". Frotas de
   rótulos diferentes coexistem e **somam**.
6. Para mudar ou apagar uma frota já cadastrada, use **Editar** ou **Excluir**
   na linha dela. **Rótulos**, na barra de cima, abre a lista para criar,
   arquivar ou excluir um rótulo.

Reduzir a quantidade ou encurtar a vigência de uma frota que cobre dias com
viagens já marcadas avisa: "Dias já agendados podem ficar sem veículo -
confira a Disponibilidade." A alteração é salva do mesmo jeito; é só um
alerta para conferir.

### Pedir transporte

1. No menu, em **Solicitações**, clique no botão **Nova solicitação**. Abre uma
   janela com o formulário dividido em quatro partes: o que, quando, quem vai,
   e contato.
2. Em **O que**, escolha a atividade. Se for uma atividade organizada pela sua
   escola, marque a opção de outra atividade e informe o destino.
3. Em **Quando**, informe a data, o período e os horários de embarque e de
   retorno - os dois são **obrigatórios**: é a partir deles que o sistema
   conta quantos ônibus estão livres.
4. Em **Quem vai**, informe a escola, as turmas, quantos estudantes vão e
   quantos usam **cadeira de rodas**. O sistema calcula sozinho quantos ônibus
   e quantas vans são necessários.
5. Escolhidas a escola e a atividade, aparece o **tempo de viagem** estimado
   até o destino. Se não aparecer, a linha diz o porquê - o pedido pode ser
   enviado assim mesmo.
6. **Acompanhe a linha de saldo** logo acima do botão de enviar: "3 ônibus
   livres para embarque às 13:00 em 05/10 · este pedido usa 2". Antes de
   preencher os dois horários, ela mostra o número do período, o mesmo que
   aparece em Disponibilidade; depois, conta pelo horário exato, e se
   atualiza sozinha a cada troca.
7. Se faltar ônibus no horário escolhido e houver um horário do mesmo período
   em que o pedido caberia, a linha sugere: "A partir das 14h10 há ônibus
   suficientes." Quem aprova, num dia **sem nenhuma frota**, vê ali mesmo um
   cadastro rápido - Rótulo, quantos ônibus e até quando - para resolver sem
   sair do formulário.
8. Se ainda assim não houver como enviar, a linha explica o motivo e o botão
   de enviar fica desabilitado - escolha outro horário ou outra data.
9. Envie. O pedido nasce **pendente de autorização** e já reserva a vaga.

Se o SATE ainda não tem nenhum veículo cadastrado, quem aprova vê, ao clicar
em **Nova solicitação**, o aviso **Antes da primeira viagem, cadastre a
frota**, com o botão **Cadastrar frota** que leva direto à página Frota. A
escola não vê esse aviso: o formulário abre normalmente e diz que não há
ônibus disponíveis na data escolhida.

### Aprovar ou negar

1. No menu, em **Solicitações**, **clique na linha** do pedido. Abre uma janela
   com tudo o que ele é e, no pé, só as decisões que cabem naquela situação.
2. **Confirmar** aprova o transporte e reserva os veículos.
3. **Negar** recusa o pedido. Abre uma segunda janela pedindo a justificativa,
   que é **obrigatória** - a escola vê o texto que você escrever.

### Confirmar quando a frota do dia não comporta

Ao clicar em **Confirmar**, o sistema confere se ainda há veículos naquele
período. Se faltarem, abre a janela **Faltam veículos neste dia**, dizendo
quantos ônibus e vans adaptadas faltam.

1. Escolha o **rótulo** que explica os veículos a mais (por exemplo, "Cirem").
   Se ainda não existir, escolha **+ Novo rótulo…** e digite o nome.
2. Clique em **Confirmar com frota extra**. O sistema cria uma frota **só para
   aquele dia**, com exatamente o que falta, e confirma o pedido - as duas
   coisas juntas.
3. Se o que falta é **van adaptada** e ela ainda vai ser providenciada, clique
   em **Aguardar van adaptada**. O pedido reserva os ônibus e fica *aguardando
   transporte adaptado*; quando a van estiver resolvida, abra o pedido e
   clique em **Confirmar** de novo.

### Remanejar um pedido

1. Abra o pedido e clique em **Remanejar**, no canto esquerdo do rodapé.
2. Altere o que for preciso: data, período, horários, destino (da lista de
   locais) e número de ônibus e vans. Estudantes e escolas não mudam aqui -
   ajuste-os em **Escolas nesta viagem**.
3. Clique em **Salvar**. Se o destino mudou, o tempo de viagem é recalculado.
4. Se o pedido já reserva veículos e a nova data não comporta, abre a janela
   **Faltam veículos neste dia** para criar a frota extra - ou **Agora não**,
   para decidir depois.

Para achar um pedido específico, use a caixa **Buscar na lista** acima da
tabela, ou clique no título de uma coluna para reorganizar. Os campos de data
e situação no alto buscam no sistema; a caixa de busca estreita o que já está
na tela.

### Imprimir as fichas para a empresa

1. Abra **Fichas de ônibus** no menu e escolha a data. Dá para filtrar por período.
2. A tela mostra **uma ficha por ônibus**, agrupadas por período e numeradas
   a partir de 1 dentro de cada um - "o terceiro ônibus da tarde" não fica
   ambíguo.
3. Cada ficha traz origem com endereço, as paradas a mais (quando o ônibus
   passa em outra escola), destino com endereço, horários de embarque e
   retorno, quantos lugares no ônibus e quantos na van adaptada.
4. Clique em **Imprimir**. Sai só o documento - menu, abas e filtros não vão
   para o papel, e nenhuma ficha é cortada ao meio entre duas folhas.

Se alguma viagem estiver confirmada **sem ônibus atribuído**, ela não gera
ficha e aparece numa lista à parte, no fim da página, para você conferir antes
de enviar. Essa lista não é impressa.

### Cancelar

O que fazer depende de o pedido já ter sido aprovado ou não:

| Situação | Quem cancela | Como |
|---|---|---|
| Ainda não aprovado | a escola, ou quem aprova | cancela na hora, com justificativa |
| Já aprovado | a escola **pede** | fica *pendente de cancelamento* até quem aprova dar ciência |

A vaga volta ao saldo **no momento do pedido**, não no da ciência - assim o
ônibus não fica parado esperando uma formalidade.

### Sair de uma viagem sem cancelá-la para todo mundo

Quando o ônibus atende mais de uma escola e **só uma** precisa desistir, ela
não cancela a viagem inteira: ela **sai da viagem**.

1. Abra o agendamento e encontre a sua escola na lista **Escolas nesta viagem**.
2. Clique em **Sair da viagem** e escreva o motivo.
3. A sua participação fica como *pedido de saída*, e a vaga já volta ao saldo.
   As outras escolas seguem normalmente.
4. Quando a Gerência de Transporte confirmar, a sua participação fica
   **cancelada**. Você continua vendo o agendamento e o registro de que a sua
   escola saiu - a informação não some.

### Montar e ajustar as paradas (quem aprova)

1. Abra o agendamento. Em **Escolas nesta viagem**, clique em **Acrescentar
   parada**. Escolha **Escola** e a unidade, ou **Outro ponto de embarque** e
   um lugar do cadastro de **Locais** (um polo, uma praça). Informe
   estudantes, cadeirantes e horário de embarque. A parada entra no fim da
   fila; o total de estudantes da viagem é recalculado sozinho.

   Um ponto que não é escola precisa estar em **Locais**, com endereço e
   localização: é de lá que saem o endereço da ficha do motorista e o tempo
   de viagem.
2. Para mudar a ordem, **arraste** a escola pela alça à esquerda do número. No
   celular, use as **setas** de subir e descer. A ordem é a que sai na ficha
   do ônibus.
3. Para tirar uma escola há dois botões, e eles não fazem a mesma coisa:

| Botão | Quando usar | O que acontece |
|---|---|---|
| **Cancelar participação** | a escola avisou que não vai | pede justificativa; a escola continua vendo o registro de que saiu |
| **Remover** | a escola foi posta por engano | apaga a linha; a escola deixa de ver o agendamento |

Quando uma escola pediu para sair, a linha dela mostra **Manter** e
**Confirmar saída**. Confirmada a saída, é o momento de acrescentar outra
escola no lugar e reordenar, sem mexer no resto da viagem.

Cada uma dessas mudanças **recalcula o trajeto** sozinha: acrescentar, tirar e
reordenar mudam por onde o ônibus passa.

### Localizar um destino

1. No menu, em **Locais**, abra o local (ou crie um com **Novo local**).
2. Confira o **Endereço** e clique em **Localizar pelo endereço**. Latitude e
   longitude são preenchidas, e o sistema mostra o endereço que encontrou.
3. Clique em **conferir no mapa** antes de salvar.
4. Se não encontrar, copie as coordenadas do Google Maps: botão direito sobre
   o lugar, e clique nos números.
5. Salve.

As escolas se localizam do mesmo jeito, no cadastro de **Escolas**.

---

## Trajeto e tempo de viagem

O agendamento mostra, no campo **Trajeto**, quantos quilômetros o ônibus
percorre das escolas até o destino, na ordem das paradas, e quanto tempo isso
leva.

**Como o tempo é calculado:** a distância por estrada vem do OpenStreetMap, um
mapa público e gratuito. O tempo é essa distância dividida pela **velocidade
média do ônibus** (hoje 20 km/h, que já conta com trânsito urbano), mais uma
**margem por parada** (hoje 5 minutos) para cada escola onde o ônibus embarca
estudantes.

| Exemplo | |
|---|---|
| 10 km, uma escola | 30 min de estrada + 5 de manobra = **35 min** |
| 10 km, três escolas | 30 min de estrada + 15 de manobra = **45 min** |

Os dois números são ajustáveis nas configurações do módulo e valem para os
**próximos** cálculos. O tempo de um agendamento já calculado não muda sozinho
- para atualizar, quem aprova clica em **Recalcular**.

**Ver rota no mapa** abre o Google Maps com as paradas na ordem e o destino.

**Quando o trajeto não é calculado:**

| O que a tela diz | O que resolve |
|---|---|
| uma escola está sem localização | localizar a escola no cadastro de Escolas, depois **Recalcular** |
| o destino não tem localização | usar um local do cadastro, localizado em Locais |
| o serviço de mapa não respondeu | tentar **Recalcular** mais tarde |

O trajeto é informação para decidir, não condição para pedir: sem ele, o
pedido segue normalmente.

---

## Regras que o sistema aplica

### O que bloqueia (erro)

- **Dia sem nenhuma frota cadastrada.** Vale para todo mundo, inclusive quem
  aprova: sem veículo cadastrado não há o que reservar.
- **Faltar ônibus no horário pedido, para a escola.** O número de veículos é
  inviolável: se não há ônibus livre naquele horário, o pedido não é aceito.
- **Horário de embarque ou de retorno em branco.**
- **Retorno antes do embarque.**
- **Pedir sem antecedência mínima.** A escola precisa pedir com pelo menos
  5 dias. Quem aprova não tem esse limite.
- **Negar ou cancelar sem justificativa.**

### O que apenas avisa

- **Trajeto não calculado.** Escola ou destino sem localização, ou serviço
  de mapa fora do ar, nunca impedem o pedido - a SME pode precisar agendar
  para um lugar ainda não localizado.
- **Cadeirante sem van adaptada livre.** O pedido segue. Ao confirmar, quem
  aprova cria a van extra ou deixa o pedido *aguardando transporte adaptado*
  até a van ser resolvida.
- **Faltar ônibus no horário, para quem aprova.** Quem aprova pode e às vezes
  precisa passar do limite. Quando isso acontece, o sistema **cria um veículo
  extra só para aquele dia** e pede um rótulo que explique o motivo (por
  exemplo, "Cirem").

## Como a frota funciona

A frota não se cadastra dia a dia. Cadastra-se **quantos veículos existem** e
**desde quando**:

- A **frota vigente** não tem data de fim. Só existe uma de cada **rótulo e
  tipo** por vez - frotas de rótulos diferentes coexistem e **somam**. Ao
  cadastrar uma nova do mesmo rótulo, a anterior é encerrada na véspera - é
  assim que se registra "a partir de março passamos a ter 12".
- Um **reforço** tem data de início e fim, e **soma** à vigente. É o caso da
  Feira do Livro, que traz veículos a mais por alguns dias.
- Os dias avulsos de eventos imprevisíveis não precisam ser cadastrados: eles
  nascem sozinhos quando alguém aprova um pedido que passa do limite do dia.

Cada lançamento tem um **rótulo** ("Regular", "Feira do Livro", "Cirem"). É o
rótulo que permite entender, olhando um dia com 25 ônibus, que são 9 da frota
regular mais 16 da Feira.

**Frota extra sem pedido.** Se um pedido que ganhou frota extra é negado,
cancelado ou remanejado para outra data, os veículos extras **não somem
sozinhos**. Eles aparecem no topo da página **Frota**, em *Frota extra sem
pedido*, com dois botões: **Manter** (os veículos continuam, como um reforço
comum daquele dia) e **Remover**. Quando o pedido é da **noite**, essa frota
extra vale da data até o dia seguinte - a mesma viagem que ocupa a manhã
seguinte precisa da frota que a cubra lá também.

Um rótulo que nunca foi usado pode ser excluído. Um que já está em uso só pode
ser **arquivado**: ele some da lista de escolha, mas os lançamentos antigos
continuam com o nome deles.

## Ligações com outros módulos

- **Escolas** fornece o endereço de embarque, a localização no mapa e o
  contato da unidade.
- **Calendário Escolar** é consultado para avisar quando a data pedida cai em
  recesso ou em dia sem aula.
- **Viagens** mostra a programação do dia já confirmada, pronta para conferir.
- **Dashboard** traz as atividades extraclasse do dia na tela inicial.
- **OpenStreetMap** fornece as distâncias e a busca de endereço. É gratuito,
  sem conta, e recebe só endereços e coordenadas - nunca dado de pessoa.
- **Auditoria** guarda quem aprovou, quem negou e quem cancelou cada pedido,
  com data e hora.

## Perguntas frequentes

**O tempo de viagem está estranho. Dá para corrigir?**
Confira primeiro a localização das escolas e do destino - clique em **Ver rota
no mapa** e veja se os pontos estão nos lugares certos. Corrigida uma
localização, **Recalcular** atualiza o agendamento. Se o problema for a
velocidade média para toda a rede, ela é ajustada nas configurações.

**Calcular o trajeto tem custo?**
Não. A distância vem do OpenStreetMap, gratuito e sem conta. O link **Ver rota
no mapa** só abre o Google Maps no navegador, sem nenhuma cobrança.

**Pedi e o sistema disse que não há ônibus. E agora?**
Pode ser o dia ou o horário: um dia com frota de sobra ainda pode não ter
ônibus livre no horário exato que você pediu. Se a linha do saldo sugerir um
horário - "A partir das 14h10 há ônibus suficientes" -, tente esse horário
primeiro. Senão, troque a data ou confira a página **Disponibilidade** para
achar um horário com mais folga.

**O saldo que eu vejo conta os pedidos das outras escolas?**
Conta. O número de ônibus livres é o da rede inteira, no dia e no horário
pedidos, mesmo que você só enxergue os agendamentos em que a sua escola está
envolvida - senão o aviso de vagas esgotadas não serviria para nada. O que
aparece é só a contagem: você não vê de quem são as outras reservas.

**Minha turma tem 50 estudantes. Quantos ônibus o sistema reserva?**
Dois - a conta é por lugares por ônibus, hoje 44, arredondando para cima. Só
os estudantes entram nessa conta; acompanhantes não requisitam um veículo a
mais.

**Por que meu pedido ficou "aguardando transporte adaptado"?**
Há cadeirante na turma e não havia van adaptada livre naquele dia. A Gerência
de Transporte reservou os ônibus e está providenciando a van. O pedido não foi
recusado - ele é confirmado quando a van estiver resolvida.

**Aprovaram meu pedido e agora a atividade foi desmarcada.**
Peça o cancelamento pela própria solicitação, com o motivo. Ele fica pendente
até a Gerência de Transporte dar ciência, mas a vaga já volta ao saldo na hora.

**Qual a diferença entre negado e cancelado?**
Negado é um pedido que **nunca** chegou a valer - foi recusado na análise.
Cancelado é um pedido que **estava de pé** e foi desfeito. Os dois exigem
justificativa.

> Atualizado na versão 0.37.0.
