# FundHub - Listagens que refletem o banco depois de criar

> Decisões tomadas em 05/09/2026. Bloco H da rodada de melhorias - o
> primeiro da fila, junto do Bloco I. Isolado: sem dependência dos
> blocos de fundação (A/B) e sem migration.
> Entrega prevista como PATCH (correção).

## 1. O problema

Ao cadastrar um servidor, ele não aparece na lista de Servidores até um
F5. Ao criar o primeiro vínculo de um servidor com uma escola, o card
dele continua mostrando "Sem vínculo" até um F5. O relato inclui o mesmo
sintoma ao criar uma escola.

O estado do banco e o da tela divergem, e a única forma de reconciliá-los
é recarregar a página inteira - que é exatamente o que uma SPA existe
para evitar.

## 2. A causa

Não é falta de recarga. `views/formulario.js` (servidores e escolas) e
`views/vinculo.js` **já** chamam `ctx.recarregar()` no sucesso, e
`recarregar()` nulifica o cache do model (`_cache = null`) e repinta a
lista. O registro novo chega à memória.

Ele é **filtrado na pintura**. Em `servidores/views/lista.js`, a função
`combina(s, ctx)` decide se cada servidor entra na lista visível:

```js
if (seg && seg.selecionados().length) {
  const soSede = abertos.length && abertos.every(v => v.unidade?.tipo === 'sede');
  if (!soSede && !abertos.some(v => seg.combina(idxUnidades[v.unidade_id]))) return false;
}
```

Um servidor recém-criado tem `abertos.length === 0` (nenhum vínculo). Com
isso `soSede` é `false` e `abertos.some(...)` é `false` sobre lista vazia
- então `return false` **sempre que há um segmento selecionado no
filtro**. O filtro de segmento guarda a seleção na sessão
(`chaveMemoria: 'fundhub:seg:servidores'`), então o servidor "some"
mesmo depois de recarregar a lista - e só reaparece num F5 se, e
enquanto, nenhum segmento estiver marcado.

O mesmo vale para o servidor que **acabou de ganhar** o primeiro vínculo
se `idxUnidades` não contém a unidade nova - mas `idxUnidades` vem de
`getUnidades()`, que não muda ao criar um vínculo, então esse caminho só
falha se a unidade em si for nova (fora do escopo deste relato).

Em Escolas, `escolas/views/lista.js` tem a construção equivalente: uma
escola criada sem o campo **Segmento** preenchido não casa com nenhum
eixo e é escondida pelo mesmo filtro.

O código **já reconhece** que "sem segmento" não deve ser filtrado - é o
que a exceção `soSede` faz para a equipe da SME. O comentário no arquivo
diz isso com todas as letras: "a sede não tem segmento - e por isso
continua visível, senão o filtro esconderia justamente a equipe da SME".
A regra está certa e incompleta: falta o caso "ainda não tem segmento
porque acabou de ser criado".

## 3. Decisões

### D1 - "Sem segmento" nunca é filtrado por segmento

A exceção `soSede` vira uma exceção mais geral: **um registro sem
nenhuma âncora de segmento passa por qualquer recorte de segmento**, em
vez de ser escondido por todos.

Em `servidores/views/lista.js`, `combina()`:

```js
if (seg && seg.selecionados().length) {
  const semAncora = !abertos.some(v => v.unidade?.tipo === 'escola' && v.unidade_id);
  const casa = abertos.some(v => seg.combina(idxUnidades[v.unidade_id]));
  if (!semAncora && !casa) return false;
}
```

`semAncora` cobre de uma vez os três casos que hoje exigem raciocínio
separado: sem vínculo nenhum, só vínculo com a sede, e (no Bloco J) só
vínculo com unidade interna da SME. Nenhum deles tem segmento, e para
nenhum deles faz sentido o filtro esconder.

Em `escolas/views/lista.js`, a regra análoga: escola cujo `segmento`
está vazio aparece em qualquer recorte. Uma escola sem segmento é um
cadastro incompleto que a pessoa precisa **ver** para completar - não um
registro que ela quis excluir da visão.

**Por que não "recém-criado entra sempre por 5 minutos"** ou marca de
tempo: complexidade sem retorno. O critério real não é a idade do
registro, é a ausência de segmento - e esse já é observável na hora.

### D2 - Auditar os pontos de criação, um a um

O relato cita servidor, vínculo e escola, mas o filtro de segmento não é
o único jeito de a tela mentir. A entrega inclui percorrer **todos** os
caminhos que criam um desses registros e confirmar que cada um repinta a
lista de origem a partir do banco:

| Caminho | Origem | Repinta hoje? |
|---|---|---|
| "Novo servidor" na lista de Servidores | `servidores.view.js` | sim (`recarregar`), mas filtrado - D1 |
| "Novo vínculo" na ficha do servidor | `views/detalhe.js` → `vinculo.js` | conferir |
| Editar cargo/lotação pela modal do servidor | `formulario.js` `[data-vinc]` | conferir |
| "Gerir servidores e vínculos" a partir da ficha da escola | abre Servidores com `?unidade=` | conferir o retorno |
| "Nova escola" na lista de Escolas | `escolas.view.js` | sim, mas filtrado - D1 |
| Vínculo criado de dentro do módulo Horários (grade por escola) | `horarios/views/por-escola.js` | conferir - Horários tem estado próprio |

Onde o Horários cria ou encerra vínculo, o seu próprio `getServidores()`
em memória precisa ser invalidado (o `registrarCache` já cobre o botão
Atualizar; aqui é a repintura imediata da grade que importa).

### D3 - O contador conta sobre o total, não sobre o filtrado

Efeito colateral bom de D1: hoje `pintarLista` escreve
`"N de M servidores"`, e se o registro novo estivesse sendo escondido o
`M` também não subia - a tela não dava nenhuma pista de que algo tinha
sido criado. Com D1 o registro entra na lista e nos dois números. Nada a
fazer além de D1; fica registrado como critério de aceite.

## 4. Arquivos

| Arquivo | Ação |
|---|---|
| `src/modules/servidores/views/lista.js` | `combina()`: exceção "sem âncora de segmento" (D1) |
| `src/modules/escolas/views/lista.js` | mesma exceção para escola sem `segmento` (D1) |
| `src/modules/servidores/views/detalhe.js` | conferir repintura após criar vínculo (D2) |
| `src/modules/servidores/views/vinculo.js` | conferir o `voltar`/`recarregar` em todos os ramos (D2) |
| `src/modules/servidores/views/formulario.js` | conferir o ramo `[data-vinc]` (D2) |
| `src/modules/horarios/views/por-escola.js` | invalidar e repintar após vínculo criado ali (D2) |

Nenhuma migration. Nenhuma mudança de model.

## 5. Verificação

Exige login real: dev-local não insere. O passo de verificação fica com
o controlador (não subagente), com uma conta admin na URL de dev:

1. Com um segmento marcado no filtro, criar um servidor → aparece na
   hora, sem F5, e o contador sobe.
2. Criar o primeiro vínculo desse servidor com uma escola do outro
   segmento → o card troca "Sem vínculo" pela escola na hora.
3. Criar uma escola sem preencher Segmento, com um eixo marcado → aparece.
4. Repetir (1) a partir de "Gerir servidores e vínculos" na ficha de uma
   escola.

## 6. Critérios de aceite

1. Servidor criado com um segmento ativo no filtro aparece imediatamente
   na lista, sem recarregar a página.
2. Escola criada sem segmento aparece imediatamente, mesmo com um eixo
   filtrado.
3. O primeiro vínculo de um servidor reflete no card sem F5.
4. Vínculo criado de dentro do Horários atualiza a grade na hora.
5. O contador "N de M" reflete o registro novo em ambos os números.
6. Nenhum registro que o usuário de fato quis filtrar (servidor cujo
   vínculo é de outro segmento) passou a aparecer indevidamente.
7. `python .claude/scripts/verificar_arquitetura.py` sem violações.
