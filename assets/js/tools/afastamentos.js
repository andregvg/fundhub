// ============================================================
// FundHub — tools/afastamentos.js
// Afastamentos de gestores/coordenadores/supervisores. Leitura para
// autorizados; CRUD para admin. Integra servidor × unidade × período.
// ============================================================
import {
  TIPOS_AFASTAMENTO, getAfastamentos, criarAfastamento, atualizarAfastamento, excluirAfastamento,
} from '../data/afastamentos.js';
import { getServidores } from '../data/servidores.js';
import { getUnidades } from '../data/escolas.js';
import { getPerfilAtual } from '../data/perfil.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hojeISO = () => new Date().toLocaleDateString('sv-SE');
const fmt = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const CORES = {
  'Férias': '#0ea5a4', 'Licença Saúde (LTS)': '#dc2626', 'Licença Maternidade': '#db2777',
  'Licença Prêmio': '#f59e0b', 'Atestado': '#ea580c', 'Afastamento SME': '#2563eb', 'Outro': '#64708a',
};

let perfil = null, servidores = [], unidades = [], lista = [];
let filtro = { vigentes: true, tipo: '' };

export async function renderAfastamentos(app) {
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
    <div id="af-lista"><div class="loading">Carregando…</div></div>
    <div class="drawer-back" id="drawer-back"></div>
    <aside class="drawer" id="drawer"></aside>`;

  [perfil, servidores, unidades] = await Promise.all([
    getPerfilAtual().catch(() => null), getServidores().catch(() => []), getUnidades().catch(() => []),
  ]);

  document.getElementById('af-filtros').innerHTML = [
    `<button class="chip" data-f="vigentes">Vigentes</button>`,
    `<button class="chip" data-f="todos">Todos</button>`,
    ...TIPOS_AFASTAMENTO.map(t => `<button class="chip" data-tipo="${esc(t)}">${esc(t)}</button>`),
  ].join('');
  document.getElementById('af-filtros').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.f === 'vigentes') filtro.vigentes = true;
    if (b.dataset.f === 'todos') filtro.vigentes = false;
    if (b.dataset.tipo != null) filtro.tipo = filtro.tipo === b.dataset.tipo ? '' : b.dataset.tipo;
    load();
  });
  document.getElementById('drawer-back').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  if (perfil?.isAdmin) {
    const nv = document.getElementById('af-novo');
    nv.hidden = false;
    nv.addEventListener('click', () => openForm(null));
  }
  load();
}

async function load() {
  document.querySelectorAll('#af-filtros .chip').forEach(b => {
    const on = (b.dataset.f === 'vigentes' && filtro.vigentes) || (b.dataset.f === 'todos' && !filtro.vigentes)
      || (b.dataset.tipo != null && b.dataset.tipo === filtro.tipo);
    b.classList.toggle('on', on);
  });
  const box = document.getElementById('af-lista');
  try { lista = await getAfastamentos(filtro.vigentes ? { vigentesEm: hojeISO() } : {}); }
  catch (err) { box.innerHTML = `<p class="count">Erro: ${esc(err.message || err)}</p>`; return; }
  const filtrada = filtro.tipo ? lista.filter(a => a.tipo === filtro.tipo) : lista;
  document.getElementById('af-count').textContent = `${filtrada.length} afastamento(s)`;
  if (!filtrada.length) { box.innerHTML = `<div class="empty"><div class="empty-ico">🌴</div><h3>Nenhum afastamento</h3><p>Nada a exibir para o filtro atual.</p></div>`; return; }
  box.innerHTML = filtrada.map(item).join('');
  box.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(lista.find(a => a.id === b.dataset.edit))));
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => remover(lista.find(a => a.id === b.dataset.del))));
}

function item(a) {
  const cor = CORES[a.tipo] || 'var(--brand)';
  const nome = a.servidor?.nome || '—';
  const periodo = a.fim ? `${fmt(a.inicio)} a ${fmt(a.fim)}` : `desde ${fmt(a.inicio)}`;
  const unidade = a.unidade?.apelido || a.unidade?.nome;
  const acoes = perfil?.isAdmin
    ? `<div class="solic-acoes"><button class="mini-btn" data-edit="${a.id}">✎</button>
         <button class="mini-btn no" data-del="${a.id}">🗑</button></div>` : '';
  return `<div class="solic" style="border-left:3px solid ${esc(cor)}">
    <div class="solic-main">
      <div class="di-top"><b>${esc(nome)}</b><span class="tag" style="color:${esc(cor)}">${esc(a.tipo)}</span></div>
      <div class="di-meta">${esc(periodo)}${unidade ? ' · ' + esc(unidade) : ''}${a.motivo ? ' · ' + esc(a.motivo) : ''}</div>
    </div>${acoes}</div>`;
}

function openForm(a) {
  const novo = !a;
  const optsServ = servidores.map(s => `<option value="${s.id}" ${a?.servidor_id === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('');
  const optsUni = unidades.map(u => `<option value="${u.id}" ${a?.unidade_id === u.id ? 'selected' : ''}>${esc(u.apelido || u.nome)}</option>`).join('');
  const optsTipo = TIPOS_AFASTAMENTO.map(t => `<option ${a?.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('');
  document.getElementById('drawer').innerHTML = `
    <div class="drawer-head"><div><h2>${novo ? 'Novo afastamento' : 'Editar afastamento'}</h2></div>
      <button class="drawer-close" id="dc">×</button></div>
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
        <div class="form-foot"><span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-save">${novo ? 'Criar' : 'Salvar'}</button></div>
      </form>
    </div>`;
  document.getElementById('dc').addEventListener('click', closeDrawer);
  document.getElementById('af-form').addEventListener('submit', (e) => salvar(e, a));
  openDrawerEl();
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
  if (!payload.servidor_id || !payload.inicio) { msg.classList.add('err'); msg.textContent = 'Informe servidor e data de início.'; return; }
  if (payload.fim && payload.fim < payload.inicio) { msg.classList.add('err'); msg.textContent = 'A data fim não pode ser antes do início.'; return; }
  const btn = document.getElementById('f-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (a) await atualizarAfastamento(a.id, payload); else await criarAfastamento(payload);
    closeDrawer(); load();
  } catch (err) { msg.classList.add('err'); msg.textContent = 'Erro: ' + (err.message || err); btn.disabled = false; btn.textContent = a ? 'Salvar' : 'Criar'; }
}

async function remover(a) {
  if (!a || !confirm(`Excluir este afastamento de "${a.servidor?.nome || 'servidor'}"?`)) return;
  try { await excluirAfastamento(a.id); load(); }
  catch (err) { alert('Não foi possível excluir: ' + (err.message || err)); }
}

function openDrawerEl() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-back').classList.add('open');
}
function closeDrawer() {
  document.getElementById('drawer')?.classList.remove('open');
  document.getElementById('drawer-back')?.classList.remove('open');
}
