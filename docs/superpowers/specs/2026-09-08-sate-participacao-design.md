# FundHub - SATE: a participação como unidade

> Decisões de 08/09/2026, na conversa com o André. **Bloco S5.**
> Entrega como MINOR: migration `037`, models e as telas do S3 falando
> de participações.
>
> Revisa o § D8 de `2026-09-08-sate-modelo-de-dados-design.md`, que
> tratava embarque múltiplo como apêndice. **Destrava** o S4b (geo), que
> passa a calcular rota sobre uma sequência de participações.

## 1. O problema

O modelo atual tem uma **escola dona** no cabeçalho da solicitação
(`unidade_id`, `qtd_alunos`) e as paradas a mais num apêndice
(`solicitacao_embarque`). Isso funciona para o caso de uma escola só, e
começa a mentir assim que há duas:

**Uma viagem com três escolas não é de uma delas.** Ela é das três. O
cabeçalho eleger uma como dona é uma escolha arbitrária que o dado não
justifica - e que faz a segunda e a terceira escola aparecerem como
anexo de um pedido alheio.

**Cancelar não tem granularidade.** Se uma das escolas desiste, hoje só
existe cancelar a viagem inteira. O que a rede precisa é a escola
cancelar **a própria participação**, com as outras seguindo. E, na
prática, o aprovador aproveita para **pôr outra escola no lugar** e
**reordenar** as paradas - decisões que exigem que cada escola seja uma
linha, não um campo.

**A regra de envolvimento é um `OR` na policy.** `ve_solicitacao`
pergunta "é a escola do cabeçalho **ou** é um embarque?". A pergunta
existe porque o modelo tem dois lugares para dizer a mesma coisa.

## 2. A decisão

```
viagem        data · período · destino · horários · nº de ônibus · status
participação  escola · ordem · alunos · cadeirantes · embarque · status · motivo
```

Uma escola pedindo sozinha cria uma viagem com **uma** participação. Uma
viagem montada pela Gerência tem N. **É a mesma estrutura** - o caso de
hoje passa a ser o caso particular, em vez de o modelo inteiro.

### D1 - `solicitacao_embarque` vira `solicitacao_participacao`

Não é tabela nova: é a mesma, renomeada e completada. Ela já tinha
`ordem`, `unidade_id`, `local_id`, `horario` e `qtd_alunos` - faltavam
`qtd_cadeirante`, `status`, `motivo` e o carimbo de quem decidiu.

O nome importa. "Embarque" descreve um ponto no mapa; "participação"
descreve **um vínculo com dono, cota e situação própria** - que é o que
a linha passou a ser.

### D2 - Envolvimento deixa de ser regra e vira estrutura

```sql
-- antes: é a escola do cabeçalho OU tem um embarque
-- agora: tem uma participação
when 'proprios' then exists (
  select 1 from solicitacao_participacao p
   where p.solicitacao_id = p_solicitacao
     and p.unidade_id in (select minhas_unidades()))
```

A regra que o André escreveu - *"a escola vê os agendamentos em que está
envolvida"* - deixa de ser uma condição a manter e passa a ser o que o
esquema **é**. Não há mais como as duas metades divergirem.

**Participação cancelada continua enxergando.** A escola que desistiu
precisa continuar vendo que o agendamento dela foi cancelado - a linha
fica, com `status = 'cancelada'` e o motivo. É por ela ficar que a
informação sobrevive; apagar seria tirar da escola o registro do que
aconteceu.

### D3 - O cabeçalho guarda quem ABRIU, não quem é dono

`unidade_id` **não é removida**, mas muda de significado e passa a ser
**nula** quando a Gerência monta a viagem:

| | Significado |
|---|---|
| antes | a escola dona da solicitação |
| agora | a escola que **abriu** o pedido, ou nulo se foi a Gerência |

Ela sobrevive por um motivo prático: a policy de `insert` precisa saber,
**no momento em que a linha nasce**, se quem escreve pode - e as
participações só existem depois. Sem esse campo, uma escola poderia
criar uma viagem vazia antes de qualquer verificação de escopo.

Posse, visibilidade e cancelamento **não olham mais para ela**.

### D4 - Ciclo de vida em dois níveis

A viagem tem o status que já tinha. A participação ganha o seu:

| Status da participação | O que é |
|---|---|
| `ativa` | conta para os ônibus, aparece na ficha |
| `pendente_cancelamento` | a escola pediu para sair; **já não conta** |
| `cancelada` | a saída foi confirmada; a linha fica só como registro |

Quem pede é a escola (`proprios`, e só na própria linha). Quem confirma
tem `escrita`. Justificativa obrigatória nos dois, por CHECK - a mesma
regra da viagem, no mesmo lugar em que a viagem a tem.

**A vaga volta ao saldo no PEDIDO**, não na confirmação - idêntico ao
que a viagem já faz, e pela mesma razão: segurar ônibus por causa de uma
formalidade desperdiça frota.

**Cancelar a última participação ativa não cancela a viagem
automaticamente.** Ela fica sem ninguém e o aprovador decide: pôr outra
escola no lugar - que é o caso real que o André descreveu - ou cancelar
a viagem. Cancelar sozinho tiraria dele exatamente a decisão que ele
toma nesse momento.

### D5 - `qtd_alunos` desce para a participação

Cada escola leva os seus. O total da viagem passa a ser a **soma das
participações ativas**, e é ele que alimenta o cálculo de ônibus.

`solicitacao_transporte.qtd_alunos` e `qtd_cadeirante` viram **colunas
derivadas, mantidas por trigger** - não porque duplicar seja bom, mas
porque `saldo_transporte()`, o Dashboard e o módulo Viagens somam por
viagem e não deveriam todos aprender a fazer join. A verdade é a
participação; o cabeçalho é o cache que o banco mantém sozinho.

**`qtd_onibus` NÃO desce.** O veículo serve a viagem, não a escola: três
escolas dividindo dois ônibus são dois ônibus, e reparti-los por
participação seria inventar um número que ninguém pediu.

### D6 - Ordem, e o que arrastar significa

`ordem` governa a sequência das paradas, incluindo a primeira. Só quem
tem `escrita` reordena - montar itinerário é decisão da Gerência, como
já era para acrescentar escola.

Reordenar muda a ficha de ônibus (a sequência que o motorista lê) e,
quando o S4b existir, a rota. Não muda horários: cada participação tem
o seu `horario_embarque`, informado, não derivado.

## 3. O que muda nas telas

| Tela | |
|---|---|
| **Solicitações** (tabela) | a coluna "Escola" passa a listar as participações ativas - uma, ou "N escolas" |
| **Nova solicitação** | cria viagem + 1 participação. A escola não vê diferença |
| **Detalhe** | lista as participações com ordem, alunos e situação; a escola vê "Pedir cancelamento da minha participação"; quem aprova acrescenta, remove, reordena e confirma saídas |
| **Fichas** | as origens saem das participações **ativas**, na ordem - uma cancelada não aparece na ficha |

## 4. Migração dos dados

A `037` cria uma participação para **cada** solicitação existente, a
partir do cabeçalho (`unidade_id`, `qtd_alunos`, `qtd_cadeirante`,
`horario_embarque`, ordem 1), e converte as linhas de
`solicitacao_embarque` que existirem em participações de ordem 2 em
diante. Idempotente: só cria o que ainda não existe.

## 5. Verificação

`verificar_arquitetura.py`; as funções puras (soma de participações
ativas, alocação de fichas com participação cancelada) rodadas com
`node`; dev-local a 380px e 1200px; migration relida procurando
`if not exists` e a chamada de `religar_auditoria()`.
