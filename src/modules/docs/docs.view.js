// ============================================================
// FundHub — modules/docs/docs.view.js
// Apresenta as seções de docs.content.js: índice + conteúdo.
// No celular o índice é uma faixa rolável de chips no topo; a partir
// de 900px vira uma coluna fixa à esquerda que acompanha a rolagem.
// Rota restrita a admin — a guarda está no roteador (module.js: admin).
// ============================================================
import { SECOES } from './docs.content.js';
import { esc } from '../../shared/dom.js';

export async function render(app, { perfil } = {}) {
  const indice = SECOES.map(s => `
    <a class="doc-toc-item" href="#/docs" data-ir="${s.id}">
      <span class="doc-toc-ico" aria-hidden="true">${s.ico}</span>
      <span class="doc-toc-txt">
        <b>${esc(s.titulo)}</b>
        <small>${esc(s.resumo)}</small>
      </span>
    </a>`).join('');

  const secoes = SECOES.map(s => `
    <section class="doc-sec" id="doc-${s.id}">
      <h2><span aria-hidden="true">${s.ico}</span> ${esc(s.titulo)}</h2>
      ${s.html}
    </section>`).join('');

  app.innerHTML = `
    <div class="page-head">
      <h1>Documentação</h1>
      <p>Como o FundHub funciona por dentro — arquitetura, segurança, banco e o passo a passo
         para criar um módulo novo.</p>
    </div>

    <div class="doc-restrito">
      🔒 Visível apenas para administradores da SME${perfil?.email ? ` · você está como <b>${esc(perfil.email)}</b>` : ''}.
    </div>

    <div class="doc-layout">
      <nav class="doc-toc" id="doc-toc" aria-label="Índice da documentação">${indice}</nav>
      <div class="doc-conteudo">${secoes}</div>
    </div>`;

  // Rolagem suave até a seção, sem sujar o histórico com hashes falsos
  // (o roteador é por hash — um href="#doc-x" trocaria de rota).
  document.getElementById('doc-toc').addEventListener('click', (e) => {
    const a = e.target.closest('[data-ir]');
    if (!a) return;
    e.preventDefault();
    document.getElementById('doc-' + a.dataset.ir)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  destacarNoScroll();
}

// Marca no índice a seção que está sendo lida.
function destacarNoScroll() {
  const itens = new Map(
    [...document.querySelectorAll('.doc-toc-item')].map(a => [a.dataset.ir, a]));

  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach(en => {
      if (!en.isIntersecting) return;
      const id = en.target.id.replace('doc-', '');
      itens.forEach(a => a.classList.toggle('on', a.dataset.ir === id));
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  document.querySelectorAll('.doc-sec').forEach(s => obs.observe(s));
}
