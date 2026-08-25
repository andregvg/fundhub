# FundHub — Ajuda: documentação por módulo

> Decisões tomadas em 25/08/2026. Cria um módulo **Ajuda** com tutoriais de uso
> escritos em Markdown, um por módulo, visíveis conforme a permissão de cada
> pessoa. Entrega prevista como MINOR (módulo novo).

## 1. O problema

O FundHub tem 17 módulos e **nenhuma documentação para quem usa**. O módulo
`docs` que existe (`#/docs`, restrito a admin) é outra coisa: descreve
arquitetura, camadas, migrations e RLS — foi escrito para quem mantém o
código.

Quem opera o sistema hoje aprende por tentativa. E há regras que não são
adivinháveis olhando a tela: que encerrar um vínculo preserva o histórico e
excluir não; que 6h contínuas é aviso e 8h no dia é erro; que o filtro de
segmento é conveniência e não restrição de acesso.

## 2. Escopo

Um módulo **Ajuda** que:

1. lista os módulos que a pessoa enxerga **e** que têm tutorial;
2. abre o tutorial daquele módulo, renderizado a partir de um `.md` do
   repositório;
3. é alcançável de qualquer tela, pelo `?` no topo, já apontando para o módulo
   em que a pessoa está.

Nesta rodada, tutoriais de **Usuários, Escolas, Servidores e Horários**.

## 3. Decisões

### 3.1 Markdown de verdade, renderizado por leitor próprio

Os tutoriais são arquivos `.md` normais em `docs/modulos/<id>.md`: legíveis no
GitHub, editáveis por qualquer pessoa, revisáveis em diff. Um leitor enxuto
converte para HTML no navegador.

**Por que não HTML em `.js`** (o padrão do `docs.content.js` atual): escrever
tutorial dentro de template literal com `<p>` e `<li>` é hostil para quem vai
manter o texto, e essa pessoa não é necessariamente quem programa. O conteúdo
precisa poder ser corrigido sem tocar em código.

**Por que um leitor próprio:** o FundHub não tem build nem pode ganhar
dependência — é restrição arquitetural, não preferência. Um leitor do
subconjunto que os tutoriais usam cabe em ~120 linhas.

Subconjunto suportado, e apenas ele:

| Elemento | Sintaxe |
|---|---|
| Títulos | `#` a `###` |
| Ênfase | `**forte**`, `*ênfase*`, `` `código` `` |
| Listas | `- ` e `1. `, um nível de aninhamento |
| Tabelas | pipe, no estilo GFM |
| Nota | `> ` no começo da linha → bloco destacado |
| Bloco de código | cerca de três crases |
| Link | `[texto](url)` |
| Régua | `---` |

Fora do subconjunto: HTML cru (ignorado, escapado), imagens, notas de rodapé,
listas de tarefas. Se um tutorial precisar de algo fora disso, a pergunta certa
é se o tutorial não está complicado demais.

**Segurança:** o texto é escapado **antes** de qualquer conversão, e só as
tags que o próprio leitor gera existem no resultado. Um `.md` não consegue
injetar HTML mesmo que alguém escreva `<script>` nele. É o mesmo princípio de
`esc()` (R5), aplicado na direção certa: escapar primeiro, formatar depois.

### 3.2 O leitor mora no módulo, não em `shared/`

`modules/ajuda/markdown.js`. Tem exatamente um consumidor, e R13 é clara:
utilitário nasce no terceiro caso concreto. Se um segundo módulo precisar
renderizar Markdown, ele se muda para `shared/` — e aí terá dois casos reais
em vez de uma previsão.

### 3.3 Permissão: nenhum mecanismo novo

O manifesto ganha um campo opcional `doc: true`.

A tela de Ajuda lista os módulos em que `nivel(chavePerm(mod)) !== OCULTO` e
`mod.doc === true`. Quem não enxerga Usuários não vê o tutorial de Usuários —
não porque a Ajuda decide, mas porque ela pergunta a `core/permissoes.js`, a
mesma fonte que monta o menu e barra a rota.

Um `#/ajuda?m=<id>` de módulo oculto responde como o roteador já responde:
a mesma mensagem de "não encontrado", sem confirmar que o módulo existe.

**O módulo Ajuda em si é visível a todos** — não entra no mapa de permissões,
como `meus-dados`. Documentação de uso não é informação restrita, e uma tela
de ajuda que exige permissão para ser aberta é uma piada de mau gosto.

### 3.4 O `?` mora na moldura, não nas views

`shell/chrome.js` insere um botão `?` no topo, ao lado do sino, apontando para
`#/ajuda?m=<módulo da rota atual>`. O shell já recebe a rota corrente em
`marcarNav(hash)`.

**Por que não um botão em cada `page-head`:** seriam 17 views alteradas para um
elemento que é o mesmo em todas, e a 18ª nasceria sem ele. A moldura é o lugar
de tudo que é igual em toda tela — foi por isso que ela existe.

Quando a rota atual não tem tutorial, o `?` leva ao índice da Ajuda.

### 3.5 O módulo `docs` continua, com outro nome no menu

`docs` passa a se chamar **"Docs técnicos"** na navegação (o nome completo
vira "Documentação técnica"). Segue restrito a admin. São dois públicos
diferentes e agora dois lugares distintos — misturá-los faria a pessoa que
procura "como cadastro um vínculo" cair numa tabela de migrations.

### 3.6 Como o tutorial se mantém atualizado

Documentação envelhece em silêncio: ninguém percebe que ela mentiu até
alguém seguir o passo a passo e o botão não estar lá. Três mecanismos, do mais
forte ao mais fraco:

**1. Regra de trabalho — `.claude/rules/documentacao.md` (novo) e uma linha na
tabela de `CLAUDE.md`.**

> Mexeu na tela, no fluxo ou numa regra de negócio de um módulo com
> `doc: true`? O `docs/modulos/<id>.md` correspondente é atualizado **no mesmo
> commit**. Mudança de layout que não altera o que a pessoa faz não conta;
> campo novo, botão novo, passo a mais, regra que passou a bloquear — conta.

Este é o mecanismo que de fato automatiza: as regras de `.claude/rules/` são
lidas a cada sessão e passam a fazer parte do critério de "pronto". A rodada de
Servidores/Escolas/Horários é o primeiro teste — ela altera os três tutoriais
que estão sendo criados.

**2. Checagem mecânica de defasagem** (parte da checagem 11, § 3.7).
O script compara a data do último commit que tocou `src/modules/<id>/` com a
do último que tocou `docs/modulos/<id>.md`. Código mais novo que tutorial vira
**aviso** — não bloqueia, porque nem toda mudança de código muda o que o
usuário faz, e um bloqueio que se aprende a ignorar não é um bloqueio.

**3. Carimbo visível.** Cada tutorial termina com `> Atualizado na versão
X.Y.Z.`, exibido pela tela de Ajuda. Quem lê sabe de quando é o texto, e a
distância para a versão do rodapé é uma denúncia que não depende de ferramenta.

**Por que não um hook que edite o `.md` sozinho:** um tutorial gerado
automaticamente a partir do código descreve o que o código faz, não o que a
pessoa precisa saber — e a parte que importa ("encerrar preserva o histórico,
excluir não") não está em lugar nenhum de onde se possa extraí-la. O que dá
para automatizar é a **cobrança**, e é o que estes três fazem.

### 3.7 Uma checagem mecânica a mais

`verificar_arquitetura.py` ganha a décima primeira checagem, em três partes:

| | Situação | Severidade |
|---|---|---|
| a | módulo com `doc: true` sem `docs/modulos/<id>.md` | **bloqueia** |
| b | `.md` na pasta sem módulo correspondente com `doc: true` | **bloqueia** |
| c | último commit em `src/modules/<id>/` mais novo que o do `.md` | aviso |

(a) e (b) evitam o modo de falha óbvio: marcar `doc: true` antes de escrever o
texto, ou renomear um módulo e deixar o tutorial órfão. (c) é o detector de
defasagem do § 3.6 — usa `git log -1 --format=%ct` nos dois caminhos e não
custa nada.

## 4. Forma do tutorial

Todo `docs/modulos/<id>.md` segue a mesma espinha — previsibilidade importa
mais que criatividade num texto de referência:

```markdown
# <Nome do módulo>

> Uma frase dizendo para que serve.

## O que dá para fazer aqui
## Quem pode o quê
## Passo a passo
### <Tarefa>
## Regras que o sistema aplica
## Ligações com outros módulos
## Perguntas frequentes
```

Regras de escrita:

- **Escrito para quem usa**, não para quem programa. Nenhum nome de arquivo,
  de tabela, de função ou de coluna. "O sistema guarda" e não "o Postgres
  grava".
- **Passo a passo é numerado e literal** — nomeia o botão como ele aparece na
  tela.
- **"Regras que o sistema aplica"** diz o que bloqueia (erro) e o que só avisa
  (aviso), com o motivo. É a seção que resolve o problema real de hoje.
- **"Ligações com outros módulos"** diz de onde vem cada dado que a tela mostra
  mas não é dona, e para onde o que se cadastra ali repercute.
- **Nenhum dado real** (R7): exemplos são inventados — "Escola Exemplo",
  `nome@exemplo.com`, `(00) 00000-0000`. O repositório é público.
- Quando a tela mudar, o tutorial muda **no mesmo commit**. Documentação que
  descreve uma tela que não existe mais é pior que nenhuma.

## 5. Conteúdo desta rodada

| Tutorial | Assuntos que precisa cobrir |
|---|---|
| `escolas.md` | buscar e filtrar; ler a ficha; cadastrar e editar; de onde vem a equipe (é do vínculo, editada em Servidores); segmento como conveniência e não restrição |
| `servidores.md` | cadastrar pessoa; vincular a escola ou à SME; editar e encerrar vínculo; encerrar ≠ excluir; cargo vem do vínculo; lotação é o local do vínculo aberto |
| `horarios.md` | as duas visões; adicionar bloco; por que jornada é bloco e não entrada/saída; 8h/dia é erro, 6h contínuas é aviso; cobertura 7h00–18h20 |
| `usuarios.md` | allowlist: quem entra; os quatro níveis por módulo; segmentos de atuação; o que o histórico registra e por que não se apaga |

Os três primeiros descrevem as telas **depois** da rodada de Servidores/
Escolas/Horários — daí esta spec vir depois daquela.

## 6. Arquivos

| Arquivo | Ação |
|---|---|
| `docs/modulos/{escolas,servidores,horarios,usuarios}.md` | criar |
| `src/modules/ajuda/module.js` | criar — manifesto |
| `src/modules/ajuda/ajuda.view.js` | criar — índice + leitor |
| `src/modules/ajuda/markdown.js` | criar — leitor de Markdown |
| `src/modules/ajuda/ajuda.css` | criar (+ `@import` em `styles/main.css`) |
| `src/core/registry.js` | registrar o módulo |
| `src/shell/chrome.js` | botão `?` no topo |
| `src/modules/{escolas,servidores,horarios,usuarios}/module.js` | `doc: true` |
| `src/modules/docs/module.js` | renomear para "Documentação técnica" |
| `.claude/scripts/verificar_arquitetura.py` | checagem 11 (três partes) |
| `.claude/rules/documentacao.md` | criar — regra de manutenção |
| `CLAUDE.md` | linha na tabela de regras sob demanda |

O módulo Ajuda é **agregador**: tem tela e não tem dados próprios nem model,
como `dashboard` e `viagens`. Lê o registro e as permissões, e busca arquivos
estáticos. Não fala com o banco.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Tutorial envelhecer em relação à tela | regra de commit único (§ 4) + checagem 11 |
| `.md` ausente em produção (deploy parcial) | erro tratado: "tutorial ainda não disponível", nunca tela quebrada |
| Leitor de Markdown virar projeto paralelo | subconjunto fechado (§ 3.1); precisa de mais? o texto é que está errado |
| Dado real escapar num exemplo | `verificar_arquitetura.py § check_pii` já varre `docs/`; conferir `git diff --cached` |

## 8. Critérios de aceite

1. `#/ajuda` lista só os módulos que a pessoa enxerga e que têm tutorial.
2. O `?` do topo abre a ajuda do módulo em que a pessoa está.
3. Os quatro tutoriais renderizam títulos, listas, tabelas, notas e código.
4. Um `.md` contendo `<script>` aparece como texto, não executa.
5. `#/ajuda?m=<módulo oculto>` responde como rota inexistente.
6. Nenhum dado real nos tutoriais.
7. `python .claude/scripts/verificar_arquitetura.py` sem violações, incluindo a
   checagem nova nas três partes.
8. Cada tutorial termina com o carimbo de versão, exibido na tela.
9. `.claude/rules/documentacao.md` existe e está referenciado em `CLAUDE.md`.
10. Legível em 375px.
