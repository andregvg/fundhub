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
import * as paginaDisponibilidade from './views/disponibilidade.js';
import * as paginaFichas from './views/fichas.js';
import * as paginaFrota from './views/frota.js';
import * as paginaCatalogo from './views/catalogo.js';
import * as paginaLocais from './views/locais.js';

// A ordem aqui é a ordem no menu. `aprovador: true` = só quem tem escrita.
// `desc` é opcional: sem ela, a página não tem frase de apoio.
export const PAGINAS = Object.freeze({
  solicitacoes: { rotulo: 'Solicitações', ico: 'documento', view: paginaSolicitacoes },
  disponibilidade: { rotulo: 'Disponibilidade', ico: 'calendario', view: paginaDisponibilidade,
    desc: 'Quantos ônibus estão livres em cada dia e período, para planejar o pedido.' },
  fichas: { rotulo: 'Fichas de ônibus', ico: 'imprimir', view: paginaFichas, aprovador: true,
    desc: 'Uma ficha por veículo, para enviar à empresa de transporte.' },
  frota: { rotulo: 'Frota', ico: 'onibus', view: paginaFrota, aprovador: true,
    desc: 'As frotas cadastradas: quantos veículos, de quando a quando, e de onde vêm.' },
  catalogo: { rotulo: 'Catálogo', ico: 'projeto', view: paginaCatalogo,
    desc: 'As atividades extraclasse oferecidas pela SME.' },
  locais: { rotulo: 'Locais', ico: 'visita', view: paginaLocais, aprovador: true,
    desc: 'Destinos com endereço e localização, para calcular o tempo de viagem.' },
});

export const PAGINA_INICIAL = 'solicitacoes';

// A faixa de "Ver como escola" (src/sate.js): HTML vazio sem simulação. Vale
// para TODA página durante ela - é fácil esquecer que se está numa visão
// emprestada, e o botão é a única saída (o item do menu some enquanto dura).
// Quem a desenha liga o botão `#sim-sair`. `dica` é uma linha a mais, abaixo.
export const faixaSimulacaoHtml = (simulando, { dica = '' } = {}) => simulando ? `
    <div class="sate-simulacao" role="status">
      <span>Você está vendo o SATE como <b>${esc(simulando.nome)}</b>. Nada da escola é gravado nesta visualização.</span>
      <button type="button" class="mini-btn" id="sim-sair">Voltar à minha visão</button>
      ${dica ? `<span class="form-hint">${esc(dica)}</span>` : ''}
    </div>` : '';

// Desenha a página `id` em `app`. Quem chama já garantiu que a pessoa
// pode vê-la (src/sate.js); `aprovador` decide o que aparece dentro.
// `simulando` ({ id, nome } | null): quem aprova está vendo o SATE como
// uma escola (src/sate.js); ver faixaSimulacaoHtml.
export async function render(app, { perfil, aprovador, id, irPara, simulando = null, aoSairSimulacao, somenteLeitura = false }) {
  const pagina = PAGINAS[id];
  app.innerHTML = `
    ${faixaSimulacaoHtml(simulando)}
    <div class="page-head">
      <h1>${esc(pagina.rotulo)}</h1>
      ${pagina.desc ? `<p>${esc(pagina.desc)}</p>` : ''}
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
    // Nível `leitura` (Equipe da SME): vê a rede inteira, mas o banco
    // recusaria qualquer escrita - os dois casos escondem os mesmos botões.
    somenteLeitura: !!simulando || !!somenteLeitura,
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
