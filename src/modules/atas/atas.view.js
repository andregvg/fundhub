// ============================================================
// FundHub — modules/atas/atas.view.js
// Atas de atendimento: lista + redação (admin) + IMPRESSÃO em papel
// timbrado. A impressão é o entregável — ver atas.css § @media print.
// A folha timbrada é montada aqui e só fica visível ao imprimir.
// ============================================================
import { TIPOS, getAtas, criarAta, atualizarAta, excluirAta } from './atas.model.js';
import { esc, norm, val, falha } from '../../shared/dom.js';
import { hojeISO, fmtData, fmtExtenso, addDias } from '../../shared/format.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';

let perfil = null, lista = [];
let filtro = { de: addDias(hojeISO(), -180), ate: hojeISO(), tipo: '', q: '' };

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;

  app.innerHTML = `
    <div class="page-head no-print">
      <h1>Atas de Atendimento</h1>
      <p>Redação e impressão em papel timbrado das atas de atendimento.</p>
    </div>
    <div class="toolbar no-print">
      <label class="search">🔎
        <input id="at-q" type="search" placeholder="Buscar por assunto, participantes, local…" autocomplete="off" />
      </label>
      <button id="at-nova" class="btn-primary" hidden>+ Nova ata</button>
    </div>
    <div class="toolbar subfiltros no-print">
      <label class="search compacta">De <input id="at-de" type="date" value="${filtro.de}" /></label>
      <label class="search compacta">Até <input id="at-ate" type="date" value="${filtro.ate}" /></label>
      <label class="search compacta">Tipo <select id="at-tipo">
        <option value="">Todos</option>
        ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <span class="count" id="at-count"></span>
    </div>
    <div id="at-lista" class="no-print">${loading()}</div>
    <div id="at-folha" class="ata-folha" aria-hidden="true"></div>
    ${drawerHtml()}`;

  montarDrawer();
  document.getElementById('at-q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  document.getElementById('at-de').addEventListener('change', e => { filtro.de = e.target.value; carregar(); });
  document.getElementById('at-ate').addEventListener('change', e => { filtro.ate = e.target.value; carregar(); });
  document.getElementById('at-tipo').addEventListener('change', e => { filtro.tipo = e.target.value; carregar(); });

  if (perfil?.isAdmin) {
    const nova = document.getElementById('at-nova');
    nova.hidden = false;
    nova.addEventListener('click', () => abrirForm(null));
  }
  carregar();
}

async function carregar() {
  const box = document.getElementById('at-lista');
  box.innerHTML = loading();
  try {
    lista = await getAtas({
      de: filtro.de || undefined, ate: filtro.ate || undefined, tipo: filtro.tipo || undefined,
    });
  } catch (err) { box.innerHTML = erroBox(err); return; }
  pintar();
}

function combina(a) {
  if (!filtro.q) return true;
  return norm([a.assunto, a.participantes, a.local, a.deliberacoes, a.encaminhamentos].join(' '))
    .includes(norm(filtro.q));
}

function pintar() {
  const vis = lista.filter(combina);
  document.getElementById('at-count').textContent =
    `${vis.length}${vis.length !== lista.length ? ' de ' + lista.length : ''} ata(s)`;

  const box = document.getElementById('at-lista');
  if (!lista.length) {
    box.innerHTML = emptyState('📝', 'Nenhuma ata no período',
      perfil?.isAdmin ? 'Ajuste os filtros ou clique em “Nova ata”.' : 'Ajuste o período ou o tipo.');
    return;
  }
  box.innerHTML = vis.map(item).join('') || emptyState('🔎', 'Nada encontrado', 'Ajuste a busca.');
  box.querySelectorAll('.at-item').forEach(el => el.addEventListener('click', () => detalhe(el.dataset.id)));
}

function item(a) {
  return `<div class="solic at-item" data-id="${esc(a.id)}" tabindex="0">
    <div class="solic-main">
      <div class="di-top">
        <b>Ata nº ${esc(a.numero ?? '—')}/${esc(a.ano)}</b>
        <span class="tag">${esc(TIPOS[a.tipo] || a.tipo)}</span>
      </div>
      <div class="di-meta">${esc(fmtData(a.data))}${a.local ? ' · ' + esc(a.local) : ''}</div>
      <div class="di-meta texto-resumo">${esc(a.assunto)}</div>
    </div>
  </div>`;
}

// ── Detalhe ──────────────────────────────────────────────────
function detalhe(a) {
  const ata = typeof a === 'string' ? lista.find(x => x.id === a) : a;
  if (!ata) return;
  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val texto-completo">${v}</div></div>` : '';
  const acoes = perfil?.isAdmin ? `
    <div class="drawer-acoes">
      <button class="mini-btn" id="at-edit">✎ Editar</button>
      <button class="mini-btn no" id="at-del">🗑 Excluir</button>
    </div>` : '';

  abrirDrawer(`
    ${drawerHead(`Ata nº ${esc(ata.numero ?? '—')}/${esc(ata.ano)}`, esc(fmtData(ata.data)) + ' · ' + esc(TIPOS[ata.tipo] || ata.tipo))}
    <div class="drawer-body">
      <div class="drawer-acoes"><button class="btn-primary" id="at-print">🖨 Imprimir (papel timbrado)</button></div>
      ${acoes}
      ${campo('Local', esc(ata.local))}
      ${campo('Participantes', esc(ata.participantes))}
      ${campo('Assunto', esc(ata.assunto))}
      ${campo('Deliberações', esc(ata.deliberacoes))}
      ${campo('Encaminhamentos', esc(ata.encaminhamentos))}
      ${campo('Redigida por', esc(ata.redator))}
    </div>`);

  document.getElementById('at-print').addEventListener('click', () => imprimir(ata));
  if (!perfil?.isAdmin) return;
  document.getElementById('at-edit').addEventListener('click', () => abrirForm(ata));
  document.getElementById('at-del').addEventListener('click', () => remover(ata));
}

// ── Impressão em papel timbrado ──────────────────────────────
function imprimir(a) {
  const bloco = (t, txt) => txt
    ? `<div class="ata-bloco"><h3>${t}</h3><p>${esc(txt).replace(/\n/g, '<br>')}</p></div>` : '';

  document.getElementById('at-folha').innerHTML = `
    <div class="ata-timbre">
      <div class="ata-brasao">🏛️</div>
      <div class="ata-orgao">
        <strong>Prefeitura Municipal de Ribeirão Preto</strong>
        <span>Secretaria Municipal da Educação</span>
        <span>Gerência de Ensino Fundamental</span>
      </div>
    </div>
    <h1 class="ata-titulo">Ata de Atendimento nº ${esc(a.numero ?? '—')}/${esc(a.ano)}</h1>
    <p class="ata-abertura">
      Aos ${esc(fmtExtenso(a.data))}${a.hora ? `, às ${esc(a.hora.slice(0, 5))}` : ''}${a.local ? `, em ${esc(a.local)}` : ''},
      realizou-se o atendimento a <strong>${esc(TIPOS[a.tipo] || a.tipo)}</strong>, conforme registrado a seguir.
    </p>
    ${a.participantes ? bloco('Participantes', a.participantes) : ''}
    ${bloco('Assunto', a.assunto)}
    ${bloco('Deliberações', a.deliberacoes)}
    ${bloco('Encaminhamentos', a.encaminhamentos)}
    <div class="ata-assinaturas">
      <div class="ata-assina"><span></span>Responsável pelo atendimento</div>
      <div class="ata-assina"><span></span>Atendido(a)</div>
    </div>
    <p class="ata-rodape">Ribeirão Preto, ${esc(fmtExtenso(a.data))}.</p>`;

  // Só a folha aparece na impressão (o resto tem no-print / regra @media).
  document.body.classList.add('imprimindo-ata');
  const limpar = () => { document.body.classList.remove('imprimindo-ata'); window.removeEventListener('afterprint', limpar); };
  window.addEventListener('afterprint', limpar);
  window.print();
}

// ── Formulário ───────────────────────────────────────────────
function abrirForm(a) {
  const novo = !a;
  const optsTipo = Object.entries(TIPOS)
    .map(([k, v]) => `<option value="${k}" ${(a?.tipo || 'gestor') === k ? 'selected' : ''}>${esc(v)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead(novo ? 'Nova ata' : `Editar ata nº ${esc(a.numero ?? '')}/${esc(a.ano ?? '')}`)}
    <div class="drawer-body">
      <form id="at-form" class="esc-form">
        <div class="esc-row">
          <label>Data <input id="f-data" type="date" value="${esc(a?.data || hojeISO())}" required /></label>
          <label>Hora <input id="f-hora" type="time" value="${esc(a?.hora ? a.hora.slice(0, 5) : '')}" /></label>
        </div>
        <label>Tipo de atendimento <select id="f-tipo">${optsTipo}</select></label>
        <label>Local <input id="f-local" value="${esc(a?.local || '')}" placeholder="Ex.: Gerência de Ensino Fundamental" /></label>
        <label>Participantes <textarea id="f-part" rows="2">${esc(a?.participantes || '')}</textarea></label>
        <label>Assunto <input id="f-assunto" required value="${esc(a?.assunto || '')}" /></label>
        <label>Deliberações <textarea id="f-delib" rows="5">${esc(a?.deliberacoes || '')}</textarea></label>
        <label>Encaminhamentos <textarea id="f-enc" rows="3">${esc(a?.encaminhamentos || '')}</textarea></label>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-save">${novo ? 'Registrar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`);

  document.getElementById('at-form').addEventListener('submit', (e) => salvar(e, a));
}

async function salvar(e, a) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const payload = {
    data: document.getElementById('f-data').value,
    hora: document.getElementById('f-hora').value || null,
    tipo: document.getElementById('f-tipo').value,
    local: val('f-local') || null,
    participantes: val('f-part') || null,
    assunto: val('f-assunto'),
    deliberacoes: val('f-delib') || null,
    encaminhamentos: val('f-enc') || null,
  };
  if (!payload.assunto) return falha(msg, 'Informe o assunto.');
  if (!payload.data) return falha(msg, 'Informe a data.');

  const btn = document.getElementById('f-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (a) await atualizarAta(a.id, payload);
    else await criarAta(payload);
    fecharDrawer(); carregar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = a ? 'Salvar' : 'Registrar';
  }
}

async function remover(a) {
  if (!confirm(`Excluir a ata nº ${a.numero}/${a.ano}? Esta ação não pode ser desfeita.`)) return;
  try { await excluirAta(a.id); fecharDrawer(); carregar(); }
  catch (err) { alert('Não foi possível excluir: ' + (err.message || err)); }
}
