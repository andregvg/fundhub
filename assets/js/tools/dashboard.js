// ============================================================
// FundHub — dashboard.js  (Dashboard do dia)
// Painel de acompanhamento em tempo real. Hoje mostra o que já
// existe (escolas, atividades, extraclasse do dia); afastamentos e
// calendário entram conforme os módulos ficam prontos.
// ============================================================
import { getStats, getSolicitacoesDoDia } from '../data/solicitacoes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hojeISO = () => new Date().toLocaleDateString('sv-SE'); // yyyy-mm-dd local

const PERIODOS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

export async function renderDashboard(app) {
  const hoje = new Date();
  const dataExtenso = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  app.innerHTML = `
    <div class="page-head">
      <h1>Dashboard do dia</h1>
      <p style="text-transform: capitalize">${esc(dataExtenso)}</p>
    </div>
    <div class="stat-row" id="stats"></div>
    <div class="dash-grid">
      <section class="panel">
        <h2>🚌 Extraclasse hoje</h2>
        <div id="extraclasse"><div class="loading">Carregando…</div></div>
      </section>
      <section class="panel soon-panel">
        <h2>🌴 Afastamentos hoje</h2>
        <div class="empty small"><p>Entra com o módulo de Afastamentos.</p></div>
      </section>
      <section class="panel soon-panel">
        <h2>📅 Calendário hoje</h2>
        <div class="empty small"><p>Entra com o módulo de Calendário.</p></div>
      </section>
    </div>`;

  // Estatísticas
  try {
    const s = await getStats();
    document.getElementById('stats').innerHTML = `
      ${statTile('🏫', s.escolas, 'escolas')}
      ${statTile('🎯', s.atividades, 'atividades no catálogo')}
      ${statTile('🚌', '—', 'extraclasse hoje', 'stat-hoje')}`;
  } catch (_) {}

  // Extraclasse do dia
  try {
    const solics = await getSolicitacoesDoDia(hojeISO());
    const hojeTile = document.querySelector('.stat-hoje .stat-num');
    if (hojeTile) hojeTile.textContent = String(solics.length);
    renderExtraclasse(solics);
  } catch (err) {
    document.getElementById('extraclasse').innerHTML =
      `<div class="empty small"><p>Não foi possível carregar: ${esc(err.message || err)}</p></div>`;
  }
}

function statTile(ico, num, label, extra = '') {
  return `<div class="stat-tile ${extra}">
    <div class="stat-ico">${ico}</div>
    <div><div class="stat-num">${esc(num)}</div><div class="stat-label">${esc(label)}</div></div>
  </div>`;
}

function renderExtraclasse(solics) {
  const box = document.getElementById('extraclasse');
  if (!solics.length) {
    box.innerHTML = `<div class="empty small"><p>Nenhuma atividade extraclasse agendada para hoje.</p></div>`;
    return;
  }
  box.innerHTML = solics.map(s => {
    const cor = s.atividade?.cor || 'var(--brand)';
    const escola = s.unidade?.apelido || s.unidade?.nome || '—';
    return `<div class="dash-item" style="border-left: 3px solid ${esc(cor)}">
      <div class="di-top">
        <b>${esc(s.atividade?.nome || 'Atividade')}</b>
        <span class="tag st-${esc(s.status)}">${esc(rotStatus(s.status))}</span>
      </div>
      <div class="di-meta">${esc(escola)} · ${esc(PERIODOS[s.periodo] || s.periodo || '')}
        ${s.qtd_alunos ? '· ' + esc(s.qtd_alunos) + ' alunos' : ''}
        ${s.qtd_onibus ? '· ' + esc(s.qtd_onibus) + ' ônibus' : ''}</div>
    </div>`;
  }).join('');
}

function rotStatus(s) {
  return { solicitado: 'Solicitado', em_analise: 'Em análise', confirmado: 'Confirmado',
    negado: 'Negado', cancelado: 'Cancelado' }[s] || s;
}
