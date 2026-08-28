// ============================================================
// FundHub - modules/afastamentos/afastamentos.view.js
// Afastamentos de gestores/coordenadores/supervisores. Leitura para
// autorizados; CRUD para admin. Duas visões: Lista e Calendário (grade
// mensal com chips por dia, como o Apps Script afastamentos-gestores).
//
// Casca: carrega o que as duas visões compartilham (perfil, servidores,
// unidades, filtros) e delega a pintura para views/. O formulário e a
// sincronização também vivem em views/ - a casca só os aciona.
// ============================================================
import { TIPOS_AFASTAMENTO, getAfastamentos } from './afastamentos.model.js';
import { getServidores } from '../servidores/servidores.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { getCalendarioMes } from '../calendario/calendario.model.js';
import { esc, norm } from '../../shared/dom.js';
import { MESES, hojeISO } from '../../shared/format.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, montarDrawer } from '../../shared/ui/drawer.js';
import { criarFiltroSegmento, indexarUnidades } from '../../shared/ui/filtro-segmento.js';
import { ico } from '../../shared/ui/icones.js';
import { pintarLista } from './views/lista.js';
import { pintarCalendario } from './views/calendario.js';
import { abrirForm } from './views/formulario.js';
import { abrirSync } from './views/sincronizacao.js';

let perfil = null, servidores = [], unidades = [], lista = [];
let seg = null, idxUnidades = {};
let diasCal = {};                                // dia_calendario do mês visível
let modo = 'lista';                              // 'lista' | 'calendario'
// visao: vigentes | todos | importados | cancelados
let filtro = { visao: 'vigentes', tipo: '', q: '' };
const agora = new Date();
let ano = agora.getFullYear(), mes = agora.getMonth() + 1;   // mes 1-12

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;

  app.innerHTML = `
    <div class="page-head">
      <h1>Afastamentos</h1>
      <p>Férias, licenças e afastamentos da equipe gestora e de acompanhamento.</p>
    </div>
    <div class="toolbar">
      <div class="tabbar" id="af-modo" role="tablist">
        <button class="tab" data-modo="lista" role="tab">Lista</button>
        <button class="tab" data-modo="calendario" role="tab">Calendário</button>
      </div>
      <label class="search">${ico('buscar')}
        <input id="af-q" type="search" placeholder="Buscar por servidor ou escola…" autocomplete="off" value="${esc(filtro.q)}" />
      </label>
      <span class="count" id="af-count"></span>
      <button id="af-sync" class="mini-btn" hidden>${ico('atualizar')} Sincronizar planilha</button>
      <button id="af-novo" class="btn-primary" hidden>+ Novo afastamento</button>
    </div>
    <div id="af-seg" class="toolbar-linha"></div>
    <div class="filters" id="af-filtros"></div>
    <div id="af-body">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();

  [servidores, unidades] = await Promise.all([
    getServidores().catch(() => []),
    getUnidades().catch(() => []),
  ]);

  idxUnidades = indexarUnidades(unidades);
  seg = criarFiltroSegmento(document.getElementById('af-seg'), {
    perfil, onChange: pintar, chaveMemoria: 'fundhub:seg:afastamentos',
  });

  document.getElementById('af-modo').addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    modo = b.dataset.modo; carregar();
  });
  document.getElementById('af-q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  // Um único listener delegado nos filtros (o innerHTML muda a cada carregar).
  document.getElementById('af-filtros').addEventListener('click', onFiltroClick);

  if (perfil?.isAdmin) {
    const nv = document.getElementById('af-novo');
    nv.hidden = false;
    nv.addEventListener('click', () => abrirForm(null, ctxAtual()));
    const sy = document.getElementById('af-sync');
    sy.hidden = false;
    sy.addEventListener('click', () => abrirSync(ctxAtual()));
  }

  carregar();
}

// Estado corrente entregue às views/ (lista, calendário, formulário,
// sincronização) - reconstruído a cada chamada, é uma leitura barata.
// servidores/unidades só são carregados uma vez em render() e não mudam.
function ctxAtual() {
  return {
    perfil, servidores, unidades, lista, idxUnidades, diasCal, ano, mes,
    carregar,
    abrirForm: (a) => abrirForm(a, ctxAtual()),
  };
}

// Monta a barra de filtros conforme a visão atual (lista vs calendário).
// Só desenha o HTML - o clique é tratado por onFiltroClick (delegado uma vez).
function montarFiltros() {
  const box = document.getElementById('af-filtros');
  if (modo === 'calendario') {
    box.innerHTML = `
      <div class="cal-nav">
        <button class="mini-btn" data-nav="prev" aria-label="Mês anterior">←</button>
        <div class="cal-titulo" id="af-titulo">${MESES[mes - 1]} de ${ano}</div>
        <button class="mini-btn" data-nav="next" aria-label="Próximo mês">→</button>
      </div>
      <div class="cal-legenda">
        <span><i class="lg lg-nletivo"></i> não letivo</span>
        <span>${ico('erro', { tam: 14 })} não conceder afastamentos</span>
        <span><i class="lg lg-pend"></i> aguardando confirmação</span>
        <small>o texto do dia é o evento do calendário escolar</small>
      </div>
      ${chipsTipo()}`;
  } else {
    box.innerHTML = `
      <button class="chip" data-visao="vigentes">Vigentes</button>
      <button class="chip" data-visao="todos">Todos</button>
      <button class="chip" data-visao="importados">Importados</button>
      <button class="chip" data-visao="cancelados">Cancelados</button>
      <span class="filtro-sep"></span>
      ${chipsTipo()}`;
  }
  box.querySelectorAll('.chip').forEach(b => {
    const on = (b.dataset.visao && b.dataset.visao === filtro.visao)
      || (b.dataset.tipo != null && b.dataset.tipo === filtro.tipo);
    b.classList.toggle('on', on);
  });
}

function onFiltroClick(e) {
  const nav = e.target.closest('[data-nav]');
  if (nav) { moverMes(nav.dataset.nav === 'prev' ? -1 : 1); return; }
  const b = e.target.closest('.chip'); if (!b) return;
  if (b.dataset.visao) { filtro.visao = b.dataset.visao; carregar(); return; }
  if (b.dataset.tipo != null) {
    filtro.tipo = filtro.tipo === b.dataset.tipo ? '' : b.dataset.tipo;
    montarFiltros(); pintar();
  }
}

const chipsTipo = () => TIPOS_AFASTAMENTO
  .map(t => `<button class="chip" data-tipo="${esc(t)}">${esc(t)}</button>`).join('');

async function moverMes(delta) {
  mes += delta;
  if (mes < 1) { mes = 12; ano--; } else if (mes > 12) { mes = 1; ano++; }
  const t = document.getElementById('af-titulo');
  if (t) t.textContent = `${MESES[mes - 1]} de ${ano}`;
  await carregarMesCalendario();
  pintar();
}

// Dias do calendário escolar do mês visível - é o que faz a grade de
// afastamentos mostrar o evento previsto (como no Apps Script, que junta
// a aba `dados` ao mês). Degrada em silêncio: sem calendário, só some o
// contexto, os chips continuam.
async function carregarMesCalendario() {
  diasCal = {};
  try {
    (await getCalendarioMes(ano, mes)).forEach(d => { diasCal[d.data] = d; });
  } catch (_) { /* segue sem o contexto do calendário */ }
}

// Modo Lista respeita a visão (vigentes/todos/cancelados); o Calendário
// sempre mostra os afastamentos ATIVOS que tocam o mês visível.
async function carregar() {
  document.querySelectorAll('#af-modo .tab').forEach(b =>
    b.classList.toggle('on', b.dataset.modo === modo));
  montarFiltros();

  const box = document.getElementById('af-body');
  box.innerHTML = loading();
  try {
    const opts = modo === 'calendario' ? {}
      : filtro.visao === 'vigentes' ? { vigentesEm: hojeISO() }
      : filtro.visao === 'cancelados' ? { status: 'cancelado' }
      : filtro.visao === 'importados' ? { status: 'importado' }
      : {};
    lista = await getAfastamentos(opts);
    if (modo === 'calendario') await carregarMesCalendario();
  } catch (err) { box.innerHTML = erroBox(err); return; }
  pintar();
}

function combinaBusca(a) {
  if (filtro.tipo && a.tipo !== filtro.tipo) return false;
  // Recorte por segmento, pela escola do afastamento. Quem não tem
  // escola (servidor da sede) permanece visível - é justamente a
  // equipe da SME, que não deve sumir por causa de um filtro de rede.
  if (seg && seg.selecionados().length && a.unidade_id
      && !seg.combina(idxUnidades[a.unidade_id])) return false;
  if (!filtro.q) return true;
  return norm([a.servidor?.nome, a.servidor?.apelido, a.unidade?.nome, a.unidade?.apelido, a.processo]
    .join(' ')).includes(norm(filtro.q));
}

function pintar() {
  const filtrada = lista.filter(combinaBusca);
  const cnt = document.getElementById('af-count');
  const box = document.getElementById('af-body');
  if (modo === 'calendario') {
    cnt.textContent = `${filtrada.length} ativo(s)`;
    pintarCalendario(box, filtrada, ctxAtual());
  } else {
    cnt.textContent = `${filtrada.length} afastamento(s)`;
    pintarLista(box, filtrada, ctxAtual());
  }
}
