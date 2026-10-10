// ============================================================
// FundHub - modules/notificacoes/notificacoes.service.js
// Sino no topo + balões para o que acontece em VÁRIOS módulos.
//
// Duas naturezas de aviso convivem aqui (spec 2026-10-10-sate-notificacoes):
//   SATE          persistente. O fato é gravado pelo banco e fica no sino
//                 até a pessoa ABRIR a solicitação - pelo próprio sino ou
//                 pela lista. Abrir o sino não limpa nada. Quem lê e filtra
//                 é sate/avisos.model.js; aqui só se desenha.
//   afastamentos  ao vivo. Eco do Realtime: chega a quem está com a tela
//   e ocorrências aberta e some ao recarregar. (Pendência registrada: o
//                 mesmo desenho do SATE serve a eles, com tabelas próprias.)
//
// Serviço (sem tela): main.js chama iniciar() após o login e parar()
// no logout - o contrato de todo módulo com `servico: true`. O SATE
// (sate.js) chama o mesmo serviço com `fontes: ['sate']`: na página dele,
// aviso de afastamento seria ruído.
//
// Cada tabela AO VIVO tem um "descritor" que traduz o evento cru num aviso
// legível. Os nomes (escola, servidor) vêm de mapas carregados uma vez,
// para não consultar o banco a cada notificação.
// ============================================================
import {
  carregarAvisos, pendentes, receberAviso, descrever, subscribeAvisos, aoMudarAvisos, limparAvisos,
} from '../sate/avisos.model.js';
import { nivel } from '../../core/permissoes.js';
import { subscribeAfastamentos } from '../afastamentos/afastamentos.model.js';
import { subscribeOcorrencias, STATUS as STATUS_OCOR } from '../ocorrencias/ocorrencias.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { getServidores } from '../servidores/servidores.model.js';
import { esc } from '../../shared/dom.js';
import { horaAgora, fmtDataHora } from '../../shared/format.js';
import { toast, limparToasts } from '../../shared/ui/toast.js';
import { ico } from '../../shared/ui/icones.js';

const MAX_EVENTOS = 25;
const TODAS = ['sate', 'afastamentos', 'ocorrencias'];

let unsubs = [], ligado = false;
let eventos = [], naoLidas = 0, aberto = false;
const nomeUnidade = {}, nomeServidor = {};
let naPaginaDoSate = false;
let comSate = false;

const escolaDe = (row) => nomeUnidade[row.unidade_id] || 'Escola';

// Um descritor por tabela ao vivo: recebe o payload do Realtime, devolve
// { titulo, tipo, texto } ou null para ignorar.
const DESCRITORES = {
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

export async function iniciar({ fontes = TODAS, naPaginaDoSate: noSate = false } = {}) {
  if (ligado) return;
  ligado = true;
  naPaginaDoSate = noSate;
  comSate = fontes.includes('sate');
  montarSino();

  // Mapas id → nome, para descrever o evento sem uma consulta por notificação.
  // Servidores só quando há afastamento na lista: é a carga mais pesada.
  const [unidades, servidores] = await Promise.all([
    getUnidades().catch(() => []),
    fontes.includes('afastamentos') ? getServidores().catch(() => []) : [],
  ]);
  unidades.forEach(u => { if (u.id) nomeUnidade[u.id] = u.nome; });
  servidores.forEach(s => { nomeServidor[s.id] = s.apelido || s.nome; });

  if (!ligado) return;   // parou enquanto os mapas carregavam
  unsubs = [
    ...(fontes.includes('afastamentos') ? [subscribeAfastamentos(aoEvento)] : []),
    ...(fontes.includes('ocorrencias') ? [subscribeOcorrencias(aoEvento)] : []),
  ];

  if (comSate) {
    // Qualquer mudança nos avisos (carga, chegada, visto) repinta o sino.
    unsubs.push(aoMudarAvisos(pintar), subscribeAvisos(aoAvisoDoSate));
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    document.addEventListener('cfg:salva', aoSalvarConfiguracao);
    await carregarAvisos({ nivel: nivel('sate') });
  }
}

// A solicitação pode ter sido aberta em OUTRA aba (o FundHub abre o SATE em
// nova aba): ao voltar para esta, o sino confere de novo.
function aoVoltarParaAba() {
  if (!document.hidden && ligado && comSate) carregarAvisos();
}

// A lista por ver vem do banco já filtrada pelos tipos que a pessoa quer:
// LIGAR um aviso nas Configurações precisa de uma recarga para trazer o que
// estava fora. (Desligar já vale na hora, pelo filtro de pendentes().)
function aoSalvarConfiguracao(e) {
  if (ligado && comSate && e.detail?.modulo === 'sate') carregarAvisos();
}

// Só INSERT interessa: aviso não se edita. O balão sai apenas para o que
// interessa à pessoa (e nunca para o que ela mesma fez).
async function aoAvisoDoSate(payload) {
  if (payload?.eventType !== 'INSERT') return;
  const aviso = await receberAviso(payload.new?.id);
  if (aviso) toast(descrever(aviso, nomeUnidade));
}

export function parar() {
  unsubs.splice(0).forEach(u => { try { u(); } catch (_) {} });
  ligado = false; aberto = false;
  eventos = []; naoLidas = 0;
  document.removeEventListener('visibilitychange', aoVoltarParaAba);
  document.removeEventListener('cfg:salva', aoSalvarConfiguracao);
  limparAvisos();
  comSate = false;
  document.querySelector('.bell-wrap')?.remove();
  limparToasts();
}

function aoEvento(payload) {
  const descritor = DESCRITORES[payload.table];
  if (!descritor) return;
  const row = payload.new || payload.old || {};
  const ev = descritor(payload, row);
  if (!ev) return;
  ev.hora = horaAgora();
  eventos.unshift(ev);
  if (eventos.length > MAX_EVENTOS) eventos.pop();
  if (!aberto) naoLidas++;
  pintar();
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
  // Clicar num aviso do SATE leva à solicitação: o painel fecha.
  wrap.addEventListener('click', (e) => { if (e.target.closest('a.bell-item')) fechar(); });
}

function abrir() {
  aberto = true; naoLidas = 0;
  document.getElementById('bell-panel').hidden = false;
  pintar();
}

function fechar() {
  aberto = false;
  const p = document.getElementById('bell-panel');
  if (p) p.hidden = true;
}

// Endereço direto para a ficha de uma solicitação. Dentro do SATE é só
// trocar o hash; no FundHub, o SATE abre em nova aba, como o item do menu.
const linkDaSolicitacao = (id) => `${naPaginaDoSate ? '' : 'sate.html'}#/solicitacoes?abrir=${encodeURIComponent(id)}`;

function pintar() {
  const doSate = comSate ? pendentes() : [];
  const b = document.getElementById('bell-badge');
  if (b) {
    const total = doSate.length + naoLidas;
    b.textContent = String(total);
    b.hidden = total === 0;
  }
  const el = document.getElementById('bell-lista');
  if (!el) return;
  const fora = naPaginaDoSate ? '' : ' target="_blank" rel="noopener"';
  const persistentes = doSate.map(a => {
    const d = descrever(a, nomeUnidade);
    return `<a class="bell-item t-${esc(d.tipo)}" href="${esc(linkDaSolicitacao(a.solicitacao_id))}"${fora}>
      <div class="bi-tit">${esc(d.titulo)} <span class="bi-hora">${esc(fmtDataHora(a.em))}</span></div>
      <div class="bi-txt">${esc(d.texto)}</div>
    </a>`;
  }).join('');
  const aoVivo = eventos.map(e => `
    <div class="bell-item t-${esc(e.tipo)}">
      <div class="bi-tit">${esc(e.titulo)} <span class="bi-hora">${esc(e.hora)}</span></div>
      <div class="bi-txt">${esc(e.texto)}</div>
    </div>`).join('');
  el.innerHTML = (persistentes + aoVivo) || `<div class="bell-vazio">Sem notificações.</div>`;
}
