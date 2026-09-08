// ============================================================
// FundHub - shared/ui/modal.js
// Diálogo centralizado - o padrão de "detalhe/edição" do hub a partir
// de 08/09/2026. Ver a spec 2026-09-08-listas-e-modais-design.md § D8.
//
// Substituiu a gaveta lateral (`shared/ui/drawer.js`) em todo o hub no
// bloco S0b (08/09/2026). A API nasceu espelhando a dela justamente
// para que a conversão das ~20 telas fosse troca de identificador, e
// não reescrita; o arquivo da gaveta foi deletado no mesmo commit, para
// não restarem duas formas de abrir a mesma tela.
//
// O que a gaveta já tinha resolvido veio junto, com a mesma
// implementação e pelas mesmas razões - inclusive guardar a FUNÇÃO que
// reabre o de baixo, nunca o HTML dele: restaurar HTML deixaria os
// ouvintes para trás, e o de baixo precisa voltar com dado recarregado.
//
// Uso na view:
//   app.innerHTML = `… ${modalHtml()}`;
//   montarModal();
//   abrirModal(`${modalHead('Título')}<div class="modal-body">…</div>`);
// ============================================================
import { ico } from './icones.js';
import { prenderFoco } from './foco.js';

// Marcação a incluir no final do HTML da página. O cartão fica DENTRO
// do fundo: é o fundo que centraliza (grid + place-items), e um cartão
// irmão precisaria repetir o cálculo por fora.
export const modalHtml = () => `
  <div class="modal-back" id="modal-back">
    <div class="modal" id="modal" role="dialog" aria-modal="true" aria-hidden="true"></div>
  </div>`;

export function garantirModal() {
  if (document.getElementById('modal')) return;
  document.body.insertAdjacentHTML('beforeend', modalHtml());
  montarModal();
}

let escListener = null;
let voltarPara = null;
let focoAnterior = null;
let soltarFoco = null;

export function montarModal() {
  document.getElementById('modal-back')?.addEventListener('click', aoCliqueFundo);
  // Um único listener de teclado por página: registrar a cada render
  // vazava listeners e fechava modais de telas já descartadas.
  if (escListener) document.removeEventListener('keydown', escListener);
  escListener = (e) => { if (e.key === 'Escape' && aberto()) fecharModal(); };
  document.addEventListener('keydown', escListener);
}

const aberto = () => document.getElementById('modal-back')?.classList.contains('open');

// Só o fundo fecha. Sem esta checagem, um clique que começasse dentro do
// cartão e terminasse fora fecharia o formulário no meio da digitação.
function aoCliqueFundo(e) {
  if (e.target.id === 'modal-back') fecharModal();
}

// `tamanho`: 'estreito' (420px) | 'medio' (560px, padrão) | 'largo' (760px).
export function abrirModal(html, { voltar = null, tamanho = 'medio' } = {}) {
  garantirModal();
  const m = document.getElementById('modal');
  const back = document.getElementById('modal-back');
  if (!m || !back) return;

  // Guarda quem tinha o foco antes do PRIMEIRO modal da pilha, para
  // devolvê-lo quando a pilha inteira fechar.
  if (!aberto()) focoAnterior = document.activeElement;
  voltarPara = voltar;

  m.className = `modal ${tamanho}`;
  m.innerHTML = html;
  m.setAttribute('aria-hidden', 'false');
  back.classList.add('open');

  const head = m.querySelector('.modal-head');
  if (head && !head.id) head.id = 'modal-titulo';
  m.setAttribute('aria-labelledby', 'modal-titulo');

  if (voltar) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-voltar';
    btn.setAttribute('aria-label', 'Voltar');
    btn.innerHTML = ico('voltar');
    head?.prepend(btn);
    btn.addEventListener('click', fecharModal);
  }

  m.querySelector('.modal-close')?.addEventListener('click', fecharModal);

  // A armadilha é presa uma vez por PILHA, não por modal: o elemento é
  // sempre o mesmo (#modal, com o innerHTML trocado), e prender de novo
  // deixaria dois laços de Tab concorrendo sobre o mesmo nó.
  if (!soltarFoco) soltarFoco = prenderFoco(m);

  // Primeiro campo do formulário, se houver; senão o botão de fechar. Um
  // modal de edição que abre com o foco no × obriga a pessoa a tabular
  // até o começo do formulário toda vez.
  const alvo = m.querySelector('.modal-body input, .modal-body select, .modal-body textarea')
    || m.querySelector('.modal-voltar') || m.querySelector('.modal-close');
  alvo?.focus();
}

export function fecharModal() {
  // Se há um modal embaixo, "fechar" é voltar para ele - e é ele que
  // chama abrirModal de novo, já com o dado atualizado.
  if (voltarPara) {
    const volta = voltarPara;
    voltarPara = null;
    volta();
    return;
  }
  const m = document.getElementById('modal');
  document.getElementById('modal-back')?.classList.remove('open');
  m?.setAttribute('aria-hidden', 'true');
  soltarFoco?.();
  soltarFoco = null;
  focoAnterior?.focus?.();
  focoAnterior = null;
}

// Cabeçalho padrão (o botão de fechar é ligado por abrirModal).
export const modalHead = (titulo, sub = '') => `
  <div class="modal-head" id="modal-titulo">
    <div><h2>${titulo}</h2>${sub ? `<small>${sub}</small>` : ''}</div>
    <button class="modal-close" type="button" aria-label="Fechar">${ico('fechar')}</button>
  </div>`;
