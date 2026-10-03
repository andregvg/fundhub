# Formulários, tema e equipe da escola - rodada de ajustes

Data: 03/10/2026 · Versões-alvo: FundHub **0.39.0** · SATE **0.18.0** · Migration **045**

## Problema

Uma revisão de uso levantou 20 pedidos de três naturezas:

- **Formulário e tela** - o que se vê e se digita: ícones de data e hora sumidos, fundo
  dos campos, seta do `select`, editor de telefones, e-mail institucional, filtros que
  esticam, o modal "Nova solicitação" do SATE, a ficha da escola.
- **Tema** - a pessoa escolher entre claro e escuro, no FundHub e no SATE.
- **Modelo** - o que o sistema *sabe* sobre a equipe de uma escola: supervisor não é
  equipe; o gestor tem função (1 ou 2), que muda com o tempo; e as escolas que o
  OpenStreetMap não acha precisam ser localizadas à mão.

Os dois primeiros não tocam o banco. O terceiro muda o modelo do vínculo (migration 045).

## Entrega em três blocos

Cada bloco é um commit na `dev`, validado antes do seguinte. As versões sobem uma vez,
no fim.

| Bloco | Decisões | Banco |
|---|---|---|
| **A - Formulários e SATE** | D1 a D6, D8, D18, D19 | não |
| **B - Tema e Configurações** | D9 a D11, D20 | não (usa `preferencia_usuario`, que já existe) |
| **C - Equipe da escola e mapa** | D7, D12 a D17 | migration 045 |

## Decisões de design

### D1 - Os ícones de data e hora voltam (defeito de 02/10)

**Causa:** a regra que clareia o campo dentro do grupo de modal usa o atalho
`background: var(--surface)`. O atalho zera `background-image`, `-repeat` e `-position`
- e o ícone do calendário e do relógio é um `background-image` (o indicador nativo foi
escondido por causa do Tab). Tem especificidade maior que a regra do ícone, então vence.

**Correção:** `background-color`, nunca o atalho, em toda regra que pinta fundo de campo.
A regra do grupo de modal sai de vez com a D3 (o campo passa a ter um token só). Vale
para todo modal com data ou hora: Nova solicitação, Novo servidor, Local de trabalho.

### D2 - Modal "Nova solicitação" do SATE

**Grupo e borda (1a).** `--grupo-bg` = 4% e `--grupo-borda` = 15% da cor de destaque,
**nos dois temas** (hoje: 4%/16% no claro, 7%/26% no escuro).

**Data sem ano (1b).** O campo nativo de data não permite esconder o ano. Só neste
formulário, a data passa a ser um campo de texto `dd/mm` com máscara (digita-se `1403`,
lê-se `14/03`), com o ícone de calendário à direita abrindo o seletor nativo.

- Ano assumido: o vigente. **Se a data já passou neste ano, vale o ano seguinte** -
  pedido de dezembro para fevereiro é caso real, e data no passado já é erro.
- Quem quiser dizer o ano digita os oito dígitos (`14032027`).
- A data resolvida aparece por extenso logo abaixo ("sexta-feira, 14/03/2027"): o ano
  é assumido, mas nunca escondido.
- Dia que não existe (`31/02`) é erro, com mensagem no campo.
- A conversão `dd/mm` → data civil é função pura em `shared/format.js` (R8), sem `Date`
  para formatar. O valor que o resto do formulário lê continua sendo `yyyy-mm-dd`.

**Servidor(a) responsável (1c).** O rótulo "Professor(a) responsável" vira
"Servidor(a) responsável". O campo continua de texto e ganha **sugestões** (`<datalist>`
nativo) com a **equipe da escola escolhida, sem a supervisão** (D13). Ao escolher
alguém, o telefone é preenchido com o número principal da pessoa - e continua editável.
Trocar a escola refaz a lista. Sem equipe cadastrada, ou sem permissão de leitura, o
campo é texto livre, como hoje.

Sugestão nativa e não a busca-seleção do hub: aqui o nome digitado à mão é resposta tão
legítima quanto a sugestão (o responsável pode não estar no cadastro), e a busca-seleção
descarta o texto que não vira escolha. A lista tem três ou quatro nomes.

Não há migration: o gestor escolar já lê a própria equipe e os telefones dela
(`servidores` = `proprios`). As colunas `professor_nome` e `professor_telefone` não
mudam de nome.

Placeholder do telefone: `(16) 99999-9999`.

**Horários (1d).** "Horário de retorno" vira "Horário de saída do evento". Sob os dois
campos, a dica: "Somente números, ex.: 0730 → 07h30".

**Período (1e).** O período calculado deixa de ser texto de dica e vira um selo com
ícone e a cor de destaque, na linha dos horários.

**Rótulos em todo o SATE.** "Servidor(a) responsável" e "Saída do evento" substituem
"Professor(a)" e "Retorno" no detalhe da solicitação, nas fichas, no remanejamento, nas
mensagens de erro e no tutorial.

**Arquivo.** `sate/views/formulario.js` tem 383 linhas (teto: 400). Os grupos "Quando"
e "Responsável" saem para `formulario-quando.js` e `formulario-responsavel.js`, no
mesmo desenho de `formulario-destino.js` (um grupo, seu estado, seu `ler…()`).

### D3 - Fundo do campo: um token só

Hoje o campo é `--surface-2` fora de grupo e `--surface` dentro dele, e nos dois casos
fica a um passo do fundo do modal - no escuro, quase igual.

Nasce `--campo-bg` (e `--campo-borda`), usado por todo campo de `.esc-form` e
`.form-grid`, dentro e fora de grupo. Ponto de partida, **calibrado no navegador** nos
dois temas e nas quatro cores do SATE, com captura de antes e depois para aprovação:

- claro: um cinza frio um passo abaixo de `--surface-2`, com borda um pouco mais forte;
- escuro: mais **escuro** que a superfície (campo "afundado"), que é o que dá contraste
  sobre um modal já escuro.

`.painel-filtros` não muda: lá o campo já é `--surface` sobre `--surface-2`.

### D4 - Seta do `select` com o recuo do texto

A seta nativa cola na borda. O `select` de formulário, de filtro e solto passa a
`appearance: none` com a seta desenhada como `background-image`, a 10px da borda
direita - o mesmo recuo do texto. Mesma técnica (e mesma ressalva de duas cores) dos
ícones de data e hora.

### D5 - Editor de telefones

`shared/ui/phones.js` - vale para Servidor, Escola e Meus dados.

- Lista vazia já nasce com **uma linha em branco**. "+ telefone" serve para o segundo
  número. Linha em branco não é gravada (já é assim).
- A linha perde borda, fundo e padding próprios: os campos entram na grade do
  formulário (tipo · número · rótulo · principal · excluir), com o mesmo espaçamento
  dos demais.
- Com um telefone só, o interruptor "principal" não aparece - não há o que escolher.
- Tipo inicial da linha nova declarado por quem chama: celular para servidor, fixo
  para escola.

### D6 - E-mail institucional do servidor

Rótulo "E-mail institucional". Ao digitar `@`, o campo completa com o domínio
(`CONFIG.dominioInstitucional`) **já selecionado**: quem tem o domínio padrão segue em
frente, quem tem outro continua digitando por cima. O campo passa a `type="text"` com
`inputmode="email"`, porque `type="email"` não permite controlar a seleção.

### D7 - Ficha da escola

- **Cabeçalho:** as tags (segmento, oferta, transporte, EJA) sob o nome.
- **Supervisão:** bloco próprio, como dado da escola - nome (abre a ficha), e-mail e
  telefone. Ver D13.
- **Equipe:** na ordem Gestor 1, Gestor 2, gestor sem função, Coordenador(a), demais
  cargos por nome. Ver D12. Sem grupos expansíveis por enquanto.
- **Mais detalhes:** `<details>` recolhido com Nome no SAE, INEP, Regional e Site APM.
- O botão "Horários da equipe" continua; a grade já não traz a supervisão (D14).

### D8 - Filtros não esticam

`.painel-filtros .filtro-campo` deixa de crescer (`flex: 0 1 auto`, com largura mínima).
A regra é do painel comum: vale para todas as listas, não só Escolas.

### D9 - Configurações em blocos expansíveis

Na tela Configurações, cada módulo vira um `<details>`: o cabeçalho (ícone + nome) é o
`<summary>`, com seta que gira. Nativo - teclado e leitor de tela de graça, sem JS de
abrir e fechar.

- O conteúdo de um módulo só é desenhado na **primeira abertura** (hoje a página espera
  todos, em fila).
- Quais ficaram abertos é lembrado no navegador (conveniência; a tela funciona sem).
- Primeiro acesso: "Geral" (D11) aberto, os demais fechados.

### D10 - Tema claro e escuro

**Mecanismo.** O tema passa a ser um atributo, `data-tema="claro|escuro"` no `<html>`.
Os seis blocos `@media (prefers-color-scheme: dark)` viram seletores
`:root[data-tema="escuro"]`. Um script curto no `<head>` das duas páginas aplica o
atributo antes da primeira pintura (sem piscar): a escolha gravada, ou, na falta dela,
a do sistema.

- Sem escolha, o tema **segue o sistema** - inclusive se ele mudar com a página aberta.
- `color-scheme` é declarado junto, para os controles nativos (seletor de data, lista
  do `select`, rolagem) acompanharem.
- `core/tema.js` é o dono: ler, aplicar, gravar. É kernel com estado (R1).

**Onde fica gravado.** No navegador (`localStorage`: vale antes do login e nas duas
páginas, que têm a mesma origem) **e** na preferência da conta (`geral/tema`): acompanha
a pessoa em outro aparelho. No login, a da conta vence. Falha ao gravar na conta não
desfaz a escolha local.

### D11 - Onde se troca o tema

- **Menu de usuário** (FundHub e SATE): linha "Tema escuro" com interruptor. É o
  caminho de quem só usa o SATE - a página de configurações de lá é de quem aprova.
- **Configurações → Geral:** primeiro bloco da tela, com o mesmo interruptor. É um
  bloco da própria tela, não a configuração de um módulo.

Os dois refletem o mesmo estado: trocar num atualiza o outro.

### D12 - Função do gestor (Gestor 1 e Gestor 2)

**Dado.** O vínculo ganha `funcao` (1, 2 ou vazio), aceita **só no cargo Gestor(a)** -
CHECK no banco (R15). O vínculo já é "pessoa × local × cargo × período"; a função entra
como parte dele. **O período da função é o período do vínculo** - não há tabela de
histórico nova.

**Informar.** Em "Local de trabalho" (e no cadastro de um servidor novo), ao escolher o
cargo Gestor(a), abre logo abaixo a escolha `Gestor 1 · Gestor 2 · Não definida`.

Ao **mudar** a função de um vínculo atual que já tinha uma, aparece um único campo:
"Mudou a partir de" (data).

| "Mudou a partir de" | O que o sistema faz |
|---|---|
| preenchido | encerra o período atual na véspera e abre outro, com a função nova, a partir da data - **fica o histórico** |
| em branco | corrige o registro: sempre foi essa função |

Definir a função de quem ainda não tinha nenhuma é sempre correção, sem pergunta - é o
caso de toda a base hoje.

**Exibir.** A função entra no **rótulo do cargo**: "Gestor(a) 1", "Gestor(a) 2". Nenhum
elemento novo em tela nenhuma - o card da ficha da escola, a lista de Servidores e a
grade de Horários já mostram o cargo. Quem não tem função definida segue "Gestor(a)".

**Rastrear.** A ficha do servidor já lista os locais de trabalho encerrados, apagados,
abaixo dos atuais. A troca de função aparece ali como duas linhas ("Gestor(a) 2 · até
13/03/2026" e "Gestor(a) 1 · desde 14/03/2026"). Correção sem data fica no registro de
auditoria, como toda alteração de cadastro.

**Aviso, não erro.** Marcar Gestor 1 numa escola que já tem um Gestor 1 atual avisa
("Esta escola já tem Gestor 1: NOME") e deixa salvar: numa transição, os dois períodos
se encostam.

**Não entra:** tela de preenchimento em lote. A função é informada vínculo a vínculo;
para a carga inicial, uma coluna a mais na planilha de gestores vira `UPDATE` em
`_private/`.

### D13 - Supervisão não é equipe

O supervisor trabalha na Secretaria, com horário próprio, e acompanha várias escolas.
O vínculo dele com a escola **continua existindo** - é o que registra "supervisiona esta
escola" e o que dá a ele acesso aos dados dela. O que muda é a leitura: é **supervisão**,
não equipe.

**Supervisão é regra do vínculo, não só do cargo** (correção de 03/10/2026). O cargo
`Supervisor(a)` numa **escola** é supervisão; o mesmo cargo num local **interno da SME**
(Sede, gerência) é o local de trabalho do supervisor, e é por lá que ele aparece em
Horários. Unidade sem `tipo` conta como escola (base anterior à migration 023): o
engano seguro é não tratar supervisor como equipe de escola. A regra mora em
`servidores/equipe.model.js` (`vinculoDeSupervisao`).

Uma regra só, em `servidores/vinculos.model.js`, dona do domínio "cargo":
`getEquipeDaUnidade()` passa a devolver cada pessoa com a função no rótulo, a marca de
supervisão e já na ordem da D7. Ficha da escola, SATE e Horários leem daí.

### D14 - Horários sem supervisão

- **Por escola:** quem é supervisão da unidade não aparece na grade, na lista "fora da
  grade", na contagem nem na cobertura.
- **Por servidor:** a escola supervisionada não é listada como local de jornada. O
  supervisor aparece só pelo local de trabalho dele na Secretaria.
- **Equipe gestora (configuração):** Supervisor(a) sai da lista de cargos; a migration
  o remove de `cargo_gestao`.
- Jornadas de supervisor já gravadas em escola **ficam no banco e deixam de aparecer**.
  Apagar é irreversível e fica fora desta entrega.

### D15 - Mapa com pino no cadastro da escola

O formulário da escola ganha o mesmo mapa do cadastro de locais do SATE: clicar ou
arrastar o pino preenche latitude e longitude; "Localizar pelo endereço" move o pino.

O painel "Localização das escolas" passa a listar **as escolas sem localização** de
forma permanente (hoje só mostra o resultado da última busca, que se perde ao
recarregar), cada uma com "Acertar no mapa", que abre o formulário dela.

### D16 - O mapa vira componente comum

`sate/views/mapa-local.js` → `shared/ui/mapa-pino.js`.

A regra de três (R13) diz para esperar o terceiro uso antes de criar uma abstração,
porque com dois casos é fácil generalizar uma coincidência. Aqui não há abstração nova:
o arquivo já é genérico (não sabe nada de SATE) e só muda de pasta. E a alternativa
esbarra em regra mais forte - Escolas não pode importar a tela de outro módulo (R2).
Duas cópias seriam dois lugares para manter a versão e a assinatura do Leaflet.

A exceção nomeada do Leaflet no `CLAUDE.md` é atualizada: segundo uso, novo endereço.
O carregamento continua sob demanda, só quando um formulário com mapa abre.

### D18 - SATE: "Ver como escola" com o nome completo

A busca da página "Ver como escola" e a faixa "Você está vendo o SATE como…" passam a
usar o **nome completo** da escola. O apelido continua valendo para achar (entra na
busca, não aparece).

### D19 - SATE: a escola não é levada ao FundHub

Quem usa o SATE como **escola** (nível `proprios`) não vê "Ir para o FundHub" no menu
nem "Meus dados" no menu de usuário (que leva ao FundHub). Vale por enquanto - é
decisão de produto, e volta quando o FundHub for aberto às escolas.

**Não é controle de acesso** (R6): quem digitar o endereço do FundHub entra, e vê o que
o banco deixa. Aqui só se decide o que o SATE *oferece*.

"Ver como escola" já é só de quem aprova. **Durante a simulação**, o menu passa a ser
exatamente o da escola - sem "Ver como escola", sem "Ir para o FundHub", sem as
configurações da rede. A saída é o botão "Voltar à minha visão" da faixa do topo.

### D20 - SATE: cor e tema são de cada pessoa

A cor do SATE deixa de ser da rede e passa a ser **preferência da conta**. A cor que a
rede tinha escolhido vira o padrão de quem nunca escolheu
(`preferência → rede → verde`).

"Configurações" entra no menu do SATE **para todos**:

- **Escola e leitura:** só o bloco "Aparência" - tema (D10) e cor. Nada da rede
  aparece, nem desabilitado: quem não decide frota e regras não precisa vê-las ali.
- **Quem aprova:** "Aparência" e, abaixo, as configurações da rede como hoje.

Trocar a cor vale na hora, sem recarregar. O bloco "Aparência" é o mesmo desenho do
"Geral" do FundHub (D11) - um renderizador, dois lugares.

### D17 - Migration 045

- `alter table vinculo add column if not exists funcao smallint`, com CHECK de valor
  (1 ou 2) e de cargo (só Gestor(a));
- `delete from cargo_gestao where cargo = 'Supervisor(a)'`;
- idempotente; termina com `select religar_auditoria();`.

**Sem a 045** (janela entre o deploy e o SQL): a leitura de servidores cai para a
consulta sem `funcao` (42703), ninguém tem função e a ordem da equipe usa só o cargo;
a escolha de função no formulário avisa que o banco ainda não foi atualizado. A
supervisão já sai de Horários e da equipe - isso é regra de tela, não depende da 045.

## Arquivos

| Bloco | Arquivo | O que muda |
|---|---|---|
| A | `styles/tokens.css`, `styles/components.css` | D1, D3, D4, D5, D8; `--grupo-*` |
| A | `shared/format.js` | data civil a partir de `dd/mm` (D2) |
| A | `shared/ui/phones.js` | D5 |
| A | `sate/views/formulario.js` + `formulario-quando.js`, `formulario-responsavel.js` (novos) | D2 |
| A | `sate/views/detalhe.js`, `fichas.js`, `remanejar.js`, `sate.css` | rótulos, selo do período |
| A | `servidores/views/formulario.js` | D5, D6 |
| A | `sate.js` | D18, D19 |
| B | `sate.js`, `sate/sate.config.js`, `configuracoes/painel.js` | D20 |
| B | `index.html`, `sate.html` | script do tema no `<head>` |
| B | `core/tema.js` (novo) | D10 |
| B | `styles/tokens.css`, `components.css`, `sate/sate.css` | `@media` → `[data-tema]` |
| B | `shell/chrome.js` | interruptor no menu de usuário |
| B | `configuracoes/configuracoes.view.js`, `configuracoes.css` | D9, D11 |
| C | `supabase/migrations/045_funcao_gestor_e_supervisao.sql` (novo) | D17 |
| C | `servidores/vinculos.model.js`, `servidores.model.js` | D12, D13 |
| C | `servidores/views/vinculo.js`, `detalhe.js` | D12 |
| C | `escolas/views/detalhe.js`, `formulario.js`, `localizar.js` | D7, D15 |
| C | `horarios/views/por-escola.js`, `por-servidor.js`, `cargos.js` | D14 |
| C | `shared/ui/mapa-pino.js` (movido), `sate/views/locais.js` | D16 |
| - | `docs/modulos/{sate,escolas,servidores,horarios,configuracoes}.md` | tutoriais |
| - | `CLAUDE.md`, `.claude/rules/ui.md`, `docs.content.js` | Leaflet, tema, `--campo-bg` |
| - | `core/config.js`, `CHANGELOG.md` | versões |

## Riscos

- **Tema:** trocar seis blocos `@media` por atributo mexe em toda cor do hub. Conferir
  claro e escuro, FundHub e SATE (quatro cores), antes de fechar o bloco B.
- **`color-scheme`:** muda a aparência de controle nativo no escuro (caixa de seleção,
  seletor de data). Conferir no navegador; é o comportamento certo, mas é mudança.
- **Cargo como texto:** supervisão e gestor são reconhecidos pelo rótulo canônico
  (`Supervisor(a)`, `Gestor(a)`), os que a migration 023 produz. Cargo digitado fora do
  padrão ("Supervisora") não é reconhecido. A regra fica num lugar só para ser trocada
  por uma marca no banco se isso acontecer.
- **Data `dd/mm`:** campo próprio só neste formulário. Se um segundo formulário pedir o
  mesmo, continua cópia; no terceiro vira componente (R13).
- **`type="text"` no e-mail:** perde a validação nativa de formato; entra um `pattern`.

## Fora do escopo

- Tela de preenchimento em lote da função do gestor.
- Apagar jornadas antigas de supervisor em escola.
- Renomear "local de trabalho" para o vínculo de supervisão.
- Grupos expansíveis na equipe da ficha da escola.
- Corrigir endereços de escola no cadastro (os dados reais não entram no repositório).

## Verificação

- `python .claude/scripts/verificar_arquitetura.py` sem bloqueio, a cada bloco.
- Dev-local, em tela larga e estreita, nos dois temas, console limpo:
  - A: ícones de data e hora; `1403` → data por extenso; virada de ano; escolher um
    servidor preenche o telefone; uma linha de telefone ao abrir Novo servidor; `@`
    completa o domínio; seta do `select`; filtros de Escolas sem esticar.
  - B: trocar o tema no menu de usuário do FundHub, abrir o SATE e ver o mesmo tema;
    recarregar sem piscar; blocos de Configurações abrem, fecham e lembram.
  - C: mudar Gestor 2 → Gestor 1 com data gera dois períodos na ficha; sem data,
    corrige; aviso de Gestor 1 duplicado; supervisão em bloco próprio na escola e fora
    de Horários; pino grava latitude e longitude da escola.
- `git diff --cached` sem dado real antes de cada commit.
