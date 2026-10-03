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
//
// Opções do widget (spec 2026-10-02, D7 e D13):
//   rotulo - desenha o rótulo do campo (`.lbl`, com `for`): o formulário
//            fica com UM elemento, sem invólucro;
//   criar  - { etiqueta, rotulo(termo, haOutros), aoCriar(termo) }: último
//            item da lista, para aceitar o texto digitado como item NOVO.
// A lista abre por GESTO (clique, digitação, seta) e não pelo foco: um
// modal que começa por uma busca nasceria com a lista aberta (ARIA APG).
// ============================================================
import { esc, norm, semelhanca } from '../dom.js';
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

// Segunda passada, só quando a exata não acha NADA (spec 2026-10-02, D7):
// cada palavra do termo precisa parecer alguma palavra da opção. Quem
// digita certo nunca vê isto; quem digitou "Muzeu" acha o museu.
export function aproximarOpcoes(opcoes, termo, max = 5) {
  const palavras = norm(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return [];
  return (opcoes || [])
    .map((o, i) => {
      const alvo = norm(`${o.rotulo || ''} ${o.detalhe || ''} ${o.busca || ''}`)
        .split(/[^a-z0-9]+/).filter(Boolean);
      let custo = 0;
      for (const p of palavras) {
        const custos = alvo.map(q => semelhanca(p, q)).filter(c => c !== null);
        if (!custos.length) return null;
        custo += Math.min(...custos);
      }
      return { o, custo, i };
    })
    .filter(Boolean)
    .sort((a, b) => a.custo - b.custo || a.i - b.i)
    .slice(0, max)
    .map(x => x.o);
}

let seq = 0;

export function criarBuscaSelecao(el, {
  opcoes = [], valor = '', placeholder = 'Buscar...', rotulo = '',
  vazioTexto = 'Nada encontrado', onChange = () => {}, criar = null,
} = {}) {
  let todas = [...opcoes];
  // Mesma guarda de definirValor: um valor inicial que não está em
  // `opcoes` não vira escolha (a mesma porta de entrada, o construtor).
  let escolhido = todas.some(o => o.id === valor) ? (valor || '') : '';
  let criado = '';    // texto aceito como item NOVO (criar), ou ''
  let destaque = -1;
  let visiveis = [];  // [{ o } | { criar: termo }], na ordem da lista
  const id = `bs-${++seq}`;

  el.innerHTML = `
    <div class="bs">
      ${rotulo ? `<label class="lbl" for="${id}">${esc(rotulo)}</label>` : ''}
      <div class="bs-ancora">
        <label class="search bs-campo">
          ${ico('buscar')}
          <input type="text" id="${id}" class="bs-input" role="combobox" aria-expanded="false"
                 aria-controls="${id}-lista" aria-autocomplete="list" autocomplete="off"
                 placeholder="${esc(placeholder)}" />
          <span class="tag bs-novo" hidden>${esc(criar?.etiqueta || 'Novo')}</span>
          <button type="button" class="bs-limpar" aria-label="Limpar" hidden>${ico('fechar', { tam: 14 })}</button>
        </label>
        <ul class="bs-lista" id="${id}-lista" role="listbox" hidden></ul>
      </div>
    </div>`;

  const input = el.querySelector('.bs-input');
  const lista = el.querySelector('.bs-lista');
  const limpar = el.querySelector('.bs-limpar');
  const novo = el.querySelector('.bs-novo');

  const rotuloDe = (oid) => todas.find(o => o.id === oid)?.rotulo || '';

  function pintarCampo() {
    input.value = escolhido ? rotuloDe(escolhido) : criado;
    limpar.hidden = !(escolhido || criado);
    novo.hidden = !criado;
  }

  // Exatas primeiro; aproximadas só se a exata não achou nada; o item de
  // criar por último. O destaque vai para o PRIMEIRO item - que só é o de
  // criar quando ele é o único.
  function abrir(termo) {
    const eraFechada = lista.hidden;
    const t = String(termo || '').trim();
    const exatas = filtrarOpcoes(todas, t);
    const aprox = exatas.length ? [] : aproximarOpcoes(todas, t);
    const haOutros = exatas.length + aprox.length > 0;
    const podeCriar = !!criar && t.length >= 3 && !todas.some(o => norm(o.rotulo).trim() === norm(t));
    visiveis = [...exatas, ...aprox].map(o => ({ o }));
    if (podeCriar) visiveis.push({ criar: t });
    destaque = visiveis.length ? 0 : -1;

    const item = (v, i) => {
      const on = i === destaque;
      if (v.criar !== undefined) {
        return `<li class="bs-item bs-criar ${haOutros ? 'apagado' : ''} ${on ? 'on' : ''}" role="option"
                    aria-selected="${on}" data-i="${i}">${ico('adicionar', { tam: 14 })}
                  <span class="bs-rot">${esc(criar.rotulo(v.criar, haOutros))}</span></li>`;
      }
      return `<li class="bs-item ${on ? 'on' : ''}" role="option" aria-selected="${on}" data-i="${i}">
                <span class="bs-rot">${esc(v.o.rotulo)}</span>
                ${v.o.detalhe ? `<span class="bs-det">${esc(v.o.detalhe)}</span>` : ''}</li>`;
    };
    const linhas = visiveis.map(item);
    if (aprox.length) linhas.unshift('<li class="bs-sub" role="presentation">Parecidos</li>');
    lista.innerHTML = linhas.length ? linhas.join('') : `<li class="bs-nada">${esc(vazioTexto)}</li>`;
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    // Dentro de modal o corpo rola e corta o que passa da base.
    if (eraFechada && el.closest('.modal-body')) lista.scrollIntoView({ block: 'nearest' });
  }

  function fechar() {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    pintarCampo();
  }

  function escolher(oid) {
    escolhido = oid;
    criado = '';
    fechar();
    onChange(oid);
  }

  function escolherIndice(i) {
    const v = visiveis[i];
    if (!v) return;
    if (v.criar === undefined) { escolher(v.o.id); return; }
    escolhido = '';
    criado = v.criar;
    fechar();
    criar.aoCriar(v.criar);
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

  input.addEventListener('click', () => { if (lista.hidden) abrir(''); });
  input.addEventListener('input', () => abrir(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
    else if (e.key === 'Enter') {
      if (!lista.hidden && visiveis[destaque]) { e.preventDefault(); escolherIndice(destaque); }
    } else if (e.key === 'Escape') {
      // Lista aberta: o Esc é dela, e o modal em volta fica aberto (o
      // preventDefault é o sinal que foco.js respeita). Lista fechada: o
      // Esc segue adiante e fecha a superfície, como em qualquer campo.
      if (!lista.hidden) { e.preventDefault(); fechar(); }
      else input.blur();
    }
  });
  lista.addEventListener('mousedown', (e) => {
    // mousedown e não click: o blur do input fecharia a lista antes.
    const li = e.target.closest('.bs-item'); if (!li) return;
    e.preventDefault();
    escolherIndice(Number(li.dataset.i));
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
    definirValor(oid) { escolhido = todas.some(o => o.id === oid) ? (oid || '') : ''; criado = ''; pintarCampo(); },
    valorAtual() { return escolhido; },
    // Chamar ao descartar a instância (troca de aba/rota) - sem isso o
    // listener de document acima sobrevive ao componente.
    destruir() { document.removeEventListener('click', aoClicarFora); },
  };
}
