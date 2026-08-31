// ============================================================
// FundHub - dashboard/views/hoje.js
// "Nesta data, a rede está em que escala, e quem está fora?"
//
// O campo de data abre em hoje mas aceita qualquer dia: é ele que
// atende também a consulta retroativa ("que horário valia em 12/03"),
// sem exigir uma aba nova em Horários. O passado é estável porque a
// escala é DADO GRAVADO, não conta - corrigir o calendário hoje não
// reescreve o que valia em março.
//
// Quem está afastado aparece marcado, mas a AUSÊNCIA NÃO ALTERA A
// COBERTURA: a jornada cadastrada continua sendo a referência.
// Recalcular geraria alarme falso toda vez que um colega cobre
// informalmente o outro - que é o que acontece na prática.
// ============================================================
import { getEscalasRede } from '../../calendario/calendario.model.js';
import { resolverEscala, rotulaEscala, diaDaSemana, getEscalas } from '../../horarios/escalas.model.js';
import { getAfastamentos, CORES_AFASTAMENTO } from '../../afastamentos/afastamentos.model.js';
import { esc, vazio } from '../../../shared/dom.js';
import { fmtExtenso, hojeISO } from '../../../shared/format.js';
import { ico } from '../../../shared/ui/icones.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';

export async function cartaoHoje(box) {
  if (!box) return;
  let data = hojeISO();

  box.innerHTML = `
    <section class="panel hoje">
      <h2>${ico('horario')} Nesta data</h2>
      <label class="search compacta hoje-data">${ico('calendario')}
        <input type="date" id="hoje-dia" value="${esc(data)}" aria-label="Data" /></label>
      <div id="hoje-corpo">${loading()}</div>
    </section>`;

  box.querySelector('#hoje-dia').addEventListener('change', (e) => {
    data = e.target.value || hojeISO();
    pintar(box, data);
  });

  pintar(box, data);
}

async function pintar(box, data) {
  const corpo = box.querySelector('#hoje-corpo');
  if (!corpo) return;   // box foi trocado por outra tela enquanto isto estava em voo
  corpo.innerHTML = loading();

  const dow = diaDaSemana(data);
  if (dow === 0 || dow === 6) {
    corpo.innerHTML = `<p class="hoje-linha"><span class="capitalizar">${esc(fmtExtenso(data))}</span> -
      ${vazio('fim de semana, sem jornada prevista')}</p>`;
    return;
  }

  try {
    const [escalas, afastados, catalogo] = await Promise.all([
      getEscalasRede(data, data),
      getAfastamentos({ vigentesEm: data }),
      getEscalas(),   // já em cache depois da primeira data escolhida
    ]);
    const escala = resolverEscala({ rede: escalas[0]?.escala ?? null, override: undefined });

    corpo.innerHTML = `
      <p class="hoje-linha">
        <b class="capitalizar">${esc(fmtExtenso(data))}</b>
        <span class="tag ${escala === 'normal' ? '' : 'hoje-tdc'}">${esc(rotulaEscala(escala, catalogo))}</span>
      </p>
      ${escala === 'normal'
        ? `<p class="form-hint">Jornada normal em toda a rede. Escolas que tenham remarcado
             o próprio TDC podem estar em outra escala.</p>`
        : `<p class="form-hint">A rede está em ${esc(rotulaEscala(escala, catalogo))}. Quem tiver jornada
             cadastrada nesta escala cumpre a dela; os demais seguem a jornada normal. Uma escola pode ter
             remarcado ou cancelado o próprio TDC - a visão aqui é sempre a da rede.</p>`}
      ${listaAfastados(afastados)}`;
  } catch (err) { corpo.innerHTML = erroBox(err); }
}

function listaAfastados(lista) {
  if (!lista?.length) {
    return `<p class="hoje-linha">${ico('equipe')} ${vazio('ninguém afastado nesta data')}</p>`;
  }
  return `<div class="hoje-afastados">
    <h3>${lista.length} ${lista.length === 1 ? 'pessoa afastada' : 'pessoas afastadas'}</h3>
    ${lista.map(a => `
      <div class="hoje-af" style="--af: ${Object.hasOwn(CORES_AFASTAMENTO, a.tipo) ? CORES_AFASTAMENTO[a.tipo] : 'var(--af-outro)'}">
        <span class="hoje-af-nome">${esc(a.servidor?.nome || 'sem nome')}</span>
        <span class="hoje-af-tipo">${esc(a.tipo)}</span>
      </div>`).join('')}
  </div>`;
}
