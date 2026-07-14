// ============================================================
// FundHub — shared/dom.js
// Utilitários de DOM/HTML usados por todos os módulos.
// Regra de ouro: TODO valor vindo do banco passa por esc() antes de
// entrar em um template literal. Isso é o que impede XSS armazenado.
// ============================================================

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escapa texto para interpolação segura em HTML.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ENTIDADES[c]);

// Normaliza para busca: minúsculas, sem acentos.
export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// "Feira do Livro" → "feira_do_livro" (chaves técnicas).
export const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

// Valor de um input pelo id, já aparado.
export const val = (id) => (qs('#' + id)?.value ?? '').trim();
export const checked = (id) => Boolean(qs('#' + id)?.checked);

// Mensagem de erro/sucesso nos rodapés de formulário.
export function falha(el, txt) { el.classList.add('err'); el.textContent = txt; }
export function ok(el, txt) { el.classList.add('ok'); el.textContent = txt; }
