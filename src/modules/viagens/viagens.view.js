// ============================================================
// FundHub - modules/viagens/viagens.view.js
// Agrupa as solicitações CONFIRMADAS de um dia no formato enviado à
// empresa de transporte (origem escola → destino, horários, alunos,
// veículo, contato). Imprimível - ver viagens.css § @media print.
//
// Não tem model próprio: lê do SATE, que é o dono das solicitações.
// ============================================================
import { getViagensDoDia, PERIODOS } from '../sate/sate.model.js';
import { tituloDoPedido, responsavelDoPedido } from '../sate/regras.model.js';
import { enderecoCompleto } from '../locais/locais.model.js';
import { esc, vazio } from '../../shared/dom.js';
import { hojeISO, fmtData } from '../../shared/format.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { ico } from '../../shared/ui/icones.js';

let dataSel = hojeISO();

export async function render(app) {
  app.innerHTML = `
    <div class="page-head no-print">
      <h1>Programação de Viagens</h1>
      <p>Viagens confirmadas do dia, prontas para envio à empresa de transporte.</p>
    </div>
    <div class="toolbar no-print">
      <input id="pv-data" class="campo-solto" type="date" value="${esc(dataSel)}" aria-label="Data" />
      <span class="count" id="pv-count"></span>
      <button id="pv-print" class="btn-primary">${ico('imprimir')} Imprimir</button>
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
    body.innerHTML = emptyState(ico('onibus', { tam: 32 }), 'Sem viagens confirmadas',
      `Nenhuma solicitação confirmada para ${esc(fmtData(dataSel))}.`);
    return;
  }

  const porPeriodo = { manha: [], tarde: [], noite: [], integral: [] };
  lista.forEach(s => (porPeriodo[s.periodo] ||= []).push(s));
  // Ordem do dia, não a de inserção de PERIODOS: a manhã "integral" some
  // no meio do dia dela, então entra logo depois da manhã comum.
  const ORDEM_PERIODOS = ['manha', 'integral', 'tarde', 'noite'];

  body.innerHTML = `
    <div class="viagens">
      <div class="pv-cabecalho">
        <h2>Programação de Viagens - Transporte Extraclasse</h2>
        <div>${esc(fmtData(dataSel))} · ${lista.length} viagem(ns)</div>
      </div>
      ${ORDEM_PERIODOS.filter(p => porPeriodo[p]?.length).map(p => `
        <h3 class="pv-periodo">${PERIODOS[p]}</h3>
        ${porPeriodo[p].map(linha).join('')}
      `).join('')}
    </div>`;
}

// Endereço do destino: as três partes (spec 2026-09-27, D3), com o
// endereço da atividade como último recurso para pedidos antigos.
const enderecoDestino = (s) => enderecoCompleto({ endereco: s.destino_endereco, numero: s.destino_numero, bairro: s.destino_bairro })
  || s.atividade?.local_endereco || '';

function linha(s) {
  const nome = tituloDoPedido(s);
  const origem = [s.unidade?.nome, s.unidade?.endereco].filter(Boolean).join(' - ');
  const destino = [s.destino_nome || s.atividade?.local_nome, enderecoDestino(s)].filter(Boolean).join(' - ');
  const horarios = [s.horario_embarque, s.horario_retorno].filter(Boolean).join(' → ');
  const responsavel = responsavelDoPedido(s);
  return `<div class="pv-viagem">
    <div class="pv-tit">${esc(nome)}</div>
    <div class="pv-grid">
      <div><span class="pv-lbl">Origem</span>${origem ? esc(origem) : vazio('sem origem informada')}</div>
      <div><span class="pv-lbl">Destino</span>${destino ? esc(destino) : vazio('sem destino informado')}</div>
      <div><span class="pv-lbl">Horários (ida → volta)</span>${horarios ? esc(horarios) : vazio('sem horário informado')}</div>
      <div><span class="pv-lbl">Turma(s)</span>${s.turmas ? esc(s.turmas) : vazio('sem turma informada')}</div>
      <div><span class="pv-lbl">Alunos</span>${s.qtd_alunos != null ? esc(s.qtd_alunos) : vazio('sem número de alunos')}</div>
      <div><span class="pv-lbl">Ônibus</span>${s.qtd_onibus != null ? esc(s.qtd_onibus) : vazio('sem número de ônibus')}${s.qtd_cadeirante > 0 ? ` · ${ico('acessibilidade', { tam: 12 })} ${esc(s.qtd_cadeirante)}` : ''}</div>
      <div class="pv-wide"><span class="pv-lbl">Responsável</span>${responsavel ? esc(responsavel) : vazio('sem responsável informado')}</div>
    </div>
  </div>`;
}
