# Servidores

> Cadastro das pessoas da rede: quem são, seus documentos e onde trabalham.

## O que dá para fazer aqui

- Buscar e filtrar servidores por nome, cargo, local de trabalho ou segmento.
- Abrir a ficha de uma pessoa e ver dados de contato, documentos e locais de
  trabalho.
- Cadastrar uma pessoa nova, editar seus dados e registrar seus telefones.
- Registrar um local de trabalho da pessoa - uma escola, a Sede ou uma
  gerência/subsecretaria da SME - com cargo e período.
- Encerrar um local de trabalho quando a pessoa deixa de atuar ali.
- Informar se um gestor é **Gestor 1** ou **Gestor 2** e registrar a troca de
  função, com o histórico guardado.
- Abrir, a partir da ficha, a ficha da escola onde a pessoa trabalha.
- Ajustar o card (na engrenagem): exibir o telefone e escolher quantos cards
  cabem por linha em telas largas.

## Quem pode o quê

- **Escrita**: cadastra, edita e exclui servidores e locais de trabalho.
- **Leitura**: vê tudo, não altera nada.
- **Próprios**: vê e mexe só na equipe da própria escola.
- **Oculto**: o módulo não aparece.

O cargo e o local de trabalho que aparecem na ficha **vêm do registro de
designação**, não são campos do cadastro da pessoa. Para mudá-los, edite o
local de trabalho.

## Passo a passo

### Cadastrar um servidor

1. Clique em **Novo servidor**.
2. Preencha o nome completo (obrigatório). Apelido, nascimento, documentos,
   e-mail institucional e telefones são opcionais.
3. Em **Local de trabalho** (opcional), você já pode informar onde a pessoa
   trabalha: escolha o local, o cargo e a data de início. Se o cargo for
   Gestor(a), aparece o campo **Função**: escolha Gestor 1 ou Gestor 2 (ou
   deixe **Não definida**). Deixe o grupo em branco para adicionar depois.
4. Clique em **Criar**.

### Informar e-mail e telefones

1. No grupo **Contato**, em **E-mail institucional**, digite o início do
   endereço e depois o **@**. O sistema completa com o domínio da rede e deixa
   esse trecho selecionado.
2. Se o e-mail é da rede, siga em frente. Se o domínio é outro, continue
   digitando: o que você escrever substitui o trecho selecionado.
3. O primeiro telefone já aparece pronto para preencher, com o tipo
   **Celular**. Digite o número; o sistema arruma a pontuação sozinho. Se for
   fixo ou WhatsApp, troque o tipo ao lado do número. Se você digitar um
   número de fixo, o tipo muda sozinho para **Fixo** ao sair do campo.
4. Para registrar mais um número, clique em **+ telefone**. A partir do
   segundo, aparece um interruptor ao lado de cada número: ligue o do telefone
   que é o principal, o que deve ser usado primeiro.
5. Para tirar um número, clique na lixeira da linha. Uma linha deixada em
   branco não é salva.

### Registrar um local de trabalho pela ficha

1. Na ficha do servidor, clique em **Adicionar local de trabalho**.
2. Em **Local de trabalho**, busque a escola ou a gerência pelo nome.
3. Em **Cargo / função**, escolha um cargo existente ou "+ Outro…" para digitar
   um novo.
4. Em **Início**, informe a data. Deixe **Término** em branco enquanto for o
   local atual.
5. Clique em **Adicionar**.

### Informar se o gestor é Gestor 1 ou Gestor 2

1. Na ficha do servidor, clique no lápis ao lado do local de trabalho (ou em
   **Adicionar local de trabalho**, se for um registro novo).
2. Em **Cargo / função**, deixe **Gestor(a)**. Logo abaixo aparece o campo
   **Função**.
3. Escolha **Gestor 1** ou **Gestor 2**.
4. Clique em **Salvar**. A função passa a aparecer junto do cargo, como
   "Gestor(a) 1", na ficha, na lista de servidores e na equipe da escola.

Para quem ainda não tinha função, esse é sempre um ajuste do registro: o
sistema não pergunta data nenhuma. Escolher **Não definida** também só limpa o
campo.

### Registrar uma troca de função

Use quando a pessoa **era** Gestor 1 ou Gestor 2 e passou a ser a outra função
na mesma escola.

1. Na ficha do servidor, clique no lápis ao lado do local de trabalho atual.
2. Em **Função**, escolha a nova. Aparece o campo **Mudou a partir de**.
3. Com a troca de verdade, preencha **Mudou a partir de** com a data em que a
   nova função começou. O período anterior termina na véspera e fica no
   histórico, junto dos locais encerrados: aparecem duas linhas, uma para cada
   função.
4. Se na verdade foi só um engano de cadastro (a pessoa sempre foi a outra
   função), deixe **Mudou a partir de** em branco: o registro é apenas
   corrigido e nada vai para o histórico.
5. Clique em **Salvar**.

Com a data preenchida, o salvamento só faz a troca. Se você também mudou o
local, o cargo, o início ou o término, o sistema pede que essas alterações
sejam salvas separadamente.

### Abrir a escola de um local de trabalho

1. Na ficha do servidor, em **Locais de trabalho**, clique no card da escola.
2. A ficha da escola abre por cima, com a equipe dela.
3. Para voltar ao servidor, use a seta **←** no topo (ou a tecla Esc).

A Sede e as gerências da SME não têm ficha própria: esses cards não abrem nada.
Os botões de lápis e lixeira do card continuam editando e excluindo o local de
trabalho.

### Encerrar um local de trabalho

1. Na ficha do servidor, clique no lápis ao lado do local.
2. Preencha o campo **Término** com a data em que a pessoa deixou o local.
3. Clique em **Salvar**. O registro passa a aparecer como "encerrado" e
   continua no histórico.

## Regras que o sistema aplica

- **Encerrar não é excluir.** Encerrar preenche o Término e preserva o
  registro. Excluir apaga o local de trabalho de vez - e junto some do
  histórico. Prefira encerrar.
- **Término antes do início** é impossível - o sistema bloqueia o salvamento.
- **Um mesmo cargo aberto no mesmo local** não pode se repetir para a mesma
  pessoa - o sistema bloqueia.
- **Troca de função com outras alterações juntas** é bloqueada: quando
  **Mudou a partir de** está preenchido, o sistema só aceita a troca, para não
  misturar períodos diferentes.
- **A função só existe no cargo de Gestor(a).** Em qualquer outro cargo o
  campo não aparece, e a função não é guardada.
- **Função repetida na escola** é só um aviso: se você marcar Gestor 1 numa
  escola que já tem um Gestor 1 atual, o sistema mostra o nome de quem já
  ocupa e salva assim mesmo, porque numa transição os dois períodos se
  encostam.
- **Local de trabalho sem cargo** não é aceito: se você escolher um local na
  modal de cadastro, precisa escolher também o cargo.
- **Documento fora do formato** (CPF, RG) é só um aviso: salva assim mesmo,
  porque RG de outro estado tem outro formato. Um RG que não segue o formato
  de São Paulo aparece na tela inteiro, sem pontos e sem traço - nenhum
  dígito é escondido.
- **CPF, RG e telefone você digita à vontade**, com ponto, traço e parênteses
  ou sem: o sistema arruma a pontuação sozinho e mostra sempre no mesmo
  formato, aqui e em qualquer outra tela.
- **E-mail incompleto** trava o salvamento: precisa ter o formato
  `nome@dominio.com.br`, com o endereço completo.
- **Telefone incompleto** trava o salvamento - o número precisa ter os oito
  ou nove dígitos. Sem DDD, o sistema assume 16.
- **Excluir um servidor** apaga junto os locais de trabalho, os horários e os
  afastamentos dele. A tela avisa antes.

## Ligações com outros módulos

- **Afastamentos** e **Horários** apontam para o servidor cadastrado aqui.
- A equipe que aparece na ficha de uma **escola** é a lista de locais de
  trabalho atuais daquela unidade. Pela ficha da escola dá para abrir a de
  cada pessoa - ou ir direto à edição dela - e voltar à escola com a seta ←.
- O **segmento** de um servidor é o das escolas em que ele atua - por isso quem
  só trabalha na SME aparece em qualquer filtro de segmento.
- As gerências e subsecretarias disponíveis como local de trabalho são
  cadastradas nas **configurações de Escolas**.

## Perguntas frequentes

**Cadastrei um servidor e ele não aparece na lista.**
Se você tem um segmento marcado no filtro, um cadastro ainda sem local de
trabalho aparece mesmo assim. Se não aparecer, recarregue a página.

**O gestor mudou de Gestor 2 para Gestor 1. Preciso preencher a data?**
Preencha **Mudou a partir de** se quiser manter o histórico dos dois períodos.
Em branco, o registro é só corrigido, como se a pessoa sempre tivesse sido
Gestor 1.

**A pessoa mudou de escola. Registro um local novo ou edito o antigo?**
Encerre o local antigo (preencha o Término) e registre um novo. Assim o
histórico fica correto.

> Atualizado na versão 0.39.0.
