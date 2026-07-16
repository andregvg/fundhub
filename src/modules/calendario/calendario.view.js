// ============================================================
// FundHub — modules/calendario/calendario.view.js
// Grade mensal: dias letivos, eventos e bloqueios (extraclasse /
// afastamento) que o SATE e os Afastamentos consultam.
// Admin edita cada dia; os demais visualizam.
// ============================================================
import { getCalendarioMes, upsertDiaCalendario, upsertPeriodo, upsertDias, TIPOS_DIA } from './calendario.model.js';
import { esc, falha, ok } from '../../shared/dom.js';
import { MESES, DOW, hojeISO, fmtData } from '../../shared/format.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';

const agora = new Date();
let ano = agora.getFullYear(), mes = agora.getMonth() + 1;   // mes 1-12
let perfil = null, dias = {};

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;

  app.innerHTML = `
    <div class="page-head">
      <h1>Calendário Escolar</h1>
      <p>Dias letivos, eventos e bloqueios de data (provas bloqueiam extraclasse).</p>
    </div>
    <div class="cal-bar">
      <div class="cal-nav">
        <button class="mini-btn" id="cal-prev" aria-label="Mês anterior">←</button>
        <div class="cal-titulo" id="cal-titulo"></div>
        <button class="mini-btn" id="cal-next" aria-label="Próximo mês">→</button>
      </div>
      <div class="cal-legenda">
        <span><i class="lg lg-nletivo"></i> não letivo</span>
        <span><i class="lg lg-evento"></i> evento</span>
        <span><i class="lg lg-bloq"></i> bloqueia extraclasse</span>
      </div>
      ${perfil?.isAdmin ? `<button class="mini-btn" id="cal-importar">⭱ Importar</button>` : ''}
    </div>
    <div id="cal-grid">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();
  document.getElementById('cal-prev').addEventListener('click', () => mover(-1));
  document.getElementById('cal-next').addEventListener('click', () => mover(1));
  document.getElementById('cal-importar')?.addEventListener('click', abrirImportar);
  await carregar();
}

function mover(delta) {
  mes += delta;
  if (mes < 1) { mes = 12; ano--; } else if (mes > 12) { mes = 1; ano++; }
  carregar();
}

async function carregar() {
  document.getElementById('cal-titulo').textContent = `${MESES[mes - 1]} de ${ano}`;
  const grid = document.getElementById('cal-grid');
  let lista = [];
  try { lista = await getCalendarioMes(ano, mes); }
  catch (err) { grid.innerHTML = erroBox(err); return; }
  dias = {};
  lista.forEach(d => { dias[d.data] = d; });
  pintar();
}

function pintar() {
  const grid = document.getElementById('cal-grid');
  const primeiro = new Date(ano, mes - 1, 1).getDay();     // 0 = domingo
  const totalDias = new Date(ano, mes, 0).getDate();
  const hoje = hojeISO();

  let cells = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < primeiro; i++) cells += `<div class="cal-cell vazio"></div>`;

  for (let dia = 1; dia <= totalDias; dia++) {
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const d = dias[iso];
    const cls = ['cal-cell'];
    if (d && !d.letivo) cls.push('nletivo');
    if (iso === hoje) cls.push('hoje');
    if (d?.bloqueia_extraclasse) cls.push('bloq');
    cells += `<div class="${cls.join(' ')}" data-iso="${iso}" tabindex="0" role="button">
      <div class="cal-num">${dia}</div>
      ${d?.evento ? `<div class="cal-ev">${esc(d.evento)}</div>` : ''}
      <div class="cal-marks">
        ${d?.bloqueia_extraclasse ? '<span title="Bloqueia extraclasse">🚫</span>' : ''}
        ${d?.bloqueia_afastamento ? '<span title="Não conceder afastamentos">🌴</span>' : ''}
      </div>
    </div>`;
  }

  grid.innerHTML = `<div class="cal-grid">${cells}</div>`;
  grid.querySelectorAll('.cal-cell[data-iso]').forEach(c => {
    c.addEventListener('click', () => abrirDia(c.dataset.iso));
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDia(c.dataset.iso); } });
  });
}

function abrirDia(iso) {
  const d = dias[iso] || { data: iso, letivo: true };
  const podeEditar = perfil?.isAdmin;

  const visao = `
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
        <datalist id="tipos">${TIPOS_DIA.map(t => `<option>${t}</option>`).join('')}</datalist></label>
      <label>Evento <input id="d-evento" value="${esc(d.evento || '')}" /></label>
      <div class="esc-row">
        <label class="inline"><input type="checkbox" id="d-bloq" ${d.bloqueia_extraclasse ? 'checked' : ''}/> Bloqueia extraclasse</label>
        <label class="inline"><input type="checkbox" id="d-afast" ${d.bloqueia_afastamento ? 'checked' : ''}/> Não conceder afastamentos</label>
      </div>
      <label>Observação <input id="d-obs" value="${esc(d.obs || '')}" /></label>
      <label>Aplicar também até (opcional)
        <input id="d-ate" type="date" min="${esc(iso)}" />
        <small class="form-hint">Repete esta configuração de ${esc(fmtData(iso))} até a data escolhida (recesso, feriados, provas…).</small>
      </label>
      <div class="form-foot"><span id="d-msg" class="auth-msg"></span><button type="submit" id="d-save">Salvar</button></div>
    </form>`;

  const diaSemana = DOW[new Date(iso + 'T00:00:00').getDay()];
  abrirDrawer(`
    ${drawerHead(fmtData(iso), diaSemana)}
    <div class="drawer-body">${podeEditar ? form : visao}</div>`);

  if (podeEditar) document.getElementById('dia-form').addEventListener('submit', (e) => salvar(e, iso));
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
  const ate = document.getElementById('d-ate').value;
  if (ate && ate < iso) return falha(msg, 'A data final do intervalo não pode ser antes deste dia.');

  const btn = document.getElementById('d-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (ate && ate > iso) {
      const n = await upsertPeriodo(dia, iso, ate);
      fecharDrawer();
      await carregar();               // recarrega o mês (o intervalo pode passar dele)
      return void alert(`${n} dia(s) atualizado(s).`);
    }
    await upsertDiaCalendario(dia);
    dias[iso] = dia;
    fecharDrawer(); pintar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = 'Salvar';
  }
}

// ── Importação do calendário escolar ─────────────────────────
// Cola TSV/CSV com cabeçalho. Reconhece as colunas por nome (sem acento):
//   data | letivo | tipo | evento | bloqueia_extraclasse | bloqueia_afastamento | obs
// data aceita yyyy-mm-dd ou dd/mm/aaaa; booleanos: sim/não, x, 1/0, true/false.
function abrirImportar() {
  abrirDrawer(`
    ${drawerHead('Importar calendário', 'Cole os dados com cabeçalho (TSV ou CSV)')}
    <div class="drawer-body">
      <p class="form-hint">Colunas reconhecidas (por nome, em qualquer ordem):
        <b>data</b>, letivo, tipo, evento, bloqueia_extraclasse, bloqueia_afastamento, obs.
        A data aceita <code>aaaa-mm-dd</code> ou <code>dd/mm/aaaa</code>. Dias já existentes são atualizados.</p>
      <form id="imp-form" class="esc-form">
        <label>Dados
          <textarea id="imp-txt" rows="10" placeholder="data\tletivo\tevento\nbloqueia_extraclasse&#10;2026-02-18\tsim\tInício do ano letivo\tnão&#10;2026-07-06\tnão\tRecesso\tsim"></textarea>
        </label>
        <div class="form-foot">
          <span id="imp-msg" class="auth-msg"></span>
          <button type="submit" id="imp-save">Importar</button>
        </div>
      </form>
    </div>`);
  document.getElementById('imp-form').addEventListener('submit', importar);
}

// Converte "sim/não/x/1/0/true/false" em booleano; vazio → padrao.
function parseBool(v, padrao = false) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return padrao;
  return ['sim', 's', 'x', '1', 'true', 'verdadeiro', 'letivo'].includes(s);
}

// yyyy-mm-dd ou dd/mm/aaaa → yyyy-mm-dd (ou null).
function parseData(v) {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const normHdr = (s) => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');

async function importar(e) {
  e.preventDefault();
  const msg = document.getElementById('imp-msg'); msg.className = 'auth-msg';
  const txt = document.getElementById('imp-txt').value.trim();
  if (!txt) return falha(msg, 'Cole os dados a importar.');

  const linhas = txt.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return falha(msg, 'Inclua o cabeçalho e ao menos uma linha.');
  // Separador: TAB (TSV), senão ";" e por fim ","  (CSV).
  const usaSep = linhas[0].includes('\t') ? '\t' : (linhas[0].includes(';') ? ';' : ',');
  const hdr = linhas[0].split(usaSep).map(normHdr);
  const col = (nome) => hdr.indexOf(nome);
  const iData = col('data');
  if (iData < 0) return falha(msg, 'Cabeçalho sem a coluna "data".');
  const iLetivo = col('letivo'), iTipo = col('tipo'), iEvento = col('evento');
  const iBExt = hdr.findIndex(h => h.includes('extraclasse'));
  const iBAfa = hdr.findIndex(h => h.includes('afastamento'));
  const iObs = col('obs');

  const rows = [], erros = [];
  for (let i = 1; i < linhas.length; i++) {
    const c = linhas[i].split(usaSep);
    const data = parseData(c[iData]);
    if (!data) { erros.push(i + 1); continue; }
    rows.push({
      data,
      letivo: iLetivo >= 0 ? parseBool(c[iLetivo], true) : true,
      tipo: iTipo >= 0 ? (c[iTipo] || '').trim() || null : null,
      evento: iEvento >= 0 ? (c[iEvento] || '').trim() || null : null,
      bloqueia_extraclasse: iBExt >= 0 ? parseBool(c[iBExt]) : false,
      bloqueia_afastamento: iBAfa >= 0 ? parseBool(c[iBAfa]) : false,
      obs: iObs >= 0 ? (c[iObs] || '').trim() || null : null,
    });
  }
  if (!rows.length) return falha(msg, 'Nenhuma linha com data válida.');

  const btn = document.getElementById('imp-save'); btn.disabled = true; btn.textContent = 'Importando…';
  try {
    const n = await upsertDias(rows);
    ok(msg, `${n} dia(s) importado(s)${erros.length ? ` · ${erros.length} linha(s) ignorada(s)` : ''}.`);
    await carregar();
    setTimeout(fecharDrawer, 1200);
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = 'Importar';
  }
}
