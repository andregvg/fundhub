// ============================================================
// FundHub - modules/configuracoes/configuracoes.view.js
// Agregador puro (como o dashboard): o bloco "Geral" (tema) e um
// bloco expansível por módulo que a pessoa pode ver e que declara `config`,
// na ordem do registro. Usa o MESMO renderizador que a engrenagem (painel.js).
// ============================================================
import { MODULOS, veModulo } from '../../core/registry.js';
import { esc } from '../../shared/dom.js';
import { ico } from '../../shared/ui/icones.js';
import { pintarConfigDoModulo, pintarTema } from './painel.js';

// Quais blocos ficaram abertos - conveniência do navegador, a tela
// funciona sem. Primeiro acesso: só o "Geral".
const CHAVE_ABERTOS = 'fundhub:cfg-abertos';
function lerAbertos() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_ABERTOS) || 'null');
    return new Set(Array.isArray(v) ? v : ['geral']);
  } catch (_) { return new Set(['geral']); }
}
function gravarAbertos(set) {
  try { localStorage.setItem(CHAVE_ABERTOS, JSON.stringify([...set])); } catch (_) { /* sem lembrança */ }
}

// <details> nativo: teclado, leitor de tela e abrir/fechar sem JS. O nome
// do módulo é o <summary>; a seta gira pelo [open] (configuracoes.css).
const blocoHtml = (id, icone, nome, aberto) => `
  <details class="cfg-mod" data-mod="${esc(id)}" ${aberto ? 'open' : ''}>
    <summary class="cfg-mod-head">
      ${ico(icone, { tam: 18 })}<h2>${esc(nome)}</h2>
      <span class="cfg-mod-seta" aria-hidden="true">${ico('chevron', { tam: 16 })}</span>
    </summary>
    <div class="cfg-mod-corpo"></div>
  </details>`;

export async function render(app, ctx = {}) {
  const perfil = ctx.perfil || null;
  // Módulos configuráveis que a pessoa enxerga (o próprio Configurações fora).
  const alvos = MODULOS.filter(m =>
    m.id !== 'configuracoes' &&
    typeof m.config === 'function' &&
    veModulo(m));

  app.innerHTML = `
    <div class="page-head">
      <h1>Configurações</h1>
      <p>O que aparece e como o sistema se comporta - para você e, onde você
         tem permissão, para a rede.</p>
    </div>
    <div id="cfg-lista"></div>`;

  const lista = app.querySelector('#cfg-lista');
  const abertos = lerAbertos();
  lista.innerHTML = blocoHtml('geral', 'config', 'Geral', abertos.has('geral'))
    + alvos.map(m => blocoHtml(m.id, m.ico || 'config', m.nome, abertos.has(m.id))).join('');

  // Cada bloco é desenhado na PRIMEIRA abertura: antes a página esperava
  // todos os módulos em fila, mesmo os que ninguém ia abrir.
  const pintar = async (det) => {
    if (det.dataset.pintado) return;
    det.dataset.pintado = '1';
    const corpo = det.querySelector('.cfg-mod-corpo');
    if (det.dataset.mod === 'geral') { pintarTema(corpo); return; }
    const mod = alvos.find(m => m.id === det.dataset.mod);
    if (mod) await pintarConfigDoModulo(corpo, mod, { perfil });
  };

  // `toggle` não borbulha: ouvinte na fase de captura.
  lista.addEventListener('toggle', (e) => {
    const det = e.target.closest?.('details.cfg-mod');
    if (!det) return;
    if (det.open) { abertos.add(det.dataset.mod); pintar(det); }
    else abertos.delete(det.dataset.mod);
    gravarAbertos(abertos);
  }, true);

  for (const det of lista.querySelectorAll('details.cfg-mod[open]')) await pintar(det);
}
