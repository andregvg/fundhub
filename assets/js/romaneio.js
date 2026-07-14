// ============================================================
// FundHub — romaneio.js  (Romaneio diário de transporte)
// Agrupa as solicitações CONFIRMADAS de um dia no formato enviado à
// empresa de ônibus (origem escola → destino, horários, alunos,
// veículo, contato). Imprimível. Substitui o preenchimento manual.
// ============================================================
import { getRomaneio } from './data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hojeISO = () => new Date().toLocaleDateString('sv-SE');
const PERIODOS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

let dataSel = hojeISO();

export async function renderRomaneio(app) {
  app.innerHTML = `
    <div class="page-head no-print">
      <h1>Romaneio diário</h1>
      <p>Viagens confirmadas do dia, prontas para envio à empresa de transporte.</p>
    </div>
    <div class="toolbar no-print">
      <label class="search" style="flex:0 0 auto">📅
        <input id="rm-data" type="date" value="${dataSel}" />
      </label>
      <span class="count" id="rm-count"></span>
      <button id="rm-print" class="btn-primary">🖨 Imprimir</button>
    </div>
    <div id="rm-body"><div class="loading">Carregando…</div></div>`;

  document.getElementById('rm-data').addEventListener('change', e => { dataSel = e.target.value; load(); });
  document.getElementById('rm-print').addEventListener('click', () => window.print());
  load();
}

async function load() {
  const body = document.getElementById('rm-body');
  let lista = [];
  try { lista = await getRomaneio(dataSel); }
  catch (err) { body.innerHTML = `<p class="count">Erro: ${esc(err.message || err)}</p>`; return; }

  document.getElementById('rm-count').textContent = `${lista.length} viagem(ns)`;
  if (!lista.length) {
    body.innerHTML = `<div class="empty"><div class="empty-ico">🚌</div>
      <h3>Sem viagens confirmadas</h3><p>Nenhuma solicitação confirmada para ${esc(fmt(dataSel))}.</p></div>`;
    return;
  }

  const porPeriodo = { manha: [], tarde: [], noite: [] };
  lista.forEach(s => (porPeriodo[s.periodo] || (porPeriodo[s.periodo] = [])).push(s));

  body.innerHTML = `
    <div class="romaneio">
      <div class="rm-cabecalho">
        <h2>Romaneio de Transporte Extraclasse</h2>
        <div>${esc(fmt(dataSel))} · ${lista.length} viagem(ns)</div>
      </div>
      ${['manha', 'tarde', 'noite'].filter(p => porPeriodo[p]?.length).map(p => `
        <h3 class="rm-periodo">${PERIODOS[p]}</h3>
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
  return `<div class="rm-viagem">
    <div class="rm-tit">${esc(nome)}</div>
    <div class="rm-grid">
      <div><span class="rm-lbl">Origem</span>${esc(origem || '—')}</div>
      <div><span class="rm-lbl">Destino</span>${esc(destino)}</div>
      <div><span class="rm-lbl">Horários (ida → volta)</span>${esc(horarios)}</div>
      <div><span class="rm-lbl">Turma(s)</span>${esc(s.turmas || '—')}</div>
      <div><span class="rm-lbl">Alunos</span>${esc(s.qtd_alunos ?? '—')}</div>
      <div><span class="rm-lbl">Ônibus</span>${esc(s.qtd_onibus ?? '—')}${s.qtd_cadeirante > 0 ? ` · ♿ ${esc(s.qtd_cadeirante)}` : ''}</div>
      <div class="rm-wide"><span class="rm-lbl">Contato</span>${esc(s.contato_professor || '—')}</div>
    </div>
  </div>`;
}

function fmt(iso) { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}`; }
