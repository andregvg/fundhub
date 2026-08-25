# FundHub — Padrões de Projeto e Arquitetura

> Registro das decisões arquiteturais tomadas em 25/08/2026, a partir de uma
> análise do estado real do código (versão 0.10.0, branch `dev`, 17 módulos).
> Este documento explica o **porquê**. O **o quê** operacional vive em
> `CLAUDE.md` e `.claude/rules/`.

## 1. Objetivo

Fixar um conjunto pequeno de regras arquiteturais que o Claude Code consiga
aplicar objetivamente durante criação, alteração, revisão e refatoração —
preservando o que já funciona bem no FundHub e evitando que o crescimento
previsto (fases 2 a 5 do BLUEPRINT) degrade a estrutura.

Princípio norteador: **código elegante, enxuto, legível e eficiente**, com alta
coesão e baixo acoplamento, sem abstrações, camadas ou padrões adotados por
convenção.

## 2. Diagnóstico do estado atual

### 2.1 O que está bom e deve ser preservado

- **Kernel enxuto e sem domínio.** `core/` são 8 arquivos de 19 a 119 linhas.
  Nenhum importa um módulo específico, exceto `registry.js` (manifestos).
- **MVC adaptado seguido à risca.** Em toda a base, nenhum `*.model.js` toca no
  DOM e nenhum `*.view.js` chama `sb()`. É regra cumprida, não só documentada.
- **Grafo de dependências acíclico.** Os imports cruzados entre models
  (`escolas` → `servidores`, `telefones`; `dashboard` → 6 models; `viagens` →
  `sate`) formam hoje uma árvore, sem um único ciclo.
- **`shared/` genuinamente contido.** 8 arquivos, todos sem domínio próprio e
  todos usados por 2+ módulos. Não virou depósito.
- **Segurança internalizada.** RLS default-deny, `is_autorizado()`/`is_admin()`
  como fonte única, `esc()` em todo template literal, chave publishable
  reconhecidamente pública, segredo nunca versionado.
- **Datas já corretas.** Data civil como string `yyyy-mm-dd`, timestamp exibido
  por `fmtDataHora` fixo em `America/Sao_Paulo`. Nenhum uso de `toISOString()`
  para data civil.
- **Ausência deliberada de camadas.** Nenhum repository, service, controller ou
  container de injeção. O model chama `sb()` direto.

### 2.2 Inconsistências encontradas

| # | Inconsistência | Efeito |
|---|---|---|
| 1 | `modules/docs/docs.content.js` diz "15 módulos"; o registry tem 17. Descreve o modelo admin/leitor binário, substituído por 4 níveis na migration 021. | Documentação interna do app desinforma quem a lê. |
| 2 | `docs/BLUEPRINT.md` §4 lista perfis (`gestor_escola`, `coordenador`, `supervisor`) que nunca existiram; a 021 usa `admin_sme`, `equipe_sme`, `transporte`, `leitor`. | Idem. |
| 3 | ~~`shell/chrome.js` tem `PAPEL_ROTULO.gestor_escolar`, papel inexistente.~~ **Correção (rodada de implementação, 25/08/2026): é papel real** — a migration 021 o define (`ordem: 40`) com permissões próprias (`proprios` em dashboard/escolas/servidores/horarios/sate, `leitura` em calendario/projetos/notificacoes). Eu havia concluído o contrário a partir de um grep que buscava a string sem o sufixo `-r`. Removido e restaurado no mesmo dia — ver commit da rodada de implementação. | Falso positivo já corrigido; registrado aqui para não reaparecer como "achado novo" numa revisão futura. |
| 4 | `afastamentos.view.js` com 575 linhas e 4 responsabilidades de UI (lista, calendário, formulário, sincronização). | É estruturalmente o mesmo caso que motivou `sate/views/`, mas não foi dividido. |
| 5 | Não existe identidade visual por módulo; só `--brand` global. | Hub monocromático. |
| 6 | `confirm()`/`alert()` nativos em ações destrutivas. | Única quebra visível do design system. |

### 2.3 Acoplamentos relevantes

- O acoplamento model→model é amplo e crescente. `escolas.model.js` é importado
  por quase todo mundo; `servidores.model.js` é dono de `servidor`/`vinculo` e
  alimenta Horários e Afastamentos. Funciona, mas **nada impede um ciclo** de
  aparecer conforme o número de módulos cresce.
- Não há barrel nem `index.js`. `<modulo>.model.js` é a API pública por
  convenção — o que significa que **toda função exportada é pública por
  acidente**, sem distinção entre contrato e detalhe interno.

### 2.4 Riscos de crescimento

- As fases 2 a 5 aprofundam módulos e cross-imports. O padrão atual aguenta
  porque o grafo é raso; sem regra explícita, o risco de ciclo ou de "módulo
  Deus" cresce com o tempo.
- Views tendem a crescer por acréscimo. Sem critério objetivo de divisão, cada
  entrega engorda o arquivo existente.
- A camada externa sem login (professor/proponente por token) é o único ponto
  de acesso anônimo previsto — é onde uma regra de segurança mal definida teria
  o maior custo.

### 2.5 Padrões que já existem informalmente

Todos documentados em prosa, nenhum verificado automaticamente:

- "Divide a view em `views/<aba>.js` só quando compensa."
- "Model é a API pública de um módulo; nunca a view."
- "Nenhum dado real, seed ou segredo no repositório."
- "Todo valor vindo do banco passa por `esc()`."

## 3. Decisões de fundo

### 3.1 O MVC adaptado permanece. Não trocar.

É seguido em 100% da base, tem custo cognitivo zero e resolve o problema real:
impedir que tela e banco se misturem. O que ele não resolve é o **tamanho das
views** — e isso é um problema de divisão de arquivo, não de padrão
arquitetural.

**Rejeitado explicitamente:** Clean Architecture, DDD, repositories, services,
controllers, camada de casos de uso. Nenhum resolve um problema concreto
encontrado no FundHub; todos aumentariam a distância entre a intenção e o
código.

**Ajuste de vocabulário adotado:** o Model é **dono do domínio** (dados *mais*
regras de negócio), não "camada de acesso a dados". `horarios.model.js` valida
jornada e `afastamentos.model.js` calcula dias — isso está certo, e a regra
precisa dizê-lo para que ninguém "limpe" essas regras para fora depois.

### 3.2 `core/` + `shared/` são uma camada só para efeito de dependência

A documentação atual descreve uma hierarquia que o código não cumpre:
`core/router.js` importa `shared/ui/feedback.js` e `shared/realtime.js` importa
`core/supabase.js`. A dependência sempre foi mútua.

Em vez de inventar uma violação para depois abrir exceção, declara-se que são
**uma camada (o kernel) com duas gavetas separadas por conteúdo**:

- `core/` — o que tem **estado ou ciclo de vida do app**: config, cliente
  Supabase, sessão, perfil, mapa de permissões, roteamento, vocabulário que o
  kernel precisa conhecer.
- `shared/` — o que é **sem estado** (helpers puros) ou **widget reusável**
  (drawer, toast, phones, filtro).

A regra de dependência que importa continua verdadeira e passa a ser a única:
**o kernel nunca importa `modules/` nem `shell/`.**

### 3.3 Formas legítimas de módulo

Três formas, todas já existentes no código; as duas últimas eram acidente e
passam a ser padrão nomeado:

| Forma | Exemplo | Manifesto? |
|---|---|---|
| **Completo** — dono de dados e de tela | `escolas`, `afastamentos` | sim |
| **Agregador** — tela sem dados próprios, lê models alheios | `dashboard`, `viagens` | sim |
| **Domínio sem tela** — dono de dados, renderizado por outro módulo | `telefones`, `locais` | não |

### 3.4 Arquitetura de pastas de um módulo

```
modules/<modulo>/
  module.js              manifesto — id, ico, cor, nome, rota, nav, grupo, perm, load()
  <modulo>.model.js      API PÚBLICA: dados + regras de domínio
  <modulo>.view.js       tela; exporta render(app, ctx)
  <modulo>.css           opcional (+ @import em styles/main.css)
  views/<aba>.js         só quando o módulo se divide
  <agregado>.model.js    quando o módulo é dono de 2 domínios (sate/atividades)
```

## 4. As 16 regras

### 4.1 Obrigatórias

**R1 — Direção de dependências.** O kernel (`core/` + `shared/`) nunca importa
`modules/` nem `shell/`. Módulos importam kernel à vontade; `shell/` importa
kernel; `main.js` importa tudo.
*Evita:* que o kernel passe a conhecer domínio e deixe de ser substituível e
compreensível isoladamente.

**R2 — Só `*.model.js` atravessa a fronteira de um módulo.** View, `views/`,
CSS e helpers internos são privados ao módulo.
*Evita:* que detalhes internos virem dependência de terceiros por acidente.
Hoje tudo o que um módulo exporta é público sem querer.

**R3 — Model nunca toca no DOM; view nunca chama `sb()`.** O model é dono do
domínio: regra de negócio mora nele.
*Evita:* a mistura que torna impossível testar regra sem browser e reusar dado
sem arrastar tela.

**R4 — Zero ciclos no grafo de imports.** Verificado por script.
*Evita:* o novelo. O grafo hoje é limpo, mas nada impede o primeiro ciclo — e
há 5 fases pela frente.

**R5 — `esc()` obrigatório** em todo valor vindo do banco antes de entrar em
template literal, sem exceção do tipo "esse campo é numérico".
*Evita:* XSS armazenado. Não é hipotético: qualquer admin digita cadastro livre.

**R6 — RLS default-deny e nenhuma policy concede acesso a `anon`.** Acesso
externo sem login só por Edge Function com token. O front esconde botão por
conforto; a barreira é sempre o banco.
*Evita:* o erro caro das fases 3 e 4 — relaxar RLS para `anon` "só nessa
tabela" e expor dado pessoal da rede inteira.

**R7 — Nenhum dado real, segredo ou PII no repositório**, em código,
comentário, doc, exemplo ou fixture. Inclui nome de servidor, e-mail, telefone,
CPF, número de processo. `sb_secret_` / `service_role` nunca, em hipótese alguma.
*Evita:* vazamento definitivo — o repositório é público e o histórico do Git
não esquece.

**R8 — Data civil é `string` `yyyy-mm-dd`; timestamp é ISO do banco.** Nunca
converter uma na outra. Toda API de formatação de data/hora fica confinada em
`shared/format.js`.
*Evita:* o bug do `toISOString()` voltando um dia à noite no Brasil, e horário
exibido fora de `America/Sao_Paulo`.

**R9 — Nenhuma cor literal em módulo** (`#hex`, `rgb()`), no CSS ou no JS.
Apenas `var(--token)`.
*Evita:* tema escuro quebrado e identidade visual inconsistente.

**R10 — Sem build, sem npm, sem dependência nova.** O que está no repositório é
o que roda no navegador.
*Evita:* perder a propriedade que torna o sistema manutenível por quem vier
depois. É restrição arquitetural, não preferência.

### 4.2 Recomendadas

**R11 — Critério objetivo de divisão de arquivo.** Dividir quando a view passa
de **400 linhas**, o model passa de **250 linhas**, ou o arquivo serve **2 ou
mais superfícies navegáveis** (abas/visões). Divide-se por superfície, em
`views/<aba>.js`, dentro da própria pasta. **Piso anti-fragmentação:** não
criar arquivo com menos de ~60 linhas, salvo manifesto ou coisa importada por
2+ arquivos. Arquivos de conteúdo (`*.content.js`) são isentos.
*Evita:* os dois extremos — o arquivo de 575 linhas com 4 responsabilidades e a
explosão de arquivinhos de 20 linhas.
*Calibração:* os limites saem do próprio projeto. O SATE foi dividido quando
chegaria a ~750 linhas; a mediana das views é 250.

**R12 — Componente JS em `shared/ui/` só quando há comportamento** (estado,
eventos, foco, ciclo de vida). Markup recorrente sem comportamento — tabelas,
listas, cards, botões, campos — é **classe CSS em `components.css`**.
*Evita:* um mini-framework caseiro. É por isso que drawer, toast, phones e
filtro-segmento merecem existir e "Botão" não merece. Também é o que impede
`shared/` de virar depósito.

**R13 — Regra de três antes de qualquer abstração nova.** Pasta, camada,
wrapper ou utilitário nascem no **terceiro** caso concreto no repositório.
*Evita:* overengineering. É o critério objetivo que substitui "use bom senso".

**R14 — Identidade por módulo via manifesto.** `module.js` declara
`cor: '<nome-do-token>'`; o roteador aplica `--modulo` no container; o CSS do
módulo usa `var(--modulo)` no lugar de `var(--brand)`. A paleta de destaques
vive em `tokens.css`, com variante clara e escura.
*Evita:* cada módulo inventando sua cor (violando R9) ou o hub ficando
monocromático. Custo: um campo no manifesto e uma linha no roteador.

**R15 — Validação em dois níveis, com semântica fixa: erro barra, aviso não.**
O front valida para UX; a verdade é constraint/CHECK/policy no banco. Situação
impossível é erro; situação indesejável que a SME às vezes precisa aceitar é
aviso.
*Evita:* regra de negócio que só existe na tela (contornável pelo console) e
telas que impedem o que a vida real exige.

**R16 — Substituir `confirm()`/`alert()` nativos** por `shared/ui/confirmar.js`
(tem comportamento, logo passa no critério de R12).
*Evita:* diálogo destrutivo fora do design system, não estilizável e bloqueante.

### 4.3 Exceções justificáveis

Exceções **nomeadas**, não brechas. Qualquer outra precisa de justificativa
explícita em comentário no código.

| Exceção | Justificativa |
|---|---|
| `core/registry.js` importa os `module.js` de todos os módulos | É o ponto de inversão: o kernel conhece **manifestos**, não implementações. As views entram por `import()` dinâmico. Única porta permitida. |
| Kernel com vocabulário de domínio (`core/segmentos.js`) | Aceito **só** quando quase todo módulo depende do mesmo vocabulário e todos precisam concordar sobre ele. Precisa espelhar o banco (`unidade_segmentos()`). Não é licença para mover domínio ao kernel. |
| Módulo agregador importando muitos models (dashboard: 6) | Legítimo porque é **leitor puro sem dados próprios**: acoplamento unidirecional e módulo descartável. Vira problema se o agregador começar a escrever. |
| `shared/ui/filtro-segmento.js` conhecer segmentos | O domínio dele vem de `core/segmentos.js`, que já é kernel. Documentar que **não é controle de acesso** — quem restringe é o RLS. |
| Módulo sem manifesto (`telefones`, `locais`) | Legítimo para domínio possuído mas renderizado por outro módulo. Se ganhar tela, ganha manifesto. |

## 5. Distribuição das decisões

Princípio: **quanto mais objetiva a regra, mais para a direita ela vai.** O que
um script verifica não deve ocupar contexto do modelo.

| Destino | Conteúdo | Critério |
|---|---|---|
| `CLAUDE.md` | Mapa de pastas, formas de módulo, R1–R3, R5–R8, R10, fluxo de trabalho, ponteiros | O que precisa estar na cabeça em **toda** edição (~80 linhas) |
| `.claude/rules/arquitetura.md` | R1–R4, R11, R13 e as exceções nomeadas | Consultado ao criar/dividir/mover código |
| `.claude/rules/seguranca.md` | R5–R7, checklist de migration, camada por token | Consultado ao mexer em banco, auth ou dado pessoal |
| `.claude/rules/ui.md` | R9, R12, R14, R16, mobile-first, classes existentes | Consultado ao mexer em tela ou estilo |
| `.claude/rules/dados.md` | R8, R15, degradação por migration ausente, `upsert` em lote | Consultado ao mexer em data, validação ou persistência |
| `.claude/rules/modulo-novo.md` | A receita de 5 passos, atualizada | Consultado ao criar módulo |
| `.claude/skills/architecture-review/` | Conduz a revisão: roda o script, depois analisa o que ele não alcança | Invocado sob demanda |
| `.claude/scripts/verificar_arquitetura.py` | 10 checagens mecânicas | Roda a qualquer momento; a de PII merece virar hook de pre-commit |

### 5.1 As checagens determinísticas

| # | Verifica | Regra | Severidade |
|---|---|---|---|
| 1 | Ciclos no grafo de imports (só arestas **estáticas**) | R4 | bloqueia |
| 2 | Import cross-módulo de arquivo que não é `*.model.js` | R2 | bloqueia |
| 3 | Uso do cliente Supabase em arquivo de view | R3 | bloqueia |
| 4 | `document.` / `innerHTML` em `*.model.js` | R3 | bloqueia |
| 5 | `core/`/`shared/` importando `modules/` ou `shell/` | R1 | bloqueia |
| 6a | Data civil extraída de `toISOString()` | R8 | bloqueia |
| 6b | `toLocale*` de exibição fora de `shared/format.js` | R8 | bloqueia |
| 6c | `toISOString()` para carimbar timestamp | R8 | aviso |
| 7a | Cor literal em `.js` de módulo | R9 | bloqueia |
| 7b | Cor literal em `.css` de módulo | R9 | aviso |
| 8 | Segredo ou PII (chave, JWT, e-mail de pessoa, telefone, CPF) | R7 | bloqueia |
| 9 | Arquivo acima do limite de linhas | R11 | aviso |
| 10 | Consistência do registro (manifesto, registry, `@import` do CSS) | — | aviso |

### Calibração — decisões tomadas na primeira execução

Uma ferramenta que grita errado é ignorada. Três ajustes foram necessários:

1. **Ciclos usam só imports estáticos.** `import()` dinâmico é carregado sob
   demanda e não fecha ciclo em tempo de carga — é justamente o mecanismo que
   permite ao registry não depender das views. Sem essa distinção, o padrão
   central do projeto aparecia como três violações.
2. **`toISOString()` foi separado em dois casos.** Extrair data civil dele é o
   bug real (volta um dia à noite no Brasil) e bloqueia. Carimbar um timestamp
   com ele é **correto**, só não está centralizado — vira aviso. Sem a
   separação, 13 usos legítimos apareciam como bloqueio.
3. **PII exige que o achado pareça um valor, não uma menção.** `sb_secret_`
   só dispara com 15+ caracteres depois do prefixo; e-mail com local part de
   exemplo (`seu.email`, `fulano`, `nome`) não conta; telefone e CPF com
   dígitos repetidos são placeholder. Sem isso, a própria documentação que
   *proíbe* a chave secreta era acusada de vazá-la.

O script aceita supressão inline com `fundhub:ok-<check>` na própria linha, para
o caso raro de falso positivo — sempre acompanhada do motivo.

## 6. Consequências

### 6.1 Trabalho gerado, não incluído neste spec

> **Status (25/08/2026): fechado.** Todos os itens abaixo foram tratados na
> rodada de implementação do mesmo dia — commits `b9a5c3f` (cores/data),
> `a1a5ac5` (docs), `50a7bf0` (agoraISO), `f43a1b4` (confirmar.js), `baddb06`
> (decisão R14), `c57bd21` (split afastamentos), `95c9239` (split servidores).
> O script termina com **0 bloqueantes, 0 avisos**. Mantido como registro
> histórico do que a primeira execução encontrou.

As regras tornam explícitas dívidas que já existiam. Cada item abaixo é uma
tarefa separada, a ser priorizada depois:

**Bloqueantes apontados pela primeira execução do script (6):**

1. **`src/shared/ui/phones.js:8` — dois telefones que parecem reais num
   comentário de exemplo.** É violação de R7 no repositório público. Já está
   commitado (`d452acb`), então trocar o arquivo agora **não desfaz a
   exposição** — exige decisão sobre reescrever histórico ou apenas corrigir
   daqui para a frente. **Item de maior prioridade.**
2. `src/shell/chrome.js:177` — `toLocaleDateString()` fora de `format.js`
   (rodapé), sem fuso explícito.
3. `src/modules/afastamentos/afastamentos.model.js:18-20` — `CORES_AFASTAMENTO`
   com hex literal.
4. `src/modules/sate/views/catalogo.js:82` — `#1d4ed8`, que é o valor de
   `--brand` duplicado à mão.

**Avisos (24):** 13 usos de `toISOString()` para carimbar timestamp,
9 cores literais em CSS de módulo (várias em folha de impressão, onde preto
literal é defensável), e os 2 arquivos acima do limite de linhas.

**Demais tarefas geradas:**

5. Atualizar `modules/docs/docs.content.js` (17 módulos, 4 níveis de permissão).
6. Atualizar `docs/BLUEPRINT.md` §4 com os papéis reais da migration 021.
7. ~~Remover `PAPEL_ROTULO.gestor_escolar` de `shell/chrome.js`~~ — não se aplica, ver §2.2 item 3.
8. ~~Dividir `afastamentos.view.js`~~ (575 → 214 linhas + 4 arquivos em
   `views/`) — feito (25/08/2026), verificado no browser em dev-local.
9. ~~Avaliar `servidores.view.js`~~ — dividido (436 → 120 linhas + 3 arquivos
   em `views/`, agrupados por coesão real, não 4 abas forçadas) — feito
   (25/08/2026), verificado com dado sintético em dev-local. Um bug pego
   na própria revisão (`listaVinculos` usava `ANO_LETIVO` em vez de
   `podeEditar`) foi corrigido antes do commit.
10. ~~Acrescentar `agoraISO()`~~ — feito na rodada de implementação (25/08/2026).
11. ~~Implementar `shared/ui/confirmar.js`~~ — feito na rodada de implementação (25/08/2026).
12. ~~Implementar a paleta `--mod-*`~~ — **decisão do André (25/08/2026): não implementar
    especulativamente.** Um só sistema de tokens compartilhado para todos os módulos; o mecanismo
    de R14 só nasce no dia em que ele pedir destaque para um módulo específico. Ver R14 em
    `.claude/rules/ui.md`.

### 6.2 O que este spec deliberadamente não faz

- Não altera código de módulo. As violações existentes viram backlog, não
  refatoração automática.
- Não instala hook de Git. O script fica disponível; habilitar o pre-commit é
  decisão do André.
- Não introduz nenhuma camada, pasta ou dependência nova além de
  `shared/ui/confirmar.js` (R16), justificado por comportamento compartilhado
  em 3+ chamadas existentes.
