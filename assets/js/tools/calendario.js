// ============================================================
// FundHub — calendario.js  (Calendário Escolar)
// Grade mensal: dias letivos, eventos e bloqueios (extraclasse/
// afastamento) que o SATE e os Afastamentos consultam. Admin edita
// cada dia; demais visualizam.
// ============================================================
import { getCalendarioMes, upsertDiaCalendario } from '../data/calendario.js';
import { getPerfilAtual } from '../data/perfil.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const TIPOS = ['calendário escolar', 'evento pedagógico', 'cultural', 'prova', 'feriado'];

const hoje = new Date();
let ano = hoje.getFullYear(), mes = hoje.getMonth() + 1; // mes 1-12
let perfil = null, dias = {};

export async function renderCalendario(app) {
  app.innerHTML = `
    <div class="page-head">
      <h1>Calendário Escolar</h1>
      <p>Dias letivos, eventos e bloqueios de data (provas bloqueiam extraclasse).</p>
    </div>
    <div class="cal-bar">
      <button class="mini-btn" id="cal-prev">←</button>
      <div class="cal-titulo" id="cal-titulo"></div>
      <button class="mini-btn" id="cal-next">→</button>
      <div class="cal-legenda">
        <span><i class="lg lg-nletivo"></i> não letivo</span>
        <span><i class="lg lg-evento"></i> evento</span>
        <span><i class="lg lg-bloq"></i> bloqueia extraclasse</span>
      </div>
    </div>
    <div id="cal-grid"><div class="loading">Carregando…</div></div>
    <div class="drawer-back" id="drawer-back"></div>
    <aside class="drawer" id="drawer"></aside>`;

  perfil = await getPerfilAtual().catch(() => null);
  document.getElementById('cal-prev').addEventListener('click', () => mover(-1));
  document.getElementById('cal-next').addEventListener('click', () => mover(1));
  document.getElementById('drawer-back').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  await load();
}

function mover(delta) {
  mes += delta;
  if (mes < 1) { mes = 12; ano--; } else if (mes > 12) { mes = 1; ano++; }
  load();
}

async function load() {
  document.getElementById('cal-titulo').textContent = `${MESES[mes - 1]} de ${ano}`;
  const grid = document.getElementById('cal-grid');
  let lista = [];
  try { lista = await getCalendarioMes(ano, mes); }
  catch (err) { grid.innerHTML = `<p class="count">Erro: ${esc(err.message || err)}</p>`; return; }
  dias = {};
  lista.forEach(d => { dias[d.data] = d; });
  pintar();
}

function pintar() {
  const grid = document.getElementById('cal-grid');
  const primeiro = new Date(ano, mes - 1, 1).getDay();       // 0=dom
  const totalDias = new Date(ano, mes, 0).getDate();
  const hojeISO = new Date().toLocaleDateString('sv-SE');

  let cells = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < primeiro; i++) cells += `<div class="cal-cell vazio"></div>`;
  for (let dia = 1; dia <= totalDias; dia++) {
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const d = dias[iso];
    const naoLetivo = d && !d.letivo;
    const cls = ['cal-cell'];
    if (naoLetivo) cls.push('nletivo');
    if (iso === hojeISO) cls.push('hoje');
    if (d?.bloqueia_extraclasse) cls.push('bloq');
    cells += `<div class="${cls.join(' ')}" data-iso="${iso}" tabindex="0">
      <div class="cal-num">${dia}</div>
      ${d?.evento ? `<div class="cal-ev">${esc(d.evento)}</div>` : ''}
      <div class="cal-marks">
        ${d?.bloqueia_extraclasse ? '<span title="Bloqueia extraclasse">🚫</span>' : ''}
        ${d?.bloqueia_afastamento ? '<span title="Não conceder afastamentos">🌴</span>' : ''}
      </div>
    </div>`;
  }
  grid.innerHTML = `<div class="cal-grid">${cells}</div>`;
  grid.querySelectorAll('.cal-cell[data-iso]').forEach(c =>
    c.addEventListener('click', () => abrirDia(c.dataset.iso)));
}

function abrirDia(iso) {
  const d = dias[iso] || { data: iso, letivo: true };
  const podeEditar = perfil?.isAdmin;
  const [y, m, dd] = iso.split('-');
  const cab = `${dd}/${m}/${y}`;

  const view = `
    <div class="field"><div class="lbl">Dia letivo</div><div class="val">${d.letivo ? 'Sim' : 'Não'}</div></div>
    ${d.tipo ? `<div class="field"><div class="lbl">Tipo</div><div class="val">${esc(d.tipo)}</div></div>` : ''}
    ${d.evento ? `<div class="field"><div class="lbl">Evento</div><div class="val">${esc(d.evento)}</div></div>` : ''}
    <div class="field"><div class="lbl">Bloqueia extraclasse</div><div class="val">${d.bloqueia_extraclasse ? 'Sim' : 'Não'}</div></div>
    <div class="field"><div class="lbl">Não conceder afastamentos</div><div class="val">${d.bloqueia_afastamento ? 'Sim' : 'Não'}</div></div>
    ${d.obs ? `<div class="field"><div class="lbl">Observação</div><div class="val">${esc(d.obs)}</div></div>` : ''}`;

  const form = `
    <form id="dia-form" class="esc-form">
      <label class="inline"><input type="checkbox" id="d-letivo" ${d.letivo ? 'checked' : ''}/> Dia letivo</label>
      <label>Tipo <input id="d-tipo" list="tipos" value="${esc(d.tipo || '')}" />
        <datalist id="tipos">${TIPOS.map(t => `<option>${t}</option>`).join('')}</datalist></label>
      <label>Evento <input id="d-evento" value="${esc(d.evento || '')}" /></label>
      <div class="esc-row">
        <label class="inline"><input type="checkbox" id="d-bloq" ${d.bloqueia_extraclasse ? 'checked' : ''}/> Bloqueia extraclasse</label>
        <label class="inline"><input type="checkbox" id="d-afast" ${d.bloqueia_afastamento ? 'checked' : ''}/> Não conceder afastamentos</label>
      </div>
      <label>Observação <input id="d-obs" value="${esc(d.obs || '')}" /></label>
      <div class="form-foot"><span id="d-msg" class="auth-msg"></span><button type="submit" id="d-save">Salvar</button></div>
    </form>`;

  document.getElementById('drawer').innerHTML = `
    <div class="drawer-head">
      <div><h2>${cab}</h2><small>${DOW[new Date(iso + 'T00:00:00').getDay()]}</small></div>
      <button class="drawer-close" id="dc">×</button>
    </div>
    <div class="drawer-body">${podeEditar ? form : view}</div>`;
  document.getElementById('dc').addEventListener('click', closeDrawer);
  if (podeEditar) document.getElementById('dia-form').addEventListener('submit', (e) => salvar(e, iso));
  openDrawerEl();
}

async function salvar(e, iso) {
  e.preventDefault();
  const msg = document.getElementById('d-msg'); msg.className = 'auth-msg';
  const dia = {
    data: iso,
    letivo: document.getElementById('d-letivo').checked,
    tipo: document.getElementById('d-tipo').value.trim() || null,
    evento: document.getElementById('d-evento').value.trim() || null,
    bloqueia_extraclasse: document.getElementById('d-bloq').checked,
    bloqueia_afastamento: document.getElementById('d-afast').checked,
    obs: document.getElementById('d-obs').value.trim() || null,
  };
  const btn = document.getElementById('d-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    await upsertDiaCalendario(dia);
    dias[iso] = dia;
    closeDrawer(); pintar();
  } catch (err) {
    msg.classList.add('err'); msg.textContent = 'Erro: ' + (err.message || err);
    btn.disabled = false; btn.textContent = 'Salvar';
  }
}

function openDrawerEl() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-back').classList.add('open');
}
function closeDrawer() {
  document.getElementById('drawer')?.classList.remove('open');
  document.getElementById('drawer-back')?.classList.remove('open');
}
