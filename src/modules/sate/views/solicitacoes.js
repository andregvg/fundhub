// ============================================================
// FundHub - sate/views/solicitacoes.js  (guia Solicitações)
// A lista, agora sobre shared/ui/tabela.js.
// Spec: 2026-09-08-sate-solicitacoes-design.md § D1, D6.
//
// Esta tela não escreve ordenação, busca, paginação nem o refluxo do
// celular: tudo isso é do componente. Ela declara colunas e entrega os
// dados.
//
// Quem aprova ganha, na própria linha, os atalhos que cabem naquela
// situação (aprovar, editar, negar, excluir). A linha abre o detalhe, onde
// moram as demais decisões.
// ============================================================
import { listSolicitacoes, STATUS, PERIODOS, localAConferir, acoesDoPedido, excluirSolicitacao } from '../sate.model.js';
import { tituloDoPedido } from '../regras.model.js';
import { idsComNovidade, aoMudarAvisos, subscribeSolicitacoes } from '../avisos.model.js';
import { filtroDiasAte, filtroSituacaoPadrao, filtroPeriodoPadrao } from '../sate.config.js';
import { periodoBadge } from './periodo.js';
import { getParticipacoesDe, resumoEscolas, envolveUnidade } from '../participacoes.model.js';
import { existeFrota } from '../frota.model.js';
import { abrirFormulario } from './formulario.js';
import { abrirDetalhe } from './detalhe.js';
import { abrirEditar } from './editar.js';
import { decidirDaLista } from './decisoes.js';
import { esc } from '../../../shared/dom.js';
import { fmtData, fmtDataHora, hojeISO, addDias } from '../../../shared/format.js';
import { montarTabela } from '../../../shared/ui/tabela.js';
import { modalHtml, montarModal } from '../../../shared/ui/modal.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { loading, erroBox, reportarErro } from '../../../shared/ui/feedback.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';

let ctx = null;
let tabela = null;
// A assinatura dos avisos desta página: a rota redesenha a tela a cada
// visita, então a anterior sai antes de a nova entrar (sem acumular).
let soltarAvisos = null;
// O filtro do BANCO. A busca da tabela é outra coisa: estreita o que já
// está na tela, sem ida ao servidor (spec de listas, D6).
// Nasce na primeira visita (as preferências já foram lidas) e dura a sessão.
let filtro = null;
let soltarRealtime = null;
let recarga = null;

export function render(contexto) {
  ctx = contexto;
  tabela = null;
  soltarAvisos?.();
  soltarRealtime?.();
  filtro ||= { status: filtroSituacaoPadrao(), periodo: filtroPeriodoPadrao(), de: hojeISO(), ate: addDias(hojeISO(), filtroDiasAte()) };
  // A guia expõe o recarregamento para o modal de detalhe e o de nova
  // solicitação chamarem depois de gravar.
  ctx.recarregar = carregar;

  // Leitura de verdade (Equipe da SME) não tem escola nenhuma para pedir
  // transporte, e o banco recusaria a gravação: o botão nem aparece. "Ver
  // como escola" é simulação - continua mostrando o formulário, só que com
  // o envio desativado (formulario.js cuida disso via ctx.somenteLeitura).
  const mostraNova = !ctx.somenteLeitura || ctx.simulando;
  ctx.box().innerHTML = `
    <div class="toolbar">
      ${mostraNova ? `<button id="sol-nova" class="btn-primary">${ico('adicionar')} Nova solicitação</button>` : ''}
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
  document.getElementById('sol-nova')?.addEventListener('click', async () => {
    // Antes da primeira viagem, a primeira frota (spec 2026-09-26, D4).
    // Só para quem aprova: a escola vê o formulário e ele diz que não há
    // ônibus - "cadastre a frota" não é algo que ela possa fazer.
    if (ctx.aprovador && !ctx.somenteLeitura && !(await existeFrota().catch(() => true))) {
      const ir = await confirmar('Antes da primeira viagem, cadastre a frota', {
        detalhe: 'O SATE ainda não tem nenhum veículo cadastrado. As viagens usam a frota para saber quantos ônibus há em cada dia.',
        textoOk: 'Cadastrar frota',
      });
      if (ir) ctx.irPara('frota');
      return;
    }
    abrirFormulario(ctx);
  });

  const rec = () => carregar();
  document.getElementById('sol-st').value = filtro.status;
  document.getElementById('sol-per').value = filtro.periodo;
  // Escolher a data inicial leva a final junto (N dias à frente); a final
  // ainda pode ser ajustada à mão depois.
  document.getElementById('sol-de').addEventListener('change', e => {
    filtro.de = e.target.value;
    if (filtro.de) { filtro.ate = addDias(filtro.de, filtroDiasAte()); document.getElementById('sol-ate').value = filtro.ate; }
    rec();
  });
  document.getElementById('sol-ate').addEventListener('change', e => { filtro.ate = e.target.value; rec(); });
  document.getElementById('sol-st').addEventListener('change', e => { filtro.status = e.target.value; rec(); });
  document.getElementById('sol-per').addEventListener('change', e => { filtro.periodo = e.target.value; rec(); });

  // A lista e a carga dos avisos são independentes e nenhuma espera a outra:
  // quando os avisos mudam, o ponto das linhas já desenhadas acompanha.
  soltarAvisos = aoMudarAvisos(repintarNovidades);
  // O que a Gerência faz na solicitação aparece sozinho para a escola: a
  // lista se refaz a cada mudança (o aviso da exclusão é do sino).
  soltarRealtime = subscribeSolicitacoes(() => {
    if (!document.getElementById('sol-lista')) return;
    clearTimeout(recarga);
    recarga = setTimeout(carregar, 300);
  });
  carregar();
}

// O ponto de novidade de uma linha: o mesmo markup na célula e na repintura.
const pontoHtml = (id) => `<span class="sol-novidade" data-novidade="${esc(id)}" role="img" aria-label="Há novidade nesta solicitação" title="Há novidade nesta solicitação"></span>`;

// Acende ou apaga o ponto das linhas que já estão na tela. Acha cada uma
// pelo gancho da própria célula, sem depender do interior da tabela.
function repintarNovidades() {
  const box = document.getElementById('sol-lista');
  if (!box) return;
  const ids = idsComNovidade();
  for (const alvo of box.querySelectorAll('[data-escolas-de]')) {
    const tem = alvo.querySelector('.sol-novidade');
    const quer = ids.has(alvo.dataset.escolasDe);
    if (quer && !tem) alvo.insertAdjacentHTML('afterbegin', pontoHtml(alvo.dataset.escolasDe));
    else if (!quer && tem) tem.remove();
  }
}

async function carregar() {
  const box = document.getElementById('sol-lista');
  if (!box) return;
  // O filtro recarrega do banco e a casca da tabela é descartada junto. Um
  // recarregamento por mudança de outra pessoa não pisca a tela.
  if (!tabela) box.innerHTML = loading();

  let lista;
  try {
    lista = await listSolicitacoes({
      status: filtro.status || undefined,
      de: filtro.de || undefined,
      ate: filtro.ate || undefined,
    });
  } catch (err) { box.innerHTML = erroBox(err); return; }

  if (filtro.periodo) lista = lista.filter(s => s.periodo === filtro.periodo);
  if (!document.getElementById('sol-lista')) return;   // saiu da página durante a consulta
  tabela = null;

  // As escolas de cada viagem, numa consulta só. Sem isto a coluna
  // "Escolas" faria uma ida ao banco por linha da tabela.
  const porViagem = await getParticipacoesDe(lista.map(s => s.id)).catch(() => ({}));
  // Vendo como uma escola: o banco devolveu a rede inteira (quem olha
  // aprova), e a lista mostra só o que a escola veria.
  if (ctx.simulando) lista = lista.filter(s => envolveUnidade(s, porViagem[s.id], ctx.simulando.id));
  for (const s of lista) {
    s._escolas = resumoEscolas(porViagem[s.id] || []);
    s._escolasCurto = resumoEscolas(porViagem[s.id] || [], { curto: true });
    s._partes = porViagem[s.id] || [];
  }

  tabela = montarTabela(box, {
    colunas: COLUNAS,
    acoes: ctx.aprovador && !ctx.somenteLeitura ? ACOES : [],
    linhas: lista,
    chave: s => s.id,
    buscarEm: ['escola', 'local', 'situacao'],
    ordem: { coluna: 'data', dir: 'desc' },
    substantivo: 'solicitações',
    aoClicarLinha: (s) => abrirDetalhe(s, ctx),
    vazio: {
      ico: 'onibus', titulo: 'Nenhuma solicitação no período',
      texto: 'Ajuste os filtros acima ou clique em “Nova solicitação”.',
    },
  });
  await abrirPeloEndereco(lista);
}

// `#/solicitacoes?abrir=<id>`: o sino aponta para cá (spec
// 2026-10-10-sate-notificacoes, D4). Abre a ficha uma vez e limpa o
// endereço, para recarregar a página não reabrir a mesma solicitação.
async function abrirPeloEndereco(lista) {
  const id = new URLSearchParams(String(location.hash).split('?')[1] || '').get('abrir');
  if (!id) return;
  history.replaceState(null, '', `${location.pathname}${location.search}#/solicitacoes`);
  let s = lista.find(x => x.id === id);
  // Fora do período filtrado, busca pelo id. Vendo como uma escola, não:
  // a lista já foi filtrada pelo que ela veria, e a busca passaria por fora.
  if (!s && !ctx.simulando) {
    s = (await listSolicitacoes({ id }).catch(() => []))[0];
    if (s) {
      // A lista monta as escolas da viagem; a busca pelo id não.
      const partes = await getParticipacoesDe([s.id]).catch(() => ({}));
      s._escolas = resumoEscolas(partes[s.id] || []);
      s._escolasCurto = resumoEscolas(partes[s.id] || [], { curto: true });
    }
  }
  if (!s) return toast({ titulo: 'Solicitação não encontrada', texto: 'Ela pode ter sido excluída.', tipo: 'atencao' });
  abrirDetalhe(s, ctx).catch(err => console.warn('[sate] ficha:', err?.message || err));
}

// `valor` ordena e busca (texto puro); `celula` desenha (spec de listas,
// D2). Sem a separação, ordenar "Situação" ordenaria pelo markup do chip.
const nomeEscolas = (s) => s._escolas || s.unidade?.nome || '';
const apelidoEscolas = (s) => s._escolasCurto || s.unidade?.apelido || nomeEscolas(s);

const sub = (t) => (t ? `<small class="sol-sub">${esc(t)}</small>` : '');
const hora = (h) => (h ? String(h).slice(0, 5) : '');
const enderecoDe = (s) => [[s.destino_endereco, s.destino_numero].filter(Boolean).join(', '), s.destino_bairro].filter(Boolean).join(' - ');
const localDe = (s) => s.destino_nome || tituloDoPedido(s);

const COLUNAS = [
  // "Escolas", no plural: uma viagem pode ter várias, e a coluna mostra
  // a primeira mais a contagem ("Escola Exemplo +2"). Nome completo; em
  // tela estreita, o apelido em maiúsculas (spec 2026-10-10-sate-solicitacao,
  // D2) - os dois vão na célula e o CSS mostra um. `valor` traz os dois
  // para a busca achar por qualquer um; a ordem é pelo nome completo.
  { id: 'escola', rotulo: 'Escolas',
    valor: s => [nomeEscolas(s), apelidoEscolas(s)].filter(Boolean).join(' · '),
    celula: s => `<span data-escolas-de="${esc(s.id)}">${idsComNovidade().has(s.id) ? pontoHtml(s.id) : ''}`
      + `<span class="sol-esc-nome">${esc(nomeEscolas(s))}</span><span class="sol-esc-apelido">${esc(apelidoEscolas(s))}</span></span>` },
  { id: 'data', rotulo: 'Data', tipo: 'data',
    valor: s => s.data || '',
    celula: s => `${esc(fmtData(s.data))}<span class="sol-sub">${periodoBadge(s.periodo)}</span>` },
  { id: 'local', rotulo: 'Local', prioridade: 2,
    valor: s => `${localDe(s)} ${enderecoDe(s)}`,
    celula: s => `${esc(localDe(s))}${localAConferir(s) ? ' <span class="tag">Local a conferir</span>' : ''}${sub(enderecoDe(s))}` },
  { id: 'alunos', rotulo: 'Estudantes', prioridade: 3, tipo: 'numero', alinhar: 'dir',
    valor: s => s.qtd_alunos || 0 },
  { id: 'embarque', rotulo: 'Embarque', prioridade: 3,
    valor: s => hora(s.horario_embarque) },
  { id: 'saida', rotulo: 'Saída', prioridade: 3,
    valor: s => hora(s.horario_retorno) },
  { id: 'onibus', rotulo: 'Ônibus', prioridade: 3, tipo: 'numero', alinhar: 'dir',
    valor: s => s.qtd_onibus || 0,
    celula: s => `${s.qtd_onibus || 0}${s.qtd_vans ? ` <span class="tag bus">${ico('cadeirante', { tam: 11 })} +${s.qtd_vans} van</span>` : ''}` },
  { id: 'situacao', rotulo: 'Status',
    valor: s => STATUS[s.status] || s.status,
    celula: s => `<span class="tag st-${esc(s.status)}">${esc(STATUS[s.status] || s.status)}</span>` },
  { id: 'criado', rotulo: 'Solicitado em', prioridade: 2, tipo: 'datahora',
    valor: s => s.criado_em || '',
    celula: s => { const [d, h] = fmtDataHora(s.criado_em).split(', '); return `${esc(d || '')}${sub(h)}`; } },
];

// Ações da linha, na ordem: aprovar, editar, negar, excluir. Quais cabem
// vem de acoesDoPedido (a mesma regra da ficha); o RLS é quem barra de fato.
const cabe = (s, acao) => acoesDoPedido(s, { aprovador: !!ctx?.aprovador, somenteLeitura: !!ctx?.somenteLeitura }).decisoes.includes(acao);
const ACOES = [
  { rotulo: 'Aprovar', ico: 'ok', quando: s => cabe(s, 'confirmar'),
    ao: s => decidirDaLista('confirmar', s, { ctx, paradas: s._partes || [] }) },
  { rotulo: 'Editar', ico: 'editar', quando: s => acoesDoPedido(s, { aprovador: !!ctx?.aprovador }).editar,
    ao: s => abrirEditar(s, ctx, () => ctx.recarregar?.()) },
  { rotulo: 'Negar', ico: 'fechar', perigo: true, quando: s => cabe(s, 'negar'),
    ao: s => decidirDaLista('negar', s, { ctx, paradas: s._partes || [] }) },
  { rotulo: 'Excluir', ico: 'excluir', perigo: true,
    ao: async (s) => {
      const ok = await confirmar('Excluir esta solicitação?', {
        detalhe: 'Ela some da lista com as escolas da viagem. A exclusão fica registrada na Auditoria.', textoOk: 'Excluir', perigo: true,
      });
      if (!ok) return;
      try { await excluirSolicitacao(s.id); toast({ titulo: 'Solicitação excluída', texto: tituloDoPedido(s), tipo: 'sucesso' }); carregar(); }
      catch (err) { reportarErro(err, { titulo: 'Não foi possível excluir' }); }
    } },
];
