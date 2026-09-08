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
  STATUS, PERIODOS,
} from '../sate.model.js';
import {
  getParticipacoes, pedirSaida, confirmarSaida, voltarAtras,
  STATUS_PART, ativa,
} from '../participacoes.model.js';
import { saldoDoDia } from '../saldo.model.js';
import { esc, vazio, val, falha } from '../../../shared/dom.js';
import { fmtData, fmtDataHora } from '../../../shared/format.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { loading } from '../../../shared/ui/feedback.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

let ctx = null;
let atual = null;
let partes = [];

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
  partes = paradas;
  const corpo = document.getElementById('det-corpo');
  if (!corpo) return;   // fechou enquanto carregava

  corpo.innerHTML = `
    <div class="det-status">
      <span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>
      ${saldo ? `<span class="di-meta">${saldo.onibus[s.periodo].livre} de ${saldo.onibus[s.periodo].total} ônibus livres no dia</span>` : ''}
    </div>

    ${campo('Data', `${esc(fmtData(s.data))} · ${esc(PERIODOS[s.periodo] || s.periodo)}`)}
    ${campo('Turma(s)', s.turmas ? esc(s.turmas) : vazio('não informadas'))}
    ${campo('Estudantes', `${s.qtd_alunos || 0}${s.qtd_cadeirante ? ` · ${s.qtd_cadeirante} cadeirante(s)` : ''}`)}
    ${campo('Veículos', `${s.qtd_onibus || 0} ônibus${s.qtd_vans ? ` · ${s.qtd_vans} van(s) adaptada(s)` : ''}`)}
    ${campo('Horários', s.horario_embarque || s.horario_retorno
      ? `embarque ${esc(s.horario_embarque || '—')} · retorno ${esc(s.horario_retorno || '—')}`
      : vazio('não informados'))}
    ${campo('Destino', esc(destino(s)) || vazio('não informado'))}
    ${s.contato_professor ? campo('Contato', esc(s.contato_professor)) : ''}
    ${s.observacao ? campo('Observação', esc(s.observacao)) : ''}

    <hr class="sep" />
    <div class="field"><div class="lbl">Escolas nesta viagem</div>
      <div class="det-partes">${paradas.length
        ? paradas.map(linhaParte).join('')
        : vazio('nenhuma escola vinculada')}</div></div>

    ${s.motivo ? `<hr class="sep" />${campo('Justificativa', esc(s.motivo))}` : ''}
    ${s.decidido_por ? campo('Decidido por', `${esc(s.decidido_por)}${s.decidido_em ? ` · ${esc(fmtDataHora(s.decidido_em))}` : ''}`) : ''}

    <div class="modal-acoes det-acoes-pe">${acoes(s)}</div>`;

  corpo.addEventListener('click', aoClicarAcao);
}

// Uma linha por escola na viagem. A escola vê a SUA com o botão de pedir
// saída; quem aprova vê todas, com a confirmação de quem pediu para sair.
// Cancelada continua na lista, e é por ela ficar que a escola que
// desistiu continua vendo o registro do que aconteceu.
function linhaParte(p) {
  const nome = p.unidade?.apelido || p.unidade?.nome || p.local?.nome || '—';
  const minha = !ctx.aprovador && (ctx.perfil?.unidades || []).includes(p.unidade_id);
  const ap = !!ctx.aprovador;

  let acao = '';
  if (p.status === 'ativa' && (minha || ap)) {
    acao = `<button type="button" class="mini-btn no" data-sair="${esc(p.id)}">Sair da viagem</button>`;
  } else if (p.status === 'pendente_cancelamento') {
    acao = ap
      ? `<button type="button" class="mini-btn" data-desfazer="${esc(p.id)}">Manter</button>`
        + `<button type="button" class="mini-btn no" data-confirmar-saida="${esc(p.id)}">Confirmar saída</button>`
      : `<button type="button" class="mini-btn" data-desfazer="${esc(p.id)}">Desistir do pedido</button>`;
  }

  return `<div class="det-parte ${p.status !== 'ativa' ? 'fora' : ''}">
    <span class="det-parte-ordem">${p.ordem}</span>
    <b>${esc(nome)}</b>
    <span class="di-meta">${p.qtd_alunos || 0} estudante(s)${p.qtd_cadeirante ? ` · ${p.qtd_cadeirante} cadeirante(s)` : ''}${p.horario ? ` · ${esc(p.horario)}` : ''}</span>
    ${p.status !== 'ativa' ? `<span class="tag st-${esc(p.status === 'cancelada' ? 'cancelado' : 'em_analise')}">${esc(STATUS_PART[p.status])}</span>` : ''}
    ${p.motivo ? `<span class="di-meta det-parte-motivo">${esc(p.motivo)}</span>` : ''}
    ${acao}
  </div>`;
}

const campo = (rotulo, html) =>
  `<div class="field"><div class="lbl">${esc(rotulo)}</div><div class="val">${html}</div></div>`;

const nomeAtividade = (s) => s.atividade?.nome || s.atividade_livre || 'Solicitação de transporte';
const destino = (s) => s.destino_nome || s.atividade?.local_nome || '';

// Só as ações que cabem naquele status para aquela permissão (spec D4).
// Esconder botão é conforto; quem barra de fato é o RLS (R6).
function acoes(s) {
  const ap = !!ctx.aprovador;
  const b = (acao, rotulo, classe = 'btn-secundario', icone = null) =>
    `<button type="button" class="${classe}" data-acao="${acao}">${icone ? ico(icone) + ' ' : ''}${esc(rotulo)}</button>`;

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
  // Ações de PARTICIPAÇÃO: mexem numa escola, não na viagem inteira.
  const sair = e.target.closest('[data-sair]');
  if (sair) {
    const p = partes.find(x => x.id === sair.dataset.sair);
    return pedirMotivo({
      titulo: 'Sair da viagem', botao: 'Enviar pedido',
      rotulo: `Por que ${esc(p?.unidade?.apelido || p?.unidade?.nome || 'esta escola')} precisa sair?`,
      fn: (_id, motivo) => pedirSaida(sair.dataset.sair, motivo),
    });
  }
  const desf = e.target.closest('[data-desfazer]');
  if (desf) return executarParte(() => voltarAtras(desf.dataset.desfazer), 'Participação mantida');
  const conf = e.target.closest('[data-confirmar-saida]');
  if (conf) return executarParte(() => confirmarSaida(conf.dataset.confirmarSaida), 'Saída confirmada');

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

  const DIRETA = {
    analisar: { fn: porEmAnalise, titulo: 'Solicitação em análise' },
    confirmar: { fn: confirmarSolicitacao, titulo: 'Solicitação confirmada' },
    ciencia: { fn: confirmarCancelamento, titulo: 'Cancelamento confirmado' },
  };
  if (DIRETA[acao]) return executar(DIRETA[acao].fn, DIRETA[acao].titulo);
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

// Diferente de decidir a viagem: aqui a pilha NÃO fecha. Quem aprova
// acabou de tirar uma escola e, no caso real que motivou este modelo,
// vai pôr outra no lugar em seguida - fechar tudo o obrigaria a
// reabrir a mesma viagem.
async function executarParte(fn, titulo) {
  try {
    await fn();
    toast({ titulo, texto: nomeAtividade(atual), tipo: 'sucesso' });
    await abrirDetalhe(atual, ctx);
    ctx.recarregar?.();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível concluir' });
  }
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
