// ============================================================
// FundHub — modules/ocorrencias/ocorrencias.view.js
// Registro dos atendimentos telefônicos. Leitura para autorizados;
// CRUD para admin. Filtros por período, escola e status; busca livre.
// ============================================================
import {
  CANAIS, STATUS, STATUS_TAG,
  getOcorrencias, criarOcorrencia, atualizarOcorrencia, excluirOcorrencia,
} from './ocorrencias.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { esc, norm, val, falha } from '../../shared/dom.js';
import { hojeISO, fmtData, addDias } from '../../shared/format.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';
import { criarFiltroSegmento, indexarUnidades } from '../../shared/ui/filtro-segmento.js';

let perfil = null, unidades = [], lista = [], idxUnidades = {};
let seg = null;
let filtro = { de: addDias(hojeISO(), -30), ate: hojeISO(), unidadeId: '', status: '', q: '' };

// Escolas do segmento selecionado — alimenta o seletor e o recorte da lista.
const unidadesDoSegmento = () =>
  [...unidades].filter(u => !seg || seg.combina(u)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

function pintarSeletorEscolas() {
  const sel = document.getElementById('oc-uni');
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
      <h1>Ocorrências</h1>
      <p>Registro dos atendimentos telefônicos da recepção, ligados às escolas.</p>
    </div>
    <div class="toolbar">
      <label class="search">🔎
        <input id="oc-q" type="search" placeholder="Buscar por assunto, solicitante, relato ou escola…" autocomplete="off" />
      </label>
      <button id="oc-novo" class="btn-primary" hidden>+ Nova ocorrência</button>
    </div>
    <div id="oc-seg" class="toolbar-linha"></div>
    <div class="toolbar subfiltros">
      <label class="search compacta">De <input id="oc-de" type="date" value="${filtro.de}" /></label>
      <label class="search compacta">Até <input id="oc-ate" type="date" value="${filtro.ate}" /></label>
      <label class="search compacta">🏫 <select id="oc-uni"><option value="">Todas as escolas</option></select></label>
      <div class="filters" id="oc-status">
        <button class="chip" data-st="">Todas</button>
        ${Object.entries(STATUS).map(([k, v]) => `<button class="chip" data-st="${k}">${esc(v)}</button>`).join('')}
      </div>
      <span class="count" id="oc-count"></span>
    </div>
    <div id="oc-lista">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();

  try { unidades = await getUnidades(); }
  catch (err) { document.getElementById('oc-lista').innerHTML = erroBox(err); return; }

  idxUnidades = indexarUnidades(unidades);
  seg = criarFiltroSegmento(document.getElementById('oc-seg'), {
    perfil, chaveMemoria: 'fundhub:seg:ocorrencias',
    onChange: () => { pintarSeletorEscolas(); carregar(); },
  });
  pintarSeletorEscolas();

  document.getElementById('oc-q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  document.getElementById('oc-de').addEventListener('change', e => { filtro.de = e.target.value; carregar(); });
  document.getElementById('oc-ate').addEventListener('change', e => { filtro.ate = e.target.value; carregar(); });
  document.getElementById('oc-uni').addEventListener('change', e => { filtro.unidadeId = e.target.value; carregar(); });
  document.getElementById('oc-status').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    filtro.status = b.dataset.st;
    carregar();
  });

  if (perfil?.isAdmin) {
    const novo = document.getElementById('oc-novo');
    novo.hidden = false;
    novo.addEventListener('click', () => abrirForm(null));
  }

  carregar();
}

async function carregar() {
  document.querySelectorAll('#oc-status .chip').forEach(b =>
    b.classList.toggle('on', b.dataset.st === filtro.status));

  const box = document.getElementById('oc-lista');
  box.innerHTML = loading();
  try {
    lista = await getOcorrencias({
      de: filtro.de || undefined, ate: filtro.ate || undefined,
      unidadeId: filtro.unidadeId || undefined, status: filtro.status || undefined,
    });
  } catch (err) { box.innerHTML = erroBox(err); return; }
  pintar();
}

function combina(o) {
  // Recorte por segmento. Ocorrência sem escola vinculada continua
  // aparecendo: o registro existe e sumir dele seria pior do que
  // mostrá-lo fora do recorte.
  if (seg && seg.selecionados().length && o.unidade_id
      && !seg.combina(idxUnidades[o.unidade_id])) return false;
  if (!filtro.q) return true;
  const alvo = norm([
    o.assunto, o.relato, o.solicitante, o.solicitante_contato,
    o.encaminhado_para, o.unidade?.nome, o.unidade?.apelido,
  ].join(' '));
  return alvo.includes(norm(filtro.q));
}

function pintar() {
  const vis = lista.filter(combina);
  document.getElementById('oc-count').textContent =
    `${vis.length}${vis.length !== lista.length ? ' de ' + lista.length : ''} ocorrência(s)`;

  const box = document.getElementById('oc-lista');
  if (!lista.length) {
    box.innerHTML = emptyState('📞', 'Nenhuma ocorrência no período',
      perfil?.isAdmin ? 'Ajuste o período/filtros ou clique em “Nova ocorrência”.' : 'Ajuste o período ou os filtros.');
    return;
  }
  box.innerHTML = vis.map(item).join('')
    || emptyState('🔎', 'Nenhuma ocorrência encontrada', 'Ajuste a busca.');
  box.querySelectorAll('.solic').forEach(el =>
    el.addEventListener('click', () => detalhe(el.dataset.id)));
}

function item(o) {
  const escola = o.unidade?.apelido || o.unidade?.nome;
  const quando = `${fmtData(o.data)}${o.hora ? ' · ' + o.hora.slice(0, 5) : ''}`;
  return `<div class="solic oc-item" data-id="${esc(o.id)}" tabindex="0">
    <div class="solic-main">
      <div class="di-top">
        <b>${esc(o.assunto)}</b>
        <span class="tag ${STATUS_TAG[o.status] || ''}">${esc(STATUS[o.status] || o.status)}</span>
      </div>
      <div class="di-meta">${esc(quando)}${escola ? ' · 🏫 ' + esc(escola) : ''}${o.solicitante ? ' · ' + esc(o.solicitante) : ''} · ${esc(CANAIS[o.canal] || o.canal)}</div>
      ${o.relato ? `<div class="di-meta texto-resumo">${esc(o.relato)}</div>` : ''}
    </div>
  </div>`;
}

// ── Detalhe ──────────────────────────────────────────────────
function detalhe(id) {
  const o = lista.find(x => x.id === id);
  if (!o) return;

  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';
  const escola = o.unidade?.nome ? esc(o.unidade.nome) : '';
  const contato = o.solicitante_contato
    ? `<a href="tel:${esc(String(o.solicitante_contato).replace(/\D/g, ''))}">${esc(o.solicitante_contato)}</a>`
    : '';
  const acoes = perfil?.isAdmin ? `
    <div class="drawer-acoes">
      <button class="mini-btn" id="oc-edit">✎ Editar</button>
      <button class="mini-btn no" id="oc-del">🗑 Excluir</button>
    </div>` : '';

  abrirDrawer(`
    ${drawerHead(esc(o.assunto), `${esc(fmtData(o.data))}${o.hora ? ' · ' + esc(o.hora.slice(0, 5)) : ''}`)}
    <div class="drawer-body">
      ${acoes}
      <div class="field"><div class="lbl">Situação</div>
        <div class="val"><span class="tag ${STATUS_TAG[o.status] || ''}">${esc(STATUS[o.status] || o.status)}</span></div></div>
      ${campo('Canal', esc(CANAIS[o.canal] || o.canal))}
      ${campo('Escola', escola)}
      ${campo('Solicitante', esc(o.solicitante))}
      ${campo('Contato de retorno', contato)}
      ${campo('Encaminhado para', esc(o.encaminhado_para))}
      ${o.relato ? `<hr class="sep" /><div class="field"><div class="lbl">Relato</div><div class="val texto-completo">${esc(o.relato)}</div></div>` : ''}
      ${campo('Registrado por', esc(o.criado_por))}
    </div>`);

  if (!perfil?.isAdmin) return;
  document.getElementById('oc-edit').addEventListener('click', () => abrirForm(o));
  document.getElementById('oc-del').addEventListener('click', () => remover(o));
}

// ── Formulário ───────────────────────────────────────────────
function abrirForm(o) {
  const novo = !o;
  const optsUni = [...unidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map(u => `<option value="${esc(u.id || u.numero)}" ${o?.unidade_id === (u.id || u.numero) ? 'selected' : ''}>${esc(u.apelido || u.nome)}</option>`).join('');
  const optsCanal = Object.entries(CANAIS)
    .map(([k, v]) => `<option value="${k}" ${(o?.canal || 'telefone') === k ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const optsStatus = Object.entries(STATUS)
    .map(([k, v]) => `<option value="${k}" ${(o?.status || 'aberta') === k ? 'selected' : ''}>${esc(v)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead(novo ? 'Nova ocorrência' : 'Editar ocorrência')}
    <div class="drawer-body">
      <form id="oc-form" class="esc-form">
        <div class="esc-row">
          <label>Data <input id="f-data" type="date" value="${esc(o?.data || hojeISO())}" required /></label>
          <label>Hora <input id="f-hora" type="time" value="${esc(o?.hora ? o.hora.slice(0, 5) : '')}" /></label>
        </div>
        <label>Canal <select id="f-canal">${optsCanal}</select></label>
        <label>Escola (opcional) <select id="f-uni"><option value="">— nenhuma —</option>${optsUni}</select></label>
        <label>Solicitante (quem procurou) <input id="f-solic" value="${esc(o?.solicitante || '')}" /></label>
        <label>Contato de retorno <input id="f-contato" type="tel" value="${esc(o?.solicitante_contato || '')}" /></label>
        <label>Assunto <input id="f-assunto" required value="${esc(o?.assunto || '')}" /></label>
        <label>Relato <textarea id="f-relato" rows="4">${esc(o?.relato || '')}</textarea></label>
        <label>Situação <select id="f-status">${optsStatus}</select></label>
        <label class="oc-enc" ${(o?.status || 'aberta') === 'encaminhada' ? '' : 'hidden'}>Encaminhado para
          <input id="f-enc" value="${esc(o?.encaminhado_para || '')}" placeholder="Setor ou pessoa" /></label>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-save">${novo ? 'Registrar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`);

  // Campo "encaminhado para" só faz sentido quando o status é "encaminhada".
  const stSel = document.getElementById('f-status');
  const encWrap = document.querySelector('.oc-enc');
  stSel.addEventListener('change', () => { encWrap.hidden = stSel.value !== 'encaminhada'; });

  document.getElementById('oc-form').addEventListener('submit', (e) => salvar(e, o));
}

async function salvar(e, o) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const status = document.getElementById('f-status').value;
  const payload = {
    data: document.getElementById('f-data').value,
    hora: document.getElementById('f-hora').value || null,
    canal: document.getElementById('f-canal').value,
    unidade_id: document.getElementById('f-uni').value || null,
    solicitante: val('f-solic') || null,
    solicitante_contato: val('f-contato') || null,
    assunto: val('f-assunto'),
    relato: val('f-relato') || null,
    status,
    encaminhado_para: status === 'encaminhada' ? (val('f-enc') || null) : null,
  };
  if (!payload.assunto) return falha(msg, 'Informe o assunto.');
  if (!payload.data) return falha(msg, 'Informe a data.');

  const btn = document.getElementById('f-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (o) await atualizarOcorrencia(o.id, payload);
    else await criarOcorrencia(payload);
    fecharDrawer(); carregar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = o ? 'Salvar' : 'Registrar';
  }
}

async function remover(o) {
  if (!confirm(`Excluir a ocorrência "${o.assunto}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await excluirOcorrencia(o.id);
    fecharDrawer(); carregar();
  } catch (err) {
    alert('Não foi possível excluir: ' + (err.message || err));
  }
}
