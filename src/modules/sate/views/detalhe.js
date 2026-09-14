// ============================================================
// FundHub - sate/views/detalhe.js
// O modal de uma solicitação: tudo o que ela é, e as decisões que
// cabem naquele status para aquela permissão.
// Spec: 2026-09-08-sate-solicitacoes-design.md § D4.
//
// Por que as decisões moram aqui e não em botões na linha da tabela:
// são cinco ações condicionais (analisar, confirmar, negar, cancelar,
// dar ciência), e três delas exigem justificativa. Espremer isso numa
// célula daria cinco ícones que aparecem e somem sem explicação.
//
// Negar, cancelar e pedir cancelamento abrem um SEGUNDO modal por cima
// (`{ voltar }`), com o campo de justificativa. Empilhado, e não
// substituindo: o ← devolve ao detalhe com o dado recarregado.
// ============================================================
import {
  porEmAnalise, confirmarSolicitacao, negarSolicitacao, cancelarSolicitacao,
  pedirCancelamento, confirmarCancelamento,
  STATUS, PERIODOS, STATUS_RESERVA,
} from '../sate.model.js';
import { abrirFrotaExtra } from './frota-extra.js';
import { abrirRemanejar } from './remanejar.js';
import { getParticipacoes } from '../participacoes.model.js';
import { blocoHtml, ligarParticipantes } from './participantes.js';
import { saldoDoDia, faltaParaConfirmar } from '../saldo.model.js';
import { pontosDaViagem, explicarTrajeto, atualizarTrajeto, retratoTrajeto } from '../rota.model.js';
import { linkRota } from '../../locais/locais.model.js';
import { velocidadeOnibusKmh, margemParadaMin } from '../sate.config.js';
import { esc, vazio, val, falha } from '../../../shared/dom.js';
import { fmtData, fmtDataHora } from '../../../shared/format.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { loading } from '../../../shared/ui/feedback.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

let ctx = null;
let atual = null;

export async function abrirDetalhe(solicitacao, contexto) {
  ctx = contexto;
  atual = solicitacao;
  const s = solicitacao;

  abrirModal(`
    ${modalHead(esc(nomeAtividade(s)), esc(s.unidade?.apelido || s.unidade?.nome || ''))}
    <div class="modal-body" id="det-corpo">${loading()}</div>`, { tamanho: 'medio' });

  // Participações e saldo vêm do banco; o resto já está na linha da tabela.
  const [paradas, saldo] = await Promise.all([
    getParticipacoes(s.id).catch(() => []),
    saldoDoDia(s.data).catch(() => null),
  ]);
  const corpo = document.getElementById('det-corpo');
  if (!corpo) return;   // fechou enquanto carregava

  corpo.innerHTML = `
    <div class="det-status">
      <span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>
      ${saldo ? `<span class="di-meta">${saldo.onibus[s.periodo].livre} de ${saldo.onibus[s.periodo].total} ônibus livres no dia</span>` : ''}
    </div>

    ${campo('Data', `${esc(fmtData(s.data))} · ${esc(PERIODOS[s.periodo] || s.periodo)}`)}
    ${campo('Turma(s)', s.turmas ? esc(s.turmas) : vazio('não informadas'))}
    ${campo('Estudantes', `${s.qtd_alunos || 0}${s.qtd_cadeirante ? ` · ${ico('cadeirante', { tam: 13 })} ${s.qtd_cadeirante} cadeirante(s)` : ''}`)}
    ${campo('Veículos', `${s.qtd_onibus || 0} ônibus${s.qtd_vans ? ` · ${s.qtd_vans} van(s) adaptada(s)` : ''}`)}
    ${campo('Horários', s.horario_embarque || s.horario_retorno
      ? `embarque ${esc(s.horario_embarque || '—')} · retorno ${esc(s.horario_retorno || '—')}`
      : vazio('não informados'))}
    ${campo('Destino', esc(destino(s)) || vazio('não informado'))}
    ${campo('Trajeto', trajetoHtml(s, paradas))}
    ${s.contato_professor ? campo('Contato', esc(s.contato_professor)) : ''}
    ${s.observacao ? campo('Observação', esc(s.observacao)) : ''}

    <hr class="sep" />
    ${blocoHtml(paradas, ctx)}

    ${s.motivo ? `<hr class="sep" />${campo('Justificativa', esc(s.motivo))}` : ''}
    ${s.decidido_por ? campo('Decidido por', `${esc(s.decidido_por)}${s.decidido_em ? ` · ${esc(fmtDataHora(s.decidido_em))}` : ''}`) : ''}

    <div class="modal-acoes det-acoes-pe">${acoes(s)}</div>`;

  corpo.addEventListener('click', aoClicarAcao);
  corpo.querySelector('#det-recalc')?.addEventListener('click', (e) => recalcular(e.currentTarget, s));
  // `reabrir` e esta propria funcao: depois de mexer numa escola a
  // viagem volta a abrir com o dado novo, em vez de fechar a pilha.
  ligarParticipantes(corpo, {
    ctx, solicitacao: s, partes: paradas, reabrir: () => abrirDetalhe(s, ctx),
  });
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
  const destino = (ctx.locais || []).find(l => l.id === s.local_id) || null;
  const vivo = pontosDaViagem(paradas, destino);
  const gravado = s.trajeto_status === 'ok' && s.trajeto_km != null;

  let texto;
  if (gravado) texto = esc(explicarTrajeto({ status: 'ok', km: s.trajeto_km, min: s.trajeto_min }));
  else if (vivo.status !== 'ok') texto = vazio(explicarTrajeto(vivo));
  else if (s.trajeto_status === 'erro') texto = vazio(explicarTrajeto({ status: 'erro' }));
  else texto = vazio('ainda não calculado');

  const mapa = linkRota(vivo.pontos);
  const extras = [
    mapa ? `<a href="${esc(mapa)}" target="_blank" rel="noopener">${ico('externo', { tam: 12 })} Ver rota no mapa</a>` : '',
    ctx.aprovador && vivo.status === 'ok'
      ? `<button type="button" class="mini-btn" id="det-recalc">${ico('atualizar', { tam: 12 })} Recalcular</button>` : '',
    gravado ? `<span class="det-trajeto-fonte">Distância: © OpenStreetMap</span>` : '',
  ].filter(Boolean).join('');

  return `${texto}${extras ? `<div class="det-trajeto-extras">${extras}</div>` : ''}`;
}

// Para depois de cadastrar uma localização que faltava. Atualiza a linha
// em memória com o retrato novo e reabre: o detalhe desenha a partir
// dela, e a tabela embaixo recarrega por conta própria.
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

const campo = (rotulo, html) =>
  `<div class="field"><div class="lbl">${esc(rotulo)}</div><div class="val">${html}</div></div>`;

const nomeAtividade = (s) => s.atividade?.nome || s.atividade_livre || 'Solicitação de transporte';
const destino = (s) => s.destino_nome || s.atividade?.local_nome || '';

// Só as ações que cabem naquele status para aquela permissão (spec D4).
// Esconder botão é conforto; quem barra de fato é o RLS (R6).
function acoes(s) {
  // Vendo como a escola: nenhuma decisão. Os botões seriam os da escola,
  // mas quem clicaria é quem aprova, com os poderes dele no banco.
  if (ctx.somenteLeitura) return '';
  const ap = !!ctx.aprovador;
  const b = (acao, rotulo, classe = 'btn-secundario', icone = null) =>
    `<button type="button" class="${classe}" data-acao="${acao}">${icone ? ico(icone) + ' ' : ''}${esc(rotulo)}</button>`;

  const remanejar = ap && !['negado', 'cancelado'].includes(s.status)
    ? b('remanejar', 'Remanejar', 'btn-secundario', 'editar') : '';
  return remanejar + decisoes(s, ap, b);
}

function decisoes(s, ap, b) {
  if (s.status === 'solicitado') {
    return ap
      ? b('analisar', 'Pôr em análise') + b('negar', 'Negar', 'btn-perigo') + b('confirmar', 'Confirmar', 'btn-primary', 'ok')
      : b('cancelar', 'Cancelar solicitação', 'btn-perigo');
  }
  if (s.status === 'em_analise' || s.status === 'aguardando_transporte_adaptado') {
    return ap ? b('negar', 'Negar', 'btn-perigo') + b('confirmar', 'Confirmar', 'btn-primary', 'ok') : '';
  }
  if (s.status === 'confirmado') {
    return ap ? b('cancelar', 'Cancelar', 'btn-perigo') : b('pedir', 'Pedir cancelamento', 'btn-secundario');
  }
  if (s.status === 'pendente_cancelamento') {
    return ap ? b('ciencia', 'Confirmar cancelamento', 'btn-primary', 'ok') : '';
  }
  return '';   // negado e cancelado: não há mais o que decidir
}

function aoClicarAcao(e) {
  const btn = e.target.closest('[data-acao]');
  if (!btn) return;
  const acao = btn.dataset.acao;

  // As três que exigem justificativa abrem o modal empilhado.
  const COM_MOTIVO = {
    negar: { titulo: 'Negar solicitação', rotulo: 'Por que está sendo negada?', botao: 'Negar', fn: negarSolicitacao },
    cancelar: { titulo: 'Cancelar solicitação', rotulo: 'Por que está sendo cancelada?', botao: 'Cancelar solicitação', fn: cancelarSolicitacao },
    pedir: { titulo: 'Pedir cancelamento', rotulo: 'Por que a escola precisa cancelar?', botao: 'Enviar pedido', fn: pedirCancelamento },
  };
  if (COM_MOTIVO[acao]) return pedirMotivo(COM_MOTIVO[acao]);

  if (acao === 'remanejar') return abrirRemanejar(atual, ctx, () => abrirDetalhe(atual, ctx));
  if (acao === 'confirmar') return confirmar(btn);

  const DIRETA = {
    analisar: { fn: porEmAnalise, titulo: 'Solicitação em análise' },
    ciencia: { fn: confirmarCancelamento, titulo: 'Cancelamento confirmado' },
  };
  if (DIRETA[acao]) return executar(DIRETA[acao].fn, DIRETA[acao].titulo);
}

// Confirmar olha a frota ANTES (spec 2026-09-13-sate-ciclo-de-aprovacao,
// D1). Cabe: confirma direto. Não cabe: o modal da frota extra decide - e
// é por ele que "aguardando transporte adaptado" passa a acontecer (D2).
// Saldo relido no clique, não o da abertura do detalhe: outro aprovador
// pode ter confirmado algo no meio tempo.
async function confirmar(btn) {
  const s = atual;
  btn.disabled = true;
  try {
    const falta = faltaParaConfirmar(s, await saldoDoDia(s.data), { jaReservado: STATUS_RESERVA.includes(s.status) });
    if (falta.onibus || falta.vans) {
      return abrirFrotaExtra({ solicitacao: s, falta, modo: 'confirmar', ctx, reabrir: () => abrirDetalhe(s, ctx) });
    }
    await executar(confirmarSolicitacao, 'Solicitação confirmada');
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível confirmar' });
  } finally {
    btn.disabled = false;
  }
}

// Modal POR CIMA do detalhe. `voltar` reabre o detalhe com o dado
// recarregado - é o que a pilha de modal.js faz, e por isso guardamos a
// função e não o HTML.
function pedirMotivo({ titulo, rotulo, botao, fn }) {
  const s = atual;
  abrirModal(`
    ${modalHead(esc(titulo), esc(nomeAtividade(s)))}
    <div class="modal-body">
      <form id="mot-form" class="esc-form">
        <label>${esc(rotulo)}
          <textarea id="mot-txt" rows="4" required
            placeholder="A escola vê esta justificativa."></textarea></label>
        <div class="form-foot">
          <span id="mot-msg" class="auth-msg"></span>
          <button type="submit" class="btn-perigo" id="mot-ok">${esc(botao)}</button>
        </div>
      </form>
    </div>`, { tamanho: 'estreito', voltar: () => abrirDetalhe(s, ctx) });

  document.getElementById('mot-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = document.getElementById('mot-msg'); msg.className = 'auth-msg';
    const texto = val('mot-txt');
    // O banco também exige (CHECK da migration 035). Aqui é para a
    // pessoa saber antes de o servidor recusar.
    if (!texto) return falha(msg, 'A justificativa é obrigatória.');
    const btn = document.getElementById('mot-ok');
    btn.disabled = true;
    try {
      await fn(s.id, texto);
      fechaTudo();
      toast({ titulo, texto: nomeAtividade(s), tipo: 'sucesso' });
    } catch (err) {
      reportarErro(err, { msg, titulo: 'Não foi possível concluir' });
      btn.disabled = false;
    }
  });
}

async function executar(fn, titulo) {
  try {
    await fn(atual.id);
    fechaTudo();
    toast({ titulo, texto: nomeAtividade(atual), tipo: 'sucesso' });
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível concluir' });
  }
}

// Depois de decidir não há para onde voltar: `{ tudo: true }` fecha a
// pilha inteira em vez de desempilhar para o detalhe da solicitação que
// acabou de mudar de status.
function fechaTudo() {
  fecharModal({ tudo: true });
  ctx.recarregar?.();
}
