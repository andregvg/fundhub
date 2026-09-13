// ============================================================
// FundHub - shared/ui/foco.js
// Armadilha de foco (focus trap) para superfícies modais.
//
// Um elemento com aria-modal="true" está afirmando que o resto da
// página não existe enquanto ele está aberto. Sem armadilha, o Tab
// atravessa o modal e vai passeando pelo menu e pelos botões da tela
// de trás - que o leitor de tela acabou de anunciar como inexistentes.
// A afirmação e o comportamento discordavam.
//
// Sobre morar em arquivo próprio: quando nasceu (bloco S0) eram TRÊS
// consumidores - drawer.js, modal.js e confirmar.js. O bloco S0b
// deletou a gaveta, e hoje são DOIS. Fica registrado assim, sem
// maquiagem: a R13 conta casos, e o número mudou.
//
// Continua em arquivo próprio mesmo assim, e não por inércia. A R13
// proíbe a ABSTRAÇÃO especulativa - generalizar dois casos que só se
// parecem por coincidência. Não é o caso: modal e confirmação não se
// parecem, elas fazem a MESMA coisa, e o que está aqui são trinta
// linhas de tratamento de Tab cheias de detalhe (lista recalculada a
// cada tecla, foco que voltou de fora da raiz, captura antes do
// conteúdo). Duas cópias disso são dois bugs para consertar duas
// vezes. Se um dia sobrar um consumidor só, aí o arquivo some.
//
// Superfícies EMPILHAM: uma confirmação aberta sobre um modal é a
// segunda armadilha ativa ao mesmo tempo. Só a do TOPO responde ao
// teclado. Até 13/09/2026 as duas respondiam: a do modal via o foco
// "fora" dela (estava na confirmação) e o puxava de volta, a da
// confirmação o puxava de novo - e o Tab ficava preso em "Cancelar". O
// Esc tinha o mesmo defeito por outra via e fechava as duas camadas.
//
// Uso:
//   const soltar = prenderFoco(document.getElementById('modal'), { aoEsc: fechar });
//   …
//   soltar();
// ============================================================

const FOCAVEIS = [
  'a[href]', 'button', 'input', 'select', 'textarea', 'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Só o que é REALMENTE alcançável agora: desabilitado não recebe foco, e
// `getClientRects()` vazio pega o que está escondido por qualquer via
// (hidden, display:none, <details> fechado). offsetParent não serviria:
// ele também é null em elemento `position: fixed`, que é justamente o
// caso do modal e do diálogo de confirmação.
function focaveis(raiz) {
  return [...raiz.querySelectorAll(FOCAVEIS)]
    .filter(el => !el.disabled && el.getClientRects().length);
}

// Pilha das armadilhas ativas; a última é a superfície de cima.
const pilha = [];
const noTopo = (armadilha) => pilha[pilha.length - 1] === armadilha;

// Prende o Tab dentro de `raiz` e, com `aoEsc`, liga o Esc a quem fecha.
// Devolve a função que solta.
//
// A lista é recalculada a CADA Tab, de propósito: o conteúdo do modal
// é substituído por innerHTML (abrir um por cima de outro, repintar um
// formulário), e uma lista capturada na abertura apontaria para nós já
// descartados.
export function prenderFoco(raiz, { aoEsc = null } = {}) {
  if (!raiz) return () => {};
  const armadilha = {};

  const aoTeclar = (e) => {
    if (e.key !== 'Tab' || !noTopo(armadilha)) return;
    const lista = focaveis(raiz);
    // Superfície sem nada focável: o Tab não tem para onde ir, e deixá-lo
    // sair devolveria o foco à tela de trás.
    if (!lista.length) { e.preventDefault(); return; }

    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    const atual = document.activeElement;

    // Foco fora da raiz (clique no fundo, volta da barra do navegador):
    // traz de volta pela ponta que faz sentido para a direção do Tab.
    if (!raiz.contains(atual)) {
      e.preventDefault();
      (e.shiftKey ? ultimo : primeiro).focus();
      return;
    }
    if (e.shiftKey && atual === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && atual === ultimo) { e.preventDefault(); primeiro.focus(); }
  };

  // O Esc é ouvido na BOLHA, não na captura: um controle dentro da
  // superfície que usa o Esc para si (a lista aberta de uma busca com
  // seleção) chama preventDefault e a superfície fica aberta.
  const aoEsc_ = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !aoEsc || !noTopo(armadilha)) return;
    e.preventDefault();
    aoEsc();
  };

  pilha.push(armadilha);
  // Captura: roda antes de qualquer handler de Tab do conteúdo, para o
  // laço valer mesmo que a superfície trate a tecla por conta própria.
  document.addEventListener('keydown', aoTeclar, true);
  document.addEventListener('keydown', aoEsc_);
  return () => {
    // Pela identidade, não pelo topo: quem solta nem sempre é o de cima
    // (uma tela repintada por baixo de uma confirmação, por exemplo).
    const i = pilha.indexOf(armadilha);
    if (i >= 0) pilha.splice(i, 1);
    document.removeEventListener('keydown', aoTeclar, true);
    document.removeEventListener('keydown', aoEsc_);
  };
}
