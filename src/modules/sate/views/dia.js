// ============================================================
// FundHub - sate/views/dia.js
// O modal "Disponibilidade do dia" (quem aprova).
// Spec: 2026-10-10-sate-disponibilidade-calendario-design.md § D3.
//
// Um número de ônibus livres não decide nada sozinho. Aqui está o que o
// explica: o que o calendário escolar diz do dia, quanto a frota tem,
// quanto está em uso em cada período e QUAIS viagens ocupam os veículos,
// do embarque até a hora em que eles voltam a ficar livres.
//
// Abre por dois caminhos: o card do dia, na Disponibilidade, e o botão
// "Ver disponibilidade do dia" da ficha de um pedido - que passa `voltar`
// (o ← devolve à ficha) e `destaque` (o id do pedido, realçado na lista).
//
// Só para quem aprova: a escola vê números, nunca de quem é a reserva
// (a promessa da migration 036). O RLS é quem garante; a tela nem oferece.
// ============================================================
import { lerOcupacao, livresNoPeriodo, escadaDaTarde, totalDoDia, ocupacaoDoPedido, DIA } from '../disponibilidade.model.js';
import { getSolicitacoesDoDia, STATUS, STATUS_RESERVA, PERIODOS } from '../sate.model.js';
import { getParticipacoesDe, resumoEscolas } from '../participacoes.model.js';
import { getFrotas, rotulaTipo } from '../frota.model.js';
import { paraHora, tituloDoPedido } from '../regras.model.js';
import { getDiaCalendario, situacaoDoDia, ROTULO_DIA } from '../../calendario/calendario.model.js';
import { esc } from '../../../shared/dom.js';
import { fmtExtenso } from '../../../shared/format.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

// O que o calendário escolar diz do dia - a mesma faixa no card da
// Disponibilidade e neste modal. No card o nome do evento é cortado com
// reticências (e vem inteiro no `title`); aqui, `completo`, ele quebra.
export function faixaCalendarioHtml(dia, { completo = false } = {}) {
  const sit = situacaoDoDia(dia);
  if (!sit) return '';
  const evento = String(dia.evento || '').trim();
  const rotulo = ROTULO_DIA[sit] ? `<b>${esc(ROTULO_DIA[sit])}</b>` : '';
  const tipo = sit === 'evento' && dia.tipo ? `<small>${esc(dia.tipo)}</small>` : '';
  return `<div class="disp-cal ${sit}${completo ? ' completo' : ''}" title="${esc(evento)}">
    ${ico('calendario', { tam: 13 })}${rotulo}${evento ? `<span>${esc(evento)}</span>` : ''}${tipo}
  </div>`;
}

// "13:10" no mesmo dia; "12:00 do dia seguinte" quando a ocupação vira a
// meia-noite (a viagem da noite segura o veículo até o meio-dia).
const horaLivre = (fim) => (fim >= DIA ? `${paraHora(fim - DIA)} do dia seguinte` : paraHora(fim));

export async function abrirDia(data, ctx, { voltar = null, destaque = null } = {}) {
  abrirModal(`
    ${modalHead('Disponibilidade do dia', esc(fmtExtenso(data)))}
    <div class="modal-body" id="dia-corpo">${loading()}</div>`, { tamanho: 'medio', voltar });
  const meu = document.getElementById('dia-corpo');

  let linha, pedidos, frotas, cal;
  try {
    [linha, pedidos, frotas, cal] = await Promise.all([
      lerOcupacao(data),
      getSolicitacoesDoDia(data),
      getFrotas({ vigenteEm: data }).catch(() => []),
      getDiaCalendario(data).catch(() => null),   // o calendário informa; não derruba o modal
    ]);
  } catch (err) {
    if (document.getElementById('dia-corpo') === meu) meu.innerHTML = erroBox(err);
    return;
  }
  const partes = await getParticipacoesDe(pedidos.map(s => s.id)).catch(() => ({}));
  if (document.getElementById('dia-corpo') !== meu) return;   // fechou, ou abriu outro, enquanto carregava

  meu.innerHTML = `
    ${faixaCalendarioHtml(cal, { completo: true })}
    ${frotaHtml(linha, frotas)}
    ${periodosHtml(linha)}
    ${viagensHtml(linha, pedidos, partes, destaque)}`;
}

function frotaHtml(linha, frotas) {
  const onibus = totalDoDia(linha, 0, 'onibus'), vans = totalDoDia(linha, 0, 'vans');
  const total = [`${onibus} ônibus`, vans ? `${vans} van(s) adaptada(s)` : ''].filter(Boolean).join(' · ');
  const composicao = frotas.length
    ? frotas.map(f => `<li>${esc(f.rotulo?.nome || 'sem rótulo')} · ${esc(String(f.quantidade))} ${esc(rotulaTipo(f.tipo).toLowerCase())}</li>`).join('')
    : '<li class="vazio">sem frota neste dia</li>';
  return `<section class="dia-secao">
    <h3>Frota do dia</h3>
    <p class="dia-total">${esc(total)}</p>
    <ul class="dia-lista">${composicao}</ul>
  </section>`;
}

// `livres` pode ficar negativo quando os pedidos estouram a frota: mostrar
// o estouro em vez de escondê-lo atrás de um "em uso" que não fecha a conta.
function periodosHtml(linha) {
  const total = totalDoDia(linha, 0, 'onibus');
  const linhaPer = (p) => {
    const livres = livresNoPeriodo(linha, 0, p, 'onibus');
    const emUso = Math.max(0, total - livres);
    let texto = `<b>${Math.max(0, livres)}</b> livres`;
    if (p === 'tarde') {
      texto = escadaDaTarde(linha, 0, 'onibus').map((g, k) => (k === 0
        ? `<b>${Math.max(0, g.livres)}</b> livres`
        : `<b>${Math.max(0, g.livres)}</b> a partir das ${esc(paraHora(g.aPartirDe))}`)).join(' · ');
    }
    const estouro = livres < 0 ? ` · <span class="dia-estouro">faltam ${-livres}</span>` : '';
    return `<div class="det-par"><span class="lbl">${esc(PERIODOS[p])}</span>
      <span>${texto} · ${emUso} em uso${estouro}</span></div>`;
  };
  return `<section class="dia-secao">
    <h3>Ônibus por período</h3>
    ${['manha', 'tarde', 'noite'].map(linhaPer).join('')}
    <p class="form-hint">Para uma viagem típica de cada período. O horário exato de cada viagem está abaixo.</p>
  </section>`;
}

function viagensHtml(linha, pedidos, partes, destaque) {
  const veiculos = (s) => [`${s.qtd_onibus || 0} ônibus`, s.qtd_vans ? `${s.qtd_vans} van(s)` : ''].filter(Boolean).join(' · ');
  const item = (s, ocupa) => {
    const iv = ocupacaoDoPedido(s, partes[s.id] || [], linha.intervaloMin);
    const quando = ocupa ? `${paraHora(iv.ini)} · livre às ${horaLivre(iv.fim)}` : 'não ocupa veículo';
    return `<li class="dia-viagem${s.id === destaque ? ' atual' : ''}${ocupa ? '' : ' fora'}"${s.id === destaque ? ' aria-current="true"' : ''}>
      <span class="dia-hora">${esc(quando)}</span>
      <b>${esc(resumoEscolas(partes[s.id] || []) || s.unidade?.nome || 'Gerência de Transporte')}</b>
      <span class="di-meta">${esc(tituloDoPedido(s))} · ${esc(veiculos(s))}</span>
      <span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>
    </li>`;
  };
  const inicio = (s) => ocupacaoDoPedido(s, partes[s.id] || [], linha.intervaloMin).ini;
  const ocupam = pedidos.filter(s => STATUS_RESERVA.includes(s.status)).sort((a, b) => inicio(a) - inicio(b));
  const pendentes = pedidos.filter(s => s.status === 'pendente_cancelamento');

  // Os ônibus da noite anterior seguram a manhã e não são viagem deste dia.
  const vespera = linha.ocup.filter(o => o.ini < 0 && o.fim > 0 && o.onibus > 0);
  const linhaVespera = vespera.length
    ? `<li class="dia-viagem vespera"><span class="dia-hora">até ${esc(paraHora(Math.max(...vespera.map(o => o.fim))))}</span>
        <b>${vespera.reduce((n, o) => n + o.onibus, 0)} ônibus da noite anterior</b></li>` : '';

  const linhas = linhaVespera + ocupam.map(s => item(s, true)).join('') + pendentes.map(s => item(s, false)).join('');
  return `<section class="dia-secao">
    <h3>Viagens do dia</h3>
    <ul class="dia-viagens">${linhas || '<li class="vazio">nenhuma viagem neste dia</li>'}</ul>
  </section>`;
}
