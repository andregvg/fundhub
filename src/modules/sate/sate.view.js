// ============================================================
// FundHub — modules/sate/sate.view.js
// Casca do SATE: carrega o que as quatro abas compartilham (perfil,
// catálogo, escolas) e delega cada aba para o seu arquivo em views/.
// A escola solicita o ônibus aqui; a SME (admin) valida.
// ============================================================
import { getAtividades } from './atividades.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { getLocais } from '../locais/locais.model.js';
import { loading } from '../../shared/ui/feedback.js';

import * as abaSolicitacoes from './views/solicitacoes.js';
import * as abaNova from './views/nova.js';
import * as abaFrota from './views/frota.js';
import * as abaCatalogo from './views/catalogo.js';
import * as abaLocais from './views/locais.js';

const ABAS = {
  solicitacoes: { rotulo: 'Solicitações', view: abaSolicitacoes },
  nova:         { rotulo: 'Nova solicitação', view: abaNova },
  frota:        { rotulo: 'Frota', view: abaFrota, admin: true },
  catalogo:     { rotulo: 'Catálogo', view: abaCatalogo },
  locais:       { rotulo: 'Locais', view: abaLocais, admin: true },
};

let aba = 'solicitacoes';
let ctx = null;

export async function render(app, { perfil } = {}) {
  app.innerHTML = `
    <div class="page-head">
      <h1>SATE · Transporte extraclasse</h1>
      <p>Solicite o transporte para atividades extraclasse e acompanhe a validação da SME.</p>
    </div>
    <div class="tabbar" id="sate-abas" role="tablist"></div>
    <div id="sate-body">${loading()}</div>`;

  const [atividades, unidades, locais] = await Promise.all([
    getAtividades().catch(() => []),
    getUnidades().catch(() => []),
    getLocais().catch(() => []),
  ]);

  // Contexto entregue a cada aba: dados compartilhados + navegação entre abas.
  ctx = {
    perfil, atividades, unidades, locais,
    box: () => document.getElementById('sate-body'),
    irPara: (nova) => { aba = nova; pintarAbas(); renderAba(); },
    recarregarAtividades: async () => { ctx.atividades = await getAtividades(); },
    recarregarLocais: async () => { ctx.locais = await getLocais(); },
  };

  const barra = document.getElementById('sate-abas');
  barra.innerHTML = Object.entries(ABAS)
    .filter(([, a]) => !a.admin || perfil?.isAdmin)
    .map(([id, a]) => `<button class="tab" role="tab" data-aba="${id}">${a.rotulo}</button>`)
    .join('');
  barra.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (b) ctx.irPara(b.dataset.aba);
  });

  if (ABAS[aba]?.admin && !perfil?.isAdmin) aba = 'solicitacoes';
  pintarAbas();
  renderAba();
}

function pintarAbas() {
  document.querySelectorAll('#sate-abas .tab').forEach(b => {
    const on = b.dataset.aba === aba;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
}

function renderAba() {
  ABAS[aba].view.render(ctx);
}
