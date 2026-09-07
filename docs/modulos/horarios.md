# Horários de Trabalho

> A jornada semanal da equipe gestora de cada escola, e a cobertura da unidade
> ao longo do dia.

## O que dá para fazer aqui

- **Por escola:** ver a semana de toda a equipe gestora de uma unidade numa
  grade só, com a tira de cobertura abaixo de cada dia.
- **Por servidor:** ver e editar a semana de uma pessoa em todos os locais
  onde ela atua.
- Montar ou ajustar a jornada de alguém numa gaveta - a semana inteira de uma
  vez.
- Ver os dias de TDC como uma faixa abaixo do dia normal.
- Registrar mais de uma configuração do mesmo dia, para quando ele muda
  conforme quem está de plantão.

## Quem pode o quê

- **Escrita**: edita jornada, ordem da grade e cobertura de qualquer escola.
- **Leitura**: vê tudo, não altera.
- **Próprios**: vê e edita só a própria escola.
- **Oculto**: o módulo não aparece.

Quem entra na grade por padrão são os cargos marcados como **equipe gestora**
(nas configurações do módulo). Escola a escola, dá para incluir mais alguém ou
tirar quem não precisa aparecer.

## Passo a passo

### Editar a jornada de um servidor

1. Na aba **Por escola**, escolha a unidade e clique no lápis ao lado do nome
   da pessoa. (Ou use a aba **Por servidor**.)
2. Na gaveta, cada dia da semana tem uma linha por bloco de horário. Clique em
   **bloco** para acrescentar um; informe início e fim.
3. Se a jornada é igual todos os dias, preencha um dia e clique em **copiar
   para todos os dias**.
4. Clique em **Salvar jornada**. Todos os dias e todas as escalas são gravados
   de uma vez.

### Jornada dos dias de TDC

1. A gaveta tem uma aba para cada escala em uso (Normal, TDC Presencial…).
2. Na aba de TDC, preencha só o que muda em relação ao dia normal. Um dia
   deixado em branco segue a jornada Normal.
3. Se a escala tem um dia da semana fixo (configurado pela Gerência), a aba
   mostra só aquele dia.

### Registrar o revezamento de um dia de TDC

Em dia de TDC a escola tem duas configurações possíveis: a de quem conduz
o encontro e a de quem cobre a escola. Como o rodízio muda a cada mês, o
sistema guarda as duas em vez de uma.

1. Abra **Horários** e escolha a escola.
2. Clique no lápis do primeiro gestor.
3. Escolha a aba da escala (por exemplo, **TDC Presencial**).
4. Preencha o horário que ele cumpre quando **ele** conduz o TDC, e marque
   **conduzo o TDC nesta variante**.
5. Clique em **+** para criar uma segunda configuração (a tela passa a
   mostrar **Variante 1** e **Variante 2**) e preencha o horário que ele
   cumpre quando é **o outro** que conduz. Deixe a caixa desmarcada.
6. Clique em **Salvar jornada**.
7. Repita com o segundo gestor, invertendo: na Variante 1 o horário de
   cobertura, na Variante 2 o horário de quem conduz (com a caixa
   marcada).

Na grade da escola aquele dia passa a mostrar as duas configurações, uma
embaixo da outra, cada uma com a própria faixa de cobertura - identificada
pelo nome de quem conduz, ou por "variante 1" / "variante 2" quando
ninguém está marcado.

### Remover uma configuração

1. Abra a gaveta da pessoa e escolha a aba da configuração (por exemplo,
   **Variante 2**).
2. Clique na **lixeira**, ao lado do **+**.
3. Confirme e clique em **Salvar jornada**.

Sai só o horário **daquela pessoa** naquela configuração - o das outras
continua igual. A configuração some da grade quando a última pessoa
deixa de ter horário nela. A **Variante 1** não tem lixeira: é a
configuração base, de onde as outras herdam o que você não preencher.

O mesmo mecanismo serve para um dia comum, sem TDC, que também se
reveza - por exemplo, uma quarta-feira em que os gestores alternam manhã
e tarde a cada semana: crie a segunda variante do mesmo jeito, na aba
**Normal**, só que sem a caixa "conduzo o TDC" (ela só aparece nas
escalas de TDC).

### Ordem e cobertura na grade

- Arraste os nomes na legenda para mudar a ordem, ou use as setas.
- O interruptor "cobertura" de cada pessoa diz se ela conta no cálculo de quem
  cobre a escola. Essas escolhas valem para todo mundo que abrir aquela escola.

## Regras que o sistema aplica

- **Mais de 8 horas num dia** é **erro** - bloqueia o salvamento.
- **Blocos que se sobrepõem** no mesmo dia é **erro** - bloqueia.
- **Mais de 6 horas contínuas** e **lacuna na cobertura** são **avisos** -
  aparecem marcados na grade, mas deixam salvar.
- A jornada de TDC de uma quarta e a jornada normal da mesma quarta são
  **dias alternativos**: não se somam para checar sobreposição.
- A escola precisa estar coberta **em cada configuração registrada**, porque
  qualquer uma delas pode ser a do próximo TDC (ou da próxima semana, num
  revezamento sem TDC). Uma configuração com buraco é sinalizada sozinha,
  sem afetar a outra. É **aviso**: dá para salvar e corrigir depois.
- Quem não tem horário próprio numa segunda configuração segue o horário
  da primeira, naquela mesma escala; sem horário nenhum na escala, segue a
  jornada normal. Só preencha o que muda.
- **Supervisor(a)** não faz parte da equipe gestora e não aparece mais na
  grade nem no cálculo de cobertura das escolas.

## Ligações com outros módulos

- Os servidores e seus locais de trabalho vêm de **Servidores**.
- Os dias de TDC e em qual escala cada um está vêm do **Calendário Escolar**
  (aba "Escalas (TDC)"). O dia da semana da escala vem das configurações deste
  módulo.
- A **janela de cobertura** (o horário em que precisa haver alguém na unidade)
  depende do tipo da escola - CEI, EMEF, EMEF com EJA… - e é configurável pela
  Gerência. O padrão é das 07:00 às 18:20.

## Perguntas frequentes

**Um servidor não aparece na grade da escola.**
Ou o cargo dele não está marcado como equipe gestora, ou ele não tem local de
trabalho atual naquela unidade. Confira em Servidores.

**Editei a jornada mas a grade não mudou.**
Recarregue a página - a gaveta grava, mas a grade por baixo só relê ao
reabrir a escola.

**Não aparece o + para criar uma segunda configuração.**
O sistema desta escola ainda não foi atualizado para guardar mais de uma
configuração do mesmo dia. No lugar do botão aparece um aviso dizendo
isso. Avise a Gerência; enquanto isso, cada dia tem uma configuração só.

> Atualizado na versão 0.21.1.
