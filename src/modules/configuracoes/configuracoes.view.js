// ============================================================
// FundHub - modules/configuracoes/configuracoes.view.js
// Agregador puro (como dashboard/viagens): um bloco por módulo que a
// pessoa pode ver e que declara `config`, na ordem do registro. Usa o
// MESMO renderizador que a engrenagem (painel.js).
// ============================================================
import { MODULOS, chavePerm } from '../../core/registry.js';
import { nivel, OCULTO } from '../../core/permissoes.js';
import { esc } from '../../shared/dom.js';
import { ico } from '../../shared/ui/icones.js';
import { emptyState } from '../../shared/ui/feedback.js';
import { pintarConfigDoModulo } from './painel.js';

const cssEscape = (s) => String(s).replace(/["\\]/g, '\\$&');

export async function render(app, ctx = {}) {
  const perfil = ctx.perfil || null;
  // Módulos configuráveis que a pessoa enxerga (o próprio Configurações fora).
  const alvos = MODULOS.filter(m =>
    m.id !== 'configuracoes' &&
    typeof m.config === 'function' &&
    nivel(chavePerm(m)) !== OCULTO);

  app.innerHTML = `
    <div class="page-head">
      <h1>Configurações</h1>
      <p>O que aparece e como o sistema se comporta - para você e, onde você
         tem permissão, para a rede.</p>
    </div>
    <div id="cfg-lista"></div>`;

  const lista = app.querySelector('#cfg-lista');
  if (!alvos.length) {
    lista.innerHTML = emptyState(ico('config', { tam: 32 }), 'Nada para configurar',
      'Os módulos que você usa ainda não têm opções.');
    return;
  }

  lista.innerHTML = alvos.map(m => `
    <section class="cfg-mod" data-mod="${esc(m.id)}">
      <div class="cfg-mod-head">${ico(m.ico || 'config', { tam: 18 })}<h2>${esc(m.nome)}</h2></div>
      <div class="cfg-mod-corpo"></div>
    </section>`).join('');

  for (const m of alvos) {
    const box = lista.querySelector(`[data-mod="${cssEscape(m.id)}"] .cfg-mod-corpo`);
    await pintarConfigDoModulo(box, m, { perfil });
  }
}
