// ============================================================
// FundHub - sate/views/frota.js  (página Frota - só quem aprova)
// O CADASTRO da frota: o que existe, o que vale, o que expirou.
// Spec: 2026-09-26-sate-frota-e-disponibilidade-design.md § D2.
//
// Até a 0.36 esta página mostrava o saldo de UM dia, e o cadastro morava
// num painel da engrenagem - ninguém achava a frota cadastrada. O saldo
// foi para a página Disponibilidade (todos veem), e o cadastro veio para
// cá, como tabela: as frotas se comparam entre si (R18).
//
// No topo, a frota extra que perdeu o pedido de origem (spec do ciclo
// de aprovação, D3): é pendência, e aparece até alguém decidir.
// ============================================================
import {
  getFrotas, filtrarFrotas, situacaoDaFrota, SITUACOES, TIPOS, rotulaTipo,
  getFrotasOrfas, manterLote, excluirFrota,
} from '../frota.model.js';
import { STATUS } from '../sate.model.js';
import { abrirFormFrota, abrirRotulos } from './frota-form.js';
import { esc } from '../../../shared/dom.js';
import { hojeISO, fmtData } from '../../../shared/format.js';
import { montarTabela } from '../../../shared/ui/tabela.js';
import { modalHtml, montarModal } from '../../../shared/ui/modal.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { loading, erroBox, reportarErro } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

let lista = [];
let tabela = null;
// Filtro de sessão da página: sobrevive à troca de página, não ao recarregar.
const filtro = { situacao: 'vigente', tipo: '', de: '', ate: '' };
const CHIPS = [['vigente', 'Vigentes'], ['futura', 'Futuras'], ['encerrada', 'Encerradas'], ['todas', 'Todas']];

export function render(ctx) {
  tabela = null;
  ctx.box().innerHTML = `
    <div class="toolbar">
      <button type="button" id="fr-nova" class="btn-primary">${ico('adicionar')} Nova frota</button>
      <button type="button" id="fr-rotulos" class="btn-secundario">Rótulos</button>
    </div>
    <div id="fr-orfas"></div>
    <div class="painel-filtros">
      <div class="filters" id="fr-sit" role="group" aria-label="Situação">
        ${CHIPS.map(([v, r]) => `<button type="button" class="chip ${filtro.situacao === v ? 'on' : ''}" data-sit="${v}">${r}</button>`).join('')}
      </div>
      <label class="filtro-campo">Tipo <select id="fr-tipo">
        <option value="">Todos</option>
        ${TIPOS.map(t => `<option value="${esc(t.id)}" ${filtro.tipo === t.id ? 'selected' : ''}>${esc(t.rotulo)}</option>`).join('')}
      </select></label>
      <label class="filtro-campo">Vigente de <input id="fr-de" type="date" value="${esc(filtro.de)}" /></label>
      <label class="filtro-campo">até <input id="fr-ate" type="date" value="${esc(filtro.ate)}" /></label>
    </div>
    <div id="fr-lista">${loading()}</div>
    ${modalHtml()}`;

  montarModal();
  const recarregar = () => { carregar(); pintarOrfas(); };
  document.getElementById('fr-nova').addEventListener('click', () => abrirFormFrota({ aoSalvar: recarregar }));
  document.getElementById('fr-rotulos').addEventListener('click', () => abrirRotulos({ aoFechar: carregar }));
  document.getElementById('fr-sit').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sit]'); if (!b) return;
    filtro.situacao = b.dataset.sit;
    document.querySelectorAll('#fr-sit .chip').forEach(c => c.classList.toggle('on', c === b));
    pintar();
  });
  document.getElementById('fr-tipo').addEventListener('change', e => { filtro.tipo = e.target.value; pintar(); });
  document.getElementById('fr-de').addEventListener('change', e => { filtro.de = e.target.value; pintar(); });
  document.getElementById('fr-ate').addEventListener('change', e => { filtro.ate = e.target.value; pintar(); });
  document.getElementById('fr-orfas').addEventListener('click', decidirOrfa);

  recarregarLista = carregar;
  carregar();
  pintarOrfas();

  async function carregar() {
    const box = document.getElementById('fr-lista');
    if (!box) return;
    try { lista = await getFrotas({}); }
    catch (err) { box.innerHTML = erroBox(err); tabela = null; return; }
    pintar();
  }

  // Filtrar é em memória: são dezenas de frotas, não milhares (R18).
  function pintar() {
    const box = document.getElementById('fr-lista');
    if (!box) return;
    const linhas = filtrarFrotas(lista, filtro, hojeISO());
    if (tabela) { tabela.atualizar(linhas); return; }
    tabela = montarTabela(box, {
      colunas: COLUNAS,
      linhas,
      chave: f => f.id,
      acoes: [
        { ico: 'editar', rotulo: 'Editar', ao: (f) => abrirFormFrota({ frota: f, aoSalvar: recarregar }) },
        { ico: 'excluir', rotulo: 'Excluir', perigo: true, ao: (f) => excluir(f) },
      ],
      buscarEm: ['rotulo', 'tipo'],
      ordem: { coluna: 'inicio', dir: 'desc' },
      substantivo: 'frotas',
      vazio: {
        ico: 'onibus', titulo: 'Nenhuma frota com esses filtros',
        texto: 'Troque a situação para "Todas" ou clique em "Nova frota".',
      },
    });
  }

  async function excluir(f) {
    if (!(await confirmar('Excluir esta frota?', {
      detalhe: 'Os veículos deixam de contar nos dias que ela cobria.', textoOk: 'Excluir', perigo: true,
    }))) return;
    try { await excluirFrota(f.id); toast({ titulo: 'Frota excluída', tipo: 'sucesso' }); recarregar(); }
    catch (err) { reportarErro(err, { titulo: 'Não foi possível excluir' }); }
  }
}

const COLUNAS = [
  { id: 'rotulo', rotulo: 'Rótulo', valor: f => f.rotulo?.nome || 'sem rótulo' },
  { id: 'tipo', rotulo: 'Tipo', prioridade: 2, valor: f => rotulaTipo(f.tipo) },
  { id: 'qtd', rotulo: 'Veículos', tipo: 'numero', alinhar: 'dir', valor: f => f.quantidade || 0 },
  { id: 'inicio', rotulo: 'Início', tipo: 'data', valor: f => f.inicio || '', celula: f => esc(fmtData(f.inicio)) },
  { id: 'fim', rotulo: 'Fim', prioridade: 2, tipo: 'data', valor: f => f.fim || '',
    celula: f => (f.fim ? esc(fmtData(f.fim)) : '<span class="vazio">em aberto</span>') },
  { id: 'situacao', rotulo: 'Situação', valor: f => SITUACOES[situacaoDaFrota(f, hojeISO())],
    celula: f => { const s = situacaoDaFrota(f, hojeISO());
      return `<span class="tag fr-sit-${s}">${esc(SITUACOES[s])}</span>`; } },
  { id: 'origem', rotulo: 'Origem', prioridade: 3,
    valor: f => (f.solicitacao_id ? 'Extra de pedido' : 'Cadastro') },
];

// ── Frota órfã (spec 2026-09-13-sate-ciclo-de-aprovacao, D3) ──
// Lote extra cujo pedido foi negado, cancelado ou remanejado para outra
// data. Independe dos filtros: é pendência, e aparece até alguém decidir.
async function pintarOrfas() {
  const box = document.getElementById('fr-orfas');
  if (!box) return;
  const orfas = await getFrotasOrfas().catch(() => []);
  if (!orfas.length) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="fr-orfas">
      <div class="lbl">Frota extra sem pedido (${orfas.length})</div>
      <p class="form-hint">Estes veículos extras nasceram de um pedido que foi negado, cancelado ou mudou de data.
        <b>Manter</b> transforma o lote em reforço comum; <b>Remover</b> apaga.</p>
      ${orfas.map(f => {
        const s = f.solicitacao;
        const motivo = !s ? 'pedido apagado'
          : ['negado', 'cancelado'].includes(s.status) ? `pedido ${STATUS[s.status].toLowerCase()}`
          : `pedido remanejado para ${fmtData(s.data)}`;
        return `<div class="fr-lote">
          <b>${esc(f.rotulo?.nome || 'sem rótulo')}</b>
          <span class="tag">${esc(rotulaTipo(f.tipo))}</span>
          <span>${f.quantidade} veículo(s) em ${esc(fmtData(f.inicio))}</span>
          <span class="di-meta">${esc(motivo)}</span>
          <span class="fr-orfa-acoes">
            <button type="button" class="mini-btn" data-manter="${esc(f.id)}">Manter</button>
            <button type="button" class="mini-btn no" data-remover="${esc(f.id)}">Remover</button>
          </span>
        </div>`;
      }).join('')}
    </div>`;
}

// `recarregarLista` é atribuída em render(): a lista de frotas também
// muda quando uma órfã é mantida ou removida.
let recarregarLista = () => {};

async function decidirOrfa(e) {
  const manter = e.target.closest('[data-manter]');
  const remover = e.target.closest('[data-remover]');
  if (!manter && !remover) return;
  if (remover && !(await confirmar('Remover este lote de frota extra?', {
    detalhe: 'Os veículos deixam de contar no saldo daquele dia.', textoOk: 'Remover', perigo: true,
  }))) return;
  try {
    if (manter) await manterLote(manter.dataset.manter);
    else await excluirFrota(remover.dataset.remover);
    toast({ titulo: manter ? 'Lote mantido como reforço' : 'Lote removido', tipo: 'sucesso' });
    await pintarOrfas();
    recarregarLista();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível concluir' });
  }
}
