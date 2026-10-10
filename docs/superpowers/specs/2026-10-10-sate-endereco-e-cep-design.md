# Endereço e CEP - escolas, locais e destinos do SATE

Data: 10/10/2026 · Versões-alvo: FundHub **0.41.0** · SATE **0.19.0** · Migration **047**

Primeiro de quatro ciclos da rodada de 09/10/2026. Ordem: **este** →
`2026-10-10-sate-disponibilidade-calendario-design.md` →
`2026-10-10-sate-solicitacao-reformulada-design.md` → notificações (spec a escrever).

## Problema

1. **O mapa não acha endereços que existem.** "Localizar pelo endereço" volta vazio para
   ruas reais de Ribeirão Preto, e a pessoa fica sem saber o que fazer além de copiar
   coordenadas do Google Maps.
2. **O cadastro não guarda o CEP** - nem da escola, nem do local, nem do destino que a
   escola digita num pedido.
3. **"Conferir local" só existe dentro da aprovação.** Quem cuida do cadastro de Locais
   não tem como ver, ali, o que as escolas digitaram e ainda não virou local.

## O que foi medido (09/10/2026)

O endereço que motivou o pedido foi consultado direto nos serviços, com quatro grafias:

| Consulta ao OpenStreetMap (Nominatim) | Resultado |
|---|---|
| rua + "s/n" + bairro + cidade (o que o formulário envia hoje) | nada |
| rua + bairro + cidade | nada |
| **rua + cidade** (sem bairro, sem "s/n") | **acha a rua** |
| só o CEP + cidade | a cidade inteira (impreciso demais para guardar) |
| nome oficial dos Correios ("Rua **da** X") + cidade | nada - o OSM a registra como "Rua X" |

São **duas causas**, e nenhuma delas é a falta do CEP:

- **O formulário manda bairro e "s/n" junto.** O bairro do OSM nem sempre é o dos
  Correios, e um termo que não casa zera a busca. A localização **em lote** das escolas
  já contorna isso (`variantesDeEndereco`: tenta o endereço inteiro e depois o enxuto);
  os dois formulários não usam o mesmo caminho.
- **O nome oficial difere do nome no mapa.** Aqui só o CEP resolve - mas não pelo
  Nominatim.

Serviços de CEP testados com o mesmo endereço:

| Serviço | Endereço | Coordenada |
|---|---|---|
| AwesomeAPI (`cep.awesomeapi.com.br/json/<cep>`) | rua, bairro, cidade | **no nível da rua** (a metros do ponto do OSM) |
| BrasilAPI v2 | rua, bairro, cidade | centro da cidade - não serve |
| ViaCEP | rua, bairro, cidade | não tem |

A AwesomeAPI é gratuita, sem chave e sem conta, e aceita chamada do navegador
(`access-control-allow-origin: *`).

## Decisões de design

### D1 - "Localizar pelo endereço" passa a tentar as variantes

A correção que resolve o caso relatado sem CEP nenhum.

`geografia.model.js` ganha `localizarEndereco(endereco, { pausaMs, continuar })`: tenta
cada item de `variantesDeEndereco`, descarta resposta fora da cidade (`naCidade`) e
resposta de bairro ou cidade inteira (`precisaoDe === 'aproximada'`), e devolve
`{ achado, precisao }` ou `{ achado: null }`. Lança só se o **serviço** falhar.

É a função `procurar()` de `escolas/localizacao.model.js`, que sobe para onde a
geografia mora. Passa a ter **três** usos - o lote de escolas, o formulário da escola e
o formulário de local - e por isso deixa de ser cópia (R13). `pausaMs` respeita o limite
de uma consulta por segundo do Nominatim; `continuar` é como o lote avisa que foi
cancelado.

Consequência visível nos dois formulários: quando o mapa só acha o bairro, a dica passa
a dizer isso ("Só encontrei o bairro, não a rua: informe o CEP ou acerte o pino à mão")
em vez de pôr o pino a quilômetros do lugar.

### D2 - O CEP é guardado em três lugares

Migration **047**, idempotente:

```sql
alter table local                  add column if not exists cep text;
alter table unidade_escolar        add column if not exists cep text;
alter table solicitacao_transporte add column if not exists destino_cep text;
-- + CHECK nomeado em cada uma:  cep is null or cep ~ '^[0-9]{8}$'
```

- **Opcional.** A escola que pede um ônibus pode não saber o CEP do destino.
- **Formato canônico: 8 dígitos, sem hífen** - o mesmo critério de CPF e telefone
  (o banco guarda o dado, a tela põe a máscara).
- Nenhuma tabela nova: não há policy nem `religar_auditoria()` a acrescentar. O gatilho
  de auditoria já registra a coluna nova nas três tabelas.
- `criar_viagem()` **não muda**. Ela monta a linha por `jsonb_populate_record`, que
  carrega `destino_cep` sozinho quando a coluna existe e o ignora quando não existe.

### D3 - Formato do CEP em `shared/format.js`

Três funções puras, ao lado de `mascaraDiaMes`:

| Função | Entrada → saída |
|---|---|
| `cepDe(texto)` | `'14.000-000'` → `'14000000'`; qualquer coisa que não tenha 8 dígitos → `null` |
| `fmtCep(cep)` | `'14000000'` → `'14000-000'`; vazio → `''` |
| `mascaraCep(texto)` | o que a pessoa digita → `'14000-000'`, dígito a dígito |

### D4 - Consulta de CEP em `geografia.model.js`

`buscarCep(cep)` → `{ cep, rua, bairro, cidade, uf, lat, lng }` ou `null` (CEP que não
existe). Lança se o serviço falhar ou demorar (mesmo `buscarJson` com tempo-limite dos
outros dois serviços). A leitura da resposta é uma função pura à parte
(`lerRespostaCep(json)`), testável sem rede; coordenada inválida vira `lat`/`lng` nulos
(`temCoordenada`), e o endereço ainda serve.

Sai do navegador só o CEP - endereço de escola ou de local, nunca dado de pessoa. É o
mesmo desenho das consultas que já existem (spec 2026-09-13-sate-rota, D2).

### D5 - Um componente para o campo: `shared/ui/campo-cep.js`

```js
ligarCep(input, { buscar, dica, aoAchar })
```

Tem comportamento (R12): máscara enquanto se digita, consulta quando completa os oito
dígitos, descarte de resposta atrasada (a pessoa corrigiu o CEP antes de a primeira
voltar), e o texto de estado em `dica` (`aria-live`): "Procurando…", "CEP não
encontrado.", "O serviço de CEP não respondeu. Preencha o endereço à mão."

Nasce como componente porque tem **três usos nesta mesma entrega** (R13): escola, local
e destino digitado. `buscar` é **injetado** por quem usa: o kernel não importa
`modules/` (R1), e o componente não precisa saber de onde a resposta vem. O que fazer
com a resposta (`aoAchar`) é de cada formulário.

### D6 - O que o CEP preenche, e o que ele não toca

A regra é **não destruir o que já foi conferido**:

| | Regra |
|---|---|
| Rua e bairro | preenchidos **só se o campo estiver vazio** |
| Número | nunca tocado - o CEP não sabe o número |
| Pino, cadastro **sem** localização | posicionado no ponto do CEP (precisão de rua) |
| Pino, cadastro **com** localização | **não se move**; a dica oferece o botão "Mover o pino para este CEP" |
| CEP de outra cidade | a dica avisa ("CEP de Cidade Exemplo"), sem bloquear |

O motivo da quarta linha: acrescentar o CEP a um local cujo pino já foi ajustado à mão
no ponto de desembarque trocaria o ponto exato pelo meio da rua.

Nada é gravado até a pessoa salvar. Preencher por CEP é gesto dela: os campos escritos
contam como digitados (`marcarTocado`), e sair do modal pergunta antes de descartar.

Em cada formulário:

- **Local do SATE** - grupo Endereço na ordem **CEP → Endereço → Número → Bairro**. O
  CEP vem primeiro porque é ele que preenche os outros.
- **Escola** - o campo CEP entra antes de Endereço. A escola tem **um** campo de
  endereço: vazio, recebe "Rua, Bairro"; preenchido, não é tocado.
- **Destino novo no pedido** - CEP opcional antes do endereço, só quando o local é
  digitado; preenche rua e bairro, sem mapa. Local do cadastro mostra o CEP dele,
  somente leitura, como já acontece com os outros três campos.

### D7 - Onde o CEP aparece

Ao lado do endereço, onde o endereço já aparece: card de local, ficha da escola e a
linha do destino na ficha do pedido - "Rua Exemplo, 123 - Centro · CEP 00000-000".
`enderecoCompleto()` **não muda**: a linha única continua sendo rua, número e bairro, e
é ela que vai para a ficha impressa e para a busca no mapa.

### D8 - "Conferir local" também na aba Locais, e por LUGAR

No topo da aba Locais, para quem aprova (e fora do "ver como escola"), entra o bloco
**A conferir**: os destinos que escolas digitaram e ainda não são local do cadastro.

- Uma linha por **lugar**: nome, endereço, e "em N pedido(s)". O botão **Conferir** abre
  o mesmo modal que a aprovação abre hoje.
- Sem pendência, o bloco não aparece.
- Entram os pedidos sem local do cadastro e com destino digitado, exceto negados e
  cancelados.

**Conferir passa a valer para o lugar, não para um pedido.** Três pedidos que digitaram
o mesmo destino são resolvidos de uma vez, pelos dois caminhos (aba Locais e
aprovação). Hoje seriam três conferências do mesmo endereço.

"Mesmo destino" é nome + rua + número iguais, comparados sem acento, caixa e pontuação
(`norm`). Bairro e CEP ficam fora da chave: são os que a escola mais erra.

No código:

- `sate.model.js` - `destinosAConferir()` (lê os pedidos pendentes) e
  `vincularLocal(ids, local)`, que passa a aceitar vários ids num `update` só.
- `regras.model.js` - `agruparDestinos(pedidos)`, pura.
- `views/conferir-local.js` - recebe o **lugar** (com seus pedidos) em vez de um pedido.
  Depois de vincular, recalcula o trajeto de cada pedido, um por vez.
- `views/locais.js` - desenha o bloco. "Cadastrar novo" leva o CEP digitado junto.

### D9 - Sem a migration 047

A tela não quebra (R15, degradação por migration ausente):

- **Leitura.** `locais.model.js` já tem um segundo `select` para coluna ausente
  (`42703`). Ele era para a 044, que já está aplicada: passa a ser o `select` sem `cep`.
  Escolas leem com `select('*')` e não precisam de nada.
- **Escrita.** O `cep` só entra no que é enviado **quando foi preenchido** (ou quando
  havia um e foi apagado). Quem não mexe no CEP salva como hoje, com ou sem a 047.
  Quem preenche sem a coluna recebe "O banco ainda não tem o campo CEP. Avise a
  Gerência." - o mesmo tratamento que número e bairro têm hoje.

## Fora de escopo

- **Preencher o CEP das 144 escolas em lote.** O campo fica disponível; se fizer
  sentido, um seed em `_private/` depois, como o dos gestores.
- **Usar o CEP na localização em lote das escolas.** Só rende depois que os CEPs
  existirem.
- **Cidade no cadastro de local.** O CEP de outra cidade é avisado, não guardado à
  parte.
- **Segundo serviço de CEP como reserva.** Se a AwesomeAPI sair do ar, o formulário
  volta a ser o de hoje (endereço à mão + "Localizar pelo endereço"). Nada se perde.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/047_cep.sql` | novo |
| `src/shared/format.js` | `cepDe`, `fmtCep`, `mascaraCep` |
| `src/shared/ui/campo-cep.js` | novo |
| `src/modules/locais/geografia.model.js` | `localizarEndereco`, `buscarCep`, `lerRespostaCep` |
| `src/modules/locais/locais.model.js` | `cep` em colunas e campos; fallback sem `cep` |
| `src/modules/escolas/localizacao.model.js` | `procurar()` passa a chamar `localizarEndereco` |
| `src/modules/escolas/escolas.model.js` | `cep` em `CAMPOS` |
| `src/modules/escolas/views/formulario.js`, `views/detalhe.js` | campo, variantes, exibição |
| `src/modules/sate/sate.model.js`, `regras.model.js` | D8 |
| `src/modules/sate/views/locais.js`, `conferir-local.js`, `formulario-destino.js`, `formulario.js`, `detalhe.js` | D6 a D8 |
| `docs/modulos/sate.md`, `docs/modulos/escolas.md` | passo a passo e regras |
| `CHANGELOG.md`, `src/core/config.js` | versões |

Nenhum arquivo passa do teto (R11): `locais.js` vai de 257 para cerca de 310 linhas.

## Verificação

- **Testes** (`node --test tests/`): `cepDe`/`fmtCep`/`mascaraCep`; `lerRespostaCep`
  (achado, não encontrado, coordenada inválida); `localizarEndereco` com `geocodificar`
  simulado (acha na segunda variante; descarta fora da cidade; descarta "aproximada");
  `agruparDestinos` (mesmo lugar com grafias diferentes, lugares diferentes na mesma rua).
- **Navegador, dev-local, largo e estreito:** CEP preenche só campo vazio; pino
  existente não se move sem o botão; o endereço que motivou o pedido é achado por
  "Localizar pelo endereço"; bloco "A conferir" some quando esvazia; conferir um lugar
  com dois pedidos resolve os dois.
- `python .claude/scripts/verificar_arquitetura.py` sem bloqueio.
- `git diff --cached` sem endereço, e-mail ou telefone real.
