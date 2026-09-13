# FundHub - SATE: trajeto, distância e tempo de viagem

> Decisões de 13/09/2026, na conversa com o André. **Bloco S4b.**
> Entrega como MINOR: migration `039`, `sate/rota.model.js`, localização
> nas escolas e nos locais, e o trajeto no detalhe e no formulário.
>
> Depende do S5 (`2026-09-08-sate-participacao-design.md`): a rota é
> calculada sobre a sequência de participações ativas.

## 1. O problema

A regra do intervalo entre períodos (regra 1 do tutorial) compara o
embarque da tarde com a **chegada prevista** do ônibus da manhã -
retorno **mais o tempo de viagem de volta**. Desde a 0.27 a regra roda
com esse tempo fixo em zero (`viagemVoltaMin = 0` em `regras.model.js`),
porque o sistema não sabia calcular trajeto. Uma regra que desconta
zero minutos de viagem aprova folgas que não existem.

## 2. O que já existia, e o que falta

| | Estado antes deste bloco |
|---|---|
| Coordenadas da escola | colunas `latitude`/`longitude` em `unidade_escolar`, **sem campo na tela** |
| Coordenadas do destino | `local.latitude`/`longitude`, digitadas à mão na guia Locais |
| Ordem das paradas | `solicitacao_participacao.ordem`, com tela desde a 0.29.1 |
| Distância e tempo | **nada** |
| Localizar um endereço | **nada** - coordenada só digitada |

## 3. Decisões

### D1 - O SATE precisa de DISTÂNCIA, não de tempo de trânsito

Aprendido com o `agendamentos-fil` (`Geo.js`, `Config.js`): ele pede ao
Google **só a distância** por estrada e deriva o tempo por velocidade
média - o comentário no código registra que a duração do roteirizador
dava valores fora de escala. O tempo de ônibus escolar é dominado por
paradas e manobras, não pelo trânsito em tempo real.

```
minutos = arredonda(km ÷ velocidade × 60) + margem × nº de paradas
```

Velocidade (padrão **20 km/h**) e margem por parada (padrão **5 min**)
são configuração do módulo - os mesmos padrões do `agendamentos-fil`. A
margem conta **por parada de embarque**: cada escola a mais na viagem é
mais uma manobra.

### D2 - A distância vem do OpenStreetMap, direto do navegador

Decisão do André entre três opções (13/09/2026):

| | Custo | Conta | Escolhida |
|---|---|---|---|
| **OSRM (OpenStreetMap)** do navegador | zero | nenhuma | **sim** |
| Web app do Apps Script como intermediário | zero | institucional | não |
| Chave do Google Cloud | exige cobrança ativa | projeto de nuvem | não |

- **Distância:** `router.project-osrm.org/route/v1/driving/…` - uma
  chamada devolve a distância de **cada trecho** da sequência.
- **Localizar endereço:** `nominatim.openstreetmap.org/search` - só por
  clique, nunca em lote (a política de uso do Nominatim é de no máximo
  uma consulta por segundo).
- **Sem chave, sem conta, sem dependência de código.** É `fetch`.

**O que sai do navegador:** endereço de escola ou local, e coordenadas.
Nenhum dado de estudante, servidor ou pessoa. Endereço de escola pública
é informação pública.

**Atribuição:** a distância é derivada de dados do OpenStreetMap (ODbL),
e a tela diz isso onde a exibe.

**Risco aceito:** o OSRM público é mantido por voluntários, sem garantia
de funcionamento. Por isso D3 (o cálculo se guarda) e D6 (falha nunca
bloqueia).

### D3 - Guarda-se o TRECHO, não a rota

Tabela `trecho`: distância entre dois pontos, com as coordenadas
arredondadas a 5 casas (~1 m) como chave única.

Por que trecho e não a rota inteira: uma rota com três escolas em certa
ordem quase nunca se repete; o trecho "Escola A → Escola B" e o trecho
"Escola B → Museu" se repetem o tempo todo. A rota é a **soma** dos
trechos consecutivos.

Por que coordenada e não o id da escola ou do local: um ponto de parada
pode ser escola **ou** local, e uma chave por id exigiria duas colunas
anuláveis de cada lado. E quando a escola muda de endereço, a coordenada
muda e o trecho velho simplesmente deixa de ser consultado - sem
invalidação para lembrar.

**Quem grava o trecho: só quem tem escrita no SATE.** A escola lê. Um
trecho é compartilhado pela rede inteira; se qualquer escola pudesse
gravá-lo, uma distância errada gravada pelo console alteraria o tempo de
viagem de todo mundo. A escola que calcula um trecho ainda não guardado
usa o resultado no próprio pedido, sem gravar a tabela - volume
desprezível, e há cache em memória na sessão.

### D4 - A solicitação guarda o RETRATO do trajeto

Colunas novas em `solicitacao_transporte`:

| Coluna | |
|---|---|
| `trajeto_km` | soma dos trechos, das paradas ao destino |
| `trajeto_min` | tempo da ida, pela fórmula de D1 |
| `trajeto_status` | `ok` · `sem_coordenada` · `sem_destino` · `sem_rota` · `erro` |
| `trajeto_em` | quando foi calculado |

Os **minutos** são gravados, e não recalculados a cada leitura, pelo
mesmo motivo que já rege o intervalo entre períodos: mudar a velocidade
média vale **para os próximos agendamentos**, nunca reescreve a
chegada prevista de uma viagem confirmada.

**A volta é igual à ida.** A viagem de volta refaz as paradas no sentido
inverso; o tempo é o mesmo. Uma coluna só.

### D5 - Quando o trajeto é calculado

| Momento | Quem | |
|---|---|---|
| Nova solicitação | quem pede | a prévia aparece no formulário e o retrato vai junto no envio |
| Acrescentar, remover, reordenar, cancelar participação, confirmar saída | quem aprova | recalcula logo depois da mudança |
| **Recalcular trajeto** | quem aprova | botão no detalhe - para depois de cadastrar uma coordenada que faltava |

O pedido de saída **da escola** não recalcula: o ônibus continua
passando lá até a Gerência confirmar.

### D6 - Falha de cálculo nunca bloqueia

Sem coordenada, sem rota ou com o serviço fora do ar, a solicitação é
enviada normalmente com `trajeto_status` dizendo o porquê, e a regra do
intervalo volta a rodar com zero minutos - exatamente o comportamento de
antes deste bloco. O detalhe mostra **qual parada** está sem coordenada.

Trajeto é informação para decidir, não condição para pedir (R15: a SME
pode legitimamente precisar agendar para um destino ainda sem
coordenada).

### D7 - Destino sem coordenada: o destino digitado à mão

O destino **livre** (nome e endereço digitados, sem local do cadastro)
não tem coordenada e dá `sem_destino`. Não se localiza automaticamente
o texto livre: um endereço ambíguo viraria uma coordenada errada
gravada sem que ninguém a conferisse. O caminho é o que a migration
`017` já estabeleceu - destino que se repete vira **local**, localizado
uma vez e conferido no mapa.

### D8 - Mapa: link, não mapa embutido

"Ver rota no mapa" abre o Google Maps com as paradas na ordem e o
destino (`google.com/maps/dir/?api=1&…`). É um **link**: não consome
API, não tem custo, não exige chave. O mapa embutido fica para depois, e
quando vier será `<iframe>` do OpenStreetMap - uma biblioteca de mapa
seria dependência nova, proibida pela regra do "sem build".

### D9 - Onde o código mora

| | |
|---|---|
| `locais/locais.model.js` | **genérico de lugar**: localizar endereço, distância por estrada, links de mapa. Já era "fonte única do endereço/coordenadas" e declarava ser a base do cálculo de rota |
| `sate/rota.model.js` | **específico do SATE**: pontos da viagem, fórmula de minutos, cache de trechos, retrato na solicitação |

Grafo: `rota.model` → `locais.model`, `participacoes.model`,
`sate.model`. Nenhum deles importa `rota.model`. Sem ciclo.

A **localização por endereço** aparece em dois formulários (Escolas e
Locais). Duas cópias de ~25 linhas de ligação de tela, deliberadamente:
é o segundo caso, e a regra de três espera o terceiro.

## 4. Verificação

Funções puras (`minutosDeTrajeto`, `pontosDaViagem`, `urlOsrm`,
`lerOsrm`, `linkRota`, arredondamento de chave) com `node`; chamada real
ao OSRM e ao Nominatim a partir do dev-local; formulário e detalhe a
380px e 1100px; migration relida procurando `if not exists` e
`religar_auditoria()`.
