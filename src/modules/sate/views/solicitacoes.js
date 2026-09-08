// ============================================================
// FundHub - sate/views/solicitacoes.js  (guia Solicitações)
// A lista, agora sobre shared/ui/tabela.js.
// Spec: 2026-09-08-sate-solicitacoes-design.md § D1, D6.
//
// Esta tela não escreve ordenação, busca, paginação nem o refluxo do
// celular: tudo isso é do componente. Ela declara colunas e entrega os
// dados.
//
// Sem coluna de ações, de propósito (§ D1): as decisões dependem do
// status e da permissão, e seriam cinco botões condicionais espremidos
// numa célula. A linha inteira abre o modal de detalhe, e as ações moram
// lá, com espaço para a justificativa que três delas exigem.
// ============================================================
import { listSolicitacoes, STATUS, PERIODOS } from '../sate.model.js';
import { getParticipacoesDe, resumoEscolas } from '../participacoes.model.js';
import { abrirFormulario } from './formulario.js';
import { abrirDetalhe } from './detalhe.js';
import { esc } from '../../../shared/dom.js';
import { fmtData, hojeISO, addDias } from '../../../shared/format.js';
import { montarTabela } from '../../../shared/ui/tabela.js';
import { modalHtml, montarModal } from '../../../shared/ui/modal.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

let ctx = null;
let tabela = null;
// O filtro do BANCO. A busca da tabela é outra coisa: estreita o que já
// está na tela, sem ida ao servidor (spec de listas, D6).
let filtro = { status: '', periodo: '', de: addDias(hojeISO(), -30), ate: addDias(hojeISO(), 120) };

export function render(contexto) {
  ctx = contexto;
  tabela = null;
  // A guia expõe o recarregamento para o modal de detalhe e o de nova
  // solicitação chamarem depois de gravar.
  ctx.recarregar = carregar;

  ctx.box().innerHTML = `
    <div class="toolbar">
      <span class="count">Pedidos de transporte para atividades fora da unidade.</span>
      <button id="sol-nova" class="btn-primary">${ico('adicionar')} Nova solicitação</button>
    </div>
    <div class="painel-filtros">
      <label class="filtro-campo">De <input id="sol-de" type="date" value="${filtro.de}" /></label>
      <label class="filtro-campo">Até <input id="sol-ate" type="date" value="${filtro.ate}" /></label>
      <label class="filtro-campo">Situação <select id="sol-st">
        <option value="">Todas</option>
        ${Object.entries(STATUS).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}
      </select></label>
      <label class="filtro-campo">Período <select id="sol-per">
        <option value="">Todos</option>
        ${Object.entries(PERIODOS).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}
      </select></label>
    </div>
    <div id="sol-lista">${loading()}</div>
    ${modalHtml()}`;

  montarModal();
  document.getElementById('sol-nova').addEventListener('click', () => abrirFormulario(ctx));

  const rec = () => carregar();
  document.getElementById('sol-de').addEventListener('change', e => { filtro.de = e.target.value; rec(); });
  document.getElementById('sol-ate').addEventListener('change', e => { filtro.ate = e.target.value; rec(); });
  document.getElementById('sol-st').addEventListener('change', e => { filtro.status = e.target.value; rec(); });
  document.getElementById('sol-per').addEventListener('change', e => { filtro.periodo = e.target.value; rec(); });

  carregar();
}

async function carregar() {
  const box = document.getElementById('sol-lista');
  if (!box) return;
  // O filtro recarrega do banco e a casca da tabela é descartada junto.
  box.innerHTML = loading();
  tabela = null;

  let lista;
  try {
    lista = await listSolicitacoes({
      status: filtro.status || undefined,
      de: filtro.de || undefined,
      ate: filtro.ate || undefined,
    });
  } catch (err) { box.innerHTML = erroBox(err); return; }

  if (filtro.periodo) lista = lista.filter(s => s.periodo === filtro.periodo);

  // As escolas de cada viagem, numa consulta só. Sem isto a coluna
  // "Escolas" faria uma ida ao banco por linha da tabela.
  const porViagem = await getParticipacoesDe(lista.map(s => s.id)).catch(() => ({}));
  for (const s of lista) s._escolas = resumoEscolas(porViagem[s.id] || []);

  tabela = montarTabela(box, {
    colunas: COLUNAS,
    linhas: lista,
    chave: s => s.id,
    buscarEm: ['escola', 'atividade', 'situacao'],
    ordem: { coluna: 'data', dir: 'desc' },
    substantivo: 'solicitações',
    aoClicarLinha: (s) => abrirDetalhe(s, ctx),
    vazio: {
      ico: 'transporte', titulo: 'Nenhuma solicitação no período',
      texto: 'Ajuste os filtros acima ou clique em “Nova solicitação”.',
    },
  });
}

// `valor` ordena e busca (texto puro); `celula` desenha (spec de listas,
// D2). Sem a separação, ordenar "Situação" ordenaria pelo markup do chip.
const COLUNAS = [
  // "Escolas", no plural: uma viagem pode ter várias, e a coluna mostra
  // a primeira mais a contagem ("Escola Exemplo +2").
  { id: 'escola', rotulo: 'Escolas',
    valor: s => s._escolas || s.unidade?.apelido || s.unidade?.nome || '' },
  { id: 'data', rotulo: 'Data', tipo: 'data',
    valor: s => s.data || '',
    celula: s => esc(fmtData(s.data)) },
  { id: 'situacao', rotulo: 'Situação',
    valor: s => STATUS[s.status] || s.status,
    celula: s => `<span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>` },
  { id: 'periodo', rotulo: 'Período', prioridade: 2,
    valor: s => PERIODOS[s.periodo] || s.periodo || '' },
  { id: 'atividade', rotulo: 'Atividade', prioridade: 2,
    valor: s => s.atividade?.nome || s.atividade_livre || '' },
  { id: 'alunos', rotulo: 'Estudantes', prioridade: 3, tipo: 'numero', alinhar: 'dir',
    valor: s => s.qtd_alunos || 0 },
  { id: 'onibus', rotulo: 'Ônibus', prioridade: 3, tipo: 'numero', alinhar: 'dir',
    valor: s => s.qtd_onibus || 0,
    celula: s => `${s.qtd_onibus || 0}${s.qtd_vans ? ` <span class="tag bus">+${s.qtd_vans} van</span>` : ''}` },
];
