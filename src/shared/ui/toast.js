// ============================================================
// FundHub — shared/ui/toast.js
// Balões de aviso no canto da tela. Hoje só as Notificações usam;
// qualquer módulo pode chamar toast({ titulo, texto, tipo }).
// tipo: 'novo' | 'ok' | 'no' | 'upd' | 'del'
// ============================================================
import { esc } from '../dom.js';

function caixa() {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  return box;
}

export function toast({ titulo, texto = '', tipo = 'novo', duracao = 5000 }) {
  const box = caixa();
  const t = document.createElement('div');
  t.className = `toast t-${tipo}`;
  t.innerHTML = `<b>${esc(titulo)}</b>${texto ? `<span>${esc(texto)}</span>` : ''}`;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duracao);
}

export function limparToasts() {
  document.getElementById('toasts')?.remove();
}
