// ============================================================
// FundHub - auditoria/views/mudancas.js  (aba Mudanças)
// Lê o audit_log e mostra, para cada alteração, quem fez, quando (fuso
// São Paulo) e - o pedido central - O QUE mudou: campo a campo, o valor
// de antes e o de depois. Nada aqui escreve no banco.
//
// A aba irmã (atividade.js) responde a outra pergunta: o que ACONTECEU
// no sistema, e não o que mudou no dado.
// ============================================================
import {
  TABELAS, OPERACOES, getAuditoria, mostrarValor, rotulaCampo,
} from '../auditoria.model.js';
import { esc, vazio } from '../../../shared/dom.js';
import { fmtDataHora, hojeISO, addDias } from '../../../shared/format.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { montarTabela } from '../../../shared/ui/tabela.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer } from '../../../shared/ui/drawer.js';
import { ico } from '../../../shared/ui/icones.js';

const OP_TAG = { INSERT: 'st-confirmado', UPDATE: 'st-em_analise', DELETE: 'st-negado' };

let lista = [];
let tabela = null;
let filtro = { tabela: '', operacao: '', autor: '', de: addDias(hojeISO(), -30), ate: hojeISO() };

export async function render(ctx) {
  tabela = null;
  ctx.box().innerHTML = `
    <div class="painel-filtros">
      <label class="filtro-campo">De <input id="mu-de" type="date" value="${filtro.de}" /></label>
      <label class="filtro-campo">Até <input id="mu-ate" type="date" value="${filtro.ate}" /></label>
      <label class="filtro-campo">Módulo <select id="mu-tab">
        <option value="">Todos</option>
        ${Object.entries(TABELAS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <label class="filtro-campo">Ação <select id="mu-op">
        <option value="">Todas</option>
        ${Object.entries(OPERACOES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select></label>
      <label class="filtro-campo"><span>${ico('servidor', { tam: 13 })} Autor</span>
        <input id="mu-autor" type="search" placeholder="autor…" />
      </label>
    </div>
    <div id="mu-lista">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();
  const rec = () => carregar();
  document.getElementById('mu-de').addEventListener('change', e => { filtro.de = e.target.value; rec(); });
  document.getElementById('mu-ate').addEventListener('change', e => { filtro.ate = e.target.value; rec(); });
  document.getElementById('mu-tab').addEventListener('change', e => { filtro.tabela = e.target.value; rec(); });
  document.getElementById('mu-op').addEventListener('change', e => { filtro.operacao = e.target.value; rec(); });
  let deb;
  document.getElementById('mu-autor').addEventListener('input', e => {
    filtro.autor = e.target.value; clearTimeout(deb); deb = setTimeout(rec, 350);
  });

  carregar();
}

async function carregar() {
  const box = document.getElementById('mu-lista');
  // O painel de filtros recarrega do BANCO e a casca da tabela é
  // descartada junto - por isso o loading() e o montarTabela de novo.
  // A busca da tabela é outra coisa: ela estreita o que já está na tela,
  // sem ida ao banco (spec § D6).
  box.innerHTML = loading();
  tabela = null;
  try {
    lista = await getAuditoria({
      tabela: filtro.tabela || undefined, operacao: filtro.operacao || undefined,
      autor: filtro.autor || undefined, de: filtro.de || undefined, ate: filtro.ate || undefined,
    });
  } catch (err) { box.innerHTML = erroBox(err); return; }

  tabela = montarTabela(box, {
    colunas: COLUNAS,
    linhas: lista,
    chave: e => e.id,
    buscarEm: ['modulo', 'resumo', 'autor'],
    ordem: { coluna: 'quando', dir: 'desc' },
    substantivo: 'registros',
    // Sem ações por linha: a tela é só de leitura. O clique na linha abre
    // a gaveta com o de-para campo a campo, e a expansão fica no botão.
    aoClicarLinha: (e) => detalhe(e.id),
    vazio: {
      ico: 'documento', titulo: 'Nada no período',
      texto: 'Ajuste os filtros - ou ninguém alterou nada por aqui.',
    },
  });
}

const COLUNAS = [
  { id: 'quando', rotulo: 'Quando', tipo: 'datahora',
    valor: e => e.criado_em || '',
    celula: e => esc(fmtDataHora(e.criado_em)) },
  { id: 'modulo', rotulo: 'Módulo',
    valor: e => TABELAS[e.tabela] || e.tabela },
  { id: 'operacao', rotulo: 'Ação', prioridade: 2,
    valor: e => OPERACOES[e.operacao] || e.operacao,
    celula: e => `<span class="tag ${OP_TAG[e.operacao] || ''}">`
      + `${esc(OPERACOES[e.operacao] || e.operacao)}</span>` },
  { id: 'resumo', rotulo: 'O que mudou', prioridade: 2, ordenavel: false,
    valor: e => resumo(e) },
  { id: 'autor', rotulo: 'Autor', prioridade: 3,
    valor: e => e.autor || '',
    celula: e => (e.autor ? esc(e.autor) : vazio('autor não identificado')) },
];

// Resumo do que mudou, para a linha da lista.
function resumo(e) {
  if (e.operacao === 'INSERT') return 'Registro criado';
  if (e.operacao === 'DELETE') return 'Registro excluído';
  const campos = Object.keys(e.alteracoes || {}).map(rotulaCampo);
  if (!campos.length) return 'Alteração';
  return 'Alterou ' + campos.slice(0, 3).join(', ') + (campos.length > 3 ? ` +${campos.length - 3}` : '');
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
      <div class="field"><div class="lbl">Autor</div><div class="val">${e.autor ? esc(e.autor) : vazio('autor não identificado')}</div></div>
      ${e.registro_id ? `<div class="field"><div class="lbl">Registro</div><div class="val au-id">${esc(e.registro_id)}</div></div>` : ''}
      <hr class="sep" />
      ${corpo}
    </div>`);
}
