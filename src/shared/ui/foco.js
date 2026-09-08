// ============================================================
// FundHub - shared/ui/foco.js
// Armadilha de foco (focus trap) para superfícies modais.
//
// Um elemento com aria-modal="true" está afirmando que o resto da
// página não existe enquanto ele está aberto. Sem armadilha, o Tab
// atravessa a gaveta e vai passeando pelo menu e pelos botões da tela
// de trás - que o leitor de tela acabou de anunciar como inexistentes.
// A afirmação e o comportamento discordavam.
//
// Nasce em arquivo próprio, e não copiado, porque são TRÊS superfícies
// com exatamente a mesma necessidade (R13): drawer.js, modal.js e
// confirmar.js. Um laço de Tab duplicado é um bug duplicado.
//
// Uso:
//   const soltar = prenderFoco(document.getElementById('drawer'));
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
// caso da gaveta e do modal.
function focaveis(raiz) {
  return [...raiz.querySelectorAll(FOCAVEIS)]
    .filter(el => !el.disabled && el.getClientRects().length);
}

// Prende o Tab dentro de `raiz`. Devolve a função que solta.
//
// A lista é recalculada a CADA Tab, de propósito: o conteúdo da gaveta
// é substituído por innerHTML (abrir uma por cima de outra, repintar um
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
