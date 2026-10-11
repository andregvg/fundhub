// ============================================================
// FundHub - sate/views/disponibilidade.js  (página Disponibilidade - todos)
// Uma semana útil por vez (segunda a sexta, por enquanto), com o dia em
// foco destacado: quantos ônibus (e vans) estão livres em cada dia e
// período. Spec: 2026-09-26-sate-frota-e-disponibilidade-design.md § D3.
//
// A escola planeja ANTES de pedir. Os números são para uma viagem típica
// de cada período (disponibilidade.model.js § TIPICO); o formulário
// confere o horário exato. A tarde mostra a ESCADA: os ônibus da manhã
// voltam aos poucos, e "2 livres às 12h" não conta a história de "9 a
// partir das 15h30".
//
// A escola vê só números - nunca de quem é a reserva (mesma promessa da
// 036). Quem aprova abre o dia em detalhe (views/dia.js). Cada card mostra
// também o que o calendário escolar diz do dia (spec 2026-10-10-sate-disponibilidade, D1).
// ============================================================
import { lerOcupacao, livresNoPeriodo, escadaDaTarde, totalDoDia, semanaUtil } from '../disponibilidade.model.js';
import { PERIODOS } from '../sate.model.js';
import { paraHora } from '../regras.model.js';
import { getDiasCalendario, situacaoDoDia } from '../../calendario/calendario.model.js';
import { esc } from '../../../shared/dom.js';
import { hojeISO, addDias, fmtData, DOW } from '../../../shared/format.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';
import { marcarVazio } from '../../../shared/ui/campo-data-hora.js';
import { abrirDia, faixaCalendarioHtml } from './dia.js';

let ctx = null;
let segunda = null;   // data civil da segunda-feira da semana à vista
let foco = null;      // o dia destacado: a data escolhida ou, sem escolha, hoje
// Cada carregar() recebe um número: clicar "próxima semana" duas vezes
// rápido dispara duas buscas, e sem isto a resposta da primeira - mais
// lenta - pintaria por cima da segunda, com o cabeçalho de uma semana e
// os números de outra (mesmo padrão de `pedidoSaldo` em formulario.js).
let pedido = 0;
// POR ENQUANTO, SEM FIM DE SEMANA (spec 2026-10-02, D9): deslocamentos a
// partir da segunda. A volta do sábado e do domingo é aqui e em
// semanaUtil() (disponibilidade.model.js).
const DIAS_UTEIS = [0, 1, 2, 3, 4];

export function render(contexto) {
  ctx = contexto;
  if (!foco) ({ segunda, foco } = semanaUtil(hojeISO()));
  ctx.box().innerHTML = `
    <div class="toolbar disp-nav">
      <button type="button" class="mini-btn" id="disp-ant" aria-label="Semana anterior">${ico('voltar')}</button>
      <input id="disp-data" class="campo-solto" type="date" value="${esc(foco)}" aria-label="Ir para a data" />
      <button type="button" class="mini-btn" id="disp-prox" aria-label="Próxima semana">${ico('avancar')}</button>
      <button type="button" class="mini-btn" id="disp-hoje">Hoje</button>
    </div>
    <div id="disp-corpo">${loading()}</div>
    <p class="form-hint">Os números são para uma viagem típica de cada período. O formulário de pedido confere o horário exato.</p>`;

  // Escolher uma data (ou "Hoje") muda o FOCO e leva à semana dele; as
  // setas só trocam a semana - o foco fica onde a pessoa o pôs.
  const focar = (iso) => { ({ segunda, foco } = semanaUtil(iso)); carregar(); };
  const ir = (nova) => { segunda = nova; carregar(); };
  document.getElementById('disp-ant').addEventListener('click', () => ir(addDias(segunda, -7)));
  document.getElementById('disp-prox').addEventListener('click', () => ir(addDias(segunda, 7)));
  document.getElementById('disp-hoje').addEventListener('click', () => focar(hojeISO()));
  document.getElementById('disp-data').addEventListener('change', (e) => { if (e.target.value) focar(e.target.value); });
  // Quem aprova abre o dia em detalhe (views/dia.js). Clique, Enter ou Espaço.
  const abrir = (e) => {
    const card = e.target.closest('[data-dia]');
    if (card && ctx.aprovador) abrirDia(card.dataset.dia, ctx);
  };
  document.getElementById('disp-corpo').addEventListener('click', abrir);
  document.getElementById('disp-corpo').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('[data-dia]')) return;
    e.preventDefault();
    abrir(e);
  });
  carregar();
}

async function carregar() {
  const box = document.getElementById('disp-corpo');
  if (!box) return;
  box.innerHTML = loading();
  const meu = ++pedido;
  const seg = segunda;   // cópia local: `segunda` pode mudar antes da resposta chegar
  const sexta = addDias(seg, DIAS_UTEIS[DIAS_UTEIS.length - 1]);
  let linha, calendario;
  try {
    [linha, calendario] = await Promise.all([
      lerOcupacao(seg, sexta),
      getDiasCalendario(seg, sexta).catch(() => ({})),   // informa; não derruba a página
    ]);
  }
  catch (err) { if (meu === pedido) box.innerHTML = erroBox(err); return; }
  if (meu !== pedido) return;   // resposta velha: outra busca já está em curso ou chegou antes
  if (!document.getElementById('disp-corpo')) return;

  const hoje = hojeISO();
  const campoData = document.getElementById('disp-data');
  if (campoData) {
    campoData.value = foco;   // o campo mostra o dia em foco
    marcarVazio(campoData);   // valor posto por código não dispara evento: sem isto ficaria na cor do placeholder
  }
  const dias = DIAS_UTEIS.map(i => ({ i, data: addDias(seg, i) }));
  box.innerHTML = `
    ${linha.aproximado ? '<p class="sol-aviso">Contagem sem horário: o banco ainda não tem a atualização desta versão. Os números são por período.</p>' : ''}
    <h2 class="disp-semana">${esc(fmtData(seg))} a ${esc(fmtData(sexta))}</h2>
    <div class="disp-grade">${dias.map(d => diaHtml(linha, d, hoje, calendario[d.data] || null)).join('')}</div>`;
}

function diaHtml(linha, { i, data }, hoje, cal) {
  const dow = new Date(data + 'T00:00:00').getDay();
  const tot = totalDoDia(linha, i, 'onibus');
  const totVan = totalDoDia(linha, i, 'vans');
  const passado = data < hoje;
  const sit = situacaoDoDia(cal);
  // O dia em foco, na cor do SATE (o --brand do <body>). aria-current diz
  // ao leitor de tela o que o destaque diz ao olho.
  const emFoco = data === foco;
  const doCalendario = sit === 'bloqueado' ? 'bloqueado' : sit === 'nao_letivo' ? 'nao-letivo' : '';
  const marca = `${passado ? 'passado' : ''} ${emFoco ? 'foco' : ''} ${doCalendario}`;
  const atual = emFoco ? ' aria-current="date"' : '';
  const cab = `<div class="disp-dia-cab"><b>${esc(DOW[dow])}</b> <span>${esc(fmtData(data))}</span></div>`;
  const faixa = faixaCalendarioHtml(cal);
  if (!tot && !totVan) {
    return `<div class="disp-dia ${marca}"${atual}>${cab}${faixa}<span class="vazio">sem frota</span></div>`;
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
  const abrir = ctx.aprovador ? ` data-dia="${esc(data)}" role="button" tabindex="0" aria-label="Ver a disponibilidade de ${esc(fmtData(data))} em detalhe"` : '';
  return `<div class="disp-dia ${marca} ${ctx.aprovador ? 'clicavel' : ''}"${abrir}${atual}>
    ${cab}
    ${faixa}
    <div class="disp-nums${sit === 'bloqueado' || sit === 'nao_letivo' ? ' esmaecido' : ''}">
      <div class="disp-tot">${tot} ônibus no dia</div>
      ${['manha', 'tarde', 'noite'].map(linhaPer).join('')}
      ${vans}
    </div>
  </div>`;
}
