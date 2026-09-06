// ============================================================
// FundHub - dashboard/views/paineis.js
// As funções de pintura dos painéis do dashboard. Cada uma recebe o
// elemento onde desenhar e trata o próprio erro - um painel que falha
// não derruba os outros (spec D5). A casca (dashboard.view.js) decide
// QUAIS painéis pinta e em que ordem.
// ============================================================
import { getUnidades } from '../../escolas/escolas.model.js';
import { getAtividades } from '../../sate/atividades.model.js';
import { getSolicitacoesDoDia, STATUS, PERIODOS } from '../../sate/sate.model.js';
import { getAfastamentos } from '../../afastamentos/afastamentos.model.js';
import { getDiaCalendario } from '../../calendario/calendario.model.js';
import { getOcorrencias, CANAIS, STATUS as STATUS_OCOR, STATUS_TAG as TAG_OCOR } from '../../ocorrencias/ocorrencias.model.js';
import { esc } from '../../../shared/dom.js';
import { fmtData } from '../../../shared/format.js';
import { emptyState } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

const erro = (box, err) => {
  box.innerHTML = emptyState(ico('atencao', { tam: 32 }), 'Não foi possível carregar', esc(err?.message || err));
};

const statTile = (svgIco, num, label, extra = '') => `
  <div class="stat-tile ${extra}">
    <div aria-hidden="true">${svgIco}</div>
    <div>
      <div class="stat-num">${esc(num)}</div>
      <div class="stat-label">${esc(label)}</div>
    </div>
  </div>`;

export async function painelStats(box) {
  if (!box) return;
  const [unidades, atividades] = await Promise.all([
    getUnidades().catch(() => []),
    getAtividades().catch(() => []),
  ]);
  box.innerHTML = `<div class="stat-row">${
    statTile(ico('escola', { tam: 26 }), unidades.length, 'escolas')
    + statTile(ico('meta', { tam: 26 }), atividades.length, 'atividades no catálogo')
    + statTile(ico('transporte', { tam: 26 }), '-', 'extraclasse hoje', 'stat-hoje')
  }</div>`;
}

export async function painelExtraclasse(box, hoje) {
  if (!box) return;
  let solics;
  try { solics = await getSolicitacoesDoDia(hoje); }
  catch (err) { return erro(box, err); }

  // O tile "extraclasse hoje" vive no painel de números - busca global
  // de propósito: ele pode estar oculto ou noutra posição.
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

export async function painelAfastamentos(box, hoje) {
  if (!box) return;
  let afs;
  try { afs = await getAfastamentos({ vigentesEm: hoje }); }
  catch (err) { return erro(box, err); }

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

export async function painelCalendario(box, hoje) {
  if (!box) return;
  let dia;
  try { dia = await getDiaCalendario(hoje); }
  catch (err) { return erro(box, err); }

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

export async function painelOcorrencias(box, hoje) {
  if (!box) return;
  let lista;
  try { lista = await getOcorrencias({ de: hoje, ate: hoje }); }
  catch (err) { return erro(box, err); }

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
