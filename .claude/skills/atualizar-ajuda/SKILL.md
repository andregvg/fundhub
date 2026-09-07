---
name: atualizar-ajuda
description: Atualiza o tutorial de um módulo do FundHub (docs/modulos/<id>.md) depois de mexer na tela, no fluxo ou numa regra de negócio. Use quando a checagem 11 do verificador acusar tutorial mais antigo que o código, ao fechar uma entrega que muda o que a pessoa faz, ou quando o usuário pedir para revisar/atualizar a ajuda de um módulo.
---

# Atualizar o tutorial de um módulo

A forma do arquivo, o que a checagem cobra e o subconjunto de Markdown que o
leitor aceita estão em `.claude/rules/documentacao.md`. **Leia essa regra
antes de escrever** - esta skill não a repete, ela conduz o trabalho.

## O princípio

> O tutorial existe para tirar dúvida de quem usa, não para descrever o que
> foi feito.

Quem lê é uma pessoa da secretaria de uma escola, com o sistema aberto, tentando
fazer uma coisa. Ela não quer saber que existe uma variante: quer saber **como
registrar o revezamento do TDC**. Todo parágrafo que não ajuda alguém a concluir
uma tarefa ou a entender por que o sistema recusou algo é peso morto.

## Antes de escrever: descubra o que mudou PARA QUEM USA

O verificador acusa por data de commit, e data de commit não sabe distinguir
uma tela nova de um ajuste de alinhamento. **Você decide.**

```bash
git log --oneline -- docs/modulos/<id>.md | head -1     # até onde o texto está
git log --oneline <ultimo-commit-do-md>..HEAD -- src/modules/<id>/
```

Para cada commit da lista, classifique:

| Muda o tutorial | Não muda |
|---|---|
| Campo, botão ou passo novo | Refatoração, extração de arquivo |
| Regra que passou a bloquear ou a avisar | CSS, alinhamento, cor, espaçamento |
| Texto de botão ou rótulo que mudou | Correção de bug que restaura o comportamento já documentado |
| Permissão: quem passa a poder o quê | Teste, comentário, migration sem efeito visível |

**Se nada da coluna da esquerda aconteceu, não invente texto.** Atualize só o
carimbo final (`> Atualizado na versão X.Y.Z.`) e diga no commit que o
comportamento não mudou. Recarimbar é uma resposta legítima e limpa o aviso.

## Escrevendo

Leia o tutorial inteiro antes de tocar nele. Você está costurando num texto que
já existe, não escrevendo do zero - a espinha e a ordem das seções são fixas.

- **Nomeie o controle como ele aparece na tela.** Se o botão diz "+", escreva
  "+". Abra o `views/` e confira o texto literal em vez de supor.
- **Passo a passo numerado e literal.** Cada passo é uma ação: onde clicar, o
  que preencher, o que acontece. Sem "configure adequadamente".
- **Em "Regras que o sistema aplica", separe o que bloqueia do que avisa** - e
  diga o motivo. "É aviso: dá para salvar e corrigir depois" vale mais que a
  regra sozinha.
- **Nada de jargão.** Nenhum nome de arquivo, tabela, coluna, função ou código
  de erro. "O sistema guarda", nunca "o banco grava".
- **Nenhum dado real** (R7): "Escola Exemplo", `nome@exemplo.com`,
  `(00) 00000-0000`. O repositório é público.
- **Só o subconjunto de Markdown** que `src/modules/ajuda/markdown.js` entende.
  Lista aninhada e `####` falham **em silêncio** - o leitor simplesmente não
  os renderiza. Se o texto pede mais do que o subconjunto, o texto é que está
  complicado demais.

### Corte antes de acrescentar

Um tutorial que cresce a cada entrega vira manual, e manual ninguém lê. Ao
acrescentar uma seção, releia as vizinhas: quase sempre há um parágrafo que a
nova seção tornou redundante, ou uma frase que descrevia um comportamento que
já mudou. **Tutorial que só cresce está apodrecendo.**

## Antes de fechar

1. Leia o texto novo **como se você fosse a pessoa da escola**, do começo ao
   fim. Todo passo nomeia um controle que existe? Dá para seguir sem adivinhar?
   Onde você travaria?
2. Confira cada afirmação contra o código. Uma promessa que a tela não cumpre
   é pior que a ausência dela.
3. Atualize o carimbo final para a versão da entrega.
4. `python .claude/scripts/verificar_arquitetura.py` - a checagem 11 tem que
   sair limpa para esse módulo.
5. O tutorial vai **no mesmo commit** que a mudança que o motivou
   (`.claude/rules/documentacao.md`). Se a mudança já foi commitada, o commit
   do texto diz qual foi.

## Varrendo o que ficou para trás

Para tratar tudo que a checagem 11 acusa de uma vez, rode o verificador,
pegue a lista, e trate **um módulo por vez** - cada um tem um leitor e um
fluxo diferente, e um lote genérico produz texto genérico.
