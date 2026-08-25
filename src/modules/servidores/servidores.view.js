// ============================================================
// FundHub — modules/servidores/servidores.view.js
// Servidores: cadastro das pessoas e dos seus vínculos com as
// escolas. Cobre também quem é lotado na SEDE (equipe de
// acompanhamento, agentes administrativos), que não tem vínculo com
// unidade mas tem afastamento a controlar.
//
// Casca: busca, filtros e a lista de cards. A gaveta de detalhe (com
// os vínculos) e os formulários vivem em views/ — é lá que a escola de
// fato entra na história da pessoa.
// ============================================================
import { getServidores } from './servidores.model.js';
import { getUnidades, getLocais } from '../escolas/escolas.model.js';
import { getCargos } from './vinculos.model.js';
import { esc } from '../../shared/dom.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, montarDrawer } from '../../shared/ui/drawer.js';
import { criarFiltroSegmento, indexarUnidades } from '../../shared/ui/filtro-segmento.js';
import { podeEscrever } from '../../core/permissoes.js';
import { pintarLista } from './views/lista.js';
import { detalhe } from './views/detalhe.js';
import { formServidor, removerServidor } from './views/formulario.js';

let perfil = null, lista = [], unidades = [], idxUnidades = {};
let cargos = [], locais = [], filtroUnidade = '';
let seg = null, podeEditar = false;
let filtro = { q: '', cargo: '', local: '', semVinculo: false };

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;
  podeEditar = podeEscrever('servidores');
  filtroUnidade = ctx.params?.get('unidade') || '';

  app.innerHTML = `
    <div class="page-head">
      <h1>Servidores</h1>
      <p>Cadastro funcional, lotações e vínculos com as escolas.</p>
    </div>
    <div class="toolbar">
      <label class="search">🔎
        <input id="sv-q" type="search" placeholder="Buscar por nome, apelido, e-mail, cargo ou escola…" autocomplete="off" />
      </label>
      <span class="count" id="sv-count"></span>
      <button id="sv-novo" class="btn-primary" hidden>+ Novo servidor</button>
    </div>
    <div id="sv-seg" class="toolbar-linha"></div>
    <div class="toolbar-linha">
      <div class="filtros-linha" id="sv-filtros">
        <label class="filtro-campo">Cargo / função
          <select id="f-cargo"><option value="">Todos</option></select>
        </label>
        <label class="filtro-campo">Lotação
          <select id="f-local"><option value="">Todas</option></select>
        </label>
        <label class="switch">
          <input type="checkbox" id="f-sem" /><span class="switch-trilho" aria-hidden="true"></span>
          Sem vínculo
        </label>
        <span id="sv-chip-uni"></span>
      </div>
    </div>
    <div class="cards" id="sv-cards">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();

  try {
    [lista, unidades, locais, cargos] = await Promise.all([
      getServidores(),
      getUnidades().catch(() => []),
      getLocais().catch(() => []),
      getCargos().catch(() => []),
    ]);
    idxUnidades = indexarUnidades(unidades);
  } catch (err) {
    document.getElementById('sv-cards').innerHTML = erroBox(err);
    return;
  }

  pintarOpcoes();
  pintarChipUnidade();

  // O segmento de um servidor é o das escolas em que ele atua.
  seg = criarFiltroSegmento(document.getElementById('sv-seg'), {
    perfil, onChange: pintar, chaveMemoria: 'fundhub:seg:servidores',
  });

  document.getElementById('sv-q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  document.getElementById('f-cargo').addEventListener('change', e => { filtro.cargo = e.target.value; pintar(); });
  document.getElementById('f-local').addEventListener('change', e => { filtro.local = e.target.value; pintar(); });
  document.getElementById('f-sem').addEventListener('change', e => { filtro.semVinculo = e.target.checked; pintar(); });

  if (podeEditar) {
    const novo = document.getElementById('sv-novo');
    novo.hidden = false;
    novo.addEventListener('click', () => formServidor(null, ctxAtual()));
  }

  pintar();
}

function pintarOpcoes() {
  const selCargo = document.getElementById('f-cargo');
  selCargo.innerHTML = `<option value="">Todos</option>` +
    cargos.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  selCargo.value = filtro.cargo;
  const selLocal = document.getElementById('f-local');
  selLocal.innerHTML = `<option value="">Todas</option>` +
    locais.map(l => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join('');
  selLocal.value = filtro.local;
}

// Veio de "Gerir servidores e vínculos" na ficha de uma escola: a
// lista abre já restrita à equipe dela, e o chip deixa desfazer.
function pintarChipUnidade() {
  const box = document.getElementById('sv-chip-uni');
  if (!filtroUnidade) { box.innerHTML = ''; return; }
  const nome = locais.find(l => l.id === filtroUnidade)?.nome;
  const rotulo = nome ? `Equipe de ${esc(nome)}` : 'Equipe desta unidade';
  box.innerHTML = `<span class="chip-filtro">${rotulo}
    <button type="button" id="sv-limpa-uni" aria-label="Remover o filtro de unidade">×</button></span>`;
  document.getElementById('sv-limpa-uni').addEventListener('click', () => {
    filtroUnidade = ''; pintarChipUnidade(); pintar();
  });
}

// Estado corrente entregue às views/ (lista, detalhe, formulário) —
// reconstruído a cada chamada, é leitura barata. unidades só é
// carregado uma vez em render() e não muda.
function ctxAtual() {
  return {
    perfil, lista, unidades, idxUnidades, podeEditar, filtro, seg,
    cargos, locais, filtroUnidade,
    recarregar,
    abrirDetalhe: (id) => detalhe(id, ctxAtual()),
    abrirFormServidor: (s) => formServidor(s, ctxAtual()),
    removerServidor: (s) => removerServidor(s, ctxAtual()),
  };
}

// Recarrega a lista e o catálogo de cargos do banco, repinta e
// devolve o ctx já atualizado — quem chamou (ex.: depois de salvar um
// vínculo) usa o retorno para reabrir o detalhe sem trabalhar com dado
// velho.
async function recarregar() {
  [lista, cargos] = await Promise.all([getServidores(), getCargos().catch(() => [])]);
  pintarOpcoes();
  pintar();
  return ctxAtual();
}

function pintar() {
  const box = document.getElementById('sv-cards');
  pintarLista(box, lista, ctxAtual());
}
