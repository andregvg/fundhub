# FundHub - Fichas entre módulos: navegar sem sair do lugar

> Decisões tomadas em 13/09/2026, com o André. Entrega prevista como MINOR
> (0.30.0): contrato novo no manifesto, sem migration.
>
> Continua `2026-09-08-listas-e-modais-design.md` (o modal e a pilha com
> `voltar`) e `2026-09-05-local-de-trabalho-design.md` (servidor × escola
> pelo vínculo).

## 1. O problema

Escola e servidor são as duas fichas mais consultadas do hub, e cada uma
aponta para a outra - mas só com texto:

1. **Na ficha da escola, a equipe é uma lista morta.** Ver os dados de um
   membro obriga a fechar a ficha, ir a Servidores, buscar o nome e abrir a
   ficha dele. O caminho de volta é o mesmo, ao contrário.
2. **Na ficha do servidor, o local de trabalho também é só texto.**
3. **O card da equipe tem ruído e um defeito.** O apelido aparece ao lado do
   nome completo (o apelido serve para *achar* a pessoa numa lista, não para
   identificá-la numa ficha - a ficha do servidor já o tirou pelo mesmo
   motivo), e o telefone sai **cru**, sem máscara: vem de
   `vw_escola_pessoas`, que devolve o número como gravado (E.164), e a tela
   o imprime sem passar por `exibirTelefone`.

Há dois obstáculos de arquitetura, e são eles que decidem o desenho:

- **`vw_escola_pessoas` não traz o id do servidor.** Sem ele não há o que
  abrir.
- **A ficha do servidor não existe fora da tela de Servidores.** `detalhe(id,
  ctx)` recebe da casca `lista`, `cargos`, `locais` e `recarregar`, que é o
  estado da página. Chamada por cima de Escolas, não teria nada disso.
- **R2:** Escolas não pode importar `servidores/views/*`, nem o contrário.

## 2. Abordagens consideradas

| | Abordagem | Veredito |
|---|---|---|
| **1** | **Ficha declarada no manifesto**, aberta pelo kernel por cima da tela atual, empilhando com `voltar` | **Escolhida** |
| 2 | Link para a rota do outro módulo (`#/servidores?servidor=<id>`) com a ficha aberta | Tira a pessoa da tela; voltar à ficha de origem exigiria gravar estado de modal na URL; editar a partir da escola cairia no contexto de Servidores |
| 3 | Uma view importa a view do outro módulo | Viola R2 |

A 1 é a navegação "sem sair do lugar" pedida, e usa só peças que já
existem: a inversão pelo manifesto (`load`, `config`) e a pilha de modais
(`voltar`). A 2 continua possível no futuro **por cima** da 1 - um
`?servidor=` que chame a mesma `abrirFicha` - se link copiável fizer falta.

## 3. Decisões

### D1 - `ficha` é um campo do manifesto

```js
// modules/servidores/module.js
ficha: () => import('./views/detalhe.js'),
```

O arquivo apontado exporta **`abrir(id, opts)`**. É a mesma inversão de
`load()` e `config()`: o kernel conhece o manifesto, o módulo dono responde.
Nenhuma view importa view de outro módulo, e nenhuma exceção nova entra na
tabela de `arquitetura.md` - o kernel não faz `import()` de caminho de
módulo, só chama a função que o manifesto declarou.

Nasce em **dois** módulos (Escolas e Servidores). Não é abstração
especulativa (R13): é o contrato de uma navegação que já tem dois lados reais
no primeiro dia, e o terceiro candidato óbvio (Horários, SATE) só precisa
declarar o campo.

### D2 - `podeAbrirFicha` no registry, `abrirFicha` no roteador

```js
podeAbrirFicha(moduloId)            // core/registry.js → boolean
abrirFicha(moduloId, id, opts)      // core/router.js   → Promise<boolean>
```

- `podeAbrirFicha`: o módulo existe, está ativo, declara `ficha` e o nível
  efetivo **não é `oculto`**. É **fato sobre o módulo** - mora ao lado de
  `veModulo` e `nivelEfetivo`. A view o usa para decidir se o card vira
  clicável.
- `abrirFicha`: confere `podeAbrirFicha`, carrega a ficha sob demanda e chama
  `abrir(id, opts)`. É **navegação**, e navegação é do controller - mora ao
  lado de `route()`, que faz a mesma inversão com `mod.load()`.

> **Revisto em 13/09/2026, na mesma entrega.** A primeira versão pôs as duas
> no registry "por proximidade". Na revisão de modularidade, o registry
> ficou sendo o catálogo (o que é verdade sobre os módulos) e o roteador o
> despachante (o que acontece quando alguém navega) - a fronteira que já
> existia entre os dois.

**Não é controle de acesso:** esconder o clique é conforto; quem barra a
leitura do servidor é o RLS (R6).

**`abrirFicha` nunca falha em silêncio.** O GitHub Pages guarda cada arquivo
na CDN por até 10 minutos, **um a um**: logo depois de um deploy, a ficha nova
de um módulo pode carregar a ficha antiga do outro, que ainda não exporta
`abrir`. É a causa mais provável do primeiro teste no dev, em que o clique
não fazia nada (mecanismo confirmado nos cabeçalhos da CDN; o caso exato não
foi reproduzido no login real).
Agora import que falha ou ficha sem `abrir` vira um aviso pedindo para
recarregar a página, e erro dentro de `abrir` vira `reportarErro`.

### D3 - A ficha é autossuficiente

`abrir(id, opts)` monta o próprio contexto a partir dos **models**, que já
guardam cache - não depende de estar dentro da tela do módulo:

| Ficha | Lê |
|---|---|
| Servidor | `getServidores()`, `getCargos()`, `getLocais()`, `podeEscrever('servidores')` |
| Escola | `getUnidades()`, `getEquipeDaUnidade()`, `podeEscrever('escolas')` |

As próprias telas de Escolas e Servidores passam a abrir a ficha **por esse
mesmo `abrir`**. Um caminho só: a ficha que abre por cima de outro módulo é
exatamente a que abre na lista, e não uma segunda versão que envelhece
diferente.

### D4 - O contrato de `opts`

```js
abrir(id, { voltar = null, editar = false, aoMudar = null })
```

| Opção | Efeito |
|---|---|
| `voltar` | Função que reabre o modal de baixo - o padrão da pilha. A ficha a repassa para **tudo** que ela mesma empilha e reabre (editar, local de trabalho, excluir), para o ← nunca perder o caminho até a origem. |
| `editar` | Abre direto o **formulário de edição** em vez da ficha, com o `voltar` de quem chamou. Sem permissão de escrita, cai na ficha. |
| `aoMudar` | Chamada depois de qualquer gravação feita dentro da pilha, para a **tela de baixo** repintar (a lista de Servidores, a contagem nos cards de Escolas). A ficha a repassa às fichas que abrir. |

`id` que não existe (excluído por outra pessoa, sem permissão de leitura):
`abrir` não abre nada e avisa por toast.

### D5 - A equipe da escola vem do model de vínculos

A seção **Equipe** da ficha da escola passa a ler
`getEquipeDaUnidade(u.id)` (`servidores/vinculos.model.js`) em vez de
`u.pessoas` (`vw_escola_pessoas`). Resolve três coisas de uma vez, **sem
migration**:

1. traz o **id** do servidor;
2. traz os **telefones como objetos**, que passam por `exibirTelefone` - a
   máscara que o hub inteiro usa;
3. é o cache que **toda gravação em servidor ou vínculo invalida**. Editar
   um membro por cima da escola e voltar mostra a equipe já atualizada; a
   view antiga ficaria velha até recarregar a página.

`u.pessoas` continua existindo e continua alimentando a **busca** da lista de
escolas ("buscar por gestor") - é leitura de lista, não de ficha.

O cargo exibido é o do(s) vínculo(s) aberto(s) **nesta** escola
(`rotulaCargo`), não o `cargoDe(s)` geral - quem responde por duas unidades
aparece em cada uma com o cargo que tem ali. O telefone é o principal, ou o
primeiro.

**Essas duas regras são do vínculo, e por isso moram no model de vínculos**,
que devolve a equipe já pronta para leitura (`{ id, nome, cargo, email,
telefone }`). A primeira versão as calculava dentro da ficha da escola - uma
tela de Escolas conhecendo a estrutura do vínculo de Servidores (R3). Saiu
junto o fallback para `u.pessoas`: duas fontes para a mesma lista, e inútil na
prática, porque a view lê a mesma tabela `servidor` sob o mesmo RLS. Falha ao
carregar a equipe agora mostra erro, não uma lista paralela.

### D6 - Os cards

**Card da equipe (ficha da escola):**

- **cargo** · **nome** (sem apelido) · e-mail · telefone principal com máscara
  e `tel:` em E.164 - o mesmo desenho de `telefonesTexto`;
- o card inteiro abre a ficha do servidor, com `voltar` para esta escola;
- com escrita em Servidores, um botão **✎ Editar servidor** no canto abre
  direto o formulário (`editar: true`), com `voltar` para esta escola.

**Card do local de trabalho (ficha do servidor):**

- se o local é **escola** e Escolas não está oculto, o card inteiro abre a
  ficha da escola, com `voltar` para este servidor;
- locais internos (Sede, gerências) não têm ficha: o card fica como está;
- os botões de editar/excluir o vínculo continuam onde estão e continuam
  fazendo o que fazem.

### D7 - Card clicável: o padrão "link esticado"

O card tem filhos interativos (e-mail, telefone, botões) - então **não pode**
ser um `<button>` nem um `div role="button"`: elemento interativo dentro de
elemento interativo é inválido e o leitor de tela o lê errado.

O desenho é o **link esticado**:

- o **nome** é um `<button type="button" class="person-abrir">` de verdade,
  com `aria-label` ("Abrir ficha de …"): é o alvo de teclado e de leitor;
- `.person-abrir::after { position: absolute; inset: 0 }` estende a área
  de clique ao card inteiro;
- os demais links e botões do card sobem com `position: relative; z-index: 1`
  e continuam clicáveis por cima.

Sem JS de delegação de clique, sem checar `e.target.closest('a')`, com Tab e
Enter de graça. Vira vocabulário comum: **`.person.clicavel`** +
**`.person-abrir`** + **`.person-acoes`** em `components.css`.

## 4. Fluxos

```
Escolas (lista) ─card─▶ Ficha da escola
                          ├─card da equipe─▶ Ficha do servidor  (← escola)
                          │                    ├─Editar─▶ Formulário (← servidor ← escola)
                          │                    └─card do local─▶ Ficha da escola (← servidor ← escola)
                          └─✎ no card──────▶ Formulário do servidor (← escola)

Servidores (lista) ─card─▶ Ficha do servidor
                             └─card do local─▶ Ficha da escola (← servidor)
                                                 └─card da equipe─▶ Ficha do servidor (← escola ← servidor)
```

Salvar num formulário aberto com `voltar` reabre o nível de baixo **com dado
recarregado** (o comportamento que a pilha já tem); `aoMudar` repinta a tela
por trás.

## 5. Arquivos

| Arquivo | Mudança |
|---|---|
| `core/registry.js` | `podeAbrirFicha`, `moduloPorId`; `ficha` no cabeçalho dos campos |
| `core/router.js` | `abrirFicha`, com a guarda de versão misturada |
| `modules/servidores/vinculos.model.js` | `getEquipeDaUnidade` |
| `modules/escolas/module.js`, `modules/servidores/module.js` | `ficha: () => import('./views/detalhe.js')` |
| `modules/escolas/views/detalhe.js` | `abrir(id, opts)`; equipe via `getServidoresDaUnidade`; card novo |
| `modules/escolas/escolas.view.js` | card da lista chama `abrir`; `ctxAtual` só para "Nova escola" |
| `modules/servidores/views/detalhe.js` | `abrir(id, opts)` + contexto próprio; `opts` repassado nas reaberturas; card do local clicável |
| `modules/servidores/servidores.view.js` | card da lista e `abrirDetalhe` chamam `abrir` |
| `styles/components.css` | `.person.clicavel`, `.person-abrir`, `.person-acoes` |
| `.claude/rules/modulo-novo.md`, `.claude/rules/ui.md` | campo `ficha`; vocabulário do card clicável |
| `docs/modulos/escolas.md`, `docs/modulos/servidores.md` | passo a passo novo (R: documentação) |

## 6. Fora de escopo

- Link copiável para ficha (`?servidor=`, `?escola=`) - abordagem 2, só
  quando fizer falta.
- Fichas de outros módulos (SATE, Horários, Afastamentos) - basta declarar
  `ficha` quando chegar a vez de cada um.
- Mudar `vw_escola_pessoas` - deixa de alimentar a ficha, mas segue servindo a
  busca.

## 7. Verificação

- Escola → card → ficha do servidor → ← volta à escola.
- Escola → ✎ → formulário → Salvar → volta à escola com o dado novo.
- Escola → servidor → Editar → Salvar → servidor → ← → escola.
- Servidor → card da escola → ficha da escola → ← → servidor.
- Local interno (Sede) no servidor: card sem clique.
- Perfil sem acesso a Servidores: cards da equipe sem clique e sem ✎.
- Tab alcança o nome e o ✎; Enter abre; e-mail e telefone continuam links.
- Telefone com máscara; apelido fora do card.
- Tela estreita; `python .claude/scripts/verificar_arquitetura.py` limpo.
