// ============================================================
// FundHub - modules/dashboard/dashboard.view.js
// Painel do dia. É o único módulo que compõe dados de VÁRIOS outros:
// lê os models de Escolas, SATE, Afastamentos e Calendário. Não tem
// model próprio - de propósito: o dashboard não é dono de nada.
// ============================================================
import { getUnidades } from '../escolas/escolas.model.js';
import { getAtividades } from '../sate/atividades.model.js';
import { getSolicitacoesDoDia, STATUS, PERIODOS } from '../sate/sate.model.js';
import { getAfastamentos } from '../afastamentos/afastamentos.model.js';
import { getDiaCalendario } from '../calendario/calendario.model.js';
import { getOcorrencias, CANAIS, STATUS as STATUS_OCOR, STATUS_TAG as TAG_OCOR } from '../ocorrencias/ocorrencias.model.js';
import { esc } from '../../shared/dom.js';
import { hojeISO, fmtExtenso, fmtData } from '../../shared/format.js';
import { loading, emptyState } from '../../shared/ui/feedback.js';
import { ico } from '../../shared/ui/icones.js';

export async function render(app) {
  const hoje = hojeISO();

  app.innerHTML = `
    <div class="page-head">
      <h1>Dashboard do dia</h1>
      <p class="capitalizar">${esc(fmtExtenso(hoje))}</p>
    </div>
    <div class="stat-row" id="stats"></div>
    <div class="dash-grid">
      <section class="panel">
        <h2>${ico('transporte', { tam: 16 })} Extraclasse hoje</h2>
        <div id="p-extraclasse">${loading()}</div>
      </section>
      <section class="panel">
        <h2>${ico('afastamento', { tam: 16 })} Afastamentos hoje</h2>
        <div id="p-afastamentos">${loading()}</div>
      </section>
      <section class="panel">
        <h2>${ico('calendario', { tam: 16 })} Calendário hoje</h2>
        <div id="p-calendario">${loading()}</div>
      </section>
      <section class="panel">
        <h2>${ico('ocorrencia', { tam: 16 })} Ocorrências de hoje</h2>
        <div id="p-ocorrencias">${loading()}</div>
      </section>
    </div>`;

  // Cada painel carrega e falha por conta própria: um erro num painel
  // não pode derrubar o resto do dashboard.
  painelStats();
  painelExtraclasse(hoje);
  painelAfastamentos(hoje);
  painelCalendario(hoje);
  painelOcorrencias(hoje);
}

async function painelOcorrencias(hoje) {
  const box = document.getElementById('p-ocorrencias');
  let lista;
  try { lista = await getOcorrencias({ de: hoje, ate: hoje }); }
  catch (err) { box.innerHTML = emptyState(ico('atencao', { tam: 32 }), 'Não foi possível carregar', esc(err.message || err)); return; }

  if (!lista.length) {
    box.innerHTML = emptyState(ico('ocorrencia', { tam: 32 }), 'Sem registros', 'Nenhum atendimento registrado hoje.');
    return;
  }
  box.innerHTML = lista.map(o => {
    const escola = o.unidade?.apelido || o.unidade?.nome;
    return `<div class="dash-item">
      <div class="di-top">
        <b>${esc(o.assunto)}</b>
        <span class="tag ${TAG_OCOR[o.status] || ''}">${esc(STATUS_OCOR[o.status] || o.status)}</span>
      </div>
      <div class="di-meta">${o.hora ? esc(o.hora.slice(0, 5)) + ' · ' : ''}${esc(CANAIS[o.canal] || o.canal)}${escola ? ' · ' + esc(escola) : ''}</div>
    </div>`;
  }).join('');
}

const statTile = (svgIco, num, label, extra = '') => `
  <div class="stat-tile ${extra}">
    <div class="stat-ico" aria-hidden="true">${svgIco}</div>
    <div>
      <div class="stat-num">${esc(num)}</div>
      <div class="stat-label">${esc(label)}</div>
    </div>
  </div>`;

async function painelStats() {
  const [unidades, atividades] = await Promise.all([
    getUnidades().catch(() => []),
    getAtividades().catch(() => []),
  ]);
  const el = document.getElementById('stats');
  if (!el) return;
  el.innerHTML =
    statTile(ico('escola', { tam: 26 }), unidades.length, 'escolas')
    + statTile(ico('meta', { tam: 26 }), atividades.length, 'atividades no catálogo')
    + statTile(ico('transporte', { tam: 26 }), '-', 'extraclasse hoje', 'stat-hoje');
}

async function painelExtraclasse(hoje) {
  const box = document.getElementById('p-extraclasse');
  let solics;
  try { solics = await getSolicitacoesDoDia(hoje); }
  catch (err) { box.innerHTML = emptyState(ico('atencao', { tam: 32 }), 'Não foi possível carregar', esc(err.message || err)); return; }

  const tile = document.querySelector('.stat-hoje .stat-num');
  if (tile) tile.textContent = String(solics.length);

  if (!solics.length) {
    box.innerHTML = emptyState(ico('transporte', { tam: 32 }), 'Nada hoje', 'Nenhuma atividade extraclasse agendada.');
    return;
  }
  box.innerHTML = solics.map(s => {
    const cor = s.atividade?.cor || 'var(--brand)';
    const escola = s.unidade?.apelido || s.unidade?.nome || 'sem escola';
    return `<div class="dash-item" style="border-left:3px solid ${esc(cor)}">
      <div class="di-top">
        <b>${esc(s.atividade?.nome || s.atividade_livre || 'Atividade')}</b>
        <span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>
      </div>
      <div class="di-meta">${esc(escola)} · ${esc(PERIODOS[s.periodo] || s.periodo || '')}
        ${s.qtd_alunos ? '· ' + esc(s.qtd_alunos) + ' alunos' : ''}
        ${s.qtd_onibus ? '· ' + esc(s.qtd_onibus) + ' ônibus' : ''}</div>
    </div>`;
  }).join('');
}

async function painelAfastamentos(hoje) {
  const box = document.getElementById('p-afastamentos');
  let afs;
  try { afs = await getAfastamentos({ vigentesEm: hoje }); }
  catch (err) { box.innerHTML = emptyState(ico('atencao', { tam: 32 }), 'Não foi possível carregar', esc(err.message || err)); return; }

  if (!afs.length) {
    box.innerHTML = emptyState(ico('afastamento', { tam: 32 }), 'Equipe completa', 'Nenhum afastamento vigente hoje.');
    return;
  }
  box.innerHTML = afs.map(a => {
    const unidade = a.unidade?.apelido || a.unidade?.nome;
    return `<div class="dash-item">
      <div class="di-top"><b>${esc(a.servidor?.nome || 'sem nome')}</b><span class="tag">${esc(a.tipo)}</span></div>
      <div class="di-meta">${a.fim ? 'até ' + esc(fmtData(a.fim)) : 'em aberto'}${unidade ? ' · ' + esc(unidade) : ''}</div>
    </div>`;
  }).join('');
}

async function painelCalendario(hoje) {
  const box = document.getElementById('p-calendario');
  let dia;
  try { dia = await getDiaCalendario(hoje); }
  catch (err) { box.innerHTML = emptyState(ico('atencao', { tam: 32 }), 'Não foi possível carregar', esc(err.message || err)); return; }

  if (!dia) {
    box.innerHTML = emptyState(ico('calendario', { tam: 32 }), 'Dia comum', 'Sem evento no calendário escolar.');
    return;
  }
  const marcas = [
    dia.letivo === false ? '<span class="tag">Não letivo</span>' : '',
    dia.bloqueia_extraclasse ? `<span class="tag st-negado">${ico('erro', { tam: 14 })} Bloqueia extraclasse</span>` : '',
    dia.bloqueia_afastamento ? `<span class="tag st-em_analise">${ico('afastamento', { tam: 14 })} Não conceder afastamentos</span>` : '',
  ].join('');
  box.innerHTML = `<div class="dash-item">
    <div class="di-top"><b>${esc(dia.evento || dia.tipo || 'Dia letivo')}</b></div>
    ${dia.tipo && dia.evento ? `<div class="di-meta">${esc(dia.tipo)}</div>` : ''}
    ${marcas ? `<div class="tags">${marcas}</div>` : ''}
    ${dia.obs ? `<div class="di-meta">${esc(dia.obs)}</div>` : ''}
  </div>`;
}
