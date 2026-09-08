# FundHub - SATE: solicitações, aprovação e cadastro de frota

> Decisões de 08/09/2026. **Bloco S3**. Entrega como MINOR: telas novas,
> sem migration.
>
> É o pedido original do André, item 1: "Nova solicitação" vira botão da
> guia Solicitações, abre em modal com campos agrupados, e a guia mostra
> uma tabela no padrão do hub.
>
> Quase tudo aqui já foi decidido: o padrão de tabela em
> `2026-09-08-listas-e-modais-design.md`, o modelo e as regras em
> `2026-09-08-sate-modelo-de-dados-design.md`. Esta spec só registra o
> que é próprio da tela.
>
> **Ordem alterada.** S3 vinha depois de S1 (a casca própria). Foi
> antecipado porque não depende dela - S1 troca a moldura, não as views -
> e porque fazer S1 antes daria uma casca nova em volta das telas v1.

## 1. O que muda

| Hoje | Depois |
|---|---|
| Aba "Nova solicitação" ao lado de "Solicitações" | **Botão** na guia Solicitações, abrindo modal |
| Lista de cartões, sem ordem, sem busca, sem páginas | Tabela (`shared/ui/tabela.js`) |
| Formulário numa grade única de 13 campos | Quatro blocos semânticos |
| Confirmar/negar direto no cartão, sem justificativa | Modal de detalhe, com justificativa obrigatória |
| Frota não tem onde ser cadastrada (S2 tirou a antiga) | Painel na engrenagem do módulo |
| A escola descobre que não há vaga ao enviar | Vê o saldo enquanto preenche |

## 2. Decisões

### D1 - A guia Solicitações é uma tabela, e o resto vem de graça

Colunas, com a prioridade que decide o que some no celular:

| Coluna | Prioridade | Tipo |
|---|---|---|
| Escola | 1 | texto |
| Data | 1 | data |
| Situação | 1 | texto (chip) |
| Período | 2 | texto |
| Atividade | 2 | texto |
| Alunos | 3 | número |
| Ônibus | 3 | número |

Ordem inicial: **Data, decrescente**. Ordenação, busca, paginação e o
refluxo do celular são do componente - esta tela não escreve nada disso.

**Sem coluna de ações.** As decisões (analisar, confirmar, negar,
cancelar) dependem do status e da permissão, e seriam cinco botões
condicionais espremidos numa célula. A linha inteira abre o **modal de
detalhe** (`aoClicarLinha`), e as ações moram lá, com espaço para o que
cada uma exige.

O `.painel-filtros` acima recorta o que vem do **banco** (período, data,
situação); a busca da tabela estreita o que já está **na tela**. São
mecanismos diferentes e convivem - é o D6 da spec de listas.

### D2 - O formulário se agrupa por pergunta, não por tipo de campo

Quatro `fieldset` numa ordem que é a da conversa real:

1. **O que** - modo (catálogo ou atividade da escola), atividade, destino
2. **Quando** - data, período, embarque, retorno
3. **Quem vai** - escola, turmas, nº de estudantes, nº de cadeirantes
4. **Contato e observação**

O agrupamento não é enfeite: no modal `largo` (760px) os blocos deixam o
formulário legível de relance, e em tela estreita eles viram as âncoras
que dizem onde a pessoa está numa coluna longa.

Nada de CSS novo: `.esc-form` + `.form-grupo` + `.campos` já são o
vocabulário de formulário do hub (R17), e é o container que concede
altura de campo, reset do date/time e tipografia de rótulo.

### D3 - O saldo aparece enquanto se preenche, e some quando esgota

Ao mudar **data**, **período** ou **nº de estudantes**, a tela consulta
`saldoDoDia` e mostra, ao lado do botão de enviar:

> `3 de 9 ônibus livres nesta data · este pedido usa 2`

Quando o pedido não cabe, o botão de enviar **desabilita** para a escola
e a frase vira o motivo. Para quem aprova, o botão continua ativo e a
frase vira aviso - é a assimetria do D7 da spec de dados, e ela já está
dentro de `avaliarPedido()`: a tela só pinta o que a regra devolveu.

**A consulta é debounced (400 ms) e cancelável.** Digitar "40" dispara
duas mudanças; sem isso a segunda resposta pode chegar antes da primeira
e pintar o saldo errado. Guarda-se o número do pedido e descarta-se
resposta velha.

**Isto não substitui a checagem no envio.** Entre ver o saldo e clicar
em enviar, outra escola pode ter ocupado a vaga - o RLS e a regra rodam
de novo na gravação. O aviso é conforto; a barreira é o banco (R6).

### D4 - Decidir é um modal empilhado, e a justificativa é campo

O modal de detalhe mostra a solicitação inteira e, no pé, só as ações
que fazem sentido para aquele status e aquela permissão:

| Status | Escola vê | Quem aprova vê |
|---|---|---|
| solicitado | Cancelar | Analisar · Confirmar · Negar |
| em análise / aguardando adaptado | - | Confirmar · Negar |
| confirmado | Pedir cancelamento | Cancelar |
| pendente de cancelamento | - | Confirmar cancelamento |
| negado / cancelado | - | - |

Negar, cancelar e pedir cancelamento abrem um **segundo modal por cima**
(`abrirModal(..., { voltar })`), com o campo de justificativa e o botão
de confirmar. Empilhado, e não substituindo: o ← devolve ao detalhe com
o dado recarregado, que é o que a pilha de `modal.js` já faz.

**Não é `confirmar()`.** Aquele diálogo é uma pergunta com dois botões,
sem campo - e aqui a justificativa é obrigatória no banco (CHECK da
migration 035). Um `prompt()` disfarçado no `confirmar` seria pior que
um modal com um `<textarea>`.

### D5 - A frota se cadastra na engrenagem

O painel entra em `sate.config.js` como item de tipo `painel`, ao lado
dos quatro números. Ele faz três coisas:

- **Frota vigente**: mostra a aberta de cada tipo e permite abrir uma
  nova (que encerra a anterior, via `abrir_frota`).
- **Lotes**: lista os que têm prazo e permite criar um (Feira do Livro).
- **Rótulos**: cria, arquiva e exclui - com a distinção que o banco
  impõe (rótulo em uso não se exclui, se arquiva).

Fica na engrenagem, e não numa aba, porque **configurar é interrupção
curta** e é o critério que o hub já usa para decidir entre as duas
(spec de configurações por módulo, D8).

### D6 - A aba "Nova solicitação" morre

Ela existia porque não havia modal. Vira botão `.btn-primary` na
`.toolbar` da guia Solicitações. O `sate.view.js` passa de cinco abas
para quatro.

## 3. Arquivos

| | |
|---|---|
| `views/solicitacoes.js` | reescrito sobre `tabela.js` |
| `views/formulario.js` | **novo** - o modal de nova/editar (substitui `nova.js`) |
| `views/detalhe.js` | **novo** - modal de detalhe e as decisões |
| `views/frota-painel.js` | **novo** - o painel da engrenagem |
| `views/nova.js` | **removido** |
| `sate.view.js` · `sate.config.js` · `sate.css` | ajustados |

Nenhum arquivo passa de 400 linhas (R11); a divisão é por **superfície**,
que é como a R11 manda dividir - não por tipo técnico.

## 4. Verificação

`verificar_arquitetura.py`; dev-local a 380px e 1200px nos dois temas;
console limpo; a tabela ordenando, buscando e paginando; o modal
empilhado voltando ao detalhe; o saldo reagindo à troca de data; e o
tutorial `docs/modulos/sate.md` recarimbado.
