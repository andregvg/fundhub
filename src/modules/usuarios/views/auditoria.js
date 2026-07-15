// ============================================================
// FundHub — usuarios/views/auditoria.js  (aba Auditoria)
// Lê o audit_log e mostra, para cada alteração, quem fez, quando (fuso
// São Paulo) e — o pedido central — O QUE mudou: campo a campo, o valor
// de antes e o de depois. Nada aqui escreve no banco.
// ============================================================
import {
  TABELAS, OPERACOES, getAuditoria, mostrarValor, rotulaCampo,
} from '../auditoria.model.js';
import { esc } from '../../../shared/dom.js';
import { fmtDataHora, hojeISO, addDias } from '../../../shared/format.js';
import { loading, emptyState, erroBox } from '../../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer } from '../../../shared/ui/drawer.js';

const OP_TAG = { INSERT: 'st-confirmado', UPDATE: 'st-em_analise', DELETE: 'st-negado' };

let lista = [];
let filtro = { tabela: '', operacao: '', autor: '', de: addDias(hojeISO(), -30), ate: hojeISO() };

export async function render(ctx) {
  ctx.box().innerHTML = `
    <div class="toolbar subfiltros">
      <label class="search compacta">De <input id="au-de" type="date" value="${filtro.de}" /></label>
      <label class="search compacta">Até <input id="au-ate" type="date" value="${filtro.ate}" /></label>
      <label class="search compacta">Módulo <select id="au-tab">
        <option value="">Todos</option>
        ${Object.entries(TABELAS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <label class="search compacta">Ação <select id="au-op">
        <option value="">Todas</option>
        ${Object.entries(OPERACOES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <label class="search compacta">👤 <input id="au-autor" type="search" placeholder="autor…" /></label>
      <span class="count" id="au-count"></span>
    </div>
    <div id="au-lista">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();
  const rec = () => carregar();
  document.getElementById('au-de').addEventListener('change', e => { filtro.de = e.target.value; rec(); });
  document.getElementById('au-ate').addEventListener('change', e => { filtro.ate = e.target.value; rec(); });
  document.getElementById('au-tab').addEventListener('change', e => { filtro.tabela = e.target.value; rec(); });
  document.getElementById('au-op').addEventListener('change', e => { filtro.operacao = e.target.value; rec(); });
  let deb;
  document.getElementById('au-autor').addEventListener('input', e => {
    filtro.autor = e.target.value; clearTimeout(deb); deb = setTimeout(rec, 350);
  });

  carregar();
}

async function carregar() {
  const box = document.getElementById('au-lista');
  box.innerHTML = loading();
  try {
    lista = await getAuditoria({
      tabela: filtro.tabela || undefined, operacao: filtro.operacao || undefined,
      autor: filtro.autor || undefined, de: filtro.de || undefined, ate: filtro.ate || undefined,
    });
  } catch (err) { box.innerHTML = erroBox(err); return; }

  document.getElementById('au-count').textContent = `${lista.length} registro(s)`;
  if (!lista.length) {
    box.innerHTML = emptyState('🗂️', 'Nada no período', 'Ajuste os filtros — ou ninguém alterou nada por aqui.');
    return;
  }
  box.innerHTML = lista.map(item).join('');
  box.querySelectorAll('.au-item').forEach(el =>
    el.addEventListener('click', () => detalhe(el.dataset.id)));
}

// Resumo do que mudou, para a linha da lista.
function resumo(e) {
  if (e.operacao === 'INSERT') return 'Registro criado';
  if (e.operacao === 'DELETE') return 'Registro excluído';
  const campos = Object.keys(e.alteracoes || {}).map(rotulaCampo);
  if (!campos.length) return 'Alteração';
  return 'Alterou ' + campos.slice(0, 3).join(', ') + (campos.length > 3 ? ` +${campos.length - 3}` : '');
}

function item(e) {
  return `<div class="solic au-item" data-id="${e.id}" tabindex="0">
    <div class="solic-main">
      <div class="di-top">
        <b>${esc(TABELAS[e.tabela] || e.tabela)}</b>
        <span class="tag ${OP_TAG[e.operacao] || ''}">${esc(OPERACOES[e.operacao] || e.operacao)}</span>
      </div>
      <div class="di-meta">${esc(resumo(e))}</div>
      <div class="di-meta">${esc(fmtDataHora(e.criado_em))} · 👤 ${esc(e.autor || '—')}</div>
    </div>
  </div>`;
}

function detalhe(id) {
  const e = lista.find(x => String(x.id) === String(id));
  if (!e) return;

  let corpo = '';
  if (e.operacao === 'UPDATE') {
    const alt = e.alteracoes || {};
    corpo = `<div class="field"><div class="lbl">O que mudou</div></div>
      <div class="au-diff">${Object.entries(alt).map(([k, v]) => `
        <div class="au-campo">
          <div class="au-campo-nome">${esc(rotulaCampo(k))}</div>
          <div class="au-de">${esc(mostrarValor(v.de))}</div>
          <div class="au-seta">→</div>
          <div class="au-para">${esc(mostrarValor(v.para))}</div>
        </div>`).join('')}</div>`;
  } else {
    // INSERT/DELETE: mostra o retrato do registro (sem campos de sistema).
    const dados = e.operacao === 'DELETE' ? e.dados_antes : e.dados_depois;
    const ocultar = new Set(['id', 'criado_em', 'atualizado_em', 'criado_por', 'ultimo_acesso']);
    const linhas = Object.entries(dados || {})
      .filter(([k, v]) => !ocultar.has(k) && v !== null && v !== '')
      .map(([k, v]) => `<div class="field"><div class="lbl">${esc(rotulaCampo(k))}</div><div class="val">${esc(mostrarValor(v))}</div></div>`)
      .join('');
    corpo = `<div class="field"><div class="lbl">${e.operacao === 'DELETE' ? 'Registro excluído' : 'Registro criado'}</div></div>${linhas}`;
  }

  abrirDrawer(`
    ${drawerHead(TABELAS[e.tabela] || e.tabela, OPERACOES[e.operacao] || e.operacao)}
    <div class="drawer-body">
      <div class="field"><div class="lbl">Quando</div><div class="val">${esc(fmtDataHora(e.criado_em))}</div></div>
      <div class="field"><div class="lbl">Autor</div><div class="val">${esc(e.autor || '—')}</div></div>
      ${e.registro_id ? `<div class="field"><div class="lbl">Registro</div><div class="val au-id">${esc(e.registro_id)}</div></div>` : ''}
      <hr class="sep" />
      ${corpo}
    </div>`);
}
