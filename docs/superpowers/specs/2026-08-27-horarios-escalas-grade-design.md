# FundHub - Horários: grade única, escalas de calendário e cobertura

> Decisões tomadas em 27/08/2026. Este documento explica o **porquê**; os dois
> planos de implementação correspondentes detalham o **como**.
>
> Depende de `2026-08-27-sistema-visual-design.md` (ícones, toast, `.switch`),
> que é implementada antes.

## 1. O problema

O módulo Horários responde bem a "qual é a jornada semanal cadastrada deste
gestor". Ele não consegue responder as duas perguntas que a Gerência realmente
faz:

1. **"Que horário este gestor cumpre HOJE?"** - porque o calendário escolar
   define os dias de TDC (Trabalho Docente Coletivo) como 1ªs e 3ªs quartas de
   cada mês, alguns gestores definem jornada alternativa nesses dias, e há
   revezamento: numa quarta de TDC vale um horário, na seguinte vale outro.
2. **"Esta escola está coberta, e por quem?"** - porque a tela empilha um painel
   por servidor, e comparar duas pessoas exige rolar a página.

### 1.1 Por que o modelo atual não alcança

`horario_bloco` amarra o bloco a `dia_semana` (1-5). Isso embute a premissa de
que **toda quarta é igual a toda outra quarta**. O TDC quebra essa premissa; o
revezamento a quebra duas vezes, porque não basta saber que dia da semana é
hoje - é preciso saber *qual* quarta é hoje.

### 1.2 A inversão que resolve

A pergunta "em qual fase do revezamento o gestor está?" só é difícil enquanto
for **calculada**. Sistemas escolares que resolvem isso (Veracross, Blackbaud,
PowerSchool, Edsby) fazem todos a mesma inversão, sob nomes diferentes - *cycle
days*, *rotation days*, *day patterns*:

> O horário não é escrito contra **datas**. É escrito contra **nomes de dia**.
> E o **calendário** é quem diz, para cada data real, qual nome ela tem.

Aqui esses nomes se chamam **escalas**: `normal`, `tdc-a`, `tdc-b`. Resolver a
jornada de uma data vira consulta, não inferência:

```
data → escala da unidade naquela data (senão a da rede, senão 'normal')
     → blocos daquele servidor naquela escala
     → se não houver, os blocos 'normal'
```

### 1.3 Alternativas descartadas

**Regra de recorrência no próprio bloco** (padrão iCalendar `RRULE`, algo como
`BYDAY=WE;BYSETPOS=1,3`). Elegante no papel e é o que muitos calendários usam.
Descartada porque é **cega a correções**: quando um feriado come a 1ª quarta de
setembro, a regra continua afirmando que é a fase A e a escola sabe que virou B.
A regra não tem como saber - o calendário tem, porque uma pessoa o corrigiu.
Somando: `RRULE` é difícil de autorar em formulário, difícil de validar, e uma
regra errada erra em silêncio para o ano inteiro.

**Contar TDCs decorridos desde o início do ano letivo.** Mesma cegueira, e ainda
quebra **retroativamente**: corrigir o calendário em outubro mudaria a fase de
todos os TDCs de agosto, e portanto a resposta a "que horário valia em 12/03".
Um sistema consultado para instruir processo não pode ter passado instável.

**Escala como calendário:** o passado é imutável porque é dado gravado, não
resultado de conta.

## 2. Decisões - fundação

### D1 - Quem é equipe gestora

`vinculo.papel` (o cargo) é **texto livre**, e `vinculos.model.js` afirma que o
catálogo "não tem vida própria, ele É o conjunto dos cargos em uso". Portanto o
sistema hoje não sabe responder "esta pessoa é gestora?" - e três dos pedidos
dependem disso.

**Decisão:** tabela `cargo_gestao(cargo text primary key)`, editável pelo admin.
`ehGestao(cargo)` mora em `vinculos.model.js`, que é o dono do domínio "cargo".

**Descartado - dedução por palavra no texto do cargo.** Bastaria alguém escrever
"Diretora Escolar" onde os outros escrevem "Diretor(a)" para a pessoa sumir da
grade sem nenhum aviso. Falha silenciosa em dado de pessoa é o pior modo de
falhar que este projeto tem.

**Onde fica a tela:** no módulo Horários, numa gaveta de admin. O model fica com
Servidores porque é o dono de "cargo"; a tela fica em Horários porque é o único
consumidor e Servidores não tem hoje nenhuma superfície de gestão de cargos.
Inventar uma lá só para hospedar isto seria criar tela sem demanda.

**Comportamento por omissão:** cargo que não está na lista **não** é gestão.
Ninguém entra na cobertura da escola por acidente; entra quando alguém decidiu.

### D2 - Escalas

**Migration 024**, três mudanças de dado:

```sql
alter table dia_calendario add column if not exists escala text;

create table if not exists escala_unidade (
  unidade_id uuid not null references unidade_escolar(id) on delete cascade,
  data       date not null,
  escala     text,
  primary key (unidade_id, data)
);

alter table horario_bloco add column if not exists escala text not null default 'normal';
```

**Três estados, deliberadamente distintos:**

| Situação | Significado |
|---|---|
| Sem linha em `escala_unidade` | a escola segue o calendário da rede |
| Linha com `escala` preenchida | a escola remarcou: nesta data vale esta escala |
| Linha com `escala` nula | a escola **cancelou**: nesta data não há TDC aqui |

Um `boolean` ou um simples `null` não distinguiria "não decidiram nada" de
"decidiram que não tem". Essa distinção é o que permite uma escola cancelar seu
TDC sem que o calendário da rede a arraste de volta.

**Vocabulário:** `normal`, `tdc-a`, `tdc-b`. É coluna `text` e não `enum` porque
o vocabulário vai crescer (recesso, plantão, sábado letivo) e migrar `enum` no
Postgres é caro. A validação do conjunto vive na aplicação, onde é barata de
mudar; o banco garante só que a coluna existe e não é nula em `horario_bloco`.

**Fallback para `normal`** é o que torna a mudança invisível para quem não
precisa dela: os ~140 gestores sem jornada alternativa não ganham nenhum
registro novo e continuam com a jornada de sempre em dia de TDC.

### D3 - Exibição e cobertura por escola

```sql
create table if not exists horario_exibicao (
  unidade_id      uuid not null references unidade_escolar(id) on delete cascade,
  servidor_id     uuid not null references servidor(id)        on delete cascade,
  ordem           int  not null default 0,
  conta_cobertura boolean not null default true,
  primary key (unidade_id, servidor_id)
);
```

Uma tabela resolve dois pedidos: o toggle "este servidor conta na cobertura
desta escola" e a ordem arrastada da grade.

**Por que no banco e não em `localStorage`:** "o horário da coordenadora conta na
cobertura desta escola" é um **fato da escola**, não uma preferência de quem
está olhando. Duas pessoas conferindo a mesma unidade precisam ver a mesma
cobertura, e quem imprime precisa imprimir o que os outros veem. Escrita sujeita
à permissão de escrita do módulo, como todo o resto.

**Sem linha = comportamento padrão:** aparece se for cargo de gestão, conta na
cobertura, ordenado alfabeticamente por cargo e depois por nome. "Voltar à ordem
padrão" apaga as linhas de ordem da unidade.

## 3. Decisões - telas

### D4 - Busca no lugar dos selects

**Decisão:** `shared/ui/busca-selecao.js` - campo de busca por palavras-chave que
filtra enquanto se digita, com navegação por teclado.

**Por que componente JS e não classe CSS (R12):** tem estado (o termo digitado, o
item destacado), eventos de teclado (setas, Enter, Esc), gestão de foco e ciclo
de vida da lista. É exatamente o critério que separa `drawer.js` de `.card`.

**Regra de três, com usos existentes hoje:** escola em Horários, servidor em
Horários, servidor no formulário de Usuários (uma lista que cresce com o
cadastro inteiro da rede), escola no formulário de vínculo de Servidores. Quatro.

**Servidor é exibido pelo nome completo**, nunca pelo apelido. A busca casa
contra nome, apelido e cargo, mas o que aparece é o nome - é o que consta do
ofício.

### D5 - Grade única por escola

Some a pilha de painéis. Uma grade só:

```
[ legenda arrastável: Diretor(a) X · Vice Y · Coord. Z ]   [voltar à ordem padrão]

Seg  |7 |8 |9 |10|11|12|13|14|15|16|17|18|
     |    ███████████      ██████████     |   ← faixa 1
     |         ████████████               |   ← faixa 2
     |▓▓▓▓                        ▓▓▓▓▓▓▓▓|   ← tira de cobertura (lacunas)
```

**Faixas:** dentro de um dia, blocos que se sobrepõem no tempo são empilhados em
faixas distintas. Sem isso um bloco cobre o outro e a grade mente. A altura da
linha do dia é o número de faixas que aquele dia precisa - dias simples ficam
finos.

**Tira de cobertura:** sob cada dia, uma faixa fina mostrando a união dos blocos
de quem conta na cobertura, com as lacunas em vermelho. É a resposta de relance
a "esta escola está coberta".

### D6 - Cor: agrupa, não identifica

O risco do pedido é virar carnaval. A regra que evita isso:

> **Em repouso a grade é quase monocromática. A cor só aparece quando você está
> procurando alguém.**

- Tokens `--serie-1` a `--serie-6` em `tokens.css`, dessaturados, atribuídos pela
  posição na legenda (a mesma ordem que o arrasto define).
- Ao clicar numa barra, o servidor dono dela ganha saturação cheia, **todo o
  resto esmaece**, e o nome dele aparece em destaque na legenda. Clicar fora
  desfaz.
- Mais de seis servidores exibidos: as cores repetem. Isso é aceitável porque a
  cor não é a identidade - a legenda e a seleção são. Cor é agrupamento visual
  temporário.

### D7 - Divergência marcada onde ela está

Hoje `validarDia` devolve `[{ nivel, texto }]`, e a tela imprime o texto embaixo
da barra, alinhado à esquerda - longe do minuto que está errado.

**Decisão:** `validarDia` passa a devolver `{ nivel, texto, ini, fim }`, com o
intervalo em minutos do trecho problemático:

| Problema | Intervalo devolvido |
|---|---|
| Mais de 6h contínuas | os minutos que passam das 6h dentro do trecho unido |
| Mais de 8h no dia | os minutos que passam das 8h, contados do fim para trás |
| Sobreposição | a interseção dos dois blocos |

A grade desenha uma hachura vermelha exatamente sobre esse intervalo. O texto
continua existindo, como `title` e na lista de avisos - mas quem olha vê **onde**
antes de ler **o quê**.

Isto é mudança no model, e é onde ela deve estar: o model é dono do domínio, e
"qual pedaço da jornada viola a regra" é conhecimento de domínio, não de
desenho.

### D8 - Erro barra, aviso marca

Reclassificação, decidida pelo André em 27/08/2026:

| Regra | Antes | Agora |
|---|---|---|
| Blocos sobrepostos do mesmo servidor | erro (barra) | **erro (barra)** |
| Mais de 8h no dia | erro (barra) | **aviso (marca)** |
| Mais de 6h contínuas | aviso | aviso (marca) |
| Lacuna de cobertura | aviso | aviso (marca) |

A sobreposição continua barrando porque descreve uma situação **impossível** - a
pessoa não pode estar em dois lugares. As demais descrevem situações
**indesejáveis mas às vezes necessárias**, e a SME legitimamente precisa
registrá-las. É a semântica que `.claude/rules/dados.md` já fixa; o que muda é a
classificação do limite de 8h, que estava do lado errado dela.

### D9 - Editor de jornada

A gaveta deixa de ser "um bloco" e passa a ser **a semana inteira** daquele
servidor naquela escola:

- abas **Normal / TDC A / TDC B**, que só chegam no Plano B-2. No B-1 a gaveta
  não tem aba nenhuma: todos os blocos são `normal` e uma barra de abas com um
  item só é ruído. Já no B-2, uma aba de escala aparece apenas se a rede tiver
  alguma data marcada com ela;
- os cinco dias, com todos os blocos de cada um listados, editáveis e
  removíveis ali mesmo;
- somatório por dia e da semana;
- **início e fim nascem vazios** - hoje vêm com `07:00`/`13:00` chumbados, o que
  induz a pessoa a aceitar um horário que não é o dela;
- sobreposição impede o salvamento; o resto marca.

### D10 - Gerador de TDC no Calendário

O módulo Calendário ganha um seletor **Rede / escola** e uma ação "Gerar TDC do
ano".

A geração propõe as 1ªs e 3ªs quartas letivas do ano, alternando `tdc-a` e
`tdc-b`, e apresenta o resultado numa **tabela de proposta**: cada linha tem a
data, a escala (trocável) e um botão de descartar. Grava apenas o que restou.

**Nunca grava direto.** A alternância é um chute razoável, não um fato: feriados,
recessos e decisões locais mudam a sequência, e só uma pessoa sabe qual. A
proposta economiza a digitação de ~20 datas; a decisão continua sendo humana.

Escolhida uma escola no seletor, a mesma tela mostra o calendário da rede com as
remarcações daquela unidade sobrepostas, e permite remarcar ou cancelar.

### D11 - Cartão Hoje na Dashboard

Um cartão que responde: **qual escala está valendo, quem cumpre qual jornada, e
quem está afastado.**

- **Campo de data**, abrindo em hoje. É ele que atende também "conferir uma data
  passada" sem exigir aba nova.
- Quem está afastado na data aparece **marcado com o tipo de afastamento**, via
  `getAfastamentos({ vigentesEm })`, que já existe.
- **A ausência não altera o cálculo da cobertura.** Decisão do André: a jornada
  cadastrada continua sendo a referência. Recalcular geraria alarme falso toda
  vez que um colega cobre informalmente o outro - o que, na prática, é o que
  acontece.

O cartão vive na Dashboard, que é módulo agregador: importar `horarios.model.js`
e `afastamentos.model.js` ali é o padrão que a arquitetura já autoriza
(acoplamento unidirecional, leitor puro).

## 4. Divisão em dois planos

A spec é grande demais para um plano só. Entregue de uma vez, tocaria calendário,
horários, dashboard e servidores ao mesmo tempo - e um defeito seria difícil de
localizar.

**Plano B-1 - Grade e edição.** D1, D3, D4, D5, D6, D7, D8, D9 (sem as abas de
escala). Entrega valor sozinho: é a tela que se olha todo dia, e não depende de
nenhuma decisão de calendário.

**Plano B-2 - Escalas e Hoje.** D2, D10, D11 e as abas de escala em D9.
Construído sobre o B-1 já validado em produção.

A migration 024 é escrita inteira no B-1 (é mais barato rodar uma vez), mas as
colunas de escala só passam a ser lidas no B-2. Colunas ociosas com `default` não
afetam nada; migration pela metade, sim.

## 5. Arquivos afetados

| Arquivo | Plano | Natureza |
|---|---|---|
| `supabase/migrations/024_horarios_escalas.sql` | B-1 | **novo** |
| `shared/ui/busca-selecao.js` | B-1 | **novo** |
| `modules/servidores/vinculos.model.js` | B-1 | `ehGestao`, CRUD de `cargo_gestao` |
| `modules/horarios/horarios.model.js` | B-1/B-2 | intervalos em `validarDia`; exibição; `escalaDoDia`, `jornadaEm` |
| `modules/horarios/views/por-escola.js` | B-1 | reescrita: grade única |
| `modules/horarios/views/jornada.js` | B-1 | **novo** - a gaveta da semana |
| `modules/horarios/views/bloco.js` | B-1 | **removido** - `jornada.js` o absorve |
| `modules/horarios/views/cargos.js` | B-1 | **novo** - gaveta de cargos de gestão |
| `modules/horarios/views/por-servidor.js` | B-1 | acompanha a nova barra |
| `modules/horarios/horarios.css` | B-1 | faixas, séries, hachura, legenda |
| `modules/usuarios/views/lista.js` | B-1 | select de servidor → busca |
| `modules/servidores/views/vinculo.js` | B-1 | select de escola → busca |
| `modules/calendario/calendario.model.js` | B-2 | escalas, override por unidade |
| `modules/calendario/calendario.view.js` | B-2 | seletor rede/escola, gerador |
| `modules/dashboard/dashboard.view.js` | B-2 | cartão Hoje |
| `styles/tokens.css` | B-1 | `--serie-1..6` |

## 6. Verificação

- `python .claude/scripts/verificar_arquitetura.py` sem novas violações;
  atenção especial a R4 (o import Horários → Servidores é novo).
- Migration idempotente: rodar duas vezes no SQL Editor sem erro.
- RLS conferida nas três tabelas novas; nenhuma policy para `anon`.
- Degradação sem a migration: a tela abre e avisa o que falta (`42P01`, `42703`).
- Escola sem nenhum bloco, escola só com gestores, escola com 8 servidores
  exibidos (cores repetem sem confundir).
- Data em que a escola remarcou o TDC, e data em que a escola o cancelou.
- Servidor com blocos em `tdc-a` e sem blocos em `tdc-b` (deve cair no `normal`).
- Tela estreita: legenda arrastável no toque, grade rolando na horizontal sem o
  corpo da página rolar junto.
- Nenhum dado real em fixture, comentário ou exemplo.

## 7. Fora de escopo

- **Sábado letivo e escala de recesso/plantão.** `horario_bloco.dia_semana` só
  aceita 1-5; ampliar é mudança de modelo com efeito em toda a validação. O
  mecanismo de escalas comporta isso quando houver demanda - não hoje.
- **Recalcular cobertura a partir de afastamentos** (decisão explícita, D11).
- Substituição a partir de afastamento (quem cobre quem).
- Registro de jornada efetivamente cumprida - o módulo trata do **previsto**.
