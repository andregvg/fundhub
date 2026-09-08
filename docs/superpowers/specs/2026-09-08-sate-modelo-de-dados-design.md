# FundHub - SATE: o modelo de dados v2

> Decisões tomadas em 08/09/2026. **Bloco S2** da reestruturação do SATE.
> Entrega como MINOR: migration `035`, models novos, nenhuma tela.
>
> Herda as decisões registradas em `2026-09-08-listas-e-modais-design.md`
> § 9, tomadas na conversa de brainstorming do dia 07/09. Elas não são
> re-discutidas aqui - são premissa.
>
> Não depende de S0/S0b (que são de tela) nem de S1 (a casca própria).
> **Destrava** S3 (solicitações) e S4 (logística).

## 1. O problema

O SATE de hoje é um protótipo de 1.032 linhas com três defeitos de
modelo, não de tela:

**A frota é lançada dia a dia.** `oferta_onibus(data, periodo, total)`
obriga a cadastrar cada dia do ano, um por um, e não sabe dizer "a partir
de março passamos a ter 12". Foi o que o André chamou de problemático.

**Um período é um balde separado.** O modelo trata manhã e tarde como
duas cotas independentes. Mas a frota real são **veículos**, e o mesmo
ônibus que sai de manhã volta e serve à tarde - que é justamente o que a
regra do intervalo mínimo governa. Com baldes por período, essa regra não
tem onde existir.

**Não há ciclo de vida.** `status` é `text` sem `check`, sem justificativa,
sem quem decidiu, sem quando. Negar e cancelar são a mesma coisa para o
banco, e a distinção entre elas é uma regra que o André pediu para
documentar.

Faltam ainda: mais de um ponto de embarque, van adaptada como recurso
próprio, e as duas regras de agendamento - todas coisas que o
`agendamentos-fil` já resolve em produção e que o SATE ainda não tem.

## 2. Escopo

**Entra:** `supabase/migrations/035_sate_v2.sql`; `frota.model.js` novo;
`sate.model.js` reescrito (saldo, ciclo de vida, regras); `sate.config.js`
novo; a atualização de `sate.model.js` onde `dashboard` e `viagens` o
consomem.

**Não entra:** tela (S3), cor e casca próprias (S1), geo e tempo de
viagem (S4), ficha de ônibus (S4), vínculo com projetos (futuro).

## 3. Decisões

### D1 - Frota é um lançamento de VEÍCULOS com vigência

```sql
frota(id, rotulo_id, tipo, quantidade, inicio, fim, observacao,
      solicitacao_id, criado_por, criado_em)
```

`fim` nulo = **em aberto**. É o coração do modelo:

| | Frota **aberta** (`fim is null`) | Frota **fechada** (`fim` preenchido) |
|---|---|---|
| O que é | a frota vigente | um lote com prazo |
| Exemplo | 9 ônibus desde 01/02 | Feira do Livro, +16, de 31/08 a 04/09 |
| Quantas por tipo | **exatamente uma** | quantas forem |
| Ao criar outra | **encerra a anterior** na véspera | coexiste e **soma** |

**A invariante é do banco, não do código:**

```sql
create unique index frota_uma_aberta on frota (tipo) where fim is null;
```

**"Uma só por tipo", e não "uma só" - é a única leitura viável.** A van
adaptada é um recurso separado (D3): com uma aberta no total, cadastrar a
frota de vans encerraria a de ônibus. Registro isso como interpretação da
regra dada, não como algo que foi dito.

**A sucessão é uma função, não duas chamadas.** `abrir_frota()` encerra a
aberta (`fim = novo.inicio - 1`) e insere a nova na mesma transação. Em
duas chamadas do PostgREST, um erro entre elas deixaria o dia sem frota
nenhuma; e o índice único acima rejeitaria a inserção antes de o código
conseguir fechar a anterior.

### D2 - O Cirem não se cadastra: ele nasce das aprovações

Os 40 dias do Cirem são espalhados pelo ano e mudam com frequência -
prevê-los é impossível, e foi o que o André disse. Eles nascem, um a um,
do mecanismo de exceção:

Quando um aprovador confirma uma solicitação que **estoura** a frota do
dia, o sistema cria uma frota de **um dia só** (`inicio = fim = a data`),
com o rótulo que ele escolher naquele momento, e com `solicitacao_id`
apontando para a solicitação que a originou. Nenhuma regra nova: um lote
de um dia já cai no lado direito da tabela do D1.

**Frota órfã permanece.** Se a solicitação for negada ou cancelada, a
frota extra **não some** - decisão do André. `solicitacao_id` continua
apontando para ela e a tela sinaliza a órfã, para o aprovador confirmar
ou remover. Some sozinha seria decidir por ele; e a vaga extra pode ser
justamente o que outra escola precisa naquele dia.

### D3 - `tipo` distingue ônibus de van adaptada

`tipo in ('onibus', 'van_adaptada')`, na própria linha de frota - não uma
coluna `vans_total` ao lado de `onibus_total`, como no `agendamentos-fil`.

Com `tipo`, um lote de evento pode trazer **só vans**, o saldo de
cadeirante consome um recurso próprio, e um terceiro tipo (micro-ônibus,
por exemplo) não pede coluna nova.

### D4 - A frota é do DIA; o período não é um balde

Esta é a mudança que sustenta as regras de agendamento.

`livre(data, periodo) = total_do_dia − comprometido(data, periodo)`, onde
`total_do_dia` é a soma de toda frota vigente naquela data. **Nove ônibus
atendem nove viagens de manhã e nove à tarde** - são dezoito viagens com
nove veículos, e é assim que a rede funciona hoje.

O que limita não é uma cota por período: é **o mesmo veículo não poder
estar em dois lugares**, o que a regra do intervalo mínimo (D6a) governa.

### D5 - Ciclo de vida com justificativa obrigatória

```sql
status in ('solicitado','em_analise','aguardando_transporte_adaptado',
           'confirmado','pendente_cancelamento','negado','cancelado')
```

Hoje `status` é `text` sem `check` nenhum. Passa a ter, mais três colunas:
`motivo`, `decidido_por`, `decidido_em`.

| Transição | Quem | Justificativa |
|---|---|---|
| solicitado → confirmado | só `escrita` em `sate` | não |
| solicitado → negado | só `escrita` em `sate` | **obrigatória** |
| solicitado → cancelado | a escola dona **ou** quem tem escrita | **obrigatória** |
| confirmado → pendente_cancelamento | a escola dona pede | **obrigatória** |
| pendente_cancelamento → cancelado | só `escrita` em `sate` confirma | não (herda o motivo) |

**Negar e cancelar não são a mesma coisa**, e a diferença vai para a
ajuda do módulo: negar é recusar um pedido que **nunca** valeu; cancelar
é desfazer algo que já estava de pé. Depois de confirmada, a escola não
cancela sozinha - ela **pede**, e a solicitação fica *pendente de
cancelamento* até alguém com escrita dar ciência. A vaga volta ao saldo
**no momento do pedido**, não no da ciência: é o que o `agendamentos-fil`
faz, e segurar a vaga por causa de uma formalidade desperdiça ônibus.

A obrigatoriedade é **CHECK no banco** (R15), não validação de tela:

```sql
check (status not in ('negado','cancelado','pendente_cancelamento')
       or (motivo is not null and length(trim(motivo)) > 0))
```

### D6 - As duas regras de agendamento moram no model

Regra de negócio é do domínio (`.claude/rules/arquitetura.md`), então
elas ficam em `sate.model.js` como **funções puras**, testáveis sem banco
e sem DOM.

**(a) Intervalo entre períodos.** Um ônibus que serviu de manhã só serve
à tarde se `(retorno_manhã + viagem_de_volta) + intervalo_mínimo <=
embarque_tarde`. O intervalo é configurável (`intervalo_min_periodos`,
padrão **120 min**) e vale para os agendamentos seguintes, não
retroativamente.

O tempo de viagem de volta é **parâmetro da função**, com padrão 0. S4
(geo) passa a fornecê-lo; até lá a regra roda com a parte que já se sabe,
em vez de não existir. É a diferença entre uma regra incompleta e uma
regra ausente.

**(b) Agendamento noturno.** Exige ônibus livre em **um dos períodos do
próprio dia** (manhã ou tarde) **e** no período da **manhã do dia
seguinte**:

```
noiteViavel(d) = (livre(d,'manha') >= 1 || livre(d,'tarde') >= 1)
                 && livre(d+1,'manha') >= 1
```

Ambas viram texto em `docs/modulos/sate.md`, em destaque, como o André
pediu - e toda regra de agendamento que vier depois entra lá também.

### D7 - Erro barra, aviso não

Aplicando a R15 ao SATE:

| Situação | | Porque |
|---|---|---|
| Estourar a frota do dia | **erro para a escola**, **aviso para quem aprova** | é o paradigma inviolável para a escola; quem aprova pode e às vezes precisa violá-lo, e aí nasce a frota extra (D2) |
| Violar o intervalo mínimo (D6a) | **aviso** | o retorno pode adiantar; quem aprova decide |
| Noturno sem a folga do dia seguinte (D6b) | **erro para a escola**, aviso para quem aprova | mesma lógica |
| Cadeirante sem van no saldo | **aviso**, e o status vai para *aguardando transporte adaptado* | é exatamente o que o `agendamentos-fil` faz |
| Antecedência mínima (5 dias) | **erro para a escola**, sem limite para quem aprova | já era assim |

### D8 - Mais de um ponto de embarque

```sql
solicitacao_embarque(id, solicitacao_id, ordem, unidade_id, local_id,
                     horario, qtd_alunos)
```

Guarda os pontos **além do primeiro**. A escola solicitante continua em
`solicitacao_transporte.unidade_id`, e é ela que define a posse e o
escopo do RLS - criar uma linha de embarque para ela também obrigaria a
um backfill e tornaria a posse ambígua.

Escrever aqui exige `escrita` em `sate`: juntar escolas num ônibus é
decisão de quem aprova, como o André definiu.

### A regra de visibilidade (revista em 08/09/2026, migration 036)

A formulação original - *"escolas só veem as solicitações que elas mesmas
fizeram"* - se chocava com o embarque múltiplo, e a redação do André a
substituiu por uma que não se choca com nada:

> **A escola vê os agendamentos em que ela está envolvida.**

Envolvida significa duas coisas, e a segunda é a que faltava:

- **É a escola do pedido** - tanto faz se ela mesma o abriu ou se alguém
  com escrita no SATE o abriu **por** ela. Quem digitou não é o critério;
  de quem é o agendamento, sim.
- **É um ponto de embarque** da viagem.

A regra nova é mais simples que a antiga *e* cobre mais casos. Como o
embarque múltiplo só pode ser montado por quem tem escrita, todas as
escolas de um mesmo ônibus enxergam o agendamento inteiro - inclusive as
outras paradas - por construção, e não por exceção. Elas dividem o
veículo; precisam saber a ordem das paradas.

**Ver não é agir.** Uma escola que é só ponto de embarque enxerga o
agendamento mas não o cancela nem o edita: isso continua sendo do dono
(`unidade_id`) e de quem tem escrita. Envolvimento governa visibilidade;
posse governa ação.

**O que essa revisão quebrou, e que ninguém tinha visto.** O saldo do dia
era somado no cliente, lendo `solicitacao_transporte` - e o RLS filtra
essa leitura. Uma escola somava só os próprios ônibus e via "9 de 9
livres" num dia lotado, na tela que existe exatamente para avisar que as
vagas acabaram. A conta passou a ser a função `saldo_transporte()`,
`security definer`, que devolve **só contagem**: nenhuma escola, nenhum
horário, nada que diga de quem é a reserva. Agregado não vaza - "3 de 9
livres em 15/10" é o que a escola precisa e não conta nada sobre
ninguém.

### D9 - Configuração do módulo

Quatro itens de rede em `sate.config.js`, no grupo "Regras e limites":

| Chave | Padrão | O que é |
|---|---|---|
| `intervalo_min_periodos` | 120 min | D6a |
| `capacidade_onibus` | 44 | lugares por ônibus; era constante em JS |
| `capacidade_van` | 2 | cadeirantes por van adaptada |
| `antecedencia_min_dias` | 5 | mínimo para a escola; quem aprova não tem |

O **cadastro da frota** também é configuração do SATE, mas o painel dele
é tela: nasce em S3, junto com o resto da interface. Aqui ficam só os
números.

A cor do SATE fica para **S1**, com a casca própria - é o lugar dela.

### D10 - `oferta_onibus` é migrada, não apagada

As linhas existentes viram frotas de um dia (`inicio = fim = data`), com
o rótulo "Migrado da oferta antiga" e a **maior** quantidade entre os
períodos daquele dia - o modelo velho tinha um número por período e o
novo tem um por dia; pegar o maior preserva a capacidade e nunca a
reduz.

**A tabela antiga não é dropada.** Ela sai do código, mas continua no
banco: apagar dado é irreversível e o custo de manter uma tabela morta é
zero. Se em seis meses ninguém sentiu falta, uma migration futura a
remove com calma.

## 4. RLS

| Tabela | Leitura | Escrita |
|---|---|---|
| `frota_rotulo` | `pode_ver('sate')` | `pode_escrever('sate')` |
| `frota` | `pode_ver('sate')` | `pode_escrever('sate')` |
| `solicitacao_transporte` | solicitante, ponto de embarque, ou `ve_tudo('sate')` | criar: `escreve_unidade('sate', unidade_id)` · decidir: `pode_escrever('sate')` |
| `solicitacao_embarque` | quem vê a solicitação-mãe | `pode_escrever('sate')` |

A policy de **update** da solicitação é a que carrega a regra: a escola
só altera enquanto o status é `solicitado` (e para `cancelado`); tudo o
mais exige `pode_escrever('sate')`.

Migration termina em `select religar_auditoria();` (checagem 13).

## 5. Degradação

Migration é aplicada à mão, então existe janela entre o deploy e o SQL.
Os models capturam `42P01` (tabela ausente) e `42703` (coluna ausente) e
seguem com estado vazio - `frota.model.js` devolve saldo zero e a tela
avisa que o cadastro de frota ainda não existe, em vez de quebrar.

## 6. Verificação

`python .claude/scripts/verificar_arquitetura.py`; as funções puras das
regras (D6) rodadas com `node` sobre casos montados à mão, sem banco;
migration relida procurando `if not exists` e `on conflict do nothing`
(ela precisa poder rodar duas vezes).
