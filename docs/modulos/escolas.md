# Escolas

> Cadastro das unidades escolares da rede.

## O que dá para fazer aqui

- Buscar uma escola por nome, apelido, bairro ou pelo nome de quem está na
  equipe.
- Filtrar por segmento, por oferta, e por "tem transporte" / "atende EJA".
- Abrir a ficha de uma escola: contatos, endereço, cadastros e a equipe.
- Da equipe, abrir a ficha de uma pessoa - ou já a edição dela - sem sair da
  escola.
- Cadastrar uma escola nova e editar os dados de uma existente.
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
   oficial, segmento, oferta, endereço, e-mail, telefones e cadastros (INEP,
   APM) são opcionais.
3. Ligue **Transporte de alunos** e **Atende EJA** se for o caso.
4. Clique em **Criar**.

### Localizar a escola no mapa

A localização é o que permite ao SATE calcular quanto tempo o ônibus leva da
escola até o destino. Sem ela, o transporte continua sendo pedido normalmente,
só sem o tempo de viagem.

1. Abra a escola e clique para **editar**.
2. Em **Localização**, confira o **Endereço** e clique em **Localizar pelo
   endereço**. O sistema preenche **Latitude** e **Longitude** e mostra o
   endereço que encontrou.
3. Clique em **conferir no mapa** antes de salvar. Um endereço parecido pode
   cair na rua de mesmo nome em outro bairro.
4. Se o endereço não for encontrado, ou o ponto estiver errado, copie as
   coordenadas do Google Maps: clique com o botão direito sobre a escola e
   clique nos números que aparecem. Cole o primeiro em **Latitude** e o segundo
   em **Longitude**.
5. Clique em **Salvar**.

Com a escola localizada, o **ver no mapa** da ficha passa a abrir o ponto
exato, e não uma busca pelo endereço.

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
2. Ligue **Exibir telefone no card** para ver o telefone principal na lista.
3. Ligue **Exibir quantidade de servidores** para ver quantas pessoas têm
   local de trabalho aberto na unidade.
4. Em **Cards por linha**, escolha de 1 a 6 (vale para telas largas; no celular
   os cards sempre empilham).

Essas três são preferências suas - seguem o seu login e não mudam a tela de
mais ninguém.

### Ver ou editar alguém da equipe

1. Abra a ficha da escola.
2. Em **Equipe**, clique no card da pessoa. A ficha dela abre por cima da
   escola.
3. Para voltar à escola, use a seta **←** no topo da ficha (ou a tecla Esc).

Para ir direto à edição, clique no **lápis** do card: o formulário da pessoa
abre por cima da escola e, ao **Salvar**, você volta para a escola com a equipe
já atualizada. O lápis só aparece para quem pode editar servidores.

### Incluir ou encerrar alguém na equipe

A equipe vem dos locais de trabalho de cada pessoa. Na ficha da escola, o botão
**Gerir em Servidores** abre a lista de Servidores já filtrada por aquela
unidade - é lá que se inclui ou encerra o local de trabalho de alguém.

## Regras que o sistema aplica

- Uma escola sem segmento preenchido continua aparecendo em qualquer filtro de
  segmento - para você poder abri-la e completar o cadastro.
- **Telefone incompleto** trava o salvamento - o número precisa ter os oito ou
  nove dígitos. Você digita com parênteses e traço ou só os números, tanto faz:
  o sistema arruma e mostra sempre no mesmo formato. Sem DDD, assume 16.
- Excluir uma escola não pode ser desfeito.
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

- A **equipe** vem dos locais de trabalho abertos, cadastrados em Servidores.
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

> Atualizado na versão 0.32.0.
