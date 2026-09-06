// ============================================================
// FundHub - modules/ajuda/ajuda.view.js
// Índice + leitor de tutoriais. Sem `?m=` mostra a lista dos módulos
// que a pessoa enxerga e que têm tutorial; com `?m=<id>` abre aquele.
// Um `?m=` de módulo oculto responde como rota inexistente - sem
// confirmar que o módulo existe.
// ============================================================
import { MODULOS, chavePerm } from '../../core/registry.js';
import { nivel, OCULTO } from '../../core/permissoes.js';
import { esc } from '../../shared/dom.js';
import { ico } from '../../shared/ui/icones.js';
import { loading, emptyState } from '../../shared/ui/feedback.js';
import { markdownParaHtml } from './markdown.js';

const comTutorial = () => MODULOS.filter(m =>
  m.doc === true && nivel(chavePerm(m)) !== OCULTO);

export async function render(app, ctx = {}) {
  const alvoId = ctx.params?.get('m') || '';
  const disponiveis = comTutorial();
  const alvo = alvoId ? disponiveis.find(m => m.id === alvoId) : null;

  // ?m= de módulo que a pessoa não enxerga (ou sem tutorial): mesma
  // resposta do roteador para rota inexistente.
  if (alvoId && !alvo) {
    app.innerHTML = `<div class="page-head"><h1>Ajuda</h1></div>` +
      emptyState(ico('perdido', { tam: 32 }), 'Página não encontrada',
        'Não há tutorial para este endereço.');
    return;
  }

  if (!alvo) return pintarIndice(app, disponiveis);
  return pintarTutorial(app, alvo);
}

function pintarIndice(app, disponiveis) {
  app.innerHTML = `
    <div class="page-head">
      <h1>Ajuda</h1>
      <p>Instruções de uso, um tutorial por módulo.</p>
    </div>
    ${disponiveis.length ? `<div class="ajuda-indice">${disponiveis.map(m => `
      <a class="ajuda-tile" href="#/ajuda?m=${encodeURIComponent(m.id)}">
        ${ico(m.ico || 'documento', { tam: 20 })}
        <span>${esc(m.nome)}</span>
      </a>`).join('')}</div>`
    : emptyState(ico('documento', { tam: 32 }), 'Nenhum tutorial disponível',
        'Os módulos que você usa ainda não têm instruções escritas.')}`;
}

async function pintarTutorial(app, mod) {
  app.innerHTML = `
    <div class="page-head">
      <a class="ajuda-voltar" href="#/ajuda">${ico('chevron', { tam: 14 })} Todos os tutoriais</a>
      <h1>Ajuda: ${esc(mod.nome)}</h1>
    </div>
    <article class="ajuda-doc" id="ajuda-doc">${loading()}</article>`;

  const box = document.getElementById('ajuda-doc');
  try {
    const resp = await fetch(`docs/modulos/${mod.id}.md`, { cache: 'no-cache' });
    if (!resp.ok) throw new Error('nao encontrado');
    box.innerHTML = markdownParaHtml(await resp.text());
  } catch {
    box.innerHTML = emptyState(ico('documento', { tam: 32 }), 'Tutorial ainda não disponível',
      'O texto deste módulo ainda não foi publicado.');
  }
}
