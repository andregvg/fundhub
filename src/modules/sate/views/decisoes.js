// ============================================================
// FundHub - sate/views/decisoes.js
// As DECISÕES sobre uma solicitação: os botões que cabem naquela situação
// para aquela permissão, e o que cada um faz.
// Spec: 2026-10-10-sate-solicitacao-reformulada-design.md § D5 e D9.
//
// Saiu de `detalhe.js` na reformulação da ficha. A fronteira não é de
// tamanho: mostrar não é decidir. Aqui mora o que tem consequência -
// conferir a frota antes de confirmar, exigir justificativa para negar e
// cancelar, avisar que reabrir volta a reservar veículo. As duas telas se
// tocam em dois pontos, e só: o rodapé que a ficha desenha e o `ligar`
// que ela chama.
//
// QUAIS decisões cabem não é daqui: vem de acoesDoPedido() (sate.model.js),
// pura e testada. Esconder botão é conforto; quem barra é o RLS (R6).
//
// Negar, cancelar e pedir cancelamento abrem um SEGUNDO modal por cima
// (`{ voltar }`), com o campo de justificativa. Empilhado, e não
// substituindo: o ← devolve à ficha com o dado recarregado.
// ============================================================
import {
  porEmAnalise, confirmarSolicitacao, negarSolicitacao, cancelarSolicitacao,
  pedirCancelamento, confirmarCancelamento, reabrirSolicitacao, localAConferir,
} from '../sate.model.js';
import { tituloDoPedido } from '../regras.model.js';
import { abrirFrotaExtra } from './frota-extra.js';
import { lerOcupacao, faltaParaConfirmar } from '../disponibilidade.model.js';
import { esc, val, falhaNoCampo } from '../../../shared/dom.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { ico } from '../../../shared/ui/icones.js';

// Rótulo, classe e ícone de cada decisão. "Reabrir" muda de nome conforme
// de onde vem: de um pedido confirmado, a pessoa está voltando atrás.
const BOTAO = {
  analisar: { rotulo: 'Pôr em análise' },
  negar: { rotulo: 'Negar', classe: 'btn-perigo' },
  confirmar: { rotulo: 'Confirmar', classe: 'btn-primary', icone: 'ok' },
  cancelar: { rotulo: 'Cancelar solicitação', classe: 'btn-perigo' },
  pedir: { rotulo: 'Pedir cancelamento' },
  ciencia: { rotulo: 'Confirmar cancelamento', classe: 'btn-primary', icone: 'ok' },
  reabrir: { rotulo: 'Reabrir' },
};

export function decisoesHtml(s, decisoes) {
  if (!decisoes.length) return '';
  const botao = (acao) => {
    const b = BOTAO[acao];
    const rotulo = acao === 'reabrir' && s.status === 'confirmado' ? 'Voltar para análise' : b.rotulo;
    return `<button type="button" class="${b.classe || 'btn-secundario'}" data-acao="${acao}">${b.icone ? ico(b.icone) + ' ' : ''}${esc(rotulo)}</button>`;
  };
  return `<div class="modal-acoes det-acoes-pe">${decisoes.map(botao).join('')}</div>`;
}

// `corpo` é o nó da ficha, recriado a cada abertura. Um ouvinte só, para
// todos os botões `[data-acao]`. `paradas` é para confirmar() calcular o
// mesmo embarque efetivo do badge; `reabrir` reabre a ficha.
export function ligarDecisoes(corpo, { s, ctx, paradas, reabrir }) {
  // Depois de decidir não há para onde voltar: `{ tudo: true }` fecha a
  // pilha inteira em vez de desempilhar para a ficha da solicitação que
  // acabou de mudar de status.
  const fechaTudo = () => {
    fecharModal({ tudo: true });
    ctx.recarregar?.();
  };

  const executar = async (fn, titulo) => {
    try {
      await fn(s.id);
      fechaTudo();
      toast({ titulo, texto: tituloDoPedido(s), tipo: 'sucesso' });
    } catch (err) {
      reportarErro(err, { titulo: 'Não foi possível concluir' });
    }
  };

  corpo.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-acao]');
    if (!btn) return;
    const acao = btn.dataset.acao;

    // As três que exigem justificativa abrem o modal empilhado.
    const COM_MOTIVO = {
      negar: { titulo: 'Negar solicitação', rotulo: 'Por que está sendo negada?', botao: 'Negar', fn: negarSolicitacao },
      cancelar: { titulo: 'Cancelar solicitação', rotulo: 'Por que está sendo cancelada?', botao: 'Cancelar solicitação', fn: cancelarSolicitacao },
      pedir: { titulo: 'Pedir cancelamento', rotulo: 'Por que a escola precisa cancelar?', botao: 'Enviar pedido', fn: pedirCancelamento },
    };
    if (COM_MOTIVO[acao]) return pedirMotivo(COM_MOTIVO[acao], { s, reabrir, fechaTudo });

    if (acao === 'confirmar') return confirmarPedido(btn, { s, ctx, paradas, reabrir, executar });
    if (acao === 'reabrir') return reabrirPedido(btn, { s, paradas, executar });

    const DIRETA = {
      analisar: { fn: porEmAnalise, titulo: 'Solicitação em análise' },
      ciencia: { fn: confirmarCancelamento, titulo: 'Cancelamento confirmado' },
    };
    if (DIRETA[acao]) return executar(DIRETA[acao].fn, DIRETA[acao].titulo);
  });
}

// Confirmar olha a frota ANTES (spec 2026-09-13-sate-ciclo-de-aprovacao,
// D1). Cabe: confirma direto. Não cabe: o modal da frota extra decide - e
// é por ele que "aguardando transporte adaptado" passa a acontecer (D2).
// Saldo relido no clique, não o da abertura da ficha: outro aprovador
// pode ter confirmado algo no meio tempo.
async function confirmarPedido(btn, { s, ctx, paradas, reabrir, executar }) {
  // Local ainda não conferido: a vaga foi contada com o tempo de viagem
  // provisório (spec 2026-09-27, D6) - avisa, mas não bloqueia, porque a
  // SME às vezes precisa confirmar antes de conferir o endereço.
  if (localAConferir(s)) {
    const ok = await confirmar('O local deste pedido ainda não foi conferido. A vaga está contada com o tempo de viagem provisório. Confirmar mesmo assim?',
      { textoOk: 'Confirmar mesmo assim' });
    if (!ok) return;
  }
  btn.disabled = true;
  try {
    const falta = faltaParaConfirmar(s, await lerOcupacao(s.data, s.data, { excluir: s.id }), paradas);
    if (falta.onibus || falta.vans) {
      return abrirFrotaExtra({ solicitacao: s, falta, modo: 'confirmar', ctx, reabrir });
    }
    await executar(confirmarSolicitacao, 'Solicitação confirmada');
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível confirmar' });
  } finally {
    btn.disabled = false;
  }
}

// Reabrir volta a reservar veículo. Vindo de negado ou cancelado, o pedido
// NÃO ocupava nada: confere se ainda cabe e avisa - sem bloquear, porque
// quem aprova pode, e resolve na confirmação ("Faltam veículos"). É aviso,
// não erro (R15). Se a leitura da ocupação falhar, reabre sem o aviso:
// a conferência de verdade é a da confirmação.
async function reabrirPedido(btn, { s, paradas, executar }) {
  btn.disabled = true;
  try {
    let falta = { onibus: 0, vans: 0 };
    if (s.status !== 'confirmado') {
      const linha = await lerOcupacao(s.data, s.data, { excluir: s.id }).catch(() => null);
      if (linha) falta = faltaParaConfirmar(s, linha, paradas);
    }
    const semVaga = falta.onibus || falta.vans;
    const ok = await confirmar(semVaga
      ? 'Não há veículos livres neste horário. Reabrir mesmo assim?'
      : 'Reabrir esta solicitação?', {
      detalhe: 'Ela volta para análise e volta a reservar os veículos. A decisão anterior é apagada da ficha e continua registrada na Auditoria.',
      textoOk: semVaga ? 'Reabrir mesmo assim' : 'Reabrir',
    });
    if (ok) await executar(reabrirSolicitacao, 'Solicitação reaberta');
  } finally {
    btn.disabled = false;
  }
}

// Modal POR CIMA da ficha. `voltar` reabre a ficha com o dado
// recarregado - é o que a pilha de modal.js faz, e por isso guardamos a
// função e não o HTML.
function pedirMotivo({ titulo, rotulo, botao, fn }, { s, reabrir, fechaTudo }) {
  abrirModal(`
    ${modalHead(esc(titulo), esc(tituloDoPedido(s)))}
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
    </div>`, { tamanho: 'estreito', voltar: reabrir });

  document.getElementById('mot-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = document.getElementById('mot-msg'); msg.className = 'auth-msg';
    const texto = val('mot-txt');
    // O banco também exige (CHECK da migration 035). Aqui é para a
    // pessoa saber antes de o servidor recusar.
    if (!texto) return falhaNoCampo(msg, '#mot-txt', 'A justificativa é obrigatória.');
    const btn = document.getElementById('mot-ok');
    btn.disabled = true;
    try {
      await fn(s.id, texto);
      fechaTudo();
      toast({ titulo, texto: tituloDoPedido(s), tipo: 'sucesso' });
    } catch (err) {
      reportarErro(err, { msg, titulo: 'Não foi possível concluir' });
      btn.disabled = false;
    }
  });
}
