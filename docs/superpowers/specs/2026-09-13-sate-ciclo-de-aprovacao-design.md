# FundHub - SATE: fechar o ciclo de aprovação

> 13/09/2026. Entrega como MINOR: migration `040`, e as quatro coisas que o
> tutorial prometia sem a tela cumprir.
>
> Revisa: `2026-09-08-sate-modelo-de-dados-design.md` § D2 (frota que nasce
> da aprovação) e § D7 (transporte adaptado).

## O problema

Levantamento de 13/09/2026: quatro regras escritas no tutorial não tinham
tela, e três funções do model não tinham quem as chamasse
(`criarLote({ solicitacaoId })`, `getFrotasOrfas`, `aguardarAdaptado`).

## D1 - Confirmar acima da frota cria a frota extra do dia

Ao **Confirmar**, a tela calcula quanto falta **naquele período**. Se falta,
abre um segundo modal: quantos ônibus e vans faltam, e um rótulo
obrigatório (escolhido da lista ou digitado novo). Confirmar ali cria um
lote com início e fim na data do pedido, ligado a ele, e confirma.

**Uma transação só**, pela RPC `decidir_com_frota`: lote criado e pedido
não confirmado seria uma frota órfã nascida de um erro de rede. Sem
`security definer` - as duas escritas passam pelas policies de escrita.

**A conta de quanto falta** (`faltaParaConfirmar`, em `saldo.model.js`)
depende de o pedido já estar no uso do dia: `em_analise` e
`aguardando_transporte_adaptado` já reservam veículo, `solicitado` não.
Somar de novo o que já está no uso criaria ônibus a mais.

## D2 - Transporte adaptado: decisão de quem aprova

"Aguardando transporte adaptado" passa a ter um dono: quando faltam
**vans** ao confirmar, o modal oferece, além de criar a van extra,
**Aguardar van adaptada** - o pedido reserva os ônibus e fica nesse status
até a van ser resolvida. Nunca é automático na criação: o pedido da escola
nasce `solicitado`, que não reserva nada, e deixá-lo "aguardando" antes de
alguém analisar seria uma promessa que ninguém fez.

## D3 - Frota órfã: aviso na guia Frota

Órfão é o lote que nasceu de um pedido e deixou de fazer sentido:

- o pedido foi **negado ou cancelado**; ou
- o pedido foi **remanejado** para uma data que o lote não cobre.

A guia Frota lista os órfãos no topo, com **Manter** (desliga o lote do
pedido: vira reforço comum) e **Remover**. Nada some sozinho - decisão de
08/09/2026.

## D4 - Remanejar

Quem aprova altera data, período, horários, destino (do cadastro de
locais) e o número de veículos de um pedido que ainda não terminou.
Ao salvar:

- o trajeto é recalculado se o destino mudou;
- se o pedido reserva veículo e a nova data não comporta, abre o mesmo
  modal de D1, em modo "só criar a frota extra" - o status não muda;
- o lote extra da data antiga vira órfão por D3, e aparece para decisão.

## Limpeza

Saem do model o que ficou sem uso de verdade: `aguardarAdaptado` e
`getSolicitacaoPorId` (sate), `totalPorDia` e `encerrarFrota` (frota).
