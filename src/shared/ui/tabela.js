// ============================================================
// FundHub - shared/ui/tabela.js
// O padrão de lista tabular do hub. Ver a spec
// 2026-09-08-listas-e-modais-design.md.
//
// A view DECLARA colunas, ações e dados; este componente monta a
// marcação e liga ordenação, paginação, busca e expansão. É o que faz
// "toda tabela do FundHub segue o padrão" ser fato, e não intenção.
//
// Duas ideias carregam o resto:
//
//   `valor` ORDENA e BUSCA (texto puro); `celula` DESENHA (HTML).
//   Sem essa separação, ordenar a coluna "Situação" ordenaria pelo
//   HTML do chip - igual em todas as linhas.
//
//   Prioridade de coluna, nunca rolagem lateral. Coluna de prioridade
//   2 some abaixo de 900px, a de 3 abaixo de 720px, e o que sumiu
//   reaparece quando a linha é expandida - para BAIXO.
//
// Escape (R5): coluna só com `valor` é escapada aqui. Coluna com
// `celula` devolve HTML e o esc() é de quem escreveu a view - o
// caminho seguro é o default, o perigoso exige escolha deliberada.
// ============================================================
import { esc, norm } from '../dom.js';
import { emptyState } from './feedback.js';
import { ico } from './icones.js';

// Comparadores por tipo declarado. Nada é adivinhado pelo conteúdo.
const COMPARA = {
  texto:  (a, b) => String(a).localeCompare(String(b), 'pt-BR'),
  numero: (a, b) => (Number(a) || 0) - (Number(b) || 0),
  // Data civil é `yyyy-mm-dd` e timestamp ISO começa por ele: os dois são
  // ordenáveis como STRING (R8). Nenhum Date é construído aqui.
  data:   (a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0),
};
COMPARA.datahora = COMPARA.data;

function normalizar(o) {
  const colunas = (o.colunas || []).map(c => ({
    id: c.id,
    rotulo: c.rotulo ?? '',
    prioridade: c.prioridade || 1,
    ordenavel: c.ordenavel !== false,
    tipo: c.tipo || 'texto',
    alinhar: c.alinhar || 'esq',
    valor: c.valor || ((l) => l?.[c.id] ?? ''),
    celula: c.celula || null,
  }));
  return {
    colunas,
    chave: o.chave || ((l) => l?.id),
    acoes: o.acoes || [],
    buscarEm: o.buscarEm || null,
    porPagina: o.porPagina === 0 ? 0 : (o.porPagina || 25),
    ordem: { ...(o.ordem || { coluna: colunas.find(c => c.ordenavel)?.id || '', dir: 'asc' }) },
    aoClicarLinha: o.aoClicarLinha || null,
    substantivo: o.substantivo || 'registros',
    vazio: o.vazio || { ico: 'vazio', titulo: 'Nada por aqui', texto: '' },
  };
}

const conteudo = (c, l) => (c.celula ? c.celula(l) : esc(c.valor(l)));

function textoBusca(cfg, linha) {
  if (typeof cfg.buscarEm === 'function') return cfg.buscarEm(linha);
  const ids = cfg.buscarEm || cfg.colunas.map(c => c.id);
  return ids
    .map(id => cfg.colunas.find(c => c.id === id)?.valor(linha) ?? '')
    .join(' ');
}

// Ordenação ESTÁVEL: o índice original desempata, e por isso ordenar por
// duas colunas em sequência produz o resultado que se espera.
function ordenar(lista, cfg, ordem) {
  const col = cfg.colunas.find(c => c.id === ordem.coluna);
  if (!col) return lista;
  const cmp = COMPARA[col.tipo] || COMPARA.texto;
  const sinal = ordem.dir === 'desc' ? -1 : 1;
  return lista
    .map((l, i) => [l, i])
    .sort((a, b) => (cmp(col.valor(a[0]), col.valor(b[0])) * sinal) || (a[1] - b[1]))
    .map(p => p[0]);
}

const clsCol = (c) => `p${c.prioridade}${c.alinhar === 'dir' ? ' dir' : ''}`;

function botoes(cfg, l) {
  return cfg.acoes
    .map((a, i) => (a.quando && !a.quando(l)) ? ''
      : `<button type="button" class="mini-btn${a.perigo ? ' no' : ''}" data-acao="${i}"`
        + ` aria-label="${esc(a.rotulo)}" title="${esc(a.rotulo)}">${ico(a.ico)}</button>`)
    .join('');
}

// O detalhe traz só o que a linha pode esconder - coluna de prioridade 1
// nunca some, e repeti-la aqui seria mostrar duas vezes a mesma coisa.
function detalhe(cfg, l) {
  const pares = cfg.colunas.filter(c => c.prioridade > 1).map(c =>
    `<div class="det-par p${c.prioridade}"><span class="lbl">${esc(c.rotulo)}</span>`
    + `<span>${conteudo(c, l)}</span></div>`).join('');
  return pares + (cfg.acoes.length ? `<div class="det-acoes">${botoes(cfg, l)}</div>` : '');
}

export function montarTabela(el, opcoes = {}) {
  const cfg = normalizar(opcoes);
  const nCols = 1 + cfg.colunas.length + (cfg.acoes.length ? 1 : 0);
  const temP2 = cfg.colunas.some(c => c.prioridade === 2);
  const podeExpandir = temP2 || cfg.colunas.some(c => c.prioridade === 3) || cfg.acoes.length > 0;

  let linhas = opcoes.linhas || [];
  let vista = [];                                   // filtrada + ordenada
  const est = { pagina: 1, ordem: cfg.ordem, busca: '', aberta: null };
  let deb = null;
  let tbody = null, elCount = null, elPe = null;

  function cabecalho() {
    const cols = cfg.colunas.map(c => {
      const miolo = c.ordenavel
        ? `<button type="button" class="ord-btn" data-col="${esc(c.id)}">${esc(c.rotulo)}`
          + `${ico('chevron', { tam: 13, classe: 'ord-seta' })}</button>`
        : esc(c.rotulo);
      return `<th scope="col" class="${clsCol(c)}" data-col="${esc(c.id)}">${miolo}</th>`;
    }).join('');
    return `<th class="col-exp"></th>${cols}`
      + (cfg.acoes.length ? '<th class="acoes" aria-label="Ações"></th>' : '');
  }

  function pintar() {
    if (!linhas.length) {
      el.innerHTML = emptyState(ico(cfg.vazio.ico, { tam: 32 }), cfg.vazio.titulo, cfg.vazio.texto);
      tbody = null;
      return;
    }
    el.innerHTML = `
      <div class="tabela-caixa">
        <div class="tabela-topo">
          <div class="search">${ico('buscar')}<input type="search" class="tabela-busca"
            placeholder="Buscar na lista…" aria-label="Buscar na lista" /></div>
          <span class="count tabela-count"></span>
        </div>
        <div class="tabela-rolagem">
          <table class="tabela" data-exp="${podeExpandir ? 1 : 0}" data-prio2="${temP2 ? 1 : 0}">
            <thead><tr>${cabecalho()}</tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="tabela-pe" hidden>
          <span class="tabela-pe-info"></span>
          <button type="button" class="mini-btn ant" aria-label="Página anterior">${ico('voltar')}</button>
          <button type="button" class="mini-btn prox" aria-label="Próxima página">${ico('avancar')}</button>
        </div>
      </div>`;
    tbody = el.querySelector('tbody');
    elCount = el.querySelector('.tabela-count');
    elPe = el.querySelector('.tabela-pe');
    pintarCorpo();
  }

  // Repinta SÓ o <tbody> e o rodapé. O <thead> e a caixa de busca
  // continuam sendo os mesmos nós - o foco de quem está digitando
  // sobrevive, o que importa porque uma lista com realtime chama isto a
  // cada evento do banco.
  function pintarCorpo() {
    if (!tbody) return;
    const filtradas = est.busca
      ? linhas.filter(l => norm(textoBusca(cfg, l)).includes(est.busca))
      : linhas;
    vista = ordenar(filtradas, cfg, est.ordem);

    const paginas = cfg.porPagina ? Math.max(1, Math.ceil(vista.length / cfg.porPagina)) : 1;
    if (est.pagina > paginas) est.pagina = paginas;
    const ini = cfg.porPagina ? (est.pagina - 1) * cfg.porPagina : 0;
    const pag = cfg.porPagina ? vista.slice(ini, ini + cfg.porPagina) : vista;

    tbody.innerHTML = pag.length ? pag.map(linhaHtml).join('')
      : `<tr class="tabela-nada"><td colspan="${nCols}">Nada encontrado nesta lista.</td></tr>`;

    // A contagem mostra o que está listado; o total só quando a busca
    // está estreitando, senão o número contradiz a lista abaixo dele.
    elCount.textContent = est.busca
      ? `${vista.length} de ${linhas.length}`
      : `${linhas.length} ${cfg.substantivo}`;

    elPe.hidden = paginas < 2;
    if (paginas > 1) {
      elPe.querySelector('.tabela-pe-info').textContent =
        `${ini + 1}-${Math.min(ini + cfg.porPagina, vista.length)} de ${vista.length}`;
      elPe.querySelector('.ant').disabled = est.pagina <= 1;
      elPe.querySelector('.prox').disabled = est.pagina >= paginas;
    }
    marcarOrdem();
  }

  function linhaHtml(l) {
    const k = String(cfg.chave(l) ?? '');
    const cels = cfg.colunas.map(c => `<td class="${clsCol(c)}">${conteudo(c, l)}</td>`).join('');
    const acoes = cfg.acoes.length ? `<td class="acoes">${botoes(cfg, l)}</td>` : '';
    const clicavel = cfg.aoClicarLinha ? ' tabindex="0"' : '';
    return `<tr data-k="${esc(k)}"${clicavel}>
        <td class="col-exp"><button type="button" class="exp" aria-expanded="false"
          aria-label="Mais informações">${ico('chevron', { tam: 14 })}</button></td>
        ${cels}${acoes}
      </tr>
      <tr class="tabela-detalhe" data-k="${esc(k)}" hidden><td colspan="${nCols}">${detalhe(cfg, l)}</td></tr>`;
  }

  function marcarOrdem() {
    el.querySelectorAll('thead th[data-col]').forEach(th => {
      const on = th.dataset.col === est.ordem.coluna;
      th.classList.toggle('on', on);
      if (on) th.setAttribute('aria-sort', est.ordem.dir === 'desc' ? 'descending' : 'ascending');
      else th.removeAttribute('aria-sort');
      th.classList.toggle('desc', on && est.ordem.dir === 'desc');
    });
  }

  // Acordeão: uma linha aberta por vez. Alterna no DOM em vez de
  // repintar - repintar descartaria o botão recém-clicado e o foco
  // voltaria para o começo da página.
  function alternarDetalhe(k) {
    est.aberta = est.aberta === k ? null : k;
    [...tbody.rows].forEach(tr => {
      const on = tr.dataset.k === est.aberta;
      if (tr.classList.contains('tabela-detalhe')) { tr.hidden = !on; return; }
      tr.classList.toggle('on', on);
      tr.querySelector('.exp')?.setAttribute('aria-expanded', String(on));
    });
  }

  const linhaDe = (k) => vista.find(l => String(cfg.chave(l) ?? '') === k);

  el.addEventListener('click', (e) => {
    const ord = e.target.closest('.ord-btn');
    if (ord) {
      const mesma = est.ordem.coluna === ord.dataset.col;
      est.ordem = { coluna: ord.dataset.col, dir: mesma && est.ordem.dir === 'asc' ? 'desc' : 'asc' };
      est.pagina = 1; est.aberta = null;
      return pintarCorpo();
    }
    const pag = e.target.closest('.tabela-pe button');
    if (pag) {
      est.pagina += pag.classList.contains('prox') ? 1 : -1;
      est.aberta = null;
      return pintarCorpo();
    }
    const tr = e.target.closest('tbody tr');
    if (!tr || tr.classList.contains('tabela-nada')) return;

    const acao = e.target.closest('[data-acao]');
    if (acao) { cfg.acoes[Number(acao.dataset.acao)]?.ao(linhaDe(tr.dataset.k)); return; }
    if (e.target.closest('.exp')) return alternarDetalhe(tr.dataset.k);
    if (tr.classList.contains('tabela-detalhe')) return;

    // Sem aoClicarLinha, tocar a linha expande. Com ele, a linha abre o
    // detalhe e a expansão fica só no botão (spec § D4).
    if (cfg.aoClicarLinha) cfg.aoClicarLinha(linhaDe(tr.dataset.k));
    else alternarDetalhe(tr.dataset.k);
  });

  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tr = e.target.closest?.('tbody tr[tabindex]');
    if (!tr || e.target !== tr) return;
    e.preventDefault();
    cfg.aoClicarLinha?.(linhaDe(tr.dataset.k));
  });

  el.addEventListener('input', (e) => {
    if (!e.target.classList.contains('tabela-busca')) return;
    clearTimeout(deb);
    deb = setTimeout(() => {
      est.busca = norm(e.target.value.trim());
      est.pagina = 1; est.aberta = null;
      pintarCorpo();
    }, 180);
  });

  pintar();

  return {
    // Repinta com dados novos. Só refaz a casca quando a lista cruza a
    // fronteira do vazio - senão a caixa de busca seria recriada e o
    // foco de quem está digitando iria embora.
    atualizar(novas) {
      const eraVazio = !linhas.length;
      linhas = novas || [];
      if (eraVazio !== !linhas.length) pintar();
      else pintarCorpo();
    },
    destruir() { clearTimeout(deb); el.innerHTML = ''; tbody = null; },
  };
}
