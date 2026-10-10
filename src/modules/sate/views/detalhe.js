// ============================================================
// FundHub - sate/views/detalhe.js
// A ficha "Detalhes da solicitação": tudo o que ela é.
// Spec: 2026-10-10-sate-solicitacao-reformulada-design.md § D3.
//
// De cima para baixo, na ordem em que a pessoa precisa:
//   quadro-resumo  o que identifica a viagem de relance (destino, data,
//                  horários, endereço), com a cor da situação na lateral;
//   justificativa  em destaque, quando o pedido foi negado, cancelado ou
//                  tem cancelamento pedido - é o que mais importa ali;
//   Solicitação    quem pediu e para quem;
//   Logística      como a viagem acontece: horários, veículos, trajeto e
//                  as paradas;
//   histórico      quem pediu e quem decidiu, e quando;
//   decisões       no pé (views/decisoes.js).
//
// Rótulo e valor ficam LADO A LADO (`.det-par`, o par do hub). Só aparece
// o que tem valor: sem cadeirante, não há "0 cadeirantes".
//
// O título é o que o modal É, não o destino (ui.md, "Como um modal se
// chama"): uma solicitação não tem nome próprio.
// ============================================================
import { localAConferir, acoesDoPedido, STATUS, PERIODOS } from '../sate.model.js';
import { abrirEditar } from './editar.js';
import { abrirConferirDoPedido } from './conferir-local.js';
import { abrirDia } from './dia.js';
import { decisoesHtml, ligarDecisoes } from './decisoes.js';
import { getParticipacoes, resumoEscolas } from '../participacoes.model.js';
import { blocoHtml, ligarParticipantes } from './participantes.js';
import { pontosDaViagem, explicarTrajeto, atualizarTrajeto, retratoTrajeto } from '../rota.model.js';
import { linkRota, linkMaps } from '../../locais/geografia.model.js';
import { enderecoCompleto } from '../../locais/locais.model.js';
import { velocidadeOnibusKmh, margemParadaMin } from '../sate.config.js';
import { esc, vazio, urlSegura } from '../../../shared/dom.js';
import { fmtData, fmtDataHora, fmtCep } from '../../../shared/format.js';
import { exibirTelefone } from '../../../shared/ui/phones.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { loading, reportarErro } from '../../../shared/ui/feedback.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';

let ctx = null;

export async function abrirDetalhe(solicitacao, contexto) {
  ctx = contexto;
  const s = solicitacao;
  const reabrir = () => abrirDetalhe(s, ctx);
  const quem = s._escolas || s.unidade?.nome || 'Gerência de Transporte';

  abrirModal(`
    ${modalHead('Detalhes da solicitação', `${esc(quem)} · ${esc(fmtData(s.data))}`)}
    <div class="modal-body" id="det-corpo">${loading()}</div>`, { tamanho: 'medio' });

  // As paradas vêm do banco; o resto já está na linha da tabela.
  const paradas = await getParticipacoes(s.id).catch(() => []);
  const corpo = document.getElementById('det-corpo');
  if (!corpo) return;   // fechou enquanto carregava
  // Duas aberturas quase juntas (clique duplo na linha) chegam aqui com o
  // MESMO nó: só a primeira desenha e liga os ouvintes.
  if (corpo.dataset.ligado) return;
  corpo.dataset.ligado = '1';

  const pode = acoesDoPedido(s, { aprovador: !!ctx.aprovador, somenteLeitura: !!ctx.somenteLeitura });

  corpo.innerHTML = `
    ${resumoHtml(s, pode.editar)}
    ${motivoHtml(s)}

    <div class="ficha-secao"><h3>Solicitação</h3></div>
    ${par('Escola', esc(resumoEscolas(paradas) || quem))}
    ${par('Situação', `<span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>`)}
    ${par('Turma(s)', s.turmas ? esc(s.turmas) : '')}
    ${responsavelHtml(s)}
    ${par('Estudantes', estudantesHtml(s, paradas))}
    ${par('Observação', s.observacao ? esc(s.observacao) : '')}

    <div class="ficha-secao det-secao">
      <h3>Logística</h3>
      ${ctx.aprovador ? `<div class="ficha-secao-acoes">
        <button type="button" class="mini-btn" id="det-dia">${ico('calendario', { tam: 13 })} Ver disponibilidade do dia</button>
      </div>` : ''}
    </div>
    ${par('Embarque', s.horario_embarque ? `<b>${esc(s.horario_embarque)}</b>` : '')}
    ${par('Saída do evento', s.horario_retorno ? `<b>${esc(s.horario_retorno)}</b>` : '')}
    ${par('Veículos', `${esc(String(s.qtd_onibus || 0))} ônibus${s.qtd_vans ? ` · ${esc(String(s.qtd_vans))} van(s) adaptada(s)` : ''}`)}
    ${par('Trajeto', trajetoHtml(s, paradas))}
    ${blocoHtml(paradas, ctx)}

    ${historicoHtml(s)}
    ${decisoesHtml(s, pode.decisoes)}`;

  corpo.querySelector('#det-editar')?.addEventListener('click', () => abrirEditar(s, ctx, reabrir));
  corpo.querySelector('#det-dia')?.addEventListener('click', () => abrirDia(s.data, ctx, { voltar: reabrir, destaque: s.id }));
  corpo.querySelector('#det-recalc')?.addEventListener('click', (e) => recalcular(e.currentTarget, s));
  corpo.querySelector('#det-conferir')?.addEventListener('click', () => abrirConferirDoPedido(s, ctx, reabrir));
  ligarDecisoes(corpo, { s, ctx, paradas, reabrir });
  // `reabrir` e esta propria funcao: depois de mexer numa escola a
  // viagem volta a abrir com o dado novo, em vez de fechar a pilha.
  ligarParticipantes(corpo, { ctx, solicitacao: s, partes: paradas, reabrir });
}

// O par rótulo → valor do hub (`.det-par`, components.css). Sem valor,
// não há linha: a ficha mostra o que existe.
const par = (rotulo, html) =>
  (html ? `<div class="det-par"><span class="lbl">${esc(rotulo)}</span><span>${html}</span></div>` : '');

// ── Quadro-resumo ────────────────────────────────────────────
// O `.ficha-info` de toda ficha do hub, com a cor da SITUAÇÃO na lateral
// (a mesma da etiqueta) e o lápis no canto quando dá para editar.
function resumoHtml(s, podeEditar) {
  const linha = (icone, html) => (html ? `<li>${ico(icone, { tam: 14 })} ${html}</li>` : '');
  const horas = [s.horario_embarque, s.horario_retorno].filter(Boolean).map(esc).join(' – ');
  return `<section class="ficha-info det-resumo st-${esc(s.status)}">
    ${podeEditar ? `<button type="button" class="mini-btn ficha-editar" id="det-editar"
      aria-label="Editar solicitação" title="Editar solicitação">${ico('editar')}</button>` : ''}
    <b class="det-destino">${destino(s) ? esc(destino(s)) : vazio('destino não informado')}</b>
    <ul class="ficha-contato">
      ${linha('calendario', `${esc(fmtData(s.data))} <span class="tag">${esc(PERIODOS[s.periodo] || s.periodo || '')}</span>`)}
      ${linha('horario', horas)}
      ${linha('visita', enderecoHtml(s))}
    </ul>
  </section>`;
}

const destino = (s) => s.destino_nome || s.atividade?.local_nome || '';
const localDe = (s) => (ctx.locais || []).find(l => l.id === s.local_id) || null;

// O CEP vem do local do cadastro quando o pedido aponta para um; senão
// (ou se o local saiu do cadastro), do que ficou gravado no pedido.
const cepDestino = (s) => localDe(s)?.cep || s.destino_cep || '';

// Endereço do destino: as três partes (spec 2026-09-27, D3), com o
// endereço da atividade como último recurso para pedidos antigos.
function enderecoDestino(s) {
  const linha = enderecoCompleto({ endereco: s.destino_endereco, numero: s.destino_numero, bairro: s.destino_bairro })
    || s.atividade?.local_endereco || '';
  return linha && cepDestino(s) ? `${linha} · CEP ${fmtCep(cepDestino(s))}` : linha;
}

// O endereço, o link do mapa (só de local do cadastro, que tem ponto) e,
// para destino digitado pela escola (spec 2026-09-27, D6), a etiqueta
// "Local a conferir" - com o botão para quem aprova.
function enderecoHtml(s) {
  const l = localDe(s);
  const mapa = l ? (l.maps_url || linkMaps(l.latitude, l.longitude)) : null;
  const partes = [
    enderecoDestino(s) ? esc(enderecoDestino(s)) : '',
    urlSegura(mapa) ? `<a href="${esc(mapa)}" target="_blank" rel="noopener">ver no mapa</a>` : '',
  ].filter(Boolean).join(' · ');
  if (!localAConferir(s)) return partes;
  const botao = ctx.aprovador && !ctx.somenteLeitura
    ? ` <button type="button" class="mini-btn" id="det-conferir">Conferir local</button>` : '';
  return `${partes} <span class="tag">Local a conferir</span>${botao}`;
}

// ── Justificativa ────────────────────────────────────────────
// Negado, cancelado e cancelamento pedido carregam o porquê - e, nesses
// casos, é a primeira coisa que a pessoa precisa ler.
const ROTULO_MOTIVO = { negado: 'Negada', cancelado: 'Cancelada', pendente_cancelamento: 'Cancelamento pedido' };

const motivoHtml = (s) => (s.motivo
  ? `<p class="det-motivo st-${esc(s.status)}"><b>${esc(ROTULO_MOTIVO[s.status] || 'Justificativa')}:</b> ${esc(s.motivo)}</p>` : '');

// ── Solicitação ──────────────────────────────────────────────
// Responsável: os campos novos (spec 2026-09-27, D8), com o telefone como
// link; nos pedidos anteriores a eles, o texto livre que havia.
function responsavelHtml(s) {
  if (!s.professor_nome && !s.professor_telefone) return par('Responsável', s.contato_professor ? esc(s.contato_professor) : '');
  return par('Responsável', s.professor_nome ? esc(s.professor_nome) : '')
    + par('Telefone', s.professor_telefone
      ? `<a href="tel:${esc(s.professor_telefone)}">${esc(exibirTelefone(s.professor_telefone))}</a>` : '');
}

// O total e o que pede atenção, numa linha. Surdos e "outra necessidade"
// vêm das paradas ATIVAS (spec 2026-09-27, D8): cancelada não embarca.
function estudantesHtml(s, paradas) {
  const ativas = (paradas || []).filter(p => p.status === 'ativa');
  const surdos = ativas.reduce((n, p) => n + (Number(p.qtd_surdo) || 0), 0);
  return [
    esc(String(s.qtd_alunos || 0)),
    s.qtd_cadeirante ? `${ico('cadeirante', { tam: 13 })} ${esc(String(s.qtd_cadeirante))} cadeirante(s)` : '',
    surdos ? `${surdos} surdo(s)` : '',
    ativas.some(p => p.necessidade_especifica) ? 'outra necessidade específica' : '',
  ].filter(Boolean).join(' · ');
}

// ── Trajeto ──────────────────────────────────────────────────
// O que se MOSTRA é o retrato gravado (spec 2026-09-13-sate-rota, D4): é
// ele que a regra do intervalo usa, e mostrar outro número induziria a
// decidir por uma conta que o sistema não está fazendo.
//
// O que se CALCULA AO VIVO é só o diagnóstico - quais paradas estão sem
// localização e o link do mapa -, porque isso sai das participações já
// carregadas e não gasta consulta nenhuma.
function trajetoHtml(s, paradas) {
  const vivo = pontosDaViagem(paradas, localDe(s));
  const gravado = s.trajeto_status === 'ok' && s.trajeto_km != null;

  let texto;
  if (gravado) texto = esc(explicarTrajeto({ status: 'ok', km: s.trajeto_km, min: s.trajeto_min }));
  else if (vivo.status !== 'ok') texto = vazio(explicarTrajeto(vivo));
  else if (s.trajeto_status === 'erro') texto = vazio(explicarTrajeto({ status: 'erro' }));
  else texto = vazio('ainda não calculado');

  const mapa = linkRota(vivo.pontos);
  const extras = [
    mapa ? `<a href="${esc(mapa)}" target="_blank" rel="noopener">${ico('externo', { tam: 12 })} Ver rota no mapa</a>` : '',
    ctx.aprovador && !ctx.somenteLeitura && vivo.status === 'ok'
      ? `<button type="button" class="mini-btn" id="det-recalc">${ico('atualizar', { tam: 12 })} Recalcular</button>` : '',
    gravado ? `<span class="det-trajeto-fonte">Distância: © OpenStreetMap</span>` : '',
  ].filter(Boolean).join('');

  return `${texto}${extras ? `<div class="det-trajeto-extras">${extras}</div>` : ''}`;
}

// Para depois de cadastrar uma localização que faltava. Atualiza a linha
// em memória com o retrato novo e reabre: a ficha desenha a partir dela,
// e a tabela embaixo recarrega por conta própria.
async function recalcular(btn, s) {
  btn.disabled = true;
  try {
    const r = await atualizarTrajeto(s, { velocidadeKmh: velocidadeOnibusKmh(), margemMin: margemParadaMin() });
    Object.assign(s, retratoTrajeto(r));
    toast({ titulo: r.status === 'ok' ? 'Trajeto recalculado' : 'Trajeto não calculado',
      texto: explicarTrajeto(r), tipo: r.status === 'ok' ? 'sucesso' : 'atencao' });
    await abrirDetalhe(s, ctx);
    ctx.recarregar?.();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível recalcular' });
    btn.disabled = false;
  }
}

// ── Histórico ────────────────────────────────────────────────
// Quem pediu e quem decidiu, e quando. Mostra a decisão EM VIGOR; as
// idas e vindas ficam na Auditoria. Timestamp só por fmtDataHora (R8).
const ROTULO_DECISAO = { confirmado: 'Confirmado por', negado: 'Negado por', cancelado: 'Cancelado por' };

function historicoHtml(s) {
  const quando = (quem, ts) => [quem ? esc(quem) : '', ts ? `em ${esc(fmtDataHora(ts))}` : ''].filter(Boolean).join(' ');
  const linhas = par('Solicitado por', quando(s.criado_por, s.criado_em))
    + (ROTULO_DECISAO[s.status] ? par(ROTULO_DECISAO[s.status], quando(s.decidido_por, s.decidido_em)) : '');
  return linhas ? `<section class="det-historico">
    <div class="ficha-secao"><h3>${ico('horario', { tam: 12 })} Histórico</h3></div>
    ${linhas}
  </section>` : '';
}
