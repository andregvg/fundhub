// ============================================================
// FundHub — modules/escolas/escolas.view.js
// Tela do módulo Escolas: busca, filtros, detalhe em gaveta e CRUD
// (admin). É o "V+C" do MVC — renderiza e trata eventos, mas todo
// acesso a dados passa por escolas.model.js.
// ============================================================
import { getUnidades, criarUnidade, atualizarUnidade, excluirUnidade } from './escolas.model.js';
import { esc, norm, falha } from '../../shared/dom.js';
import { emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';

let ALL = [];
let perfil = null;
let filtro = { q: '', segmento: '', transporte: false, eja: false };

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;

  app.innerHTML = `
    <div class="page-head">
      <h1>Escolas</h1>
      <p>Cadastro das unidades escolares da rede — Ensino Fundamental.</p>
    </div>
    <div class="toolbar">
      <label class="search">🔎
        <input id="q" type="search" placeholder="Buscar por nome, apelido, bairro, gestor…" autocomplete="off" />
      </label>
      <div class="filters" id="filters"></div>
      <span class="count" id="count"></span>
      <button id="nova-escola" class="btn-primary" hidden>+ Nova escola</button>
    </div>
    <div class="cards" id="cards"></div>
    ${drawerHtml()}`;

  montarDrawer();

  try {
    ALL = await getUnidades();
  } catch (err) {
    document.getElementById('cards').innerHTML = erroBox(err);
    return;
  }

  if (!ALL.length) {
    document.getElementById('cards').innerHTML = emptyState('🗄️', 'Sem dados carregados',
      `O FundHub lê as escolas do Supabase. Confira <code>src/core/config.js</code>
       ou adicione <code>data/unidades.local.json</code> para desenvolvimento local.`);
    document.getElementById('count').textContent = '';
  }

  const segmentos = [...new Set(ALL.map(u => u.segmento).filter(Boolean))].sort();
  document.getElementById('filters').innerHTML = [
    ...segmentos.map(s => `<button class="chip" data-seg="${esc(s)}">${esc(s)}</button>`),
    `<button class="chip" data-flag="transporte">🚌 Transporte</button>`,
    `<button class="chip" data-flag="eja">🌙 EJA</button>`,
  ].join('');

  document.getElementById('q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  document.getElementById('filters').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.seg != null) filtro.segmento = filtro.segmento === b.dataset.seg ? '' : b.dataset.seg;
    if (b.dataset.flag === 'transporte') filtro.transporte = !filtro.transporte;
    if (b.dataset.flag === 'eja') filtro.eja = !filtro.eja;
    sincronizarChips(); pintar();
  });

  if (perfil?.isAdmin) {
    const nova = document.getElementById('nova-escola');
    nova.hidden = false;
    nova.addEventListener('click', () => abrirForm(null));
  }

  pintar();
}

function sincronizarChips() {
  document.querySelectorAll('#filters .chip').forEach(b => {
    const on = (b.dataset.seg != null && b.dataset.seg === filtro.segmento)
      || (b.dataset.flag === 'transporte' && filtro.transporte)
      || (b.dataset.flag === 'eja' && filtro.eja);
    b.classList.toggle('on', on);
  });
}

function combina(u) {
  if (filtro.segmento && u.segmento !== filtro.segmento) return false;
  if (filtro.transporte && !u.tem_transporte) return false;
  if (filtro.eja && !u.tem_eja) return false;
  if (filtro.q) {
    const q = norm(filtro.q);
    const hay = norm([u.nome, u.apelido, u.nome_oficial, u.endereco,
      ...(u.pessoas || []).map(p => p.nome + ' ' + (p.apelido || ''))].join(' '));
    if (!hay.includes(q)) return false;
  }
  return true;
}

function pintar() {
  const lista = ALL.filter(combina).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  document.getElementById('count').textContent = `${lista.length} de ${ALL.length} escolas`;
  const cards = document.getElementById('cards');
  if (ALL.length) {
    cards.innerHTML = lista.map(cardHtml).join('')
      || emptyState('🔎', 'Nenhuma escola encontrada', 'Ajuste a busca ou os filtros.');
  }
  cards.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => abrirDetalhe(c.dataset.id)));
}

function cardHtml(u) {
  const tags = [
    u.tem_transporte ? `<span class="tag bus">🚌 Transporte</span>` : '',
    u.tem_eja ? `<span class="tag eja">🌙 EJA</span>` : '',
    u.oferta ? `<span class="tag">${esc(u.oferta)}</span>` : '',
  ].join('');
  return `<article class="card" data-id="${esc(u.id || u.numero)}" tabindex="0">
    <div class="card-top">
      <h3>${esc(u.apelido || u.nome)}</h3>
      ${u.segmento ? `<span class="seg">${esc(u.segmento)}</span>` : ''}
    </div>
    <div class="addr">${esc(u.endereco || '—')}</div>
    <div class="tags">${tags}</div>
  </article>`;
}

function porChave(key) {
  return ALL.find(x => String(x.id) === String(key))
    || ALL.find(x => String(x.numero) === String(key));
}

// ── Detalhe ──────────────────────────────────────────────────
function abrirDetalhe(key) {
  const u = porChave(key);
  if (!u) return;

  const tel = (u.telefones || [])
    .map(t => `<a href="tel:${esc(t.replace(/\D/g, ''))}">${esc(t)}</a>`).join(' · ') || '—';
  const pessoas = (u.pessoas || []).filter(p => p.nome).map(p => `
    <div class="person">
      <div class="role">${esc(p.papel)}</div>
      <div class="pname">${esc(p.nome)}${p.apelido ? ` · ${esc(p.apelido)}` : ''}</div>
      <div class="pmeta">
        ${p.email ? `<span>✉ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></span>` : ''}
        ${p.telefone ? `<span>📱 ${esc(p.telefone)}</span>` : ''}
      </div>
    </div>`).join('') || '<p class="count">Sem pessoas cadastradas.</p>';

  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';
  const maps = u.endereco
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.endereco + ', Ribeirão Preto, SP')}`
    : '';
  const acoes = perfil?.isAdmin ? `
    <div class="drawer-acoes">
      <button class="mini-btn" id="edit-esc">✎ Editar</button>
      <button class="mini-btn no" id="del-esc">🗑 Excluir</button>
    </div>` : '';

  abrirDrawer(`
    ${drawerHead(esc(u.nome), esc(u.nome_oficial || ''))}
    <div class="drawer-body">
      ${acoes}
      ${campo('Segmento', esc(u.segmento))}
      ${campo('Endereço', esc(u.endereco) + (maps ? ` · <a href="${maps}" target="_blank" rel="noopener">ver no mapa</a>` : ''))}
      ${campo('Telefones', tel)}
      ${campo('E-mail institucional', u.email ? `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>` : '')}
      ${campo('Regional', esc(u.regional))}
      ${campo('Oferta', esc(u.oferta))}
      ${campo('Transporte de alunos', u.tem_transporte ? 'Sim' : 'Não')}
      ${campo('EJA', u.tem_eja ? 'Sim' : 'Não')}
      ${campo('INEP', esc(u.inep))}
      ${u.site_apm ? campo('Site APM', `<a href="${esc(u.site_apm)}" target="_blank" rel="noopener">abrir</a>`) : ''}
      <hr class="sep" />
      <div class="field"><div class="lbl">Equipe gestora</div></div>
      <div class="people">${pessoas}</div>
    </div>`);

  if (perfil?.isAdmin) {
    document.getElementById('edit-esc').addEventListener('click', () => abrirForm(u));
    document.getElementById('del-esc').addEventListener('click', () => remover(u));
  }
}

// ── Formulário (criar/editar) ────────────────────────────────
function abrirForm(u) {
  const novo = !u;
  const v = (k) => esc(u?.[k] ?? '');
  const chk = (k) => (u?.[k] ? 'checked' : '');

  abrirDrawer(`
    ${drawerHead(novo ? 'Nova escola' : 'Editar escola')}
    <div class="drawer-body">
      <form id="esc-form" class="esc-form">
        <label>Nome <input name="nome" required value="${v('nome')}" /></label>
        <label>Apelido <input name="apelido" value="${v('apelido')}" /></label>
        <label>Nome oficial <input name="nome_oficial" value="${v('nome_oficial')}" /></label>
        <label>Segmento <input name="segmento" list="segs" value="${v('segmento')}" />
          <datalist id="segs"><option>EMEF</option><option>EMEI</option><option>CEI</option><option>EMEPB</option><option>CONVENIADA</option></datalist>
        </label>
        <label>Endereço <input name="endereco" value="${v('endereco')}" /></label>
        <label>Telefones (separe por “/”) <input name="telefones" value="${esc((u?.telefones || []).join(' / '))}" /></label>
        <label>E-mail institucional <input name="email" type="email" value="${v('email')}" /></label>
        <label>Oferta <input name="oferta" placeholder="EF1/EF2" value="${v('oferta')}" /></label>
        <label>INEP <input name="inep" value="${v('inep')}" /></label>
        <label>Site APM <input name="site_apm" value="${v('site_apm')}" /></label>
        <div class="esc-row">
          <label class="inline"><input type="checkbox" name="tem_transporte" ${chk('tem_transporte')} /> Transporte de alunos</label>
          <label class="inline"><input type="checkbox" name="tem_eja" ${chk('tem_eja')} /> EJA</label>
        </div>
        <div class="form-foot">
          <span id="ef-msg" class="auth-msg"></span>
          <button type="submit" id="ef-save">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`);

  document.getElementById('esc-form').addEventListener('submit', (e) => salvar(e, u));
}

async function salvar(e, u) {
  e.preventDefault();
  const f = e.target;
  const msg = document.getElementById('ef-msg'); msg.className = 'auth-msg';
  const payload = {
    nome: f.nome.value.trim(),
    apelido: f.apelido.value.trim() || null,
    nome_oficial: f.nome_oficial.value.trim() || null,
    segmento: f.segmento.value.trim() || null,
    endereco: f.endereco.value.trim() || null,
    telefones: f.telefones.value.split('/').map(s => s.trim()).filter(Boolean),
    email: f.email.value.trim() || null,
    oferta: f.oferta.value.trim() || null,
    inep: f.inep.value.trim() || null,
    site_apm: f.site_apm.value.trim() || null,
    tem_transporte: f.tem_transporte.checked,
    tem_eja: f.tem_eja.checked,
  };
  if (!payload.nome) return falha(msg, 'Informe o nome.');

  const btn = document.getElementById('ef-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (u) await atualizarUnidade(u.id, payload);
    else await criarUnidade(payload);
    ALL = await getUnidades();
    fecharDrawer(); pintar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = u ? 'Salvar' : 'Criar';
  }
}

async function remover(u) {
  if (!confirm(`Excluir a escola "${u.nome}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await excluirUnidade(u.id);
    ALL = await getUnidades();
    fecharDrawer(); pintar();
  } catch (err) {
    alert('Não foi possível excluir: ' + (err.message || err));
  }
}
