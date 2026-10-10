# Notificações do SATE - avisos que ficam até serem abertos

Data: 10/10/2026 · Versões-alvo: FundHub **0.44.0** · SATE **0.22.0** · Migration **048**

Quarto e último ciclo da rodada de 09/10/2026. Vem depois de
`2026-10-10-sate-solicitacao-reformulada-design.md`.

## Problema

1. **Quem faz a ação é avisado da própria ação.** Negar um pedido gera, para quem negou,
   um aviso de "Negado".
2. **O aviso só existe para quem está com a tela aberta.** Quem aprova e entra no
   sistema meia hora depois de um pedido chegar não fica sabendo dele pelo sino.
3. **Tudo avisa todo mundo.** Não há como escolher o que interessa, nem para quem
   aprova nem para a escola.
4. O sino se esvazia ao ser aberto, mesmo que a pessoa não tenha olhado pedido nenhum.

Decisões do André (09 e 10/10/2026):

- quem aprova é **sempre** avisado de pedido novo;
- os demais avisos são **configuráveis**;
- a escola tem os **seus próprios** avisos, também configuráveis;
- **o aviso só some quando a pessoa abre a notificação correspondente** - pelo sino ou
  abrindo a solicitação.

## O que muda de natureza

Hoje o aviso é um eco do Realtime: nasce no navegador de quem está online, a partir da
linha crua que mudou, e morre ao recarregar. Para "ficar até ser aberto" ele precisa
**existir no banco**, e para "não avisar quem fez" o banco precisa saber **quem fez**.

São duas coisas guardadas, e só duas:

| | O que é | Quem escreve |
|---|---|---|
| **Aviso** | "aconteceu X na solicitação Y, feito por Z, às T" - **um por fato**, não um por destinatário | só o banco, por gatilho |
| **Visto** | "esta pessoa abriu a solicitação Y às T" | a própria pessoa |

Não lido = aviso mais novo que o último "visto" daquela pessoa naquela solicitação.
Abrir a solicitação marca o visto, e isso limpa **todos** os avisos dela de uma vez - é
exatamente a regra pedida.

**Quem recebe não é gravado.** Recebe quem **pode ver** a solicitação (o RLS decide na
hora da leitura), menos quem fez. Não há lista de destinatários para manter, e mudar a
permissão de alguém vale no mesmo instante.

Alternativas descartadas:

- **Uma linha por destinatário** (caixa de entrada clássica). Exige descobrir, no
  gatilho, todo mundo que enxerga o pedido - a mesma regra que o RLS já sabe - e
  multiplica linhas por pessoa.
- **Deduzir o aviso do estado do pedido** (sem tabela de avisos). Funciona para mudança
  de situação, mas não para parada acrescentada ou pedido de saída, que não deixam
  rastro no cabeçalho.
- **Ler do registro de auditoria.** Ele tem tudo, mas é só de administrador, guarda a
  linha inteira (com telefone do responsável) e pode ser podado.

## Decisões de design

### D1 - Duas tabelas (migration 048)

```sql
solicitacao_aviso (
  id             bigint identity primary key,
  solicitacao_id uuid not null references solicitacao_transporte on delete cascade,
  tipo           text not null check (tipo in (…lista fechada, D2…)),
  unidade_id     uuid references unidade_escolar on delete set null,  -- a escola da parada
  autor          text,                                                -- auth_email() de quem fez
  em             timestamptz not null default now()
)

solicitacao_visto (
  email          text not null,
  solicitacao_id uuid not null references solicitacao_transporte on delete cascade,
  visto_em       timestamptz not null default now(),
  primary key (email, solicitacao_id)
)
```

**RLS:**

- `solicitacao_aviso` - `select` para quem enxerga a solicitação
  (`exists (select 1 from solicitacao_transporte s where s.id = solicitacao_id)`: a
  subconsulta passa pelo RLS da própria solicitação). **Sem policy de escrita**: só o
  gatilho insere, como no registro de auditoria. Ninguém forja aviso.
- `solicitacao_visto` - a pessoa lê e escreve **só as próprias linhas**
  (`email = auth_email()`).
- Nenhuma das duas concede nada a `anon`.

**Auditoria:** as duas entram em `_audit_isentas()`, com o motivo, e em
`ISENTAS_AUDITORIA` no verificador. Aviso é log de fato já auditado na origem; visto é
estado pessoal de leitura, ruído puro. A migration termina com
`select religar_auditoria();`.

**Realtime:** `solicitacao_aviso` entra na publicação `supabase_realtime`.

**Leitura do que está por ver:** é a função `avisos_por_ver(tipos)` do banco - devolve só
o que a pessoa quer (os `tipos` que o front monta a partir do nível e das preferências),
não fez e ainda não viu, dos últimos 60 dias, já com os dados da solicitação. A conta é do
banco porque quem aprova enxerga a rede inteira: ler "os N fatos mais recentes" e filtrar
no navegador deixaria cair, em silêncio, um aviso antigo ainda não aberto.

**Conteúdo:** o aviso guarda só tipo, ids e o e-mail de quem fez - o mesmo dado que a
solicitação já mostra em "decidido por". Nenhum texto livre, nenhum dado de terceiros.

### D2 - Os tipos de aviso, e quem os gera

Gatilhos `after insert or update` nas duas tabelas do pedido. O gatilho cobre **toda**
via de mudança, inclusive as funções do banco (criar viagem, decidir com frota).

| Tipo | Quando |
|---|---|
| `nova` | a solicitação foi criada |
| `em_analise` · `aguardando_transporte_adaptado` · `confirmado` · `negado` · `cancelado` · `pendente_cancelamento` | a situação mudou para essa |
| `reaberta` | voltou para análise vindo de confirmado, negado ou cancelado |
| `editada` | data ou horários mudaram, sem mudar a situação |
| `parada_acrescentada` | uma escola entrou numa viagem que já existia |
| `saida_pedida` | uma escola pediu para sair da viagem |
| `saida_confirmada` | a participação de uma escola foi cancelada |

- A primeira participação, criada junto com a viagem, **não** gera
  `parada_acrescentada`: o `nova` já diz. O gatilho reconhece pela marca de transação
  que `criar_viagem()` acende.
- O recálculo dos totais do cabeçalho (o cache que hoje gera aviso falso) **não** gera
  nada: o gatilho só olha situação, data e horários.
- Trocar o destino ao conferir um local não gera `editada`: para a escola, o lugar é o
  mesmo.
- **O aviso nunca impede a ação.** A inserção do aviso fica num bloco protegido: se
  falhar, a decisão é gravada do mesmo jeito e o banco registra um alerta.

### D3 - Quem é avisado de quê

Ninguém é avisado do que **ele mesmo** fez. Fora isso, três públicos:

**Quem aprova** (escrita no SATE):

| Aviso | Padrão | Configurável |
|---|---|---|
| **Nova solicitação** | ligado | **não** - sempre |
| **Pedidos das escolas** - pedido de cancelamento, pedido de saída de uma viagem | ligado | sim |
| **Ações de outros aprovadores** - análise, confirmação, negativa, cancelamento, reabertura, edição, paradas | desligado | sim |

**A escola** (vê só as próprias):

| Aviso | Padrão | Configurável |
|---|---|---|
| **Decisão do pedido** - confirmado, negado, cancelado | ligado | sim |
| **Andamento** - em análise, aguardando adaptado, reaberto, data ou horário alterado, pedido aberto pela Gerência em nome da escola, entrada e saída de escolas na viagem | ligado | sim |

**Equipe da SME com leitura** (vê a rede, não decide): os dois avisos da escola,
**desligados** por padrão - ela vê tudo, e tudo ligado seria ruído.

As escolhas são de cada pessoa (`preferencia_usuario`, que já existe) e aparecem no
painel de configuração do SATE, grupo **Notificações**. Cada público vê só os seus
itens: a declaração de configuração ganha `visivel: () => boolean`, três linhas no
painel genérico.

### D4 - O sino

- Ao entrar, o sino **carrega os avisos não lidos** dos últimos 60 dias - quem conta o
  que está por ver é o banco (`avisos_por_ver`), não o navegador. O número no sino é a
  contagem deles.
- **Abrir o sino não limpa nada.** Cada aviso é um link para a solicitação; clicar abre
  a ficha "Detalhes da solicitação", e é isso que marca como visto.
- **Abrir a solicitação pela lista** tem o mesmo efeito: o aviso some do sino.
- Aviso que chega com a tela aberta entra no topo da lista e mostra o balão de sempre.
- Vários avisos da mesma solicitação aparecem **juntos**, o mais recente em cima.
- No FundHub (`index.html`), o aviso do SATE abre o SATE na ficha daquela solicitação,
  em nova aba - como o item do menu.
- Na **lista de solicitações**, a linha com aviso não lido ganha um ponto de destaque
  ao lado da escola.

O texto do aviso: título = o que houve ("Nova solicitação", "Confirmado", "Pedido de
saída"); linha de apoio = escola · destino · data.

**Endereço direto para uma solicitação:** `sate.html#/solicitacoes?abrir=<id>`. A página
de solicitações abre a ficha ao carregar; se a solicitação está fora do período
filtrado, é buscada pelo id.

### D5 - No código

- `modules/sate/avisos.model.js` (novo, API pública): ler avisos e vistos, marcar visto,
  assinar o Realtime, e as funções **puras** - `publicoDe(nivel)`,
  `interessa(aviso, { email, publico, prefs })`, `tiposDeInteresse(publico, prefs)`,
  `descrever(aviso, nomes)`.
- `notificacoes.service.js`: a fonte SATE deixa de assinar duas tabelas e interpretar
  linha crua, e passa a consumir `avisos.model.js`. **Saem** os dois descritores do SATE
  e o filtro `ehRuidoDeTotais` com a sua janela de 4 segundos - o ruído que ele adivinhava
  deixa de existir, porque o gatilho só registra o que é fato.
- `views/solicitacoes.js`: lê `?abrir=`, marca o ponto de não lido.
- `views/detalhe.js`: marca visto ao abrir.
- `sate.config.js`: os itens do D3.
- `configuracoes/painel.js`: `visivel`.

### D6 - Sem a migration 048

`avisos.model.js` trata tabela ausente (`42P01`) como "sem avisos": o sino do SATE fica
vazio e nada quebra. **Entre publicar esta versão e rodar a 048, o SATE não avisa
ninguém** - o caminho antigo é removido, não mantido em paralelo. Duas formas de avisar
convivendo é o tipo de ramificação que esta rodada veio encerrar; a janela é curta e
está dita no CHANGELOG.

## Fora de escopo

- **Afastamentos e Ocorrências no sino** continuam como são: ao vivo, e somem ao
  recarregar. O mesmo desenho serve a eles, mas pede as suas próprias tabelas e gatilhos
  e não foi pedido. **Fica registrado como pendência de padrão**: o sino tem, por ora,
  dois comportamentos.
- **E-mail ou aviso fora do sistema.**
- **"Marcar todas como lidas".** Contraria a regra pedida (some ao abrir).
- **Limpeza por idade.** Um aviso tem cerca de cem bytes; milhares por ano não pesam. O
  sino lê só os últimos 60 dias. Se um dia pesar, entra na poda que a Auditoria já tem.
- **Histórico de avisos lidos.**

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/048_sate_avisos.sql` | novo |
| `.claude/scripts/verificar_arquitetura.py` | duas tabelas em `ISENTAS_AUDITORIA` |
| `src/modules/sate/avisos.model.js` | novo |
| `src/modules/sate/sate.model.js` | `listSolicitacoes` aceita o filtro por `id` |
| `src/modules/sate/sate.config.js` | itens de notificação |
| `src/modules/sate/views/solicitacoes.js`, `detalhe.js` | D4 |
| `src/modules/notificacoes/notificacoes.service.js`, `notificacoes.css` | D4, D5 |
| `src/modules/configuracoes/painel.js` | `visivel` |
| `src/main.js`, `src/sate.js` | o que cada entrada passa ao serviço |
| `tests/sate-avisos.test.mjs` | novo |
| `docs/modulos/sate.md`, `docs/modulos/configuracoes.md` | tutorial |
| `CHANGELOG.md`, `src/core/config.js` | versões |

## Verificação

- **Testes:** `publicoDe`; `interessa` para cada público × tipo × preferência, e o autor
  nunca recebe; `tiposDeInteresse` (os tipos que cada público recebe, com e sem preferências); `descrever`.
- **Banco** (roteiro no fim da migration, para o SQL Editor): criar, negar, reabrir e
  editar um pedido de teste e conferir as linhas de `solicitacao_aviso`.
- **Navegador, dev-local**, com avisos de fixture: contagem no sino; abrir o sino não
  zera; clicar no aviso abre a ficha e ele some; abrir pela lista também; ponto na
  linha; painel de notificações de cada público.
- `python .claude/scripts/verificar_arquitetura.py` sem bloqueio (checagem 13 concorda
  com `_audit_isentas()`).
