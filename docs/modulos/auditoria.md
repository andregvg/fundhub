# Auditoria

> Tudo que foi alterado no sistema e tudo que aconteceu nele - com quem, quando e
> o quê.

## O que dá para fazer aqui

- Ver, alteração por alteração, o que mudou em qualquer cadastro do FundHub: o
  valor que estava lá antes e o que ficou no lugar.
- Ver quem entrou no sistema, quem exportou uma lista, quem mudou a permissão de
  alguém e quem esbarrou numa tela que não pode abrir.
- Filtrar por período, por assunto e por pessoa, e ordenar por qualquer coluna.
- Conferir quanto os registros ocupam e apagar os mais antigos.

## Quem pode o quê

Só administradores da SME abrem este módulo. Para todo mundo mais ele não aparece
no menu e o endereço não abre.

**Ninguém edita nem apaga um registro isolado** - nem administrador, nem por
dentro do sistema, nem por fora. Registro que se apaga não serve de prova. A
única remoção possível é a poda por idade, descrita mais abaixo, que apaga tudo
que passou de um prazo e nunca um item escolhido a dedo.

## Passo a passo

### Descobrir o que mudou num cadastro

1. Abra a aba **Mudanças**.
2. Ajuste **De** e **Até** para o período que interessa. A tela abre nos últimos
   30 dias.
3. Se souber onde procurar, escolha o **Módulo** e a **Ação** (Criação, Alteração
   ou Exclusão). Se souber quem, digite parte do e-mail em **Autor**.
4. Para procurar dentro do que já está na tela, use a caixa **Buscar na lista**
   logo acima da tabela. Ela é diferente dos filtros de cima: os filtros vão
   buscar no sistema; a busca da lista apenas estreita o que já apareceu, na
   hora.
5. Clique no título de uma coluna para reorganizar - **Quando** já vem do mais
   recente para o mais antigo. A lista vem de 25 em 25, com as setas e a
   contagem no rodapé.
6. Clique na linha. Abre uma janela com a data, o autor e - campo a campo - o
   valor de antes riscado em vermelho e o novo em verde.

Numa criação ou numa exclusão não há "antes e depois": a janela mostra o retrato
completo do registro como ele nasceu ou como estava quando foi apagado.

No celular a lista mostra só a data e o módulo; toque na linha para ver a ação, o
resumo e o autor.

### Descobrir quem fez o quê no sistema

1. Abra a aba **Atividade**.
2. Escolha o período e, se quiser, o **Tipo**:
   - **Entrada no sistema** - a pessoa iniciou uma sessão.
   - **Exportação de dados** - alguém baixou uma lista, e quantas linhas.
   - **Mudança de permissão** - o papel, o acesso ou uma exceção de alguém mudou.
   - **Acesso negado** - alguém tentou abrir um módulo sem ter permissão.
3. Clique na linha para ver os detalhes do evento.

### Liberar espaço

1. Clique na engrenagem, no canto superior direito da tela.
2. Veja os números: quantos registros existem, quanto ocupam e qual a
   porcentagem do banco já usada.
3. Se precisar liberar espaço, clique em **Podar registros antigos** e confirme.

Saem os eventos de atividade com mais de 180 dias e as mudanças de cadastro com
mais de 730 dias - cerca de dois anos. **É definitivo e não há backup.** Antes de
podar, considere se algum daqueles registros ainda pode ser preciso.

## Regras que o sistema aplica

- **O registro é automático e não tem como escapar.** Ele é feito pelo próprio
  banco de dados, e não pela tela: uma alteração feita por fora do FundHub
  também fica registrada.
- **Ninguém apaga um registro isolado** - a permissão simplesmente não existe.
- **Carimbo de sistema não vira registro.** Uma alteração que só mexeu em campos
  automáticos, como a data da última modificação, é ignorada para não encher a
  lista de ruído.
- **O tipo de evento é uma lista fechada.** O sistema recusa qualquer evento que
  não seja um dos quatro acima - isso impede que a lista cresça sem controle e
  ocupe o espaço que a auditoria precisa.
- **Só entra metadado, nunca conteúdo.** Uma exportação registra o nome da lista
  e a quantidade de linhas, jamais os dados exportados.
- **Podar tem limite.** O sistema recusa uma retenção menor que 30 dias para a
  atividade e 90 dias para as mudanças, mesmo que peçam.

## Ligações com outros módulos

- **Todos os módulos** alimentam a aba Mudanças: qualquer cadastro alterado em
  qualquer tela aparece aqui.
- **Usuários & Acessos** é onde as permissões são mudadas; a mudança aparece aqui
  nas duas abas - o registro detalhado em Mudanças e a frase legível em
  Atividade.
- **Meus dados** mostra a cada pessoa o próprio último acesso; aqui o
  administrador vê o de todo mundo, e o histórico completo.

## Perguntas frequentes

**Procurei uma alteração que sei que aconteceu e não achei.**
Confira o período - a tela abre nos últimos 30 dias. Se a alteração for muito
antiga, pode ter saído numa poda.

**A lista mostra um nome estranho no lugar do módulo.**
É um cadastro que ainda não ganhou nome amigável na tela. O registro está
correto; só o rótulo falta.

**Por que "quem entrou" aparece em Atividade e também em Usuários & Acessos?**
São coisas diferentes. Em Usuários & Acessos você vê *quando foi a última vez*
que a pessoa entrou - um valor que é substituído a cada entrada. Aqui você vê
*todas* as entradas, uma por uma.

**Apaguei registros por engano na poda. Dá para voltar?**
Não. Não há backup no plano atual do banco de dados.

> Atualizado na versão 0.24.0.
