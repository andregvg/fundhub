// ============================================================
// FundHub — modules/viagens/viagens.view.js
// Agrupa as solicitações CONFIRMADAS de um dia no formato enviado à
// empresa de transporte (origem escola → destino, horários, alunos,
// veículo, contato). Imprimível — ver viagens.css § @media print.
//
// Não tem model próprio: lê do SATE, que é o dono das solicitações.
// ============================================================
import { getViagensDoDia, PERIODOS } from '../sate/sate.model.js';
import { esc } from '../../shared/dom.js';
import { hojeISO, fmtData } from '../../shared/format.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';

let dataSel = hojeISO();

export async function render(app) {
  app.innerHTML = `
    <div class="page-head no-print">
      <h1>Programação de Viagens</h1>
      <p>Viagens confirmadas do dia, prontas para envio à empresa de transporte.</p>
    </div>
    <div class="toolbar no-print">
      <label class="search compacta">📅
        <input id="pv-data" type="date" value="${dataSel}" />
      </label>
      <span class="count" id="pv-count"></span>
      <button id="pv-print" class="btn-primary">🖨 Imprimir</button>
    </div>
    <div id="pv-body">${loading()}</div>`;

  document.getElementById('pv-data').addEventListener('change', e => { dataSel = e.target.value; carregar(); });
  document.getElementById('pv-print').addEventListener('click', () => window.print());
  carregar();
}

async function carregar() {
  const body = document.getElementById('pv-body');
  let lista = [];
  try { lista = await getViagensDoDia(dataSel); }
  catch (err) { body.innerHTML = erroBox(err); return; }

  document.getElementById('pv-count').textContent = `${lista.length} viagem(ns)`;

  if (!lista.length) {
    body.innerHTML = emptyState('🚌', 'Sem viagens confirmadas',
      `Nenhuma solicitação confirmada para ${esc(fmtData(dataSel))}.`);
    return;
  }

  const porPeriodo = { manha: [], tarde: [], noite: [] };
  lista.forEach(s => (porPeriodo[s.periodo] ||= []).push(s));

  body.innerHTML = `
    <div class="viagens">
      <div class="pv-cabecalho">
        <h2>Programação de Viagens — Transporte Extraclasse</h2>
        <div>${esc(fmtData(dataSel))} · ${lista.length} viagem(ns)</div>
      </div>
      ${Object.keys(PERIODOS).filter(p => porPeriodo[p]?.length).map(p => `
        <h3 class="pv-periodo">${PERIODOS[p]}</h3>
        ${porPeriodo[p].map(linha).join('')}
      `).join('')}
    </div>`;
}

function linha(s) {
  const nome = s.atividade?.nome || s.atividade_livre || 'Atividade';
  const origem = [s.unidade?.nome, s.unidade?.endereco].filter(Boolean).join(' — ');
  const destino = [s.destino_nome || s.atividade?.local_nome,
    s.destino_endereco || s.atividade?.local_endereco].filter(Boolean).join(' — ') || '—';
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
