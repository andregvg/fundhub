# Solicitação do SATE reformulada - Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lista com nome completo da escola; ficha "Detalhes da solicitação" no desenho novo (quadro-resumo, pares rótulo → valor, histórico); editar só antes de confirmar; reabrir decisão; paradas e resumo do pedido no formulário.

**Architecture:** O que cabe em cada situação vira função pura em `sate.model.js` (o dono do ciclo de vida). A ficha se divide em mostrar (`views/detalhe.js`) e decidir (`views/decisoes.js`). O formulário ganha dois blocos com estado próprio (`formulario-resumo.js`, `formulario-paradas.js`). Sem migration: o banco já deixa quem escreve no SATE mudar a situação.

**Tech Stack:** JS ES modules sem build, Supabase (PostgREST), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-10-sate-solicitacao-reformulada-design.md`

## Global Constraints

- Sem npm, sem dependência nova.
- Kernel (`src/core`, `src/shared`) nunca importa `src/modules` (R1). View nunca chama `sb()`; model nunca toca no DOM (R3). Só `*.model.js` atravessa a fronteira de um módulo (R2). Zero ciclos de import (R4).
- Todo valor do banco passa por `esc()` antes de entrar em template literal, inclusive em atributo (R5).
- Nenhuma cor literal em `src/modules/**`: só `var(--token)` (R9). Reusar `src/styles/components.css` antes de criar classe.
- Timestamp só por `fmtDataHora`; data civil só por `fmtData` (R8).
- Sem `confirm()`/`alert()` nativos: `shared/ui/confirmar.js` (R16).
- Ícone ao lado de texto: o contêiner é `flex` com `align-items: center` e `gap` (ui.md).
- **Repositório público:** nenhum dado real em código, comentário, teste ou doc. Exemplos: `Escola Exemplo`, `nome@exemplo.com`, `(00) 00000-0000`.
- **Nenhum arquivo em `supabase/migrations/`.** Não alterar a conta de vagas (`disponibilidade.model.js`).
- PT-BR em código, comentário e commit. Commits na `dev`, com a linha final `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Limites: view ≤ 400 linhas, model ≤ 250.
- A cada tarefa: `node --test "tests/*.test.mjs"` (todos passam) e `python .claude/scripts/verificar_arquitetura.py` (0 bloqueantes).
- **Não** subir versão nem mexer no CHANGELOG antes da Task 4.

## Review Focus

1. Pedido antigo sem responsável estruturado, sem horários ou sem quem criou → a ficha mostra o que há, sem linha vazia nem "undefined".
2. Vendo como escola (`ctx.somenteLeitura`) → nenhuma decisão, nenhum lápis, nenhum botão de parada.
3. Reabrir um pedido negado num dia sem veículo livre → avisa e deixa seguir; a leitura da ocupação falhando não impede reabrir.
4. Nova solicitação com escolas extras em que uma falha ao entrar → a viagem existe, a pessoa é avisada de qual não entrou, nada é duplicado.
5. A mesma escola escolhida como principal e como parada extra → não pode: a opção some da busca.

---

### Task 1: O que cabe em cada situação, reabrir, e a lista com nome completo

**Files:**
- Modify: `src/modules/sate/sate.model.js`, `src/modules/sate/participacoes.model.js`
- Modify: `src/modules/sate/views/solicitacoes.js`, `src/modules/sate/sate.css`
- Test: `tests/sate-solicitacao.test.mjs`

**Interfaces:**
- Produces:
  - `acoesDoPedido(s, { aprovador = false, somenteLeitura = false } = {}) → { editar: boolean, decisoes: string[] }` em `sate.model.js`. `decisoes` na ordem em que os botões aparecem; valores possíveis: `'analisar' | 'negar' | 'confirmar' | 'cancelar' | 'pedir' | 'ciencia' | 'reabrir'`.
  - `alteracaoDeReabertura(agora) → objeto` (pura) e `reabrirSolicitacao(id) → Promise<void>` em `sate.model.js`.
  - `resumoEscolas(participacoes, { curto = false } = {}) → string` em `participacoes.model.js` (padrão passa a ser o **nome completo**).

- [ ] **Step 1: Testes que falham** - em `tests/sate-solicitacao.test.mjs`, acrescentar ao import de `sate.model.js` os nomes `acoesDoPedido, alteracaoDeReabertura`, acrescentar `import { resumoEscolas } from '../src/modules/sate/participacoes.model.js';` e, ao fim do arquivo:

```js
// ── O que cabe em cada situação (spec 2026-10-10-sate-solicitacao, D4 e D5) ──
const ap = { aprovador: true };
const esc_ = { aprovador: false };
const dec = (status, quem) => acoesDoPedido({ status }, quem).decisoes;

test('acoesDoPedido: quem aprova, por situação', () => {
  assert.deepEqual(dec('solicitado', ap), ['analisar', 'negar', 'confirmar']);
  assert.deepEqual(dec('em_analise', ap), ['negar', 'confirmar']);
  assert.deepEqual(dec('aguardando_transporte_adaptado', ap), ['negar', 'confirmar']);
  assert.deepEqual(dec('confirmado', ap), ['reabrir', 'cancelar']);
  assert.deepEqual(dec('pendente_cancelamento', ap), ['ciencia']);
  assert.deepEqual(dec('negado', ap), ['reabrir']);
  assert.deepEqual(dec('cancelado', ap), ['reabrir']);
});

test('acoesDoPedido: a escola só cancela ou pede cancelamento', () => {
  assert.deepEqual(dec('solicitado', esc_), ['cancelar']);
  assert.deepEqual(dec('confirmado', esc_), ['pedir']);
  for (const st of ['em_analise', 'aguardando_transporte_adaptado', 'pendente_cancelamento', 'negado', 'cancelado']) {
    assert.deepEqual(dec(st, esc_), [], st);
  }
});

test('acoesDoPedido: editar só quem aprova, e só antes de confirmar', () => {
  for (const st of ['solicitado', 'em_analise', 'aguardando_transporte_adaptado']) {
    assert.equal(acoesDoPedido({ status: st }, ap).editar, true, st);
    assert.equal(acoesDoPedido({ status: st }, esc_).editar, false, st);
  }
  for (const st of ['confirmado', 'pendente_cancelamento', 'negado', 'cancelado']) {
    assert.equal(acoesDoPedido({ status: st }, ap).editar, false, st);
  }
});

test('acoesDoPedido: vendo como escola, nada', () => {
  assert.deepEqual(acoesDoPedido({ status: 'solicitado' }, { aprovador: true, somenteLeitura: true }),
    { editar: false, decisoes: [] });
});

test('alteracaoDeReabertura volta para análise e limpa a decisão', () => {
  assert.deepEqual(alteracaoDeReabertura('2026-10-10T12:00:00.000Z'), {
    status: 'em_analise', motivo: null, decidido_por: null, decidido_em: null,
    atualizado_em: '2026-10-10T12:00:00.000Z',
  });
});

// ── A coluna Escolas (spec 2026-10-10-sate-solicitacao, D2) ──
const parte = (nome, apelido, status = 'ativa') => ({ status, unidade: { nome, apelido } });

test('resumoEscolas: nome completo por padrão, apelido no curto', () => {
  const uma = [parte('Escola Municipal Exemplo', 'Exemplo')];
  assert.equal(resumoEscolas(uma), 'Escola Municipal Exemplo');
  assert.equal(resumoEscolas(uma, { curto: true }), 'Exemplo');
});

test('resumoEscolas: várias escolas viram "primeira +N"', () => {
  const tres = [parte('Escola A', 'A'), parte('Escola B', 'B'), parte('Escola C', 'C')];
  assert.equal(resumoEscolas(tres), 'Escola A +2');
  assert.equal(resumoEscolas(tres, { curto: true }), 'A +2');
});

test('resumoEscolas: cancelada não conta, e sem apelido o curto cai no nome', () => {
  assert.equal(resumoEscolas([parte('Escola A', 'A', 'cancelada'), parte('Escola B', null)], { curto: true }), 'Escola B');
  assert.equal(resumoEscolas([]), '');
});
```

- [ ] **Step 2:** `node --test tests/sate-solicitacao.test.mjs` → FALHA.

- [ ] **Step 3: `sate.model.js`.** Logo depois do bloco das transições (depois de `confirmarCancelamento`):

```js
// ── O que cabe em cada situação ──────────────────────────────
// As ações de uma solicitação, por situação e por quem olha (spec
// 2026-10-10-sate-solicitacao, D4 e D5). Pura: a ficha só desenha o que
// sai daqui. Esconder botão é conforto; quem barra de fato é o RLS (R6).
//
//   editar    - o lápis: só quem aprova, e só antes de confirmar. Para
//               editar um pedido confirmado, primeiro se reabre.
//   decisoes  - na ordem em que os botões aparecem.
const EDITAVEL = ['solicitado', 'em_analise', 'aguardando_transporte_adaptado'];
const DECISOES = {
  aprovador: {
    solicitado: ['analisar', 'negar', 'confirmar'],
    em_analise: ['negar', 'confirmar'],
    aguardando_transporte_adaptado: ['negar', 'confirmar'],
    confirmado: ['reabrir', 'cancelar'],
    pendente_cancelamento: ['ciencia'],
    negado: ['reabrir'],
    cancelado: ['reabrir'],
  },
  escola: { solicitado: ['cancelar'], confirmado: ['pedir'] },
};

export function acoesDoPedido(s, { aprovador = false, somenteLeitura = false } = {}) {
  // Vendo como a escola: os botões seriam os dela, mas quem clicaria tem
  // os poderes de quem aprova no banco. Nada.
  if (somenteLeitura) return { editar: false, decisoes: [] };
  const mapa = aprovador ? DECISOES.aprovador : DECISOES.escola;
  return { editar: aprovador && EDITAVEL.includes(s?.status), decisoes: [...(mapa[s?.status] || [])] };
}

// Reabrir desfaz uma decisão: negado, cancelado ou confirmado voltam para
// análise, de onde saem confirmar e negar. Limpa quem decidiu, quando e a
// justificativa - o que houve antes continua no audit_log. Pura, para o
// teste fixar exatamente o que muda.
export const alteracaoDeReabertura = (agora) => ({
  status: 'em_analise', motivo: null, decidido_por: null, decidido_em: null, atualizado_em: agora,
});

export async function reabrirSolicitacao(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('solicitacao_transporte')
    .update(alteracaoDeReabertura(agoraISO())).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 4: `participacoes.model.js`** - substituir `resumoEscolas` (e o comentário dela) por:

```js
// As escolas ATIVAS de uma viagem, numa linha: "Escola Exemplo" ou
// "Escola Exemplo +2". Nome completo por padrão; `curto` usa o apelido
// (a coluna da lista em tela estreita). Cancelada não embarca, não conta.
export function resumoEscolas(participacoes = [], { curto = false } = {}) {
  const nomes = participacoes.filter(ativa)
    .map(p => (curto && p.unidade?.apelido) || p.unidade?.nome || p.local?.nome || '')
    .filter(Boolean);
  if (!nomes.length) return '';
  if (nomes.length === 1) return nomes[0];
  return `${nomes[0]} +${nomes.length - 1}`;
}
```
  Conferir os outros chamadores com `grep -rn "resumoEscolas" src`: todos passam a receber o nome completo, que é o desejado.

- [ ] **Step 5:** `node --test tests/sate-solicitacao.test.mjs` → PASSA.

- [ ] **Step 6: `views/solicitacoes.js` - coluna Escolas.**
  - Em `carregar()`, a linha que monta `s._escolas` passa a montar os dois textos:

```js
  for (const s of lista) {
    s._escolas = resumoEscolas(porViagem[s.id] || []);
    s._escolasCurto = resumoEscolas(porViagem[s.id] || [], { curto: true });
  }
```
  - A coluna `escola` de `COLUNAS`:

```js
  // "Escolas", no plural: uma viagem pode ter várias, e a coluna mostra
  // a primeira mais a contagem ("Escola Exemplo +2"). Nome completo; em
  // tela estreita, o apelido em maiúsculas (spec 2026-10-10-sate-solicitacao,
  // D2) - os dois vão na célula e o CSS mostra um. `valor` traz os dois
  // para a busca achar por qualquer um; a ordem é pelo nome completo.
  { id: 'escola', rotulo: 'Escolas',
    valor: s => [nomeEscolas(s), apelidoEscolas(s)].filter(Boolean).join(' · '),
    celula: s => `<span class="sol-esc-nome">${esc(nomeEscolas(s))}</span><span class="sol-esc-apelido">${esc(apelidoEscolas(s))}</span>` },
```
  com, acima de `COLUNAS`:

```js
const nomeEscolas = (s) => s._escolas || s.unidade?.nome || '';
const apelidoEscolas = (s) => s._escolasCurto || s.unidade?.apelido || nomeEscolas(s);
```

- [ ] **Step 7: `sate.css`** - junto das regras da lista de solicitações (`.sol-*`):

```css
/* Coluna Escolas: apelido em maiúsculas na tela estreita, nome completo a
   partir de 720px (o corte em que a tabela já esconde colunas). */
.sol-esc-nome { display: none; }
.sol-esc-apelido { text-transform: uppercase; }
@media (min-width: 720px) {
  .sol-esc-nome { display: inline; }
  .sol-esc-apelido { display: none; }
}
```

- [ ] **Step 8:** `node --test "tests/*.test.mjs"`; verificador → 0 bloqueantes.

- [ ] **Step 9: Commit** - `feat(sate): acoes por situacao, reabrir e lista com nome completo da escola`.

---

### Task 2: A ficha "Detalhes da solicitação", as decisões e "Editar solicitação"

**Files:**
- Rewrite: `src/modules/sate/views/detalhe.js`
- Create: `src/modules/sate/views/decisoes.js`
- Rename + modify: `src/modules/sate/views/remanejar.js` → `src/modules/sate/views/editar.js` (`git mv`)
- Modify: `src/modules/sate/views/participantes.js`, `src/modules/sate/sate.css`, `src/styles/components.css`, `.claude/rules/ui.md`

**Interfaces:**
- Consumes: `acoesDoPedido`, `reabrirSolicitacao` (Task 1); `abrirDia` de `views/dia.js`; `abrirConferirDoPedido` de `views/conferir-local.js`; `blocoHtml`, `ligarParticipantes` de `views/participantes.js`.
- Produces:
  - `abrirDetalhe(solicitacao, contexto)` em `views/detalhe.js` (mesma assinatura de hoje).
  - `decisoesHtml(s, decisoes) → string` e `ligarDecisoes(corpo, { s, ctx, paradas, reabrir })` em `views/decisoes.js`.
  - `abrirEditar(s, ctx, reabrir)` em `views/editar.js`.

**Antes de escrever:** ler os três arquivos atuais inteiros (`detalhe.js`, `remanejar.js`, `participantes.js`). O `detalhe.js` de hoje contém, além da ficha, as decisões (`acoes`, `decisoes`, `aoClicarAcao`, `confirmarPedido`, `pedirMotivo`, `executar`, `fechaTudo`) - esse código **muda de arquivo**, não é reescrito: mover preservando os comentários.

- [ ] **Step 1: `views/decisoes.js`** (novo). Cabeçalho e estrutura:

```js
// ============================================================
// FundHub - sate/views/decisoes.js
// As DECISÕES sobre uma solicitação: os botões que cabem naquela situação
// para aquela permissão, e o que cada um faz.
// Spec: 2026-10-10-sate-solicitacao-reformulada-design.md § D5 e D9.
//
// Saiu de `detalhe.js` na reformulação da ficha. A fronteira não é de
// tamanho: mostrar não é decidir. Aqui mora o que tem consequência -
// conferir a frota antes de confirmar, exigir justificativa para negar e
// cancelar, avisar que reabrir volta a reservar veículo. As duas telas se
// tocam em dois pontos, e só: o rodapé que a ficha desenha e o `ligar`
// que ela chama.
//
// QUAIS decisões cabem não é daqui: vem de acoesDoPedido() (sate.model.js),
// pura e testada. Esconder botão é conforto; quem barra é o RLS (R6).
//
// Negar, cancelar e pedir cancelamento abrem um SEGUNDO modal por cima
// (`{ voltar }`), com o campo de justificativa. Empilhado, e não
// substituindo: o ← devolve à ficha com o dado recarregado.
// ============================================================
```
  Imports: de `../sate.model.js` - `porEmAnalise, confirmarSolicitacao, negarSolicitacao, cancelarSolicitacao, pedirCancelamento, confirmarCancelamento, reabrirSolicitacao, localAConferir`; `tituloDoPedido` de `../regras.model.js`; `abrirFrotaExtra` de `./frota-extra.js`; `lerOcupacao, faltaParaConfirmar` de `../disponibilidade.model.js`; `esc, val, falhaNoCampo` de `shared/dom.js`; `modalHead, abrirModal, fecharModal` de `shared/ui/modal.js`; `toast`; `reportarErro`; `confirmar`; `ico`.

  O rodapé:

```js
// Rótulo, classe e ícone de cada decisão. "Reabrir" muda de nome conforme
// de onde vem: de um pedido confirmado, a pessoa está voltando atrás.
const BOTAO = {
  analisar: { rotulo: 'Pôr em análise' },
  negar: { rotulo: 'Negar', classe: 'btn-perigo' },
  confirmar: { rotulo: 'Confirmar', classe: 'btn-primary', icone: 'ok' },
  cancelar: { rotulo: 'Cancelar solicitação', classe: 'btn-perigo' },
  pedir: { rotulo: 'Pedir cancelamento' },
  ciencia: { rotulo: 'Confirmar cancelamento', classe: 'btn-primary', icone: 'ok' },
  reabrir: { rotulo: 'Reabrir' },
};

export function decisoesHtml(s, decisoes) {
  if (!decisoes.length) return '';
  const botao = (acao) => {
    const b = BOTAO[acao];
    const rotulo = acao === 'reabrir' && s.status === 'confirmado' ? 'Voltar para análise' : b.rotulo;
    return `<button type="button" class="${b.classe || 'btn-secundario'}" data-acao="${acao}">${b.icone ? ico(b.icone) + ' ' : ''}${esc(rotulo)}</button>`;
  };
  return `<div class="modal-acoes det-acoes-pe">${decisoes.map(botao).join('')}</div>`;
}
```

  `ligarDecisoes(corpo, { s, ctx, paradas, reabrir })` registra **um** ouvinte de clique em `corpo` para `[data-acao]` e despacha - é o `aoClicarAcao` atual, com as variáveis de módulo (`ctx`, `atual`, `paradasAtual`) trocadas pelo que chega por parâmetro (fecho). Dentro dele:
  - `negar`, `cancelar`, `pedir` → `pedirMotivo` (movido como está; o subtítulo do modal passa a ser `esc(tituloDoPedido(s))` como hoje; `voltar: reabrir`);
  - `confirmar` → `confirmarPedido` (movido como está, usando `paradas` no lugar de `paradasAtual` e `reabrir` no lugar de `() => abrirDetalhe(s, ctx)`);
  - `analisar` e `ciencia` → `executar` (movido como está);
  - `reabrir` → função nova:

```js
// Reabrir volta a reservar veículo. Vindo de negado ou cancelado, o pedido
// NÃO ocupava nada: confere se ainda cabe e avisa - sem bloquear, porque
// quem aprova pode, e resolve na confirmação ("Faltam veículos"). É aviso,
// não erro (R15). Se a leitura da ocupação falhar, reabre sem o aviso:
// a conferência de verdade é a da confirmação.
async function reabrirPedido(btn, { s, paradas, executar }) {
  btn.disabled = true;
  try {
    let falta = { onibus: 0, vans: 0 };
    if (s.status !== 'confirmado') {
      const linha = await lerOcupacao(s.data, s.data, { excluir: s.id }).catch(() => null);
      if (linha) falta = faltaParaConfirmar(s, linha, paradas);
    }
    const semVaga = falta.onibus || falta.vans;
    const ok = await confirmar(semVaga
      ? 'Não há veículos livres neste horário. Reabrir mesmo assim?'
      : 'Reabrir esta solicitação?', {
      detalhe: 'Ela volta para análise e volta a reservar os veículos. A decisão anterior é apagada da ficha e continua registrada na Auditoria.',
      textoOk: semVaga ? 'Reabrir mesmo assim' : 'Reabrir',
    });
    if (ok) await executar(reabrirSolicitacao, 'Solicitação reaberta');
  } finally {
    btn.disabled = false;
  }
}
```
  `executar(fn, titulo)` e `fechaTudo()` continuam como hoje (fecham a pilha inteira e chamam `ctx.recarregar?.()`); como passam a depender de `s` e `ctx` do `ligarDecisoes`, declare-os dentro dele (ou passe `{ s, ctx }` por parâmetro) - sem variável de módulo.

- [ ] **Step 2: `views/editar.js`.** `git mv src/modules/sate/views/remanejar.js src/modules/sate/views/editar.js` e:
  - cabeçalho: "FundHub - sate/views/editar.js · Editar uma solicitação: quem aprova muda data, horários, destino, veículos, turma, responsável e observação - enquanto ela não está confirmada (spec 2026-10-10-sate-solicitacao, D4; a parte de data e veículos vem da spec 2026-09-13-sate-ciclo-de-aprovacao, D4)." Manter os dois parágrafos seguintes (estudantes e escolas não se editam aqui; as duas consequências ao salvar).
  - `export function abrirEditar(s, ctx, reabrir)`;
  - título: `modalHead('Editar solicitação', esc(tituloDoPedido(s)))`;
  - novo grupo, entre "Para onde e com quantos veículos" e o rodapé:

```html
<fieldset class="form-grupo">
  <legend>Turma e responsável</legend>
  <div class="campos duas">
    <label class="col-2">Turma(s) <input id="rm-turmas" type="text" value="${v('turmas')}" placeholder="Ex.: 5º A, 5º B" /></label>
    <label>Servidor(a) responsável <input id="rm-prof" type="text" value="${v('professor_nome')}" /></label>
    <label>Telefone / WhatsApp <input id="rm-tel" type="tel" inputmode="tel" value="${esc(s.professor_telefone ? exibirTelefone(s.professor_telefone) : '')}" placeholder="(00) 00000-0000" /></label>
    <label class="col-2">Observações <textarea id="rm-obs" rows="2">${v('observacao')}</textarea></label>
  </div>
</fieldset>
```
  - depois do `addEventListener` de submit: `document.getElementById('rm-tel').addEventListener('blur', (e) => { e.target.value = formatarTelefone(e.target.value); });`
  - no `patch` de `salvar`, depois de `qtd_vans`:

```js
    turmas: val('rm-turmas') || null,
    professor_nome: val('rm-prof') || null,
    professor_telefone: val('rm-tel') ? (paraE164(val('rm-tel')) || val('rm-tel')) : null,
    // O texto composto que a ficha do motorista e os pedidos antigos leem.
    contato_professor: [val('rm-prof'), val('rm-tel') ? formatarTelefone(val('rm-tel')) : ''].filter(Boolean).join(' · ') || null,
    observacao: val('rm-obs') || null,
```
  - import: `import { paraE164, formatarTelefone, exibirTelefone } from '../../../shared/ui/phones.js';`
  - toast: `'Solicitação atualizada'`; título do erro: `'Não foi possível salvar'`.
  - `grep -rn "remanejar\|Remanejar" src` depois: só podem sobrar o modo `'remanejar'` de `frota-extra.js` (é o nome de um modo interno, fica) e comentários que descrevem esse modo.

- [ ] **Step 3: `views/detalhe.js`** - reescrever. O arquivo inteiro:

```js
// ============================================================
// FundHub - sate/views/detalhe.js
// A ficha "Detalhes da solicitação": tudo o que ela é.
// Spec: 2026-10-10-sate-solicitacao-reformulada-design.md § D3.
//
// De cima para baixo, na ordem em que a pessoa precisa:
//   quadro-resumo  o que identifica a viagem de relance (destino, data,
//                  horários, endereço), com a cor da situação na lateral;
//   justificativa  em destaque, quando o pedido foi negado, cancelado ou
//                  tem cancelamento pedido - é o que mais importa ali;
//   Solicitação    quem pediu e para quem;
//   Logística      como a viagem acontece: horários, veículos, trajeto e
//                  as paradas;
//   histórico      quem pediu e quem decidiu, e quando;
//   decisões       no pé (views/decisoes.js).
//
// Rótulo e valor ficam LADO A LADO (`.det-par`, o par do hub). Só aparece
// o que tem valor: sem cadeirante, não há "0 cadeirantes".
//
// O título é o que o modal É, não o destino (ui.md, "Como um modal se
// chama"): uma solicitação não tem nome próprio.
// ============================================================
import { localAConferir, acoesDoPedido, STATUS, PERIODOS } from '../sate.model.js';
import { abrirEditar } from './editar.js';
import { abrirConferirDoPedido } from './conferir-local.js';
import { abrirDia } from './dia.js';
import { decisoesHtml, ligarDecisoes } from './decisoes.js';
import { getParticipacoes, resumoEscolas } from '../participacoes.model.js';
import { blocoHtml, ligarParticipantes } from './participantes.js';
import { pontosDaViagem, explicarTrajeto, atualizarTrajeto, retratoTrajeto } from '../rota.model.js';
import { linkRota, linkMaps } from '../../locais/geografia.model.js';
import { enderecoCompleto } from '../../locais/locais.model.js';
import { velocidadeOnibusKmh, margemParadaMin } from '../sate.config.js';
import { esc, vazio } from '../../../shared/dom.js';
import { fmtData, fmtDataHora, fmtCep } from '../../../shared/format.js';
import { exibirTelefone } from '../../../shared/ui/phones.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { loading, reportarErro } from '../../../shared/ui/feedback.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';

let ctx = null;

export async function abrirDetalhe(solicitacao, contexto) {
  ctx = contexto;
  const s = solicitacao;
  const reabrir = () => abrirDetalhe(s, ctx);
  const quem = s._escolas || s.unidade?.nome || 'Gerência de Transporte';

  abrirModal(`
    ${modalHead('Detalhes da solicitação', `${esc(quem)} · ${esc(fmtData(s.data))}`)}
    <div class="modal-body" id="det-corpo">${loading()}</div>`, { tamanho: 'medio' });

  // As paradas vêm do banco; o resto já está na linha da tabela.
  const paradas = await getParticipacoes(s.id).catch(() => []);
  const corpo = document.getElementById('det-corpo');
  if (!corpo) return;   // fechou enquanto carregava

  const pode = acoesDoPedido(s, { aprovador: !!ctx.aprovador, somenteLeitura: !!ctx.somenteLeitura });

  corpo.innerHTML = `
    ${resumoHtml(s, pode.editar)}
    ${motivoHtml(s)}

    <div class="ficha-secao"><h3>Solicitação</h3></div>
    ${par('Escola', esc(resumoEscolas(paradas) || quem))}
    ${par('Situação', `<span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>`)}
    ${par('Turma(s)', s.turmas ? esc(s.turmas) : '')}
    ${responsavelHtml(s)}
    ${par('Estudantes', estudantesHtml(s, paradas))}
    ${par('Observação', s.observacao ? esc(s.observacao) : '')}

    <div class="ficha-secao det-secao">
      <h3>Logística</h3>
      ${ctx.aprovador ? `<div class="ficha-secao-acoes">
        <button type="button" class="mini-btn" id="det-dia">${ico('calendario', { tam: 13 })} Ver disponibilidade do dia</button>
      </div>` : ''}
    </div>
    ${par('Embarque', s.horario_embarque ? `<b>${esc(s.horario_embarque)}</b>` : '')}
    ${par('Saída do evento', s.horario_retorno ? `<b>${esc(s.horario_retorno)}</b>` : '')}
    ${par('Veículos', `${s.qtd_onibus || 0} ônibus${s.qtd_vans ? ` · ${s.qtd_vans} van(s) adaptada(s)` : ''}`)}
    ${par('Trajeto', trajetoHtml(s, paradas))}
    ${blocoHtml(paradas, ctx)}

    ${historicoHtml(s)}
    ${decisoesHtml(s, pode.decisoes)}`;

  corpo.querySelector('#det-editar')?.addEventListener('click', () => abrirEditar(s, ctx, reabrir));
  corpo.querySelector('#det-dia')?.addEventListener('click', () => abrirDia(s.data, ctx, { voltar: reabrir, destaque: s.id }));
  corpo.querySelector('#det-recalc')?.addEventListener('click', (e) => recalcular(e.currentTarget, s));
  corpo.querySelector('#det-conferir')?.addEventListener('click', () => abrirConferirDoPedido(s, ctx, reabrir));
  ligarDecisoes(corpo, { s, ctx, paradas, reabrir });
  // `reabrir` e esta propria funcao: depois de mexer numa escola a
  // viagem volta a abrir com o dado novo, em vez de fechar a pilha.
  ligarParticipantes(corpo, { ctx, solicitacao: s, partes: paradas, reabrir });
}

// O par rótulo → valor do hub (`.det-par`, components.css). Sem valor,
// não há linha: a ficha mostra o que existe.
const par = (rotulo, html) =>
  (html ? `<div class="det-par"><span class="lbl">${esc(rotulo)}</span><span>${html}</span></div>` : '');

// ── Quadro-resumo ────────────────────────────────────────────
// O `.ficha-info` de toda ficha do hub, com a cor da SITUAÇÃO na lateral
// (a mesma da etiqueta) e o lápis no canto quando dá para editar.
function resumoHtml(s, podeEditar) {
  const linha = (icone, html) => (html ? `<li>${ico(icone, { tam: 14 })} ${html}</li>` : '');
  const horas = [s.horario_embarque, s.horario_retorno].filter(Boolean).map(esc).join(' – ');
  return `<section class="ficha-info det-resumo st-${esc(s.status)}">
    ${podeEditar ? `<button type="button" class="mini-btn ficha-editar" id="det-editar"
      aria-label="Editar solicitação" title="Editar solicitação">${ico('editar')}</button>` : ''}
    <b class="det-destino">${destino(s) ? esc(destino(s)) : vazio('destino não informado')}</b>
    <ul class="ficha-contato">
      ${linha('calendario', `${esc(fmtData(s.data))} <span class="tag">${esc(PERIODOS[s.periodo] || s.periodo || '')}</span>`)}
      ${linha('horario', horas)}
      ${linha('visita', enderecoHtml(s))}
    </ul>
  </section>`;
}

const destino = (s) => s.destino_nome || s.atividade?.local_nome || '';
const localDe = (s) => (ctx.locais || []).find(l => l.id === s.local_id) || null;

// O CEP vem do local do cadastro quando o pedido aponta para um; senão
// (ou se o local saiu do cadastro), do que ficou gravado no pedido.
const cepDestino = (s) => localDe(s)?.cep || s.destino_cep || '';

// Endereço do destino: as três partes (spec 2026-09-27, D3), com o
// endereço da atividade como último recurso para pedidos antigos.
function enderecoDestino(s) {
  const linha = enderecoCompleto({ endereco: s.destino_endereco, numero: s.destino_numero, bairro: s.destino_bairro })
    || s.atividade?.local_endereco || '';
  return linha && cepDestino(s) ? `${linha} · CEP ${fmtCep(cepDestino(s))}` : linha;
}

// O endereço, o link do mapa (só de local do cadastro, que tem ponto) e,
// para destino digitado pela escola (spec 2026-09-27, D6), a etiqueta
// "Local a conferir" - com o botão para quem aprova.
function enderecoHtml(s) {
  const l = localDe(s);
  const mapa = l ? (l.maps_url || linkMaps(l.latitude, l.longitude)) : null;
  const partes = [
    enderecoDestino(s) ? esc(enderecoDestino(s)) : '',
    mapa ? `<a href="${esc(mapa)}" target="_blank" rel="noopener">ver no mapa</a>` : '',
  ].filter(Boolean).join(' · ');
  if (!localAConferir(s)) return partes;
  const botao = ctx.aprovador && !ctx.somenteLeitura
    ? ` <button type="button" class="mini-btn" id="det-conferir">Conferir local</button>` : '';
  return `${partes} <span class="tag">Local a conferir</span>${botao}`;
}

// ── Justificativa ────────────────────────────────────────────
// Negado, cancelado e cancelamento pedido carregam o porquê - e, nesses
// casos, é a primeira coisa que a pessoa precisa ler.
const ROTULO_MOTIVO = { negado: 'Negada', cancelado: 'Cancelada', pendente_cancelamento: 'Cancelamento pedido' };

const motivoHtml = (s) => (s.motivo
  ? `<p class="det-motivo st-${esc(s.status)}"><b>${esc(ROTULO_MOTIVO[s.status] || 'Justificativa')}:</b> ${esc(s.motivo)}</p>` : '');

// ── Solicitação ──────────────────────────────────────────────
// Responsável: os campos novos (spec 2026-09-27, D8), com o telefone como
// link; nos pedidos anteriores a eles, o texto livre que havia.
function responsavelHtml(s) {
  if (!s.professor_nome && !s.professor_telefone) return par('Responsável', s.contato_professor ? esc(s.contato_professor) : '');
  return par('Responsável', s.professor_nome ? esc(s.professor_nome) : '')
    + par('Telefone', s.professor_telefone
      ? `<a href="tel:${esc(s.professor_telefone)}">${esc(exibirTelefone(s.professor_telefone))}</a>` : '');
}

// O total e o que pede atenção, numa linha. Surdos e "outra necessidade"
// vêm das paradas ATIVAS (spec 2026-09-27, D8): cancelada não embarca.
function estudantesHtml(s, paradas) {
  const ativas = (paradas || []).filter(p => p.status === 'ativa');
  const surdos = ativas.reduce((n, p) => n + (Number(p.qtd_surdo) || 0), 0);
  return [
    String(s.qtd_alunos || 0),
    s.qtd_cadeirante ? `${ico('cadeirante', { tam: 13 })} ${esc(String(s.qtd_cadeirante))} cadeirante(s)` : '',
    surdos ? `${surdos} surdo(s)` : '',
    ativas.some(p => p.necessidade_especifica) ? 'outra necessidade específica' : '',
  ].filter(Boolean).join(' · ');
}

// ── Trajeto ──────────────────────────────────────────────────
// O que se MOSTRA é o retrato gravado (spec 2026-09-13-sate-rota, D4): é
// ele que a regra do intervalo usa, e mostrar outro número induziria a
// decidir por uma conta que o sistema não está fazendo.
//
// O que se CALCULA AO VIVO é só o diagnóstico - quais paradas estão sem
// localização e o link do mapa -, porque isso sai das participações já
// carregadas e não gasta consulta nenhuma.
function trajetoHtml(s, paradas) {
  const vivo = pontosDaViagem(paradas, localDe(s));
  const gravado = s.trajeto_status === 'ok' && s.trajeto_km != null;

  let texto;
  if (gravado) texto = esc(explicarTrajeto({ status: 'ok', km: s.trajeto_km, min: s.trajeto_min }));
  else if (vivo.status !== 'ok') texto = vazio(explicarTrajeto(vivo));
  else if (s.trajeto_status === 'erro') texto = vazio(explicarTrajeto({ status: 'erro' }));
  else texto = vazio('ainda não calculado');

  const mapa = linkRota(vivo.pontos);
  const extras = [
    mapa ? `<a href="${esc(mapa)}" target="_blank" rel="noopener">${ico('externo', { tam: 12 })} Ver rota no mapa</a>` : '',
    ctx.aprovador && !ctx.somenteLeitura && vivo.status === 'ok'
      ? `<button type="button" class="mini-btn" id="det-recalc">${ico('atualizar', { tam: 12 })} Recalcular</button>` : '',
    gravado ? `<span class="det-trajeto-fonte">Distância: © OpenStreetMap</span>` : '',
  ].filter(Boolean).join('');

  return `${texto}${extras ? `<div class="det-trajeto-extras">${extras}</div>` : ''}`;
}

// Para depois de cadastrar uma localização que faltava. Atualiza a linha
// em memória com o retrato novo e reabre: a ficha desenha a partir dela,
// e a tabela embaixo recarrega por conta própria.
async function recalcular(btn, s) {
  btn.disabled = true;
  try {
    const r = await atualizarTrajeto(s, { velocidadeKmh: velocidadeOnibusKmh(), margemMin: margemParadaMin() });
    Object.assign(s, retratoTrajeto(r));
    toast({ titulo: r.status === 'ok' ? 'Trajeto recalculado' : 'Trajeto não calculado',
      texto: explicarTrajeto(r), tipo: r.status === 'ok' ? 'sucesso' : 'atencao' });
    await abrirDetalhe(s, ctx);
    ctx.recarregar?.();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível recalcular' });
    btn.disabled = false;
  }
}

// ── Histórico ────────────────────────────────────────────────
// Quem pediu e quem decidiu, e quando. Mostra a decisão EM VIGOR; as
// idas e vindas ficam na Auditoria. Timestamp só por fmtDataHora (R8).
const ROTULO_DECISAO = { confirmado: 'Confirmado por', negado: 'Negado por', cancelado: 'Cancelado por' };

function historicoHtml(s) {
  const quando = (quem, ts) => [quem ? esc(quem) : '', ts ? `em ${esc(fmtDataHora(ts))}` : ''].filter(Boolean).join(' ');
  const linhas = par('Solicitado por', quando(s.criado_por, s.criado_em))
    + (ROTULO_DECISAO[s.status] ? par(ROTULO_DECISAO[s.status], quando(s.decidido_por, s.decidido_em)) : '');
  return linhas ? `<section class="det-historico">
    <div class="ficha-secao"><h3>${ico('horario', { tam: 12 })} Histórico</h3></div>
    ${linhas}
  </section>` : '';
}
```

  Conferências obrigatórias antes de dar por pronto:
  - `grep -n "^export" src/shared/ui/feedback.js src/shared/ui/phones.js src/modules/sate/rota.model.js src/modules/locais/geografia.model.js src/modules/sate/sate.model.js` - todo símbolo importado existe (`reportarErro` e `loading` saem do mesmo `feedback.js`; `PERIODOS` é reexportado por `sate.model.js`);
  - o ícone `horario` dentro do `<h3>`: a regra de `.ficha-secao > h3` precisa alinhar ícone e texto - ver Step 5;
  - se `abrirDia` ou `abrirConferirDoPedido` não existirem com esses nomes (vêm de ciclos anteriores desta rodada), pare e reporte NEEDS_CONTEXT.

- [ ] **Step 4: `views/participantes.js`** - o bloco das paradas passa a ser uma parte da Logística:
  - em `blocoHtml`, o contêiner externo `class="field"` vira `class="field det-paradas"`; o texto "Escolas nesta viagem" fica; o botão `#dp-add` fica.
  - Nenhuma outra mudança neste arquivo.

- [ ] **Step 5: CSS.**

`src/styles/components.css`:
  - na regra existente `.det-par`/`.det-par .lbl` (perto de `.tabela-detalhe`), acrescentar logo abaixo:

```css
/* O PAR rótulo → valor do hub: nasceu no detalhe da tabela e é o mesmo
   em ficha de registro (spec 2026-10-10-sate-solicitacao, D3). Em modal o
   rótulo tem largura fixa - os valores alinham numa coluna - e o valor
   longo quebra dentro da própria coluna. */
.det-par > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.modal .det-par .lbl { flex: 0 0 8.5em; }
```
  - na regra `.ficha-secao > h3`, garantir `display: flex; align-items: center; gap: 6px;` (ícone ao lado de texto: quem alinha é o contêiner).

`src/modules/sate/sate.css`, no bloco "Modal de detalhe":
  - **remover** `.det-status` e `.det-acoes-pe > [data-acao="remanejar"]` (não existem mais);
  - acrescentar:

```css
/* Quadro-resumo: o .ficha-info do hub com a cor da SITUAÇÃO na lateral,
   a mesma da etiqueta. O padrão (--muted) vale para "solicitado". */
.det-resumo { --st: var(--muted); border-left: 4px solid var(--st); }
.det-resumo.st-confirmado { --st: var(--ok); }
.det-resumo.st-em_analise, .det-resumo.st-aguardando_transporte_adaptado,
.det-resumo.st-pendente_cancelamento { --st: var(--accent); }
.det-resumo.st-negado, .det-resumo.st-cancelado { --st: var(--danger); }
.det-destino { display: block; margin-bottom: 6px; padding-right: 44px; font-size: 15px; }
.det-resumo .tag { margin-left: 4px; }
/* A justificativa, logo abaixo do quadro: é o que mais importa num pedido
   negado ou cancelado. */
.det-motivo {
  margin: 0 0 18px; padding: 10px 12px; border-radius: var(--radius-btn);
  background: var(--atencao-bg); font-size: 13.5px; line-height: 1.45;
}
.det-motivo.st-negado, .det-motivo.st-cancelado { background: var(--erro-bg); }
.det-secao { margin-top: 18px; }
.det-paradas { margin-top: 10px; }
/* Histórico: discreto, ao pé - quem pediu, quem decidiu. */
.det-historico {
  margin-top: 18px; padding: 10px 12px; border-radius: var(--radius-btn);
  background: var(--surface-2); font-size: 12.5px;
}
.det-historico .ficha-secao { justify-content: flex-end; margin-bottom: 2px; }
.det-historico .det-par { padding: 2px 0; }
```
  Conferir que `--ok`, `--accent`, `--danger`, `--muted`, `--atencao-bg`, `--erro-bg`, `--surface-2`, `--radius-btn` existem em `src/styles/tokens.css`.

- [ ] **Step 6: `.claude/rules/ui.md`** - duas adições.

Na lista "Vocabulário existente", depois da linha "**Pessoa/vínculo em ficha:**…", acrescentar:

```markdown
- **Par rótulo → valor em linha:** `.det-par` (+ `.lbl`) - o detalhe expandido da tabela e os campos curtos de uma ficha de registro
```

Antes da seção "## Ícones: um por significado", acrescentar:

```markdown
## Como um modal se chama

Decisão do André (09/10/2026), spec `2026-10-10-sate-solicitacao-reformulada-design.md`, D1.

> **O título de um modal diz o que ele é ou faz; o subtítulo diz de qual registro.**
> O nome do modal, numa conversa, é o título que está na tela.

- **Ação ou formulário** - título = a ação: "Nova solicitação", "Negar solicitação",
  "Conferir local", "Editar escola".
- **Ficha de registro com nome próprio** (escola, servidor, projeto) - o título é o nome
  do registro, e o ícone diz o tipo. Chama-se "ficha da escola", "ficha do servidor".
- **Ficha de registro sem nome próprio** - título = o que o registro é ("Detalhes da
  solicitação"). Não tomar emprestado um campo (o destino, a data) para servir de título.

Nome de arquivo acompanha o nome na tela: o modal "Editar solicitação" mora em `editar.js`.

**Par rótulo → valor.** Campo curto de ficha de registro vai em `.det-par` (rótulo e
valor lado a lado); texto longo (pauta, descrição) continua em `.field`, empilhado.
Convertido no SATE em 10/10/2026. **Pendente, à espera da decisão do André:** as fichas
de ata, ocorrência, visita e projeto ainda usam `.field` também nos campos curtos.
```

- [ ] **Step 7:** `node --test "tests/*.test.mjs"`; verificador → 0 bloqueantes (ciclos: `decisoes.js` **não** importa `detalhe.js`; `editar.js` não importa `detalhe.js`). `wc -l src/modules/sate/views/detalhe.js src/modules/sate/views/decisoes.js src/modules/sate/views/editar.js` → todos ≤ 400. `grep -rn "abrirRemanejar\|remanejar.js\|det-status" src` → nada.

- [ ] **Step 8: Commit** - `feat(sate): ficha Detalhes da solicitacao, reabrir decisao e Editar solicitacao`.

---

### Task 3: O formulário - resumo do pedido e paradas no cadastro

**Files:**
- Create: `src/modules/sate/views/formulario-resumo.js`, `src/modules/sate/views/formulario-paradas.js`
- Modify: `src/modules/sate/views/formulario.js`, `src/modules/sate/sate.css`

**Interfaces:**
- Produces:
  - `formulario-resumo.js`: `resumoHtml() → string`; `ligarResumo({ ctx, ler })`, onde `ler()` devolve `{ data, emb, ret, alunos, cadeirantes, trajeto, localId }`; `revisar()` (repinta com atraso de 400 ms); `repintarResumo()` (repinta já).
  - `formulario-paradas.js`: `paradasHtml() → string`; `ligarParadas({ unidades, principal, aoMudar })` (`principal()` devolve o id da escola principal); `lerParadas() → [{ unidadeId, unidade, qtdAlunos, qtdCadeirante, horario }]`; `validarParadas() → { campo, texto } | null`; `destruirParadas()`.

**Antes de escrever:** ler `formulario.js`, `formulario-destino.js` e `formulario-quando.js` inteiros - os dois últimos são o modelo de "bloco com estado e contrato próprios".

- [ ] **Step 1: `formulario-resumo.js`** - a linha de saldo sai de `formulario.js` e vira o quadro-resumo.

Cabeçalho:

```js
// ============================================================
// FundHub - sate/views/formulario-resumo.js
// O RESUMO DO PEDIDO no modal de solicitação: o que a pessoa confere antes
// de enviar (spec 2026-10-10-sate-solicitacao-reformulada-design.md § D8).
//
// Um quadro só, logo acima do botão: quantos estudantes e veículos,
// quantos ônibus estão livres para aquele horário, o tempo de viagem - e,
// dentro dele, os erros (que impedem o envio) e os avisos (que não).
//
// Separado de formulario.js por ter estado e contrato próprios: a consulta
// de vagas com atraso, o descarte da resposta velha e o cadastro rápido de
// frota. O formulário só diz O QUE foi digitado (`ler`) e pede a revisão.
// ============================================================
```

**Mover** de `formulario.js` para este arquivo, preservando os comentários: as variáveis `pedidoSaldo` e `deb`, e as funções `revisar`, `pintarSaldo` e `avaliar` - com todos os imports que elas usam (`lerOcupacao`, `intervaloDaViagem`, `livresPara`, `totalDoDia`, `proximoHorario`, `livresNoPeriodo`, `trajetoParaVaga`, `periodoDe`, `avaliarPedido`, `capacidadeOnibus`, `capacidadeVan`, `antecedenciaMinDias`, `trajetoProvisorioMin`, `cadastroRapidoHtml`, `ligarCadastroRapido`, `explicarTrajeto`, `fmtData`, `hojeISO`, `esc`). Mudanças ao mover:

  - o estado de fora chega por `ligarResumo({ ctx, ler })`, guardado em variáveis de módulo `ctx` e `ler`; `ligarResumo` zera `pedidoSaldo` e `deb` (cada abertura do modal começa limpa);
  - no lugar de `val('f-data')`, `val('f-emb')` etc., usar o que `ler()` devolve (`const { data, emb, ret, alunos, cadeirantes, trajeto, localId } = ler();`);
  - a caixa passa a ser `#f-resumo` (some `#f-saldo` e `#f-trajeto`);
  - `export const repintarResumo = () => pintarSaldo();` (o cadastro rápido de frota chama isto ao terminar - hoje ele recebe `pintarSaldo`);
  - o HTML pintado: um quadro com uma lista de fatos e, abaixo, erros e avisos.

```js
export const resumoHtml = () => `<div id="f-resumo" class="sol-resumo" aria-live="polite" hidden></div>`;
```
  e, dentro de `pintarSaldo`, no lugar da montagem de `linhas`:

```js
  const precisa = `${alunos} estudante(s) · ${r.onibus} ônibus (${capacidadeOnibus()} lugares cada)`
    + (r.vans ? ` · ${r.vans} van(s) adaptada(s)` : '');
  const quando = iv ? `para embarque às ${esc(emb)}` : 'no período';
  const fatos = [
    `<li>${ico('onibus', { tam: 14 })} ${esc(precisa)}</li>`,
    totalDia ? `<li>${ico('calendario', { tam: 14 })} <b>${Math.max(0, livres)}</b> ônibus livres ${quando} em ${esc(fmtData(data))}</li>` : '',
    trajeto ? `<li>${ico('horario', { tam: 14 })} <span class="${trajeto.status === 'ok' ? '' : 'fora'}">${esc(explicarTrajeto(trajeto))}</span>${trajeto.status === 'ok' ? ' <span class="sol-trajeto-fonte">Distância: © OpenStreetMap</span>' : ''}</li>` : '',
  ].filter(Boolean).join('');
  const linhas = [
    `<ul class="sol-resumo-fatos">${fatos}</ul>`,
    ...r.erros.map(e => `<div class="sol-erro">${esc(e.texto)}</div>`),
    ...r.avisos.map(a => `<div class="sol-aviso">${esc(a.texto)}</div>`),
  ];
```
  (conferir em `regras.model.js` se `avaliarPedido` devolve `vans`; se não devolver, calcular com `vansPara(cadeirantes, capacidadeVan())`.) O quadro fica `hidden` enquanto faltam data, período ou nº de estudantes (onde hoje se faz `box.innerHTML = ''`), e visível quando há o que mostrar: `box.hidden = false`.

  O aviso `linha.aproximado` ("Contagem sem horário…") continua onde está, dentro de `linhas`, se ainda existir no código.

- [ ] **Step 2: `formulario-paradas.js`** - o arquivo inteiro:

```js
// ============================================================
// FundHub - sate/views/formulario-paradas.js
// "Outras escolas no mesmo ônibus", no modal de solicitação - só para quem
// tem escrita no SATE (spec 2026-10-10-sate-solicitacao-reformulada-design.md
// § D6). A escola pede só para si; quem aprova monta a viagem com várias
// paradas já no cadastro, e revisa depois na ficha.
//
// Separado de formulario.js por ter estado e contrato próprios, como
// formulario-destino.js: a lista de escolas acrescentadas. O formulário só
// pergunta "quais são as outras paradas?" e "estão válidas?".
//
// UMA busca para acrescentar, e uma linha por escola já acrescentada: uma
// busca por linha deixaria um ouvinte de `document` por parada.
// ============================================================
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { esc } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';

let escolas = [];        // as unidades, para achar a escolhida
let linhas = [];         // [{ id, nome }] - o resto mora nos campos
let busca = null;        // handle de criarBuscaSelecao (destruído ao reabrir)
let principal = () => '';
let aoMudar = () => {};

export const paradasHtml = () => `
  <div class="col-2 sol-paradas">
    <div class="lbl">Outras escolas no mesmo ônibus</div>
    <div id="f-paradas-lista" class="sol-paradas-lista"></div>
    <div id="f-paradas-busca"></div>
    <small class="form-hint">Cada escola é uma parada de embarque. A ordem das paradas se ajusta depois, na solicitação.</small>
  </div>`;

const idDe = (u) => u.id || u.numero;

// A principal e as já acrescentadas somem da busca: a mesma escola duas
// vezes na viagem seriam duas cotas para o mesmo embarque.
function opcoes() {
  const fora = new Set([principal(), ...linhas.map(l => l.id)]);
  return escolas.filter(u => !fora.has(idDe(u)))
    .map(u => ({ id: idDe(u), rotulo: u.nome, detalhe: u.segmento || '', busca: u.apelido || '' }));
}

function montarBusca() {
  busca?.destruir();
  const el = document.getElementById('f-paradas-busca');
  if (!el) return;
  el.innerHTML = '';
  busca = criarBuscaSelecao(el, {
    rotulo: 'Acrescentar escola',
    opcoes: opcoes(),
    placeholder: 'Digite para buscar a escola…',
    onChange: (id) => {
      const u = escolas.find(x => idDe(x) === id);
      if (!u) return;
      linhas.push({ id, nome: u.nome });
      pintar();
      montarBusca();   // a escolhida sai das opções e o campo volta vazio
      document.querySelector(`[data-parada="${CSS.escape(String(id))}"] input`)?.focus();
      aoMudar();
    },
  });
}

// Repintar preserva o que já foi digitado nas outras linhas.
function pintar() {
  const box = document.getElementById('f-paradas-lista');
  if (!box) return;
  const antes = lerCampos();
  box.innerHTML = linhas.map(l => {
    const v = antes[l.id] || {};
    return `<div class="sol-parada" data-parada="${esc(l.id)}">
      <b>${esc(l.nome)}</b>
      <label>Estudantes <input type="number" inputmode="numeric" min="1" data-campo="alunos" value="${esc(v.alunos ?? '')}" aria-label="Estudantes de ${esc(l.nome)}" /></label>
      <label>Cadeirantes <input type="number" inputmode="numeric" min="0" data-campo="cadeira" value="${esc(v.cadeira ?? '0')}" aria-label="Cadeirantes de ${esc(l.nome)}" /></label>
      <label>Embarque <input type="time" data-campo="hora" value="${esc(v.hora ?? '')}" aria-label="Horário de embarque de ${esc(l.nome)}" /></label>
      <button type="button" class="mini-btn no" data-tirar="${esc(l.id)}" aria-label="Tirar ${esc(l.nome)}">${ico('excluir')}</button>
    </div>`;
  }).join('');
}

function lerCampos() {
  const out = {};
  document.querySelectorAll('#f-paradas-lista [data-parada]').forEach(el => {
    const c = (nome) => el.querySelector(`[data-campo="${nome}"]`)?.value ?? '';
    out[el.dataset.parada] = { alunos: c('alunos'), cadeira: c('cadeira'), hora: c('hora') };
  });
  return out;
}

export function ligarParadas({ unidades, principal: qualPrincipal, aoMudar: mudou }) {
  escolas = [...(unidades || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
  linhas = [];
  principal = qualPrincipal;
  aoMudar = mudou;
  pintar();
  montarBusca();

  const box = document.getElementById('f-paradas-lista');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tirar]');
    if (!b) return;
    linhas = linhas.filter(l => String(l.id) !== b.dataset.tirar);
    pintar();
    montarBusca();
    aoMudar();
  });
  box.addEventListener('input', aoMudar);
}

// A escola principal mudou: se ela estava entre as paradas, sai; e as
// opções da busca acompanham.
export function aoMudarPrincipal() {
  const p = principal();
  if (linhas.some(l => l.id === p)) { linhas = linhas.filter(l => l.id !== p); pintar(); }
  montarBusca();
}

export function lerParadas() {
  const campos = lerCampos();
  return linhas.map(l => {
    const c = campos[l.id] || {};
    return {
      unidadeId: l.id,
      unidade: escolas.find(u => idDe(u) === l.id) || null,
      qtdAlunos: parseInt(c.alunos, 10) || 0,
      qtdCadeirante: parseInt(c.cadeira, 10) || 0,
      horario: c.hora || null,
    };
  });
}

// Devolve o erro COM o campo, para o formulário apontá-lo.
export function validarParadas() {
  for (const p of lerParadas()) {
    if (!p.qtdAlunos) {
      return {
        campo: document.querySelector(`[data-parada="${CSS.escape(String(p.unidadeId))}"] [data-campo="alunos"]`),
        texto: `Informe o nº de estudantes de ${p.unidade?.nome || 'cada escola'}.`,
      };
    }
  }
  return null;
}

export function destruirParadas() {
  busca?.destruir();
  busca = null;
  linhas = [];
}
```
  Conferir em `src/shared/ui/busca-selecao.js` a assinatura de `criarBuscaSelecao` (opções `rotulo`, `opcoes`, `placeholder`, `onChange`; métodos `destruir`). Se `onChange` receber o id por outro nome, ajustar.

- [ ] **Step 3: `formulario.js`** - ligar os dois blocos.

  - Título: `modalHead(ico('onibus', { tam: 20 }) + 'Nova solicitação')`.
  - No grupo **Origem**, depois do campo "Nº de estudantes": `${aprovador ? paradasHtml() : ''}`.
  - As duas `<div>` `#f-trajeto` e `#f-saldo` são substituídas por `${resumoHtml()}`.
  - Em `ligar()`:
    - `destruirParadas();` no início;
    - `ligarResumo({ ctx, ler: lerParaResumo });`
    - `if (ctx.aprovador) ligarParadas({ unidades: ctx.unidades, principal: escolaId, aoMudar: () => { pintarTrajeto(); revisar(); } });`
    - `aoMudarEscola` passa a chamar também `if (ctx.aprovador) aoMudarPrincipal();`
  - Função nova:

```js
// Tudo o que o resumo precisa saber do que foi digitado - a soma dos
// estudantes e dos cadeirantes inclui as outras paradas (spec D6).
function lerParaResumo() {
  const extras = ctx.aprovador ? lerParadas() : [];
  return {
    data: val('f-data'), emb: val('f-emb') || null, ret: val('f-ret') || null,
    alunos: (parseInt(val('f-alunos'), 10) || 0) + extras.reduce((n, p) => n + p.qtdAlunos, 0),
    cadeirantes: (parseInt(val('f-cadeira'), 10) || 0) + extras.reduce((n, p) => n + p.qtdCadeirante, 0),
    trajeto, localId: lerDestino().localId,
  };
}
```
  - `pintarTrajeto()` deixa de escrever em `#f-trajeto` (a caixa não existe mais): calcula, guarda em `trajeto` e chama `revisar()`. As participações do cálculo passam a incluir as paradas extras, na ordem:

```js
    participacoes: [
      { unidade_id: escola.id || escola.numero, unidade: escola, status: 'ativa', ordem: 1 },
      ...(ctx.aprovador ? lerParadas() : []).map((p, i) => ({ unidade_id: p.unidadeId, unidade: p.unidade, status: 'ativa', ordem: i + 2 })),
    ],
```
    Enquanto calcula, `trajeto = null`.
  - Em `enviar()`:
    - depois de `validarDestino`: `const extras = aprovador ? lerParadas() : [];` e `const erroParada = aprovador ? validarParadas() : null; if (erroParada) return erro(erroParada.campo, erroParada.texto);`
    - os veículos da `viagem` saem do **total**: `const totalAlunos = qtd + extras.reduce((n, p) => n + p.qtdAlunos, 0); const totalCadeira = cadeira + extras.reduce((n, p) => n + p.qtdCadeirante, 0);` → `qtd_onibus: onibusPara(totalAlunos, capacidadeOnibus())`, `qtd_vans: vansPara(totalCadeira, capacidadeVan())`. `qtd_cadeirante` do cabeçalho continua sendo `cadeira` (o da primeira participação - o gatilho recalcula o total quando as outras entram). A `participacao` da escola principal não muda.
    - depois de `await criarSolicitacao(viagem, participacao)`:

```js
    const criada = await criarSolicitacao(viagem, participacao);
    // As outras paradas entram em seguida (spec D6). Se alguma falhar, a
    // viagem EXISTE: avisa qual não entrou, para acrescentar pela solicitação.
    const naoEntraram = [];
    for (const p of extras) {
      try {
        await acrescentar(criada.id, { unidadeId: p.unidadeId, qtdAlunos: p.qtdAlunos, qtdCadeirante: p.qtdCadeirante, horario: p.horario });
      } catch (_) { naoEntraram.push(p.unidade?.nome || 'uma escola'); }
    }
    fecharModal();
    ctx.recarregar?.();
    if (naoEntraram.length) {
      toast({ titulo: 'Solicitação enviada, mas falta acrescentar', tipo: 'atencao',
        texto: `${naoEntraram.join(', ')} não entrou na viagem. Abra a solicitação e use "Acrescentar parada".` });
    } else {
      toast({ titulo: 'Solicitação enviada', texto: escola, tipo: 'sucesso' });
    }
```
      (substitui o trecho atual `await criarSolicitacao…; fecharModal(); ctx.recarregar?.(); toast(…)`). Import: `import { acrescentar } from '../participacoes.model.js';`. Conferir que `criarSolicitacao` devolve a linha criada com `id` (ela devolve `data` do RPC `criar_viagem`).
  - No `catch` de `enviar`, a chamada `pintarSaldo()` vira `repintarResumo()`.
  - Remover de `formulario.js` os imports que passaram a ser só do resumo. Conferir um a um com grep.

- [ ] **Step 4: `sate.css`.** Substituir as regras de `.sol-saldo`, `.sol-saldo-num` e `.sol-trajeto`/`.sol-trajeto-txt` (a caixa antiga) por:

```css
/* Resumo do pedido: o que a pessoa confere antes de enviar. Um quadro só,
   com a faixa lateral na cor do SATE (spec 2026-10-10-sate-solicitacao, D8). */
.sol-resumo {
  display: flex; flex-direction: column; gap: 8px;
  margin: 4px 0 12px; padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--brand) 18%, var(--border));
  border-left: 4px solid var(--brand); border-radius: var(--radius);
  background: color-mix(in srgb, var(--brand) 5%, var(--surface));
}
.sol-resumo[hidden] { display: none; }
.sol-resumo-fatos { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13.5px; }
.sol-resumo-fatos > li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.sol-resumo-fatos .ico { color: var(--muted); flex: 0 0 auto; }
.sol-resumo-fatos .fora { color: var(--muted); }

/* Outras escolas no mesmo ônibus (quem aprova). */
.sol-paradas { display: flex; flex-direction: column; gap: 8px; }
.sol-paradas-lista { display: flex; flex-direction: column; gap: 8px; }
.sol-paradas-lista:empty { display: none; }
.sol-parada {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-btn);
}
.sol-parada > b { grid-column: 1 / -1; }
.sol-parada > label { display: flex; flex-direction: column; gap: 4px; }
.sol-parada > .mini-btn { justify-self: end; }
@media (min-width: 720px) {
  .sol-parada { grid-template-columns: 2fr 1fr 1fr 1fr auto; }
  .sol-parada > b { grid-column: auto; align-self: center; }
}
```
  `.sol-trajeto-fonte` continua (é usada dentro do resumo). `grep -rn "sol-saldo\|sol-trajeto-txt\|f-saldo\|f-trajeto" src` → só `sol-trajeto-fonte` pode sobrar.

- [ ] **Step 5:** `node --test "tests/*.test.mjs"`; verificador → 0 bloqueantes; `wc -l src/modules/sate/views/formulario*.js` → todos ≤ 400.

- [ ] **Step 6: Commit** - `feat(sate): resumo do pedido e paradas no formulario de solicitacao`.

---

### Task 4: Tutorial, changelog e versões

**Files:**
- Modify: `docs/modulos/sate.md`, `CHANGELOG.md`, `src/core/config.js`

- [ ] **Step 1: `src/core/config.js`** - `versao: '0.43.0'`, `versaoSate: '0.21.0'`.

- [ ] **Step 2: `CHANGELOG.md`.**
  - Tabela "Versões do SATE", nova primeira linha: `| 0.21.0 | 0.43.0 | solicitação redesenhada, reabrir decisão, editar antes de confirmar, várias escolas já no pedido, nome completo na lista |`
  - Nova entrada acima da mais recente (ler a entrada anterior inteira como modelo literal de formato):

```markdown
## [0.43.0] - 2026-10-10

> SATE 0.21.0. Não exige atualização do banco.

### Adicionado

- **Reabrir uma decisão** (quem aprova): uma solicitação negada, cancelada ou confirmada
  pode voltar para análise pelo botão **Reabrir** (em pedido confirmado, **Voltar para
  análise**). Daí ela pode ser confirmada ou negada de novo. Se não houver veículo livre
  no horário, o sistema avisa antes.
- **Várias escolas já no pedido** (quem aprova): em **Nova solicitação**, o bloco
  **Outras escolas no mesmo ônibus** acrescenta as demais paradas na hora de cadastrar.
  Os ônibus e o tempo de viagem já consideram todas. A escola continua pedindo só para si.
- **Resumo do pedido**, logo acima do botão de enviar: estudantes, ônibus necessários,
  ônibus livres para o horário e tempo de viagem, num quadro só.

### Alterado

- **A solicitação tem outra cara.** A janela agora se chama **Detalhes da solicitação** e
  traz um quadro com destino, data, horários e endereço; as informações com rótulo e valor
  lado a lado, em **Solicitação** e **Logística**; a justificativa em destaque quando o
  pedido foi negado ou cancelado; e o histórico (quem pediu, quem decidiu, quando) ao pé.
- **Editar solicitação** substitui "Remanejar": é o lápis no canto do quadro, e passa a
  permitir também turma, responsável, telefone e observação. Só aparece enquanto a
  solicitação não está confirmada - para editar uma confirmada, volte-a para análise.
- **A lista mostra o nome completo da escola.** Em tela estreita, o apelido em maiúsculas.
```

- [ ] **Step 3: `docs/modulos/sate.md`** - rever as seções afetadas, com os nomes de botão como aparecem na tela:
  - "### Pedir transporte": o título da janela (**Nova solicitação**), o quadro-resumo no lugar da "linha de saldo", e - para quem aprova - o bloco **Outras escolas no mesmo ônibus**.
  - "### Aprovar ou negar": a janela **Detalhes da solicitação** (quadro, Solicitação, Logística, Histórico).
  - "### Remanejar um pedido" → "### Editar uma solicitação (quem aprova)": o lápis, os campos, e a regra "só antes de confirmar".
  - Nova seção "### Reabrir uma decisão (quem aprova)", logo depois: os três casos, o aviso de falta de veículo, e que a decisão anterior some da ficha e continua na Auditoria.
  - "### Montar e ajustar as paradas (quem aprova)": as paradas agora nascem no pedido; a revisão continua na solicitação, em **Logística**.
  - "## Quem pode o quê" e "## Regras que o sistema aplica": editar só antes de confirmar; reabrir avisa e não bloqueia.
  - "## Perguntas frequentes": "Neguei por engano. E agora?" → Reabrir.
  - Procurar no arquivo inteiro por "Remanejar", "linha de saldo" e pelo antigo título da janela, e atualizar o que restar.
  - Carimbo final: `> Atualizado na versão 0.43.0.`

  Regras: escrito para quem usa; nenhum nome de arquivo, tabela, função ou coluna; nenhum dado real.

- [ ] **Step 4:** `node --test "tests/*.test.mjs"`; verificador → 0 bloqueantes.

- [ ] **Step 5:** ler o `git diff --cached` procurando dado real. **Commit** - `feat: 0.43.0 - solicitacao reformulada, reabrir decisao e paradas no cadastro`.
