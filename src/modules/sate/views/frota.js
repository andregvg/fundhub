// ============================================================
// FundHub - sate/views/frota.js  (aba Frota - só admin)
// Saldo do dia: quantos veículos existem, quantos estão comprometidos
// em cada período e quanto sobra.
//
// Esta tela era o CADASTRO da oferta, dia a dia e período a período.
// A migration 035 aposentou esse modelo: a frota passou a ser um
// lançamento de veículos com vigência (spec 2026-09-08-sate-modelo-de-
// dados-design.md § D1), e cadastrar dia a dia deixou de fazer sentido.
//
// Por enquanto ela é só de LEITURA. O cadastro da frota vigente e dos
// lotes de evento nasce no bloco S3, junto com o resto da interface -
// deixar aqui um formulário meio-convertido seria pior que dizer, na
// tela, onde a coisa está.
// ============================================================
import { saldoDoDia, PERIODOS } from '../sate.model.js';
import { getFrotas, rotulaTipo } from '../frota.model.js';
import { esc } from '../../../shared/dom.js';
import { hojeISO, fmtData } from '../../../shared/format.js';
import { loading, erroBox, emptyState } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

export function render(ctx) {
  ctx.box().innerHTML = `
    <div class="toolbar">
      <label class="search compacta">${ico('calendario', { tam: 14 })}
        <input id="fr-data" type="date" value="${hojeISO()}" aria-label="Data" /></label>
      <span class="count">Veículos disponíveis no dia e quanto já está comprometido.</span>
    </div>
    <div id="fr-body">${loading()}</div>`;

  document.getElementById('fr-data').addEventListener('change', carregar);
  carregar();
}

async function carregar() {
  const data = document.getElementById('fr-data').value;
  const body = document.getElementById('fr-body');
  if (!data) return;
  body.innerHTML = loading();

  let saldo, vigentes;
  try {
    [saldo, vigentes] = await Promise.all([saldoDoDia(data), getFrotas({ vigenteEm: data })]);
  } catch (err) { body.innerHTML = erroBox(err); return; }

  if (!vigentes.length) {
    body.innerHTML = emptyState(ico('transporte', { tam: 32 }), 'Nenhuma frota vigente nesta data',
      `Nada foi cadastrado para ${esc(fmtData(data))}. A frota vigente e os lotes de evento se cadastram nas configurações do SATE.`);
    return;
  }

  body.innerHTML = `
    <div class="frota">
      ${['onibus', 'van_adaptada'].map(tipo => bloco(tipo, saldo[tipo])).join('')}
    </div>
    <div class="fr-composicao">
      <div class="lbl">Composição do dia</div>
      ${vigentes.map(f => `<div class="fr-lote">
        <b>${esc(f.rotulo?.nome || 'sem rótulo')}</b>
        <span class="tag">${esc(rotulaTipo(f.tipo))}</span>
        <span>${f.quantidade} veículo(s)</span>
        <span class="di-meta">${esc(fmtData(f.inicio))} → ${f.fim ? esc(fmtData(f.fim)) : 'em aberto'}</span>
      </div>`).join('')}
    </div>`;
}

// Um bloco por tipo de veículo. Se não há nenhum daquele tipo vigente na
// data, o bloco não aparece - uma linha de zeros para vans num dia sem
// van cadastrada é ruído, não informação.
function bloco(tipo, porPeriodo) {
  const total = porPeriodo.manha.total;
  if (!total) return '';
  return `
    <div class="fr-tipo">
      <div class="lbl">${esc(rotulaTipo(tipo))} · ${total} no dia</div>
      ${Object.keys(PERIODOS).map(p => {
        const s = porPeriodo[p];
        return `<div class="frota-row">
          <div class="fr-per">${esc(PERIODOS[p])}</div>
          <div class="fr-uso">Em uso <b>${s.uso}</b></div>
          <div class="fr-saldo ${s.estouro ? 'neg' : ''}">
            ${s.estouro ? `Estouro <b>${s.estouro}</b>` : `Livre <b>${s.livre}</b>`}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}
