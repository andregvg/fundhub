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

// Recolhida: viagem com várias escolas é exceção. Com várias paradas a
// viagem cabe em UM ônibus - o total de lugares é conferido no formulário.
export const paradasHtml = () => `
  <details class="col-2 sol-recolher sol-paradas" id="f-paradas-det">
    <summary>${ico('adicionar', { tam: 14 })} Adicionar pontos de parada</summary>
    <div class="sol-recolher-corpo">
      <div id="f-paradas-lista" class="sol-paradas-lista"></div>
      <div id="f-paradas-busca"></div>
      <small class="form-hint">Cada escola é uma parada de embarque, na ordem em que o ônibus passa. Use as setas para reordenar.</small>
    </div>
  </details>`;

// Escola 01 é a principal; as paradas seguem de 02.
export const rotuloEscola = (n) => `Escola ${String(n).padStart(2, '0')}`;

// Origem: quem aprova escolhe a escola (e pode juntar outras no mesmo
// ônibus). A escola já é a origem do próprio pedido: com uma unidade só, o
// grupo nem aparece; com mais de uma, escolhe numa lista curta.
export function origemHtml(unidades, perfil, aprovador) {
  if (aprovador) {
    return `<fieldset class="form-grupo">
          <legend>Origem</legend>
          <div class="campos duas">
            <div id="f-esc-busca" class="col-2"></div>
            ${paradasHtml()}
          </div>
        </fieldset>`;
  }
  const minhas = (unidades || []).filter(u => (perfil?.unidades || []).includes(u.id));
  if (minhas.length === 1) return `<input type="hidden" id="f-esc" value="${esc(minhas[0].id || minhas[0].numero)}" />`;
  return `<fieldset class="form-grupo">
          <legend>Origem</legend>
          <div class="campos"><label>Escola <select id="f-esc" required>${opcoesEscola(unidades, perfil)}</select></label></div>
        </fieldset>`;
}

// A escola escolhe só entre as dela - antes a lista trazia a rede inteira e
// o banco recusava o pedido feito para outra unidade, com um erro que a
// pessoa não entendia. Nome completo, como
// no cartão da escola (spec 2026-10-02, D13).
function opcoesEscola(unidades, perfil) {
  const minhas = perfil?.unidades || [];
  const lista = [...(unidades || [])]
    .filter(u => minhas.includes(u.id))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
  return '<option value="">Selecione…</option>'
    + lista.map(u => `<option value="${esc(u.id || u.numero)}">${esc(u.nome)}</option>`).join('');
}

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
    const i = linhas.indexOf(l);
    return `<div class="sol-parada" data-parada="${esc(l.id)}">
      <b><span class="sol-parada-n">${rotuloEscola(i + 2)}</span> ${esc(l.nome)}</b>
      <label>Qtd. estudantes <input type="number" inputmode="numeric" min="1" data-campo="alunos" value="${esc(v.alunos ?? '')}" aria-label="Estudantes de ${esc(l.nome)}" /></label>
      <label>Qtd. adultos <input type="number" inputmode="numeric" min="0" data-campo="adultos" value="${esc(v.adultos ?? '0')}" aria-label="Adultos acompanhantes de ${esc(l.nome)}" /></label>
      <label>Cadeirantes <input type="number" inputmode="numeric" min="0" data-campo="cadeira" value="${esc(v.cadeira ?? '0')}" aria-label="Cadeirantes de ${esc(l.nome)}" /></label>
      <label>Embarque <input type="time" data-campo="hora" value="${esc(v.hora ?? '')}" aria-label="Horário de embarque de ${esc(l.nome)}" /></label>
      <span class="sol-parada-acoes">
        <button type="button" class="mini-btn" data-mover="-1" data-id="${esc(l.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Subir ${esc(l.nome)}" title="Subir">${ico('chevron', { tam: 14 })}</button>
        <button type="button" class="mini-btn" data-mover="1" data-id="${esc(l.id)}" ${i === linhas.length - 1 ? 'disabled' : ''} aria-label="Descer ${esc(l.nome)}" title="Descer">${ico('chevron', { tam: 14 })}</button>
        <button type="button" class="mini-btn no" data-tirar="${esc(l.id)}" aria-label="Tirar ${esc(l.nome)}">${ico('excluir')}</button>
      </span>
    </div>`;
  }).join('');
}

function lerCampos() {
  const out = {};
  document.querySelectorAll('#f-paradas-lista [data-parada]').forEach(el => {
    const c = (nome) => el.querySelector(`[data-campo="${nome}"]`)?.value ?? '';
    out[el.dataset.parada] = { alunos: c('alunos'), adultos: c('adultos'), cadeira: c('cadeira'), hora: c('hora') };
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
    const m = e.target.closest('[data-mover]');
    if (m) {
      const i = linhas.findIndex(l => String(l.id) === m.dataset.id);
      const j = i + Number(m.dataset.mover);
      if (i < 0 || j < 0 || j >= linhas.length) return;
      [linhas[i], linhas[j]] = [linhas[j], linhas[i]];
      pintar();
      aoMudar();
      return;
    }
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
// Devolve o nome da escola retirada (ou null), para o formulário avisar:
// a linha some com o que a pessoa já tinha digitado nela.
export function aoMudarPrincipal() {
  const p = principal();
  const tirada = linhas.find(l => l.id === p);
  if (tirada) { linhas = linhas.filter(l => l.id !== p); pintar(); }
  montarBusca();
  return tirada ? tirada.nome : null;
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
      qtdAdultos: parseInt(c.adultos, 10) || 0,
      horario: c.hora || null,
    };
  });
}

// Devolve o erro COM o campo, para o formulário apontá-lo.
export function validarParadas() {
  for (const p of lerParadas()) {
    if (!p.qtdAlunos) {
      document.getElementById('f-paradas-det').open = true;
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

// Rascunho das paradas: o formulário é refeito quando a pessoa vai editar o
// local e volta (formulario.js), e as paradas digitadas voltam com ele.
export const rascunhoParadas = () => { const c = lerCampos(); return linhas.map(l => ({ ...l, ...(c[l.id] || {}) })); };

export function restaurarParadas(rascunho) {
  if (!rascunho?.length) return;
  linhas = rascunho.map(({ id, nome }) => ({ id, nome }));
  pintar();
  for (const p of rascunho) {
    const el = document.querySelector(`[data-parada="${CSS.escape(String(p.id))}"]`);
    for (const c of ['alunos', 'adultos', 'cadeira', 'hora']) { const i = el?.querySelector(`[data-campo="${c}"]`); if (i) i.value = p[c] ?? ''; }
  }
  document.getElementById('f-paradas-det').open = true;
  montarBusca();
  aoMudar();
}
