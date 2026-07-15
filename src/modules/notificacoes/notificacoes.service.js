// ============================================================
// FundHub — modules/notificacoes/notificacoes.service.js
// Sino no topo + toasts para eventos em tempo real de VÁRIOS módulos:
// solicitações (SATE), afastamentos e ocorrências. O RLS garante que
// cada usuário só recebe eventos das linhas que já poderia ver.
//
// Serviço (sem tela): main.js chama iniciar() após o login e parar()
// no logout — o contrato de todo módulo com `servico: true`.
//
// Cada tabela tem um "descritor" que traduz o evento cru num aviso
// legível. Acrescentar uma fonte = assinar a tabela + escrever o
// descritor. Os nomes (escola, atividade, servidor) vêm de mapas
// carregados uma vez, para não consultar o banco a cada notificação.
// ============================================================
import { subscribeSolicitacoes, STATUS as STATUS_SATE } from '../sate/sate.model.js';
import { subscribeAfastamentos } from '../afastamentos/afastamentos.model.js';
import { subscribeOcorrencias } from '../ocorrencias/ocorrencias.model.js';
import { STATUS as STATUS_OCOR } from '../ocorrencias/ocorrencias.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { getAtividades } from '../sate/atividades.model.js';
import { getServidores } from '../servidores/servidores.model.js';
import { esc } from '../../shared/dom.js';
import { horaAgora } from '../../shared/format.js';
import { toast, limparToasts } from '../../shared/ui/toast.js';

const MAX_EVENTOS = 25;

let unsubs = [], ligado = false;
let eventos = [], naoLidas = 0, aberto = false;
const nomeUnidade = {}, nomeAtividade = {}, nomeServidor = {};

const escolaDe = (row) => nomeUnidade[row.unidade_id] || 'Escola';

// Um descritor por tabela: recebe o payload do Realtime, devolve
// { titulo, tipo, texto } ou null para ignorar.
const DESCRITORES = {
  solicitacao_transporte(p, row) {
    const atividade = nomeAtividade[row.atividade_id] || row.atividade_livre || 'atividade';
    if (p.eventType === 'INSERT') return { titulo: 'Nova solicitação', tipo: 'novo', texto: `${escolaDe(row)} · ${atividade}` };
    if (p.eventType === 'DELETE') return { titulo: 'Solicitação removida', tipo: 'del', texto: `${escolaDe(row)} · ${atividade}` };
    const tipo = row.status === 'confirmado' ? 'ok' : (row.status === 'negado' ? 'no' : 'upd');
    return { titulo: STATUS_SATE[row.status] || 'Solicitação atualizada', tipo, texto: `${escolaDe(row)} · ${atividade}` };
  },
  afastamento(p, row) {
    const servidor = nomeServidor[row.servidor_id] || 'Servidor';
    if (p.eventType === 'INSERT') return { titulo: 'Novo afastamento', tipo: 'novo', texto: `${servidor} · ${row.tipo || ''}`.trim() };
    if (p.eventType === 'DELETE') return { titulo: 'Afastamento removido', tipo: 'del', texto: `${servidor} · ${row.tipo || ''}`.trim() };
    return { titulo: 'Afastamento atualizado', tipo: 'upd', texto: `${servidor} · ${row.tipo || ''}`.trim() };
  },
  ocorrencia(p, row) {
    const onde = row.unidade_id ? ` · ${escolaDe(row)}` : '';
    if (p.eventType === 'INSERT') return { titulo: 'Nova ocorrência', tipo: 'novo', texto: `${row.assunto || 'Atendimento'}${onde}` };
    if (p.eventType === 'DELETE') return { titulo: 'Ocorrência removida', tipo: 'del', texto: `${row.assunto || 'Atendimento'}${onde}` };
    const tipo = row.status === 'resolvida' ? 'ok' : 'upd';
    return { titulo: STATUS_OCOR[row.status] || 'Ocorrência atualizada', tipo, texto: `${row.assunto || 'Atendimento'}${onde}` };
  },
};

export async function iniciar() {
  if (ligado) return;
  ligado = true;
  montarSino();

  // Mapas id → nome, para descrever o evento sem uma consulta por notificação.
  const [unidades, atividades, servidores] = await Promise.all([
    getUnidades().catch(() => []),
    getAtividades().catch(() => []),
    getServidores().catch(() => []),
  ]);
  unidades.forEach(u => { if (u.id) nomeUnidade[u.id] = u.apelido || u.nome; });
  atividades.forEach(a => { nomeAtividade[a.id] = a.nome; });
  servidores.forEach(s => { nomeServidor[s.id] = s.apelido || s.nome; });

  unsubs = [
    subscribeSolicitacoes(aoEvento),
    subscribeAfastamentos(aoEvento),
    subscribeOcorrencias(aoEvento),
  ];
}

export function parar() {
  unsubs.splice(0).forEach(u => { try { u(); } catch (_) {} });
  ligado = false; aberto = false;
  eventos = []; naoLidas = 0;
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
    <button class="bell" id="bell" type="button" title="Notificações" aria-label="Notificações">
      🔔<span class="bell-badge" id="bell-badge" hidden>0</span>
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
