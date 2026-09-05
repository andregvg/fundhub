# FundHub - Ajuda: instruções de uso por módulo

> Decisões tomadas em 05/09/2026. Bloco B da rodada de melhorias.
>
> **Substitui `2026-08-25-ajuda-documentacao-por-modulo-design.md`**, que foi
> desenhada e nunca implementada. Aquela spec continua valendo no essencial - o
> que muda aqui está em § 2, e é consequência de a barra de ações do módulo
> passar a existir (Bloco A, D8).
>
> Depende do Bloco A **apenas** pela barra de ações. Se o Bloco B for
> implementado primeiro, é ele quem cria a barra e o A só acrescenta a
> engrenagem.

## 1. O problema (inalterado desde 25/08/2026)

O FundHub tem 17 módulos e nenhuma documentação para quem usa. O módulo `docs`
(`#/docs`, restrito a admin) descreve arquitetura, camadas, migrations e RLS -
foi escrito para quem mantém o código.

Quem opera aprende por tentativa, e há regras que não são adivinháveis olhando
a tela: que encerrar um vínculo preserva o histórico e excluir não; que 6h
contínuas é aviso e 8h no dia é erro; que o filtro de segmento é conveniência e
não restrição de acesso.

## 2. O que muda em relação à spec de 25/08

| | 25/08/2026 | Agora | Por quê |
|---|---|---|---|
| Onde fica o botão | `?` na barra de topo, ao lado do sino | ícone na **barra de ações do módulo**, ao lado da engrenagem | a barra passou a existir (Bloco A, D8); o botão fica junto do conteúdo a que se refere, não do relógio do app |
| Quem vê o tutorial | quem enxerga o módulo | **inalterado** - ver § 3.3 | o item 10 do pedido diz "permissão de edição", o que seria um engano; ver a justificativa |
| Nome do módulo | Ajuda | **Ajuda** (confirmado em 05/09) | curto, cabe no menu, casa com o ícone de interrogação |
| Módulo no menu e em "Todos os Módulos" | consequência do manifesto | **explicitado como requisito** (item 10) | já sai de graça: `nav: true` + registro |

Todo o resto - leitor de Markdown próprio, `docs/modulos/<id>.md`, campo
`doc: true`, checagem 11, regra de manutenção, forma do tutorial - fica como
está lá e é resumido abaixo para esta spec ser autossuficiente.

## 3. Decisões

### 3.1 Markdown de verdade, lido por um leitor próprio

Os tutoriais são `.md` em `docs/modulos/<id>.md`: legíveis no GitHub, editáveis
por quem não programa, revisáveis em diff. Um leitor de ~120 linhas
(`modules/ajuda/markdown.js`) converte no navegador - o hub não tem build nem
pode ganhar dependência.

Subconjunto suportado, e só ele: títulos `#`–`###`, `**forte**`, `*ênfase*`,
`` `código` ``, listas `-` e `1.` com um nível de aninhamento, tabelas GFM,
citação `>` como bloco destacado, cerca de três crases, `[texto](url)`, `---`.

**Segurança:** o texto é escapado **antes** de qualquer conversão, e só as tags
que o próprio leitor gera existem no resultado. Um `.md` com `<script>` aparece
como texto. É o princípio da R5 aplicado na ordem certa: escapar primeiro,
formatar depois.

O leitor mora no módulo, não em `shared/` - tem um consumidor só (R13). Se um
segundo aparecer, ele se muda, e aí serão dois casos reais em vez de uma
previsão.

### 3.2 O botão na barra de ações

O manifesto ganha `doc: true`. O roteador, ao montar a barra (Bloco A, D8),
inclui o botão de ajuda para todo módulo que declara `doc`, apontando para
`#/ajuda?m=<id>`.

Dois botões, mesma barra, ordem fixa em toda tela: **ajuda à esquerda,
engrenagem à direita** - o mais consultado primeiro, e a ordem nunca muda de
módulo para módulo.

Clicar navega para a Ajuda daquele módulo (não abre gaveta): um tutorial é
texto para ler com calma, às vezes lado a lado com a tela em outra aba, e uma
gaveta de 400px sobre a tela é o formato errado para isso. A engrenagem, ao
contrário, abre gaveta - configurar é uma interrupção curta, e voltar para onde
se estava importa.

### 3.3 Permissão: ver o módulo basta

A tela lista os módulos em que `nivel(chavePerm(mod)) !== OCULTO` **e**
`mod.doc === true`. Quem não enxerga Usuários não vê o tutorial de Usuários -
não porque a Ajuda decida, mas porque ela pergunta a `core/permissoes.js`, a
mesma fonte que monta o menu e barra a rota.

`#/ajuda?m=<id de módulo oculto>` responde como o roteador responde a rota
inexistente, sem confirmar que o módulo existe.

> **Divergência deliberada do pedido.** O item 10 pede "usuários só acessam as
> configurações dos módulos que têm permissão de edição" - texto herdado do item
> 9, que trata de configurações. Aplicado a tutorial, ele produziria o absurdo
> de esconder o manual de quem só consulta: exatamente quem mais precisa dele.
> A regra aqui é: **enxergou o módulo, leu o tutorial**.

O módulo Ajuda em si é visível a todos - entra no mapa de permissões como
`escrita` para todos os papéis, como `meus-dados`.

### 3.4 O módulo `docs` continua, com outro nome

`docs` passa a se chamar **"Documentação técnica"** ("Docs técnicos" no menu) e
segue restrito a admin. São dois públicos e agora dois lugares: quem procura
"como cadastro um vínculo" não pode cair numa tabela de migrations.

### 3.5 Como o tutorial não envelhece em silêncio

Três mecanismos, do mais forte ao mais fraco:

**1. Regra de trabalho** - `.claude/rules/documentacao.md` (novo) e uma linha na
tabela de `CLAUDE.md`:

> Mexeu na tela, no fluxo ou numa regra de negócio de um módulo com `doc:
> true`? O `docs/modulos/<id>.md` correspondente é atualizado **no mesmo
> commit**. Layout que não muda o que a pessoa faz não conta; campo novo, botão
> novo, passo a mais, regra que passou a bloquear - conta.

Os blocos E, F e G desta mesma rodada são o primeiro teste da regra: cada um
altera telas que terão tutorial, e cada um escreve/atualiza o seu no mesmo
commit (§ 5).

**2. Checagem mecânica de defasagem** (checagem 11, parte c): o script compara
a data do último commit em `src/modules/<id>/` com a do `.md`. Código mais novo
que tutorial vira **aviso** - não bloqueia, porque nem toda mudança de código
muda o que a pessoa faz, e bloqueio que se aprende a ignorar não é bloqueio.

**3. Carimbo visível.** Cada tutorial termina com `> Atualizado na versão
X.Y.Z.`, exibido na tela. A distância para a versão do rodapé é uma denúncia
que não depende de ferramenta.

**Por que não gerar o tutorial do código:** o que importa num tutorial
("encerrar preserva o histórico, excluir não") não está em lugar nenhum de onde
se possa extrair. O que dá para automatizar é a **cobrança**.

### 3.6 A checagem 11

| | Situação | Severidade |
|---|---|---|
| a | módulo com `doc: true` sem `docs/modulos/<id>.md` | **bloqueia** |
| b | `.md` na pasta sem módulo correspondente com `doc: true` | **bloqueia** |
| c | último commit em `src/modules/<id>/` mais novo que o do `.md` | aviso |

## 4. Forma do tutorial

Todo `docs/modulos/<id>.md` segue a mesma espinha - previsibilidade importa
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

- **Escrito para quem usa**, não para quem programa: nenhum nome de arquivo, de
  tabela ou de coluna. "O sistema guarda", não "o Postgres grava".
- **Passo a passo numerado e literal**, nomeando o botão como ele aparece.
- **"Regras que o sistema aplica"** separa o que bloqueia (erro) do que só
  avisa, com o motivo. É a seção que resolve o problema real.
- **"Ligações com outros módulos"** diz de onde vem cada dado que a tela mostra
  mas não é dona.
- **Nenhum dado real** (R7): "Escola Exemplo", `nome@exemplo.com`,
  `(00) 00000-0000`.

## 5. Conteúdo desta rodada

O mecanismo entra com quatro tutoriais de módulos **estáveis**:

| Tutorial | Assuntos |
|---|---|
| `servidores.md` | cadastrar pessoa; vincular a escola ou à SME; encerrar ≠ excluir; cargo e lotação vêm do vínculo |
| `usuarios.md` | allowlist; os quatro níveis por módulo; segmentos de atuação; o que o histórico registra e por que não se apaga |
| `ajuda.md` | onde ficam as instruções, como pedir correção de um texto |
| `configuracoes.md` | a diferença entre preferência pessoal e configuração da rede; por que algumas aparecem desabilitadas |

Os de **Escolas, Horários e Dashboard não entram aqui**: essas três telas mudam
nos blocos E, F e G desta mesma rodada, e um tutorial escrito agora nasceria
desatualizado. Cada bloco escreve o seu como parte de "pronto" - que é
exatamente a regra do § 3.5.1 sendo exercida na primeira oportunidade.

## 6. Arquivos

| Arquivo | Ação |
|---|---|
| `docs/modulos/{servidores,usuarios,ajuda,configuracoes}.md` | criar |
| `src/modules/ajuda/module.js` | criar - manifesto |
| `src/modules/ajuda/ajuda.view.js` | criar - índice + leitor |
| `src/modules/ajuda/markdown.js` | criar - leitor de Markdown |
| `src/modules/ajuda/ajuda.css` | criar (+ `@import` em `styles/main.css`) |
| `src/core/registry.js` | registrar o módulo |
| `src/core/router.js` | botão de ajuda na barra de ações (se o Bloco A não a tiver criado) |
| `src/shared/ui/icones.js` | traçado `ajuda` (interrogação em círculo) |
| `src/modules/{servidores,usuarios,ajuda,configuracoes}/module.js` | `doc: true` |
| `src/modules/docs/module.js` | renomear para "Documentação técnica" |
| `supabase/migrations/026_configuracoes.sql` | `ajuda` no mapa de permissões (mesma migration do Bloco A) |
| `.claude/scripts/verificar_arquitetura.py` | checagem 11 |
| `.claude/rules/documentacao.md` | criar |
| `CLAUDE.md` | linha na tabela de regras sob demanda |

O módulo Ajuda é **agregador**: tela sem model e sem dados próprios. Lê o
registro, as permissões e arquivos estáticos. Não fala com o banco.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Tutorial envelhecer | regra de commit único + checagem 11 + carimbo de versão |
| `.md` ausente em produção | erro tratado: "tutorial ainda não disponível", nunca tela quebrada |
| Leitor de Markdown virar projeto paralelo | subconjunto fechado; precisou de mais? o texto é que está complicado demais |
| Dado real num exemplo | `check_pii` já varre `docs/`; conferir `git diff --cached` |
| Dois botões apertados no topo em 375px | alvo de `--toque`; medir |

## 8. Critérios de aceite

1. `#/ajuda` lista só os módulos que a pessoa enxerga e que têm tutorial.
2. O botão de ajuda aparece na barra do módulo, à esquerda da engrenagem, e
   abre a ajuda daquele módulo.
3. Os quatro tutoriais renderizam títulos, listas, tabelas, citações e código.
4. Um `.md` contendo `<script>` aparece como texto, não executa.
5. `#/ajuda?m=<módulo oculto>` responde como rota inexistente.
6. Quem tem só `leitura` num módulo **consegue** ler o tutorial dele.
7. Ajuda aparece no menu lateral e em "Todos os Módulos".
8. Nenhum dado real nos tutoriais.
9. Cada tutorial termina com o carimbo de versão, exibido na tela.
10. `.claude/rules/documentacao.md` existe e está referenciado em `CLAUDE.md`.
11. Legível em 375px, nos dois temas.
12. `python .claude/scripts/verificar_arquitetura.py` sem violações, incluindo a
    checagem 11 nas três partes.
