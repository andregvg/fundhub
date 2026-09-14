// ============================================================
// FundHub - modules/notificacoes/notificacoes.service.js
// Sino no topo + toasts para eventos em tempo real de VÁRIOS módulos:
// solicitações e escolas das viagens (SATE), afastamentos e ocorrências.
// O RLS garante que cada usuário só recebe eventos das linhas que já
// poderia ver.
//
// Serviço (sem tela): main.js chama iniciar() após o login e parar()
// no logout - o contrato de todo módulo com `servico: true`. O SATE
// (sate.js) chama o mesmo serviço com `fontes: ['sate']`: na página dele,
// aviso de afastamento seria ruído.
//
// Cada tabela tem um "descritor" que traduz o evento cru num aviso
// legível. Acrescentar uma fonte = assinar a tabela + escrever o
// descritor. Os nomes (escola, atividade, servidor) vêm de mapas
// carregados uma vez, para não consultar o banco a cada notificação.
// ============================================================
import { subscribeSolicitacoes, STATUS as STATUS_SATE } from '../sate/sate.model.js';
import { subscribeParticipacoes } from '../sate/participacoes.model.js';
import { getAtividades } from '../sate/atividades.model.js';
import { subscribeAfastamentos } from '../afastamentos/afastamentos.model.js';
import { subscribeOcorrencias, STATUS as STATUS_OCOR } from '../ocorrencias/ocorrencias.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { getServidores } from '../servidores/servidores.model.js';
import { esc } from '../../shared/dom.js';
import { horaAgora, fmtData } from '../../shared/format.js';
import { toast, limparToasts } from '../../shared/ui/toast.js';
import { ico } from '../../shared/ui/icones.js';

const MAX_EVENTOS = 25;
const TODAS = ['sate', 'afastamentos', 'ocorrencias'];

let unsubs = [], ligado = false;
let eventos = [], naoLidas = 0, aberto = false;
const nomeUnidade = {}, nomeAtividade = {}, nomeServidor = {};

const escolaDe = (row) => nomeUnidade[row.unidade_id] || 'Escola';

// ── Ruído do cache de totais ─────────────────────────────────
// Toda mudança numa participação dispara o gatilho que recalcula os
// totais do pedido (migration 037) - e isso chega aqui como UPDATE do
// pedido, com o status de sempre. Sem filtro, pedir para sair gerava
// também um "Confirmado" que ninguém decidiu.
//
// O Realtime não manda a linha anterior (sem REPLICA IDENTITY FULL), então
// não dá para comparar o status. Dois sinais bastam:
//   1. o gatilho não toca `atualizado_em`: carimbo bem mais velho que o
//      commit = manutenção de cache;
//   2. o mesmo pedido acabou de avisar (criar o pedido e o gatilho saem na
//      mesma transação, com o mesmo carimbo).
const JANELA_MS = 4000;
const ultimoAviso = new Map();

export function ehRuidoDeTotais(payload, agora = Date.now()) {
  if (payload?.table !== 'solicitacao_transporte' || payload.eventType !== 'UPDATE') return false;
  const row = payload.new || {};
  const commit = Date.parse(payload.commit_timestamp || '');
  const carimbo = Date.parse(row.atualizado_em || '');
  if (Number.isFinite(commit) && Number.isFinite(carimbo) && commit - carimbo > 10000) return true;
  const antes = ultimoAviso.get(row.id);
  return antes != null && agora - antes < JANELA_MS;
}

// Um descritor por tabela: recebe o payload do Realtime, devolve
// { titulo, tipo, texto } ou null para ignorar.
const DESCRITORES = {
  solicitacao_transporte(p, row) {
    const atividade = nomeAtividade[row.atividade_id] || row.atividade_livre || 'atividade';
    // Pedido montado pela Gerência não tem escola que abriu (037, D3).
    const quem = row.unidade_id ? escolaDe(row) : 'Gerência de Transporte';
    const texto = `${quem} · ${atividade}${row.data ? ` · ${fmtData(row.data)}` : ''}`;
    if (p.eventType === 'INSERT') return { titulo: 'Nova solicitação', tipo: 'info', texto };
    if (p.eventType === 'DELETE') return { titulo: 'Solicitação removida', tipo: 'erro', texto: 'Um pedido de transporte foi apagado.' };
    const tipo = row.status === 'confirmado' ? 'sucesso' : (['negado', 'cancelado'].includes(row.status) ? 'erro' : 'atencao');
    return { titulo: STATUS_SATE[row.status] || 'Solicitação atualizada', tipo, texto };
  },
  // Só o que alguém precisa saber. Reordenar e voltar a `ativa` também
  // chegam como UPDATE, sem dizer o que mudou - e aí calar é melhor que
  // avisar "participação atualizada" a cada arrasto.
  solicitacao_participacao(p, row) {
    const quem = row.unidade_id ? escolaDe(row) : 'Um ponto de embarque';
    if (p.eventType === 'INSERT') return { titulo: 'Parada acrescentada', tipo: 'info', texto: `${quem} entrou numa viagem.` };
    if (p.eventType !== 'UPDATE') return null;
    if (row.status === 'pendente_cancelamento') return { titulo: 'Pedido de saída', tipo: 'atencao', texto: `${quem} pediu para sair de uma viagem.` };
    if (row.status === 'cancelada') return { titulo: 'Saída confirmada', tipo: 'erro', texto: `${quem} saiu de uma viagem.` };
    return null;
  },
  afastamento(p, row) {
    const servidor = nomeServidor[row.servidor_id] || 'Servidor';
    if (p.eventType === 'INSERT') return { titulo: 'Novo afastamento', tipo: 'info', texto: `${servidor} · ${row.tipo || ''}`.trim() };
    if (p.eventType === 'DELETE') return { titulo: 'Afastamento removido', tipo: 'erro', texto: `${servidor} · ${row.tipo || ''}`.trim() };
    return { titulo: 'Afastamento atualizado', tipo: 'atencao', texto: `${servidor} · ${row.tipo || ''}`.trim() };
  },
  ocorrencia(p, row) {
    const onde = row.unidade_id ? ` · ${escolaDe(row)}` : '';
    if (p.eventType === 'INSERT') return { titulo: 'Nova ocorrência', tipo: 'info', texto: `${row.assunto || 'Atendimento'}${onde}` };
    if (p.eventType === 'DELETE') return { titulo: 'Ocorrência removida', tipo: 'erro', texto: `${row.assunto || 'Atendimento'}${onde}` };
    const tipo = row.status === 'resolvida' ? 'sucesso' : 'atencao';
    return { titulo: STATUS_OCOR[row.status] || 'Ocorrência atualizada', tipo, texto: `${row.assunto || 'Atendimento'}${onde}` };
  },
};

export async function iniciar({ fontes = TODAS } = {}) {
  if (ligado) return;
  ligado = true;
  montarSino();

  // Mapas id → nome, para descrever o evento sem uma consulta por notificação.
  // Servidores só quando há afastamento na lista: é a carga mais pesada.
  const [unidades, atividades, servidores] = await Promise.all([
    getUnidades().catch(() => []),
    fontes.includes('sate') ? getAtividades().catch(() => []) : [],
    fontes.includes('afastamentos') ? getServidores().catch(() => []) : [],
  ]);
  unidades.forEach(u => { if (u.id) nomeUnidade[u.id] = u.apelido || u.nome; });
  atividades.forEach(a => { nomeAtividade[a.id] = a.nome; });
  servidores.forEach(s => { nomeServidor[s.id] = s.apelido || s.nome; });

  if (!ligado) return;   // parou enquanto os mapas carregavam
  unsubs = [
    ...(fontes.includes('sate') ? [subscribeSolicitacoes(aoEvento), subscribeParticipacoes(aoEvento)] : []),
    ...(fontes.includes('afastamentos') ? [subscribeAfastamentos(aoEvento)] : []),
    ...(fontes.includes('ocorrencias') ? [subscribeOcorrencias(aoEvento)] : []),
  ];
}

export function parar() {
  unsubs.splice(0).forEach(u => { try { u(); } catch (_) {} });
  ligado = false; aberto = false;
  eventos = []; naoLidas = 0;
  ultimoAviso.clear();
  document.querySelector('.bell-wrap')?.remove();
  limparToasts();
}

function aoEvento(payload) {
  const descritor = DESCRITORES[payload.table];
  if (!descritor || ehRuidoDeTotais(payload)) return;
  const row = payload.new || payload.old || {};
  const ev = descritor(payload, row);
  if (!ev) return;
  const idPedido = payload.table === 'solicitacao_transporte' ? row.id : row.solicitacao_id;
  if (idPedido) ultimoAviso.set(idPedido, Date.now());
  ev.hora = horaAgora();
  eventos.unshift(ev);
  if (eventos.length > MAX_EVENTOS) eventos.pop();
  if (aberto) renderLista();
  else { naoLidas++; atualizarBadge(); }
  toast(ev);
}

// ── Sino ─────────────────────────────────────────────────────
function montarSino() {
  const right = document.querySelector('.topbar-right');
  if (!right || right.querySelector('.bell-wrap')) return;

  const wrap = document.createElement('div');
  wrap.className = 'bell-wrap';
  wrap.innerHTML = `
    <button class="topbar-acao" id="bell" type="button" title="Notificações" aria-label="Notificações">
      ${ico('sino', { tam: 18 })}<span class="bell-badge" id="bell-badge" hidden>0</span>
    </button>
    <div class="bell-panel" id="bell-panel" hidden>
      <div class="bell-head">Notificações</div>
      <div id="bell-lista" class="bell-lista"></div>
    </div>`;
  right.insertBefore(wrap, right.firstChild);

  document.getElementById('bell').addEventListener('click', () => (aberto ? fechar() : abrir()));
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) fechar(); });
}

function abrir() {
  aberto = true; naoLidas = 0; atualizarBadge();
  document.getElementById('bell-panel').hidden = false;
  renderLista();
}

function fechar() {
  aberto = false;
  const p = document.getElementById('bell-panel');
  if (p) p.hidden = true;
}

function atualizarBadge() {
  const b = document.getElementById('bell-badge');
  if (!b) return;
  b.textContent = String(naoLidas);
  b.hidden = naoLidas === 0;
}

function renderLista() {
  const el = document.getElementById('bell-lista');
  if (!el) return;
  el.innerHTML = eventos.length
    ? eventos.map(e => `
      <div class="bell-item t-${e.tipo}">
        <div class="bi-tit">${esc(e.titulo)} <span class="bi-hora">${esc(e.hora)}</span></div>
        <div class="bi-txt">${esc(e.texto)}</div>
      </div>`).join('')
    : `<div class="bell-vazio">Sem notificações ainda.</div>`;
}
