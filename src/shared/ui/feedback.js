// ============================================================
// FundHub — shared/ui/feedback.js
// Estados de carregamento, vazio e erro. Um único visual para todos
// os módulos: se mudar aqui, muda no hub inteiro.
// ============================================================
import { esc } from '../dom.js';

export const loading = (txt = 'Carregando…') => `<div class="loading">${esc(txt)}</div>`;

export const emptyState = (ico, titulo, msg = '') => `
  <div class="empty">
    <div class="empty-ico">${ico}</div>
    <h3>${esc(titulo)}</h3>
    ${msg ? `<p>${msg}</p>` : ''}
  </div>`;

// Erro amigável (a mensagem crua do Supabase entra escapada).
export const erroBox = (err) =>
  `<p class="count">Não foi possível carregar: ${esc(err?.message || err)}</p>`;
