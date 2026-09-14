// ============================================================
// FundHub - modules/sate/sate.view.js
// As PÁGINAS do SATE, desenhadas dentro da página própria (sate.html).
// Carrega o que elas compartilham (catálogo, escolas, locais) e delega
// cada uma para o seu arquivo em views/.
//
// Até a 0.33 isto era uma barra de abas dentro do FundHub. Desde o S1
// (spec 2026-09-13-sate-app-proprio-design.md) as abas são itens do menu
// lateral do sate.html, e quem roteia é `src/sate.js` - aqui só se
// declara o que existe e se desenha a página pedida.
// ============================================================
import { getAtividades } from './atividades.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { getLocais } from '../locais/locais.model.js';
import { esc } from '../../shared/dom.js';
import { loading } from '../../shared/ui/feedback.js';

import * as paginaSolicitacoes from './views/solicitacoes.js';
import * as paginaFichas from './views/fichas.js';
import * as paginaFrota from './views/frota.js';
import * as paginaCatalogo from './views/catalogo.js';
import * as paginaLocais from './views/locais.js';

// A ordem aqui é a ordem no menu. `aprovador: true` = só quem tem escrita.
export const PAGINAS = Object.freeze({
  solicitacoes: { rotulo: 'Solicitações', ico: 'documento', view: paginaSolicitacoes,
    desc: 'Pedidos de transporte para atividades extraclasse e a validação da Gerência.' },
  fichas: { rotulo: 'Fichas de ônibus', ico: 'imprimir', view: paginaFichas, aprovador: true,
    desc: 'Uma ficha por veículo, para enviar à empresa de transporte.' },
  frota: { rotulo: 'Frota', ico: 'onibus', view: paginaFrota, aprovador: true,
    desc: 'Veículos do dia, quanto já está comprometido e a frota extra pendente de decisão.' },
  catalogo: { rotulo: 'Catálogo', ico: 'projeto', view: paginaCatalogo,
    desc: 'As atividades extraclasse oferecidas pela SME.' },
  locais: { rotulo: 'Locais', ico: 'visita', view: paginaLocais, aprovador: true,
    desc: 'Destinos com endereço e localização, para calcular o tempo de viagem.' },
});

export const PAGINA_INICIAL = 'solicitacoes';

// Desenha a página `id` em `app`. Quem chama já garantiu que a pessoa
// pode vê-la (src/sate.js); `aprovador` decide o que aparece dentro.
// `simulando` ({ id, nome } | null): quem aprova está vendo o SATE como
// uma escola (src/sate.js). A faixa no topo diz isso em toda página - é
// fácil esquecer que se está numa visão emprestada.
export async function render(app, { perfil, aprovador, id, irPara, simulando = null, aoSairSimulacao }) {
  const pagina = PAGINAS[id];
  app.innerHTML = `
    ${simulando ? `<div class="sate-simulacao" role="status">
      <span>Você está vendo o SATE como <b>${esc(simulando.nome)}</b>. Nada é gravado nesta visualização.</span>
      <button type="button" class="mini-btn" id="sim-sair">Voltar à minha visão</button>
    </div>` : ''}
    <div class="page-head">
      <h1>${esc(pagina.rotulo)}</h1>
      <p>${esc(pagina.desc)}</p>
    </div>
    <div id="sate-body">${loading()}</div>`;

  const [atividades, unidades, locais] = await Promise.all([
    getAtividades().catch(() => []),
    getUnidades().catch(() => []),
    getLocais().catch(() => []),
  ]);

  document.getElementById('sim-sair')?.addEventListener('click', () => aoSairSimulacao?.());

  // Contexto entregue a cada página: dados compartilhados + navegação.
  const ctx = {
    perfil, atividades, unidades, locais, simulando,
    // Vendo como escola: a tela se comporta como a da escola, mas quem
    // clicaria tem os poderes de quem aprova no banco. Nada se grava.
    somenteLeitura: !!simulando,
    // Quem APROVA é quem tem escrita no módulo - não é o mesmo que ser
    // admin do hub, e as regras tratam os dois de forma diferente
    // (spec do modelo de dados, D7).
    aprovador,
    box: () => document.getElementById('sate-body'),
    irPara,
    recarregarAtividades: async () => { ctx.atividades = await getAtividades(); },
    recarregarLocais: async () => { ctx.locais = await getLocais(); },
  };
  pagina.view.render(ctx);
}
