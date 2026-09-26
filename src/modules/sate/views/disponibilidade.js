// ============================================================
// FundHub - sate/views/disponibilidade.js  (página Disponibilidade - todos)
// Uma semana por vez: quantos ônibus (e vans) estão livres em cada dia e
// período. Spec: 2026-09-26-sate-frota-e-disponibilidade-design.md § D3.
//
// A escola planeja ANTES de pedir. Os números são para uma viagem típica
// de cada período (disponibilidade.model.js § TIPICO); o formulário
// confere o horário exato. A tarde mostra a ESCADA: os ônibus da manhã
// voltam aos poucos, e "2 livres às 12h" não conta a história de "9 a
// partir das 15h30".
//
// A escola vê só números - nunca de quem é a reserva (mesma promessa da
// 036). Quem aprova vê também, ao abrir o dia, a composição por rótulo.
// ============================================================
import { lerOcupacao, livresNoPeriodo, escadaDaTarde, totalDoDia } from '../disponibilidade.model.js';
import { getFrotas, rotulaTipo } from '../frota.model.js';
import { PERIODOS } from '../sate.model.js';
import { paraHora } from '../regras.model.js';
import { esc } from '../../../shared/dom.js';
import { hojeISO, addDias, fmtData, DOW } from '../../../shared/format.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

let ctx = null;
let segunda = null;   // data civil da segunda-feira da semana à vista

// Segunda-feira da semana de `iso`. Aritmética de calendário (R8 permite):
// só o dia da semana sai do Date, e o resultado volta por addDias.
function segundaDe(iso) {
  const dow = new Date(iso + 'T00:00:00').getDay();   // 0 = domingo
  return addDias(iso, dow === 0 ? -6 : 1 - dow);
}

export function render(contexto) {
  ctx = contexto;
  segunda = segunda || segundaDe(hojeISO());
  ctx.box().innerHTML = `
    <div class="toolbar disp-nav">
      <button type="button" class="mini-btn" id="disp-ant" aria-label="Semana anterior">${ico('voltar')}</button>
      <label class="search compacta">${ico('calendario', { tam: 14 })}
        <input id="disp-data" type="date" aria-label="Ir para a data" /></label>
      <button type="button" class="mini-btn" id="disp-prox" aria-label="Próxima semana">${ico('avancar')}</button>
      <button type="button" class="mini-btn" id="disp-hoje">Hoje</button>
    </div>
    <div id="disp-corpo">${loading()}</div>
    <p class="form-hint">Os números são para uma viagem típica de cada período. O formulário de pedido confere o horário exato.</p>`;

  const ir = (nova) => { segunda = nova; carregar(); };
  document.getElementById('disp-ant').addEventListener('click', () => ir(addDias(segunda, -7)));
  document.getElementById('disp-prox').addEventListener('click', () => ir(addDias(segunda, 7)));
  document.getElementById('disp-hoje').addEventListener('click', () => ir(segundaDe(hojeISO())));
  document.getElementById('disp-data').addEventListener('change', (e) => { if (e.target.value) ir(segundaDe(e.target.value)); });
  document.getElementById('disp-corpo').addEventListener('click', abrirDia);
  // Acessibilidade do card `role="button"`: Enter/Espaço abre igual ao clique.
  document.getElementById('disp-corpo').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('[data-dia]')) return;
    e.preventDefault();
    abrirDia(e);
  });
  carregar();
}

async function carregar() {
  const box = document.getElementById('disp-corpo');
  if (!box) return;
  box.innerHTML = loading();
  const domingo = addDias(segunda, 6);
  let linha;
  try { linha = await lerOcupacao(segunda, domingo); }
  catch (err) { box.innerHTML = erroBox(err); return; }
  if (!document.getElementById('disp-corpo')) return;

  const hoje = hojeISO();
  const dias = [0, 1, 2, 3, 4, 5, 6].map(i => ({ i, data: addDias(segunda, i) }));
  box.innerHTML = `
    ${linha.aproximado ? '<p class="sol-aviso">Contagem sem horário: o banco ainda não tem a atualização desta versão. Os números são por período.</p>' : ''}
    <h2 class="disp-semana">${esc(fmtData(segunda))} a ${esc(fmtData(domingo))}</h2>
    <div class="disp-grade">${dias.map(d => diaHtml(linha, d, hoje)).join('')}</div>`;
}

function diaHtml(linha, { i, data }, hoje) {
  const dow = new Date(data + 'T00:00:00').getDay();
  const tot = totalDoDia(linha, i, 'onibus');
  const totVan = totalDoDia(linha, i, 'vans');
  const passado = data < hoje;
  const cab = `<div class="disp-dia-cab"><b>${esc(DOW[dow])}</b> <span>${esc(fmtData(data))}</span></div>`;
  if (!tot && !totVan) {
    return `<div class="disp-dia ${passado ? 'passado' : ''}">${cab}<span class="vazio">sem frota</span></div>`;
  }
  const n = (v) => Math.max(0, v);
  const linhaPer = (p) => {
    if (p === 'tarde') {
      const esc_ = escadaDaTarde(linha, i, 'onibus');
      const texto = esc_.map((g, k) => (k === 0 ? `<b>${n(g.livres)}</b>` : `<b>${n(g.livres)}</b> a partir das ${esc(paraHora(g.aPartirDe))}`)).join(' · ');
      return `<div class="disp-per"><span>${esc(PERIODOS.tarde)}</span><span>${texto}</span></div>`;
    }
    return `<div class="disp-per"><span>${esc(PERIODOS[p])}</span><span><b>${n(livresNoPeriodo(linha, i, p, 'onibus'))}</b></span></div>`;
  };
  const vans = totVan ? `<div class="disp-per disp-van"><span>${ico('cadeirante', { tam: 12 })} Vans</span>
      <span>${['manha', 'tarde', 'noite'].map(p => n(livresNoPeriodo(linha, i, p, 'vans'))).join(' · ')}</span></div>` : '';
  const abrir = ctx.aprovador ? ` data-dia="${esc(data)}" role="button" tabindex="0" aria-label="Ver a composição da frota de ${esc(fmtData(data))}"` : '';
  return `<div class="disp-dia ${passado ? 'passado' : ''} ${ctx.aprovador ? 'clicavel' : ''}"${abrir}>
    ${cab}
    <div class="disp-tot">${tot} ônibus no dia</div>
    ${['manha', 'tarde', 'noite'].map(linhaPer).join('')}
    ${vans}
    <div class="disp-comp" hidden></div>
  </div>`;
}

// Quem aprova: a composição da frota do dia, por rótulo, abre embaixo.
async function abrirDia(e) {
  const card = e.target.closest('[data-dia]');
  if (!card || !ctx.aprovador) return;
  const comp = card.querySelector('.disp-comp');
  if (!comp.hidden) { comp.hidden = true; return; }
  comp.hidden = false;
  comp.innerHTML = loading();
  const frotas = await getFrotas({ vigenteEm: card.dataset.dia }).catch(() => []);
  comp.innerHTML = frotas.length
    ? frotas.map(f => `<div>${esc(f.rotulo?.nome || 'sem rótulo')} · ${f.quantidade} ${esc(rotulaTipo(f.tipo).toLowerCase())}</div>`).join('')
    : '<span class="vazio">sem frota</span>';
}
