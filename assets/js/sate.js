// ============================================================
// FundHub — sate.js  (SATE · Transporte extraclasse)
// Fase 2 — catálogo de atividades (leitura). As solicitações de
// transporte entram nas próximas etapas.
// ============================================================
import { getAtividades } from './data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function renderSate(app) {
  app.innerHTML = `
    <div class="page-head">
      <h1>SATE · Transporte extraclasse</h1>
      <p>Catálogo de atividades extraclasse e suas regras. Solicitações de ônibus entram nas próximas etapas.</p>
    </div>
    <div id="atv" class="cards"><div class="loading">Carregando atividades…</div></div>`;

  let atvs = [];
  try {
    atvs = await getAtividades();
  } catch (err) {
    document.getElementById('atv').innerHTML =
      `<p class="count">Não foi possível carregar as atividades: ${esc(err.message || err)}</p>`;
    return;
  }

  if (!atvs.length) {
    document.getElementById('atv').innerHTML = `
      <div class="empty">
        <div class="empty-ico">🚌</div>
        <h3>Catálogo vazio</h3>
        <p>Rode <code>supabase/migrations/004_sate.sql</code> e o seed
           <code>_private/seed_atividades.sql</code> no SQL Editor para carregar as atividades.</p>
      </div>`;
    return;
  }

  document.getElementById('atv').innerHTML = atvs.map(cardAtividade).join('');
}

function tagBool(on, txt) {
  return on ? `<span class="tag">${txt}</span>` : '';
}

function cardAtividade(a) {
  const cor = a.cor || 'var(--brand)';
  const tags = [
    a.usa_onibus ? `<span class="tag bus">🚌 Usa ônibus</span>` : `<span class="tag">🏫 Na escola</span>`,
    a.gerida_sme ? `<span class="tag">Gerida pela SME</span>` : `<span class="tag">Definida pela escola</span>`,
    a.precisa_declaracao ? `<span class="tag eja">📄 Declaração impressa</span>` : '',
    a.min_participantes ? `<span class="tag">Mín. ${a.min_participantes}</span>` : '',
  ].join('');
  return `<article class="card atv-card" style="border-top: 3px solid ${esc(cor)}">
    <div class="card-top">
      <h3>${esc(a.nome)}</h3>
    </div>
    ${a.descricao ? `<div class="addr">${esc(a.descricao)}</div>` : ''}
    ${a.publico_alvo ? `<div class="atv-field"><b>Público-alvo:</b> ${esc(a.publico_alvo)}</div>` : ''}
    ${a.lanche ? `<div class="atv-field"><b>Lanche:</b> ${esc(a.lanche)}</div>` : ''}
    <div class="tags">${tags}</div>
  </article>`;
}
