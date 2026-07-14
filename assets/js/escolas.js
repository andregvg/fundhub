// ============================================================
// FundHub — escolas.js  (módulo Cadastro de Escolas)
// ============================================================
import { getUnidades } from './data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let ALL = [];
let filtro = { q: '', segmento: '', transporte: false, eja: false };

export async function renderEscolas(app) {
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
    </div>
    <div class="cards" id="cards"></div>
    <div class="drawer-back" id="drawer-back"></div>
    <aside class="drawer" id="drawer" aria-hidden="true"></aside>
  `;

  try {
    ALL = await getUnidades();
  } catch (err) {
    document.getElementById('cards').innerHTML =
      `<p class="count">Não foi possível carregar as escolas: ${esc(err.message || err)}</p>`;
    return;
  }

  if (!ALL.length) {
    document.getElementById('cards').innerHTML = `
      <div class="empty">
        <div class="empty-ico">🗄️</div>
        <h3>Sem dados carregados</h3>
        <p>O FundHub lê as escolas do Supabase. Configure <code>assets/js/config.js</code>
           com a URL e a anon key do projeto, ou adicione <code>data/unidades.local.json</code>
           para desenvolvimento local.</p>
      </div>`;
    document.getElementById('count').textContent = '';
    return;
  }

  const segmentos = [...new Set(ALL.map(u => u.segmento).filter(Boolean))].sort();
  document.getElementById('filters').innerHTML = [
    ...segmentos.map(s => `<button class="chip" data-seg="${esc(s)}">${esc(s)}</button>`),
    `<button class="chip" data-flag="transporte">🚌 Transporte</button>`,
    `<button class="chip" data-flag="eja">🌙 EJA</button>`,
  ].join('');

  document.getElementById('q').addEventListener('input', e => { filtro.q = e.target.value; paint(); });
  document.getElementById('filters').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.seg != null) filtro.segmento = filtro.segmento === b.dataset.seg ? '' : b.dataset.seg;
    if (b.dataset.flag === 'transporte') filtro.transporte = !filtro.transporte;
    if (b.dataset.flag === 'eja') filtro.eja = !filtro.eja;
    syncChips(); paint();
  });
  document.getElementById('drawer-back').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  paint();
}

function syncChips() {
  document.querySelectorAll('#filters .chip').forEach(b => {
    const on = (b.dataset.seg != null && b.dataset.seg === filtro.segmento)
      || (b.dataset.flag === 'transporte' && filtro.transporte)
      || (b.dataset.flag === 'eja' && filtro.eja);
    b.classList.toggle('on', on);
  });
}

function matches(u) {
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

function paint() {
  const list = ALL.filter(matches).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  document.getElementById('count').textContent = `${list.length} de ${ALL.length} escolas`;
  document.getElementById('cards').innerHTML = list.map(cardHtml).join('') ||
    `<p class="count">Nenhuma escola encontrada.</p>`;
  document.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => openDrawer(c.dataset.num)));
}

function cardHtml(u) {
  const tags = [
    u.tem_transporte ? `<span class="tag bus">🚌 Transporte</span>` : '',
    u.tem_eja ? `<span class="tag eja">🌙 EJA</span>` : '',
    u.oferta ? `<span class="tag">${esc(u.oferta)}</span>` : '',
  ].join('');
  return `<article class="card" data-num="${u.numero}">
    <div class="card-top">
      <h3>${esc(u.apelido || u.nome)}</h3>
      ${u.segmento ? `<span class="seg">${esc(u.segmento)}</span>` : ''}
    </div>
    <div class="addr">${esc(u.endereco || '—')}</div>
    <div class="tags">${tags}</div>
  </article>`;
}

function openDrawer(num) {
  const u = ALL.find(x => String(x.numero) === String(num));
  if (!u) return;
  const tel = (u.telefones || []).map(t => `<a href="tel:${esc(t.replace(/\D/g, ''))}">${esc(t)}</a>`).join(' · ') || '—';
  const people = (u.pessoas || []).filter(p => p.nome).map(p => `
    <div class="person">
      <div class="role">${esc(p.papel)}</div>
      <div class="pname">${esc(p.nome)}${p.apelido ? ` · ${esc(p.apelido)}` : ''}</div>
      <div class="pmeta">
        ${p.email ? `<span>✉ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></span>` : ''}
        ${p.telefone ? `<span>📱 ${esc(p.telefone)}</span>` : ''}
      </div>
    </div>`).join('') || '<p class="count">Sem pessoas cadastradas.</p>';

  const field = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';
  const maps = u.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.endereco + ', Ribeirão Preto, SP')}` : '';

  document.getElementById('drawer').innerHTML = `
    <div class="drawer-head">
      <div><h2>${esc(u.nome)}</h2><small>${esc(u.nome_oficial || '')}</small></div>
      <button class="drawer-close" id="dc">×</button>
    </div>
    <div class="drawer-body">
      ${field('Segmento', esc(u.segmento))}
      ${field('Endereço', esc(u.endereco) + (maps ? ` · <a href="${maps}" target="_blank" rel="noopener">ver no mapa</a>` : ''))}
      ${field('Telefones', tel)}
      ${field('E-mail institucional', u.email ? `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>` : '')}
      ${field('Regional', esc(u.regional))}
      ${field('Oferta', esc(u.oferta))}
      ${field('Transporte de alunos', u.tem_transporte ? 'Sim' : 'Não')}
      ${field('EJA', u.tem_eja ? 'Sim' : 'Não')}
      ${field('INEP', esc(u.inep))}
      ${u.site_apm ? field('Site APM', `<a href="${esc(u.site_apm)}" target="_blank" rel="noopener">abrir</a>`) : ''}
      <hr class="sep" />
      <div class="field"><div class="lbl">Equipe gestora (2026)</div></div>
      <div class="people">${people}</div>
    </div>`;
  document.getElementById('dc').addEventListener('click', closeDrawer);
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-back').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer')?.classList.remove('open');
  document.getElementById('drawer-back')?.classList.remove('open');
}
