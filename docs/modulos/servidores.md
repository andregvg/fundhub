# Servidores

> Cadastro das pessoas da rede: quem são, seus documentos e onde trabalham.

## O que dá para fazer aqui

- Buscar e filtrar servidores por nome, cargo, lotação ou segmento.
- Abrir a ficha de uma pessoa e ver dados de contato, documentos e vínculos.
- Cadastrar uma pessoa nova, editar seus dados e registrar seus telefones.
- Vincular a pessoa a uma escola ou à SME, com cargo e período.
- Encerrar um vínculo quando a pessoa deixa de atuar num lugar.

## Quem pode o quê

- **Escrita**: cadastra, edita e exclui servidores e vínculos.
- **Leitura**: vê tudo, não altera nada.
- **Próprios**: vê e mexe só na equipe da própria escola.
- **Oculto**: o módulo não aparece.

O cargo e a lotação que aparecem na ficha **vêm do vínculo aberto**, não são
campos do cadastro da pessoa. Para mudá-los, edite o vínculo.

## Passo a passo

### Cadastrar um servidor

1. Clique em **Novo servidor**.
2. Preencha o nome completo (obrigatório). Apelido, nascimento, documentos,
   e-mail e telefones são opcionais.
3. Clique em **Criar**.
4. Depois de criar, abra a ficha da pessoa para vinculá-la a uma escola ou à
   SME.

### Vincular a pessoa a um local

1. Na ficha do servidor, clique em **Novo vínculo**.
2. Em **Local**, busque a escola pelo nome, ou escolha "SME".
3. Em **Cargo / função**, escolha um cargo existente ou "+ Outro…" para digitar
   um novo.
4. Em **Início**, informe a data. Deixe **Término** em branco enquanto o
   vínculo estiver ativo.
5. Clique em **Vincular**.

### Encerrar um vínculo

1. Na ficha do servidor, clique no lápis ao lado do vínculo.
2. Preencha o campo **Término** com a data em que a pessoa deixou o local.
3. Clique em **Salvar**. O vínculo passa a aparecer como "encerrado" e continua
   no histórico.

## Regras que o sistema aplica

- **Encerrar não é excluir.** Encerrar preenche o Término e preserva o
  registro. Excluir apaga o vínculo de vez - e junto some do histórico. Prefira
  encerrar.
- **Término antes do início** é impossível - o sistema bloqueia o salvamento.
- **Um mesmo cargo aberto no mesmo local** não pode se repetir para a mesma
  pessoa - o sistema bloqueia.
- **Documento fora do formato** (CPF, RG) é só um aviso: salva assim mesmo,
  porque RG de outro estado tem outro formato.
- **Excluir um servidor** apaga junto os vínculos, os horários e os
  afastamentos dele. A tela avisa antes.

## Ligações com outros módulos

- **Afastamentos** e **Horários** apontam para o servidor cadastrado aqui.
- A equipe que aparece na ficha de uma **escola** é a lista de vínculos abertos
  daquela unidade.
- O **segmento** de um servidor é o das escolas em que ele atua - por isso quem
  só tem vínculo com a SME aparece em qualquer filtro de segmento.

## Perguntas frequentes

**Cadastrei um servidor e ele não aparece na lista.**
Se você tem um segmento marcado no filtro, um cadastro ainda sem vínculo
aparece mesmo assim. Se não aparecer, recarregue a página.

**A pessoa mudou de escola. Crio um vínculo novo ou edito o antigo?**
Encerre o vínculo antigo (preencha o Término) e crie um novo. Assim o histórico
fica correto.

> Atualizado na versão 0.16.0.
