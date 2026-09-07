// ============================================================
// FundHub - auditoria/views/atividade.js  (aba Atividade)
// Lê o evento_log e mostra o que ACONTECEU no sistema: quem entrou,
// quem exportou, quem mexeu em permissão, quem esbarrou numa tela que
// não pode abrir. Nada aqui escreve no banco - quem emite evento é
// core/eventos.js, no kernel.
//
// A aba irmã (mudancas.js) responde à outra pergunta: o que mudou no
// dado, campo a campo.
// ============================================================
import { TIPOS, getEventos, resumoEvento } from '../eventos.model.js';
import { esc, vazio } from '../../../shared/dom.js';
import { fmtDataHora, hojeISO, addDias } from '../../../shared/format.js';
import { loading, emptyState, erroBox } from '../../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer } from '../../../shared/ui/drawer.js';
import { ico } from '../../../shared/ui/icones.js';

// Acesso negado é o único que pede olhar; permissão é mudança de poder,
// então merece destaque; entrar e exportar são rotina.
const TIPO_TAG = { acesso_negado: 'st-negado', permissao: 'st-em_analise' };

let lista = [];
let filtro = { tipo: '', autor: '', de: addDias(hojeISO(), -30), ate: hojeISO() };

export async function render(ctx) {
  ctx.box().innerHTML = `
    <div class="painel-filtros">
      <label class="filtro-campo">De <input id="at-de" type="date" value="${filtro.de}" /></label>
      <label class="filtro-campo">Até <input id="at-ate" type="date" value="${filtro.ate}" /></label>
      <label class="filtro-campo">Tipo <select id="at-tipo">
        <option value="">Todos</option>
        ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <label class="filtro-campo"><span>${ico('servidor', { tam: 13 })} Autor</span>
        <input id="at-autor" type="search" placeholder="autor…" />
      </label>
      <span class="count" id="at-count"></span>
    </div>
    <div id="at-lista">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();
  const rec = () => carregar();
  document.getElementById('at-de').addEventListener('change', e => { filtro.de = e.target.value; rec(); });
  document.getElementById('at-ate').addEventListener('change', e => { filtro.ate = e.target.value; rec(); });
  document.getElementById('at-tipo').addEventListener('change', e => { filtro.tipo = e.target.value; rec(); });
  let deb;
  document.getElementById('at-autor').addEventListener('input', e => {
    filtro.autor = e.target.value; clearTimeout(deb); deb = setTimeout(rec, 350);
  });

  carregar();
}

async function carregar() {
  const box = document.getElementById('at-lista');
  box.innerHTML = loading();
  try {
    lista = await getEventos({
      tipo: filtro.tipo || undefined, autor: filtro.autor || undefined,
      de: filtro.de || undefined, ate: filtro.ate || undefined,
    });
  } catch (err) { box.innerHTML = erroBox(err); return; }

  document.getElementById('at-count').textContent = `${lista.length} evento(s)`;
  if (!lista.length) {
    box.innerHTML = emptyState(ico('documento', { tam: 32 }), 'Nada no período',
      'Ajuste os filtros - ou não aconteceu nada digno de registro por aqui.');
    return;
  }
  box.innerHTML = lista.map(item).join('');
  box.querySelectorAll('.au-item').forEach(el =>
    el.addEventListener('click', () => detalhe(el.dataset.id)));
}

function item(e) {
  return `<div class="solic au-item" data-id="${e.id}" tabindex="0">
    <div class="solic-main">
      <div class="di-top">
        <b>${esc(TIPOS[e.tipo] || e.tipo)}</b>
        ${TIPO_TAG[e.tipo] ? `<span class="tag ${TIPO_TAG[e.tipo]}">${esc(TIPOS[e.tipo] || e.tipo)}</span>` : ''}
      </div>
      <div class="di-meta">${esc(resumoEvento(e))}</div>
      <div class="di-meta">${esc(fmtDataHora(e.criado_em))} · ${ico('servidor', { tam: 12 })} ${e.autor ? esc(e.autor) : vazio('autor não identificado')}</div>
    </div>
  </div>`;
}

function detalhe(id) {
  const e = lista.find(x => String(x.id) === String(id));
  if (!e) return;

  // O contexto é jsonb livre: mostra par a par, com o valor serializado.
  // Não há rótulo por chave de propósito - as chaves são poucas, já são
  // legíveis, e inventar um dicionário aqui envelheceria calado.
  const ctxLinhas = Object.entries(e.contexto || {})
    .map(([k, v]) => `<div class="field"><div class="lbl">${esc(k)}</div>
      <div class="val">${esc(typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))}</div></div>`)
    .join('');

  abrirDrawer(`
    ${drawerHead(TIPOS[e.tipo] || e.tipo, resumoEvento(e))}
    <div class="drawer-body">
      <div class="field"><div class="lbl">Quando</div><div class="val">${esc(fmtDataHora(e.criado_em))}</div></div>
      <div class="field"><div class="lbl">Autor</div><div class="val">${e.autor ? esc(e.autor) : vazio('autor não identificado')}</div></div>
      ${ctxLinhas ? `<hr class="sep" /><div class="field"><div class="lbl">Detalhes</div></div>${ctxLinhas}` : ''}
    </div>`);
}
