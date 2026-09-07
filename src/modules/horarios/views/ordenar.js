// ============================================================
// FundHub - horarios/views/ordenar.js
// Reordenar a legenda da grade: arrasto com o mouse, setas para
// teclado e toque, e o botão de voltar ao padrão.
//
// Saiu de `por-escola.js` em 07/09/2026, quando aquele arquivo passou
// do teto de 400 linhas da R11. A fronteira não é técnica: reordenar é
// uma responsabilidade inteira, com estado próprio (`origemArrasto`),
// um contrato de três funções e nenhum outro trecho da aba dependendo
// dela. O que ficou lá é a aba; o que veio para cá é o rearranjo.
//
// A ordem gravada vale para a UNIDADE, não para quem está olhando -
// quem reordena muda a grade de todo mundo. Por isso toda gravação
// termina em `recarregar()`: em sucesso reflete o que o banco aceitou,
// em erro desfaz na tela o que ele recusou.
// ============================================================
import { salvarOrdem, limparExibicao } from '../exibicao.model.js';
import { ico } from '../../../shared/ui/icones.js';
import { toast } from '../../../shared/ui/toast.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

// O chip sendo arrastado agora. Fora do handler porque `dragover` e
// `drop` disparam de novo a cada pixel e precisam achar o mesmo
// elemento que o `dragstart` marcou.
let origemArrasto = null;

// O botão "Voltar à ordem padrão". Só faz sentido quando há o que
// voltar: sem linha em `horario_exibicao` a grade já está no padrão
// alfabético.
export function botaoResetHtml({ podeEditar, temExibicao }) {
  if (!podeEditar || !temExibicao) return '';
  return `<div class="toolbar-linha">
    <button type="button" class="mini-btn" id="hg-reset">${ico('atualizar', { tam: 14 })} Voltar à ordem padrão</button>
  </div>`;
}

// Liga arrasto, setas e reset no container ESTÁVEL da aba (`#h-corpo`
// não é recriado a cada carga, só o innerHTML muda), uma vez só.
//
// `unidadeId` e `ordemAtual` são funções, não valores: a aba troca de
// escola sem religar nada, e a ordem muda a cada repintura. Ler no
// momento do evento é o que evita gravar contra um estado velho.
export function ligarReordenacao(root, { unidadeId, ordemAtual, recarregar }) {
  const ctx = { unidadeId, ordemAtual, recarregar };

  root.addEventListener('click', async (e) => {
    const mover = e.target.closest('[data-mover]');
    if (mover) { await moverServidor(mover.dataset.mover, ctx); return; }
    if (e.target.closest('#hg-reset')) await voltarPadrao(ctx);
  });

  // Arrasto na LEGENDA, não nas barras: arrastar uma barra moveria o
  // horário, que é outra coisa. Reordenar a legenda reordena as faixas
  // e as cores. Eventos de drag borbulham como qualquer outro, então
  // delegar aqui (em vez de religar em cada `#hg-legenda` recriado)
  // segue o padrão dos demais listeners da aba.
  root.addEventListener('dragstart', (e) => {
    const chip = e.target.closest('.hg-chip');
    if (!chip || !chip.draggable) return;
    origemArrasto = chip;
    chip.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox só inicia o arrasto se houver dado no dataTransfer.
    e.dataTransfer.setData('text/plain', chip.dataset.servidor);
  });

  root.addEventListener('dragend', (e) => {
    origemArrasto?.classList.remove('arrastando');
    origemArrasto = null;
    // Soltar FORA de #hg-legenda: `drop` não roda (ou roda sem achar a
    // legenda) e ninguém desfez o `insertBefore` que o `dragover` já
    // aplicou ao vivo - a legenda ficaria mostrando uma ordem que não
    // foi gravada e nem bate com as cores das barras abaixo, sem toast
    // nem erro. `dropEffect` só vira algo diferente de 'none' quando um
    // `dragover` válido (dentro da legenda) chamou `preventDefault()`.
    if (e.dataTransfer?.dropEffect === 'none') recarregar();
  });

  root.addEventListener('dragover', (e) => {
    if (!origemArrasto) return;
    const legenda = e.target.closest('#hg-legenda');
    if (!legenda) return;
    e.preventDefault();      // exigido pela API nativa para o drop disparar
    const alvo = e.target.closest('.hg-chip');
    if (!alvo || alvo === origemArrasto) return;
    const r = alvo.getBoundingClientRect();
    const depois = (e.clientX - r.left) > r.width / 2;
    legenda.insertBefore(origemArrasto, depois ? alvo.nextSibling : alvo);
  });

  root.addEventListener('drop', async (e) => {
    const legenda = e.target.closest('#hg-legenda');
    if (!origemArrasto || !legenda) return;
    e.preventDefault();
    const ids = [...legenda.querySelectorAll('.hg-chip')].map(c => c.dataset.servidor);
    await salvarNovaOrdem(ids, ctx);
  });
}

// Grava a ordem inteira - arrasto e setas caem aqui, e `salvarOrdem`
// grava de uma vez, não linha a linha.
async function salvarNovaOrdem(ids, { unidadeId, recarregar }) {
  try {
    await salvarOrdem(unidadeId(), ids);
    toast({ titulo: 'Ordem salva', tipo: 'sucesso' });
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível salvar a ordem' });
  } finally {
    await recarregar();
  }
}

// Alternativa por teclado e por toque ao arrasto: `valor` é
// "<servidorId>:-1" ou "<servidorId>:1", vindo do data-mover das setas.
async function moverServidor(valor, ctx) {
  const [servidorId, delta] = valor.split(':');
  const ids = ctx.ordemAtual();
  const i = ids.indexOf(servidorId);
  const j = i + Number(delta);
  if (i < 0 || j < 0 || j >= ids.length) return;
  // As duas setas DESTE servidor ficam desabilitadas durante a gravação -
  // sem isso, dois cliques rápidos disparam duas gravações calculadas
  // sobre a mesma ordem desatualizada. O recarregar, no fim de
  // `salvarNovaOrdem`, repinta a legenda inteira com botões novos e já
  // habilitados - não precisa reabilitar à mão.
  document.querySelectorAll(`[data-mover^="${servidorId}:"]`).forEach(b => b.disabled = true);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await salvarNovaOrdem(ids, ctx);
  // O recarregar destruiu o botão que estava focado - sem refocar quem
  // moveu o mesmo servidor na mesma direção, mover alguém 3 posições
  // exige 3 travessias da legenda procurando o botão de novo. É a ÚNICA
  // via de reordenar em toque (arrasto nativo não existe lá). Se a seta
  // não existir mais (chegou na ponta), `?.` falha em silêncio.
  document.querySelector(`[data-mover="${servidorId}:${delta}"]`)?.focus();
}

async function voltarPadrao({ unidadeId, recarregar }) {
  const ok = await confirmar('Voltar à ordem padrão desta escola?', {
    detalhe: 'A grade volta a mostrar só os cargos de equipe gestora, em ordem alfabética, todos contando na cobertura.',
    textoOk: 'Voltar ao padrão',
  });
  if (!ok) return;
  try {
    await limparExibicao(unidadeId());
    toast({ titulo: 'Ordem restaurada', tipo: 'sucesso' });
    await recarregar();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível restaurar' });
  }
}
