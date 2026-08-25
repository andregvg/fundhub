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
import { PAPEIS, LOTACOES, ANO_LETIVO, rotulaPapel, getServidores } from './servidores.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { esc } from '../../shared/dom.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, montarDrawer } from '../../shared/ui/drawer.js';
import { criarFiltroSegmento, indexarUnidades } from '../../shared/ui/filtro-segmento.js';
import { podeEscrever } from '../../core/permissoes.js';
import { pintarLista } from './views/lista.js';
import { detalhe } from './views/detalhe.js';
import { formServidor, removerServidor } from './views/formulario.js';

let perfil = null, lista = [], unidades = [], idxUnidades = {};
let seg = null, podeEditar = false;
let filtro = { q: '', papel: '', lotacao: '', semVinculo: false };

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;
  podeEditar = podeEscrever('servidores');

  app.innerHTML = `
    <div class="page-head">
      <h1>Servidores</h1>
      <p>Cadastro funcional, lotações e vínculos com as escolas — ano letivo ${ANO_LETIVO}.</p>
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
      <div class="filters" id="sv-filtros">
        ${PAPEIS.map(p => `<button class="chip" data-papel="${p}">${esc(rotulaPapel(p))}</button>`).join('')}
        <span class="fseg-sep" aria-hidden="true"></span>
        ${LOTACOES.map(([v, r]) => `<button class="chip" data-lotacao="${v}">${esc(r)}</button>`).join('')}
        <button class="chip" data-flag="sem">⚠️ Sem vínculo</button>
      </div>
    </div>
    <div class="cards" id="sv-cards">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();

  try {
    [lista, unidades] = await Promise.all([getServidores(), getUnidades().catch(() => [])]);
    idxUnidades = indexarUnidades(unidades);
  } catch (err) {
    document.getElementById('sv-cards').innerHTML = erroBox(err);
    return;
  }

  // O segmento de um servidor é o das escolas em que ele atua.
  seg = criarFiltroSegmento(document.getElementById('sv-seg'), {
    perfil, onChange: pintar, chaveMemoria: 'fundhub:seg:servidores',
  });

  document.getElementById('sv-q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
  document.getElementById('sv-filtros').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.papel != null) filtro.papel = filtro.papel === b.dataset.papel ? '' : b.dataset.papel;
    if (b.dataset.lotacao != null) filtro.lotacao = filtro.lotacao === b.dataset.lotacao ? '' : b.dataset.lotacao;
    if (b.dataset.flag === 'sem') filtro.semVinculo = !filtro.semVinculo;
    pintar();
  });

  if (podeEditar) {
    const novo = document.getElementById('sv-novo');
    novo.hidden = false;
    novo.addEventListener('click', () => formServidor(null, ctxAtual()));
  }

  pintar();
}

// Estado corrente entregue às views/ (lista, detalhe, formulário) —
// reconstruído a cada chamada, é leitura barata. unidades só é
// carregado uma vez em render() e não muda.
function ctxAtual() {
  return {
    perfil, lista, unidades, idxUnidades, podeEditar, filtro, seg,
    recarregar,
    abrirDetalhe: (id) => detalhe(id, ctxAtual()),
    abrirFormServidor: (s) => formServidor(s, ctxAtual()),
    removerServidor: (s) => removerServidor(s, ctxAtual()),
  };
}

// Recarrega a lista do banco, repinta e devolve o ctx já atualizado —
// quem chamou (ex.: depois de excluir um vínculo) usa o retorno para
// reabrir o detalhe sem trabalhar com dado velho.
async function recarregar() {
  lista = await getServidores();
  pintar();
  return ctxAtual();
}

function pintar() {
  document.querySelectorAll('#sv-filtros .chip').forEach(b => {
    const on = (b.dataset.papel != null && b.dataset.papel === filtro.papel)
      || (b.dataset.lotacao != null && b.dataset.lotacao === filtro.lotacao)
      || (b.dataset.flag === 'sem' && filtro.semVinculo);
    b.classList.toggle('on', on);
  });

  const box = document.getElementById('sv-cards');
  pintarLista(box, lista, ctxAtual());
}
