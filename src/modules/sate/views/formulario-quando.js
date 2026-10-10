// ============================================================
// FundHub - sate/views/formulario-quando.js
// Os grupos QUANDO e QUEM VAI do modal de solicitação (spec 2026-10-03, D2):
// data e horários; turma e quantos vão. Separado
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
import { periodoDe } from '../regras.model.js';
import { ICONE_PERIODO } from './periodo.js';
import { PERIODOS } from '../regras.model.js';
import { getDiaCalendario, diaImpedeExtraclasse, motivoDoDia } from '../../calendario/calendario.model.js';
import { mascaraDiaMes, dataDeDiaMes, diaMesDe, fmtExtenso, fmtData } from '../../../shared/format.js';
import { marcarVazio } from '../../../shared/ui/campo-data-hora.js';
import { esc, val } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { marcarTocado } from '../../../shared/ui/modal.js';

// Quem vai: a turma e os números da escola. Com várias paradas, a dica diz
// de quem são (da Escola 01) - as outras informam os seus nas paradas.
export const quemVaiHtml = () => `
  <fieldset class="form-grupo">
    <legend>Quem vai</legend>
    <div class="campos duas">
      <label class="col-2">Turma / grupo participante <input id="f-turmas" type="text" placeholder="Ex.: 5º A, 5º B" /></label>
      <label>Qtd. estudantes<input id="f-alunos" type="number" inputmode="numeric" min="1" placeholder="0" required /></label>
      <label>Qtd. adultos<input id="f-adultos" type="number" inputmode="numeric" min="0" placeholder="0" required /></label>
      <p class="form-hint col-2" id="f-esc01-dica" hidden>Estudantes, adultos e embarque acima são da Escola 01. As outras escolas informam os seus em “Adicionar pontos de parada”. A saída do evento é a mesma para todas.</p>
    </div>
  </fieldset>`;

const DICA = 'Dia e mês. O ano é o atual.';

export const quandoHtml = (minData) => `
  <fieldset class="form-grupo">
    <legend>Quando</legend>
    <div class="campos duas">
      <div class="lbl col-2">
        <label for="f-dia">Data</label>
        <span class="sol-data">
          <input id="f-dia" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm"
                 maxlength="10" required aria-describedby="f-data-ext" />
          <button type="button" class="sol-data-btn" id="f-data-btn"
                  aria-label="Escolher a data no calendário">${ico('calendario', { tam: 16 })}</button>
          <!-- form="f-data-fora" (id que não existe): o campo escondido não pertence a
               formulário nenhum e fica fora da validação - o balão do navegador
               ancoraria num ponto de 1px. A validade é do #f-dia, visível. O min
               fica: é ele que apaga os dias do calendário. -->
          <input id="f-data" class="sol-data-nativo" type="date" min="${esc(minData)}"
                 form="f-data-fora" tabindex="-1" aria-hidden="true" />
        </span>
        <small class="form-hint" id="f-data-ext" aria-live="polite">${DICA}</small>
      </div>
      <label>Horário de embarque na escola<input id="f-emb" type="time" required aria-describedby="f-emb-dica" />
        <small class="form-hint" id="f-emb-dica">Só os números: 0730 → 07:30</small></label>
      <label>Horário de saída do evento<input id="f-ret" type="time" required aria-describedby="f-ret-dica" />
        <small class="form-hint" id="f-ret-dica">Só os números: 1130 → 11:30</small></label>
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
  // A cor é a do período (tokens --per-*), pelo atributo: o parágrafo é a
  // variante em linha do badge, sem a cápsula.
  const el = document.getElementById('f-periodo');
  el.dataset.per = p || '';
  el.innerHTML = p
    ? `${ico(ICONE_PERIODO[p] || 'horario', { tam: 14 })}<b>Período da ${esc(PERIODOS[p].toLowerCase())}</b>`
    : '';
}

export function ligarQuando(aoMudar, { aprovador = false } = {}) {
  const dia = document.getElementById('f-dia');
  const nativo = document.getElementById('f-data');
  const ext = document.getElementById('f-data-ext');

  // O calendário escolar do dia escolhido (spec 2026-10-10-sate-disponibilidade,
  // D2): consultado ao escolher a data, e não só no envio. `consulta`
  // descarta a resposta de uma data que a pessoa já trocou.
  let diaCal = null, consulta = 0;
  const conferirCalendario = async () => {
    const meu = ++consulta;
    diaCal = null;
    if (!nativo.value) return;
    const d = await getDiaCalendario(nativo.value).catch(() => null);   // sem calendário, segue sem aviso
    if (meu !== consulta || !document.getElementById('f-dia')) return;
    diaCal = d;
    pintarExtenso();
  };

  // Três estados: data que não existe, data antes da primeira possível
  // (ambos erro, e o campo visível fica inválido para o navegador) e o
  // resto (data por extenso, ou a dica enquanto se digita).
  const pintarExtenso = () => {
    const digitos = dia.value.replace(/\D/g, '').length;
    const completo = digitos === 4 || digitos === 8;
    let erro = '';
    if (completo && !nativo.value) erro = 'Essa data não existe.';
    else if (nativo.value && nativo.min && nativo.value < nativo.min) erro = `A primeira data possível é ${fmtData(nativo.min)}.`;
    // Dia não letivo ou bloqueado: erro para a escola, aviso para quem
    // aprova (R15 - erro barra, aviso não). Evento em dia letivo só informa.
    const motivo = motivoDoDia(diaCal);
    if (!erro && motivo && diaImpedeExtraclasse(diaCal) && !aprovador) erro = motivo;
    const nota = !erro && motivo ? ` · ${motivo}${diaImpedeExtraclasse(diaCal) ? ' Você pode agendar mesmo assim.' : ''}` : '';
    ext.textContent = erro || (nativo.value ? fmtExtenso(nativo.value) + nota : DICA);
    ext.classList.toggle('err', !!erro);
    dia.setCustomValidity(erro);
  };

  dia.addEventListener('input', () => {
    dia.value = mascaraDiaMes(dia.value);
    const iso = dataDeDiaMes(dia.value) || '';
    if (nativo.value !== iso) { nativo.value = iso; marcarVazio(nativo); conferirCalendario(); aoMudar(); }
    pintarExtenso();
  });
  // Escolheu no calendário: o texto acompanha.
  nativo.addEventListener('change', () => {
    marcarTocado(dia);   // a escolha no calendário é dela; o texto é escrito por código
    dia.value = nativo.value ? textoDe(nativo.value) : '';
    conferirCalendario();   // zera `diaCal` na hora; o aviso do dia antigo não fica sob a data nova
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
