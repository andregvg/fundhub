// ============================================================
// FundHub — modules/afastamentos/afastamentos.view.js
// Afastamentos de gestores/coordenadores/supervisores. Leitura para
// autorizados; CRUD para admin. Duas visões: Lista e Calendário (grade
// mensal com chips por dia, como o Apps Script afastamentos-gestores).
// ============================================================
import {
  TIPOS_AFASTAMENTO, CORES_AFASTAMENTO, MAPA_TIPOS_PLANILHA, diasAfastamento,
  getAfastamentos, criarAfastamento, atualizarAfastamento,
  cancelarAfastamento, reativarAfastamento, excluirAfastamento,
  confirmarAfastamento, sincronizarPlanilha,
} from './afastamentos.model.js';
import { getServidores } from '../servidores/servidores.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { getDiasBloqueiamAfastamento, getCalendarioMes } from '../calendario/calendario.model.js';
import { esc, norm, falha, ok } from '../../shared/dom.js';
import { MESES, DOW, hojeISO, fmtData } from '../../shared/format.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';

let perfil = null, servidores = [], unidades = [], lista = [];
let diasCal = {};                                // dia_calendario do mês visível
let modo = 'lista';                              // 'lista' | 'calendario'
// visao: vigentes | todos | importados | cancelados
let filtro = { visao: 'vigentes', tipo: '', q: '' };
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
      <button id="af-sync" class="mini-btn" hidden>⭱ Sincronizar planilha</button>
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
    const sy = document.getElementById('af-sync');
    sy.hidden = false;
    sy.addEventListener('click', abrirSync);
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
      <div class="cal-legenda">
        <span><i class="lg lg-nletivo"></i> não letivo</span>
        <span>🚫 não conceder afastamentos</span>
        <span><i class="lg lg-pend"></i> aguardando confirmação</span>
        <small>o texto do dia é o evento do calendário escolar</small>
      </div>
      ${chipsTipo()}`;
  } else {
    box.innerHTML = `
      <button class="chip" data-visao="vigentes">Vigentes</button>
      <button class="chip" data-visao="todos">Todos</button>
      <button class="chip" data-visao="importados">Importados</button>
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

async function moverMes(delta) {
  mes += delta;
  if (mes < 1) { mes = 12; ano--; } else if (mes > 12) { mes = 1; ano++; }
  const t = document.getElementById('af-titulo');
  if (t) t.textContent = `${MESES[mes - 1]} de ${ano}`;
  await carregarMesCalendario();
  pintar();
}

// Dias do calendário escolar do mês visível — é o que faz a grade de
// afastamentos mostrar o evento previsto (como no Apps Script, que junta
// a aba `dados` ao mês). Degrada em silêncio: sem calendário, só some o
// contexto, os chips continuam.
async function carregarMesCalendario() {
  diasCal = {};
  try {
    (await getCalendarioMes(ano, mes)).forEach(d => { diasCal[d.data] = d; });
  } catch (_) { /* segue sem o contexto do calendário */ }
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
      : filtro.visao === 'importados' ? { status: 'importado' }
      : {};
    lista = await getAfastamentos(opts);
    if (modo === 'calendario') await carregarMesCalendario();
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
  const importado = a.status === 'importado';
  const meta = [
    periodo,
    dias ? `${dias} dia${dias > 1 ? 's' : ''}` : '',
    unidade, a.processo ? `proc. ${a.processo}` : '',
    a.origem && a.origem !== 'manual' ? `via ${a.origem}` : '', a.motivo,
  ].filter(Boolean).map(esc).join(' · ');
  const acoes = perfil?.isAdmin ? `
    <div class="solic-acoes">
      ${cancelado ? `
        <button class="mini-btn ok" data-reativar="${a.id}" aria-label="Reativar">↺</button>
        <button class="mini-btn no" data-excluir="${a.id}" aria-label="Excluir definitivamente">🗑</button>`
      : `
        ${importado ? `<button class="mini-btn ok" data-confirmar="${a.id}" aria-label="Confirmar">✓</button>` : ''}
        <button class="mini-btn" data-edit="${a.id}" aria-label="Editar">✎</button>
        <button class="mini-btn no" data-cancelar="${a.id}" aria-label="Cancelar">✕</button>`}
    </div>` : '';
  return `<div class="solic ${cancelado ? 'inativo' : ''}" style="border-left:3px solid ${esc(cor)}">
    <div class="solic-main">
      <div class="di-top"><b>${esc(nome)}</b>
        <span class="tag" style="color:${esc(cor)}">${esc(a.tipo)}</span>
        ${cancelado ? '<span class="tag eja">Cancelado</span>' : ''}
        ${importado ? '<span class="tag bus">Aguardando confirmação</span>' : ''}</div>
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
      const pend = a.status === 'importado' ? ' pendente' : '';
      return `<span class="af-chip${perfil?.isAdmin ? ' clicavel' : ''}${pend}" style="background:${esc(cor)}" data-id="${a.id}"
        title="${esc(a.tipo)} — ${esc(a.servidor?.nome || '')}${a.status === 'importado' ? ' (aguardando confirmação)' : ''}">${esc(nome)}</span>`;
    }).join('');
    const mais = doDia.length > 4 ? `<span class="af-mais">+${doDia.length - 4}</span>` : '';

    // Contexto do calendário escolar no mesmo dia (evento previsto, dia não
    // letivo e o marcador de "não conceder afastamentos").
    const d = diasCal[iso];
    const cls = ['cal-cell'];
    if (iso === hoje) cls.push('hoje');
    if (d && d.letivo === false) cls.push('nletivo');
    if (d?.bloqueia_afastamento) cls.push('bloq');
    cells += `<div class="${cls.join(' ')}">
      <div class="cal-num">${dia}${d?.bloqueia_afastamento ? ' <span class="af-veto" title="Não conceder afastamentos">🚫</span>' : ''}</div>
      ${d?.evento ? `<div class="cal-ev" title="${esc(d.evento)}">${esc(d.evento)}</div>` : ''}
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
  box.querySelectorAll('[data-confirmar]').forEach(b =>
    b.addEventListener('click', () => confirmar(lista.find(a => a.id === b.dataset.confirmar))));
}

async function confirmar(a) {
  if (!a) return;
  try { await confirmarAfastamento(a.id); carregar(); }
  catch (err) { alert('Não foi possível confirmar: ' + (err.message || err)); }
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

// ── Sincronização com a planilha do Drive ────────────────────
// A aba "Lançamentos" (Apps Script afastamentos-gestores) segue sendo o
// ponto de lançamento — inclusive das respostas do formulário dos gestores.
// Aqui o FundHub ESPELHA aquela aba: cola-se o recorte com cabeçalho e o
// upsert é IDEMPOTENTE pela chave_externa (tipo|nome|início|criado_em, a
// mesma identidade que o Apps Script usa) — reimportar atualiza, não duplica.
//
// Por que colar e não buscar da planilha: buscar exigiria publicá-la na web
// (expondo dado pessoal de servidor, o que a regra de segurança proíbe) ou
// uma Edge Function com service account. Colar mantém o dado no caminho
// autenticado. O sync automático está no backlog C do HANDOFF.

const STATUS_PLANILHA = {
  ativo: 'ativo', importado: 'importado',
  excluido: 'cancelado', cancelado: 'cancelado',
};

function tipoDaPlanilha(v) {
  const raw = String(v || '').trim();
  if (TIPOS_AFASTAMENTO.includes(raw)) return raw;
  return MAPA_TIPOS_PLANILHA[norm(raw)] || 'Outro';
}

// "aaaa-mm-dd" ou "dd/mm/aaaa" → "aaaa-mm-dd"
function parseDataBR(v) {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

// "dd/mm/aaaa HH:MM" → ISO (ou null). Usado para espelhar criado_em.
function parseCarimbo(v) {
  const m = String(v || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).toISOString();
}

function abrirSync() {
  abrirDrawer(`
    ${drawerHead('Sincronizar com a planilha', 'Aba “Lançamentos” do Drive')}
    <div class="drawer-body">
      <p class="form-hint">
        Copie da aba <b>Lançamentos</b> (com a linha de cabeçalho) e cole abaixo.
        Reconhece as colunas do Apps Script: <code>tipo, data_inicio, data_fim,
        nome_completo, processo, escola, status, origem, observacoes, criado_em,
        criado_por, atualizado_por</code>.
        A sincronização é <b>idempotente</b> — colar o mesmo trecho de novo
        <b>atualiza</b> os registros, nunca duplica.
        Gestores que não estiverem cadastrados em <a href="#/gestores">Gestores</a>
        são <b>ignorados e listados</b> no fim.
      </p>
      <form id="sync-form" class="esc-form">
        <label>Dados da planilha
          <textarea id="sync-txt" rows="10" placeholder="tipo	data_inicio	data_fim	nome_completo	…"></textarea>
        </label>
        <div class="form-foot">
          <span id="sync-msg" class="auth-msg"></span>
          <button type="submit" id="sync-save">Sincronizar</button>
        </div>
      </form>
      <div id="sync-relatorio"></div>
    </div>`);
  document.getElementById('sync-form').addEventListener('submit', sincronizar);
}

async function sincronizar(e) {
  e.preventDefault();
  const msg = document.getElementById('sync-msg'); msg.className = 'auth-msg';
  const txt = document.getElementById('sync-txt').value.trim();
  if (!txt) return falha(msg, 'Cole os dados da planilha.');

  const linhas = txt.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return falha(msg, 'Inclua o cabeçalho e ao menos uma linha.');
  const sep = linhas[0].includes('\t') ? '\t' : (linhas[0].includes(';') ? ';' : ',');
  const hdr = linhas[0].split(sep).map(h => norm(h).replace(/\s+/g, '_'));
  const col = (n) => hdr.indexOf(n);
  const iTipo = col('tipo'), iIni = col('data_inicio'), iFim = col('data_fim');
  const iNome = col('nome_completo'), iProc = col('processo'), iEsc = col('escola');
  const iStatus = col('status'), iOrigem = col('origem'), iObs = col('observacoes');
  const iCriadoEm = col('criado_em'), iCriadoPor = col('criado_por'), iAtualPor = col('atualizado_por');
  if (iNome < 0 || iIni < 0) return falha(msg, 'Cabeçalho sem as colunas "nome_completo" e "data_inicio".');

  // Índices para casar gestor e escola por nome normalizado.
  const porServidor = new Map();
  servidores.forEach(s => {
    porServidor.set(norm(s.nome), s);
    if (s.apelido && !porServidor.has(norm(s.apelido))) porServidor.set(norm(s.apelido), s);
  });
  const porUnidade = new Map();
  unidades.forEach(u => {
    porUnidade.set(norm(u.nome), u);
    if (u.apelido && !porUnidade.has(norm(u.apelido))) porUnidade.set(norm(u.apelido), u);
  });

  const rows = [], semServidor = new Set(), invalidas = [];
  for (let i = 1; i < linhas.length; i++) {
    const c = linhas[i].split(sep);
    const nome = String(c[iNome] || '').trim();
    const inicio = parseDataBR(c[iIni]);
    if (!nome || !inicio) { invalidas.push(i + 1); continue; }

    const serv = porServidor.get(norm(nome));
    if (!serv) { semServidor.add(nome); continue; }

    const tipoRaw = iTipo >= 0 ? String(c[iTipo] || '').trim() : '';
    const criadoEmRaw = iCriadoEm >= 0 ? String(c[iCriadoEm] || '').trim() : '';
    const uni = iEsc >= 0 ? porUnidade.get(norm(String(c[iEsc] || '').trim())) : null;
    const statusRaw = iStatus >= 0 ? norm(String(c[iStatus] || '').trim()) : '';

    rows.push({
      // identidade NA PLANILHA (idêntica ao chaveRec do Apps Script)
      chave_externa: `${tipoRaw}|${nome}|${inicio}|${criadoEmRaw}`,
      servidor_id: serv.id,
      unidade_id: uni ? uni.id : null,
      tipo: tipoDaPlanilha(tipoRaw),
      inicio,
      fim: iFim >= 0 ? parseDataBR(c[iFim]) : null,
      processo: iProc >= 0 ? (String(c[iProc] || '').trim() || null) : null,
      motivo: iObs >= 0 ? (String(c[iObs] || '').trim() || null) : null,
      status: STATUS_PLANILHA[statusRaw] || 'ativo',
      origem: iOrigem >= 0 ? (norm(String(c[iOrigem] || '').trim()) || 'planilha') : 'planilha',
      // Sempre presente: o upsert em lote do PostgREST exige chaves uniformes
      // e criado_em é NOT NULL. (criado_em/atualizado_em são "ruído" para a
      // auditoria — ver 011 — então re-sincronizar não polui o log.)
      criado_em: parseCarimbo(criadoEmRaw) || new Date().toISOString(),
      criado_por: iCriadoPor >= 0 ? (String(c[iCriadoPor] || '').trim() || null) : null,
      atualizado_em: new Date().toISOString(),
      atualizado_por: iAtualPor >= 0 ? (String(c[iAtualPor] || '').trim() || null) : null,
    });
  }

  const rel = document.getElementById('sync-relatorio');
  if (!rows.length) {
    falha(msg, 'Nenhuma linha sincronizável.');
    rel.innerHTML = relatorioSync(0, invalidas, semServidor);
    return;
  }

  const btn = document.getElementById('sync-save'); btn.disabled = true; btn.textContent = 'Sincronizando…';
  try {
    const n = await sincronizarPlanilha(rows);
    ok(msg, `${n} registro(s) sincronizado(s).`);
    rel.innerHTML = relatorioSync(n, invalidas, semServidor);
    await carregar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
  } finally {
    btn.disabled = false; btn.textContent = 'Sincronizar';
  }
}

function relatorioSync(n, invalidas, semServidor) {
  const faltantes = [...semServidor];
  return `
    <hr class="sep" />
    <div class="field"><div class="lbl">Resultado</div>
      <div class="val">${n} sincronizado(s)${invalidas.length ? ` · ${invalidas.length} linha(s) inválida(s)` : ''}${faltantes.length ? ` · ${faltantes.length} sem cadastro` : ''}</div>
    </div>
    ${faltantes.length ? `
      <div class="field">
        <div class="lbl">Gestores não cadastrados (ignorados)</div>
        <div class="val">
          <p class="form-hint">Cadastre em <a href="#/gestores">Gestores &amp; Coordenadores</a> e sincronize de novo — os registros entram sem duplicar.</p>
          <ul class="af-faltantes">${faltantes.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>
      </div>` : ''}`;
}
