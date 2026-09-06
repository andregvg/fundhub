// ============================================================
// FundHub - shared/ui/phones.js
// Editor de lista de telefones (presentational). NÃO fala com o
// Supabase - só monta o HTML, liga add/remover e lê os valores.
// Quem persiste é modules/telefones/telefones.model.js.
//
// A máscara é progressiva e decide sozinha entre fixo e celular:
// 8 dígitos após o DDD → (16) 3333-3333; 9 dígitos → (16) 99999-9999.
// Não dá para fixar o formato num `maxlength` rígido porque a rede
// tem os dois tipos, muitas vezes na mesma escola.
//
// Uso na view:
//   form.insertAdjacentHTML('beforeend', phonesEditorHtml(lista));
//   montarPhonesEditor(form);
//   const telefones = lerPhonesEditor(form);   // no submit
// ============================================================
import { esc, vazio } from '../dom.js';
import { ico } from './icones.js';

export const TIPOS_TELEFONE = [['fixo', 'Fixo'], ['celular', 'Celular'], ['whatsapp', 'WhatsApp']];

// DDD assumido quando a pessoa digita só o número local. Ribeirão
// Preto e região são 16; quem precisar de outro digita os 10/11
// dígitos e a máscara respeita o que veio.
const DDD_PADRAO = '16';
const PAIS_PADRAO = '55';

// ── Máscara ──────────────────────────────────────────────────
// Formata o que já foi digitado, sem exigir o número completo - a
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

// Completa o DDD padrão quando vieram só os 8/9 dígitos locais e devolve
// FORMATADO. É o auxiliar do campo (o `focusout` conserta o que a pessoa
// digitou pela metade), não o formato de gravação - quem grava é paraE164.
export function normalizarTelefone(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 8 || d.length === 9) return formatarTelefone(DDD_PADRAO + d);
  return formatarTelefone(d);
}

// ── E.164: o formato de GRAVAÇÃO ─────────────────────────────
// `+5516999999999`. É a norma ITU-T E.164, o que libphonenumber, Twilio e
// WhatsApp usam, e exatamente o que o URI `tel:` (RFC 3966) quer.
//
// Até 06/09/2026 o banco guardava o número FORMATADO, e o comentário que
// justificava isso ("é assim que o número é lido e conferido") confundia
// legibilidade com armazenamento - a mesma confusão que punha máscara no
// CPF. E cobrava o preço: boa parte da base foi cadastrada sem DDD
// ('3333-3333'), e sem saber se os dois primeiros dígitos são DDD ou
// prefixo não há como formatar sem chutar. Com o código do país explícito
// a ambiguidade acaba: o que está gravado sempre diz o que é.
//
// Escada de tamanhos, do mais completo ao menos:
//   12-13 dígitos começando em 55 → já tem país, só falta o '+';
//   10-11 dígitos                 → tem DDD, falta o país;
//   8-9 dígitos                   → é local, faltam DDD e país.
// Fora disso não dá para afirmar nada: devolve vazio em vez de inventar - e
// vazio é descartado por sincronizarTelefones, como uma linha em branco.
// Para que isso não vire perda silenciosa de um número digitado pela metade,
// o campo carrega um `pattern`: o próprio navegador barra o envio e diz o
// que falta, em vez de o número sumir depois de salvo.
export function paraE164(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length >= 12 && d.length <= 13 && d.startsWith(PAIS_PADRAO)) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+${PAIS_PADRAO}${d}`;
  if (d.length === 8 || d.length === 9) return `+${PAIS_PADRAO}${DDD_PADRAO}${d}`;
  return '';
}

// E.164 → os dígitos nacionais, para a máscara brasileira poder formatar.
// Número que não é do Brasil volta como está: melhor um '+34 91…' cru na
// tela do que um número estrangeiro fatiado num formato que não é o dele.
export function deE164(valor) {
  const s = String(valor || '').trim();
  if (!s.startsWith('+')) return s;                 // legado ainda não migrado
  const d = s.slice(1);
  if (!d.startsWith(PAIS_PADRAO)) return s;
  return d.slice(PAIS_PADRAO.length);
}

// O número como a pessoa lê: '(16) 99999-9999'.
// Só o brasileiro é formatado. `formatarTelefone` joga fora tudo que não é
// dígito, então um número espanhol sairia vestido de brasileiro, com DDD e
// hífen no lugar errado - pior do que não formatar.
export function exibirTelefone(valor) {
  const nacional = deE164(valor);
  if (nacional.startsWith('+')) return nacional;
  // `normalizarTelefone`, não `formatarTelefone`: sem o '+' o valor é legado
  // ainda não migrado, e boa parte da base foi cadastrada SEM DDD
  // ('3333-3333') - formatar direto leria o '33' como DDD. A tela precisa
  // continuar certa na janela entre o deploy e a migration 029.
  return normalizarTelefone(nacional) || String(valor || '');
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
      <button type="button" class="mini-btn phone-add">${ico('adicionar', { tam: 14 })} telefone</button>
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
             pattern="\\(\\d{2}\\) \\d{4,5}-\\d{4}"
             title="Informe o número completo: (00) 0000-0000 ou (00) 00000-0000"
             placeholder="(16) 00000-0000" value="${esc(exibirTelefone(t.numero))}" />
      <input class="phone-rot" type="text" placeholder="rótulo (opcional)" value="${esc(t.rotulo || '')}" />
      <label class="switch radio phone-pri" title="Telefone principal">
        <input type="radio" name="phone-pri" aria-label="Telefone principal" ${t.principal ? 'checked' : ''} />
        <span class="switch-trilho" aria-hidden="true"></span>
      </label>
      <button type="button" class="mini-btn no phone-del" aria-label="Remover telefone">${ico('excluir', { tam: 14 })}</button>
    </div>`;
}

// Liga add/remover e a máscara. Chame depois de inserir o HTML no DOM.
export function montarPhonesEditor(root) {
  const box = root.querySelector('[data-phones]');
  if (!box) return;
  const rows = box.querySelector('.phone-rows');

  // Uma lista de telefones sem principal não ajuda ninguém a decidir
  // para qual ligar. Se ninguém marcou, o primeiro assume.
  function garantirPrincipal() {
    const radios = [...box.querySelectorAll('.phone-pri input')];
    if (radios.length && !radios.some(r => r.checked)) radios[0].checked = true;
  }

  box.querySelector('.phone-add')?.addEventListener('click', () => {
    rows.insertAdjacentHTML('beforeend', rowHtml({ tipo: 'fixo' }));
    rows.querySelector('.phone-row:last-child .phone-num')?.focus();
    garantirPrincipal();
  });

  box.addEventListener('click', (e) => {
    const del = e.target.closest('.phone-del');
    if (del) { del.closest('.phone-row')?.remove(); garantirPrincipal(); }
  });

  // Delegação: pega também as linhas criadas depois deste momento.
  box.addEventListener('input', (e) => {
    const campo = e.target.closest('.phone-num');
    if (!campo) return;
    aplicarMascara(campo);
    // Cortesia: ao reconhecer um celular, ajusta o tipo - mas só se
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

  // A lista pode vir do banco sem nenhum principal marcado.
  garantirPrincipal();
}

// Reaplica a máscara preservando a posição do cursor - sem isto, o
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
    numero: paraE164(r.querySelector('.phone-num').value),
    rotulo: r.querySelector('.phone-rot').value.trim() || null,
    principal: r.querySelector('.phone-pri input').checked,
  })).filter(t => t.numero);
}

// Formata a lista para exibição (detalhe): ícone de celular, WhatsApp
// ou fixo (conforme o tipo) + "(16) 9... (principal) · ...".
const ICO_TEL = { whatsapp: 'whatsapp', celular: 'celular', fixo: 'fixo' };

export function telefonesTexto(lista = []) {
  return (lista || [])
    .map(t => {
      // O href vai em E.164 - é o que a RFC 3966 pede e o que o discador
      // do celular entende sem adivinhar região.
      const num = `<a href="tel:${esc(paraE164(t.numero) || t.numero)}">${esc(exibirTelefone(t.numero))}</a>`;
      const rot = t.rotulo ? ` <small>(${esc(t.rotulo)})</small>` : '';
      const pri = t.principal ? ' <small class="pri">principal</small>' : '';
      return `<span class="tel-item">${ico(ICO_TEL[t.tipo] || 'fixo', { tam: 14 })} ${num}${rot}${pri}</span>`;
    })
    .join(' · ') || vazio('sem telefone cadastrado');
}
