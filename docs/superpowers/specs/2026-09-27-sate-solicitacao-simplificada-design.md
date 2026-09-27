# SATE - solicitação simplificada, destino por local e locais com mapa

Data: 27/09/2026 · Versões-alvo: FundHub **0.38.0** · SATE **0.17.0**

## Problema

O modal "Nova solicitação" ficou complicado demais para a escola: dois modos
(catálogo × outra atividade), três campos de destino redundantes (nome da
atividade, destino, nome do destino), período informado à mão além dos
horários, e um "Contato do professor(a)" em texto livre. Ao mesmo tempo, a
SME se preocupa com endereços incompletos ou escritos cada um de um jeito.

Postura combinada: **começar a usar e aprimorar com o uso**. O desenho abaixo
é o mínimo que resolve, não a versão final.

## Decisões

### D1 - Catálogo sai do modal (só do modal)

O pedido passa a ser sempre **local livre**. A página Catálogo e a tabela
`atividade_extraclasse` ficam como estão, para evoluir depois. `atividade_id`
continua na tabela e simplesmente não é mais preenchido pelo formulário.

### D2 - O modal, na ordem nova

| Grupo | Campos |
|---|---|
| ORIGEM | Escola (primeiro campo) · Turma(s) · Nº de estudantes |
| DESTINO | Local (busca nos locais cadastrados) · Endereço · Número · Bairro |
| QUANDO | Data · Horário de embarque · Horário de retorno · *período calculado, só leitura* |
| RESPONSÁVEL PELA VISITA | Professor(a) responsável · Telefone/WhatsApp |
| ACESSIBILIDADE | Nº de cadeirantes · Nº de estudantes surdos · ☐ Outra necessidade específica (descreva nas observações) |
| OBSERVAÇÕES DA ESCOLA | texto livre |

Trajeto e saldo de ônibus continuam ao pé, como hoje.

**Destino.** O campo Local é uma busca com sugestões (`shared/ui/busca-selecao.js`
se servir; senão, `<datalist>`). Escolheu um local cadastrado: Endereço,
Número e Bairro aparecem preenchidos e **só leitura**, e o pedido grava
`local_id`. Não achou: o link "Local não está na lista" libera Nome, Endereço,
Número e Bairro - **os quatro obrigatórios** - e o pedido vai sem `local_id`,
o que o marca como **local a conferir** (D6).

**Responsável e telefone obrigatórios**, como no agendamentos-fil. O telefone
usa a máscara/normalização que o hub já tem para telefone (E.164 no banco).

### D3 - Endereço em três partes e uma função que junta

Campos **Endereço**, **Número** e **Bairro** - em `local` e no destino do pedido.
A coluna `endereco` existente **não muda de nome**: passa a guardar só a rua.
Registros antigos têm o endereço inteiro nela e número/bairro vazios.

`enderecoCompleto({ endereco, numero, bairro })` em `locais.model.js` (API
pública) monta a linha única - `Rua X, 123 - Bairro`, omitindo o que faltar.
Com número e bairro vazios devolve `endereco` intacto, então o dado antigo sai
exatamente como hoje. **Toda exibição e todo uso da linha única passam por
ela**: ficha de ônibus, card e ficha da solicitação, página Locais,
geocodificação e link do mapa. Nenhuma migração de dado.

### D4 - Período calculado

A escola não informa período. Ele é **derivado dos horários**:

| Embarque | Retorno | Período |
|---|---|---|
| antes das 12h | até 12h | `manha` |
| antes das 12h | depois das 12h | `integral` - "Manhã e tarde" |
| 12h a 18h | qualquer | `tarde` |
| a partir das 18h | qualquer (inclusive após meia-noite) | `noite` |

`integral` é valor novo: CHECK de `solicitacao_transporte.periodo` ampliado;
janela `[0, 1080)` em `_sate_intervalo` (SQL) e em `JANELA`/`TIPICO`
(`disponibilidade.model.js`, espelho); rótulo "Manhã e tarde" nos dois
`PERIODOS`. A contagem de vagas já é por intervalo de horário, então um
pedido `integral` ocupa o ônibus de fato nos dois períodos.

**O banco deriva, o front espelha** (R15): `criar_viagem()` calcula o período a
partir dos horários e ignora o que vier no JSON. A função pura
`periodoDe(embarque, retorno)` fica em `regras.model.js` e é o espelho
usado pelo modal para exibir e para o saldo ao vivo.

### D5 - Acessibilidade na participação

`qtd_surdo int not null default 0` e `necessidade_especifica boolean not null
default false` em `solicitacao_participacao`, ao lado de `qtd_cadeirante` -
cada escola da viagem tem os seus. Surdo **não** muda veículo (só cadeirante
gera van); o dado vai para a ficha da solicitação e para a ficha de ônibus.

### D6 - Local a conferir

Pedido com `destino_nome` e sem `local_id` = **local a conferir**. Não há
coluna de estado: o fato é derivado, então não dessincroniza.

- **Ficha da empresa não é afetada**: imprime o destino gravado no pedido
  (nome + `enderecoCompleto`), que a escola digitou em partes obrigatórias.
- **Cálculo de vaga é o risco**: sem coordenada não há tempo de viagem, e o
  ônibus contaria como livre no próprio horário de retorno. Enquanto o local
  não é conferido, vale um **tempo de viagem provisório** cauteloso -
  configuração `trajeto_provisorio_min` do SATE, padrão **60** - aplicado no
  banco (`criar_viagem` e `ocupacao_transporte`: `coalesce(trajeto_min,
  provisório)` quando não há `local_id`) e no espelho do front. O erro vai para
  o lado seguro: a vaga fica superestimada até a conferência.
- **Confirmar com local a conferir é aviso, não erro.**

**Conferir local** (botão na ficha da solicitação, para quem escreve no SATE):
lista os locais cadastrados parecidos (nome semelhante ou mesmo bairro) com
**"É este"**, e **"Cadastrar novo"**, que abre o modal de local preenchido com
o que a escola digitou. Nos dois casos o pedido passa a apontar para o local
(`local_id`), `destino_nome`/`endereco`/`numero`/`bairro` passam a ser os do
cadastro, o trajeto é recalculado. Data, horários, escolas, estudantes e
veículos **não mudam**. O texto original da escola fica no `audit_log`.

A guarda `fn_sate_guarda_escola` já permite isso a quem tem `pode_escrever('sate')`.

### D7 - Página Locais completa, com mapa

A página Locais do SATE ganha o **modal padrão** do hub (`shared/ui/modal.js`,
`largo`) no lugar do formulário com "← Voltar", e passa a respeitar o nível do
módulo (`ctx`) em vez de `isAdmin`. Campos: Nome · Endereço · Número · Bairro ·
Ponto de desembarque · Latitude · Longitude · mapa · Observação · Ativo.

**Mapa Leaflet com pino arrastável**, como no "Editar local" do
agendamentos-fil: clicar no mapa ou arrastar o pino preenche latitude e
longitude; "Localizar pelo endereço" (Nominatim, já existente) move o pino;
link "Abrir no Google Maps".

**Leaflet é a segunda exceção nomeada à regra "sem dependência nova"**
(registrar no `CLAUDE.md` ao lado de `versao.json`): versão fixa, do
`cdn.jsdelivr.net`, com SRI, **carregada só quando o modal do local abre** -
nenhuma outra tela paga por ela. Falhou o carregamento: o mapa some e ficam os
campos de coordenada e o "Localizar pelo endereço". Degrada, não quebra.

### D8 - Responsável pela visita

`professor_nome text` e `professor_telefone text` em `solicitacao_transporte`.
`contato_professor` fica para os pedidos antigos: as telas mostram os campos
novos e caem no antigo quando eles estão vazios.

## Banco - migration `044_sate_solicitacao_simplificada.sql`

Idempotente, termina com `select religar_auditoria();`.

- `solicitacao_transporte`: `destino_numero`, `destino_bairro`,
  `professor_nome`, `professor_telefone`; CHECK de `periodo` com `integral`.
- `solicitacao_participacao`: `qtd_surdo`, `necessidade_especifica`.
- `local`: `numero`, `bairro`.
- `_sate_intervalo`: janela de `integral`.
- `_sate_periodo(emb int, ret int)`: a regra de D4.
- `criar_viagem`: deriva o período; aplica o trajeto provisório.
- `ocupacao_transporte`: aplica o trajeto provisório a pedido sem `local_id`
  e sem `trajeto_min`.
- `fn_sate_guarda_escola`: incluir `destino_numero`, `destino_bairro` na tupla
  que a escola não altera.

Pré-requisito: 042 e 043 aplicadas. Degradação (R15/dados.md): coluna ausente
(`42703`) no envio → mensagem pedindo a atualização do banco, sem quebrar a
tela.

## Fora de escopo (por ora)

Mesclar dois locais já cadastrados; endereço estruturado nas escolas;
reescrever o catálogo; período de pedido que atravessa tarde → noite
(conta certo pelo horário, rotula como `tarde`).

## Entrega

Tutorial `docs/modulos/sate.md` atualizado no mesmo commit (checagem 11).
CHANGELOG 0.38.0 com "SATE 0.17.0" e linha na tabela de versões do SATE.
Testar em dev-local, inclusive em tela estreita.
