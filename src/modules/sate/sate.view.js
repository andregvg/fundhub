// ============================================================
// FundHub - modules/sate/sate.view.js
// Casca do SATE: carrega o que as abas compartilham (perfil, catálogo,
// escolas) e delega cada aba para o seu arquivo em views/.
// A escola solicita o ônibus aqui; quem tem escrita no módulo valida.
// ============================================================
import { getAtividades } from './atividades.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { getLocais } from '../locais/locais.model.js';
import { loading } from '../../shared/ui/feedback.js';
import { ESCRITA } from '../../core/permissoes.js';

import * as abaSolicitacoes from './views/solicitacoes.js';
import * as abaFrota from './views/frota.js';
import * as abaFichas from './views/fichas.js';
import * as abaCatalogo from './views/catalogo.js';
import * as abaLocais from './views/locais.js';

const ABAS = {
  // "Nova solicitação" era uma aba porque não havia modal. Virou botão
  // da própria guia Solicitações em 08/09/2026 (bloco S3).
  solicitacoes: { rotulo: 'Solicitações', view: abaSolicitacoes },
  frota:        { rotulo: 'Frota', view: abaFrota, aprovador: true },
  fichas:       { rotulo: 'Fichas', view: abaFichas, aprovador: true },
  catalogo:     { rotulo: 'Catálogo', view: abaCatalogo },
  locais:       { rotulo: 'Locais', view: abaLocais, aprovador: true },
};

let aba = 'solicitacoes';
let ctx = null;

export async function render(app, { perfil, nivel } = {}) {
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
    // Quem APROVA é quem tem escrita no módulo - não é o mesmo que ser
    // admin do hub, e as regras tratam os dois de forma diferente
    // (spec do modelo de dados, D7).
    aprovador: nivel === ESCRITA,
    box: () => document.getElementById('sate-body'),
    irPara: (nova) => { aba = nova; pintarAbas(); renderAba(); },
    recarregarAtividades: async () => { ctx.atividades = await getAtividades(); },
    recarregarLocais: async () => { ctx.locais = await getLocais(); },
  };

  const barra = document.getElementById('sate-abas');
  barra.innerHTML = Object.entries(ABAS)
    .filter(([, a]) => !a.aprovador || ctx.aprovador)
    .map(([id, a]) => `<button class="tab" role="tab" data-aba="${id}">${a.rotulo}</button>`)
    .join('');
  barra.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (b) ctx.irPara(b.dataset.aba);
  });

  if (ABAS[aba]?.aprovador && !ctx.aprovador) aba = 'solicitacoes';
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
