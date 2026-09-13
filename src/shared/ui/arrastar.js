// ============================================================
// FundHub - shared/ui/arrastar.js
// Reordenar uma lista arrastando com o mouse.
//
// Nasce no TERCEIRO caso (R13): a legenda da grade de horários
// (`horarios/views/ordenar.js`), os painéis do Dashboard
// (`dashboard.view.js`) e as escolas de uma viagem do SATE
// (`sate/views/participantes.js`). As duas primeiras cópias eram
// iguais nos quatro handlers e diferiam só no eixo e nos seletores -
// exatamente o que esta função recebe por parâmetro.
//
// O que o componente NÃO faz, de propósito:
//
//   - não grava nada: devolve os identificadores na ordem nova e quem
//     chamou decide o que fazer (cada caso grava em tabela diferente);
//   - não desenha nada: põe e tira a classe `.arrastando`, e o estilo
//     é de quem hospeda (R12 - comportamento aqui, aparência no CSS);
//   - não oferece alternativa por toque. Arrasto nativo não existe em
//     toque, e a saída é um par de setas na própria linha - markup, não
//     comportamento. Ver `ordenar.js`, que tem as duas vias.
//
// Delegação no container, e não um listener por item: os dois casos
// existentes repintam a lista inteira por innerHTML, e religar em cada
// repintura é o bug que a delegação evita.
// ============================================================

// O elemento sendo arrastado agora. Módulo, e não por chamada: só há um
// arrasto por vez no documento, e `dragover` dispara a cada pixel
// precisando achar o mesmo elemento que o `dragstart` marcou.
let origem = null;
// Se o `drop` rodou DENTRO da lista. Marcador próprio, e não
// `dataTransfer.dropEffect`: esse valor é preenchido pelo navegador de
// forma desigual (evento sintético sai sempre 'none'), e confiar nele
// fazia o cancelamento disparar logo depois de um drop bem-sucedido -
// repintando por cima da ordem que acabava de ser gravada.
let soltou = false;

// `root` é o container ESTÁVEL onde delegar (pode ser o pai da lista).
//
//   item     seletor do que se move
//   alca     o que o usuário pega; o `draggable` do markup vai aqui
//            (default: o próprio item)
//   lista    container cuja ordem dos filhos é a ordem salva
//            (default: root)
//   eixo     'y' (default) ou 'x' - decide se o ponto médio do alvo é
//            comparado na altura ou na largura
//   chave    (el) => identificador daquele item
//   aoSoltar (ids) => grava. Pode ser assíncrona.
//   aoCancelar  soltou fora da lista: desfazer o que o `dragover` já
//               aplicou ao vivo. Opcional, mas ver o comentário abaixo.
export function ligarArrasto(root, { item, alca, lista, eixo = 'y', chave, aoSoltar, aoCancelar }) {
  if (!root) return;
  const pegar = alca || item;
  const container = () => (lista ? root.querySelector(lista) : root);
  const deslocado = (alvo, e) => {
    const r = alvo.getBoundingClientRect();
    return eixo === 'x' ? (e.clientX - r.left) > r.width / 2
                        : (e.clientY - r.top) > r.height / 2;
  };

  root.addEventListener('dragstart', (e) => {
    const pega = e.target.closest(pegar);
    if (!pega) return;
    const el = alca ? pega.closest(item) : pega;
    if (!el) return;
    origem = el;
    soltou = false;
    el.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'move';
    // O Firefox só inicia o arrasto se houver algo no dataTransfer.
    e.dataTransfer.setData('text/plain', String(chave(el) ?? ''));
  });

  root.addEventListener('dragend', () => {
    const arrastava = !!origem;
    origem?.classList.remove('arrastando');
    origem = null;
    // Soltou FORA da lista (ou apertou Esc): `drop` não rodou, e ninguém
    // desfez os `insertBefore` que o `dragover` já aplicou ao vivo - a
    // tela mostraria uma ordem que não foi gravada, sem erro nem aviso.
    if (arrastava && !soltou) aoCancelar?.();
    soltou = false;
  });

  root.addEventListener('dragover', (e) => {
    if (!origem) return;
    const lst = container();
    if (!lst || !lst.contains(e.target)) return;
    const alvo = e.target.closest(item);
    if (!alvo || alvo === origem || alvo.parentElement !== lst) return;
    e.preventDefault();        // exigido pela API nativa para o drop disparar
    lst.insertBefore(origem, deslocado(alvo, e) ? alvo.nextSibling : alvo);
  });

  root.addEventListener('drop', async (e) => {
    const lst = container();
    if (!origem || !lst || !lst.contains(e.target)) return;
    e.preventDefault();
    soltou = true;
    await aoSoltar([...lst.querySelectorAll(item)].map(chave));
  });
}
