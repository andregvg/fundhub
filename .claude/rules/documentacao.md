# Documentação de uso - manter o tutorial vivo

Contexto em `docs/superpowers/specs/2026-09-05-ajuda-por-modulo-design.md`.

Módulo com `doc: true` no manifesto tem um `docs/modulos/<id>.md` - o tutorial
que a pessoa lê em `#/ajuda` e pelo botão de ajuda no topo da tela.

## A regra

Mexeu na tela, no fluxo ou numa regra de negócio de um módulo com `doc: true`?
O `docs/modulos/<id>.md` correspondente é atualizado **no mesmo commit**.

- Layout que não muda o que a pessoa faz **não conta**.
- Campo novo, botão novo, passo a mais, regra que passou a bloquear, texto de
  botão que mudou - **conta**.

## Forma

Espinha fixa (previsibilidade > criatividade num texto de referência):

```
# <Nome do módulo>
> Uma frase dizendo para que serve.
## O que dá para fazer aqui
## Quem pode o quê
## Passo a passo
### <Tarefa>
## Regras que o sistema aplica
## Ligações com outros módulos
## Perguntas frequentes
> Atualizado na versão X.Y.Z.
```

- Escrito para **quem usa**: nenhum nome de arquivo, tabela, função ou coluna.
  "O sistema guarda", não "o Postgres grava".
- Passo a passo numerado e literal, nomeando o botão como ele aparece na tela.
- "Regras que o sistema aplica" separa o que **bloqueia** (erro) do que só
  **avisa**, com o motivo.
- Nenhum dado real (R7): "Escola Exemplo", `nome@exemplo.com`, `(00) 00000-0000`.
- O carimbo final é a versão em que o texto foi revisto pela última vez.

## O que o verificador cobra (checagem 11)

| | Situação | Severidade |
|---|---|---|
| a | `doc: true` sem `docs/modulos/<id>.md` | bloqueia |
| b | `.md` órfão (sem módulo `doc: true`) | bloqueia |
| c | último commit em `src/modules/<id>/` mais novo que o do `.md` | aviso |

O leitor de Markdown (`src/modules/ajuda/markdown.js`) suporta um subconjunto
fechado: `#`–`###`, `**forte**`, `*ênfase*`, `` `código` ``, listas `-`/`1.`
(um nível), tabelas GFM, `>` citação, cerca de três crases, `[texto](url)`,
`---`. Precisou de mais? O texto é que está complicado demais.
