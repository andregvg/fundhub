# FundHub - SATE: frota cadastrada à vista e disponibilidade por horário

> 26/09/2026. Entrega como MINOR (0.37.0): migration `042`.
>
> Revisa: `2026-09-08-sate-modelo-de-dados-design.md` § D1 (uma frota em
> aberto por tipo), § D4 (saldo do dia) e § D6 (regras de agendamento);
> `2026-09-08-sate-solicitacoes-design.md` § D5 (cadastro da frota na
> engrenagem).

## O problema

1. **A frota cadastrada não se encontra.** O cadastro mora num painel das
   Configurações, e a página Frota mostra só o saldo de um dia. Não há uma
   tela que liste o que existe, o que vale e o que já expirou.
2. **Uma frota em aberto por tipo** impede que frotas de origens diferentes
   (contratos, parcerias) coexistam sem data de fim.
3. **Dá para pedir viagem sem frota nenhuma.** Quem aprova monta pedido num
   dia sem veículo cadastrado, e a "frota" só nasce como extra na
   confirmação.
4. **O saldo ignora o horário.** A escola vê "9 livres à tarde" mesmo que 6
   ônibus da manhã só voltem às 14h. A regra do intervalo era aviso.
5. **A noite não reserva a manhã seguinte.** A regra exige ônibus livre na
   manhã seguinte ao pedir, mas não o ocupa - outra escola pode pegá-lo
   depois.
6. **A barreira da escola só existe na tela** (R15), e dois pedidos
   simultâneos podem levar o mesmo último ônibus: `solicitado` não reserva.

## D1 - Uma frota em aberto por RÓTULO e tipo

O índice único parcial passa de `(tipo) where fim is null` para
`(rotulo_id, tipo) where fim is null`. Frotas com rótulos diferentes
coexistem abertas e **somam**.

`abrir_frota()` passa a encerrar, na véspera, só a aberta **do mesmo rótulo
e tipo**. "A partir de março, a Regular tem 12" continua sendo um gesto; a
frota "Contrato B" não é tocada.

Frota com fim continua sendo um lote que soma. Nada muda para a frota extra
nascida de pedido (`solicitacao_id`).

## D2 - Página Frota = o cadastro

Só quem escreve no SATE (`aprovador`). Substitui a página de hoje (saldo de
um dia), que migra para Disponibilidade (D3).

- **Pendência no topo:** "Frota extra sem pedido", como hoje.
- **Painel de filtros** (`.painel-filtros`):
  - Situação - chips **Vigentes** (padrão) · Futuras · Encerradas · Todas;
  - Tipo - Ônibus · Van adaptada · Todos;
  - Período - "Vigente entre" `de` e `até` (frotas que valem em algum dia do
    intervalo). Vazio = sem recorte.
- **Tabela** (`shared/ui/tabela.js`, R18 - as linhas se comparam):
  Rótulo · Tipo · Veículos · Início · Fim (ou "em aberto") · Situação
  (chip) · Origem ("Cadastro" ou "Extra de pedido"). Ações: **Editar**,
  **Excluir**.
- **Toolbar:** **Nova frota** e **Rótulos**.

Situação, sempre relativa a hoje (`hojeISO()`, data civil - R8):
`futura` = início > hoje; `encerrada` = fim < hoje; senão `vigente`.
Função pura em `frota.model.js`.

**Nova frota / Editar** - um modal só (`medio`), `.esc-form`:
Rótulo (select + "+ Novo rótulo…") · Tipo · Veículos · Início · Fim
(opcional; vazio = em aberto) · Observação.
- Nova, sem fim → `abrir_frota()` (encerra a anterior do mesmo rótulo).
  Nova, com fim → insert de lote.
- Editar grava direto na linha. Se houver outra aberta do mesmo rótulo e
  tipo, o banco recusa (índice único) e a tela explica: "Já existe uma
  frota em aberto com este rótulo. Encerre-a ou use outro rótulo."
- Aviso (não erro), ao reduzir veículos ou encurtar a vigência de uma
  frota que cobre dias com viagens: "Dias já agendados podem ficar sem
  veículo - confira a Disponibilidade."

**Excluir** pede confirmação (`confirmar.js`, perigo): "Os veículos deixam
de contar nos dias que esta frota cobria."

**Rótulos** - modal com a lista (arquivar / reativar / excluir) e criar,
o mesmo conteúdo que hoje está no painel.

O item "Frota disponível" **sai de Configurações** do SATE, e
`views/frota-painel.js` é apagado. As Configurações ficam com cor e
números de regra.

## D3 - Página Disponibilidade (todos)

Nova página, no menu entre Solicitações e Fichas. Uma **semana por vez**
(segunda a domingo), setas para navegar e um campo de data para saltar.

Para cada dia, três linhas - Manhã, Tarde, Noite - com os **ônibus livres**
e, se houver van cadastrada, as **vans livres**:

- **Manhã:** livres para uma viagem típica da manhã (07:00-12:00).
- **Tarde:** livres **por horário de embarque** - a quantidade só cresce ao
  longo da tarde, conforme os ônibus da manhã são liberados. Mostra a
  escada: "2 livres · 5 a partir das 14h10 · 9 a partir das 15h30". Cada
  degrau é o fim de uma ocupação da manhã (D5).
- **Noite:** livres para uma viagem da noite (19:00 até o meio-dia
  seguinte).
- Dia sem frota: "sem frota". Dia passado: esmaecido.

A conta é a de D5, com um pedido hipotético no intervalo típico do período.
Rodapé da página: *"Os números são para uma viagem típica de cada período.
O formulário de pedido confere o horário exato."*

**A escola vê só números** (R6, e a mesma promessa da `036`: nunca de quem
é a reserva). **Quem aprova** vê também, ao clicar no dia, a composição da
frota por rótulo ("9 Regular + 16 Feira do Livro") e quantos veículos
estão em uso em cada período.

## D4 - Sem frota, sem viagem

- **Sistema sem frota nenhuma** (nenhuma linha em `frota`): em
  Solicitações, "Nova solicitação" de quem aprova abre um aviso -
  "Antes da primeira viagem, cadastre a frota" - com **Cadastrar frota**,
  que leva à página Frota. A escola vê o botão normalmente; o formulário
  dirá que não há ônibus.
- **Data sem frota de ônibus** (total do dia = 0), no formulário:
  - quem aprova: "Não há frota cadastrada para DD/MM." e, **ali mesmo, na
    linha do saldo**, um cadastro rápido: Rótulo · Veículos · Até (padrão:
    a própria data) · **Cadastrar frota**. Cria um lote de ônibus de DD/MM
    até a data escolhida; o saldo se recalcula e o envio libera. Enviar fica
    desabilitado enquanto o dia não tiver frota. Link "cadastro completo na
    página Frota" para frota em aberto.

    *Por que na linha, e não num modal por cima:* o modal do hub é um só
    (`modal.js` troca o conteúdo), e voltar ao pedido o reconstruiria vazio
    - a pessoa perderia tudo o que preencheu. E é lote, não frota em
    aberto: abrir uma frota aqui poderia substituir uma aberta do mesmo
    rótulo que começa depois (`abrir_frota` substitui as que começam no
    mesmo dia ou depois).
  - escola: "Não há ônibus disponíveis nesta data." (erro, bloqueia).
- **Acima do limite** (há frota, mas não cabe): para quem aprova continua
  aviso, e a frota extra com rótulo nasce na confirmação (`040`), ligada ao
  pedido. É o "vincular a viagem a uma frota" - a viagem nunca fica sem a
  frota que a cobre.

## D5 - Ocupação por horário (a regra única)

> Cada viagem ocupa os seus veículos do **embarque** até a **liberação** =
> retorno + tempo de viagem + intervalo mínimo. A viagem da **noite** ocupa
> até o **meio-dia do dia seguinte**. Um veículo está livre para um pedido
> se não estiver ocupado em nenhum momento do intervalo que o pedido vai
> usar.

Formalmente, para um pedido no intervalo `[a, b]`:

```
livres = min sobre t em [a, b] de ( frota_do_dia(t) - ocupados(t) )
```

`ocupados(t)` = soma dos veículos das viagens cujo intervalo contém `t`.
Intervalos são **semiabertos** `[início, fim)`: um ônibus liberado às 14:10
serve um embarque às 14:10.
Como os intervalos formam um grafo de intervalos (perfeito), "cabe" pela
conta acima **é** "existe uma distribuição de veículos que atende todas as
viagens" - a conta não é aproximação.

Basta avaliar `t` em `a` e em cada início de ocupação dentro de `(a, b]` -
são os únicos pontos em que `ocupados` sobe - e nas viradas de dia dentro
do intervalo, onde a frota do dia pode mudar.

**O intervalo de uma viagem:**

| | início | fim |
|---|---|---|
| manhã / tarde | menor horário de embarque (cabeçalho e participações ativas) | retorno + `trajeto_min` (0 se nulo) + intervalo mínimo |
| noite | idem | 12:00 do dia seguinte (ou a liberação, se for maior) |
| sem horário (pedido antigo) | início da janela do período | fim da janela do período |

Janelas dos períodos: manhã 00:00-12:00 · tarde 12:00-18:00 · noite
18:00-12:00 do dia seguinte. O intervalo mínimo vem de
`config_modulo('sate', 'intervalo_min_periodos')`, padrão 120.

**O que a regra substitui:** as regras (a) e (b) de hoje
(`intervaloEntreViagens`, `noiteViavel`) e a conta "por período" do
`saldo_transporte`. As duas regras do tutorial continuam verdadeiras - são
consequências da única:

- ônibus da manhã só serve à tarde depois de voltar + intervalo;
- a noite precisa de veículo livre na saída **e ocupa a manhã seguinte** -
  agora de verdade, e não só como checagem no momento do pedido.

Vans adaptadas seguem a mesma conta, com a frota de vans.

## D6 - Quem ocupa vaga: `solicitado` também

`STATUS_RESERVA` = `solicitado`, `em_analise`,
`aguardando_transporte_adaptado`, `confirmado`. O pedido da escola reserva
no instante em que nasce; negar ou cancelar devolve. `pendente_cancelamento`
continua sem reservar (a vaga volta no pedido, não na ciência).

Consequência: em `faltaParaConfirmar`, todo pedido nessas situações já está
no uso do dia - a conta passa a excluir o próprio pedido (D7,
`p_excluir`) em vez do parâmetro `jaReservado`.

## D7 - A conta mora no banco

Migration `042`:

**`ocupacao_transporte(p_de date, p_ate date, p_excluir uuid default null)`**
→ jsonb. `security definer`, `pode_ver('sate')`. Devolve, para os dias de
`p_de - 1` a `p_ate + 1`:

```json
{ "intervalo_min": 120,
  "frota":  [{ "data": "2026-10-05", "onibus": 9, "vans": 1 }],
  "ocupacoes": [{ "data": "2026-10-05", "ini": 450, "fim": 870, "onibus": 2, "vans": 0 }] }
```

`ini`/`fim` em minutos a partir de 00:00 de `data` (`fim` passa de 1440 na
noite). **Anônimo:** nem id, nem escola, nem destino - só quando e quanto.
É a mesma promessa do `saldo_transporte`, com horário a mais; horário sem
dono não identifica ninguém.

A conta de D5 é feita **em JavaScript**, em `disponibilidade.model.js`
(novo, função pura, testável com `node`), para o formulário, a página e as
decisões de quem aprova.

**`vagas_transporte(p_data date, p_ini int, p_fim int, p_excluir uuid)`**
→ `{ onibus, vans }`. A mesma conta em SQL - é a barreira (R15).

**`criar_viagem()`** ganha, **só para quem não escreve no SATE**:
1. `pg_advisory_xact_lock` pela data - dois pedidos do mesmo dia entram em
   fila; o segundo já enxerga o primeiro.
2. horário de embarque e de retorno obrigatórios (erro `23502`);
3. `qtd_onibus` e `qtd_vans` **recalculados** a partir dos estudantes,
   cadeirantes e capacidades configuradas - o número enviado pela tela não
   vale;
4. `vagas_transporte(...)` para o intervalo do pedido; se faltar ônibus,
   `raise` com errcode `P0001` e mensagem em português ("Não há ônibus
   livres para este horário. Escolha outro horário ou outra data."). Falta
   de **van** não barra (regra de sempre: aviso, a Gerência providencia).

Duas implementações da mesma conta (JS para mostrar, SQL para barrar) é
o que a R15 pede. Para não divergirem, a spec fixa a **tabela de casos** abaixo;
o teste do JS a roda e a migration a reproduz como consulta de conferência
no comentário.

| Caso | Frota | Ocupações | Pedido | Livres |
|---|---|---|---|---|
| vazio | 9 | - | 13:00-17:00 | 9 |
| manhã volta tarde | 9 | 6 ôn. 07:00-14:10 | 13:00-17:00 | 3 |
| manhã já voltou | 9 | 6 ôn. 07:00-14:10 | 14:10-17:00 | 9 |
| degrau | 9 | 6 ôn. 07:00-14:10; 2 ôn. 15:00-19:00 | 14:30-18:00 | 7 |
| noite ocupa manhã seguinte | 9 (D e D+1) | 3 ôn. D 19:00-D+1 12:00 | D+1 08:00-11:00 | 6 |
| frota muda à meia-noite | 9 em D, 4 em D+1 | - | D 19:00-D+1 12:00 | 4 |
| próprio pedido excluído | 9 | 9 ôn. (o próprio) 08:00-12:00 | 08:00-12:00, excluindo-o | 9 |

Tolerância a migration ausente: sem `ocupacao_transporte`, o model cai no
`saldo_transporte` de hoje (por período) e marca o resultado como
`aproximado`; a tela avisa "contagem sem horário". Sem `042`, a escola não
é barrada no banco - como hoje.

## D8 - O formulário

- Horário de embarque e de retorno passam a **obrigatórios**.
- A linha de saldo diz: "**3** ônibus livres para embarque às 13:00 em
  05/10 · este pedido usa **2**". Se o horário ainda não foi preenchido, mostra o
  número da página Disponibilidade para o período.
- Erros (escola) e avisos (quem aprova) vêm de `avaliarPedido`, agora com
  `livres` do intervalo do pedido, e não mais por período. Somem os códigos
  `intervalo`, `noite_sem_dia` e `noite_sem_seguinte`; entra `sem_frota_dia`
  (D4).
- Quando falta, a escola vê o **próximo horário** em que cabe, se houver
  no mesmo período: "A partir das 14h10 há ônibus suficientes."

## D9 - Decidir e remanejar

`detalhe.js` (Confirmar) e `remanejar.js` passam a pedir a falta pela
conta de D5 com `p_excluir` = o próprio pedido. O modal de frota extra
(`frota-extra.js`) não muda.

A frota extra de um pedido da **noite** passa a valer da data até o dia
seguinte (`decidir_com_frota` na `042`): a viagem ocupa a manhã seguinte
(D5), e um lote só da data deixaria faltando lá.

## Limpeza para começar do zero

`_private/limpar_sate.sql` (gitignored): apaga `frota`,
`solicitacao_participacao`, `solicitacao_transporte` e `trecho` dos
pedidos; mantém `frota_rotulo`, `atividade_extraclasse` e `local`. Uma
transação, com contagem antes e depois. Rodar no SQL Editor **depois** da
`042`. Fica registrado no `audit_log` (é DELETE em tabela auditada) -
recuperável se preciso.

## Arquivos

| Arquivo | O quê |
|---|---|
| `supabase/migrations/042_sate_frota_e_disponibilidade.sql` | índice por rótulo, `abrir_frota`, `ocupacao_transporte`, `vagas_transporte`, `criar_viagem` |
| `sate/disponibilidade.model.js` (novo) | intervalo de uma viagem, `livresPara`, escada da tarde, leitura por RPC com degradação |
| `sate/saldo.model.js` | **apagado**: `faltaParaConfirmar` e a degradação para `saldo_transporte` passam a `disponibilidade.model.js` - um caminho só |
| `sate/frota.model.js` | `situacaoDaFrota`, `editarFrota`, `existeFrota`, `abrirFrota` por rótulo |
| `sate/regras.model.js` | `avaliarPedido` recebe `livres` do intervalo; sai `intervaloEntreViagens`/`noiteViavel` |
| `sate/sate.model.js` | `STATUS_RESERVA` com `solicitado` |
| `sate/views/frota.js` | reescrita: cadastro (D2) |
| `sate/views/frota-form.js` (novo) | modal Nova/Editar frota + modal Rótulos |
| `sate/views/disponibilidade.js` (novo) | página D3 |
| `sate/views/frota-painel.js` | apagado |
| `sate/sate.config.js` | sai o item de frota |
| `sate/views/formulario.js`, `detalhe.js`, `remanejar.js`, `solicitacoes.js` | D4, D8, D9 |
| `docs/modulos/sate.md` | regras, páginas e passo a passo |

## Verificação

- `node` sobre `disponibilidade.model.js` com a tabela de casos.
- Conferência SQL da `042` com os mesmos casos.
- Dev-local com fixtures: página Frota filtra; Disponibilidade mostra a
  escada; formulário de escola bloqueia às 13:00 e libera às 14:10.
- Tela estreita: tabela de frota recolhe colunas; semana da
  Disponibilidade vira lista de dias.
