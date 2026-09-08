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
// Uso:
//   const soltar = prenderFoco(document.getElementById('modal'));
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

// Prende o Tab dentro de `raiz`. Devolve a função que solta.
//
// A lista é recalculada a CADA Tab, de propósito: o conteúdo do modal
// é substituído por innerHTML (abrir um por cima de outro, repintar um
// formulário), e uma lista capturada na abertura apontaria para nós já
// descartados.
export function prenderFoco(raiz) {
  if (!raiz) return () => {};

  const aoTeclar = (e) => {
    if (e.key !== 'Tab') return;
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

  // Captura: roda antes de qualquer handler de Tab do conteúdo, para o
  // laço valer mesmo que a superfície trate a tecla por conta própria.
  document.addEventListener('keydown', aoTeclar, true);
  return () => document.removeEventListener('keydown', aoTeclar, true);
}
