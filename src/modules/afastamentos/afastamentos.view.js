// ============================================================
// FundHub — modules/afastamentos/afastamentos.view.js
// Afastamentos de gestores/coordenadores/supervisores. Leitura para
// autorizados; CRUD para admin. Duas visões: Lista e Calendário (grade
// mensal com chips por dia, como o Apps Script afastamentos-gestores).
// ============================================================
import {
  TIPOS_AFASTAMENTO, CORES_AFASTAMENTO, diasAfastamento,
  getAfastamentos, criarAfastamento, atualizarAfastamento,
  cancelarAfastamento, reativarAfastamento, excluirAfastamento,
} from './afastamentos.model.js';
import { getServidores } from '../servidores/servidores.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { getDiasBloqueiamAfastamento } from '../calendario/calendario.model.js';
import { esc, norm, falha } from '../../shared/dom.js';
import { MESES, DOW, hojeISO, fmtData } from '../../shared/format.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';

let perfil = null, servidores = [], unidades = [], lista = [];
let modo = 'lista';                              // 'lista' | 'calendario'
let filtro = { visao: 'vigentes', tipo: '', q: '' };   // visao: vigentes | todos | cancelados
const agora = new Date();
let ano = agora.getFullYear(), mes = agora.getMonth() + 1;   // mes 1-12

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;

  app.innerHTML = `
    <div class="page-head">
      <h1>Afastamentos</h1>
      <p>Férias, licenças e afastamentos da equipe gestora e de acompanhamento.</p>
    </div>
    <div class="toolbar">
      <div class="tabbar" id="af-modo" role="tablist">
        <button class="tab" data-modo="lista" role="tab">Lista</button>
        <button class="tab" data-modo="calendario" role="tab">Calendário</button>
      </div>
      <label class="search">🔎
        <input id="af-q" type="search" placeholder="Buscar por servidor ou escola…" autocomplete="off" value="${esc(filtro.q)}" />
      </label>
      <span class="count" id="af-count"></span>
      <button id="af-novo" class="btn-primary" hidden>+ Novo afastamento</button>
    </div>
    <div class="filters" id="af-filtros"></div>
    <div id="af-body">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();

  [servidores, unidades] = await Promise.all([
    getServidores().catch(() => []),
    getUnidades().catch(() => []),
  ]);

  document.getElementById('af-modo').addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    modo = b.dataset.modo; carregar();
  });
  document.getElementById('af-q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  // Um único listener delegado nos filtros (o innerHTML muda a cada carregar).
  document.getElementById('af-filtros').addEventListener('click', onFiltroClick);

  if (perfil?.isAdmin) {
    const nv = document.getElementById('af-novo');
    nv.hidden = false;
    nv.addEventListener('click', () => abrirForm(null));
  }

  carregar();
}

// Monta a barra de filtros conforme a visão atual (lista vs calendário).
// Só desenha o HTML — o clique é tratado por onFiltroClick (delegado uma vez).
function montarFiltros() {
  const box = document.getElementById('af-filtros');
  if (modo === 'calendario') {
    box.innerHTML = `
      <div class="cal-nav">
        <button class="mini-btn" data-nav="prev" aria-label="Mês anterior">←</button>
        <div class="cal-titulo" id="af-titulo">${MESES[mes - 1]} de ${ano}</div>
        <button class="mini-btn" data-nav="next" aria-label="Próximo mês">→</button>
      </div>
      ${chipsTipo()}`;
  } else {
    box.innerHTML = `
      <button class="chip" data-visao="vigentes">Vigentes</button>
      <button class="chip" data-visao="todos">Todos</button>
      <button class="chip" data-visao="cancelados">Cancelados</button>
      <span class="filtro-sep"></span>
      ${chipsTipo()}`;
  }
  box.querySelectorAll('.chip').forEach(b => {
    const on = (b.dataset.visao && b.dataset.visao === filtro.visao)
      || (b.dataset.tipo != null && b.dataset.tipo === filtro.tipo);
    b.classList.toggle('on', on);
  });
}

function onFiltroClick(e) {
  const nav = e.target.closest('[data-nav]');
  if (nav) { moverMes(nav.dataset.nav === 'prev' ? -1 : 1); return; }
  const b = e.target.closest('.chip'); if (!b) return;
  if (b.dataset.visao) { filtro.visao = b.dataset.visao; carregar(); return; }
  if (b.dataset.tipo != null) {
    filtro.tipo = filtro.tipo === b.dataset.tipo ? '' : b.dataset.tipo;
    montarFiltros(); pintar();
  }
}

const chipsTipo = () => TIPOS_AFASTAMENTO
  .map(t => `<button class="chip" data-tipo="${esc(t)}">${esc(t)}</button>`).join('');

function moverMes(delta) {
  mes += delta;
  if (mes < 1) { mes = 12; ano--; } else if (mes > 12) { mes = 1; ano++; }
  const t = document.getElementById('af-titulo');
  if (t) t.textContent = `${MESES[mes - 1]} de ${ano}`;
  pintar();
}

// Modo Lista respeita a visão (vigentes/todos/cancelados); o Calendário
// sempre mostra os afastamentos ATIVOS que tocam o mês visível.
async function carregar() {
  document.querySelectorAll('#af-modo .tab').forEach(b =>
    b.classList.toggle('on', b.dataset.modo === modo));
  montarFiltros();

  const box = document.getElementById('af-body');
  box.innerHTML = loading();
  try {
    const opts = modo === 'calendario' ? {}
      : filtro.visao === 'vigentes' ? { vigentesEm: hojeISO() }
      : filtro.visao === 'cancelados' ? { status: 'cancelado' }
      : {};
    lista = await getAfastamentos(opts);
  } catch (err) { box.innerHTML = erroBox(err); return; }
  pintar();
}

function combinaBusca(a) {
  if (filtro.tipo && a.tipo !== filtro.tipo) return false;
  if (!filtro.q) return true;
  return norm([a.servidor?.nome, a.servidor?.apelido, a.unidade?.nome, a.unidade?.apelido, a.processo]
    .join(' ')).includes(norm(filtro.q));
}

function pintar() {
  const filtrada = lista.filter(combinaBusca);
  const cnt = document.getElementById('af-count');
  if (modo === 'calendario') {
    cnt.textContent = `${filtrada.length} ativo(s)`;
    pintarCalendario(filtrada);
  } else {
    cnt.textContent = `${filtrada.length} afastamento(s)`;
    pintarLista(filtrada);
  }
}

// ── Visão Lista ──────────────────────────────────────────────
function pintarLista(filtrada) {
  const box = document.getElementById('af-body');
  if (!filtrada.length) {
    box.innerHTML = emptyState('🌴', 'Nenhum afastamento', 'Nada a exibir para o filtro atual.');
    return;
  }
  box.innerHTML = filtrada.map(item).join('');
  ligarAcoes(box);
}

function item(a) {
  const cor = CORES_AFASTAMENTO[a.tipo] || 'var(--brand)';
  const nome = a.servidor?.nome || '—';
  const dias = diasAfastamento(a);
  const periodo = a.fim ? `${fmtData(a.inicio)} a ${fmtData(a.fim)}` : `desde ${fmtData(a.inicio)} (em aberto)`;
  const unidade = a.unidade?.apelido || a.unidade?.nome;
  const cancelado = a.status === 'cancelado';
  const meta = [
    periodo,
    dias ? `${dias} dia${dias > 1 ? 's' : ''}` : '',
    unidade, a.processo ? `proc. ${a.processo}` : '', a.motivo,
  ].filter(Boolean).map(esc).join(' · ');
  const acoes = perfil?.isAdmin ? `
    <div class="solic-acoes">
      ${cancelado ? `
        <button class="mini-btn ok" data-reativar="${a.id}" aria-label="Reativar">↺</button>
        <button class="mini-btn no" data-excluir="${a.id}" aria-label="Excluir definitivamente">🗑</button>`
      : `
        <button class="mini-btn" data-edit="${a.id}" aria-label="Editar">✎</button>
        <button class="mini-btn no" data-cancelar="${a.id}" aria-label="Cancelar">✕</button>`}
    </div>` : '';
  return `<div class="solic ${cancelado ? 'inativo' : ''}" style="border-left:3px solid ${esc(cor)}">
    <div class="solic-main">
      <div class="di-top"><b>${esc(nome)}</b>
        <span class="tag" style="color:${esc(cor)}">${esc(a.tipo)}</span>
        ${cancelado ? '<span class="tag eja">Cancelado</span>' : ''}</div>
      <div class="di-meta">${meta}</div>
    </div>${acoes}</div>`;
}

// ── Visão Calendário (grade mensal com chips) ────────────────
function pintarCalendario(ativos) {
  const box = document.getElementById('af-body');
  const primeiro = new Date(ano, mes - 1, 1).getDay();
  const totalDias = new Date(ano, mes, 0).getDate();
  const hoje = hojeISO();

  let cells = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < primeiro; i++) cells += `<div class="cal-cell vazio"></div>`;

  for (let dia = 1; dia <= totalDias; dia++) {
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const doDia = ativos.filter(a => a.inicio <= iso && (!a.fim || a.fim >= iso));
    const chips = doDia.slice(0, 4).map(a => {
      const cor = CORES_AFASTAMENTO[a.tipo] || 'var(--brand)';
      const nome = a.servidor?.apelido || a.servidor?.nome || '—';
      return `<span class="af-chip${perfil?.isAdmin ? ' clicavel' : ''}" style="background:${esc(cor)}" data-id="${a.id}"
        title="${esc(a.tipo)} — ${esc(a.servidor?.nome || '')}">${esc(nome)}</span>`;
    }).join('');
    const mais = doDia.length > 4 ? `<span class="af-mais">+${doDia.length - 4}</span>` : '';
    cells += `<div class="cal-cell ${iso === hoje ? 'hoje' : ''}">
      <div class="cal-num">${dia}</div>
      <div class="af-chips">${chips}${mais}</div>
    </div>`;
  }

  box.innerHTML = `<div class="cal-grid af-cal">${cells}</div>`;
  // Só admin edita: para os demais o chip é apenas informativo.
  if (!perfil?.isAdmin) return;
  box.querySelectorAll('.af-chip[data-id]').forEach(c =>
    c.addEventListener('click', () => {
      const a = lista.find(x => x.id === c.dataset.id);
      if (a) abrirForm(a);
    }));
}

function ligarAcoes(box) {
  box.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => abrirForm(lista.find(a => a.id === b.dataset.edit))));
  box.querySelectorAll('[data-cancelar]').forEach(b =>
    b.addEventListener('click', () => cancelar(lista.find(a => a.id === b.dataset.cancelar))));
  box.querySelectorAll('[data-reativar]').forEach(b =>
    b.addEventListener('click', () => reativar(lista.find(a => a.id === b.dataset.reativar))));
  box.querySelectorAll('[data-excluir]').forEach(b =>
    b.addEventListener('click', () => excluir(lista.find(a => a.id === b.dataset.excluir))));
}

// ── Formulário ───────────────────────────────────────────────
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
        <p class="form-hint" id="f-dias"></p>
        <label>Unidade (opcional) <select id="f-uni"><option value="">—</option>${optsUni}</select></label>
        <label>Processo (opcional) <input id="f-proc" value="${esc(a?.processo || '')}" placeholder="Nº do processo" /></label>
        <label>Motivo / observação <input id="f-motivo" value="${esc(a?.motivo || '')}" /></label>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-save">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`);

  const upDias = () => {
    const ini = document.getElementById('f-ini').value;
    const fim = document.getElementById('f-fim').value;
    const d = diasAfastamento({ inicio: ini, fim });
    document.getElementById('f-dias').textContent = d ? `${d} dia${d > 1 ? 's' : ''}` : (ini ? 'Em aberto' : '');
  };
  document.getElementById('f-ini').addEventListener('input', upDias);
  document.getElementById('f-fim').addEventListener('input', upDias);
  upDias();
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
    processo: document.getElementById('f-proc').value.trim() || null,
    motivo: document.getElementById('f-motivo').value.trim() || null,
  };
  if (!payload.servidor_id || !payload.inicio) return falha(msg, 'Informe servidor e data de início.');
  if (payload.fim && payload.fim < payload.inicio) return falha(msg, 'A data fim não pode ser antes do início.');

  // Integração com o Calendário: avisa (não bloqueia) se o período cai em
  // dia marcado "não conceder afastamentos".
  try {
    const bloq = await getDiasBloqueiamAfastamento(payload.inicio, payload.fim || payload.inicio);
    if (bloq.length) {
      const quais = bloq.slice(0, 3).map(d => fmtData(d.data) + (d.evento ? ` (${d.evento})` : '')).join(', ');
      if (!confirm(`O calendário marca ${bloq.length} dia(s) como "não conceder afastamentos": ${quais}${bloq.length > 3 ? '…' : ''}.\n\nRegistrar mesmo assim?`)) return;
    }
  } catch (_) { /* sem calendário, segue */ }

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

async function cancelar(a) {
  if (!a || !confirm(`Cancelar este afastamento de "${a.servidor?.nome || 'servidor'}"?\nEle sai das visões ativas, mas o histórico é preservado.`)) return;
  try { await cancelarAfastamento(a.id); carregar(); }
  catch (err) { alert('Não foi possível cancelar: ' + (err.message || err)); }
}

async function reativar(a) {
  if (!a) return;
  try { await reativarAfastamento(a); carregar(); }
  catch (err) { alert('Não foi possível reativar: ' + (err.message || err)); }
}

async function excluir(a) {
  if (!a || !confirm(`Excluir DEFINITIVAMENTE este afastamento?\nEsta ação não pode ser desfeita (o cancelamento preserva o histórico).`)) return;
  try { await excluirAfastamento(a.id); carregar(); }
  catch (err) { alert('Não foi possível excluir: ' + (err.message || err)); }
}
