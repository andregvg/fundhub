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
   e-mail e telefones são opcionais.
3. Em **Local de trabalho** (opcional), você já pode informar onde a pessoa
   trabalha: escolha o local, o cargo e a data de início. Deixe em branco para
   adicionar depois.
4. Clique em **Criar**.

### Registrar um local de trabalho pela ficha

1. Na ficha do servidor, clique em **Adicionar local de trabalho**.
2. Em **Local de trabalho**, busque a escola ou a gerência pelo nome.
3. Em **Cargo / função**, escolha um cargo existente ou "+ Outro…" para digitar
   um novo.
4. Em **Início**, informe a data. Deixe **Término** em branco enquanto for o
   local atual.
5. Clique em **Adicionar**.

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
- **Local de trabalho sem cargo** não é aceito: se você escolher um local na
  modal de cadastro, precisa escolher também o cargo.
- **Documento fora do formato** (CPF, RG) é só um aviso: salva assim mesmo,
  porque RG de outro estado tem outro formato. Um RG que não segue o formato
  de São Paulo aparece na tela inteiro, sem pontos e sem traço - nenhum
  dígito é escondido.
- **CPF, RG e telefone você digita à vontade**, com ponto, traço e parênteses
  ou sem: o sistema arruma a pontuação sozinho e mostra sempre no mesmo
  formato, aqui e em qualquer outra tela.
- **Telefone incompleto** trava o salvamento - o número precisa ter os oito
  ou nove dígitos. Sem DDD, o sistema assume 16.
- **Excluir um servidor** apaga junto os locais de trabalho, os horários e os
  afastamentos dele. A tela avisa antes.

## Ligações com outros módulos

- **Afastamentos** e **Horários** apontam para o servidor cadastrado aqui.
- A equipe que aparece na ficha de uma **escola** é a lista de locais de
  trabalho atuais daquela unidade.
- O **segmento** de um servidor é o das escolas em que ele atua - por isso quem
  só trabalha na SME aparece em qualquer filtro de segmento.
- As gerências e subsecretarias disponíveis como local de trabalho são
  cadastradas nas **configurações de Escolas**.

## Perguntas frequentes

**Cadastrei um servidor e ele não aparece na lista.**
Se você tem um segmento marcado no filtro, um cadastro ainda sem local de
trabalho aparece mesmo assim. Se não aparecer, recarregue a página.

**A pessoa mudou de escola. Registro um local novo ou edito o antigo?**
Encerre o local antigo (preencha o Término) e registre um novo. Assim o
histórico fica correto.

> Atualizado na versão 0.24.0.
