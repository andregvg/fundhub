// ============================================================
// FundHub - sate/views/formulario-quando.js
// O grupo QUANDO do modal de solicitação (spec 2026-10-03, D2). Separado
// de formulario.js por ter estado e contrato próprios, como
// formulario-destino.js: a data sem ano, os dois horários e o período
// calculado - o formulário só pergunta "quando?".
//
// A data é digitada como dd/mm: o campo nativo de data não deixa esconder
// o ano, e quem pede um ônibus pensa em "14/03", não em "14/03/2026". O
// <input type="date"> continua existindo, escondido, por dois motivos: é
// ele que abre o calendário do navegador (showPicker) e é dele que o
// resto do formulário lê a data civil (`val('f-data')`), sem saber que o
// campo visível mudou.
// ============================================================
import { periodoDe, PERIODOS } from '../regras.model.js';
import { mascaraDiaMes, dataDeDiaMes, diaMesDe, fmtExtenso } from '../../../shared/format.js';
import { marcarVazio } from '../../../shared/ui/campo-data-hora.js';
import { esc, val } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';

const DICA = 'Dia e mês. O ano é o atual - ou o próximo, se a data já passou.';

export const quandoHtml = (minData) => `
  <fieldset class="form-grupo">
    <legend>Quando</legend>
    <div class="campos duas">
      <div class="lbl col-2">
        <label for="f-dia">Data</label>
        <span class="data-curta">
          <input id="f-dia" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm"
                 maxlength="10" required aria-describedby="f-data-ext" />
          <button type="button" class="data-curta-btn" id="f-data-btn"
                  aria-label="Escolher a data no calendário">${ico('calendario', { tam: 16 })}</button>
          <input id="f-data" class="data-curta-nativo" type="date" min="${esc(minData)}"
                 tabindex="-1" aria-hidden="true" />
        </span>
        <small class="form-hint" id="f-data-ext" aria-live="polite">${DICA}</small>
      </div>
      <label>Horário de embarque <input id="f-emb" type="time" required /></label>
      <label>Horário de saída do evento <input id="f-ret" type="time" required /></label>
      <p class="form-hint col-2">Somente números, ex.: 0730 → 07h30</p>
      <p class="sol-periodo col-2" id="f-periodo" aria-live="polite"></p>
    </div>
  </fieldset>`;

// 'dd/mm' quando o ano é o que seria assumido; 'dd/mm/aaaa' quando a
// pessoa escolheu outro no calendário - senão o texto mentiria sobre o ano.
const textoDe = (iso) => (dataDeDiaMes(diaMesDe(iso)) === iso
  ? diaMesDe(iso) : `${diaMesDe(iso)}/${iso.slice(0, 4)}`);

// O período é calculado (spec 2026-09-27, D4): a escola vê, não escolhe.
function pintarPeriodo() {
  const p = periodoDe(val('f-emb'), val('f-ret'));
  document.getElementById('f-periodo').innerHTML = p
    ? `${ico(p === 'noite' ? 'noturno' : 'horario', { tam: 14 })}<span>Período</span><b>${esc(PERIODOS[p])}</b>`
    : '';
}

export function ligarQuando(aoMudar) {
  const dia = document.getElementById('f-dia');
  const nativo = document.getElementById('f-data');
  const ext = document.getElementById('f-data-ext');

  const pintarExtenso = () => {
    const digitos = dia.value.replace(/\D/g, '').length;
    const completo = digitos === 4 || digitos === 8;
    const invalida = completo && !nativo.value;
    ext.textContent = nativo.value ? fmtExtenso(nativo.value) : (invalida ? 'Essa data não existe.' : DICA);
    ext.classList.toggle('err', invalida);
  };

  dia.addEventListener('input', () => {
    dia.value = mascaraDiaMes(dia.value);
    const iso = dataDeDiaMes(dia.value) || '';
    if (nativo.value !== iso) { nativo.value = iso; marcarVazio(nativo); aoMudar(); }
    pintarExtenso();
  });
  // Escolheu no calendário: o texto acompanha.
  nativo.addEventListener('change', () => {
    dia.value = nativo.value ? textoDe(nativo.value) : '';
    pintarExtenso();
    aoMudar();
  });
  document.getElementById('f-data-btn').addEventListener('click', () => {
    // Navegador sem showPicker: o campo de texto continua sendo o caminho.
    try { nativo.showPicker(); } catch (_) { dia.focus(); }
  });

  for (const id of ['f-emb', 'f-ret']) {
    document.getElementById(id).addEventListener('change', () => { pintarPeriodo(); aoMudar(); });
  }
  pintarPeriodo();
}
