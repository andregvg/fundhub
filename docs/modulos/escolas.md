# Escolas

> Cadastro das unidades escolares da rede.

## O que dá para fazer aqui

- Buscar uma escola por nome, apelido, bairro ou pelo nome de quem está na
  equipe.
- Filtrar por segmento, por oferta, e por "tem transporte" / "atende EJA".
- Ligar ou escrever para a escola direto da lista: o telefone e o e-mail do card
  são clicáveis.
- Abrir a ficha de uma escola: telefones, e-mail, endereço (com o CEP ao lado), supervisão e equipe. Sob o
  nome da escola ficam as tags (segmento, oferta, transporte, EJA). Os
  cadastros menos consultados - **Nome no SAE** (só quando diferente do nome),
  INEP, regional e site da APM - ficam recolhidos em **Mais detalhes**.
- Da equipe, abrir a ficha de uma pessoa - ou já a edição dela - sem sair da
  escola.
- Cadastrar uma escola nova e editar os dados de uma existente - pelo **lápis** do
  card, na lista, ou pelo lápis da ficha.
- Ajustar o que aparece no card (na engrenagem, no topo da tela).

## Quem pode o quê

- **Escrita**: cadastra, edita e exclui escolas.
- **Leitura**: vê tudo, não altera.
- **Próprios**: vê e mexe só na própria escola.
- **Oculto**: o módulo não aparece.

O **filtro por segmento** é uma conveniência para você achar o que procura -
não é uma restrição de acesso. Quem decide o que você consegue ver de fato é o
sistema, nos bastidores.

## Passo a passo

### Cadastrar uma escola

1. Clique em **Nova escola**.
2. Preencha ao menos o **Nome** (é o que aparece nas listas). Apelido, nome
   oficial (aparece na ficha, em **Mais detalhes**, como **Nome no SAE**), segmento, oferta, CEP, endereço, e-mail, telefones e cadastros (INEP,
   APM) são opcionais.
3. Ligue **Transporte de alunos** e **Atende EJA** se for o caso.
4. Clique em **Criar**.

### Informar os telefones da escola

1. No formulário da escola, em **Telefones**, a primeira linha já vem pronta
   para preencher, com o tipo **Fixo**. Digite o número; o sistema arruma a
   pontuação sozinho.
2. Se o número for celular ou WhatsApp, troque o tipo ao lado dele. Se quiser,
   escreva um rótulo (por exemplo, "Secretaria").
3. Para registrar mais um número, clique em **+ telefone**. A partir do
   segundo, aparece um interruptor ao lado de cada número: ligue o do telefone
   que é o principal, o que deve aparecer primeiro.
4. Para tirar um número, clique na lixeira da linha. Uma linha deixada em
   branco não é salva.

### Localizar a escola no mapa

A localização é o que permite ao SATE calcular quanto tempo o ônibus leva da
escola até o destino. Sem ela, o transporte continua sendo pedido normalmente,
só sem o tempo de viagem.

1. Abra a escola e clique para **editar**.
2. Em **Localização**, digite o **CEP** (`00000-000`). O sistema preenche o
   **Endereço**, se estiver em branco, e posiciona o pino na rua - **Latitude**
   e **Longitude** vêm sozinhas. Se a escola já tinha o pino acertado, ele
   **não se move sozinho**: aparece o botão **Mover o pino para este CEP**, e
   você decide.
3. Se o CEP não ajudar, confira o **Endereço** e clique em **Localizar pelo
   endereço**. O sistema preenche **Latitude** e **Longitude** e mostra o
   endereço que encontrou. Se a busca com o endereço completo não achar nada,
   ele tenta de novo só com a rua; e, quando o mapa só encontra o bairro, avisa
   ("Só encontrei o bairro, não a rua") em vez de pôr o pino longe da escola.
4. Clique em **conferir no mapa** antes de salvar. Um endereço parecido pode
   cair na rua de mesmo nome em outro bairro.
5. Se o endereço não for encontrado, ou o ponto estiver errado, copie as
   coordenadas do Google Maps: clique com o botão direito sobre a escola e
   clique nos números que aparecem. Cole o primeiro em **Latitude** e o segundo
   em **Longitude**.
6. Clique em **Salvar**.

Com a escola localizada, o **ver no mapa** da ficha passa a abrir o ponto
exato, e não uma busca pelo endereço.

### Acertar a localização de uma escola no mapa

Quando o endereço não basta para o sistema achar o lugar, dá para acertar o
ponto olhando o mapa.

1. Abra a escola e clique no **lápis** para editar. Em **Localização**, clique
   em **Ver no mapa**: o mapa abre logo abaixo (e **Ocultar mapa** o recolhe).
   Se a escola ainda não tem ponto, ele abre no centro da cidade, com o pino
   apagado. Para aproximar ou afastar, use os botões **+** e **−** do mapa - a
   roda do mouse continua rolando o formulário.
2. Clique no lugar certo do mapa, ou arraste o pino até lá. **Latitude** e
   **Longitude** são preenchidas sozinhas.
3. Se preferir, digite ou cole as coordenadas: o pino acompanha.
4. Clique em **Salvar**.

As escolas que ainda não têm localização aparecem sempre em **Sem
localização**, na janela de configurações do módulo (a engrenagem no alto da
tela), logo abaixo do botão **Localizar N escolas** (que só aparece enquanto
houver escola a localizar). Com mais de dez escolas, a lista abre fechada:
clique no título para abrir. Clique em **Acertar no mapa** ao lado do nome: o
cadastro da escola abre; clique em **Ver no mapa**. Ao salvar, a escola sai da lista; se
você tinha chegado pela engrenagem, volta à janela de configurações.

Se o mapa não aparecer (sem internet, por exemplo), o formulário continua
funcionando: preencha **Latitude** e **Longitude** à mão ou use **Localizar
pelo endereço**.

### Localizar todas as escolas de uma vez

Para não abrir escola por escola, a localização também roda em lote.

1. Clique na **engrenagem** no topo da tela de Escolas.
2. Em **Manutenção dos dados**, veja em **Localização das escolas** quantas já
   estão localizadas.
3. Clique em **Localizar N escolas**. A barra mostra o andamento, a escola que
   está sendo procurada e quanto tempo falta.
4. Pode fechar a janela: a busca continua, e um aviso aparece quando terminar.
   Reabrindo a engrenagem, a barra volta de onde está.
5. No fim, confira as duas listas:
   - **Conferir no mapa**: escolas localizadas pela rua, sem o número exato.
     Servem para o tempo de viagem, mas vale ver se o ponto caiu na quadra
     certa.
   - **Não encontradas**: corrija o endereço no cadastro e rode de novo, ou
     informe as coordenadas à mão.

**Parar** interrompe depois da escola em andamento. O que já foi encontrado
fica salvo.

### Ajustar o card

1. Clique na **engrenagem** no topo da tela.
2. **Exibir telefone no card**, **Exibir e-mail no card** e **Exibir endereço
   no card** já vêm ligados: o card mostra, abaixo do nome, o telefone
   principal e o e-mail da escola, e depois o endereço. Desligue o que não
   quiser ver.
3. Ligue **Exibir supervisor no card** para ver quem supervisiona a escola.
4. Ligue **Exibir quantidade de servidores** para ver quantas pessoas formam a
   equipe da unidade, a mesma conta de "Equipe" na ficha. A supervisão não
   entra.
5. Em **Cards por linha**, escolha de 1 a 6 (vale para telas largas; no celular
   os cards sempre empilham).

Essas são preferências suas - seguem o seu login e não mudam a tela de
mais ninguém.

### Ver os detalhes de cadastro de uma escola

1. Abra a ficha da escola e role até o fim.
2. Clique em **Mais detalhes** (ou chegue nele com Tab e use Enter ou Espaço).
   Aparecem o **Nome no SAE** (quando é diferente do nome da escola), o
   **INEP**, a **Regional** e o **Site APM**.
3. Clique de novo para recolher. Se nenhum desses dados estiver preenchido, o
   bloco não aparece.

### Ver ou editar alguém da equipe

1. Abra a ficha da escola.
2. Em **Equipe**, clique no card da pessoa - ou, em **Supervisão**, logo abaixo da equipe,
   clique no nome (a linha mostra só o nome; telefone e e-mail estão na ficha). A ficha dela abre por cima da escola.
3. Para voltar à escola, use a seta **←** no topo da ficha (ou a tecla Esc).

Para ir direto à edição, clique no **lápis** no canto do card: o formulário da pessoa
abre por cima da escola e, ao **Salvar**, você volta para a escola com a equipe
já atualizada. O lápis só aparece para quem pode editar servidores.

### Incluir ou encerrar alguém na equipe

A equipe vem dos locais de trabalho de cada pessoa, na ordem Gestor(a) 1,
Gestor(a) 2, coordenação e demais, com o cargo numa etiqueta ao lado do nome. Quem
apenas supervisiona a escola aparece em **Supervisão**, uma linha à parte abaixo da equipe: o supervisor acompanha a escola, mas não faz
parte da equipe dela, e por isso não entra na contagem da equipe. Na ficha da escola, o botão
**Gerir em Servidores** abre a lista de Servidores já filtrada por aquela
unidade - é lá que se inclui ou encerra o local de trabalho de alguém.

## Regras que o sistema aplica

- Uma escola sem segmento preenchido continua aparecendo em qualquer filtro de
  segmento - para você poder abri-la e completar o cadastro.
- **Telefone incompleto** trava o salvamento - o número precisa ter os oito ou
  nove dígitos. Você digita com parênteses e traço ou só os números, tanto faz:
  o sistema arruma e mostra sempre no mesmo formato. Sem DDD, assume 16.
- Excluir uma escola não pode ser desfeito. O botão **Excluir escola** fica no
  rodapé do formulário de edição, na mesma linha de **Salvar**.
- **Segmento** e **Oferta** são escolhidos em lista, para o mesmo segmento não
  ser escrito de jeitos diferentes. A lista de ofertas traz as que a rede já usa.
- **Supervisão fica separada da equipe.** O supervisor aparece só em
  **Supervisão**; a equipe lista quem trabalha na escola. Sem ninguém em um dos
  blocos, a ficha avisa "Sem supervisão informada." ou "Sem pessoas
  vinculadas.".
- **O telefone principal aparece em negrito** na ficha; é ele que vai para o card.
- **Latitude e longitude andam juntas.** Se só uma for preenchida, o sistema
  guarda a escola sem localização - meia coordenada não aponta lugar nenhum.
- **Localizar pelo endereço não salva sozinho.** Ele só preenche os campos;
  quem grava é você, depois de conferir.
- **Na localização em lote, o sistema só salva o que é confiável:** o número
  exato ou, pelo menos, a rua. Resultado que aponta só o bairro, ou que caiu
  fora de Ribeirão Preto, é descartado e a escola vai para **Não encontradas**
  - uma localização errada seria pior que nenhuma.
- **Escola sem endereço cadastrado não entra no lote.** Não há o que procurar.
- **É uma escola por segundo, no máximo.** É a regra do serviço gratuito de
  mapas; 100 escolas levam cerca de dois minutos.
- Só quem tem permissão de escrita em Escolas inicia a localização em lote.

## Ligações com outros módulos

- A **equipe** e a **supervisão** vêm dos locais de trabalho abertos,
  cadastrados em Servidores.
  Cada card abre a ficha da pessoa, e da ficha dela dá para abrir de volta a
  escola - a seta ← refaz o caminho passo a passo.
- **SATE**, **Afastamentos**, **Calendário** e **Horários** apontam para as
  escolas cadastradas aqui.
- As gerências e subsecretarias da SME **não** são escolas - elas se cadastram
  nas configurações, como locais de trabalho internos.

## Perguntas frequentes

**Liguei "quantidade de servidores" e todas mostram 0.**
Ou ninguém tem local de trabalho aberto naquelas unidades, ou a lista de
servidores não carregou - recarregue a página.

**Cadastrei uma escola e ela não aparece.**
Se você tem um segmento marcado no filtro, uma escola ainda sem segmento
aparece mesmo assim. Se não aparecer, recarregue a página.

**A localização em lote parou no meio.**
Se o serviço de mapa deixar de responder três vezes seguidas, a busca para
sozinha e avisa. As escolas já localizadas continuam salvas; rode de novo mais
tarde, e ela recomeça só com as que faltam.

**De onde vem a localização? Isso tem custo?**
Do OpenStreetMap, um mapa público e gratuito. Não há conta nem cobrança. O
sistema envia só o endereço da escola, nunca dado de pessoa.

**Clico no card da equipe e nada acontece.**
A ficha de uma pessoa só abre para quem tem acesso ao módulo Servidores. Sem
esse acesso, a equipe continua visível para leitura.

> Atualizado na versão 0.41.0.
