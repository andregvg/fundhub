# Disponibilidade com calendário escolar - Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A página Disponibilidade mostra o calendário escolar; o formulário acusa a data bloqueada ao escolher; quem aprova abre o modal "Disponibilidade do dia", que substitui a frase "fora ele" da ficha.

**Architecture:** Uma leitura por intervalo e a interpretação do dia (funções puras) em `calendario.model.js` - é o vocabulário do próprio calendário, e `sate/regras.model.js` já está perto do teto de 250 linhas; o intervalo de um pedido como função pura em `disponibilidade.model.js`; um arquivo de view novo (`views/dia.js`) para o modal. **A conta de vagas não muda.**

**Tech Stack:** JS ES modules sem build, Supabase (PostgREST), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-10-sate-disponibilidade-calendario-design.md`

## Global Constraints

- Sem npm, sem dependência nova.
- Kernel (`src/core`, `src/shared`) nunca importa `src/modules` (R1). View nunca chama `sb()`; model nunca toca no DOM (R3). Só `*.model.js` atravessa a fronteira de um módulo (R2).
- Todo valor do banco passa por `esc()` antes de entrar em template literal (R5).
- Nenhuma cor literal em `src/modules/**`: só `var(--token)` (R9).
- Datas: data civil é `string` `yyyy-mm-dd`; nenhuma view chama `toISOString`/`toLocaleDateString` - formatação só por `shared/format.js` (R8).
- **Repositório público:** nenhum dado real em código, comentário, teste ou doc.
- **Não alterar** `lerOcupacao`, `livresPara`, `intervaloDaViagem`, `montarLinha` nem nada em `supabase/migrations/` - decisão do André: a contagem fica como está.
- PT-BR em código, comentário e commit. Commits na `dev`, com a linha final `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Limites: view ≤ 400 linhas, model ≤ 250.
- A cada tarefa: `node --test "tests/*.test.mjs"` (todos passam) e `python .claude/scripts/verificar_arquitetura.py` (0 bloqueantes).
- **Não** subir versão nem mexer no CHANGELOG antes da Task 4.

## Review Focus

1. Tabela do calendário ausente ou leitura falhando → a Disponibilidade abre como hoje, sem eventos e sem erro.
2. Dia marcado ao mesmo tempo como não letivo e bloqueado → vale "bloqueado".
3. Evento com nome longo → cortado no card, inteiro no `title` e no modal.
4. Pedido noturno (ocupa até o meio-dia seguinte) → o modal diz "do dia seguinte", não uma hora maior que 24.
5. Modal do dia fechado enquanto carrega → nenhuma escrita em nó que não existe mais.

---

### Task 1: Modelos - calendário por intervalo, situação do dia e intervalo de um pedido

**Files:**
- Modify: `src/modules/calendario/calendario.model.js`
- Modify: `src/modules/sate/disponibilidade.model.js`
- Test: `tests/calendario-dia.test.mjs` (novo), `tests/sate-disponibilidade.test.mjs`

**Interfaces:**
- Produces:
  - `getDiasCalendario(de, ate) → Promise<{ [dataISO]: { data, letivo, tipo, evento, bloqueia_extraclasse } }>` em `calendario.model.js`.
  - `situacaoDoDia(dia) → 'bloqueado' | 'nao_letivo' | 'evento' | null`, `diaImpedeExtraclasse(dia) → boolean`, `motivoDoDia(dia) → string`, `ROTULO_DIA`, também em `calendario.model.js`.
  - `ocupacaoDoPedido(s, paradas = [], intervaloMin = 0) → { ini, fim }` em `disponibilidade.model.js`.

- [ ] **Step 1: Testes que falham.**

Criar `tests/calendario-dia.test.mjs`:

```js
// O que um dia do calendário escolar significa para o extraclasse
// (spec 2026-10-10-sate-disponibilidade, D1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situacaoDoDia, diaImpedeExtraclasse, motivoDoDia } from '../src/modules/calendario/calendario.model.js';

test('situacaoDoDia: dia sem registro ou comum é null', () => {
  assert.equal(situacaoDoDia(null), null);
  assert.equal(situacaoDoDia(undefined), null);
  assert.equal(situacaoDoDia({ letivo: true, evento: null, bloqueia_extraclasse: false }), null);
  assert.equal(situacaoDoDia({ letivo: true, evento: '   ', bloqueia_extraclasse: false }), null);
});

test('situacaoDoDia: as três situações', () => {
  assert.equal(situacaoDoDia({ letivo: false, evento: 'Feriado' }), 'nao_letivo');
  assert.equal(situacaoDoDia({ letivo: true, bloqueia_extraclasse: true, evento: 'Prova' }), 'bloqueado');
  assert.equal(situacaoDoDia({ letivo: true, evento: 'Mostra cultural' }), 'evento');
});

test('situacaoDoDia: bloqueado vence não letivo', () => {
  assert.equal(situacaoDoDia({ letivo: false, bloqueia_extraclasse: true }), 'bloqueado');
});

test('diaImpedeExtraclasse: só não letivo e bloqueado impedem', () => {
  assert.equal(diaImpedeExtraclasse({ letivo: false }), true);
  assert.equal(diaImpedeExtraclasse({ letivo: true, bloqueia_extraclasse: true }), true);
  assert.equal(diaImpedeExtraclasse({ letivo: true, evento: 'Mostra' }), false);
  assert.equal(diaImpedeExtraclasse(null), false);
});

test('motivoDoDia: a frase de cada situação, com e sem evento', () => {
  assert.equal(motivoDoDia({ letivo: true, bloqueia_extraclasse: true, evento: 'Prova' }), 'Data bloqueada para extraclasse (Prova).');
  assert.equal(motivoDoDia({ letivo: true, bloqueia_extraclasse: true }), 'Data bloqueada para extraclasse.');
  assert.equal(motivoDoDia({ letivo: false, evento: 'Feriado' }), 'Não é dia letivo (Feriado).');
  assert.equal(motivoDoDia({ letivo: true, evento: 'Mostra' }), 'Neste dia: Mostra.');
  assert.equal(motivoDoDia(null), '');
});
```

Em `tests/sate-disponibilidade.test.mjs`, acrescentar `ocupacaoDoPedido` ao import do topo e, ao fim do arquivo:

```js
// ── O intervalo de UM pedido (spec 2026-10-10-sate-disponibilidade, D3) ──
test('ocupacaoDoPedido: embarque até saída + trajeto + intervalo', () => {
  const s = { periodo: 'manha', horario_embarque: '07:30', horario_retorno: '11:00', trajeto_min: 30 };
  assert.deepEqual(ocupacaoDoPedido(s, [], 120), { ini: 450, fim: 810 });
});

test('ocupacaoDoPedido: o embarque é o da parada mais cedo', () => {
  const s = { periodo: 'manha', horario_embarque: '07:30', horario_retorno: '11:00', trajeto_min: 30 };
  const paradas = [{ status: 'ativa', horario: '07:10' }, { status: 'cancelada', horario: '06:00' }];
  assert.equal(ocupacaoDoPedido(s, paradas, 120).ini, 430);
});

test('ocupacaoDoPedido: a noite ocupa até o meio-dia seguinte', () => {
  const s = { periodo: 'noite', horario_embarque: '18:30', horario_retorno: '22:00', trajeto_min: 20 };
  assert.deepEqual(ocupacaoDoPedido(s, [], 120), { ini: 1110, fim: 2160 });
});

test('faltaParaConfirmar continua igual depois de usar ocupacaoDoPedido', () => {
  const s = { periodo: 'manha', horario_embarque: '07:30', horario_retorno: '11:00', trajeto_min: 30, qtd_onibus: 3, qtd_vans: 0 };
  const l = linha(frota(4), [oc(420, 900, 2)]);
  assert.deepEqual(faltaParaConfirmar(s, l), { onibus: 1, vans: 0 });
});
```

- [ ] **Step 2:** `node --test tests/calendario-dia.test.mjs tests/sate-disponibilidade.test.mjs` → FALHA (exports ausentes).

- [ ] **Step 3: `calendario.model.js`** - ao fim do arquivo (funções puras; não tocam no banco):

```js
// ── O que um dia significa para o extraclasse ────────────────
// A leitura de um registro de `dia_calendario` para quem agenda uma saída
// (spec 2026-10-10-sate-disponibilidade, D1). Mora aqui, e não no SATE,
// porque é o vocabulário do próprio calendário: a Disponibilidade, o
// modal do dia e o formulário do SATE fazem todos a mesma leitura.
//
//   'bloqueado'   extraclasse bloqueado - vence o resto, é a regra mais específica
//   'nao_letivo'  feriado, recesso
//   'evento'      dia letivo com evento (prova, evento pedagógico, cultural)
//   null          dia comum, ou sem registro: o silêncio é o dia letivo
export function situacaoDoDia(dia) {
  if (!dia) return null;
  if (dia.bloqueia_extraclasse) return 'bloqueado';
  if (dia.letivo === false) return 'nao_letivo';
  return String(dia.evento || '').trim() ? 'evento' : null;
}

export const ROTULO_DIA = Object.freeze({ bloqueado: 'Extraclasse bloqueado', nao_letivo: 'Não letivo' });

// A escola não pede transporte nestes dias; quem aprova pode (aviso, não erro).
export const diaImpedeExtraclasse = (dia) => ['bloqueado', 'nao_letivo'].includes(situacaoDoDia(dia));

// A frase que a pessoa lê sob o campo de data e na recusa do envio.
export function motivoDoDia(dia) {
  const evento = String(dia?.evento || '').trim();
  const com = (texto) => `${texto}${evento ? ` (${evento})` : ''}.`;
  switch (situacaoDoDia(dia)) {
    case 'bloqueado': return com('Data bloqueada para extraclasse');
    case 'nao_letivo': return com('Não é dia letivo');
    case 'evento': return `Neste dia: ${evento}.`;
    default: return '';
  }
}
```

- [ ] **Step 4: `disponibilidade.model.js`** - logo depois de `embarqueEfetivo`:

```js
// O intervalo que UM pedido ocupa, pelo mesmo critério do banco: embarque
// efetivo (o da parada mais cedo), saída, tempo de viagem gravado ou o
// provisório, e o intervalo mínimo. Um lugar só para quem precisa mostrar
// ou comparar esse intervalo (faltaParaConfirmar, o modal do dia).
export function ocupacaoDoPedido(s, paradas = [], intervaloMin = 0) {
  return intervaloDaViagem({
    periodo: s.periodo, embarque: embarqueEfetivo(s, paradas), retorno: s.horario_retorno,
    trajetoMin: trajetoParaVaga(s, trajetoProvisorioMin()), intervaloMin,
  });
}
```
  e `faltaParaConfirmar` passa a usá-la - trocar a desestruturação inicial por:

```js
  const { ini, fim } = ocupacaoDoPedido(s, paradas, linha.intervaloMin);
```
  (o resto da função fica igual).

- [ ] **Step 5: ainda em `calendario.model.js`** - depois de `getDiaCalendario`:

```js
// Os dias REGISTRADOS num intervalo (inclusive), indexados pela data
// civil. Dia sem registro não aparece: é dia letivo comum. Usado pela
// Disponibilidade do SATE para mostrar feriado, bloqueio e evento.
export async function getDiasCalendario(de, ate) {
  if (!hasSupabase()) return {};
  const { data, error } = await sb().from('dia_calendario')
    .select('data, letivo, tipo, evento, bloqueia_extraclasse')
    .gte('data', de).lte('data', ate);
  if (error) throw error;
  return Object.fromEntries((data || []).map(d => [d.data, d]));
}
```

- [ ] **Step 6:** `node --test "tests/*.test.mjs"` → tudo passa; verificador → 0 bloqueantes.

- [ ] **Step 7: Commit** - `feat(sate): situacao do dia no calendario escolar e intervalo de um pedido`.

---

### Task 2: Calendário nos cards, modal "Disponibilidade do dia" e o botão na ficha

**Files:**
- Create: `src/modules/sate/views/dia.js`
- Modify: `src/modules/sate/views/disponibilidade.js`, `src/modules/sate/views/detalhe.js`, `src/modules/sate/sate.css`

**Interfaces:**
- Consumes: `getDiasCalendario`, `situacaoDoDia`, `ROTULO_DIA`, `diaImpedeExtraclasse` (todos de `calendario/calendario.model.js`) e `ocupacaoDoPedido` (Task 1).
- Produces: em `views/dia.js` - `abrirDia(data, ctx, { voltar = null, destaque = null } = {})` e `faixaCalendarioHtml(dia, { completo = false } = {})`.

- [ ] **Step 1: Criar `src/modules/sate/views/dia.js`:**

```js
// ============================================================
// FundHub - sate/views/dia.js
// O modal "Disponibilidade do dia" (quem aprova).
// Spec: 2026-10-10-sate-disponibilidade-calendario-design.md § D3.
//
// Um número de ônibus livres não decide nada sozinho. Aqui está o que o
// explica: o que o calendário escolar diz do dia, quanto a frota tem,
// quanto está em uso em cada período e QUAIS viagens ocupam os veículos,
// do embarque até a hora em que eles voltam a ficar livres.
//
// Abre por dois caminhos: o card do dia, na Disponibilidade, e o botão
// "Ver disponibilidade do dia" da ficha de um pedido - que passa `voltar`
// (o ← devolve à ficha) e `destaque` (o id do pedido, realçado na lista).
//
// Só para quem aprova: a escola vê números, nunca de quem é a reserva
// (a promessa da migration 036). O RLS é quem garante; a tela nem oferece.
// ============================================================
import { lerOcupacao, livresNoPeriodo, escadaDaTarde, totalDoDia, ocupacaoDoPedido, DIA } from '../disponibilidade.model.js';
import { getSolicitacoesDoDia, STATUS, STATUS_RESERVA, PERIODOS } from '../sate.model.js';
import { getParticipacoesDe, resumoEscolas } from '../participacoes.model.js';
import { getFrotas, rotulaTipo } from '../frota.model.js';
import { paraHora, tituloDoPedido } from '../regras.model.js';
import { getDiaCalendario, situacaoDoDia, ROTULO_DIA } from '../../calendario/calendario.model.js';
import { esc } from '../../../shared/dom.js';
import { fmtExtenso } from '../../../shared/format.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

// O que o calendário escolar diz do dia - a mesma faixa no card da
// Disponibilidade e neste modal. No card o nome do evento é cortado com
// reticências (e vem inteiro no `title`); aqui, `completo`, ele quebra.
export function faixaCalendarioHtml(dia, { completo = false } = {}) {
  const sit = situacaoDoDia(dia);
  if (!sit) return '';
  const evento = String(dia.evento || '').trim();
  const rotulo = ROTULO_DIA[sit] ? `<b>${esc(ROTULO_DIA[sit])}</b>` : '';
  const tipo = sit === 'evento' && dia.tipo ? `<small>${esc(dia.tipo)}</small>` : '';
  return `<div class="disp-cal ${sit}${completo ? ' completo' : ''}" title="${esc(evento)}">
    ${ico('calendario', { tam: 13 })}${rotulo}${evento ? `<span>${esc(evento)}</span>` : ''}${tipo}
  </div>`;
}

// "13:10" no mesmo dia; "12:00 do dia seguinte" quando a ocupação vira a
// meia-noite (a viagem da noite segura o veículo até o meio-dia).
const horaLivre = (fim) => (fim >= DIA ? `${paraHora(fim - DIA)} do dia seguinte` : paraHora(fim));

export async function abrirDia(data, ctx, { voltar = null, destaque = null } = {}) {
  abrirModal(`
    ${modalHead('Disponibilidade do dia', esc(fmtExtenso(data)))}
    <div class="modal-body" id="dia-corpo">${loading()}</div>`, { tamanho: 'medio', voltar });
  const meu = document.getElementById('dia-corpo');

  let linha, pedidos, frotas, cal;
  try {
    [linha, pedidos, frotas, cal] = await Promise.all([
      lerOcupacao(data),
      getSolicitacoesDoDia(data),
      getFrotas({ vigenteEm: data }).catch(() => []),
      getDiaCalendario(data).catch(() => null),   // o calendário informa; não derruba o modal
    ]);
  } catch (err) {
    if (document.getElementById('dia-corpo') === meu) meu.innerHTML = erroBox(err);
    return;
  }
  const partes = await getParticipacoesDe(pedidos.map(s => s.id)).catch(() => ({}));
  if (document.getElementById('dia-corpo') !== meu) return;   // fechou, ou abriu outro, enquanto carregava

  meu.innerHTML = `
    ${faixaCalendarioHtml(cal, { completo: true })}
    ${frotaHtml(linha, frotas)}
    ${periodosHtml(linha)}
    ${viagensHtml(linha, pedidos, partes, destaque)}`;
}

function frotaHtml(linha, frotas) {
  const onibus = totalDoDia(linha, 0, 'onibus'), vans = totalDoDia(linha, 0, 'vans');
  const total = [`${onibus} ônibus`, vans ? `${vans} van(s) adaptada(s)` : ''].filter(Boolean).join(' · ');
  const composicao = frotas.length
    ? frotas.map(f => `<li>${esc(f.rotulo?.nome || 'sem rótulo')} · ${esc(String(f.quantidade))} ${esc(rotulaTipo(f.tipo).toLowerCase())}</li>`).join('')
    : '<li class="vazio">sem frota neste dia</li>';
  return `<section class="dia-secao">
    <h3>Frota do dia</h3>
    <p class="dia-total">${esc(total)}</p>
    <ul class="dia-lista">${composicao}</ul>
  </section>`;
}

// `livres` pode ficar negativo quando os pedidos estouram a frota: mostrar
// o estouro em vez de escondê-lo atrás de um "em uso" que não fecha a conta.
function periodosHtml(linha) {
  const total = totalDoDia(linha, 0, 'onibus');
  const linhaPer = (p) => {
    const livres = livresNoPeriodo(linha, 0, p, 'onibus');
    const emUso = Math.max(0, total - livres);
    let texto = `<b>${Math.max(0, livres)}</b> livres`;
    if (p === 'tarde') {
      texto = escadaDaTarde(linha, 0, 'onibus').map((g, k) => (k === 0
        ? `<b>${Math.max(0, g.livres)}</b> livres`
        : `<b>${Math.max(0, g.livres)}</b> a partir das ${esc(paraHora(g.aPartirDe))}`)).join(' · ');
    }
    const estouro = livres < 0 ? ` · <span class="dia-estouro">faltam ${-livres}</span>` : '';
    return `<div class="det-par"><span class="lbl">${esc(PERIODOS[p])}</span>
      <span>${texto} · ${emUso} em uso${estouro}</span></div>`;
  };
  return `<section class="dia-secao">
    <h3>Ônibus por período</h3>
    ${['manha', 'tarde', 'noite'].map(linhaPer).join('')}
    <p class="form-hint">Para uma viagem típica de cada período. O horário exato de cada viagem está abaixo.</p>
  </section>`;
}

function viagensHtml(linha, pedidos, partes, destaque) {
  const veiculos = (s) => [`${s.qtd_onibus || 0} ônibus`, s.qtd_vans ? `${s.qtd_vans} van(s)` : ''].filter(Boolean).join(' · ');
  const item = (s, ocupa) => {
    const iv = ocupacaoDoPedido(s, partes[s.id] || [], linha.intervaloMin);
    const quando = ocupa ? `${paraHora(iv.ini)} · livre às ${horaLivre(iv.fim)}` : 'não ocupa veículo';
    return `<li class="dia-viagem${s.id === destaque ? ' atual' : ''}${ocupa ? '' : ' fora'}"${s.id === destaque ? ' aria-current="true"' : ''}>
      <span class="dia-hora">${esc(quando)}</span>
      <b>${esc(resumoEscolas(partes[s.id] || []) || s.unidade?.nome || 'Gerência de Transporte')}</b>
      <span class="di-meta">${esc(tituloDoPedido(s))} · ${esc(veiculos(s))}</span>
      <span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>
    </li>`;
  };
  const inicio = (s) => ocupacaoDoPedido(s, partes[s.id] || [], linha.intervaloMin).ini;
  const ocupam = pedidos.filter(s => STATUS_RESERVA.includes(s.status)).sort((a, b) => inicio(a) - inicio(b));
  const pendentes = pedidos.filter(s => s.status === 'pendente_cancelamento');

  // Os ônibus da noite anterior seguram a manhã e não são viagem deste dia.
  const vespera = linha.ocup.filter(o => o.ini < 0 && o.fim > 0 && o.onibus > 0);
  const linhaVespera = vespera.length
    ? `<li class="dia-viagem vespera"><span class="dia-hora">até ${esc(paraHora(Math.max(...vespera.map(o => o.fim))))}</span>
        <b>${vespera.reduce((n, o) => n + o.onibus, 0)} ônibus da noite anterior</b></li>` : '';

  const linhas = linhaVespera + ocupam.map(s => item(s, true)).join('') + pendentes.map(s => item(s, false)).join('');
  return `<section class="dia-secao">
    <h3>Viagens do dia</h3>
    <ul class="dia-viagens">${linhas || '<li class="vazio">nenhuma viagem neste dia</li>'}</ul>
  </section>`;
}
```

  Antes de seguir, conferir com `grep -n "^export" src/modules/sate/sate.model.js src/modules/sate/participacoes.model.js src/modules/sate/frota.model.js src/modules/sate/regras.model.js src/modules/sate/disponibilidade.model.js src/modules/calendario/calendario.model.js src/shared/ui/feedback.js` que **todos** os símbolos importados acima existem com esses nomes (em especial `DIA`, `STATUS_RESERVA`, `getSolicitacoesDoDia`, `erroBox`). Se algum não existir, pare e reporte NEEDS_CONTEXT - não invente.

- [ ] **Step 2: `views/disponibilidade.js` - calendário nos cards.**

Imports: acrescentar `import { getDiasCalendario, diaImpedeExtraclasse, situacaoDoDia } from '../../calendario/calendario.model.js';` e `import { abrirDia, faixaCalendarioHtml } from './dia.js';`. Remover o import de `getFrotas, rotulaTipo` (passa a ser só do modal).

(a) Em `carregar()`, a ocupação e o calendário são lidos juntos; o calendário falha em silêncio:

```js
  let linha, calendario;
  try {
    [linha, calendario] = await Promise.all([
      lerOcupacao(seg, sexta),
      getDiasCalendario(seg, sexta).catch(() => ({})),   // informa; não derruba a página
    ]);
  }
  catch (err) { if (meu === pedido) box.innerHTML = erroBox(err); return; }
```
  e `diaHtml` recebe o registro do dia: `dias.map(d => diaHtml(linha, d, hoje, calendario[d.data] || null))`.

(b) `diaHtml(linha, { i, data }, hoje, cal)`:
  - `const sit = situacaoDoDia(cal);` e `const impede = diaImpedeExtraclasse(cal);`
  - a classe do card ganha a situação: `${sit === 'bloqueado' ? 'bloqueado' : sit === 'nao_letivo' ? 'nao-letivo' : ''}`;
  - a faixa `faixaCalendarioHtml(cal)` entra logo depois do cabeçalho (`cab`), **também** no ramo "sem frota";
  - **escola** (`!ctx.aprovador`) num dia que impede: no lugar do total e das linhas de período, só `<span class="vazio">Não há viagens neste dia</span>`;
  - **quem aprova** num dia que impede: os números aparecem como hoje, dentro de `<div class="disp-nums esmaecido">…</div>`; nos outros dias, dentro de `<div class="disp-nums">…</div>` (o contêiner novo embrulha `.disp-tot`, as três linhas de período e a de vans);
  - o `aria-label` do card clicável passa a ser `Ver a disponibilidade de ${esc(fmtData(data))} em detalhe`;
  - a `<div class="disp-comp" hidden></div>` **sai**.

(c) O clique abre o modal. Apagar as funções `usoPorPeriodo` e `abrirDia` deste arquivo e a variável `linhaAtual` (com a atribuição em `carregar`), e trocar os dois ouvintes de `#disp-corpo` por:

```js
  // Quem aprova abre o dia em detalhe (views/dia.js). Clique, Enter ou Espaço.
  const abrir = (e) => {
    const card = e.target.closest('[data-dia]');
    if (card && ctx.aprovador) abrirDia(card.dataset.dia, ctx);
  };
  document.getElementById('disp-corpo').addEventListener('click', abrir);
  document.getElementById('disp-corpo').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('[data-dia]')) return;
    e.preventDefault();
    abrir(e);
  });
```
  Atualizar o cabeçalho de comentário do arquivo: a última frase ("Quem aprova vê também, ao abrir o dia, a composição por rótulo.") vira "Quem aprova abre o dia em detalhe (views/dia.js). Cada card mostra também o que o calendário escolar diz do dia (spec 2026-10-10-sate-disponibilidade, D1)."

- [ ] **Step 3: `views/detalhe.js` - a frase "fora ele" sai, entra o botão.**

  - No `Promise.all` de `abrirDetalhe`, remover a leitura `lerOcupacao(s.data, s.data, { excluir: s.id })` e a variável `linha` (fica só `getParticipacoes`). **Não** mexer em `confirmarPedido`, que lê a ocupação por conta própria.
  - O bloco `.det-status` passa a ser:

```js
    <div class="det-status">
      <span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>
      ${ctx.aprovador ? `<button type="button" class="mini-btn" id="det-dia">${ico('calendario', { tam: 13 })} Ver disponibilidade do dia</button>` : ''}
    </div>
```
  - Ligar o botão, junto dos outros ouvintes:

```js
  corpo.querySelector('#det-dia')?.addEventListener('click', () =>
    abrirDia(s.data, ctx, { voltar: () => abrirDetalhe(s, ctx), destaque: s.id }));
```
  - Imports: acrescentar `import { abrirDia } from './dia.js';`; do import de `disponibilidade.model.js` tirar o que deixou de ser usado neste arquivo (`intervaloDaViagem`, `livresPara`, `embarqueEfetivo`, `trajetoParaVaga` - conferir com grep um a um; `lerOcupacao` e `faltaParaConfirmar` continuam em uso por `confirmarPedido`); tirar `trajetoProvisorioMin` do import de `sate.config.js` se ficou sem uso.

- [ ] **Step 4: `sate.css`** - no bloco "Página Disponibilidade", substituir a regra `.disp-comp` por:

```css
/* O calendário escolar no card (spec 2026-10-10-sate-disponibilidade, D1).
   Mesma linguagem do módulo Calendário: tom neutro para não letivo, tom
   de alerta para extraclasse bloqueado. */
.disp-dia.nao-letivo { background: var(--surface-2); }
.disp-dia.bloqueado {
  background: color-mix(in srgb, var(--danger) 8%, var(--surface));
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
}
.disp-cal {
  display: flex; align-items: center; gap: 6px; min-width: 0;
  font-size: 12.5px; color: var(--muted);
}
.disp-cal > .ico { flex: 0 0 auto; }
.disp-cal > b { flex: 0 0 auto; color: var(--text); }
.disp-cal.bloqueado > b { color: var(--danger); }
.disp-cal > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.disp-cal > small { flex: 0 0 auto; }
.disp-cal.completo { flex-wrap: wrap; margin-bottom: 14px; font-size: 13.5px; }
.disp-cal.completo > span { white-space: normal; overflow: visible; }
.disp-nums { display: flex; flex-direction: column; gap: 6px; }
.disp-nums.esmaecido { opacity: .6; }

/* ── Modal "Disponibilidade do dia" ───────────────────────── */
.dia-secao { margin-bottom: 18px; }
.dia-secao > h3 { margin: 0 0 6px; font-size: 13px; }
.dia-total { margin: 0 0 4px; font-weight: 600; }
.dia-lista { margin: 0; padding: 0; list-style: none; font-size: 13px; color: var(--muted); }
.dia-estouro { color: var(--danger); font-weight: 600; }
.dia-viagens { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.dia-viagem {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px;
  padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-btn);
}
.dia-viagem.atual { border-color: var(--brand); box-shadow: inset 0 0 0 1px var(--brand); }
.dia-viagem.fora, .dia-viagem.vespera { background: var(--surface-2); }
.dia-hora { flex: 0 0 auto; font-variant-numeric: tabular-nums; font-size: 13px; color: var(--muted); }
.dia-viagem > .di-meta { flex: 1 1 100%; }
```
  Conferir que `--radius-btn`, `--surface-2`, `--danger`, `--brand`, `--muted`, `--text`, `--border` existem em `src/styles/tokens.css` (grep). Se algum não existir, usar o token equivalente que o arquivo já usa.

- [ ] **Step 5:** `node --test "tests/*.test.mjs"`; verificador → 0 bloqueantes (checagem 12: nenhuma classe sem CSS - `disp-comp` não pode sobrar em JS; checagem de ciclos: `dia.js` não importa `disponibilidade.js` nem `detalhe.js`).

- [ ] **Step 6: Commit** - `feat(sate): calendario escolar na Disponibilidade e modal do dia`.

---

### Task 3: O formulário avisa da data ao escolher

**Files:**
- Modify: `src/modules/sate/views/formulario-quando.js`, `src/modules/sate/views/formulario.js`

**Interfaces:**
- Consumes: `getDiaCalendario` (já existe), `diaImpedeExtraclasse`, `motivoDoDia` (Task 1), todos de `calendario/calendario.model.js`.
- Produces: `ligarQuando(aoMudar, { aprovador = false } = {})`.

- [ ] **Step 1: `formulario-quando.js`.**

Imports: `import { getDiaCalendario, diaImpedeExtraclasse, motivoDoDia } from '../../calendario/calendario.model.js';`.

`ligarQuando(aoMudar, { aprovador = false } = {})`. Dentro dela, antes de `pintarExtenso`:

```js
  // O calendário escolar do dia escolhido (spec 2026-10-10-sate-disponibilidade,
  // D2): consultado ao escolher a data, e não só no envio. `consulta`
  // descarta a resposta de uma data que a pessoa já trocou.
  let diaCal = null, consulta = 0;
  const conferirCalendario = async () => {
    const meu = ++consulta;
    diaCal = null;
    if (!nativo.value) return;
    const d = await getDiaCalendario(nativo.value).catch(() => null);   // sem calendário, segue sem aviso
    if (meu !== consulta || !document.getElementById('f-dia')) return;
    diaCal = d;
    pintarExtenso();
  };
```

`pintarExtenso` passa a considerar o calendário. Depois das duas checagens de erro que já existem e antes de escrever em `ext`:

```js
    // Dia não letivo ou bloqueado: erro para a escola, aviso para quem
    // aprova (R15 - erro barra, aviso não). Evento em dia letivo só informa.
    const motivo = motivoDoDia(diaCal);
    if (!erro && motivo && diaImpedeExtraclasse(diaCal) && !aprovador) erro = motivo;
    const nota = !erro && motivo ? ` · ${motivo}${diaImpedeExtraclasse(diaCal) ? ' Você pode agendar mesmo assim.' : ''}` : '';
    ext.textContent = erro || (nativo.value ? fmtExtenso(nativo.value) + nota : DICA);
```
  (substitui a linha `ext.textContent = …` atual; `ext.classList.toggle('err', !!erro)` e `dia.setCustomValidity(erro)` continuam logo depois).

Chamar `conferirCalendario()` nos dois pontos em que a data muda: dentro do `if (nativo.value !== iso) { … }` do ouvinte de `input`, e no ouvinte de `change` do campo nativo (depois de `pintarExtenso()`).

- [ ] **Step 2: `formulario.js`.**
  - A chamada vira `ligarQuando(revisar, { aprovador: !!ctx.aprovador });`.
  - No bloco "Bloqueios do calendário escolar" de `enviar`, as duas condições passam a usar as funções puras (acrescentar `diaImpedeExtraclasse, motivoDoDia` ao import de `calendario.model.js` que o arquivo já tem):

```js
  if (!aprovador) {
    try {
      const dia = await getDiaCalendario(data);
      if (diaImpedeExtraclasse(dia)) return erro('#f-dia', motivoDoDia(dia));
    } catch (_) { /* sem calendário carregado, segue */ }
  }
```

- [ ] **Step 3:** `node --test "tests/*.test.mjs"`; verificador → 0 bloqueantes; `wc -l src/modules/sate/views/formulario.js` ≤ 400.

- [ ] **Step 4: Commit** - `feat(sate): formulario acusa data bloqueada ao escolher`.

---

### Task 4: Tutorial, changelog e versões

**Files:**
- Modify: `docs/modulos/sate.md`, `CHANGELOG.md`, `src/core/config.js`

- [ ] **Step 1: `src/core/config.js`** - `versao: '0.42.0'`, `versaoSate: '0.20.0'`.

- [ ] **Step 2: `CHANGELOG.md`.**
  - Tabela "Versões do SATE", nova primeira linha: `| 0.20.0 | 0.42.0 | calendário escolar na Disponibilidade, o dia em detalhe para quem aprova, data bloqueada avisada ao escolher |`
  - Nova entrada acima da mais recente (ler a entrada anterior inteira como modelo literal de formato):

```markdown
## [0.42.0] - 2026-10-10

> SATE 0.20.0. Não exige atualização do banco.

### Adicionado

- **Calendário escolar na Disponibilidade.** Cada dia mostra o que o calendário diz dele:
  feriado e recesso ("Não letivo"), dia com extraclasse bloqueado, ou o nome do evento do
  dia (prova, evento pedagógico). Num dia em que a escola não pode pedir transporte, ela
  não vê números de ônibus - vê "Não há viagens neste dia".
- **Disponibilidade do dia** (para quem aprova): clicar num dia abre uma janela com a frota
  do dia, os ônibus em uso e livres em cada período e a lista das viagens que ocupam os
  veículos, com a hora em que cada uma os libera. A mesma janela abre pela solicitação, no
  botão **Ver disponibilidade do dia**.

### Alterado

- **O pedido avisa da data na hora.** Ao escolher uma data que é feriado ou está bloqueada
  para extraclasse, o aviso aparece logo abaixo do campo, antes de preencher o resto. Quem
  aprova vê o aviso e pode agendar mesmo assim.
- Na solicitação, saiu a frase "N ônibus livres no horário deste pedido, fora ele". Ela
  descontava o próprio pedido e dava a impressão de que ele não ocupava ônibus. A contagem
  de vagas **não mudou**.
```

- [ ] **Step 3: `docs/modulos/sate.md`.**
  - "### Consultar a disponibilidade": novo item sobre o calendário escolar (as três situações e o que a escola vê num dia sem viagens); o item 5 (quem aprova clica num dia) passa a descrever a janela **Disponibilidade do dia**: frota, ônibus por período e viagens do dia.
  - "### Pedir transporte": no passo da data, dizer que o sistema avisa logo abaixo do campo quando o dia é feriado, não letivo ou bloqueado.
  - "### Aprovar ou negar": citar o botão **Ver disponibilidade do dia**.
  - "## Regras que o sistema aplica": conferir que "data bloqueada / não letiva" continua listada como bloqueio para a escola e aviso para quem aprova.
  - "## Ligações com outros módulos": a Disponibilidade lê o Calendário.
  - Carimbo final: `> Atualizado na versão 0.42.0.`

  Regras: escrito para quem usa; nenhum nome de arquivo, tabela, função ou coluna; botão nomeado como aparece na tela.

- [ ] **Step 4:** `node --test "tests/*.test.mjs"`; verificador → 0 bloqueantes.

- [ ] **Step 5:** ler o `git diff --cached` procurando dado real. **Commit** - `feat: 0.42.0 - calendario escolar na Disponibilidade e o dia em detalhe`.
