// ============================================================
// FundHub — modules/escolas/escolas.view.js
// Tela do módulo Escolas: busca, filtros e a lista de cards. A gaveta
// de detalhe e os formulários (criar/editar/excluir) vivem em views/ —
// é lá que a ficha e o CRUD de fato acontecem.
// ============================================================
import { getUnidades } from './escolas.model.js';
import { esc, norm } from '../../shared/dom.js';
import { emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, montarDrawer } from '../../shared/ui/drawer.js';
import { criarFiltroSegmento } from '../../shared/ui/filtro-segmento.js';
import { podeEscrever } from '../../core/permissoes.js';
import { detalhe } from './views/detalhe.js';
import { abrirForm, removerEscola } from './views/formulario.js';

let ALL = [];
let perfil = null;
let seg = null;                 // filtro de segmento (pré-preenchido pelo perfil)
let podeEditar = false;
let filtro = { q: '', oferta: '', transporte: false, eja: false };

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;
  podeEditar = podeEscrever('escolas');

  app.innerHTML = `
    <div class="page-head">
      <h1>Escolas</h1>
      <p>Cadastro das unidades escolares da rede.</p>
    </div>
    <div class="toolbar">
      <label class="search">🔎
        <input id="q" type="search" placeholder="Buscar por nome, apelido, bairro, gestor…" autocomplete="off" />
      </label>
      <span class="count" id="count"></span>
      <button id="nova-escola" class="btn-primary" hidden>+ Nova escola</button>
    </div>
    <div id="seg-filtro" class="toolbar-linha"></div>
    <div class="toolbar-linha">
      <div class="filtros-linha" id="filters">
        <label class="filtro-campo">Oferta
          <select id="f-oferta"><option value="">Todas</option></select>
        </label>
        <label class="switch">
          <input type="checkbox" id="f-transporte" /><span class="switch-trilho" aria-hidden="true"></span>
          🚌 Transporte
        </label>
        <label class="switch">
          <input type="checkbox" id="f-eja" /><span class="switch-trilho" aria-hidden="true"></span>
          🌙 EJA
        </label>
      </div>
    </div>
    <div class="cards" id="cards"></div>
    ${drawerHtml()}`;

  montarDrawer();

  try {
    ALL = await getUnidades();
  } catch (err) {
    document.getElementById('cards').innerHTML = erroBox(err);
    return;
  }

  if (!ALL.length) {
    document.getElementById('cards').innerHTML = emptyState('🗄️', 'Sem dados carregados',
      `O FundHub lê as escolas do Supabase. Confira <code>src/core/config.js</code>
       ou adicione <code>data/unidades.local.json</code> para desenvolvimento local.`);
    document.getElementById('count').textContent = '';
  }

  pintarOfertas();

  // Segmento vem do perfil já marcado; os demais filtros são avulsos.
  seg = criarFiltroSegmento(document.getElementById('seg-filtro'), {
    perfil, onChange: pintar, chaveMemoria: 'fundhub:seg:escolas',
  });

  document.getElementById('q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  document.getElementById('f-oferta').addEventListener('change', e => { filtro.oferta = e.target.value; pintar(); });
  document.getElementById('f-transporte').addEventListener('change', e => { filtro.transporte = e.target.checked; pintar(); });
  document.getElementById('f-eja').addEventListener('change', e => { filtro.eja = e.target.checked; pintar(); });

  if (podeEditar) {
    const nova = document.getElementById('nova-escola');
    nova.hidden = false;
    nova.addEventListener('click', () => abrirForm(null, ctxAtual()));
  }

  pintar();
}

// As ofertas são as que existem na base — nada fixo no código.
function pintarOfertas() {
  const ofertas = [...new Set(ALL.map(u => u.oferta).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt'));
  document.getElementById('f-oferta').innerHTML =
    `<option value="">Todas</option>` +
    ofertas.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
}

function combina(u) {
  if (seg && !seg.combina(u)) return false;
  if (filtro.oferta && u.oferta !== filtro.oferta) return false;
  if (filtro.transporte && !u.tem_transporte) return false;
  if (filtro.eja && !u.tem_eja) return false;
  if (filtro.q) {
    const q = norm(filtro.q);
    const hay = norm([u.nome, u.apelido, u.nome_oficial, u.endereco,
      ...(u.pessoas || []).map(p => p.nome + ' ' + (p.apelido || ''))].join(' '));
    if (!hay.includes(q)) return false;
  }
  return true;
}

function pintar() {
  const lista = ALL.filter(combina).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  document.getElementById('count').textContent = `${lista.length} de ${ALL.length} escolas`;
  const cards = document.getElementById('cards');
  if (ALL.length) {
    cards.innerHTML = lista.map(cardHtml).join('')
      || emptyState('🔎', 'Nenhuma escola encontrada', 'Ajuste a busca ou os filtros.');
  }
  cards.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => {
      const u = porChave(c.dataset.id);
      if (u) detalhe(u, ctxAtual());
    }));
}

function cardHtml(u) {
  const tags = [
    u.tem_transporte ? `<span class="tag bus">🚌 Transporte</span>` : '',
    u.tem_eja ? `<span class="tag eja">🌙 EJA</span>` : '',
    u.oferta ? `<span class="tag">${esc(u.oferta)}</span>` : '',
  ].join('');
  // O card exibe o NOME da escola, em caixa alta — não o apelido. O
  // apelido ("Alcina") é uma abreviação de uso interno; quem procura
  // uma escola numa lista de 144 precisa do nome como ele é oficial.
  return `<article class="card" data-id="${esc(u.id || u.numero)}" tabindex="0">
    <div class="card-top">
      <h3 class="nome-oficial">${esc(u.nome)}</h3>
      ${u.segmento ? `<span class="seg">${esc(u.segmento)}</span>` : ''}
    </div>
    ${u.apelido ? `<div class="apelido">${esc(u.apelido)}</div>` : ''}
    <div class="addr">${esc(u.endereco || '—')}</div>
    <div class="tags">${tags}</div>
  </article>`;
}

function porChave(key) {
  return ALL.find(x => String(x.id) === String(key))
    || ALL.find(x => String(x.numero) === String(key));
}

// Recarrega a lista do banco (o model já invalidou o cache ao salvar
// ou excluir), repinta e devolve o ctx já atualizado — quem chamou
// (ex.: depois de salvar) usa o retorno para reabrir o detalhe sem
// trabalhar com dado velho.
async function recarregar() {
  ALL = await getUnidades();
  pintarOfertas();
  pintar();
  return ctxAtual();
}

// Estado corrente entregue às views/ (detalhe, formulário) —
// reconstruído a cada chamada, é leitura barata.
function ctxAtual() {
  return {
    perfil, podeEditar, recarregar,
    abrirForm: (u) => abrirForm(u, ctxAtual()),
    removerEscola: (u) => removerEscola(u, ctxAtual()),
  };
}
