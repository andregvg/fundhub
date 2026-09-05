# FundHub - Ícones e botões: um só padrão

> Decisões tomadas em 05/09/2026. Bloco I da rodada de melhorias, ao lado
> do Bloco H. Isolado, sem migration, sem dependência dos blocos de
> fundação. Entrega prevista como PATCH.
>
> Continua `2026-08-27-sistema-visual-design.md` (SVG no lugar de emoji,
> traço do Feather). Aqui o assunto é **coerência de uso**, não de
> traçado.

## 1. O problema

O sistema visual padronizou os ícones de navegação, mas três affordances
recorrentes ficaram cada uma com mais de uma forma:

1. **Excluir.** Na modal de edição de servidor, remover um telefone é um
   `×` vermelho (`shared/ui/phones.js`, botão `.phone-del` com CSS
   próprio). No bloco de horário de uma jornada, é uma **lixeira cinza**
   que só fica vermelha no hover (`.mini-btn.no` + `ico('excluir')`). Na
   modal de escola, é uma **lixeira com o rótulo "Excluir"**. Três
   desenhos para a mesma ação.
2. **Fechar / inserir.** O `×` que fecha uma gaveta é um caractere de
   texto (`shared/ui/drawer.js`); o `+` que insere um telefone ou abre
   "Novo servidor" é o caractere `+` concatenado ao rótulo. Não são
   ícones - são glifos de fonte, que não alinham com os SVG ao lado e
   não herdam espessura de traço.
3. **Busca.** A lupa dentro do campo já é o padrão nas listas
   (`.search` com `ico('buscar')` como primeiro filho flex) e no
   componente `busca-selecao.js`. O relato aponta a modal de "Novo
   vínculo" com a lupa **fora** do campo - a confirmar no ambiente e
   corrigir onde estiver.

## 2. Decisões

### D1 - Uma affordance de excluir, vermelha em repouso

A lixeira (`ico('excluir')`) é o ícone. `.mini-btn.no` continua sendo a
classe - ela já é usada em ~16 telas para exatamente isto -, mas passa a
pintar **ícone e texto em `var(--danger)` no estado de repouso**, não só
no hover:

```css
.mini-btn.no { color: var(--danger); border-color: var(--border); }
.mini-btn.no:hover { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, transparent); }
```

Dois formatos, decididos pelo contexto, não por classe nova:

| Contexto | Forma |
|---|---|
| Linha de uma lista editável (telefone, bloco de horário, interesse num projeto, linha da proposta de TDC) | **só o ícone**, com `aria-label` |
| Rodapé de gaveta ou diálogo (excluir servidor, escola, vínculo, ata, ocorrência) | **ícone + "Excluir"** |

O `.btn-perigo` (botão preenchido de vermelho) **não muda e não se
mistura**: ele é o botão de confirmação final dentro de
`shared/ui/confirmar.js` - o último clique de uma ação irreversível, um
tier acima do "Excluir" que abre o diálogo.

### D2 - O `×` do telefone morre

`shared/ui/phones.js`: o botão `.phone-del` (com `×` literal e ~4 linhas
de CSS dedicado) vira o mesmo `<button class="mini-btn no">` com
`ico('excluir', { tam: 14 })` das outras listas. O CSS de `.phone-del` e
`.phone-del:hover` sai de `components.css`. É o desvio mais visível do
padrão e o que o relato cita primeiro.

`+ telefone` no mesmo componente vira `${ico('adicionar', { tam: 14 })}
telefone`.

### D3 - `fechar` é ícone, e é `ico('fechar')`

O traçado já existe em `icones.js` (`fechar`, o × do Feather). Trocar os
`×` de texto por ele:

| Onde | Hoje | Passa a ser |
|---|---|---|
| `shared/ui/drawer.js` (`drawerHead`) | `<button class="drawer-close">×</button>` | `…>${ico('fechar')}</button>` |
| chip "Equipe de …" em Servidores | `<button …>×</button>` | `${ico('fechar', { tam: 12 })}` |
| qualquer outro chip com `×` de remoção | idem | idem |

`fechar` (dispensar, recolher) e `excluir` (apagar do banco) são coisas
diferentes e continuam com desenhos diferentes - um `×`, uma lixeira. O
"Cancelar" de um afastamento (`afastamentos/views/lista.js`, hoje
`.mini-btn.no` + `ico('fechar')`) é **cancelamento com preservação de
histórico**, não exclusão: mantém `ico('fechar')` mas sai da classe
`.no` para não herdar o vermelho de repouso - é uma ação reversível.

### D4 - `+` é `ico('adicionar')`

Todo `+ ` concatenado a um rótulo de botão vira o ícone:

- os 7 botões `+ Novo <coisa>` de toolbar (`servidores`, `afastamentos`,
  `projetos`, `visitas`, `atas`, `ocorrencias`, `sate/locais`);
- `+ Novo vínculo` na ficha do servidor;
- `+ telefone` (D2).

Fica `${ico('adicionar')} Novo servidor`. O `+ Outro…` dentro do
`<select>` de cargo **não muda**: é texto de `<option>`, onde SVG não
entra - e ali o `+` é uma convenção de lista suspensa, não um botão.

### D5 - A lupa dentro do campo, em todo lugar

`busca-selecao.js` já emite `ico('buscar')` como primeiro filho do
`<label class="search">`, e `.search` é flex com o ícone à esquerda do
input. Em tese a modal de "Novo vínculo" já herda isso. A entrega:

1. Abrir "Novo vínculo" na URL de dev e confirmar a posição da lupa no
   campo "Local".
2. Se estiver fora: a causa está no CSS que o `.bs` aplica sobre o
   `.search` aninhado (`.bs-campo`), não no HTML - corrigir ali, uma vez,
   e todo consumidor do componente herda.
3. Varrer as demais telas com campo de busca e confirmar o mesmo.

Sem inventar componente: o padrão já existe, o trabalho é garantir que
ele valha sem exceção.

## 3. Arquivos

| Arquivo | Ação |
|---|---|
| `src/styles/components.css` | `.mini-btn.no` vermelho em repouso (D1); remover `.phone-del` (D2) |
| `src/shared/ui/phones.js` | `.phone-del` → `.mini-btn.no` + lixeira; `+ telefone` → ícone (D2) |
| `src/shared/ui/drawer.js` | `×` → `ico('fechar')` (D3) |
| `src/shared/ui/busca-selecao.js` / CSS do `.bs` | lupa dentro do campo, se a verificação apontar desvio (D5) |
| `src/modules/servidores/servidores.view.js` | chip `×` → `ico('fechar')`; `+ Novo servidor` → ícone |
| `src/modules/servidores/views/detalhe.js` | `+ Novo vínculo` → ícone |
| `src/modules/afastamentos/views/lista.js` | "Cancelar" sai de `.mini-btn.no` (D3) |
| `src/modules/{afastamentos,projetos,visitas,atas,ocorrencias}/*.view.js` | `+ Novo …` → ícone |
| `src/modules/sate/views/locais.js` | `+ Novo local` → ícone |
| `docs/superpowers/specs/2026-08-27-sistema-visual-design.md` | nota remetendo a esta spec |

Nenhuma migration. Nenhuma mudança de model. `icones.js` **não muda** -
`fechar` e `adicionar` já existem.

## 4. Riscos

| Risco | Mitigação |
|---|---|
| `.mini-btn.no` vermelho em repouso ficar agressivo numa tela cheia de linhas | é só o ícone/texto, não o fundo; o fundo vermelho fraco fica no hover |
| Algum `.mini-btn.no` ser de fato não-destrutivo e herdar o vermelho | varredura de todos os usos na entrega; só "Cancelar" de afastamento se enquadra, e sai da classe (D3) |
| Trocar o `×` do `drawer.js` quebrar o alinhamento do cabeçalho da gaveta | `ico('fechar')` tem caixa 24x24 como os outros; conferir `drawerHead` nas gavetas mais cheias |
| A correção da lupa mexer em `.search` e afetar as listas | `.search` das listas já está certo; a correção, se houver, é escopada ao `.bs-campo` |

## 5. Critérios de aceite

1. Todo botão de excluir do hub usa a lixeira e é vermelho em repouso -
   telefone, bloco de horário, vínculo, escola, servidor, ata, ocorrência.
2. Nenhum `×` de texto sobrou: fechar gaveta e remover chip usam
   `ico('fechar')`.
3. Nenhum `+ ` de texto sobrou em botão: todos usam `ico('adicionar')`.
4. "Cancelar" um afastamento continua visualmente distinto de "excluir".
5. A lupa aparece **dentro** do campo em toda busca, incluindo "Novo
   vínculo".
6. Legível em 375px, nos dois temas; alvo de toque preservado.
7. `python .claude/scripts/verificar_arquitetura.py` sem violações
   (inclui a checagem de cor literal - nada de `#hex` novo).
