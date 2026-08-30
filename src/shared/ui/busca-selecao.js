// ============================================================
// FundHub - shared/ui/busca-selecao.js
// Escolha por BUSCA, não por rolagem. Um <select> com 144 escolas ou
// com o cadastro inteiro de servidores obriga a pessoa a saber onde o
// item está na lista; um campo que filtra enquanto se digita só
// exige que ela saiba o nome.
//
// É componente JS e não classe CSS (R12) porque tem estado (o termo,
// o item destacado), teclado (setas, Enter, Esc) e gestão de foco.
//
// Opção: { id, rotulo, detalhe?, busca? }
//   rotulo  - o que aparece e o que fica no campo quando escolhido;
//   detalhe - texto secundário na lista (cargo, segmento);
//   busca   - texto extra contra o qual casar sem aparecer (apelido).
// ============================================================
import { esc, norm } from '../dom.js';
import { ico } from './icones.js';

// Todas as palavras do termo precisam casar, em qualquer ordem: quem
// digita "beta exemplo" quer a Escola Exemplo Beta, e a ordem em que
// lembrou das palavras não deve importar.
export function filtrarOpcoes(opcoes, termo) {
  const lista = opcoes || [];
  const palavras = norm(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return [...lista];
  return lista.filter(o => {
    const alvo = norm(`${o.rotulo || ''} ${o.detalhe || ''} ${o.busca || ''}`);
    return palavras.every(p => alvo.includes(p));
  });
}

export function criarBuscaSelecao(el, {
  opcoes = [], valor = '', placeholder = 'Buscar...',
  vazioTexto = 'Nada encontrado', onChange = () => {},
} = {}) {
  let todas = [...opcoes];
  // Mesma guarda de definirValor: um valor inicial que não está em
  // `opcoes` não vira escolha (a mesma porta de entrada, o construtor).
  let escolhido = todas.some(o => o.id === valor) ? (valor || '') : '';
  let destaque = -1;
  let visiveis = [];

  el.innerHTML = `
    <div class="bs">
      <label class="search bs-campo">
        ${ico('buscar')}
        <input type="text" class="bs-input" role="combobox" aria-expanded="false"
               aria-autocomplete="list" autocomplete="off" placeholder="${esc(placeholder)}" />
        <button type="button" class="bs-limpar" aria-label="Limpar" hidden>${ico('fechar', { tam: 14 })}</button>
      </label>
      <ul class="bs-lista" role="listbox" hidden></ul>
    </div>`;

  const input = el.querySelector('.bs-input');
  const lista = el.querySelector('.bs-lista');
  const limpar = el.querySelector('.bs-limpar');

  const rotuloDe = (id) => todas.find(o => o.id === id)?.rotulo || '';

  function pintarCampo() {
    input.value = escolhido ? rotuloDe(escolhido) : '';
    limpar.hidden = !escolhido;
  }

  function abrir(termo) {
    visiveis = filtrarOpcoes(todas, termo);
    destaque = visiveis.length ? 0 : -1;
    lista.innerHTML = visiveis.length
      ? visiveis.map((o, i) => `
          <li class="bs-item ${i === destaque ? 'on' : ''}" role="option"
              aria-selected="${i === destaque}" data-id="${esc(o.id)}">
            <span class="bs-rot">${esc(o.rotulo)}</span>
            ${o.detalhe ? `<span class="bs-det">${esc(o.detalhe)}</span>` : ''}
          </li>`).join('')
      : `<li class="bs-nada">${esc(vazioTexto)}</li>`;
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function fechar() {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    pintarCampo();
  }

  function escolher(id) {
    escolhido = id;
    fechar();
    onChange(id);
  }

  function mover(passo) {
    if (lista.hidden) { abrir(''); return; }
    if (!visiveis.length) return;
    destaque = (destaque + passo + visiveis.length) % visiveis.length;
    [...lista.querySelectorAll('.bs-item')].forEach((li, i) => {
      li.classList.toggle('on', i === destaque);
      li.setAttribute('aria-selected', String(i === destaque));
    });
    lista.querySelector('.bs-item.on')?.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', () => abrir(''));
  input.addEventListener('input', () => abrir(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
    else if (e.key === 'Enter') {
      if (!lista.hidden && visiveis[destaque]) { e.preventDefault(); escolher(visiveis[destaque].id); }
    } else if (e.key === 'Escape') { fechar(); input.blur(); }
  });
  lista.addEventListener('mousedown', (e) => {
    // mousedown e não click: o blur do input fecharia a lista antes.
    const li = e.target.closest('.bs-item'); if (!li) return;
    e.preventDefault();
    escolher(li.dataset.id);
  });
  limpar.addEventListener('click', () => escolher(''));
  // Nomeada (não inline) para poder ser removida em destruir() - um
  // listener de document por instância que nunca sai retém `el` (e a
  // subárvore inteira) para sempre numa SPA que repinta a cada rota.
  function aoClicarFora(e) { if (!el.contains(e.target)) fechar(); }
  document.addEventListener('click', aoClicarFora);

  pintarCampo();

  return {
    definirOpcoes(lst) { todas = [...(lst || [])]; if (!todas.some(o => o.id === escolhido)) escolhido = ''; pintarCampo(); },
    // Mesma simetria de definirOpcoes: um id que não está na lista
    // atual não vira escolha - senão o campo mostra "nada selecionado"
    // enquanto valorAtual() ainda devolve um id fantasma.
    definirValor(id) { escolhido = todas.some(o => o.id === id) ? (id || '') : ''; pintarCampo(); },
    valorAtual() { return escolhido; },
    // Chamar ao descartar a instância (troca de aba/rota) - sem isso o
    // listener de document acima sobrevive ao componente.
    destruir() { document.removeEventListener('click', aoClicarFora); },
  };
}
