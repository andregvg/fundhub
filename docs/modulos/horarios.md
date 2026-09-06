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
- A cobertura da escola é calculada só sobre a jornada normal; o TDC é
  informativo.

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

> Atualizado na versão 0.20.0.
