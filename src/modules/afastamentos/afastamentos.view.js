// ============================================================
// FundHub — modules/afastamentos/afastamentos.view.js
// Afastamentos de gestores/coordenadores/supervisores. Leitura para
// autorizados; CRUD para admin.
// ============================================================
import {
  TIPOS_AFASTAMENTO, CORES_AFASTAMENTO,
  getAfastamentos, criarAfastamento, atualizarAfastamento, excluirAfastamento,
} from './afastamentos.model.js';
import { getServidores } from '../servidores/servidores.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { esc, falha } from '../../shared/dom.js';
import { hojeISO, fmtData } from '../../shared/format.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';

let perfil = null, servidores = [], unidades = [], lista = [];
let filtro = { vigentes: true, tipo: '' };

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;

  app.innerHTML = `
    <div class="page-head">
      <h1>Afastamentos</h1>
      <p>Férias, licenças e afastamentos da equipe gestora e de acompanhamento.</p>
    </div>
    <div class="toolbar">
      <div class="filters" id="af-filtros"></div>
      <span class="count" id="af-count"></span>
      <button id="af-novo" class="btn-primary" hidden>+ Novo afastamento</button>
    </div>
    <div id="af-lista">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();

  [servidores, unidades] = await Promise.all([
    getServidores().catch(() => []),
    getUnidades().catch(() => []),
  ]);

  const filtros = document.getElementById('af-filtros');
  filtros.innerHTML = [
    `<button class="chip" data-f="vigentes">Vigentes</button>`,
    `<button class="chip" data-f="todos">Todos</button>`,
    ...TIPOS_AFASTAMENTO.map(t => `<button class="chip" data-tipo="${esc(t)}">${esc(t)}</button>`),
  ].join('');
  filtros.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.f === 'vigentes') filtro.vigentes = true;
    if (b.dataset.f === 'todos') filtro.vigentes = false;
    if (b.dataset.tipo != null) filtro.tipo = filtro.tipo === b.dataset.tipo ? '' : b.dataset.tipo;
    carregar();
  });

  if (perfil?.isAdmin) {
    const nv = document.getElementById('af-novo');
    nv.hidden = false;
    nv.addEventListener('click', () => abrirForm(null));
  }

  carregar();
}

async function carregar() {
  document.querySelectorAll('#af-filtros .chip').forEach(b => {
    const on = (b.dataset.f === 'vigentes' && filtro.vigentes)
      || (b.dataset.f === 'todos' && !filtro.vigentes)
      || (b.dataset.tipo != null && b.dataset.tipo === filtro.tipo);
    b.classList.toggle('on', on);
  });

  const box = document.getElementById('af-lista');
  try { lista = await getAfastamentos(filtro.vigentes ? { vigentesEm: hojeISO() } : {}); }
  catch (err) { box.innerHTML = erroBox(err); return; }

  const filtrada = filtro.tipo ? lista.filter(a => a.tipo === filtro.tipo) : lista;
  document.getElementById('af-count').textContent = `${filtrada.length} afastamento(s)`;

  if (!filtrada.length) {
    box.innerHTML = emptyState('🌴', 'Nenhum afastamento', 'Nada a exibir para o filtro atual.');
    return;
  }
  box.innerHTML = filtrada.map(item).join('');
  box.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => abrirForm(lista.find(a => a.id === b.dataset.edit))));
  box.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => remover(lista.find(a => a.id === b.dataset.del))));
}

function item(a) {
  const cor = CORES_AFASTAMENTO[a.tipo] || 'var(--brand)';
  const nome = a.servidor?.nome || '—';
  const periodo = a.fim ? `${fmtData(a.inicio)} a ${fmtData(a.fim)}` : `desde ${fmtData(a.inicio)}`;
  const unidade = a.unidade?.apelido || a.unidade?.nome;
  const acoes = perfil?.isAdmin ? `
    <div class="solic-acoes">
      <button class="mini-btn" data-edit="${a.id}" aria-label="Editar">✎</button>
      <button class="mini-btn no" data-del="${a.id}" aria-label="Excluir">🗑</button>
    </div>` : '';
  return `<div class="solic" style="border-left:3px solid ${esc(cor)}">
    <div class="solic-main">
      <div class="di-top"><b>${esc(nome)}</b><span class="tag" style="color:${esc(cor)}">${esc(a.tipo)}</span></div>
      <div class="di-meta">${esc(periodo)}${unidade ? ' · ' + esc(unidade) : ''}${a.motivo ? ' · ' + esc(a.motivo) : ''}</div>
    </div>${acoes}</div>`;
}

function abrirForm(a) {
  const novo = !a;
  const optsServ = servidores.map(s =>
    `<option value="${s.id}" ${a?.servidor_id === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('');
  const optsUni = unidades.map(u =>
    `<option value="${u.id}" ${a?.unidade_id === u.id ? 'selected' : ''}>${esc(u.apelido || u.nome)}</option>`).join('');
  const optsTipo = TIPOS_AFASTAMENTO.map(t =>
    `<option ${a?.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo afastamento' : 'Editar afastamento')}
    <div class="drawer-body">
      <form id="af-form" class="esc-form">
        <label>Servidor <select id="f-serv" required><option value="">Selecione…</option>${optsServ}</select></label>
        <label>Tipo <select id="f-tipo" required>${optsTipo}</select></label>
        <div class="esc-row">
          <label>Início <input id="f-ini" type="date" value="${esc(a?.inicio || '')}" required /></label>
          <label>Fim (em aberto se vazio) <input id="f-fim" type="date" value="${esc(a?.fim || '')}" /></label>
        </div>
        <label>Unidade (opcional) <select id="f-uni"><option value="">—</option>${optsUni}</select></label>
        <label>Motivo / observação <input id="f-motivo" value="${esc(a?.motivo || '')}" /></label>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-save">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`);

  document.getElementById('af-form').addEventListener('submit', (e) => salvar(e, a));
}

async function salvar(e, a) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const payload = {
    servidor_id: document.getElementById('f-serv').value || null,
    tipo: document.getElementById('f-tipo').value,
    inicio: document.getElementById('f-ini').value,
    fim: document.getElementById('f-fim').value || null,
    unidade_id: document.getElementById('f-uni').value || null,
    motivo: document.getElementById('f-motivo').value.trim() || null,
  };
  if (!payload.servidor_id || !payload.inicio) return falha(msg, 'Informe servidor e data de início.');
  if (payload.fim && payload.fim < payload.inicio) return falha(msg, 'A data fim não pode ser antes do início.');

  const btn = document.getElementById('f-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (a) await atualizarAfastamento(a.id, payload);
    else await criarAfastamento(payload);
    fecharDrawer(); carregar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = a ? 'Salvar' : 'Criar';
  }
}

async function remover(a) {
  if (!a || !confirm(`Excluir este afastamento de "${a.servidor?.nome || 'servidor'}"?`)) return;
  try { await excluirAfastamento(a.id); carregar(); }
  catch (err) { alert('Não foi possível excluir: ' + (err.message || err)); }
}
