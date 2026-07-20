// ============================================================
// FundHub — modules/projetos/projetos.view.js
// Projetos e pesquisas: lista + CRUD (admin) + manifestação de
// interesse das escolas, na própria gaveta do projeto.
// ============================================================
import {
  TIPOS, STATUS, STATUS_TAG,
  getProjetos, criarProjeto, atualizarProjeto, excluirProjeto,
  getInteresses, adicionarInteresse, removerInteresse,
} from './projetos.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { esc, norm, val, checked, falha } from '../../shared/dom.js';
import { fmtData } from '../../shared/format.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';
import { criarFiltroSegmento } from '../../shared/ui/filtro-segmento.js';

let perfil = null, unidades = [], lista = [];
let filtro = { status: '', tipo: '', q: '' };
let seg = null;

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;

  app.innerHTML = `
    <div class="page-head">
      <h1>Projetos &amp; Pesquisas</h1>
      <p>Projetos e pesquisas ofertados às escolas, anuências e manifestação de interesse.</p>
    </div>
    <div class="toolbar">
      <label class="search">🔎
        <input id="pj-q" type="search" placeholder="Buscar por título, proponente, público-alvo…" autocomplete="off" />
      </label>
      <button id="pj-novo" class="btn-primary" hidden>+ Novo projeto</button>
    </div>
    <div class="toolbar subfiltros">
      <label class="search compacta">Situação <select id="pj-status">
        <option value="">Todas</option>
        ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <label class="search compacta">Tipo <select id="pj-tipo">
        <option value="">Todos</option>
        ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <span class="count" id="pj-count"></span>
    </div>
    <div id="pj-seg" class="toolbar-linha"></div>
    <div class="cards" id="pj-cards">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();

  try { unidades = await getUnidades().catch(() => []); }
  catch (_) { unidades = []; }

  seg = criarFiltroSegmento(document.getElementById('pj-seg'), {
    perfil, onChange: pintar, chaveMemoria: 'fundhub:seg:projetos',
  });

  document.getElementById('pj-q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  document.getElementById('pj-status').addEventListener('change', e => { filtro.status = e.target.value; carregar(); });
  document.getElementById('pj-tipo').addEventListener('change', e => { filtro.tipo = e.target.value; carregar(); });

  if (perfil?.isAdmin) {
    const novo = document.getElementById('pj-novo');
    novo.hidden = false;
    novo.addEventListener('click', () => abrirForm(null));
  }

  carregar();
}

async function carregar() {
  const box = document.getElementById('pj-cards');
  box.innerHTML = loading();
  try {
    lista = await getProjetos({ status: filtro.status || undefined, tipo: filtro.tipo || undefined });
  } catch (err) { box.innerHTML = erroBox(err); return; }
  pintar();
}

function combina(p) {
  if (!filtro.q) return true;
  return norm([p.titulo, p.proponente, p.publico_alvo, p.descricao].join(' ')).includes(norm(filtro.q));
}

function pintar() {
  const vis = lista.filter(combina);
  document.getElementById('pj-count').textContent =
    `${vis.length}${vis.length !== lista.length ? ' de ' + lista.length : ''} projeto(s)`;

  const box = document.getElementById('pj-cards');
  if (!lista.length) {
    box.innerHTML = emptyState('🔬', 'Nenhum projeto cadastrado',
      perfil?.isAdmin ? 'Clique em “Novo projeto”.' : 'Ainda não há projetos ofertados.');
    return;
  }
  box.innerHTML = vis.map(card).join('') || emptyState('🔎', 'Nada encontrado', 'Ajuste a busca.');
  box.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => detalhe(c.dataset.id)));
}

function card(p) {
  const periodo = [p.inicio, p.fim].filter(Boolean).map(fmtData).join(' – ');
  return `<article class="card" data-id="${esc(p.id)}" tabindex="0">
    <div class="card-top">
      <h3>${esc(p.titulo)}</h3>
      <span class="tag ${STATUS_TAG[p.status] || ''}">${esc(STATUS[p.status] || p.status)}</span>
    </div>
    ${p.proponente ? `<div class="addr">${esc(p.proponente)}</div>` : ''}
    <div class="tags">
      <span class="tag">${esc(TIPOS[p.tipo] || p.tipo)}</span>
      ${p.anuencia ? '<span class="tag bus">📄 Anuência</span>' : ''}
      ${periodo ? `<span class="tag">${esc(periodo)}</span>` : ''}
    </div>
  </article>`;
}

// ── Detalhe (com interesse das escolas) ──────────────────────
async function detalhe(id) {
  const p = lista.find(x => x.id === id);
  if (!p) return;
  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val texto-completo">${v}</div></div>` : '';
  const periodo = [p.inicio, p.fim].filter(Boolean).map(fmtData).join(' – ');
  const acoes = perfil?.isAdmin ? `
    <div class="drawer-acoes">
      <button class="mini-btn" id="pj-edit">✎ Editar</button>
      <button class="mini-btn no" id="pj-del">🗑 Excluir</button>
    </div>` : '';

  abrirDrawer(`
    ${drawerHead(esc(p.titulo), esc(TIPOS[p.tipo] || p.tipo))}
    <div class="drawer-body">
      ${acoes}
      <div class="field"><div class="lbl">Situação</div>
        <div class="val"><span class="tag ${STATUS_TAG[p.status] || ''}">${esc(STATUS[p.status] || p.status)}</span></div></div>
      ${campo('Proponente', esc(p.proponente))}
      ${campo('Descrição', esc(p.descricao))}
      ${campo('Público-alvo', esc(p.publico_alvo))}
      ${periodo ? campo('Período', esc(periodo)) : ''}
      ${campo('Anuência', p.anuencia ? ('Emitida' + (p.anuencia_data ? ' em ' + fmtData(p.anuencia_data) : '')) : 'Não emitida')}
      ${campo('Contato', esc(p.contato))}
      ${campo('Observações', esc(p.observacoes))}
      <hr class="sep" />
      <div class="vinc-head">
        <div class="field" style="margin:0"><div class="lbl">Escolas interessadas</div></div>
        ${perfil?.isAdmin ? `<button class="mini-btn" id="pj-add-int">+ Registrar interesse</button>` : ''}
      </div>
      <div class="people" id="pj-interesses">${loading()}</div>
    </div>`);

  if (perfil?.isAdmin) {
    document.getElementById('pj-edit').addEventListener('click', () => abrirForm(p));
    document.getElementById('pj-del').addEventListener('click', () => remover(p));
    document.getElementById('pj-add-int').addEventListener('click', () => formInteresse(p));
  }
  await pintarInteresses(p);
}

async function pintarInteresses(p) {
  const box = document.getElementById('pj-interesses');
  if (!box) return;
  let itens = [];
  try { itens = await getInteresses(p.id); }
  catch (err) { box.innerHTML = erroBox(err); return; }

  if (!itens.length) { box.innerHTML = `<p class="count">Nenhuma escola registrou interesse ainda.</p>`; return; }
  box.innerHTML = itens.map(i => `
    <div class="person">
      <div class="pname">${esc(i.unidade?.apelido || i.unidade?.nome || '—')}</div>
      <div class="pmeta">
        ${i.observacao ? `<span>${esc(i.observacao)}</span>` : ''}
        ${perfil?.isAdmin ? `<div class="vinc-acoes"><button class="mini-btn no" data-del-int="${i.id}" aria-label="Remover interesse">🗑</button></div>` : ''}
      </div>
    </div>`).join('');
  box.querySelectorAll('[data-del-int]').forEach(b =>
    b.addEventListener('click', async () => {
      try { await removerInteresse(b.dataset.delInt); await pintarInteresses(p); }
      catch (err) { alert('Não foi possível remover: ' + (err.message || err)); }
    }));
}

function formInteresse(p) {
  // O par (projeto, escola) é unique no banco — não precisa filtrar aqui.
  //
  // O recorte por segmento entra no SELETOR, não na lista de projetos:
  // um projeto sem interesse registrado ainda não tem escola, e filtrá-lo
  // por segmento o faria desaparecer justamente de quem deveria ofertá-lo.
  const opts = [...unidades]
    .filter(u => !seg || seg.combina(u))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map(u => `<option value="${esc(u.id || u.numero)}">${esc(u.nome)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead('Registrar interesse', esc(p.titulo))}
    <div class="drawer-body">
      <form id="int-form" class="esc-form">
        <label>Escola <select id="i-uni" required><option value="">Selecione…</option>${opts}</select></label>
        <label>Observação <input id="i-obs" placeholder="Opcional" /></label>
        <div class="form-foot">
          <span id="i-msg" class="auth-msg"></span>
          <button type="submit" id="i-save">Registrar</button>
        </div>
      </form>
    </div>`);

  document.getElementById('int-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('i-msg'); msg.className = 'auth-msg';
    const unidade_id = document.getElementById('i-uni').value;
    if (!unidade_id) return falha(msg, 'Selecione a escola.');
    const btn = document.getElementById('i-save'); btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      await adicionarInteresse({ projeto_id: p.id, unidade_id, observacao: val('i-obs') || null });
      detalhe(p.id);   // reabre o detalhe já com o novo interesse
    } catch (err) {
      falha(msg, err.message || String(err));
      btn.disabled = false; btn.textContent = 'Registrar';
    }
  });
}

// ── Formulário do projeto ────────────────────────────────────
function abrirForm(p) {
  const novo = !p;
  const optsTipo = Object.entries(TIPOS)
    .map(([k, v]) => `<option value="${k}" ${(p?.tipo || 'pesquisa') === k ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const optsStatus = Object.entries(STATUS)
    .map(([k, v]) => `<option value="${k}" ${(p?.status || 'proposto') === k ? 'selected' : ''}>${esc(v)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo projeto' : 'Editar projeto')}
    <div class="drawer-body">
      <form id="pj-form" class="esc-form">
        <label>Título <input id="f-titulo" required value="${esc(p?.titulo || '')}" /></label>
        <label>Proponente (pesquisador/instituição) <input id="f-prop" value="${esc(p?.proponente || '')}" /></label>
        <div class="esc-row">
          <label>Tipo <select id="f-tipo">${optsTipo}</select></label>
          <label>Situação <select id="f-status">${optsStatus}</select></label>
        </div>
        <label>Descrição <textarea id="f-desc" rows="3">${esc(p?.descricao || '')}</textarea></label>
        <label>Público-alvo <input id="f-pub" value="${esc(p?.publico_alvo || '')}" /></label>
        <div class="esc-row">
          <label>Início <input id="f-ini" type="date" value="${esc(p?.inicio || '')}" /></label>
          <label>Fim <input id="f-fim" type="date" value="${esc(p?.fim || '')}" /></label>
        </div>
        <div class="esc-row">
          <label class="inline"><input type="checkbox" id="f-anu" ${p?.anuencia ? 'checked' : ''} /> Carta de anuência emitida</label>
          <label>Data da anuência <input id="f-anu-data" type="date" value="${esc(p?.anuencia_data || '')}" /></label>
        </div>
        <label>Contato <input id="f-contato" value="${esc(p?.contato || '')}" /></label>
        <label>Observações <textarea id="f-obs" rows="2">${esc(p?.observacoes || '')}</textarea></label>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-save">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`);

  document.getElementById('pj-form').addEventListener('submit', (e) => salvar(e, p));
}

async function salvar(e, p) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const anuencia = checked('f-anu');
  const payload = {
    titulo: val('f-titulo'),
    proponente: val('f-prop') || null,
    tipo: document.getElementById('f-tipo').value,
    status: document.getElementById('f-status').value,
    descricao: val('f-desc') || null,
    publico_alvo: val('f-pub') || null,
    inicio: document.getElementById('f-ini').value || null,
    fim: document.getElementById('f-fim').value || null,
    anuencia,
    anuencia_data: anuencia ? (document.getElementById('f-anu-data').value || null) : null,
    contato: val('f-contato') || null,
    observacoes: val('f-obs') || null,
  };
  if (!payload.titulo) return falha(msg, 'Informe o título.');
  if (payload.inicio && payload.fim && payload.fim < payload.inicio) return falha(msg, 'O fim não pode ser antes do início.');

  const btn = document.getElementById('f-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (p) await atualizarProjeto(p.id, payload);
    else await criarProjeto(payload);
    fecharDrawer(); carregar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = p ? 'Salvar' : 'Criar';
  }
}

async function remover(p) {
  if (!confirm(`Excluir o projeto "${p.titulo}"? Isso remove junto as manifestações de interesse. Não pode ser desfeito.`)) return;
  try { await excluirProjeto(p.id); fecharDrawer(); carregar(); }
  catch (err) { alert('Não foi possível excluir: ' + (err.message || err)); }
}
