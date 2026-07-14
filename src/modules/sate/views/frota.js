// ============================================================
// FundHub — sate/views/frota.js  (aba Frota — só admin)
// Oferta de ônibus por dia/período × uso já reservado = saldo.
// ============================================================
import { getOfertaDia, setOferta, getUsoDia, PERIODOS } from '../sate.model.js';
import { falha, ok } from '../../../shared/dom.js';
import { hojeISO } from '../../../shared/format.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';

export function render(ctx) {
  ctx.box().innerHTML = `
    <div class="toolbar">
      <label class="search compacta">📅 <input id="fr-data" type="date" value="${hojeISO()}" /></label>
      <span class="count">Defina os ônibus disponíveis por período e acompanhe o saldo.</span>
    </div>
    <div id="fr-body">${loading()}</div>`;

  document.getElementById('fr-data').addEventListener('change', carregar);
  carregar();
}

async function carregar() {
  const data = document.getElementById('fr-data').value;
  const body = document.getElementById('fr-body');

  let oferta = {}, uso = {};
  try { [oferta, uso] = await Promise.all([getOfertaDia(data), getUsoDia(data)]); }
  catch (err) { body.innerHTML = erroBox(err); return; }

  body.innerHTML = `
    <div class="frota">
      ${Object.keys(PERIODOS).map(p => {
        const cap = oferta[p] || 0, u = uso[p] || 0, saldo = cap - u;
        return `<div class="frota-row">
          <div class="fr-per">${PERIODOS[p]}</div>
          <label class="fr-of">Ônibus disponíveis
            <input type="number" inputmode="numeric" min="0" data-per="${p}" value="${cap}" /></label>
          <div class="fr-uso">Em uso <b>${u}</b></div>
          <div class="fr-saldo ${saldo < 0 ? 'neg' : ''}">Saldo <b>${saldo}</b></div>
        </div>`;
      }).join('')}
    </div>
    <div class="form-foot">
      <span id="fr-msg" class="auth-msg"></span>
      <button id="fr-save" type="button">Salvar oferta</button>
    </div>`;

  document.getElementById('fr-save').addEventListener('click', async () => {
    const msg = document.getElementById('fr-msg'); msg.className = 'auth-msg';
    try {
      for (const inp of body.querySelectorAll('input[data-per]')) {
        await setOferta(data, inp.dataset.per, parseInt(inp.value, 10) || 0);
      }
      ok(msg, 'Oferta salva.');
      carregar();
    } catch (err) {
      falha(msg, 'Erro: ' + (err.message || err));
    }
  });
}
