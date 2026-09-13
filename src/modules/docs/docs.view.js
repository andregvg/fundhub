// ============================================================
// FundHub - modules/docs/docs.view.js
// Apresenta as seções de docs.content.js: índice + conteúdo.
// No celular o índice é uma faixa rolável de chips no topo; a partir
// de 900px vira uma coluna fixa à esquerda que acompanha a rolagem.
// Rota restrita a admin - a guarda está no roteador (module.js: admin).
// ============================================================
import { SECOES } from './docs.content.js';
import { getMatrizDePermissoes } from '../usuarios/usuarios.model.js';
import { rotulaNivel, OCULTO } from '../../core/permissoes.js';
import { esc } from '../../shared/dom.js';
import { ico } from '../../shared/ui/icones.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';
import { montarTabela } from '../../shared/ui/tabela.js';

export async function render(app, { perfil } = {}) {
  const indice = SECOES.map(s => `
    <a class="doc-toc-item" href="#/docs" data-ir="${s.id}">
      <span class="doc-toc-ico" aria-hidden="true">${ico(s.ico, { tam: 16 })}</span>
      <span class="doc-toc-txt">
        <b>${esc(s.titulo)}</b>
        <small>${esc(s.resumo)}</small>
      </span>
    </a>`).join('');

  const secoes = SECOES.map(s => `
    <section class="doc-sec" id="doc-${s.id}">
      <h2><span aria-hidden="true">${ico(s.ico, { tam: 18 })}</span> ${esc(s.titulo)}</h2>
      ${s.html}
    </section>`).join('');

  app.innerHTML = `
    <div class="page-head">
      <h1>Documentação</h1>
      <p>Como o FundHub funciona por dentro - arquitetura, segurança, banco e o passo a passo
         para criar um módulo novo.</p>
    </div>

    <div class="doc-restrito">
      ${ico('restrito', { tam: 14 })} Visível apenas para administradores da SME${perfil?.email ? ` · você está como <b>${esc(perfil.email)}</b>` : ''}.
    </div>

    <div class="doc-layout">
      <nav class="doc-toc" id="doc-toc" aria-label="Índice da documentação">${indice}</nav>
      <div class="doc-conteudo">${secoes}</div>
    </div>`;

  // Rolagem suave até a seção, sem sujar o histórico com hashes falsos
  // (o roteador é por hash - um href="#doc-x" trocaria de rota).
  document.getElementById('doc-toc').addEventListener('click', (e) => {
    const a = e.target.closest('[data-ir]');
    if (!a) return;
    e.preventDefault();
    document.getElementById('doc-' + a.dataset.ir)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  destacarNoScroll();
  pintarPapeis(document.getElementById('doc-papeis'));
}

// A matriz papel × módulo, viva - ver usuarios.model.js § getMatrizDePermissoes.
// É referência, não lista de trabalho: sem busca de propósito no nome, mas
// com o componente de tabela do hub (R18), que dá ordenação e o recolhimento
// das colunas no celular.
async function pintarPapeis(box) {
  if (!box) return;
  box.innerHTML = loading();
  let matriz;
  try {
    matriz = await getMatrizDePermissoes();
  } catch (err) {
    box.innerHTML = erroBox(err);
    return;
  }
  const celula = (x) => {
    const txt = esc(rotulaNivel(x.nivel)) + (x.implicito ? '*' : '');
    return x.nivel === OCULTO ? `<span class="vazio">${txt}</span>` : `<b>${txt}</b>`;
  };
  montarTabela(box, {
    colunas: [
      { id: 'modulo', rotulo: 'Módulo', prioridade: 1, ordenavel: true, tipo: 'texto', valor: l => l.nome },
      ...matriz.papeis.map((p, i) => ({
        id: p.chave, rotulo: p.rotulo, prioridade: i < 2 ? 1 : (i < 4 ? 2 : 3),
        valor: l => rotulaNivel(l.niveis[p.chave].nivel), celula: l => celula(l.niveis[p.chave]),
      })),
    ],
    linhas: matriz.linhas,
    chave: l => l.id,
    buscarEm: ['modulo'],
    ordem: { coluna: 'modulo', dir: 'asc' },
    porPagina: 100,
    substantivo: 'módulos',
    vazio: { ico: 'acesso', titulo: 'Sem módulos', texto: 'Nenhum módulo ativo no registro.' },
  });
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
