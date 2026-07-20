// ============================================================
// FundHub — modules/visitas/visitas.view.js
// Relatórios de visita técnica às escolas. Leitura para autorizados;
// CRUD para admin. Filtros por período, escola e status.
// ============================================================
import {
  TIPOS, STATUS, STATUS_TAG,
  getVisitas, criarVisita, atualizarVisita, excluirVisita,
} from './visitas.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { esc, norm, val, falha } from '../../shared/dom.js';
import { hojeISO, fmtData, addDias } from '../../shared/format.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';
import { criarFiltroSegmento, indexarUnidades } from '../../shared/ui/filtro-segmento.js';

let perfil = null, unidades = [], lista = [], idxUnidades = {};
let seg = null;
let filtro = { de: addDias(hojeISO(), -90), ate: hojeISO(), unidadeId: '', status: '', q: '' };

// Escolas do segmento selecionado — alimenta o seletor e o recorte da lista.
const unidadesDoSegmento = () =>
  [...unidades].filter(u => !seg || seg.combina(u)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

function pintarSeletorEscolas() {
  const sel = document.getElementById('vi-uni');
  sel.innerHTML = `<option value="">Todas as escolas</option>` +
    unidadesDoSegmento()
      .map(u => `<option value="${esc(u.id || u.numero)}">${esc(u.nome)}</option>`).join('');
  // A escola escolhida pode ter saído do recorte: reseta em vez de
  // manter um filtro invisível que "some" com os resultados.
  if (filtro.unidadeId && !sel.querySelector(`option[value="${CSS.escape(filtro.unidadeId)}"]`)) {
    filtro.unidadeId = '';
  }
  sel.value = filtro.unidadeId;
}

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;

  app.innerHTML = `
    <div class="page-head">
      <h1>Relatórios de Visita</h1>
      <p>Registro das visitas técnicas às escolas pela equipe de acompanhamento.</p>
    </div>
    <div class="toolbar">
      <label class="search">🔎
        <input id="vi-q" type="search" placeholder="Buscar por escola, responsável, pauta…" autocomplete="off" />
      </label>
      <button id="vi-novo" class="btn-primary" hidden>+ Novo relatório</button>
    </div>
    <div id="vi-seg" class="toolbar-linha"></div>
    <div class="toolbar subfiltros">
      <label class="search compacta">De <input id="vi-de" type="date" value="${filtro.de}" /></label>
      <label class="search compacta">Até <input id="vi-ate" type="date" value="${filtro.ate}" /></label>
      <label class="search compacta">🏫 <select id="vi-uni"><option value="">Todas as escolas</option></select></label>
      <div class="filters" id="vi-status">
        <button class="chip" data-st="">Todos</button>
        ${Object.entries(STATUS).map(([k, v]) => `<button class="chip" data-st="${k}">${esc(v)}</button>`).join('')}
      </div>
      <span class="count" id="vi-count"></span>
    </div>
    <div id="vi-lista">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();

  try { unidades = await getUnidades(); }
  catch (err) { document.getElementById('vi-lista').innerHTML = erroBox(err); return; }

  idxUnidades = indexarUnidades(unidades);
  seg = criarFiltroSegmento(document.getElementById('vi-seg'), {
    perfil, chaveMemoria: 'fundhub:seg:visitas',
    onChange: () => { pintarSeletorEscolas(); carregar(); },
  });
  pintarSeletorEscolas();

  document.getElementById('vi-q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  document.getElementById('vi-de').addEventListener('change', e => { filtro.de = e.target.value; carregar(); });
  document.getElementById('vi-ate').addEventListener('change', e => { filtro.ate = e.target.value; carregar(); });
  document.getElementById('vi-uni').addEventListener('change', e => { filtro.unidadeId = e.target.value; carregar(); });
  document.getElementById('vi-status').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    filtro.status = b.dataset.st; carregar();
  });

  if (perfil?.isAdmin) {
    const novo = document.getElementById('vi-novo');
    novo.hidden = false;
    novo.addEventListener('click', () => abrirForm(null));
  }

  carregar();
}

async function carregar() {
  document.querySelectorAll('#vi-status .chip').forEach(b =>
    b.classList.toggle('on', b.dataset.st === filtro.status));

  const box = document.getElementById('vi-lista');
  box.innerHTML = loading();
  try {
    lista = await getVisitas({
      de: filtro.de || undefined, ate: filtro.ate || undefined,
      unidadeId: filtro.unidadeId || undefined, status: filtro.status || undefined,
    });
  } catch (err) { box.innerHTML = erroBox(err); return; }
  pintar();
}

function combina(v) {
  // Recorte por segmento: a visita entra se a escola dela pertence ao
  // segmento marcado. Sem segmento marcado, tudo passa.
  if (seg && seg.selecionados().length && !seg.combina(idxUnidades[v.unidade_id])) return false;
  if (!filtro.q) return true;
  return norm([v.unidade?.nome, v.unidade?.apelido, v.responsavel, v.pauta, v.constatacoes, v.encaminhamentos].join(' '))
    .includes(norm(filtro.q));
}

function pintar() {
  const vis = lista.filter(combina);
  document.getElementById('vi-count').textContent =
    `${vis.length}${vis.length !== lista.length ? ' de ' + lista.length : ''} relatório(s)`;

  const box = document.getElementById('vi-lista');
  if (!lista.length) {
    box.innerHTML = emptyState('📋', 'Nenhum relatório no período',
      perfil?.isAdmin ? 'Ajuste os filtros ou clique em “Novo relatório”.' : 'Ajuste o período ou os filtros.');
    return;
  }
  box.innerHTML = vis.map(item).join('') || emptyState('🔎', 'Nada encontrado', 'Ajuste a busca.');
  box.querySelectorAll('.vi-item').forEach(el => el.addEventListener('click', () => detalhe(el.dataset.id)));
}

function item(v) {
  const escola = v.unidade?.apelido || v.unidade?.nome || '—';
  const atrasado = v.status === 'aberto' && v.prazo && v.prazo < hojeISO();
  return `<div class="solic vi-item" data-id="${esc(v.id)}" tabindex="0">
    <div class="solic-main">
      <div class="di-top">
        <b>🏫 ${esc(escola)}</b>
        <span class="tag">${esc(TIPOS[v.tipo] || v.tipo)}</span>
        <span class="tag ${STATUS_TAG[v.status] || ''}">${esc(STATUS[v.status] || v.status)}</span>
        ${atrasado ? '<span class="tag st-negado">prazo vencido</span>' : ''}
      </div>
      <div class="di-meta">${esc(fmtData(v.data))}${v.responsavel ? ' · ' + esc(v.responsavel) : ''}</div>
      ${v.pauta ? `<div class="di-meta texto-resumo">${esc(v.pauta)}</div>` : ''}
    </div>
  </div>`;
}

function detalhe(id) {
  const v = lista.find(x => x.id === id);
  if (!v) return;
  const campo = (l, val) => val ? `<div class="field"><div class="lbl">${l}</div><div class="val texto-completo">${val}</div></div>` : '';
  const acoes = perfil?.isAdmin ? `
    <div class="drawer-acoes">
      <button class="mini-btn" id="vi-edit">✎ Editar</button>
      <button class="mini-btn no" id="vi-del">🗑 Excluir</button>
    </div>` : '';

  abrirDrawer(`
    ${drawerHead('🏫 ' + esc(v.unidade?.nome || '—'), esc(fmtData(v.data)) + ' · ' + esc(TIPOS[v.tipo] || v.tipo))}
    <div class="drawer-body">
      ${acoes}
      <div class="field"><div class="lbl">Situação</div>
        <div class="val"><span class="tag ${STATUS_TAG[v.status] || ''}">${esc(STATUS[v.status] || v.status)}</span></div></div>
      ${campo('Responsável', esc(v.responsavel))}
      ${campo('Pauta', esc(v.pauta))}
      ${campo('Constatações', esc(v.constatacoes))}
      ${campo('Encaminhamentos', esc(v.encaminhamentos))}
      ${v.prazo ? campo('Prazo', esc(fmtData(v.prazo))) : ''}
    </div>`);

  if (!perfil?.isAdmin) return;
  document.getElementById('vi-edit').addEventListener('click', () => abrirForm(v));
  document.getElementById('vi-del').addEventListener('click', () => remover(v));
}

function abrirForm(v) {
  const novo = !v;
  const optsUni = [...unidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map(u => `<option value="${esc(u.id || u.numero)}" ${v?.unidade_id === (u.id || u.numero) ? 'selected' : ''}>${esc(u.apelido || u.nome)}</option>`).join('');
  const optsTipo = Object.entries(TIPOS)
    .map(([k, t]) => `<option value="${k}" ${(v?.tipo || 'rotina') === k ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const optsStatus = Object.entries(STATUS)
    .map(([k, s]) => `<option value="${k}" ${(v?.status || 'aberto') === k ? 'selected' : ''}>${esc(s)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo relatório de visita' : 'Editar relatório')}
    <div class="drawer-body">
      <form id="vi-form" class="esc-form">
        <label>Escola <select id="f-uni" required><option value="">Selecione…</option>${optsUni}</select></label>
        <div class="esc-row">
          <label>Data <input id="f-data" type="date" value="${esc(v?.data || hojeISO())}" required /></label>
          <label>Tipo <select id="f-tipo">${optsTipo}</select></label>
        </div>
        <label>Responsável pela visita <input id="f-resp" value="${esc(v?.responsavel || '')}" /></label>
        <label>Pauta <textarea id="f-pauta" rows="2">${esc(v?.pauta || '')}</textarea></label>
        <label>Constatações <textarea id="f-const" rows="3">${esc(v?.constatacoes || '')}</textarea></label>
        <label>Encaminhamentos <textarea id="f-enc" rows="3">${esc(v?.encaminhamentos || '')}</textarea></label>
        <div class="esc-row">
          <label>Prazo dos encaminhamentos <input id="f-prazo" type="date" value="${esc(v?.prazo || '')}" /></label>
          <label>Situação <select id="f-status">${optsStatus}</select></label>
        </div>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-save">${novo ? 'Registrar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`);

  document.getElementById('vi-form').addEventListener('submit', (e) => salvar(e, v));
}

async function salvar(e, v) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const unidade_id = document.getElementById('f-uni').value;
  if (!unidade_id) return falha(msg, 'Selecione a escola.');

  const payload = {
    unidade_id,
    data: document.getElementById('f-data').value,
    tipo: document.getElementById('f-tipo').value,
    responsavel: val('f-resp') || null,
    pauta: val('f-pauta') || null,
    constatacoes: val('f-const') || null,
    encaminhamentos: val('f-enc') || null,
    prazo: document.getElementById('f-prazo').value || null,
    status: document.getElementById('f-status').value,
  };
  if (!payload.data) return falha(msg, 'Informe a data.');

  const btn = document.getElementById('f-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (v) await atualizarVisita(v.id, payload);
    else await criarVisita(payload);
    fecharDrawer(); carregar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = v ? 'Salvar' : 'Registrar';
  }
}

async function remover(v) {
  if (!confirm('Excluir este relatório de visita? Esta ação não pode ser desfeita.')) return;
  try { await excluirVisita(v.id); fecharDrawer(); carregar(); }
  catch (err) { alert('Não foi possível excluir: ' + (err.message || err)); }
}
