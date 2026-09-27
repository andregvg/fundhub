// ============================================================
// FundHub - shared/ui/campo-data-hora.js
// Comportamento global de todo <input type="date"> e <input type="time">
// do hub: o clique no canto direito do campo (onde o ícone desenhado em
// CSS aparece) abre o seletor nativo via showPicker(). O ícone nativo do
// navegador foi escondido (components.css) porque ele entrava na ordem
// de tabulação como uma parada a mais depois do último segmento - ver
// docs/superpowers/specs/2026-09-05-campos-data-hora-tab-design.md.
//
// E marca `data-vazio` no campo sem valor, para o CSS pintar a máscara
// "dd/mm/aaaa" no tom de placeholder (components.css). CSS não enxerga o
// valor de um date/time - não há placeholder de verdade nem
// `:placeholder-shown` - e sem a marca a máscara vazia tinha a mesma cor
// de uma data preenchida.
//
// Um ouvinte só, delegado em document, cobre os 32 campos de hoje e
// qualquer campo futuro - inclusive um que nasça dentro de um modal
// aberta bem depois deste módulo já ter sido ligado (uma vez, no boot).
// ============================================================

// Largura da faixa clicável do ícone, em pixels - precisa bater com
// `background-size` + a folga de `background-position` em components.css
// (16px de ícone + 8px de respiro à direita + uma margem de acerto).
export const LARGURA_ICONE = 26;

// Pura: decide se um clique caiu na faixa do ícone (canto direito do
// campo). Extraída à parte para poder ser testada sem DOM - o mesmo
// padrão de shared/ui/toast.js (normalizarTipo/duracaoPadrao puras,
// o resto do módulo com efeito colateral).
export function cliqueNoIcone(offsetX, larguraCampo) {
  return offsetX >= larguraCampo - LARGURA_ICONE;
}

const SELETOR = 'input:is([type="date"], [type="time"], [type="datetime-local"], [type="month"])';

function marcarVazio(el) { el.toggleAttribute('data-vazio', !el.value); }
function varrer(raiz) {
  if (raiz.matches?.(SELETOR)) marcarVazio(raiz);
  raiz.querySelectorAll?.(SELETOR).forEach(marcarVazio);
}

export function ligarCamposDataHora() {
  // Digitou, escolheu no calendário, apagou - e, ao sair do campo, confere
  // de novo: cobre valor posto por código (`el.value = …`), que não
  // dispara evento nenhum.
  const aoMudar = (e) => { if (e.target.matches?.(SELETOR)) marcarVazio(e.target); };
  for (const ev of ['input', 'change', 'focusout']) document.addEventListener(ev, aoMudar, true);
  // form.reset() esvazia sem disparar input/change.
  document.addEventListener('reset', (e) => setTimeout(() => varrer(e.target)), true);
  // Telas e modais montam HTML por innerHTML: todo campo novo entra por aqui.
  new MutationObserver((mudancas) => {
    for (const m of mudancas) m.addedNodes.forEach(n => { if (n.nodeType === 1) varrer(n); });
  }).observe(document.body, { childList: true, subtree: true });
  varrer(document.body);

  document.addEventListener('click', (e) => {
    const campo = e.target.closest('input[type="date"], input[type="time"]');
    if (!campo || campo.disabled || campo.readOnly) return;
    if (!cliqueNoIcone(e.offsetX, campo.clientWidth)) return;
    try { campo.showPicker?.(); } catch (_) { /* degrada em silencio - ver D3 da spec */ }
  });
}
