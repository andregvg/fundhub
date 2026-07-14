// ============================================================
// FundHub — sate.js  (SATE · Transporte extraclasse)
// Abas: Solicitações (lista + validação) · Nova solicitação · Catálogo.
// A escola solicita o ônibus direto aqui; a SME (admin) valida.
// ============================================================
import {
  getAtividades, getUnidades, getPerfilAtual,
  listSolicitacoes, criarSolicitacao, atualizarStatusSolicitacao,
} from './data.js';

const CAP_ONIBUS = 44;          // capacidade padrão por ônibus
const ANTECEDENCIA_MIN = 5;     // dias mínimos para a escola (admin não tem limite)
const PERIODOS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const STATUS = { solicitado: 'Solicitado', em_analise: 'Em análise', aguardando_transporte_adaptado: 'Aguardando adaptado', confirmado: 'Confirmado', negado: 'Negado', cancelado: 'Cancelado' };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hojeISO = () => new Date().toLocaleDateString('sv-SE');
const fmtData = (iso) => { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}`; };

let perfil = null, atividades = [], unidades = [], aba = 'solicitacoes';

export async function renderSate(app) {
  app.innerHTML = `
    <div class="page-head">
      <h1>SATE · Transporte extraclasse</h1>
      <p>Solicite o transporte para atividades extraclasse e acompanhe a validação da SME.</p>
    </div>
    <div class="tabbar">
      <button class="tab" data-aba="solicitacoes">Solicitações</button>
      <button class="tab" data-aba="nova">Nova solicitação</button>
      <button class="tab" data-aba="catalogo">Catálogo</button>
    </div>
    <div id="sate-body"><div class="loading">Carregando…</div></div>`;

  app.querySelectorAll('.tab').forEach(b =>
    b.addEventListener('click', () => { aba = b.dataset.aba; paintTabs(); renderAba(); }));

  try {
    [perfil, atividades, unidades] = await Promise.all([
      getPerfilAtual(), getAtividades().catch(() => []), getUnidades().catch(() => []),
    ]);
  } catch (_) {}
  paintTabs();
  renderAba();
}

function paintTabs() {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.aba === aba));
}

function renderAba() {
  if (aba === 'catalogo') return renderCatalogo();
  if (aba === 'nova') return renderNova();
  return renderSolicitacoes();
}

// ── Catálogo ─────────────────────────────────────────────────
function renderCatalogo() {
  const box = document.getElementById('sate-body');
  if (!atividades.length) {
    box.innerHTML = emptyBox('🚌', 'Catálogo vazio',
      'Rode <code>004_sate.sql</code> e <code>_private/seed_atividades.sql</code> no SQL Editor.');
    return;
  }
  box.innerHTML = `<div class="cards">${atividades.map(cardAtividade).join('')}</div>`;
}

function cardAtividade(a) {
  const cor = a.cor || 'var(--brand)';
  const tags = [
    a.usa_onibus ? `<span class="tag bus">🚌 Usa ônibus</span>` : `<span class="tag">🏫 Na escola</span>`,
    a.gerida_sme ? `<span class="tag">Gerida pela SME</span>` : `<span class="tag">Definida pela escola</span>`,
    a.precisa_declaracao ? `<span class="tag eja">📄 Declaração</span>` : '',
    a.min_participantes ? `<span class="tag">Mín. ${a.min_participantes}</span>` : '',
  ].join('');
  return `<article class="card atv-card" style="border-top:3px solid ${esc(cor)}">
    <div class="card-top"><h3>${esc(a.nome)}</h3></div>
    ${a.descricao ? `<div class="addr">${esc(a.descricao)}</div>` : ''}
    ${a.publico_alvo ? `<div class="atv-field"><b>Público-alvo:</b> ${esc(a.publico_alvo)}</div>` : ''}
    ${a.lanche ? `<div class="atv-field"><b>Lanche:</b> ${esc(a.lanche)}</div>` : ''}
    <div class="tags">${tags}</div>
  </article>`;
}

// ── Solicitações (lista + validação) ─────────────────────────
let filtroStatus = '';
async function renderSolicitacoes() {
  const box = document.getElementById('sate-body');
  box.innerHTML = `
    <div class="filters" id="st-filtros">
      ${['', 'solicitado', 'em_analise', 'confirmado', 'negado'].map(s =>
        `<button class="chip" data-st="${s}">${s ? STATUS[s] : 'Todas'}</button>`).join('')}
    </div>
    <div id="st-lista"><div class="loading">Carregando…</div></div>`;
  box.querySelectorAll('#st-filtros .chip').forEach(c => {
    c.classList.toggle('on', c.dataset.st === filtroStatus);
    c.addEventListener('click', () => { filtroStatus = c.dataset.st; renderSolicitacoes(); });
  });

  let lista = [];
  try { lista = await listSolicitacoes(filtroStatus ? { status: filtroStatus } : {}); }
  catch (err) {
    document.getElementById('st-lista').innerHTML = `<p class="count">Erro: ${esc(err.message || err)}</p>`;
    return;
  }
  const el = document.getElementById('st-lista');
  if (!lista.length) { el.innerHTML = emptyBox('📭', 'Nenhuma solicitação', 'Crie uma em “Nova solicitação”.'); return; }
  el.innerHTML = lista.map(itemSolic).join('');
  el.querySelectorAll('[data-acao]').forEach(b =>
    b.addEventListener('click', () => mudarStatus(b.dataset.id, b.dataset.acao)));
}

function itemSolic(s) {
  const cor = s.atividade?.cor || 'var(--brand)';
  const escola = s.unidade?.apelido || s.unidade?.nome || '—';
  const acoes = (perfil?.isAdmin && s.status !== 'cancelado') ? `
    <div class="solic-acoes">
      ${s.status !== 'em_analise' ? btn(s.id, 'em_analise', 'Em análise') : ''}
      ${s.qtd_cadeirante > 0 && s.status !== 'aguardando_transporte_adaptado' ? btn(s.id, 'aguardando_transporte_adaptado', '♿ Adaptado') : ''}
      ${s.status !== 'confirmado' ? btn(s.id, 'confirmado', 'Confirmar', 'ok') : ''}
      ${s.status !== 'negado' ? btn(s.id, 'negado', 'Negar', 'no') : ''}
    </div>` : '';
  const nome = s.atividade?.nome || s.atividade_livre || 'Atividade';
  const livre = !s.atividade?.nome && s.atividade_livre;
  const horarios = [s.horario_embarque, s.horario_retorno].filter(Boolean).join(' → ');
  return `<div class="solic" style="border-left:3px solid ${esc(cor)}">
    <div class="solic-main">
      <div class="di-top">
        <b>${esc(nome)}</b>
        ${livre ? '<span class="tag">Organizada pela escola</span>' : ''}
        <span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>
      </div>
      <div class="di-meta">${esc(escola)} · ${esc(fmtData(s.data))} · ${esc(PERIODOS[s.periodo] || s.periodo || '')}
        ${s.turmas ? '· ' + esc(s.turmas) : ''}
        ${s.qtd_alunos ? '· ' + esc(s.qtd_alunos) + ' alunos' : ''}
        ${s.qtd_onibus ? '· ' + esc(s.qtd_onibus) + ' ônibus' : ''}
        ${s.qtd_cadeirante > 0 ? '· ♿ ' + esc(s.qtd_cadeirante) : ''}</div>
      ${s.destino_nome ? `<div class="di-meta">Destino: ${esc(s.destino_nome)}${s.destino_endereco ? ' — ' + esc(s.destino_endereco) : ''}</div>` : ''}
      ${horarios ? `<div class="di-meta">Horário: ${esc(horarios)}</div>` : ''}
      ${s.contato_professor ? `<div class="di-meta">Contato: ${esc(s.contato_professor)}</div>` : ''}
    </div>
    ${acoes}
  </div>`;
}
const btn = (id, acao, txt, kind = '') =>
  `<button class="mini-btn ${kind}" data-id="${id}" data-acao="${acao}">${txt}</button>`;

async function mudarStatus(id, status) {
  try { await atualizarStatusSolicitacao(id, status); renderSolicitacoes(); }
  catch (err) { alert('Não foi possível atualizar: ' + (err.message || err)); }
}

// ── Nova solicitação ─────────────────────────────────────────
let modoNova = 'catalogo'; // 'catalogo' | 'livre'
function renderNova() {
  const box = document.getElementById('sate-body');
  const minData = perfil?.isAdmin ? hojeISO() : addDias(hojeISO(), ANTECEDENCIA_MIN);
  const optsAtiv = atividades.map(a => `<option value="${a.id}">${esc(a.nome)}</option>`).join('');
  const optsEsc = [...unidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map(u => `<option value="${u.id || u.numero}">${esc(u.apelido || u.nome)}</option>`).join('');

  box.innerHTML = `
    <form id="nova-form" class="sate-form">
      <div class="modo-toggle">
        <label class="inline"><input type="radio" name="modo" value="catalogo" ${modoNova === 'catalogo' ? 'checked' : ''}/> Atividade do catálogo</label>
        <label class="inline"><input type="radio" name="modo" value="livre" ${modoNova === 'livre' ? 'checked' : ''}/> Outra atividade (organizada pela escola)</label>
      </div>
      <div class="form-grid">
        <label class="m-catalogo">Atividade
          <select id="f-ativ"><option value="">Selecione…</option>${optsAtiv}</select></label>
        <label class="m-livre col-2">Nome da atividade / evento
          <input id="f-ativ-livre" type="text" placeholder="Ex.: Visita ao Teatro Pedro II" /></label>
        <label class="m-livre">Destino (local)
          <input id="f-dest-nome" type="text" placeholder="Ex.: Teatro Pedro II" /></label>
        <label class="m-livre">Endereço do destino
          <input id="f-dest-end" type="text" placeholder="Rua, nº - bairro" /></label>

        <label>Escola
          <select id="f-esc" required><option value="">Selecione…</option>${optsEsc}</select></label>
        <label>Data
          <input id="f-data" type="date" min="${minData}" required /></label>
        <label>Período
          <select id="f-per" required>
            <option value="">Selecione…</option>
            <option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option>
          </select></label>
        <label>Turma(s)
          <input id="f-turmas" type="text" placeholder="Ex.: 5º A, 5º B" /></label>
        <label>Nº de alunos
          <input id="f-alunos" type="number" min="1" required /></label>
        <label>Nº de cadeirantes (transporte adaptado)
          <input id="f-cadeira" type="number" min="0" value="0" /></label>
        <label>Horário de embarque
          <input id="f-emb" type="time" /></label>
        <label>Horário de retorno
          <input id="f-ret" type="time" /></label>
        <label class="col-2">Contato do professor(a)
          <input id="f-contato" type="text" placeholder="Nome e telefone" /></label>
        <label class="col-2">Observação
          <textarea id="f-obs" rows="2"></textarea></label>
      </div>
      <div class="form-foot">
        <span id="f-hint" class="form-hint"></span>
        <button type="submit" id="f-submit">Enviar solicitação</button>
      </div>
      <p id="f-msg" class="auth-msg"></p>
    </form>`;

  const form = document.getElementById('nova-form');
  const aplicarModo = () => {
    form.classList.toggle('is-livre', modoNova === 'livre');
    form.classList.toggle('is-catalogo', modoNova === 'catalogo');
  };
  form.querySelectorAll('input[name="modo"]').forEach(r =>
    r.addEventListener('change', () => { modoNova = r.value; aplicarModo(); atualizaHint(); }));
  aplicarModo();

  const ativSel = document.getElementById('f-ativ');
  const alunos = document.getElementById('f-alunos');
  const hint = document.getElementById('f-hint');
  function atualizaHint() {
    const n = parseInt(alunos.value, 10);
    if (!(n > 0)) { hint.textContent = ''; return; }
    let usaOnibus = true;
    if (modoNova === 'catalogo') {
      const a = atividades.find(x => x.id === ativSel.value);
      usaOnibus = a ? a.usa_onibus : true;
    }
    hint.textContent = usaOnibus ? `≈ ${Math.ceil(n / CAP_ONIBUS)} ônibus (${CAP_ONIBUS} lugares)` : 'Sem ônibus';
  }
  ativSel.addEventListener('change', atualizaHint);
  alunos.addEventListener('input', atualizaHint);

  form.addEventListener('submit', enviarNova);
}

async function enviarNova(e) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const val = (id) => document.getElementById(id).value.trim();
  const escId = document.getElementById('f-esc').value;
  const data = document.getElementById('f-data').value;
  const periodo = document.getElementById('f-per').value;
  const qtd = parseInt(document.getElementById('f-alunos').value, 10);
  const cadeira = parseInt(document.getElementById('f-cadeira').value, 10) || 0;

  let a = null, atividadeLivre = null, usaOnibus = true;
  if (modoNova === 'catalogo') {
    a = atividades.find(x => x.id === document.getElementById('f-ativ').value);
    if (!a) return fail(msg, 'Selecione uma atividade do catálogo (ou use “Outra atividade”).');
    usaOnibus = a.usa_onibus;
  } else {
    atividadeLivre = val('f-ativ-livre');
    if (!atividadeLivre) return fail(msg, 'Informe o nome da atividade organizada pela escola.');
  }
  if (!escId || !data || !periodo || !qtd) {
    return fail(msg, 'Preencha escola, data, período e nº de alunos.');
  }
  if (data < hojeISO()) return fail(msg, 'A data não pode ser no passado.');
  if (!perfil?.isAdmin && data < addDias(hojeISO(), ANTECEDENCIA_MIN)) {
    return fail(msg, `A escola deve solicitar com no mínimo ${ANTECEDENCIA_MIN} dias de antecedência.`);
  }
  if (a?.min_participantes && qtd < a.min_participantes) {
    return fail(msg, `Esta atividade exige no mínimo ${a.min_participantes} participantes.`);
  }

  const payload = {
    atividade_id: a ? a.id : null,
    atividade_livre: atividadeLivre,
    unidade_id: isUuid(escId) ? escId : null,
    data, periodo, qtd_alunos: qtd, qtd_cadeirante: cadeira,
    qtd_onibus: usaOnibus ? Math.ceil(qtd / CAP_ONIBUS) : 0,
    turmas: val('f-turmas') || null,
    destino_nome: val('f-dest-nome') || null,
    destino_endereco: val('f-dest-end') || null,
    horario_embarque: val('f-emb') || null,
    horario_retorno: val('f-ret') || null,
    contato_professor: val('f-contato') || null,
    observacao: val('f-obs') || null,
  };
  const btn = document.getElementById('f-submit'); btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    await criarSolicitacao(payload);
    aba = 'solicitacoes'; paintTabs(); renderAba();
  } catch (err) {
    fail(msg, 'Não foi possível enviar: ' + (err.message || err));
    btn.disabled = false; btn.textContent = 'Enviar solicitação';
  }
}

// ── utils ────────────────────────────────────────────────────
function fail(el, txt) { el.classList.add('err'); el.textContent = txt; }
function addDias(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); }
function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(s)); }
function emptyBox(ico, titulo, msg) {
  return `<div class="cards"><div class="empty"><div class="empty-ico">${ico}</div>
    <h3>${titulo}</h3><p>${msg}</p></div></div>`;
}
