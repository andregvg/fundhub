// ============================================================
// FundHub — shared/ui/phones.js
// Editor de lista de telefones (presentational). NÃO fala com o
// Supabase — só monta o HTML, liga add/remover e lê os valores.
// Quem persiste é modules/telefones/telefones.model.js.
//
// A máscara é progressiva e decide sozinha entre fixo e celular:
// 8 dígitos após o DDD → (16) 3626-1805; 9 dígitos → (16) 99770-7813.
// Não dá para fixar o formato num `maxlength` rígido porque a rede
// tem os dois tipos, muitas vezes na mesma escola.
//
// Uso na view:
//   form.insertAdjacentHTML('beforeend', phonesEditorHtml(lista));
//   montarPhonesEditor(form);
//   const telefones = lerPhonesEditor(form);   // no submit
// ============================================================
import { esc } from '../dom.js';

export const TIPOS_TELEFONE = [['fixo', 'Fixo'], ['celular', 'Celular'], ['whatsapp', 'WhatsApp']];

// DDD assumido quando a pessoa digita só o número local. Ribeirão
// Preto e região são 16; quem precisar de outro digita os 10/11
// dígitos e a máscara respeita o que veio.
const DDD_PADRAO = '16';

// ── Máscara ──────────────────────────────────────────────────
// Formata o que já foi digitado, sem exigir o número completo — a
// pessoa vê o formato nascendo enquanto digita.
export function formatarTelefone(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  // Até 4 dígitos ainda não dá para saber se é fixo ou celular.
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  // 9 dígitos locais = celular (o nono dígito veio na frente); 8 = fixo.
  const corte = resto.length > 8 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

// Normaliza para gravar: completa o DDD padrão quando vieram só os
// 8/9 dígitos locais. Guardamos formatado porque é assim que o
// número é lido e conferido — e é o formato que já está no banco.
export function normalizarTelefone(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 8 || d.length === 9) return formatarTelefone(DDD_PADRAO + d);
  return formatarTelefone(d);
}

// Um número é de celular se tem 9 dígitos locais começando em 9.
export function pareceCelular(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  const local = d.length > 9 ? d.slice(2) : d;
  return local.length === 9 && local.startsWith('9');
}

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
      <input class="phone-num" type="tel" inputmode="tel" maxlength="16"
             placeholder="(16) 00000-0000" value="${esc(normalizarTelefone(t.numero) || '')}" />
      <input class="phone-rot" type="text" placeholder="rótulo (opcional)" value="${esc(t.rotulo || '')}" />
      <label class="phone-pri" title="Telefone principal">
        <input type="radio" name="phone-pri" ${t.principal ? 'checked' : ''} /> principal
      </label>
      <button type="button" class="phone-del" aria-label="Remover telefone">×</button>
    </div>`;
}

// Liga add/remover e a máscara. Chame depois de inserir o HTML no DOM.
export function montarPhonesEditor(root) {
  const box = root.querySelector('[data-phones]');
  if (!box) return;
  const rows = box.querySelector('.phone-rows');

  box.querySelector('.phone-add')?.addEventListener('click', () => {
    rows.insertAdjacentHTML('beforeend', rowHtml({ tipo: 'fixo' }));
    rows.querySelector('.phone-row:last-child .phone-num')?.focus();
  });

  box.addEventListener('click', (e) => {
    const del = e.target.closest('.phone-del');
    if (del) del.closest('.phone-row')?.remove();
  });

  // Delegação: pega também as linhas criadas depois deste momento.
  box.addEventListener('input', (e) => {
    const campo = e.target.closest('.phone-num');
    if (!campo) return;
    aplicarMascara(campo);
    // Cortesia: ao reconhecer um celular, ajusta o tipo — mas só se
    // ainda estiver no default 'fixo', para não desfazer a escolha
    // de quem marcou WhatsApp de propósito.
    const tipo = campo.closest('.phone-row')?.querySelector('.phone-tipo');
    if (tipo && tipo.value === 'fixo' && pareceCelular(campo.value)) tipo.value = 'celular';
  });

  // Ao sair do campo, completa o DDD de quem digitou só o local.
  box.addEventListener('focusout', (e) => {
    const campo = e.target.closest('.phone-num');
    if (campo && campo.value.trim()) campo.value = normalizarTelefone(campo.value);
  });
}

// Reaplica a máscara preservando a posição do cursor — sem isto, o
// cursor pula para o fim a cada tecla ao editar o meio do número.
function aplicarMascara(campo) {
  const antes = campo.value;
  const posicao = campo.selectionStart ?? antes.length;
  const digitosAEsquerda = antes.slice(0, posicao).replace(/\D/g, '').length;

  campo.value = formatarTelefone(antes);

  if (digitosAEsquerda === 0) {
    campo.setSelectionRange(campo.value.length, campo.value.length);
    return;
  }
  let vistos = 0, nova = campo.value.length;
  for (let i = 0; i < campo.value.length; i++) {
    if (/\d/.test(campo.value[i])) vistos++;
    if (vistos === digitosAEsquerda) { nova = i + 1; break; }
  }
  campo.setSelectionRange(nova, nova);
}

// Lê o editor → [{ id?, tipo, numero, rotulo, principal }] (só com número).
export function lerPhonesEditor(root) {
  const box = root.querySelector('[data-phones]');
  if (!box) return [];
  return [...box.querySelectorAll('.phone-row')].map(r => ({
    id: r.dataset.id || undefined,
    tipo: r.querySelector('.phone-tipo').value,
    numero: normalizarTelefone(r.querySelector('.phone-num').value),
    rotulo: r.querySelector('.phone-rot').value.trim() || null,
    principal: r.querySelector('.phone-pri input').checked,
  })).filter(t => t.numero);
}

// Formata a lista para exibição (detalhe): "📱 (16) 9... (principal) · ☎ ...".
export function telefonesTexto(lista = []) {
  const ico = { whatsapp: '💬', celular: '📱', fixo: '☎️' };
  return (lista || [])
    .map(t => {
      // normalizar, não formatar: boa parte da base foi cadastrada sem
      // DDD ("3626-1805"), e formatar direto leria o "36" como DDD.
      const fmt = normalizarTelefone(t.numero) || t.numero;
      const num = `<a href="tel:${esc(String(t.numero).replace(/\D/g, ''))}">${esc(fmt)}</a>`;
      const rot = t.rotulo ? ` <small>(${esc(t.rotulo)})</small>` : '';
      const pri = t.principal ? ' <small class="pri">principal</small>' : '';
      return `<span class="tel-item">${ico[t.tipo] || '☎️'} ${num}${rot}${pri}</span>`;
    })
    .join(' · ') || '—';
}
