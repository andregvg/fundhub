# FundHub - Servidores, Escolas e Horários: modelo e telas

> Decisões tomadas em 25/08/2026 a partir de uma rodada de pedidos do André
> sobre os três módulos. Vale a partir da versão 0.10.2 (`dev`).
> Este documento explica o **porquê** e fixa o **contrato**; o passo a passo de
> execução vive no plano de implementação correspondente.

## 1. O problema

Os três módulos foram escritos em momentos diferentes e divergiram em quatro
frentes:

1. **O cargo de uma pessoa mora em dois lugares.** `servidor.cargo` (texto
   livre, com sugestões fixas no código) e `vinculo.papel` (enum de três
   valores, também fixo no código) descrevem a mesma coisa e podem se
   contradizer. Quem edita o servidor consegue mudar um sem o outro.
2. **O vínculo é modelado por ano letivo**, não por período. Um vínculo tem
   `ano` + `ativo` + `ingresso` + `fim` - quatro campos para representar algo
   que são duas datas. "Está na escola agora" depende de `ativo && ano ===
   ANO_LETIVO`, que é uma regra que ninguém consegue adivinhar olhando a tela.
3. **Não existe lotação na SME.** `vinculo.unidade_id` é obrigatório, então
   quem trabalha na sede não tem vínculo nenhum - a informação vive solta em
   `servidor.lotacao` + `servidor.cargo`, sem data de início nem de fim.
4. **Os formulários misturam padrões de exibição.** Alguns rótulos ficam acima
   do campo, outros ao lado; a grade de duas colunas só existe acima de 1280px;
   um campo sozinho na linha não ocupa o container.

Somam-se pedidos pontuais: data de nascimento, máscara de RG, edição de
vínculo, atalho da escola para a equipe dela, filtros mais legíveis e um
caminho visível para cadastrar horário de trabalho.

## 2. Princípio que organiza todas as decisões

> **O vínculo é a fonte única do "onde" e do "como" de uma pessoa.**

Cargo, lotação e período deixam de ser atributos da pessoa e passam a ser
atributos da **designação**. A pessoa (`servidor`) fica com o que é dela
independentemente de onde trabalha: nome, documentos, nascimento, contato,
ingresso na rede.

Isso resolve 1, 2 e 3 de uma vez, e é o que torna possível responder
"onde fulano estava em março de 2025?" - hoje impossível.

## 3. Modelo de dados - migration `023_servidores_vinculos.sql`

### 3.1 Data de nascimento

```sql
alter table servidor add column if not exists nascimento date;
```

Data civil (`yyyy-mm-dd`), tratada como string em todo o front - nunca vira
`Date` para ser formatada (R8). Exibida por `fmtData`, com a idade calculada
ao lado (`fmtIdade`, função nova em `shared/format.js`, porque toda aritmética
de data mora lá).

### 3.2 A SME como unidade

```sql
alter table unidade_escolar add column if not exists tipo text not null
  default 'escola' check (tipo in ('escola', 'sede'));
```

Mais uma linha, idempotente, com `tipo = 'sede'`, `segmento = null` e
`numero = 0` - número reservado, para a linha ser encontrável sem depender do
nome que aparece na tela.

**Por que assim e não uma tabela `orgao`:** um vínculo com a SME tem
exatamente a mesma forma de um vínculo com escola - pessoa, cargo, início,
fim. Uma tabela separada obrigaria `vinculo` a apontar para dois destinos
possíveis, e esse polimorfismo apareceria em todo model e em toda tela que
hoje faz `join unidade_escolar`. O custo real da alternativa escolhida é uma
linha a mais numa tabela de 145 - e o filtro `tipo = 'escola'` no único lugar
que lista escolas.

**Consequência a respeitar:** `escolas.model.js` passa a filtrar
`tipo = 'escola'`. Quem lista **locais de lotação** (formulário de vínculo,
seletor de Horários) usa a lista completa, com a SME no topo. O filtro por
segmento nunca esconde a sede - ela não tem segmento, e sumir com a equipe da
SME por causa de um filtro de escolas seria o mesmo bug que `lista.js` já
evita hoje para quem é da sede.

### 3.3 O vínculo vira um período

| Antes | Depois |
|---|---|
| `ano int not null` | mantido, preenchido pelo model (ano do ingresso; ano corrente se o ingresso for vazio). Não aparece em nenhuma tela. |
| `ativo boolean` | **removido.** Aberto = `fim is null`. |
| `papel text` (3 valores fixos no código) | **texto livre**, catálogo derivado dos valores em uso. |
| `unique (servidor_id, unidade_id, papel, ano)` | `unique (servidor_id, unidade_id, papel) where fim is null` |

**Por que `ativo` sai:** duas fontes de verdade para o mesmo fato. Um vínculo
com `ativo = false` e `fim = null` é um estado que não significa nada, e existe
hoje na base. Derivar de `fim is null` torna impossível a contradição - é o
pedido (h) levado ao modelo, não só à tela.

**Por que o índice único vira parcial:** o `unique` por ano impedia alguém de
sair de uma escola e voltar no mesmo ano com o mesmo cargo - coisa que
acontece. A versão parcial garante o que realmente importa: **não existem dois
vínculos abertos idênticos**. Histórico fica livre.

**Por que `ano` fica:** é dado já gravado, usado pelo histórico e por
`horario_bloco`. Dropar exigiria reescrever registros por nada. Ele deixa de
ser critério de nada e passa a ser só um carimbo.

Backfill, na ordem:

1. `update vinculo set fim = <31/12 do ano do vínculo> where ativo = false and fim is null;`
2. normaliza `papel`: `gestor → 'Gestor(a)'`, `coordenador → 'Coordenador(a)'`,
   `supervisor → 'Supervisor(a)'`;
3. cria vínculo com a SME para quem tem `lotacao = 'sede'` e `cargo` preenchido
   e ainda não tem vínculo aberto - `ingresso = servidor.inicio_rede`, `papel =
   servidor.cargo`;
4. dropa o `unique` antigo, cria o parcial, dropa a coluna `ativo`;
5. `vw_escola_pessoas` passa a filtrar `where v.fim is null` e a devolver
   `v.papel` cru (o rótulo agora é o próprio valor).

`servidor.cargo` e `servidor.lotacao` **permanecem no banco e param de ser
escritos.** Não são dropados: são o insumo do backfill, estão no `audit_log` e
dropar coluna é irreversível. O front deixa de lê-los.

### 3.4 Degradação sem a migration

O código novo não pode quebrar entre o deploy e a execução do SQL:

- `unidade_escolar.tipo` ausente (`42703`) → trata tudo como `'escola'`; a SME
  simplesmente não aparece no seletor de local.
- `vinculo.ativo` ainda presente → é ignorada na leitura; no insert não é
  enviada e o `default true` cobre.
- `servidor.nascimento` ausente (`42703`) → campo escondido no formulário.

## 4. Kernel - três mudanças pequenas

### 4.1 Rota com parâmetros

`core/registry.js § moduloPorRota` passa a comparar só o trecho antes do `?`;
`core/router.js` entrega `ctx.params` (um `URLSearchParams`) à view. Nada mais
muda: continua sendo roteamento por hash.

Isso habilita `#/servidores?unidade=<id>` e `#/horarios?unidade=<id>` /
`?servidor=<id>` - que é o que os pedidos de "abrir já filtrado" exigem.
Sem isso, a alternativa seria estado global entre módulos, que é pior.

### 4.2 Gaveta empilhada

`shared/ui/drawer.js` ganha uma pilha de um nível de profundidade:

```js
abrirDrawer(html, { voltar })   // `voltar` é uma função que reabre a anterior
```

Quando `voltar` é passado, o cabeçalho ganha um `←` e **Esc / × chamam
`voltar()` em vez de fechar**. Sem `voltar`, o comportamento é o de hoje.

**Por que guardar uma função e não o HTML anterior:** restaurar HTML deixaria
para trás os listeners, que estavam ligados aos elementos substituídos. As
views já sabem se reabrir (`detalhe(id, ctx)`) - a pilha só chama o que já
existe. É também o que garante que a gaveta de baixo volte com **dado
recarregado**, e não com o estado velho de antes da edição.

Comportamento é estado + ciclo de vida, então isto é componente JS e não classe
CSS (R12) - e é o componente que já existe, não um novo.

### 4.3 A gaveta devolve o foco

`ui.md` afirma que a gaveta "devolve o foco", e o código nunca fez isso.
`abrirDrawer` passa a guardar `document.activeElement` e `fecharDrawer` a
restaurá-lo. Correção de acessibilidade, não funcionalidade nova.

## 5. Vocabulário de formulário - uma regra só

**Rótulo sempre acima do campo.** A única exceção é o checkbox, onde o rótulo
fica ao lado (`.inline`, já existente) porque é o que a caixa significa.

Duas classes novas em `styles/components.css`:

| Classe | O que faz |
|---|---|
| `.campos.auto` | `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))` a partir de 560px |
| `.col-full` | o campo ocupa a linha inteira, em qualquer largura |

`auto-fit` + `minmax` resolve os dois pedidos com uma declaração: os campos
refluem conforme a largura **e** um campo sozinho na linha estica até o fim do
container - que é o comportamento pedido e o que `.campos.duas` (grade fixa,
só acima de 1280px) não dá.

`.campos.duas` continua existindo para o que ainda não foi tocado. Some quando
o último uso migrar; não vale uma varredura só para isso.

### Máscaras

`shared/format.js` ganha `mascaraCPF` e `mascaraRG`, e as views ligam o
`input` a elas - mesmo padrão de `phones.js`, sem componente novo.

- **CPF** - `000.000.000-00`.
- **RG** - `00.000.000-0`, aceitando `X` no dígito verificador.

Valor fora do padrão **avisa e deixa salvar** (R15: a situação é indesejável,
não impossível - RG de outro estado tem outro formato, e a SME precisa
cadastrar essa pessoa).

## 6. Módulo Servidores

### 6.1 Formulário da pessoa

Grupos, todos em `.campos.auto`:

| Grupo | Campos |
|---|---|
| Identificação | Nome completo · Apelido · Data de nascimento |
| Documentos | CPF · RG · Código funcional |
| Rede | Ingresso na rede |
| Contato | E-mail (`.col-full`) · Telefones (`.col-full`) |

**Cargo/função e Lotação continuam aparecendo - na ficha e no formulário -
como texto não editável**, cada um com um botão `✎` ao lado que abre a gaveta
do vínculo **por cima** da que está aberta. Esc fecha a de cima e devolve à ficha do servidor, já recarregada
(§ 4.2).

Isso mantém a informação visível onde ela é procurada, sem criar um segundo
lugar onde ela pode ser alterada - a edição acontece no único dono do dado.
Quando não há vínculo aberto, os dois campos mostram "Sem vínculo" e o botão
vira `+ Vincular`.

### 6.2 Formulário do vínculo (criar e editar)

| Campo | Observação |
|---|---|
| Local | escolas (`tipo='escola'`) + **SME - Sede** no topo |
| Cargo/função | select do catálogo dinâmico + `➕ Outro…` que revela um input |
| Início | data civil, opcional |
| Término | data civil, vazio = vínculo aberto |

Sem ano letivo. **Editar vínculo** (pedido g) é o mesmo formulário com os
valores carregados. **Encerrar** deixa de ser um `prompt()` nativo - vira o
mesmo formulário com foco no Término, que é a última quebra de R16 no
repositório.

### 6.3 Catálogo de cargos

`vinculos.model.js § getCargos()` - `select papel from vinculo`, distinto,
ordenado, cacheado, invalidado em toda escrita (padrão de cache do projeto).

Nasce vazio; ganha o valor quando alguém digita um cargo novo; perde o valor
quando o último vínculo daquele cargo deixa de existir. É exatamente o pedido
(c) - e a razão de não ser uma tabela `cargo` administrável: o catálogo não
tem vida própria, ele **é** o conjunto dos cargos em uso.

Normalização ao gravar: aparar espaços e colapsar espaços internos. Não
forçamos caixa - "Coordenador(a)" e "Vice-diretor(a)" são escritos como a SME
escreve. Cargo idêntico ignorando caixa é reaproveitado do catálogo, para não
criar duas entradas que só diferem em maiúscula.

### 6.4 Lotação exibida

Nome do local dos vínculos **abertos** (pedido e). Nenhum → "Sem vínculo".
Mais de um → todos, porque acontece de alguém responder por duas unidades e
esconder isso seria mentir. Vale para o card da lista e para a ficha.

### 6.5 Filtro por escola vindo de fora

`#/servidores?unidade=<id>` abre a lista já restrita à equipe daquela unidade,
com um chip removível dizendo qual é. Removê-lo volta à lista completa; a URL
não é reescrita.

## 7. Módulo Escolas

### 7.1 Ficha (gaveta de detalhe)

```
┌─ NOME DA ESCOLA ─────────────────────────────── × ─┐
│ nome oficial / SAE                                 │
│ [SEGMENTO] [🚌 Transporte] [🌙 EJA] [oferta]       │
│ [✎ Editar] [🕒 Horários da equipe] [🗑 Excluir]    │
├────────────────────────────────────────────────────┤
│ CONTATO E LOCALIZAÇÃO   endereço · telefones · e-mail
│ CADASTROS E LINKS       INEP · regional · site APM │
├────────────────────────────────────────────────────┤
│ EQUIPE (n)                    Gerir em Servidores →│
│ cartões: cargo · nome · e-mail · telefone          │
└────────────────────────────────────────────────────┘
```

O que muda em relação a hoje: os atributos viram **chips no cabeçalho** (eram
linhas "Transporte: Sim", "EJA: Não" - um campo inteiro para dizer "não"), os
campos restantes ganham título de bloco, e a equipe deixa de ser uma lista
solta.

"Gerir em Servidores →" aponta para `#/servidores?unidade=<id>` (pedido).

### 7.2 Formulário

Mesmos grupos de hoje, migrados para `.campos.auto` + `.col-full`, sem
mudança de payload.

### 7.3 Divisão do arquivo

`escolas.view.js` tem 315 linhas e serve três superfícies (lista, ficha,
formulário) - passa do limite de R11. Divide-se por superfície:

```
escolas/
  escolas.view.js        casca: busca, filtros, cards
  views/detalhe.js
  views/formulario.js
```

## 8. Módulo Horários

### 8.1 Duas visões

`horarios.view.js` (311 linhas, no limite) vira casca com `.tabbar` e:

```
horarios/
  horarios.view.js       casca: abas, seletores, estado
  views/por-escola.js    cobertura da unidade + semana de cada servidor
  views/por-servidor.js  semana de uma pessoa, agrupada por local
  views/bloco.js         formulário de bloco (compartilhado pelas duas)
```

- **Por escola** - o que já existe, sem o seletor de ano. A equipe passa a ser
  "quem tem vínculo aberto nesta unidade".
- **Por servidor** - busca a pessoa e mostra a semana dela, com o `+` em cada
  dia. É a resposta ao "não sei onde adicionar horário".

### 8.2 Atalhos

- ficha do servidor → `🕒 Horário de trabalho` → `#/horarios?servidor=<id>`
- ficha da escola → `🕒 Horários da equipe` → `#/horarios?unidade=<id>`

### 8.3 Correções de permissão

A edição hoje exige `perfil.isAdmin`, resquício do modelo binário anterior à
migration 021. Passa a usar `podeEscrever('horarios')`, como todo o resto do
hub. Quem tem nível `proprios` na própria unidade continua barrado pelo RLS -
a tela não é a barreira.

### 8.4 Cobertura da SME

A janela 7h00–18h20 e as lacunas são regra de **escola**. Na visão da sede, a
cobertura não é exibida - só as jornadas. As demais regras (8h/dia, 6h
contínuas, sem sobreposição) valem para todo mundo e continuam no model.

## 9. Filtros das telas iniciais

Segmento continua em chips com atalhos: é multi-escolha, tem memória de sessão
e já resolve o caso comum em um clique. Trocá-lo por select seria uma perda.

Abaixo dele, uma linha `.filtros-linha`:

| Tela | Selects | Toggles |
|---|---|---|
| Servidores | Cargo/função · Lotação | Sem vínculo |
| Escolas | Oferta | Transporte · EJA |

Regra de escolha do elemento: **escolha única entre muitos → select; liga/
desliga → toggle switch.** O chip fica para multi-escolha.

O toggle é markup sem comportamento - `input[type=checkbox]` estilizado por
`.switch` em `components.css`, não componente JS (R12).

Em tela estreita a linha vira grade de duas colunas; abaixo de 400px, uma
coluna. O contador ("72 de 210") continua onde está.

## 10. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/023_servidores_vinculos.sql` | criar |
| `src/core/router.js`, `src/core/registry.js` | query na rota |
| `src/shared/ui/drawer.js` | pilha + devolução de foco |
| `src/shared/format.js` | `fmtIdade`, `mascaraCPF`, `mascaraRG` |
| `src/styles/components.css` | `.campos.auto`, `.col-full`, `.switch`, `.filtros-linha` |
| `src/modules/servidores/servidores.model.js` | lotação derivada; para de escrever cargo/lotacao |
| `src/modules/servidores/vinculos.model.js` | criar - vínculo + catálogo de cargos |
| `src/modules/servidores/views/{lista,formulario,detalhe}.js` | reescrever |
| `src/modules/servidores/views/vinculo.js` | criar |
| `src/modules/escolas/escolas.model.js` | filtrar `tipo='escola'`; expor `getLocais()` |
| `src/modules/escolas/{escolas.view.js,views/*}` | dividir e reescrever |
| `src/modules/horarios/{horarios.view.js,views/*}` | dividir e reescrever |
| `src/modules/horarios/horarios.model.js` | cobertura só para escola |
| `src/modules/meus-dados/meus-dados.view.js` | cargo e vínculos vêm do vínculo aberto |

Dois models no módulo `servidores` é legítimo: ele é dono de dois agregados, e
R2 prevê exatamente esse caso (como `sate/`).

## 11. Riscos

| Risco | Mitigação |
|---|---|
| Migration aplicada à mão em janela diferente do deploy | degradação por `42703` (§ 3.4) |
| Cargo livre gera duplicatas ("Coordenadora" / "coordenadora") | reaproveitamento por comparação sem caixa (§ 6.3) |
| Backfill da sede criar vínculo errado | condicionado a `lotacao='sede'` **e** `cargo` preenchido **e** sem vínculo aberto; migration idempotente |
| Alguém depender de `vinculo.ativo` | grep confirmou 3 usos, todos nos arquivos já reescritos |

## 12. Fora de escopo

Afastamentos, SATE, Calendário, Projetos, Visitas, Ocorrências e Atas não são
tocados. Identidade de cor por módulo (R14) continua não implementada. A
documentação por módulo é assunto de outra spec.

## 13. Critérios de aceite

1. Servidor tem data de nascimento, gravada e exibida com a idade.
2. Nenhum formulário de Servidores ou Escolas tem rótulo ao lado do campo,
   exceto checkbox; um campo sozinho na linha ocupa o container inteiro.
3. O select de cargo nasce vazio numa base sem vínculos e reflete exatamente os
   cargos em uso.
4. RG e CPF são mascarados; valor fora do padrão avisa e salva.
5. A lotação exibida é o nome do local do vínculo aberto - escola ou SME.
6. Vínculo se cria e se edita com local, cargo, início e fim, sem ano letivo.
7. Vínculo sem data de fim aparece como aberto; com data, como encerrado.
8. Na ficha do servidor, `✎` ao lado de Cargo e de Lotação abre a gaveta do
   vínculo por cima, e Esc volta para a ficha atualizada.
9. "Gerir em Servidores" abre a lista filtrada pela escola de origem.
10. Existe um caminho visível para adicionar horário a partir do servidor.
11. `python .claude/scripts/verificar_arquitetura.py` sem violações.
12. Testado em 375px, 768px e 1280px, console limpo.
