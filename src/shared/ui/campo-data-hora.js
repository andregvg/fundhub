// ============================================================
// FundHub - shared/ui/campo-data-hora.js
// Comportamento global de todo <input type="date"> e <input type="time">
// do hub: o clique no canto direito do campo (onde o ícone desenhado em
// CSS aparece) abre o seletor nativo via showPicker(). O ícone nativo do
// navegador foi escondido (components.css) porque ele entrava na ordem
// de tabulação como uma parada a mais depois do último segmento - ver
// docs/superpowers/specs/2026-09-05-campos-data-hora-tab-design.md.
//
// Um ouvinte só, delegado em document, cobre os 32 campos de hoje e
// qualquer campo futuro - inclusive um que nasça dentro de uma gaveta
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

export function ligarCamposDataHora() {
  document.addEventListener('click', (e) => {
    const campo = e.target.closest('input[type="date"], input[type="time"]');
    if (!campo || campo.disabled || campo.readOnly) return;
    if (!cliqueNoIcone(e.offsetX, campo.clientWidth)) return;
    campo.showPicker?.();
  });
}
