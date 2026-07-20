// ============================================================
// FundHub — sate/views/solicitacoes.js  (aba Solicitações)
// Lista as solicitações e, para admin, os botões de validação.
// Ao CONFIRMAR, confere o saldo de frota do dia/período antes.
// ============================================================
import {
  listSolicitacoes, atualizarStatusSolicitacao, getOfertaDia, getUsoDia,
  STATUS, PERIODOS, STATUS_RESERVA,
} from '../sate.model.js';
import { esc } from '../../../shared/dom.js';
import { fmtData } from '../../../shared/format.js';
import { loading, emptyState, erroBox } from '../../../shared/ui/feedback.js';
import { criarFiltroSegmento, indexarUnidades } from '../../../shared/ui/filtro-segmento.js';

const FILTROS = ['', 'solicitado', 'em_analise', 'confirmado', 'negado'];

let filtroStatus = '';
let lista = [];
let ctx = null;
let seg = null, idxUnidades = {};

export async function render(contexto) {
  ctx = contexto;
  const box = ctx.box();
  box.innerHTML = `
    <div id="st-seg" class="toolbar-linha"></div>
    <div class="filters" id="st-filtros">
      ${FILTROS.map(s => `<button class="chip ${s === filtroStatus ? 'on' : ''}" data-st="${s}">${s ? STATUS[s] : 'Todas'}</button>`).join('')}
    </div>
    <div id="st-lista">${loading()}</div>`;

  box.querySelector('#st-filtros').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    filtroStatus = c.dataset.st;
    render(ctx);
  });

  const el = document.getElementById('st-lista');
  // As unidades já vêm da casca do SATE (sate.view.js) — não vale uma
  // segunda ida ao banco só para saber o segmento de cada escola.
  idxUnidades = indexarUnidades(ctx.unidades || []);
  try { lista = await listSolicitacoes(filtroStatus ? { status: filtroStatus } : {}); }
  catch (err) { el.innerHTML = erroBox(err); return; }

  // `render` remonta a aba inteira a cada troca de filtro, então o
  // componente é recriado — a memória de sessão preserva a escolha.
  seg = criarFiltroSegmento(document.getElementById('st-seg'), {
    perfil: ctx.perfil, chaveMemoria: 'fundhub:seg:sate', onChange: pintar,
  });

  pintar();
}

function noSegmento(s) {
  if (!seg || !seg.selecionados().length) return true;
  return !s.unidade_id || seg.combina(idxUnidades[s.unidade_id]);
}

function pintar() {
  const el = document.getElementById('st-lista');
  if (!el) return;
  const vis = lista.filter(noSegmento);

  if (!lista.length) {
    el.innerHTML = emptyState('📭', 'Nenhuma solicitação', 'Crie uma na aba “Nova solicitação”.');
    return;
  }
  el.innerHTML = vis.map(item).join('')
    || emptyState('🔎', 'Nenhuma solicitação neste segmento', 'Ajuste o filtro de segmento acima.');
  el.querySelectorAll('[data-acao]').forEach(b =>
    b.addEventListener('click', () => mudarStatus(b.dataset.id, b.dataset.acao)));
}

const botao = (id, acao, txt, kind = '') =>
  `<button class="mini-btn ${kind}" data-id="${id}" data-acao="${acao}">${txt}</button>`;

function item(s) {
  const cor = s.atividade?.cor || 'var(--brand)';
  const escola = s.unidade?.apelido || s.unidade?.nome || '—';
  const nome = s.atividade?.nome || s.atividade_livre || 'Atividade';
  const livre = !s.atividade?.nome && s.atividade_livre;
  const horarios = [s.horario_embarque, s.horario_retorno].filter(Boolean).join(' → ');

  const acoes = (ctx.perfil?.isAdmin && s.status !== 'cancelado') ? `
    <div class="solic-acoes">
      ${s.status !== 'em_analise' ? botao(s.id, 'em_analise', 'Em análise') : ''}
      ${s.qtd_cadeirante > 0 && s.status !== 'aguardando_transporte_adaptado' ? botao(s.id, 'aguardando_transporte_adaptado', '♿ Adaptado') : ''}
      ${s.status !== 'confirmado' ? botao(s.id, 'confirmado', 'Confirmar', 'ok') : ''}
      ${s.status !== 'negado' ? botao(s.id, 'negado', 'Negar', 'no') : ''}
    </div>` : '';

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

async function mudarStatus(id, status) {
  if (status === 'confirmado' && !(await frotaLibera(id))) return;
  try { await atualizarStatusSolicitacao(id, status); render(ctx); }
  catch (err) { alert('Não foi possível atualizar: ' + (err.message || err)); }
}

// Confere o saldo de ônibus do dia/período. Não bloqueia: avisa e deixa o
// admin decidir (pode haver ônibus extra contratado fora do sistema).
async function frotaLibera(id) {
  const s = lista.find(x => x.id === id);
  if (!s || !(s.qtd_onibus > 0)) return true;
  try {
    const [oferta, uso] = await Promise.all([getOfertaDia(s.data), getUsoDia(s.data)]);
    const cap = oferta[s.periodo] || 0;
    const jaReserva = STATUS_RESERVA.includes(s.status);
    const projetado = (uso[s.periodo] || 0) + (jaReserva ? 0 : s.qtd_onibus);
    if (cap === 0) {
      return confirm(`A oferta de ônibus não está definida para ${fmtData(s.data)} (${s.periodo}). Confirmar mesmo assim?`);
    }
    if (projetado > cap) {
      return confirm(`Frota insuficiente: oferta ${cap}, uso ficaria ${projetado} ônibus em ${fmtData(s.data)} (${s.periodo}). Confirmar mesmo assim?`);
    }
  } catch (_) { /* se a checagem falhar, segue o fluxo normal */ }
  return true;
}
