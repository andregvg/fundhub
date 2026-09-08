// ============================================================
// FundHub - shared/ui/drawer.js
// Painel lateral (gaveta) usado por Escolas, Calendário e
// Afastamentos. Em telas pequenas ocupa a largura toda - é o padrão
// mobile-first de "detalhe/edição" do FundHub.
//
// Uso na view:
//   app.innerHTML = `… ${drawerHtml()}`;
//   montarDrawer();                    // liga fundo + tecla Esc
//   abrirDrawer(`<div class="drawer-head">…</div>…`);
// ============================================================
import { ico } from './icones.js';
import { prenderFoco } from './foco.js';

// Marcação a incluir no final do HTML da página.
// `aria-modal` sem armadilha de foco era uma afirmação falsa: a gaveta
// dizia que o resto da página não existe e o Tab saía passeando por ele.
// Ver shared/ui/foco.js.
export const drawerHtml = () => `
  <div class="drawer-back" id="drawer-back"></div>
  <aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-hidden="true"></aside>`;

// Garante que o markup do drawer existe. As views que montam a própria
// página já incluem `${drawerHtml()}` + `montarDrawer()`; a barra de
// ações do módulo (roteador) não tem página própria, então a engrenagem
// precisa poder abrir a gaveta sem depender do que a view fez.
export function garantirDrawer() {
  if (document.getElementById('drawer')) return;
  document.body.insertAdjacentHTML('beforeend', drawerHtml());
  montarDrawer();
}

let escListener = null;
// Uma gaveta pode ser aberta POR CIMA de outra (editar o vínculo a
// partir da ficha do servidor). Guardamos a FUNÇÃO que reabre a de
// baixo, não o HTML dela: restaurar HTML deixaria para trás os
// listeners, e a de baixo precisa voltar com dado recarregado.
let voltarPara = null;
let focoAnterior = null;
let soltarFoco = null;

export function montarDrawer() {
  document.getElementById('drawer-back')?.addEventListener('click', fecharDrawer);
  // Um único listener de teclado por página: registrar a cada render
  // vazava listeners e fechava gavetas de telas já descartadas.
  if (escListener) document.removeEventListener('keydown', escListener);
  escListener = (e) => { if (e.key === 'Escape') fecharDrawer(); };
  document.addEventListener('keydown', escListener);
}

export function abrirDrawer(html, { voltar = null } = {}) {
  garantirDrawer();
  const d = document.getElementById('drawer');
  if (!d) return;

  // Guarda quem tinha o foco antes da PRIMEIRA gaveta da pilha, para
  // devolvê-lo quando a pilha inteira fechar.
  if (!d.classList.contains('open')) focoAnterior = document.activeElement;
  voltarPara = voltar;

  d.innerHTML = html;
  d.setAttribute('aria-hidden', 'false');
  d.classList.add('open');
  document.getElementById('drawer-back')?.classList.add('open');

  if (voltar) {
    const head = d.querySelector('.drawer-head');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'drawer-voltar';
    btn.setAttribute('aria-label', 'Voltar');
    btn.textContent = '←';
    head?.prepend(btn);
    btn.addEventListener('click', fecharDrawer);
  }

  d.querySelector('.drawer-close')?.addEventListener('click', fecharDrawer);

  // Uma armadilha por PILHA, não por gaveta: o elemento é sempre o mesmo
  // (#drawer, com o innerHTML trocado), e prender de novo deixaria dois
  // laços de Tab concorrendo sobre o mesmo nó.
  if (!soltarFoco) soltarFoco = prenderFoco(d);

  (d.querySelector('.drawer-voltar') || d.querySelector('.drawer-close'))?.focus();
}

export function fecharDrawer() {
  // Se há uma gaveta embaixo, "fechar" é voltar para ela - e é ela que
  // chama abrirDrawer de novo, já com o dado atualizado.
  if (voltarPara) {
    const volta = voltarPara;
    voltarPara = null;
    volta();
    return;
  }
  const d = document.getElementById('drawer');
  d?.classList.remove('open');
  d?.setAttribute('aria-hidden', 'true');
  document.getElementById('drawer-back')?.classList.remove('open');
  soltarFoco?.();
  soltarFoco = null;
  // ui.md sempre afirmou que a gaveta devolve o foco; até aqui, não devolvia.
  focoAnterior?.focus?.();
  focoAnterior = null;
}

// Cabeçalho padrão da gaveta (o botão de fechar é ligado por abrirDrawer).
export const drawerHead = (titulo, sub = '') => `
  <div class="drawer-head">
    <div><h2>${titulo}</h2>${sub ? `<small>${sub}</small>` : ''}</div>
    <button class="drawer-close" type="button" aria-label="Fechar">${ico('fechar')}</button>
  </div>`;
