# Changelog - FundHub

Registro das mudanças do Hub de Ferramentas do Ensino Fundamental (SME Ribeirão Preto).
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento **MINOR** = módulo novo ou mudança de modelo de dados, **PATCH** = correção.

> A versão exibida no rodapé do app vem de `src/core/config.js` (`CONFIG.versao`).
> Ao lançar: subir a versão lá **e** registrar aqui.

---

## [0.29.0] - 2026-09-08

> **Exige rodar a migration `037_sate_participacao.sql`**, depois da `036`.

### Adicionado

- **Uma escola pode sair de uma viagem sem cancelá-la para as outras.** Quando
  o ônibus atende mais de uma escola e só uma desiste, ela clica em **Sair da
  viagem** e escreve o motivo. A vaga volta ao saldo na hora e as demais
  escolas seguem normalmente.
- Confirmada a saída, a participação fica **cancelada** - e a escola continua
  vendo o agendamento e o registro de que saiu. A informação não desaparece.
- **Ao confirmar uma saída, a Gerência pode pôr outra escola no lugar** e
  reordenar as paradas, sem mexer no resto da viagem.
- O agendamento passou a mostrar a lista **Escolas nesta viagem**, com a ordem
  das paradas, quantos estudantes cada uma leva e a situação de cada uma.

### Alterado

- **Um agendamento com mais de uma escola deixou de ter uma "escola dona".**
  Ele é de todas as escolas envolvidas, e cada uma entra como uma participação
  com os próprios estudantes e a própria situação. Uma escola pedindo sozinha
  continua exatamente como era - ela é o caso de uma participação só.
- Na lista de solicitações, a coluna **Escolas** mostra a primeira e a
  contagem das demais ("Escola Exemplo +2").
- **A ficha do motorista só traz as escolas ativas.** Quem saiu da viagem não
  aparece nela - o ônibus não iria buscar quem não vai.

## [0.28.0] - 2026-09-08

### Adicionado

- **As fichas de ônibus chegaram ao SATE**, no mesmo formato do sistema de
  agendamentos da Feira. Na guia **Fichas**, escolha a data e o sistema monta
  **uma ficha por veículo**, agrupada por período e numerada a partir de 1
  dentro de cada um.
- Cada ficha traz origem com endereço, **as paradas a mais** quando o ônibus
  passa em outra escola, destino com endereço, horários de embarque e retorno,
  e quantos lugares no ônibus e na van adaptada.
- **Imprimir sai só o documento**: menu, abas e filtros ficam de fora, e
  nenhuma ficha é cortada ao meio entre duas folhas.
- **Viagem confirmada sem ônibus atribuído aparece numa lista à parte**, no
  fim da página, para conferir antes de enviar à empresa. Um agendamento
  confirmado que some da pilha de papel é o erro mais caro que existe aqui -
  agora ele é apontado. Essa lista não é impressa.

## [0.27.0] - 2026-09-08

> **Exige rodar a migration `036_sate_envolvimento_e_saldo.sql`** no SQL
> Editor, depois da `035`. Sem ela o sistema continua abrindo, mas a escola
> vê um saldo de vagas otimista demais.

### Alterado

- **A regra de quem vê o quê no transporte ficou mais precisa.** Antes:
  "a escola vê os pedidos que ela mesma fez". Agora: **a escola vê os
  agendamentos em que está envolvida** - os que ela pediu, os que a Gerência
  de Transporte pediu por ela, e aqueles em que o ônibus para na escola dela
  para embarcar estudantes.
- **Quando um ônibus atende mais de uma escola, todas as escolas envolvidas
  veem o agendamento inteiro**, com os horários de cada parada e por onde
  mais o veículo passa. Quem divide o ônibus precisa saber a ordem das
  paradas.
- Ver não é mexer: a escola em que o ônibus só faz uma parada acompanha o
  agendamento, mas quem cancela continua sendo a escola dona dele.

### Corrigido

- **O número de vagas livres estava errado para as escolas** - e justamente
  na tela feita para avisar que as vagas acabaram. Como a escola só enxerga
  os agendamentos em que está envolvida, a conta somava só os ônibus dela e
  podia mostrar "9 de 9 livres" num dia lotado. Agora a contagem vem do
  sistema e considera a rede inteira. **Continua sendo só a contagem**: a
  escola vê quantos veículos restam, nunca de quem são as outras reservas.

## [0.26.0] - 2026-09-08

### Adicionado

- **"Nova solicitação" virou um botão da própria guia Solicitações** e abre
  numa janela, em vez de ser uma aba separada. O formulário agora se divide
  em quatro blocos - **o que**, **quando**, **quem vai**, **contato** - na
  ordem em que a conversa acontece de verdade.
- **A escola vê o saldo enquanto preenche.** Logo acima do botão de enviar
  aparece quantos ônibus ainda estão livres naquela data e quantos o pedido
  usa. Trocar a data, o período ou o número de estudantes atualiza a linha na
  hora. **Se as vagas esgotarem, o botão de enviar desabilita** e a linha
  explica o motivo - quem aprova continua podendo enviar, com o mesmo texto
  como aviso.
- **A lista de solicitações virou tabela**, com ordenação por qualquer coluna,
  busca, páginas de 25 e, no celular, a linha que abre ao toque.
- **Clicar numa solicitação abre a ficha dela**, com tudo o que ela é e, no pé,
  só as decisões que cabem naquela situação: pôr em análise, confirmar, negar,
  cancelar ou dar ciência num pedido de cancelamento.
- **Negar e cancelar pedem a justificativa numa janela própria**, e o texto é
  obrigatório. A escola vê o que foi escrito.
- **A frota se cadastra pela engrenagem do módulo**: a frota vigente de cada
  tipo de veículo, os reforços com prazo (Feira do Livro) e os rótulos que dão
  nome a tudo isso.

### Corrigido

- **Botão de opção em formulário esticava pela linha inteira**, empurrando o
  texto da opção para baixo e deixando a escolha confusa. Valia para qualquer
  formulário do sistema, não só o do transporte.
- **Esconder um campo de formulário podia simplesmente não funcionar**, sem
  aviso: o campo continuava na tela. Corrigido, e a causa ficou registrada
  para não voltar.
- **Ao abrir uma janela de formulário, o cursor ia parar num botão de opção**
  quando ele era o primeiro campo - e aí as setas do teclado trocavam a
  escolha de quem só queria navegar. Agora o cursor pula para o primeiro
  campo de digitação.

## [0.25.0] - 2026-09-08

> **Esta versão exige rodar a migration `035_sate_v2.sql` no SQL Editor do
> Supabase.** Até isso ser feito, o SATE segue funcionando com o modelo
> antigo e a aba Frota avisa que não há frota cadastrada - ele degrada,
> não quebra.

### Adicionado

- **O SATE ganhou tutorial e configurações.** O botão de ajuda no topo da
  tela explica o módulo inteiro, com **as duas regras de agendamento em
  destaque**; a engrenagem ao lado ajusta quatro números: o intervalo
  mínimo entre períodos, os lugares por ônibus, os cadeirantes por van e a
  antecedência mínima da escola.
- **A frota passou a ser cadastrada por vigência, não dia a dia.** Em vez
  de lançar cada dia do ano, registra-se **quantos veículos existem e desde
  quando**. Cadastrar uma frota nova encerra a anterior - é assim que se
  registra "a partir de março passamos a ter 12".
- **Reforço de evento soma à frota vigente.** A Feira do Livro, que traz
  veículos a mais por alguns dias, vira um lançamento com início e fim que
  se soma ao normal, sem apagar nada.
- **Van adaptada virou um recurso próprio**, com saldo separado do de
  ônibus. Turma com cadeirante passa a consumir van, e não ônibus.
- **Um ônibus pode passar em mais de uma escola.** Quem aprova pode
  acrescentar pontos de embarque a uma viagem. A escola em que o ônibus
  para também passa a ver aquele agendamento - ela precisa saber a que
  horas o veículo chega.

### Alterado

- **Negar e cancelar deixaram de ser a mesma coisa.** Negar é recusar um
  pedido que nunca valeu; cancelar é desfazer um que já estava de pé.
  Depois de aprovado, a escola não cancela sozinha: ela **pede**, e o
  pedido fica *pendente de cancelamento* até a Gerência de Transporte dar
  ciência. A vaga volta ao saldo já no momento do pedido.
- **Justificativa passou a ser obrigatória** em toda negativa e todo
  cancelamento, e o sistema guarda quem decidiu e quando.
- **A aba Frota mostra o saldo do dia** - quantos veículos existem, quantos
  estão comprometidos em cada período e de onde eles vieram ("9 Regular +
  16 Feira do Livro"). O cadastro em si vem na próxima entrega.
- **O período deixou de ser uma cota separada.** Nove ônibus atendem nove
  viagens de manhã e nove à tarde: é o mesmo veículo indo duas vezes. O que
  limita não é uma cota por turno, é o intervalo entre uma viagem e outra.

## [0.24.0] - 2026-09-08

### Alterado

- **As janelas de detalhe e edição agora abrem no meio da tela.** Antes elas
  deslizavam pela lateral direita; agora aparecem centralizadas, na frente do
  que você estava vendo. Vale para todas: ficha de escola, ficha de servidor,
  jornada da semana, ata, ocorrência, projeto, visita, calendário e o painel de
  configurações da engrenagem.
- **No celular a janela ocupa a tela inteira**, como já ocupava - só que agora
  sem a faixa da tela antiga aparecendo na lateral.
- **Ao abrir um formulário, o cursor já vai para o primeiro campo.** Antes ele
  ficava no botão de fechar e era preciso tabular até o começo.
- **O cabeçalho da janela não sai mais de vista.** Em formulários longos, o
  título e o botão de fechar ficam parados no topo enquanto o conteúdo rola.
- As janelas mais cheias - escola, servidor e jornada da semana - ficaram mais
  largas do que as demais, porque têm muitos campos curtos lado a lado.

### Corrigido

- **Havia dois jeitos diferentes de abrir a mesma coisa** no sistema, e isso
  acabou: existe um só. O jeito antigo foi removido, para não voltar por
  distração.

---

## [0.23.0] - 2026-09-08

### Adicionado

- **As listas agora podem ser tabelas - e a primeira coisa que dá para fazer
  nelas é ordenar.** Clicar no título de uma coluna organiza a lista por ela;
  clicar de novo inverte. Vale para nome, data, número, o que estiver ali.
- **Busca dentro da lista.** Uma caixa no alto da tabela vai estreitando a
  lista conforme você digita, sem esperar carregamento e sem perder os
  filtros que você já tinha escolhido. Ela ignora acento e maiúscula:
  procurar por "varzea" encontra "Várzea".
- **Páginas.** Listas longas passam a vir de 25 em 25, com a contagem à
  vista ("1-25 de 140"). Antes a página inteira era montada de uma vez, o
  que ia ficando pesado à medida que o histórico crescia.
- **No celular, a lista ficou enxuta.** Em vez de cada item ocupar cinco
  linhas da tela, aparecem só as informações principais - e **tocar na linha
  abre o resto**, junto com os botões daquele item. Cabem 12 ou 15 itens na
  tela em vez de 3, e **nunca é preciso arrastar a lista para o lado**.

### Alterado

- **Usuários & Acessos** e **Auditoria › Mudanças** passaram a usar a nova
  lista. Em Usuários, "inativo" virou uma coluna própria em vez de deixar a
  linha inteira apagada - dá para ler quem está inativo sem forçar a vista.
- Em Auditoria, os filtros de cima (período, módulo, ação, autor) continuam
  fazendo o que faziam: buscar no sistema. A caixa nova da tabela é outra
  coisa - ela estreita o que já está na tela, na hora.

### Corrigido

- **Quem usa o teclado não é mais expulso das janelas.** Ao abrir uma ficha,
  um formulário ou uma pergunta de confirmação, a tecla Tab ficava passeando
  pelo menu atrás da janela, que estava anunciado como indisponível. Agora a
  tabulação fica dentro da janela aberta, e ao fechá-la o foco volta para o
  botão que a abriu.

---

## [0.22.0] - 2026-09-07

### Adicionado

- **Auditoria virou um módulo próprio**, no menu de Administração e só para
  administradores. Antes o histórico era uma aba escondida dentro de Usuários
  & Acessos; agora tem tela inteira, com duas perguntas separadas: **Mudanças**
  ("o que mudou neste cadastro, e quem mudou?") e **Atividade** ("quem entrou,
  quem exportou, quem tentou abrir o que não podia?").
- **Registro de atividade do sistema.** Além das alterações de cadastro, que já
  eram guardadas, o sistema passa a registrar quatro acontecimentos: entrada no
  sistema, exportação de dados, mudança de permissão de alguém e tentativa de
  abrir um módulo sem ter acesso.
- **Mudança de permissão agora aparece em português.** Em vez de só o registro
  técnico, a lista mostra a frase: quem mudou o papel de quem, e para qual.
- **Controle de espaço à vista.** Pela engrenagem do módulo dá para ver quantos
  registros existem, quanto ocupam e qual a porcentagem já usada do banco - e
  apagar os mais antigos quando for preciso, com o aviso de que é definitivo.
- **O número da versão, no rodapé, agora conta a história dela.** Passando o
  mouse (ou clicando, no celular) aparece uma caixinha com desde quando aquela
  versão está no ar, um resumo do que mudou e um atalho para o histórico
  completo.

### Corrigido

- **O rodapé mostrava a data de hoje ao lado da versão**, o que fazia parecer
  que a versão tinha entrado em vigor naquele dia - e a data mudava sozinha
  todo dia. Agora a versão fica junto do nome do sistema, e a data verdadeira
  aparece na caixinha.
- **O título das gavetas deixa de ser encoberto ao rolar.** Em telas com muito
  conteúdo - as configurações, principalmente - o texto passava por cima do
  título ao rolar. Valia para todas as gavetas do sistema.
- **Os botões do topo ficaram todos do mesmo tamanho.** O de menu e o de
  usuário eram menores que os de atualizar e notificações.
- **Administrador voltou a enxergar os módulos administrativos.** Um módulo
  restrito a administradores aparecia como "acesso restrito" para o próprio
  administrador. Agora quem é administrador vê tudo, inclusive os módulos que
  vierem a existir.

- **Mudanças em papéis e permissões passam a ser registradas.** Alterar o que um
  papel pode fazer é uma mudança de segurança e, até agora, não deixava rastro
  nenhum. Passa a deixar - assim como qualquer cadastro novo que venha a existir,
  que agora entra no histórico automaticamente, sem depender de alguém lembrar.

---

## [0.21.2] - 2026-09-07

### Corrigido

- **Servidor com dois telefones digitados no mesmo campo agora fica com um
  telefone por linha.** Alguns cadastros antigos traziam dois números
  separados por barra num registro só; eles passavam batido pela conversão de
  formato e não apareciam direito na ficha.

---

## [0.21.1] - 2026-09-07

### Corrigido

- **Chaves de liga/desliga voltam a ficar junto do rótulo que obedecem.** Em
  algumas telas - as configurações, principalmente - a chavinha aparecia
  encostada na borda direita, longe do texto que explicava o que ela fazia.

---

## [0.21.0] - 2026-09-07

### Adicionado
- **Dia de TDC agora aceita mais de uma configuração.** Quando os gestores
  se revezam na condução do TDC, dá para registrar o horário de cada
  situação em vez de escolher uma e torcer. A grade da escola mostra as
  duas, uma embaixo da outra, cada uma com a própria faixa de cobertura -
  identificada pelo nome de quem conduz.
- **O mesmo vale para um dia comum, sem TDC.** Uma quarta-feira em que os
  gestores alternam manhã e tarde a cada semana também pode ter as duas
  configurações registradas.
- **Dá para remover uma configuração** que não vale mais, pela lixeira ao
  lado do "+". Sai só o horário da pessoa que está sendo editada; o das
  outras continua igual. A primeira configuração não pode ser removida -
  é dela que as outras herdam o que você não preencher.

### Corrigido
- **Horário que passa do fim do expediente não é mais cortado na tela.**
  Antes, quem ficava até mais tarde numa escola com expediente mais curto
  tinha o horário recortado sem aviso. Vale nas duas abas - por escola e
  por servidor.
- **Quem cumpre a jornada normal num dia de TDC deixou de ser contado
  como ausente.** A faixa de cobertura daquela configuração acusava um
  buraco que não existia, justamente para quem o sistema manda deixar em
  branco.
- **Se o sistema ainda não foi atualizado**, a tela avisa em vez de fingir
  que guardou: os botões de segunda configuração não aparecem, e uma
  gravação que caiu na configuração única mostra um alerta.

### Alterado
- **Supervisor(a) saiu da equipe gestora.** É cargo da Secretaria, não
  compõe a gestão da escola, e não entra mais na grade nem no cálculo de
  cobertura das unidades.

## [0.20.1] - 2026-09-06

### Alterado
- **CPF, RG e telefone**: você digita com ponto, traço e parênteses ou só os
  números, tanto faz - o sistema guarda o dado limpo e mostra sempre no mesmo
  formato, em qualquer tela. Um RG que não segue o formato de São Paulo passa
  a aparecer inteiro, sem esconder dígito. Telefone incompleto trava o
  salvamento em vez de sumir depois de salvo.
- As telas de **configuração** (a engrenagem de cada módulo e a página
  Configurações) ganharam o mesmo desenho de campo do resto do sistema:
  mesma altura, mesmo rótulo, mesmo destaque ao clicar. Vale também para a
  janela "Tipos de escala", no Calendário.
- Quem tem só permissão de leitura num módulo já não vê os controles de
  configuração da rede com cara de editáveis: eles aparecem desligados, com o
  valor à vista e o motivo escrito.
- Na **Ajuda**, o topo de cada tutorial tem dois botões: voltar para a tela de
  onde você veio e abrir a lista completa de tutoriais. Antes havia um só, e
  ele sempre levava para a lista.

### Corrigido
- **Ajuda**, **Todos os Módulos**, **Meus dados** e **Configurações** não somem
  mais do menu quando uma atualização do banco de dados ainda não foi aplicada.
  Eram telas de todo mundo que podiam desaparecer sem aviso.

## [0.20.0] - 2026-09-06

### Adicionado
- A jornada dos dias de **TDC** aparece agora na mesma grade da semana, como
  uma faixa abaixo do dia, em vez de trocar a grade inteira. E o TDC passou a
  ter dia da semana: a escala aparece na jornada mesmo antes de o calendário
  do ano ser lançado.
- No Calendário Escolar, a grade do mês mostra qual escala vale em cada dia.
- Na jornada, um botão "copiar para todos os dias" repete o horário de um dia
  nos outros.

### Alterado
- A janela de cobertura de cada escola passou a depender do tipo (CEI, EMEF,
  EMEF com EJA…), configurável pela Gerência. O padrão continua 07:00–18:20.
- "Equipe gestora" saiu da barra do módulo Horários e virou uma configuração.
- Leitura da grade: o eixo mostra "07h" e os dias aparecem em maiúsculas.
- No Calendário, remover uma data de TDC é um botão de excluir, não uma opção
  escondida num menu; a modal "Tipos de escala" ganhou o padrão de campo do
  hub e permite excluir uma escala não utilizada.

## [0.19.0] - 2026-09-06

### Adicionado
- O card de **Escolas** ganhou opções (na engrenagem): mostrar o telefone
  principal, mostrar quantos servidores estão na unidade, e escolher quantos
  cards cabem por linha em telas largas. Servidores tem a mesma opção de
  cards por linha.

### Alterado
- No formulário de escola, o Nome ocupa a linha inteira, e "Transporte de
  alunos" e "Atende EJA" viraram interruptores.
- As dicas abaixo dos campos deixaram de sair em maiúsculas e negrito -
  valia para todos os formulários do sistema.

## [0.18.0] - 2026-09-06

### Adicionado
- No **Dashboard**, agora você reordena os painéis arrastando pelo título (ou
  pelas setas nas configurações) e oculta os que não usa. A ordem e o que fica
  escondido são só seus e seguem o seu login. Painel de um módulo que você não
  acessa deixou de aparecer.

## [0.17.0] - 2026-09-06

### Alterado
- O que o sistema chamava de "vínculo" e "lotação" agora se chama **local de
  trabalho** em todas as telas - o mesmo termo do sistema da Secretaria.

### Adicionado
- Gerências, subsecretarias e coordenadorias da SME podem ser cadastradas como
  locais de trabalho (além das escolas e da Sede). O nome é editável nas
  configurações de Escolas. Ao cadastrar um servidor, já dá para informar o
  cargo e o local de trabalho na mesma tela.

## [0.16.0] - 2026-09-05

### Adicionado
- Módulo **Ajuda** (em "Documentação") com um tutorial de uso por módulo, e um
  botão de ajuda no topo de cada tela que tem tutorial. Começa com Servidores,
  Usuários, Configurações e a própria Ajuda. O que antes era "Documentação"
  passou a se chamar "Documentação técnica" - é a parte escrita para quem
  mantém o sistema.

## [0.15.0] - 2026-09-05

### Adicionado
- Tela de **Configurações** (em "Minha conta") e uma engrenagem no topo de
  cada módulo que tem o que ajustar. Começa com uma opção: exibir o telefone
  principal no card de Escolas e de Servidores. As preferências são suas e
  seguem o seu login; o que for decisão da rede só quem tem permissão muda.

## [0.14.6] - 2026-09-05

### Corrigido
- Um servidor ou uma escola recém-cadastrados agora aparecem na lista na hora,
  sem precisar recarregar a página, mesmo com um filtro de segmento ativo.
  Antes, um cadastro ainda sem segmento ficava escondido até limpar o filtro.
- Nas modais com campo de busca (como o de escola ao criar um vínculo), a lupa
  ficava acima do campo; agora fica dentro dele, como nas outras telas.

### Alterado
- Todos os botões de excluir do sistema passaram a ter o mesmo desenho: uma
  lixeira vermelha. Antes o mesmo "excluir" aparecia ora como um "x" vermelho,
  ora como uma lixeira cinza. Os botões de fechar e de adicionar também
  ficaram iguais em todas as telas.

## [0.14.5] - 2026-09-05

### Corrigido
- Ao terminar de digitar uma data ou uma hora, o Tab passou a ir direto para
  o próximo campo. Antes era preciso apertar Tab uma vez a mais, parando no
  ícone de calendário/relógio - quem preenche a jornada semanal inteira
  pagava essa parada dez vezes. O ícone continua no lugar e clicar nele
  continua abrindo o calendário.

## [0.14.4] - 2026-09-05

### Alterado
- O filtro por segmento (Fundamental, Infantil, EMEF, EJA, CEI, EMEI,
  Conveniadas) deixou de mostrar ícone ao lado do nome e passou a usar cor:
  Ensino Fundamental em azul, Educação Infantil em âmbar, e "Todas" em
  cinza destacado. A mesma cor aparece nos segmentos de atuação da tela de
  Usuários.

## [0.14.3] - 2026-09-05

### Corrigido
- A correção da versão anterior era parcial: faltava também o caso de digitar
  um horário do zero (não só editar um já preenchido) - o foco ainda saía do
  campo assim que o primeiro dígito do minuto já fechava um horário válido.
  A tela agora nunca recria o campo de hora enquanto a pessoa digita; só o
  total do dia e os avisos de sobreposição/carga horária são atualizados.

## [0.14.2] - 2026-09-05

### Corrigido
- Na jornada semanal, digitar um novo horário num bloco que já tinha início e
  fim preenchidos jogava o foco para fora do campo no meio da digitação - a
  pessoa precisava clicar de novo para continuar. Agora o foco permanece no
  campo.

### Alterado
- Campo de hora passou a ter sempre a mesma altura dos campos de texto e de
  seleção ao lado - antes saía 2 a 3 pixels mais alto em algumas telas.
- Botão de ação ao lado de um campo (excluir um bloco de horário, descartar
  uma data de escala proposta, criar um tipo de escala novo) passou a ter a
  mesma altura do campo vizinho, em vez de sair mais baixo. Dois campos de
  escala que ainda usavam a aparência padrão do navegador (a lista de tipos
  de escala e a proposta de datas de TDC) ganharam a mesma aparência dos
  demais campos do hub.

## [0.14.1] - 2026-09-02

Rodada de acabamento visual: formulários e filtros ficam mais fáceis de ler, e a
ficha do servidor foi reorganizada.

### Alterado
- Nos formulários, o título de cada bloco, o nome de cada campo e o que você
  digita agora se distinguem à primeira vista. Antes o nome do campo saía do
  mesmo tamanho e da mesma cor do conteúdo dele, e o título do bloco era o texto
  mais apagado da tela.
- Campos de data e campos apenas para leitura deixaram de sair mais altos que os
  campos de texto ao lado.
- Os filtros de todas as listas passaram a ficar num painel só, em uma linha,
  com os campos alinhados e o nome de cada filtro acima dele. Vale para
  Servidores, Escolas, Visitas, Ocorrências, Projetos, Atas, Afastamentos e o
  registro de alterações.
- Na ficha do servidor, o cargo e a escola atuais aparecem logo abaixo do nome,
  com o nome completo da escola. Deixaram de aparecer repetidos no meio da
  ficha, já que a lista de vínculos logo abaixo mostra os dois com o período.
- Código funcional, CPF e RG passaram a dividir a mesma linha da ficha.
- Editar um servidor a partir da ficha dele agora tem botão de voltar, e ao
  salvar você volta para a ficha em vez de cair na lista.
- A linha de cadastro de telefone passou a caber inteira em uma linha.

## [0.14.0] - 2026-08-31

Rodada de **escalas de TDC**: o Calendário Escolar passa a registrar quando é
dia de revezamento, e a jornada e a Dashboard acompanham.

### Adicionado
- O Calendário Escolar passou a registrar os dias de TDC e em qual escala
  cada um está. Um botão gera as 1ªs e 3ªs quartas do ano de uma vez, e você
  ajusta ou descarta o que não valer antes de gravar.
- Cada escola pode remarcar o próprio TDC para outra data, ou dizer que
  naquela data não tem TDC. O que não for remarcado acompanha o calendário
  da rede.
- No horário do gestor, além da semana normal, dá para cadastrar a jornada
  dos dias de TDC. Só é preciso preencher os dias que mudam: o que ficar em
  branco segue a jornada normal.
- A Dashboard passou a mostrar, para a data que você escolher, em qual
  escala a rede está e quem está afastado. O campo de data aceita qualquer
  dia, inclusive passado.

### Alterado
- Os nomes das escalas de TDC (hoje "TDC Presencial" e "TDC Virtual") podem
  ser renomeados por um administrador, na tela de Calendário, sem precisar
  de uma atualização do sistema.

---

## [0.13.0] - 2026-08-30

Rodada de **grade de horários**: a jornada da equipe gestora passa a ser
vista e editada numa grade só, por escola, em vez de painéis separados.

### Adicionado
- Clicando num horário, o sistema destaca todos os blocos daquela pessoa no
  dia e mostra o nome dela.
- É possível escolher quais servidores aparecem na grade da escola e quais
  entram no cálculo da cobertura, e arrastar para mudar a ordem. A escolha
  vale para todo mundo que abrir aquela escola.
- Uma tela de administração define quais cargos compõem a equipe gestora.

### Alterado
- A tela de horários por escola foi refeita. Agora a semana inteira aparece
  numa grade só, com os horários de todos os servidores lado a lado. Quando
  dois horários acontecem ao mesmo tempo, eles ficam em linhas separadas em
  vez de um cobrir o outro.
- Quando um horário passa dos limites, o pedaço problemático fica marcado
  sobre o próprio horário, em vez de um aviso solto embaixo.
- Passar de 8 horas num dia deixou de impedir o lançamento: agora fica
  marcado como aviso. Horários sobrepostos da mesma pessoa continuam
  bloqueados.
- Em Horários, o lápis de cada pessoa na grade agora abre a semana inteira
  para editar de uma vez, em vez de um horário por vez. Os campos de início
  e fim começam vazios - preencher é sempre uma escolha, nunca uma resposta
  já marcada.
- Escolher escola ou servidor passou a ser por busca: digite parte do nome.

---

## [0.12.0] - 2026-08-28

Rodada de **sistema visual**: um vocabulário só de ícone, aviso e campo vazio
para o hub inteiro - mais fácil de reconhecer em qualquer tela, clara ou
escura.

### Adicionado
- Ao salvar um formulário, o sistema avisa o que aconteceu: um aviso verde
  aparece no canto superior direito e some sozinho; erro aparece em vermelho
  e fica mais tempo na tela.
- As ações do SATE que mudam o status de uma solicitação (confirmar, negar,
  colocar em análise, marcar como adaptado) agora avisam o que aconteceu -
  antes eram silenciosas.
- Um botão de atualizar foi acrescentado ao topo da tela, com a informação de
  quando os dados foram carregados pela última vez. Ele mantém você no mesmo
  ponto da página - antes, só dava para atualizar recarregando a página
  inteira, o que sempre levava de volta ao topo.

### Alterado
- Os ícones do sistema foram redesenhados. Agora acompanham a cor do texto,
  ficam alinhados e têm o mesmo desenho em qualquer computador ou celular.
- Um erro que dá para corrigir ali mesmo (como um número de ata repetido)
  passou a aparecer junto do campo, em vez de um aviso passageiro que podia
  sumir antes de a pessoa terminar de ler.
- O telefone principal e o acesso ativo agora são chaves de liga e desliga,
  no lugar das caixinhas de marcar.
- Campos sem informação passam a dizer o que está faltando - "nunca
  acessou", "sem telefone cadastrado" - no lugar de um traço.

## [0.11.0] - 2026-08-25

Rodada de **cadastro de pessoas**: onde alguém trabalha, com que cargo e
desde quando passa a ser uma informação só, no lugar certo.

### Adicionado
- Data de nascimento no cadastro do servidor, com a idade ao lado.
- É possível vincular alguém à **SME**, e não só a uma escola - com data
  de início e de término, como qualquer outra designação.
- Os vínculos agora podem ser **editados**, não só criados e encerrados.
- Horários de Trabalho ganhou a visão **Por servidor**: dá para achar a
  pessoa e montar a jornada dela sem passar pela escola. Na ficha de cada
  servidor há um atalho direto para lá.
- Na ficha de uma escola, "Gerir em Servidores" já abre a lista mostrando
  só a equipe daquela unidade.

### Alterado
- O **cargo/função** deixou de ser digitado no cadastro da pessoa: ele vem
  da designação. A lista de opções se monta sozinha com os cargos em uso -
  um cargo novo entra quando alguém o usa pela primeira vez e some quando
  ninguém mais o ocupa.
- A **lotação** passou a mostrar o nome do lugar (a escola ou a SME), em
  vez de apenas "Escola" ou "Sede".
- Um vínculo é considerado **em aberto** enquanto não tiver data de
  término. Não é mais preciso informar ano letivo em lugar nenhum.
- Os formulários de servidor e de escola foram reorganizados: rótulos
  sempre acima do campo, campos agrupados por assunto e um campo sozinho
  na linha ocupa a largura toda.
- CPF e RG agora são formatados enquanto você digita.
- Os filtros de Servidores e de Escolas trocaram os botões por listas e
  chaves liga/desliga.
- A ficha da escola foi reorganizada em blocos, com a equipe em destaque.
- Ao editar um vínculo a partir do cadastro do servidor, a janela abre por
  cima da anterior - e o Esc volta para ela, em vez de fechar tudo.

## [0.10.2] - 2026-08-25

### Corrigido
- No computador, o botão ☰ não escondia mais o menu lateral: o menu
  continuava por cima do conteúdo mesmo depois de recolhido. Agora ele
  some e volta como deveria, e a página aproveita a largura toda.

## [0.10.1] - 2026-08-25

Ajustes internos de manutenção - sem módulo novo.

### Alterado
- Os avisos de confirmação (excluir, cancelar, etc.) e os avisos de erro
  agora aparecem no mesmo visual do resto do sistema, em vez do alerta
  padrão do navegador.

### Corrigido
- Um telefone de exemplo real havia ficado num comentário do código;
  removido (trocado por número fictício).
- Pequenos ajustes de cor e de rodapé para manter a consistência entre
  tema claro e escuro.

## [0.10.0] - 2026-07-19

Onda de **autorização e navegação**. O hub deixa de distinguir apenas
"admin / não-admin" e passa a ter permissões por módulo, com o mesmo mapa
valendo na interface **e** no banco.
Requer a migration **021** (no SQL Editor, depois da 020).

### Adicionado
- **Permissões por módulo** - mapa `módulo → nível` com quatro níveis:
  `oculto`, `proprios`, `leitura`, `escrita`. O nível vem do **papel**
  (preset em `papel_permissao`) e admite **exceção por pessoa**
  (`perfil.permissoes`). Papéis novos: Equipe SME, Transporte,
  Gestor(a) escolar - além de Administrador e Leitor. Um gestor escolar
  não vê Afastamentos nem no menu nem pela API. *(migration 021)*
- **Segmentos de atuação** - `perfil.segmentos`, com os básicos
  EMEF, EJA, CEI, EMEI e Conveniadas e os atalhos **Ensino Fundamental**
  (EMEF+EJA), **Educação Infantil** (CEI+EMEI+Conveniadas) e **Todas**.
  O filtro de segmento já abre **pré-preenchido** com a atuação da pessoa
  em Escolas, Servidores, Afastamentos, Visitas, Ocorrências, Horários,
  Projetos e SATE. É conveniência, não restrição: dá para ampliar na tela.
- **Menu lateral** agrupado (Módulos · Minha conta · Administração ·
  Documentação), com botão ☰ e **memória** do estado aberto/fechado.
  Os links do topo saíram - não cabiam mais.
- **Meus dados** (`#/meus-dados`) - a pessoa edita o próprio nome de
  exibição e, se o acesso estiver ligado a um cadastro de servidor,
  os próprios contatos e telefones. Sem senha: o acesso continua por
  link mágico ou conta Google.
- **Todos os Módulos** (`#/modulos`) - a antiga home de tiles. A tela
  inicial passou a ser a **Dashboard**.
- **Vínculo `perfil` ↔ `servidor`** - um acesso aponta para o cadastro
  funcional, evitando dado duplicado de quem é servidor e usuário.
- **Tela de acesso pendente** - quem autentica com e-mail institucional
  mas não está na allowlist agora recebe uma explicação, em vez de entrar
  num app de listas vazias bloqueadas em silêncio pelo RLS.
- **Máscara de telefone** com DDD, distinguindo fixo (8 dígitos) de
  celular (9), com DDD 16 assumido para quem digita só o número local.

### Alterado
- **Gestores & Coordenadores → Servidores** (`#/gestores` → `#/servidores`,
  com redirecionamento). O cadastro nunca foi só de gestão: agora cobre
  lotação na **sede** (equipe de acompanhamento, agentes administrativos),
  via `servidor.lotacao` e `servidor.cargo`. *(migration 021)*
- **Cards de Escolas e Servidores** exibem o **nome completo em caixa
  alta**, com o apelido abaixo - antes mostravam só o apelido.
- **Formulários** de escola e de servidor ganharam agrupamentos
  semânticos, e a gaveta ficou mais larga no desktop (560px, 680px em
  telas grandes) - os telefones não cabiam.
- **Servidores** ganhou RG, CPF e **código funcional** no formulário.
- **Botões** redesenhados no padrão discreto do GitHub: 32px de altura,
  borda de 1px, raio de 6px. O alvo de 40px do toque continua garantido
  por `@media (pointer: coarse)`.

### Corrigido
- O aviso "e-mail fora do domínio institucional" existia em `auth.js`
  mas **nunca era exibido** - `renderLogin` era chamado sem a flag.
- Telefones cadastrados sem DDD (`3333-3333`) eram exibidos como
  `(33) 3333-33`: a exibição passou a normalizar antes de formatar.

---

## [0.9.0] - 2026-07-15

Onda de **integridade de dados** e fechamento dos módulos de rotina.
Requer as migrations **016 → 020** (nesta ordem, no SQL Editor).

### Adicionado
- **Telefones** - tabela dedicada `telefone`, fonte única para escolas **e** servidores,
  com tipo, rótulo e telefone principal. Editor reutilizável em Escolas e Gestores.
  Antes, escola tinha um array e servidor um único telefone. *(migration 016)*
- **Locais** - catálogo de destinos (endereço, ponto de desembarque, coordenadas),
  usado pelas atividades e solicitações do SATE. É a base do futuro cálculo de rota.
  Vive como aba admin dentro do SATE. *(migration 017)*
- **Afastamentos - visão Calendário**: grade mensal com um chip por servidor afastado,
  colorido por tipo, sobreposto ao **evento previsto no calendário escolar**.
- **Afastamentos - sincronização com a planilha do Drive**: espelha a aba “Lançamentos”
  (que segue recebendo os lançamentos e as respostas do formulário dos gestores).
  Idempotente por `chave_externa` - re-sincronizar atualiza, nunca duplica.
  Gestores sem cadastro são ignorados e listados. *(migration 020)*
- **Calendário - edição por intervalo**: aplica a configuração de um dia a todo um
  período (recesso, feriados, semana de provas) de uma vez.
- **Calendário - importação**: cola-se TSV/CSV com cabeçalho e os dias são criados
  ou atualizados; dispensa gerar seed para atualizar o calendário.
- **Auditoria consolidada** - migration que religa o gatilho em todas as tabelas
  auditáveis; idempotente e à prova de tabela ausente. *(migration 019)*
- **Versão e changelog** - versão no rodapé e este arquivo.

### Alterado
- **Afastamentos: ciclo de vida completo** - `ativo`, `importado` (aguardando
  confirmação) e `cancelado`. Cancelar deixou de apagar: preserva histórico e
  auditoria, com reativar e excluir definitivo à parte. *(migration 018)*
- **Afastamentos: vocabulário de tipos** ampliado para cobrir também os da planilha
  (entram *Falta Abonada* e *TRE*), evitando perda de registro na sincronização.
- **Afastamentos**: campo de processo com detecção de duplicata (mesmo servidor e
  início, ou mesmo processo), contagem de dias e busca.
- **Afastamentos**: avisa ao registrar em dia marcado como “não conceder afastamentos”.
- `vw_escola_pessoas` passou a ler o telefone principal da tabela nova, com queda
  para o campo legado.
- **SATE**: desenvolvimento **pausado** a pedido da coordenação - o módulo segue
  funcional; a evolução das regras foi suspensa.

### Corrigido
- Os chips do calendário de afastamentos abriam o formulário de edição para
  qualquer usuário autorizado; agora só administradores editam.
- Afastamentos deixava a tela inteira em erro quando a migration ainda não tinha
  rodado; agora a leitura degrada e as escritas explicam o que falta.
- Recuperação do repositório após uma interrupção que corrompeu `HEAD`, o índice e
  três arquivos de trabalho.

### Notas de migração
Rodar no SQL Editor, em ordem: `016_telefone.sql`, `017_local.sql`,
`018_afastamento_extra.sql`, `019_auditoria_completa.sql`, `020_afastamento_sync.sql`.
Todas são idempotentes; 016 e 017 fazem o backfill sozinhas. As colunas legadas de
telefone seguem no banco como reserva e serão removidas em versão futura.

---

## [0.8.0] - 2026-07-14

### Adicionado
- **Projetos & Pesquisas** - cadastro dos projetos ofertados às escolas e
  manifestação de interesse de cada unidade. *(migration 015)*
- **Notificações multi-módulo** - o sino passou a cobrir também afastamentos e
  ocorrências, além das solicitações de transporte. *(migration 014)*
- **Usuários & Acessos** com **auditoria** - visualizador do histórico de alterações
  (antes, depois e diferença campo a campo) e registro de último acesso. *(migration 011)*
- **Atas de Atendimento** com impressão em papel timbrado e numeração anual. *(013)*
- **Relatórios de Visita Técnica**. *(migration 012)*
- **Ocorrências** - atendimentos telefônicos da recepção. *(migration 010)*
- **Gestores & Coordenadores** e **Horários de Trabalho**. *(migration 009)*
- **Documentação** interna do sistema, em `#/docs`.

### Alterado
- **Arquitetura reorganizada em fatias verticais** - uma pasta por módulo sobre um
  núcleo que não conhece módulo algum. Substituiu a divisão por tipo de arquivo.

---

## [0.7.0] - 2026-07-14

### Adicionado
- **Calendário Escolar** com bloqueio de datas, consultado pelo SATE. *(migration 007)*
- **Afastamentos** (primeira versão) e painel no Dashboard. *(migration 008)*
- **Programação de Viagens** (antes “romaneio”), imprimível.
- **Notificações em tempo real** e controle de saldo da frota. *(migration 006)*
- **Escolas**: cadastro completo pelo administrador.
- **SATE**: atividade livre e transporte adaptado. *(migration 005)*

---

## [0.5.0] - 2026-07-13

### Adicionado
- **SATE** - solicitação de transporte extraclasse: a escola pede, a SME valida. *(004)*
- **Dashboard do dia** e login com Google.
- **Segurança** - RLS com negativa por padrão, login institucional e lista de
  leitura autorizada; publicação automática em produção e ambiente de testes.

---

## [0.1.0] - 2026-07-13

### Adicionado
- Primeira versão do hub e do módulo **Escolas**.

### Segurança
- Dados reais retirados do repositório e histórico reescrito; o repositório é
  público e nenhum dado sensível pode ser versionado.
