// ============================================================
// FundHub - sate/views/frota.js  (aba Frota - só admin)
// Saldo do dia: quantos veículos existem, quantos estão comprometidos
// em cada período e quanto sobra. E, no topo, a frota extra que perdeu
// o pedido de origem, esperando decisão.
//
// Esta tela era o CADASTRO da oferta, dia a dia e período a período.
// A migration 035 aposentou esse modelo: a frota passou a ser um
// lançamento de veículos com vigência (spec 2026-09-08-sate-modelo-de-
// dados-design.md § D1), e cadastrar dia a dia deixou de fazer sentido.
//
// Fora as órfãs, esta guia é só de LEITURA. O cadastro da frota vigente, dos lotes de
// evento e dos rótulos mora na ENGRENAGEM do módulo
// (views/frota-painel.js): configurar é interrupção curta, e é o
// critério que o hub usa para escolher entre a engrenagem e uma aba.
// ============================================================
import { PERIODOS } from '../sate.model.js';
import { saldoDoDia } from '../saldo.model.js';
import { getFrotas, rotulaTipo, getFrotasOrfas, manterLote, excluirFrota } from '../frota.model.js';
import { STATUS } from '../sate.model.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
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
    <div id="fr-orfas"></div>
    <div id="fr-body">${loading()}</div>`;

  document.getElementById('fr-data').addEventListener('change', carregar);
  document.getElementById('fr-orfas').addEventListener('click', decidirOrfa);
  carregar();
  pintarOrfas();
}

// ── Frota órfã (spec 2026-09-13-sate-ciclo-de-aprovacao, D3) ──
// Lote extra cujo pedido foi negado, cancelado ou remanejado para outra
// data. Independe da data escolhida acima: é pendência, e pendência
// aparece até alguém decidir.
async function pintarOrfas() {
  const box = document.getElementById('fr-orfas');
  if (!box) return;
  const orfas = await getFrotasOrfas().catch(() => []);
  if (!orfas.length) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="fr-orfas">
      <div class="lbl">Frota extra sem pedido (${orfas.length})</div>
      <p class="form-hint">Estes veículos extras nasceram de um pedido que foi negado, cancelado ou mudou de data.
        <b>Manter</b> transforma o lote em reforço comum; <b>Remover</b> apaga.</p>
      ${orfas.map(f => {
        const s = f.solicitacao;
        const motivo = !s ? 'pedido apagado'
          : ['negado', 'cancelado'].includes(s.status) ? `pedido ${STATUS[s.status].toLowerCase()}`
          : `pedido remanejado para ${fmtData(s.data)}`;
        return `<div class="fr-lote">
          <b>${esc(f.rotulo?.nome || 'sem rótulo')}</b>
          <span class="tag">${esc(rotulaTipo(f.tipo))}</span>
          <span>${f.quantidade} veículo(s) em ${esc(fmtData(f.inicio))}</span>
          <span class="di-meta">${esc(motivo)}</span>
          <span class="fr-orfa-acoes">
            <button type="button" class="mini-btn" data-manter="${esc(f.id)}">Manter</button>
            <button type="button" class="mini-btn no" data-remover="${esc(f.id)}">Remover</button>
          </span>
        </div>`;
      }).join('')}
    </div>`;
}

async function decidirOrfa(e) {
  const manter = e.target.closest('[data-manter]');
  const remover = e.target.closest('[data-remover]');
  if (!manter && !remover) return;
  if (remover && !(await confirmar('Remover este lote de frota extra?', {
    detalhe: 'Os veículos deixam de contar no saldo daquele dia.', textoOk: 'Remover', perigo: true,
  }))) return;
  try {
    if (manter) await manterLote(manter.dataset.manter);
    else await excluirFrota(remover.dataset.remover);
    toast({ titulo: manter ? 'Lote mantido como reforço' : 'Lote removido', tipo: 'sucesso' });
    await pintarOrfas();
    carregar();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível concluir' });
  }
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
