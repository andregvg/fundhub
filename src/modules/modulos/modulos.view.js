// ============================================================
// FundHub — modules/modulos/modulos.view.js
// O índice de ferramentas do hub (a antiga home). Os tiles saem do
// registro de módulos — nada é escrito à mão aqui, e o que a pessoa
// não pode ver já vem filtrado por modulosVisiveis().
// ============================================================
import { modulosVisiveis, GRUPOS, chavePerm } from '../../core/registry.js';
import { nivel, rotulaNivel, ESCRITA } from '../../core/permissoes.js';
import { esc } from '../../shared/dom.js';

export async function render(app) {
  const visiveis = modulosVisiveis().filter(m => m.id !== 'modulos');

  // Agrupa na mesma ordem do menu lateral, para a pessoa reconhecer
  // a estrutura nos dois lugares.
  const secoes = GRUPOS
    .map(g => ({ ...g, itens: visiveis.filter(m => (m.grupo || 'modulos') === g.id) }))
    .filter(g => g.itens.length)
    .map(g => `
      ${g.rotulo ? `<h2 class="secao-tit">${esc(g.rotulo)}</h2>` : ''}
      <div class="tiles">${g.itens.map(tile).join('')}</div>`)
    .join('');

  app.innerHTML = `
    <div class="page-head">
      <h1>Todos os Módulos</h1>
      <p>Ferramentas disponíveis para o seu acesso. O que não aparece aqui
         não está liberado para o seu perfil.</p>
    </div>
    ${secoes}`;
}

function tile(m) {
  const n = nivel(chavePerm(m));
  const badge = !m.ativo
    ? `<span class="badge breve">em breve</span>`
    : n === ESCRITA
      ? `<span class="badge ativo">ativo</span>`
      : `<span class="badge nivel">${esc(rotulaNivel(n))}</span>`;

  const inner = `${badge}
    <div class="ico" aria-hidden="true">${m.ico}</div>
    <h3>${esc(m.nome)}</h3>
    <p>${esc(m.desc)}</p>`;

  // Módulo ativo com rota → tile clicável. Ativo sem rota (serviço, como
  // as Notificações) → tile informativo. Inativo → tile apagado.
  if (m.ativo && m.rota) return `<a class="tile" href="${m.rota}">${inner}</a>`;
  return `<div class="tile ${m.ativo ? 'servico' : 'soon'}">${inner}</div>`;
}
