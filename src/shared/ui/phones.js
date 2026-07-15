// ============================================================
// FundHub — shared/ui/phones.js
// Editor de lista de telefones (presentational). NÃO fala com o
// Supabase — só monta o HTML, liga add/remover e lê os valores.
// Quem persiste é modules/telefones/telefones.model.js.
//
// Uso na view:
//   form.insertAdjacentHTML('beforeend', phonesEditorHtml(lista));
//   montarPhonesEditor(form);
//   const telefones = lerPhonesEditor(form);   // no submit
// ============================================================
import { esc } from '../dom.js';

export const TIPOS_TELEFONE = [['fixo', 'Fixo'], ['celular', 'Celular'], ['whatsapp', 'WhatsApp']];

// HTML do editor. `lista` = [{ id?, tipo, rotulo, numero, principal }].
export function phonesEditorHtml(lista = [], { label = 'Telefones' } = {}) {
  const rows = (lista || []).map(rowHtml).join('');
  return `
    <div class="phones" data-phones>
      <div class="lbl">${esc(label)}</div>
      <div class="phone-rows">${rows}</div>
      <button type="button" class="mini-btn phone-add">+ telefone</button>
    </div>`;
}

function rowHtml(t = {}) {
  const opts = TIPOS_TELEFONE
    .map(([v, r]) => `<option value="${v}" ${t.tipo === v ? 'selected' : ''}>${r}</option>`)
    .join('');
  return `
    <div class="phone-row" data-id="${esc(t.id || '')}">
      <select class="phone-tipo" aria-label="Tipo">${opts}</select>
      <input class="phone-num" type="tel" inputmode="tel" placeholder="(16) 0000-0000" value="${esc(t.numero || '')}" />
      <input class="phone-rot" type="text" placeholder="rótulo (opcional)" value="${esc(t.rotulo || '')}" />
      <label class="phone-pri" title="Telefone principal">
        <input type="radio" name="phone-pri" ${t.principal ? 'checked' : ''} /> principal
      </label>
      <button type="button" class="phone-del" aria-label="Remover telefone">×</button>
    </div>`;
}

// Liga add/remover. Chame depois de inserir o HTML no DOM.
export function montarPhonesEditor(root) {
  const box = root.querySelector('[data-phones]');
  if (!box) return;
  const rows = box.querySelector('.phone-rows');
  box.querySelector('.phone-add')?.addEventListener('click', () => {
    rows.insertAdjacentHTML('beforeend', rowHtml({ tipo: 'fixo' }));
  });
  box.addEventListener('click', (e) => {
    const del = e.target.closest('.phone-del');
    if (del) del.closest('.phone-row')?.remove();
  });
}

// Lê o editor → [{ id?, tipo, numero, rotulo, principal }] (só com número).
export function lerPhonesEditor(root) {
  const box = root.querySelector('[data-phones]');
  if (!box) return [];
  return [...box.querySelectorAll('.phone-row')].map(r => ({
    id: r.dataset.id || undefined,
    tipo: r.querySelector('.phone-tipo').value,
    numero: r.querySelector('.phone-num').value.trim(),
    rotulo: r.querySelector('.phone-rot').value.trim() || null,
    principal: r.querySelector('.phone-pri input').checked,
  })).filter(t => t.numero);
}

// Formata a lista para exibição (detalhe): "📱 (16) 9... (principal) · ☎ ...".
export function telefonesTexto(lista = []) {
  const ico = { whatsapp: '💬', celular: '📱', fixo: '☎️' };
  return (lista || [])
    .map(t => {
      const num = `<a href="tel:${esc(String(t.numero).replace(/\D/g, ''))}">${esc(t.numero)}</a>`;
      const rot = t.rotulo ? ` <small>(${esc(t.rotulo)})</small>` : '';
      const pri = t.principal ? ' <small class="pri">principal</small>' : '';
      return `<span class="tel-item">${ico[t.tipo] || '☎️'} ${num}${rot}${pri}</span>`;
    })
    .join(' · ') || '—';
}
