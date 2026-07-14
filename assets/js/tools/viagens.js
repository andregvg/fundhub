// ============================================================
// FundHub — viagens.js  (Programação de Viagens)
// Agrupa as solicitações CONFIRMADAS de um dia no formato enviado à
// empresa de transporte (origem escola → destino, horários, alunos,
// veículo, contato). Imprimível. Substitui o preenchimento manual.
// ============================================================
import { getViagensDoDia } from '../data/solicitacoes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hojeISO = () => new Date().toLocaleDateString('sv-SE');
const PERIODOS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

let dataSel = hojeISO();

export async function renderViagens(app) {
  app.innerHTML = `
    <div class="page-head no-print">
      <h1>Programação de Viagens</h1>
      <p>Viagens confirmadas do dia, prontas para envio à empresa de transporte.</p>
    </div>
    <div class="toolbar no-print">
      <label class="search" style="flex:0 0 auto">📅
        <input id="pv-data" type="date" value="${dataSel}" />
      </label>
      <span class="count" id="pv-count"></span>
      <button id="pv-print" class="btn-primary">🖨 Imprimir</button>
    </div>
    <div id="pv-body"><div class="loading">Carregando…</div></div>`;

  document.getElementById('pv-data').addEventListener('change', e => { dataSel = e.target.value; load(); });
  document.getElementById('pv-print').addEventListener('click', () => window.print());
  load();
}

async function load() {
  const body = document.getElementById('pv-body');
  let lista = [];
  try { lista = await getViagensDoDia(dataSel); }
  catch (err) { body.innerHTML = `<p class="count">Erro: ${esc(err.message || err)}</p>`; return; }

  document.getElementById('pv-count').textContent = `${lista.length} viagem(ns)`;
  if (!lista.length) {
    body.innerHTML = `<div class="empty"><div class="empty-ico">🚌</div>
      <h3>Sem viagens confirmadas</h3><p>Nenhuma solicitação confirmada para ${esc(fmt(dataSel))}.</p></div>`;
    return;
  }

  const porPeriodo = { manha: [], tarde: [], noite: [] };
  lista.forEach(s => (porPeriodo[s.periodo] || (porPeriodo[s.periodo] = [])).push(s));

  body.innerHTML = `
    <div class="viagens">
      <div class="pv-cabecalho">
        <h2>Programação de Viagens — Transporte Extraclasse</h2>
        <div>${esc(fmt(dataSel))} · ${lista.length} viagem(ns)</div>
      </div>
      ${['manha', 'tarde', 'noite'].filter(p => porPeriodo[p]?.length).map(p => `
        <h3 class="pv-periodo">${PERIODOS[p]}</h3>
        ${porPeriodo[p].map(linhaViagem).join('')}
      `).join('')}
    </div>`;
}

function linhaViagem(s) {
  const nome = s.atividade?.nome || s.atividade_livre || 'Atividade';
  const origem = [s.unidade?.nome, s.unidade?.endereco].filter(Boolean).join(' — ');
  const destino = [s.destino_nome || s.atividade?.local_nome, s.destino_endereco || s.atividade?.local_endereco]
    .filter(Boolean).join(' — ') || '—';
  const horarios = [s.horario_embarque, s.horario_retorno].filter(Boolean).join(' → ') || '—';
  return `<div class="pv-viagem">
    <div class="pv-tit">${esc(nome)}</div>
    <div class="pv-grid">
      <div><span class="pv-lbl">Origem</span>${esc(origem || '—')}</div>
      <div><span class="pv-lbl">Destino</span>${esc(destino)}</div>
      <div><span class="pv-lbl">Horários (ida → volta)</span>${esc(horarios)}</div>
      <div><span class="pv-lbl">Turma(s)</span>${esc(s.turmas || '—')}</div>
      <div><span class="pv-lbl">Alunos</span>${esc(s.qtd_alunos ?? '—')}</div>
      <div><span class="pv-lbl">Ônibus</span>${esc(s.qtd_onibus ?? '—')}${s.qtd_cadeirante > 0 ? ` · ♿ ${esc(s.qtd_cadeirante)}` : ''}</div>
      <div class="pv-wide"><span class="pv-lbl">Contato</span>${esc(s.contato_professor || '—')}</div>
    </div>
  </div>`;
}

function fmt(iso) { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}`; }
