# Escolas

> Cadastro das unidades escolares da rede.

## O que dá para fazer aqui

- Buscar uma escola por nome, apelido, bairro ou pelo nome de quem está na
  equipe.
- Filtrar por segmento, por oferta, e por "tem transporte" / "atende EJA".
- Abrir a ficha de uma escola: contatos, endereço, cadastros e a equipe.
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

### Ajustar o card

1. Clique na **engrenagem** no topo da tela.
2. Ligue **Exibir telefone no card** para ver o telefone principal na lista.
3. Ligue **Exibir quantidade de servidores** para ver quantas pessoas têm
   local de trabalho aberto na unidade.
4. Em **Cards por linha**, escolha de 1 a 6 (vale para telas largas; no celular
   os cards sempre empilham).

Essas três são preferências suas - seguem o seu login e não mudam a tela de
mais ninguém.

### Editar a equipe de uma escola

A equipe **não** se edita aqui. Na ficha da escola há um atalho para
**Servidores**, já filtrado por aquela unidade - é lá que se inclui ou encerra
o local de trabalho de alguém.

## Regras que o sistema aplica

- Uma escola sem segmento preenchido continua aparecendo em qualquer filtro de
  segmento - para você poder abri-la e completar o cadastro.
- **Telefone incompleto** trava o salvamento - o número precisa ter os oito ou
  nove dígitos. Você digita com parênteses e traço ou só os números, tanto faz:
  o sistema arruma e mostra sempre no mesmo formato. Sem DDD, assume 16.
- Excluir uma escola não pode ser desfeito.

## Ligações com outros módulos

- A **equipe** vem dos locais de trabalho abertos, cadastrados em Servidores.
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

> Atualizado na versão 0.20.1.
