// ============================================================
// FundHub — modules/horarios/horarios.view.js
// Casca do módulo Horários: duas abas sobre o mesmo domínio — a
// cobertura de UMA escola (por-escola) e a semana de UMA pessoa, em
// todos os locais onde ela atua (por-servidor). Compartilham perfil,
// permissão e a lista de locais (escolas + sede).
//
// A checagem de escrita é por módulo (podeEscrever), não mais por
// perfil.isAdmin — resquício do modelo binário anterior à migration
// 021. Quem tem nível 'proprios' continua barrado pelo RLS na hora
// de gravar; a tela nunca foi a barreira.
// ============================================================
import { COBERTURA_INICIO, COBERTURA_FIM, duracao } from './horarios.model.js';
import { getLocais } from '../escolas/escolas.model.js';
import { podeEscrever } from '../../core/permissoes.js';
import { erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, montarDrawer } from '../../shared/ui/drawer.js';
import { renderPorEscola } from './views/por-escola.js';
import { renderPorServidor } from './views/por-servidor.js';
import { ico } from '../../shared/ui/icones.js';

let ctx = null;
let aba = 'escola';

export async function render(app, { perfil, params } = {}) {
  const podeEditar = podeEscrever('horarios');
  const unidadeId = params?.get('unidade') || '';
  const servidorId = params?.get('servidor') || '';
  aba = servidorId ? 'servidor' : 'escola';

  app.innerHTML = `
    <div class="page-head">
      <h1>Horários de Trabalho</h1>
      <p>Jornada semanal da equipe gestora, validada por regra:
         até ${duracao(8 * 60)} por dia, no máximo ${duracao(6 * 60)} contínuas,
         e a escola coberta das ${COBERTURA_INICIO} às ${COBERTURA_FIM}.</p>
    </div>
    <div class="tabbar" id="h-abas" role="tablist">
      <button class="tab ${aba === 'escola' ? 'on' : ''}" role="tab"
              aria-selected="${aba === 'escola'}" data-aba="escola">${ico('escola')} Por escola</button>
      <button class="tab ${aba === 'servidor' ? 'on' : ''}" role="tab"
              aria-selected="${aba === 'servidor'}" data-aba="servidor">${ico('servidor')} Por servidor</button>
    </div>
    <div id="h-tab-body"></div>
    ${drawerHtml()}`;

  montarDrawer();

  let locais = [];
  try { locais = await getLocais(); }
  catch (err) { document.getElementById('h-tab-body').innerHTML = erroBox(err); return; }

  ctx = { perfil, podeEditar, locais, unidadeId, servidorId };

  document.getElementById('h-abas').addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b) return;
    aba = b.dataset.aba;
    pintarAbas();
    renderAba();
  });

  pintarAbas();
  renderAba();
}

function pintarAbas() {
  document.querySelectorAll('#h-abas .tab').forEach(b => {
    const on = b.dataset.aba === aba;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
}

function renderAba() {
  const box = document.getElementById('h-tab-body');
  if (aba === 'escola') renderPorEscola(box, ctx);
  else renderPorServidor(box, ctx);
}
