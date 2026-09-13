// ============================================================
// FundHub - sate/views/participantes.js
// As escolas de uma viagem: quem embarca, em que ordem, e o que cada
// papel pode fazer com a própria linha.
// Spec: 2026-09-08-sate-participacao-design.md § D4 e D6.
//
// Saiu de `detalhe.js` em 09/09/2026. A fronteira não é de tamanho: a
// lista de escolas tem ciclo de vida próprio (quatro ações, três delas
// com justificativa), ordem própria (arrasto e setas) e um formulário
// próprio - e nada disso é decisão sobre a VIAGEM, que é o assunto do
// detalhe. As duas telas se tocam em dois pontos, e só: o bloco que o
// detalhe desenha e o religar que ele chama.
//
// Ela existe porque o bloco anterior entregou o modelo sem a tela:
// `acrescentar` e `reordenar` estavam no model sem ninguém chamando, e
// o tutorial do módulo já prometia as duas. Documentação que promete o
// que a tela não faz é pior que funcionalidade ausente.
// ============================================================
import {
  acrescentar, remover, reordenar, pedirSaida, confirmarSaida,
  voltarAtras, cancelarParticipacao, STATUS_PART, ativa,
} from '../participacoes.model.js';
import { esc, vazio, val } from '../../../shared/dom.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';
import { ligarArrasto } from '../../../shared/ui/arrastar.js';

// ── O bloco, como o detalhe o desenha ────────────────────────
export function blocoHtml(partes, ctx) {
  const ap = !!ctx.aprovador;
  const ativas = (partes || []).filter(ativa);
  return `<div class="field">
    <div class="lbl det-partes-cab">Escolas nesta viagem
      ${ap ? `<button type="button" class="mini-btn" id="dp-add">${ico('adicionar', { tam: 13 })} Acrescentar escola</button>` : ''}
    </div>
    <div class="det-partes" id="dp-lista">${partes?.length
      ? partes.map(p => linha(p, ctx, ativas.length)).join('')
      : vazio('nenhuma escola vinculada')}</div>
  </div>`;
}

// Uma linha por escola. A escola vê a SUA com o pedido de saída; quem
// aprova vê todas, com a alça de arrasto, as setas e as duas saídas.
// Cancelada continua na lista, e é por ela ficar que a escola que
// desistiu continua vendo o registro do que aconteceu.
function linha(p, ctx, totalAtivas) {
  const nome = p.unidade?.apelido || p.unidade?.nome || p.local?.nome || '—';
  const minha = (ctx.perfil?.unidades || []).includes(p.unidade_id);
  const ap = !!ctx.aprovador;
  const ehAtiva = ativa(p);
  // Arrastar só faz sentido com duas ou mais na fila, e só para quem
  // monta o itinerário. `draggable` no markup, mecânica no componente.
  const arrasta = ap && ehAtiva && totalAtivas > 1;

  return `<div class="det-parte ${ehAtiva ? '' : 'fora'}" data-parte="${esc(p.id)}"
      ${arrasta ? 'draggable="true"' : ''}>
    ${arrasta ? `<span class="det-parte-alca" aria-hidden="true">${ico('arrastar', { tam: 13 })}</span>` : ''}
    <span class="det-parte-ordem">${p.ordem}</span>
    <b>${esc(nome)}</b>
    <span class="di-meta">${p.qtd_alunos || 0} estudante(s)${p.qtd_cadeirante ? ` · ${p.qtd_cadeirante} cadeirante(s)` : ''}${p.horario ? ` · ${esc(p.horario)}` : ''}</span>
    ${ehAtiva ? '' : `<span class="tag st-${p.status === 'cancelada' ? 'cancelado' : 'em_analise'}">${esc(STATUS_PART[p.status])}</span>`}
    ${p.motivo ? `<span class="di-meta det-parte-motivo">${esc(p.motivo)}</span>` : ''}
    ${grupoAcoes(arrasta ? setas(p, nome) : '', acoes(p, { ap, minha, ehAtiva, nome }))}
  </div>`;
}

// Setas e botões num bloco só, que quebra de linha JUNTO. Soltos, cada
// linha da lista quebrava num ponto diferente conforme o tamanho do nome
// da escola, e a coluna de ações deixava de ser uma coluna.
function grupoAcoes(...partes) {
  const html = partes.join('');
  return html ? `<span class="det-parte-acoes">${html}</span>` : '';
}

// A via de reordenar em TOQUE e em teclado: arrasto nativo não existe
// em toque, e uma lista que só se reordena arrastando é uma lista que o
// celular não reordena. Mesma decisão de horarios/views/ordenar.js, e o
// mesmo par de chevrons girados que a grade de horários já usa.
const setas = (p, nome) => `<span class="det-parte-setas">
  <button type="button" class="mini-btn" data-mover="${esc(p.id)}:-1"
    aria-label="Subir ${esc(nome)} na ordem das paradas">${ico('chevron', { tam: 12, classe: 'gira-180' })}</button>
  <button type="button" class="mini-btn" data-mover="${esc(p.id)}:1"
    aria-label="Descer ${esc(nome)} na ordem das paradas">${ico('chevron', { tam: 12 })}</button>
</span>`;

function acoes(p, { ap, minha, ehAtiva, nome }) {
  const b = (attr, rotulo, classe = 'mini-btn') =>
    `<button type="button" class="${classe}" ${attr}="${esc(p.id)}" data-nome="${esc(nome)}">${esc(rotulo)}</button>`;

  if (ehAtiva) {
    // A escola PEDE para sair; quem aprova tira na hora. São atos
    // diferentes e por isso têm rótulos diferentes - "sair" é um pedido,
    // "cancelar" é uma decisão.
    if (ap) {
      return b('data-cancelar-parte', 'Cancelar participação', 'mini-btn no')
           + b('data-remover-parte', 'Remover');
    }
    return minha ? b('data-sair', 'Sair da viagem', 'mini-btn no') : '';
  }
  if (p.status === 'pendente_cancelamento') {
    return ap
      ? b('data-desfazer', 'Manter') + b('data-confirmar-saida', 'Confirmar saída', 'mini-btn no')
      : (minha ? b('data-desfazer', 'Desistir do pedido') : '');
  }
  return '';   // cancelada: não há mais o que decidir
}

// ── Religar ──────────────────────────────────────────────────
// `corpo` é o nó do detalhe, recriado a cada abertura - religar a cada
// vez é o certo aqui, e não um vazamento.
//
// `reabrir` reabre o DETALHE, em vez de fechar a pilha: quem acabou de
// tirar uma escola vai, no caso real que motivou este modelo, pôr outra
// no lugar em seguida.
export function ligarParticipantes(corpo, { ctx, solicitacao, partes, reabrir }) {
  const minhas = (partes || []).some(p => (ctx.perfil?.unidades || []).includes(p.unidade_id));
  if (!ctx.aprovador && !minhas) return;

  const executar = async (fn, titulo) => {
    try {
      await fn();
      toast({ titulo, tipo: 'sucesso' });
      await reabrir();
      ctx.recarregar?.();
    } catch (err) {
      reportarErro(err, { titulo: 'Não foi possível concluir' });
    }
  };

  corpo.addEventListener('click', async (e) => {
    const alvo = (attr) => e.target.closest(`[${attr}]`);

    if (e.target.closest('#dp-add')) return formularioEscola({ ctx, solicitacao, partes, reabrir });

    const sair = alvo('data-sair');
    if (sair) {
      return pedirMotivo({
        titulo: 'Sair da viagem', botao: 'Enviar pedido',
        rotulo: `Por que ${sair.dataset.nome} precisa sair?`,
        fn: (motivo) => pedirSaida(sair.dataset.sair, motivo),
        reabrir, executar,
      });
    }

    const canc = alvo('data-cancelar-parte');
    if (canc) {
      return pedirMotivo({
        titulo: 'Cancelar participação', botao: 'Cancelar participação',
        rotulo: `Por que ${canc.dataset.nome} não vai mais?`,
        fn: (motivo) => cancelarParticipacao(canc.dataset.cancelarParte, motivo),
        reabrir, executar,
      });
    }

    const rem = alvo('data-remover-parte');
    if (rem) {
      const ok = await confirmar(`Remover ${rem.dataset.nome} da viagem?`, {
        detalhe: 'A linha é apagada e a escola deixa de ver este agendamento. Para tirar a escola mantendo o registro, use "Cancelar participação".',
        textoOk: 'Remover', perigo: true,
      });
      if (ok) await executar(() => remover(rem.dataset.removerParte), 'Escola removida');
      return;
    }

    const desf = alvo('data-desfazer');
    if (desf) return executar(() => voltarAtras(desf.dataset.desfazer), 'Participação mantida');

    const conf = alvo('data-confirmar-saida');
    if (conf) return executar(() => confirmarSaida(conf.dataset.confirmarSaida), 'Saída confirmada');

    const mover = alvo('data-mover');
    if (mover) {
      const [id, delta] = mover.dataset.mover.split(':');
      const ids = ordemAtiva(corpo);
      const i = ids.indexOf(id), j = i + Number(delta);
      if (i < 0 || j < 0 || j >= ids.length) return;
      // Dois cliques rápidos disparariam duas gravações calculadas sobre
      // a MESMA ordem velha. O reabrir repinta com botões novos.
      corpo.querySelectorAll('[data-mover]').forEach(btn => { btn.disabled = true; });
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return salvarOrdem(ids, { solicitacao, partes, reabrir, ctx });
    }
  });

  if (!ctx.aprovador) return;
  ligarArrasto(corpo, {
    item: '.det-parte[draggable="true"]', lista: '#dp-lista',
    chave: (el) => el.dataset.parte,
    aoSoltar: (ids) => salvarOrdem(ids, { solicitacao, partes, reabrir, ctx }),
    aoCancelar: () => reabrir(),
  });
}

const ordemAtiva = (corpo) =>
  [...corpo.querySelectorAll('#dp-lista .det-parte[draggable="true"]')].map(el => el.dataset.parte);

// As CANCELADAS vão para o fim da numeração, e não ficam onde estavam.
// `ordem` é única dentro da viagem: deixar uma cancelada ocupando o
// número 2 faria a gravação colidir com a ativa que assumiu o lugar
// dela. E a ordem de uma participação cancelada não significa nada -
// ela se desvinculou do itinerário.
async function salvarOrdem(idsAtivas, { solicitacao, partes, reabrir, ctx }) {
  const fora = (partes || []).filter(p => !idsAtivas.includes(p.id)).map(p => p.id);
  try {
    await reordenar(solicitacao.id, [...idsAtivas, ...fora]);
    toast({ titulo: 'Ordem das paradas salva', tipo: 'sucesso' });
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível salvar a ordem' });
  } finally {
    await reabrir();
    ctx.recarregar?.();
  }
}

// ── Modal empilhado: justificativa ───────────────────────────
function pedirMotivo({ titulo, rotulo, botao, fn, reabrir, executar }) {
  abrirModal(`
    ${modalHead(esc(titulo))}
    <div class="modal-body">
      <form id="dp-mot" class="esc-form">
        <label>${esc(rotulo)}
          <textarea id="dp-mot-txt" rows="4" required
            placeholder="A escola vê esta justificativa."></textarea></label>
        <div class="form-foot">
          <button type="submit" class="btn-perigo">${esc(botao)}</button>
        </div>
      </form>
    </div>`, { tamanho: 'estreito', voltar: reabrir });

  document.getElementById('dp-mot').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const texto = val('dp-mot-txt');
    // O banco também exige (part_motivo_check, migration 037). Aqui é
    // para a pessoa saber antes de o servidor recusar.
    if (!texto) return toast({ titulo: 'A justificativa é obrigatória.', tipo: 'erro' });
    return executar(() => fn(texto), titulo);
  });
}

// ── Modal empilhado: acrescentar escola ──────────────────────
function formularioEscola({ ctx, solicitacao, partes, reabrir }) {
  // Uma escola que já está na viagem não reaparece na lista: duas
  // participações da mesma escola na mesma viagem seriam duas cotas
  // para o mesmo embarque.
  const jaEstao = new Set((partes || []).filter(ativa).map(p => p.unidade_id));
  const livres = [...(ctx.unidades || [])]
    .filter(u => !jaEstao.has(u.id))
    .sort((a, b) => (a.apelido || a.nome).localeCompare(b.apelido || b.nome, 'pt'));

  abrirModal(`
    ${modalHead('Acrescentar escola', 'Ela entra no fim da fila de paradas; a ordem se ajusta depois.')}
    <div class="modal-body">
      <form id="dp-add-form" class="esc-form">
        <div class="form-grid">
          <label class="col-full">Escola
            <select id="dp-esc" required>
              <option value="">Selecione…</option>
              ${livres.map(u => `<option value="${esc(u.id)}">${esc(u.apelido || u.nome)}</option>`).join('')}
            </select></label>
          <label>Nº de estudantes <input id="dp-alunos" type="number" inputmode="numeric" min="1" required /></label>
          <label>Nº de cadeirantes <input id="dp-cad" type="number" inputmode="numeric" min="0" value="0" /></label>
          <label>Horário de embarque <input id="dp-hora" type="time" /></label>
        </div>
        <div class="form-foot">
          <span class="form-hint">O total de estudantes da viagem é recalculado pelo sistema.</span>
          <button type="submit" class="btn-primary" id="dp-add-ok">Acrescentar</button>
        </div>
      </form>
    </div>`, { tamanho: 'medio', voltar: reabrir });

  document.getElementById('dp-add-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = document.getElementById('dp-add-ok');
    btn.disabled = true;
    try {
      await acrescentar(solicitacao.id, {
        unidadeId: val('dp-esc'),
        qtdAlunos: Number(val('dp-alunos')) || 0,
        qtdCadeirante: Number(val('dp-cad')) || 0,
        horario: val('dp-hora') || null,
      });
      toast({ titulo: 'Escola acrescentada', tipo: 'sucesso' });
      await reabrir();
      ctx.recarregar?.();
    } catch (err) {
      reportarErro(err, { titulo: 'Não foi possível acrescentar' });
      btn.disabled = false;
    }
  });
}
