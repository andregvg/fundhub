// ============================================================
// FundHub - modules/configuracoes/painel.js
// Renderizador ÚNICO das configurações: usado pela engrenagem (gaveta,
// via roteador) e pela tela do módulo Configurações. Um item é um
// CAMPO (switch/número/opção - renderizador genérico) ou um PAINEL
// (função que o próprio módulo fornece - ex.: a tela de cargos de
// Horários, no Bloco G).
//
// Visibilidade (spec 2026-09-05-configuracoes-por-modulo, D10):
//   item 'usuario' → aparece se nivel(modulo) !== oculto; sempre editável.
//   item 'rede'    → aparece igual; editável só se podeEscrever(modulo).
// Config de rede não editável aparece DESABILITADA, com o valor à vista -
// esconder faria a tela mentir sobre por que o sistema se comporta assim.
// ============================================================
import { conf, pref, definirConf, definirPref, GRUPOS } from '../../core/configuracoes.js';
import { nivel, OCULTO, podeEscrever } from '../../core/permissoes.js';
import { chavePerm } from '../../core/registry.js';
import { esc } from '../../shared/dom.js';
import { abrirDrawer, drawerHead } from '../../shared/ui/drawer.js';
import { toast } from '../../shared/ui/toast.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';

// Abre a gaveta com o painel de UM módulo (clique na engrenagem).
export async function abrirPainelConfig(mod) {
  abrirDrawer(`
    ${drawerHead('Configurações', esc(mod.nome))}
    <div class="drawer-body" id="cfg-drawer-body">${loading()}</div>`);
  await pintarConfigDoModulo(document.getElementById('cfg-drawer-body'), mod, {});
}

// Desenha os grupos e itens de UM módulo dentro de `box`. Usado pela
// gaveta e, um módulo por vez, pela tela agregadora.
export async function pintarConfigDoModulo(box, mod, ctx = {}) {
  if (!box) return;
  const perm = chavePerm(mod);
  if (nivel(perm) === OCULTO) { box.innerHTML = ''; return; }

  let declaracao;
  try {
    ({ DECLARACAO: declaracao } = await mod.config());
  } catch (err) { box.innerHTML = erroBox(err); return; }

  const podeRede = podeEscrever(perm);
  const itens = declaracao?.itens || [];
  const porGrupo = GRUPOS
    .map(g => ({ ...g, itens: itens.filter(i => i.grupo === g.id) }))
    .filter(g => g.itens.length);

  if (!porGrupo.length) { box.innerHTML = '<p class="form-hint">Nada a configurar aqui.</p>'; return; }

  box.innerHTML = porGrupo.map(g => `
    <fieldset class="cfg-grupo">
      <legend>${esc(g.rotulo)}</legend>
      ${g.itens.map(i => itemHtml(i, mod.id, podeRede)).join('')}
    </fieldset>`).join('');

  // Painéis (função do módulo) são desenhados depois, no elemento reservado.
  for (const i of itens.filter(x => typeof x.painel === 'function')) {
    const alvo = box.querySelector(`[data-painel="${cssEscape(i.chave)}"]`);
    if (alvo) {
      try { await i.painel(alvo, ctx); }
      catch (err) { alvo.innerHTML = erroBox(err); }
    }
  }

  ligar(box, mod.id, podeRede);
}

function itemHtml(i, modId, podeRede) {
  if (typeof i.painel === 'function') {
    return `<div class="cfg-item cfg-painel">
      <div class="cfg-rot">${esc(i.rotulo)}${dicaHtml(i)}</div>
      <div data-painel="${esc(i.chave)}">${loading()}</div>
    </div>`;
  }

  const rede = i.escopo === 'rede';
  const desabilita = rede && !podeRede;
  const val = rede ? conf(modId, i.chave) : pref(modId, i.chave);
  const atual = val ?? i.padrao;
  const nome = `cfg-${esc(modId)}-${esc(i.chave)}`;

  let controle = '';
  if (i.tipo === 'switch') {
    controle = `<label class="switch">
      <input type="checkbox" id="${nome}" data-chave="${esc(i.chave)}" data-escopo="${esc(i.escopo)}"
             ${atual ? 'checked' : ''} ${desabilita ? 'disabled' : ''} />
      <span class="switch-trilho" aria-hidden="true"></span></label>`;
  } else if (i.tipo === 'numero') {
    controle = `<input type="number" id="${nome}" data-chave="${esc(i.chave)}" data-escopo="${esc(i.escopo)}"
      value="${esc(String(atual ?? ''))}"${i.min != null ? ` min="${esc(String(i.min))}"` : ''}${i.max != null ? ` max="${esc(String(i.max))}"` : ''}
      ${desabilita ? 'disabled' : ''} />`;
  } else if (i.tipo === 'opcao') {
    controle = `<select id="${nome}" data-chave="${esc(i.chave)}" data-escopo="${esc(i.escopo)}" ${desabilita ? 'disabled' : ''}>
      ${(i.opcoes || []).map(o =>
        `<option value="${esc(String(o.valor))}" ${String(o.valor) === String(atual) ? 'selected' : ''}>${esc(o.rotulo)}</option>`).join('')}
    </select>`;
  }

  return `<div class="cfg-item">
    <label class="cfg-rot" for="${nome}">${esc(i.rotulo)}${
      rede ? ' <span class="cfg-rede" title="Vale para a rede toda">rede</span>' : ''}${dicaHtml(i)}</label>
    ${controle}
    ${desabilita ? '<span class="form-hint">Só quem tem permissão de escrita neste módulo muda isto.</span>' : ''}
  </div>`;
}

const dicaHtml = (i) => i.dica ? `<span class="form-hint cfg-dica">${esc(i.dica)}</span>` : '';
const cssEscape = (s) => String(s).replace(/["\\]/g, '\\$&');

function ligar(box, modId, podeRede) {
  box.addEventListener('change', async (e) => {
    const el = e.target.closest('[data-chave]');
    if (!el) return;
    const { chave, escopo } = el.dataset;
    let valor;
    if (el.type === 'checkbox') valor = el.checked;
    else if (el.type === 'number') valor = el.value === '' ? null : Number(el.value);
    else valor = el.value;

    el.disabled = true;
    try {
      if (escopo === 'rede') await definirConf(modId, chave, valor);
      else await definirPref(modId, chave, valor);
      toast({ titulo: 'Configuração salva', tipo: 'sucesso' });
    } catch (err) {
      toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
    } finally {
      el.disabled = escopo === 'rede' && !podeRede;
    }
  });
}
